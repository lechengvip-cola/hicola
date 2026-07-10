import { getAdminEmail, updateFamilyPassword } from "../../../_lib/album/auth.js";
import { eventSummarySql, getSettings, nowIso, publicSettings, uuid } from "../../../_lib/album/db.js";
import { assertAllowedFile, extensionOf, mediaTypeOf, objectKeys } from "../../../_lib/album/media.js";
import { error, methodNotAllowed, notFound, ok, readJson } from "../../../_lib/album/response.js";

const partsOf = (context) => context.params.path || [];

const requireAdmin = (request, env) => {
  const email = getAdminEmail(request, env);
  if (!email) return { response: error("ADMIN_REQUIRED", "需要管理员权限。", 401) };
  return { email };
};

const dateParts = (dateText) => {
  const raw = String(dateText || nowIso()).slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateParts(nowIso());
  return {
    eventDate: raw,
    year: Number(match[1]),
    month: Number(match[2]),
  };
};

const ensureEvent = async (env, eventDate, status = "draft") => {
  const existing = await env.DB.prepare("SELECT * FROM album_events WHERE event_date = ? AND status = ? AND deleted_at IS NULL")
    .bind(eventDate, status)
    .first();
  if (existing) return existing;
  const id = uuid();
  const now = nowIso();
  const parts = dateParts(eventDate);
  await env.DB.prepare(
    `INSERT INTO album_events (id, title, event_date, year, month, status, created_at, updated_at)
     VALUES (?, '', ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, parts.eventDate, parts.year, parts.month, status, now, now)
    .run();
  return env.DB.prepare("SELECT * FROM album_events WHERE id = ?").bind(id).first();
};

const security = async (env) => {
  const settings = await getSettings(env);
  const sessions = await env.DB.prepare("SELECT COUNT(*) AS count FROM family_sessions WHERE revoked_at IS NULL AND expires_at > ?")
    .bind(nowIso())
    .first();
  return ok({ settings: { ...publicSettings(settings), activeSessionCount: Number(sessions?.count || 0) } });
};

const setPassword = async (env, request, adminEmail) => {
  const body = await readJson(request);
  if (body.password !== body.confirmPassword) return error("PASSWORD_MISMATCH", "两次输入的家庭密码不一致。", 400);
  try {
    await updateFamilyPassword(env, String(body.password || ""), adminEmail);
    return ok({ message: "家庭密码已更新，所有家庭设备需要重新登录。" });
  } catch (err) {
    return error("INVALID_PASSWORD", err.message || "家庭密码不符合规则。", 400);
  }
};

const patchSecurity = async (env, request) => {
  const body = await readJson(request);
  const accessEnabled = body.accessEnabled ? 1 : 0;
  const days = Math.min(30, Math.max(1, Number(body.sessionDays || 30)));
  await env.DB.prepare("UPDATE album_security_settings SET family_access_enabled = ?, family_session_days = ?, updated_at = ? WHERE id = 1")
    .bind(accessEnabled, days, nowIso())
    .run();
  return security(env);
};

const logoutAll = async (env) => {
  await env.DB.prepare("UPDATE album_security_settings SET family_password_version = family_password_version + 1, updated_at = ? WHERE id = 1")
    .bind(nowIso())
    .run();
  await env.DB.prepare("UPDATE family_sessions SET revoked_at = ? WHERE revoked_at IS NULL").bind(nowIso()).run();
  return ok({ message: "所有家庭设备已退出。" });
};

const createBatch = async (env, request, adminEmail) => {
  const body = await readJson(request);
  const id = uuid();
  await env.DB.prepare(
    `INSERT INTO upload_batches
     (id, status, total_files, total_bytes, created_by, created_at)
     VALUES (?, 'uploading', ?, ?, ?, ?)`,
  )
    .bind(id, Number(body.totalFiles || 0), Number(body.totalBytes || 0), adminEmail, nowIso())
    .run();
  return ok({ batchId: id });
};

const prepareUpload = async (env) =>
  ok({
    directUpload: false,
    maxUploadSize: Number(env.MAX_UPLOAD_SIZE || 52428800),
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "video/mp4", "video/quicktime", "video/webm"],
  });

const batchDetail = async (env, id) => {
  const batch = await env.DB.prepare("SELECT * FROM upload_batches WHERE id = ?").bind(id).first();
  if (!batch) return notFound();
  const errors = await env.DB.prepare("SELECT * FROM upload_errors WHERE batch_id = ? ORDER BY created_at DESC").bind(id).all();
  return ok({ batch, errors: errors.results || [] });
};

const retryBatch = async (env, id) => {
  await env.DB.prepare("UPDATE upload_batches SET status = 'uploading' WHERE id = ?").bind(id).run();
  return ok({ message: "可以继续上传失败文件。" });
};

const completeUpload = async (env, request) => {
  const form = await request.formData();
  const batchId = String(form.get("batchId") || "");
  const file = form.get("file");
  const thumbnail = form.get("thumbnail");
  const preview = form.get("preview");
  const sha256 = String(form.get("sha256") || "");
  const capturedAt = String(form.get("capturedAt") || "");
  const dateSource = String(form.get("dateSource") || "upload");
  const width = Number(form.get("width") || 0);
  const height = Number(form.get("height") || 0);
  if (!batchId || !file || !sha256) return error("BAD_UPLOAD", "上传参数不完整。", 400);
  const maxSize = Number(env.MAX_UPLOAD_SIZE || 52428800);
  assertAllowedFile(file, maxSize);

  const duplicate = await env.DB.prepare("SELECT id, event_id FROM album_media WHERE sha256 = ? AND deleted_at IS NULL").bind(sha256).first();
  if (duplicate) {
    await env.DB.prepare("UPDATE upload_batches SET duplicate_files = duplicate_files + 1 WHERE id = ?").bind(batchId).run();
    return ok({ duplicate: true, mediaId: duplicate.id, eventId: duplicate.event_id });
  }

  const mediaId = uuid();
  const mediaType = mediaTypeOf(file.type);
  const ext = extensionOf(file.name);
  const date = dateParts(capturedAt || nowIso());
  const event = await ensureEvent(env, date.eventDate, "draft");
  const keys = objectKeys(date.year, mediaId, ext, mediaType);
  await env.ALBUM_BUCKET.put(keys.originalKey, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { originalFilename: file.name },
  });
  if (thumbnail && thumbnail.size) {
    await env.ALBUM_BUCKET.put(keys.thumbnailKey, thumbnail.stream(), { httpMetadata: { contentType: "image/webp" } });
  } else {
    await env.ALBUM_BUCKET.put(keys.thumbnailKey, new Uint8Array(), { httpMetadata: { contentType: "application/octet-stream" } });
  }
  if (preview && preview.size && keys.previewKey) {
    await env.ALBUM_BUCKET.put(keys.previewKey, preview.stream(), { httpMetadata: { contentType: "image/webp" } });
  }
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO album_media
     (id, event_id, batch_id, original_key, preview_key, thumbnail_key, original_filename, mime_type,
      media_type, file_size, sha256, captured_at, date_source, width, height, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      mediaId,
      event.id,
      batchId,
      keys.originalKey,
      keys.previewKey,
      keys.thumbnailKey,
      file.name,
      file.type,
      mediaType,
      file.size,
      sha256,
      date.eventDate,
      dateSource,
      width || null,
      height || null,
      now,
      now,
    )
    .run();
  if (!event.cover_media_id) {
    await env.DB.prepare("UPDATE album_events SET cover_media_id = ?, updated_at = ? WHERE id = ?").bind(mediaId, now, event.id).run();
  }
  await env.DB.prepare("UPDATE upload_batches SET completed_files = completed_files + 1 WHERE id = ?").bind(batchId).run();
  return ok({ duplicate: false, mediaId, eventId: event.id });
};

const listPending = async (env) => {
  const result = await env.DB.prepare(`${eventSummarySql("WHERE e.status = 'draft' AND e.deleted_at IS NULL")} ORDER BY e.event_date DESC`).all();
  return ok({ events: result.results || [] });
};

const listPublished = async (env) => {
  const result = await env.DB.prepare(`${eventSummarySql("WHERE e.status = 'published' AND e.deleted_at IS NULL")} ORDER BY e.event_date DESC`).all();
  return ok({ events: result.results || [] });
};

const publish = async (env, request) => {
  const body = await readJson(request);
  const ids = Array.isArray(body.eventIds) ? body.eventIds : [];
  const now = nowIso();
  if (ids.length === 0) {
    await env.DB.prepare("UPDATE album_events SET status = 'published', published_at = ?, updated_at = ? WHERE status = 'draft' AND deleted_at IS NULL")
      .bind(now, now)
      .run();
  } else {
    for (const id of ids) {
      await env.DB.prepare("UPDATE album_events SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?")
        .bind(now, now, id)
        .run();
    }
  }
  return ok({ message: "相册已发布。" });
};

const updateEvent = async (env, request, id) => {
  const body = await readJson(request);
  const parts = dateParts(body.eventDate || nowIso());
  await env.DB.prepare("UPDATE album_events SET title = ?, event_date = ?, year = ?, month = ?, cover_media_id = COALESCE(?, cover_media_id), updated_at = ? WHERE id = ?")
    .bind(String(body.title || ""), parts.eventDate, parts.year, parts.month, body.coverMediaId || null, nowIso(), id)
    .run();
  return ok();
};

const mergeEvent = async (env, request, id) => {
  const body = await readJson(request);
  const sourceIds = Array.isArray(body.sourceEventIds) ? body.sourceEventIds.filter((item) => item !== id) : [];
  for (const sourceId of sourceIds) {
    await env.DB.prepare("UPDATE album_media SET event_id = ?, updated_at = ? WHERE event_id = ?").bind(id, nowIso(), sourceId).run();
    await env.DB.prepare("UPDATE album_events SET status = 'hidden', deleted_at = ?, updated_at = ? WHERE id = ?").bind(nowIso(), nowIso(), sourceId).run();
  }
  return ok({ message: "相册已合并。" });
};

const splitEvent = async (env, request, id) => {
  const body = await readJson(request);
  const mediaIds = Array.isArray(body.mediaIds) ? body.mediaIds : [];
  if (!mediaIds.length) return error("NO_MEDIA", "请选择需要拆分的照片。", 400);
  const source = await env.DB.prepare("SELECT * FROM album_events WHERE id = ?").bind(id).first();
  if (!source) return notFound();
  const newEvent = await ensureEvent(env, body.eventDate || source.event_date, source.status || "draft");
  for (const mediaId of mediaIds) {
    await env.DB.prepare("UPDATE album_media SET event_id = ?, updated_at = ? WHERE id = ? AND event_id = ?").bind(newEvent.id, nowIso(), mediaId, id).run();
  }
  return ok({ eventId: newEvent.id, message: "照片已拆分到新相册。" });
};

const updateMedia = async (env, request, id) => {
  const body = await readJson(request);
  await env.DB.prepare(
    `UPDATE album_media
     SET is_favorite = COALESCE(?, is_favorite),
         is_hidden = COALESCE(?, is_hidden),
         allow_download = COALESCE(?, allow_download),
         sort_order = COALESCE(?, sort_order),
         updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      body.isFavorite === undefined ? null : body.isFavorite ? 1 : 0,
      body.isHidden === undefined ? null : body.isHidden ? 1 : 0,
      body.allowDownload === undefined ? null : body.allowDownload ? 1 : 0,
      body.sortOrder === undefined ? null : Number(body.sortOrder),
      nowIso(),
      id,
    )
    .run();
  return ok();
};

const softDelete = async (env, table, id) => {
  await env.DB.prepare(`UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ?`).bind(nowIso(), nowIso(), id).run();
  return ok();
};

const adminMedia = async (env, id, kind) => {
  const row = await env.DB.prepare("SELECT * FROM album_media WHERE id = ? AND deleted_at IS NULL").bind(id).first();
  if (!row) return notFound();
  const key = kind === "thumbnail" ? row.thumbnail_key : kind === "preview" ? row.preview_key || row.thumbnail_key : row.original_key;
  const object = await env.ALBUM_BUCKET.get(key);
  if (!object) return notFound();
  const headers = new Headers();
  headers.set("content-type", kind === "thumbnail" || kind === "preview" ? "image/webp" : row.mime_type);
  headers.set("cache-control", "private, max-age=300");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
};

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB || !env.ALBUM_BUCKET) {
    return error("ALBUM_NOT_CONFIGURED", "请先绑定 D1 数据库和私有 R2 Bucket。", 503);
  }
  const admin = requireAdmin(request, env);
  if (admin.response) return admin.response;
  const parts = partsOf(context);
  try {
    if (request.method === "GET" && parts[0] === "security") return security(env);
    if (request.method === "POST" && parts[0] === "security" && parts[1] === "password") return setPassword(env, request, admin.email);
    if (request.method === "PATCH" && parts[0] === "security") return patchSecurity(env, request);
    if (request.method === "POST" && parts[0] === "security" && parts[1] === "logout-all") return logoutAll(env);
    if (request.method === "POST" && parts[0] === "batches") return createBatch(env, request, admin.email);
    if (request.method === "GET" && parts[0] === "batches" && parts[1]) return batchDetail(env, parts[1]);
    if (request.method === "POST" && parts[0] === "batches" && parts[1] && parts[2] === "retry") return retryBatch(env, parts[1]);
    if (request.method === "POST" && parts[0] === "upload" && parts[1] === "prepare") return prepareUpload(env);
    if (request.method === "POST" && parts[0] === "upload" && parts[1] === "complete") return completeUpload(env, request);
    if (request.method === "GET" && parts[0] === "pending") return listPending(env);
    if (request.method === "GET" && parts[0] === "published") return listPublished(env);
    if (request.method === "POST" && parts[0] === "publish") return publish(env, request);
    if (request.method === "PATCH" && parts[0] === "events" && parts[1]) return updateEvent(env, request, parts[1]);
    if (request.method === "POST" && parts[0] === "events" && parts[1] && parts[2] === "merge") return mergeEvent(env, request, parts[1]);
    if (request.method === "POST" && parts[0] === "events" && parts[1] && parts[2] === "split") return splitEvent(env, request, parts[1]);
    if (request.method === "DELETE" && parts[0] === "events" && parts[1]) return softDelete(env, "album_events", parts[1]);
    if (request.method === "PATCH" && parts[0] === "media" && parts[1]) return updateMedia(env, request, parts[1]);
    if (request.method === "DELETE" && parts[0] === "media" && parts[1]) return softDelete(env, "album_media", parts[1]);
    if (request.method === "GET" && parts[0] === "media" && parts[1] && parts[2]) return adminMedia(env, parts[1], parts[2]);
    return request.method === "GET" ? notFound() : methodNotAllowed();
  } catch (err) {
    return error("ADMIN_ALBUM_ERROR", err.message || "管理员相册服务暂时不可用。", 500);
  }
}
