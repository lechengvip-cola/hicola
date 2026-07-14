import { clearSessionCookie, clearLoginFailures, createFamilySession, isLoginLocked, recordLoginFailure, verifyFamilySession, verifyPassword } from "../../_lib/album/auth.js";
import { eventSummarySql, getSettings, publicSettings } from "../../_lib/album/db.js";
import { error, json, methodNotAllowed, noStoreHeaders, notFound, ok, readJson } from "../../_lib/album/response.js";

const routeParts = (context) => context.params.path || [];

const normalizePassword = (value = "") => String(value).replace(/[\u200B-\u200D\uFEFF]/g, "").trim();

const authStatus = async (env, request) => {
  if (!env.DB) {
    return ok({
      authenticated: false,
      reason: "missing_bindings",
      settings: { passwordSet: false, accessEnabled: false, sessionDays: 30, passwordUpdatedAt: null },
    });
  }
  const auth = await verifyFamilySession(env, request);
  return ok({
    authenticated: auth.authenticated,
    reason: auth.reason,
    settings: auth.settings,
  });
};

const login = async (env, request) => {
  if (await isLoginLocked(env, request)) {
    return error("PASSWORD_ERROR", "密码错误，请重新输入。", 429);
  }
  const settings = await getSettings(env);
  if (!settings.family_password_hash) return error("ALBUM_NOT_OPEN", "成长相册暂未开放。", 403);
  if (!settings.family_access_enabled) return error("ALBUM_DISABLED", "成长相册暂时关闭。", 403);
  const body = await readJson(request);
  const password = normalizePassword(body.password || "");
  const remember = Boolean(body.remember);
  const passwordSettings = {
    ...settings,
    family_plain_password: env.ALBUM_FAMILY_PASSWORD || env.ADMIN_ALBUM_PASSWORD || "",
  };
  if (!(await verifyPassword(passwordSettings, password))) {
    await recordLoginFailure(env, request);
    return error("PASSWORD_ERROR", "密码错误，请重新输入。", 401);
  }
  await clearLoginFailures(env, request);
  const session = await createFamilySession(env, request, remember);
  return ok({ authenticated: true, settings: publicSettings(settings) }, { headers: { "set-cookie": session.cookie } });
};

const logout = async () => {
  return ok({}, { headers: { "set-cookie": clearSessionCookie() } });
};

const requireFamily = async (env, request) => {
  const auth = await verifyFamilySession(env, request);
  if (!auth.authenticated) return { response: error("UNAUTHORIZED", "请先输入家庭密码。", 401) };
  return { auth };
};

const mapEvent = (event) => ({
  id: event.id,
  title: event.title || "",
  eventDate: event.event_date,
  year: event.year,
  month: event.month,
  coverMediaId: event.cover_media_id,
  photoCount: Number(event.photo_count || 0),
  videoCount: Number(event.video_count || 0),
  publishedAt: event.published_at,
});

const listEvents = async (env, request) => {
  const guard = await requireFamily(env, request);
  if (guard.response) return guard.response;
  const url = new URL(request.url);
  const year = url.searchParams.get("year");
  const where = year ? "WHERE e.status = 'published' AND e.deleted_at IS NULL AND e.year = ?" : "WHERE e.status = 'published' AND e.deleted_at IS NULL";
  const stmt = env.DB.prepare(`${eventSummarySql(where)} ORDER BY e.event_date DESC, e.created_at DESC LIMIT 120`);
  const result = year ? await stmt.bind(Number(year)).all() : await stmt.all();
  return ok({ events: (result.results || []).map(mapEvent) });
};

const years = async (env, request) => {
  const guard = await requireFamily(env, request);
  if (guard.response) return guard.response;
  const result = await env.DB.prepare("SELECT DISTINCT year FROM album_events WHERE status = 'published' AND deleted_at IS NULL ORDER BY year DESC").all();
  return ok({ years: (result.results || []).map((row) => row.year) });
};

const eventDetail = async (env, request, id) => {
  const guard = await requireFamily(env, request);
  if (guard.response) return guard.response;
  const event = await env.DB.prepare(`${eventSummarySql("WHERE e.id = ? AND e.status = 'published' AND e.deleted_at IS NULL")}`).bind(id).first();
  if (!event) return notFound();
  const media = await env.DB.prepare(
    `SELECT id, media_type, mime_type, original_filename, captured_at, is_favorite, allow_download
     FROM album_media
     WHERE event_id = ? AND is_hidden = 0 AND deleted_at IS NULL
     ORDER BY sort_order ASC, captured_at ASC, created_at ASC`,
  )
    .bind(id)
    .all();
  return ok({ event: mapEvent(event), media: media.results || [] });
};

const favorites = async (env, request) => {
  const guard = await requireFamily(env, request);
  if (guard.response) return guard.response;
  const result = await env.DB.prepare(
    `SELECT m.id, m.media_type, m.mime_type, m.original_filename, m.captured_at, e.id AS event_id, e.title, e.event_date
     FROM album_media m
     JOIN album_events e ON e.id = m.event_id
     WHERE m.is_favorite = 1 AND m.is_hidden = 0 AND m.deleted_at IS NULL AND e.status = 'published' AND e.deleted_at IS NULL
     ORDER BY COALESCE(m.captured_at, e.event_date) DESC`,
  ).all();
  return ok({ media: result.results || [] });
};

const media = async (env, request, id, kind) => {
  if (!env.ALBUM_BUCKET) return error("R2_NOT_ENABLED", "成长相册媒体存储暂未启用。", 503);
  const guard = await requireFamily(env, request);
  if (guard.response) return guard.response;
  const row = await env.DB.prepare(
    `SELECT m.*, e.status AS event_status
     FROM album_media m
     JOIN album_events e ON e.id = m.event_id
     WHERE m.id = ? AND m.deleted_at IS NULL AND m.is_hidden = 0 AND e.status = 'published' AND e.deleted_at IS NULL`,
  )
    .bind(id)
    .first();
  if (!row) return notFound();
  if (kind === "original" && !row.allow_download) return error("DOWNLOAD_DISABLED", "未开放原图下载。", 403);
  const key = kind === "thumbnail" ? row.thumbnail_key : kind === "preview" ? row.preview_key || row.thumbnail_key : row.original_key;
  const object = await env.ALBUM_BUCKET.get(key);
  if (!object) return notFound();
  const headers = new Headers(noStoreHeaders);
  headers.set("content-type", kind === "thumbnail" || kind === "preview" ? "image/webp" : row.mime_type);
  headers.set("cache-control", "private, max-age=300");
  return new Response(object.body, { headers });
};

export async function onRequest(context) {
  const { request, env } = context;
  const parts = routeParts(context);
  try {
    if (!env.DB && !(request.method === "GET" && parts[0] === "auth" && parts[1] === "status")) {
      return error("ALBUM_NOT_CONFIGURED", "成长相册暂未开放。", 503);
    }
    if (request.method === "GET" && parts[0] === "auth" && parts[1] === "status") return authStatus(env, request);
    if (request.method === "POST" && parts[0] === "auth" && parts[1] === "login") return login(env, request);
    if (request.method === "POST" && parts[0] === "auth" && parts[1] === "logout") return logout();
    if (request.method === "GET" && parts[0] === "events" && !parts[1]) return listEvents(env, request);
    if (request.method === "GET" && parts[0] === "events" && parts[1]) return eventDetail(env, request, parts[1]);
    if (request.method === "GET" && parts[0] === "years") return years(env, request);
    if (request.method === "GET" && parts[0] === "favorites") return favorites(env, request);
    if (request.method === "GET" && parts[0] === "media" && parts[1] && parts[2]) return media(env, request, parts[1], parts[2]);
    return request.method === "GET" ? notFound() : methodNotAllowed();
  } catch (err) {
    return json({ ok: false, code: "SERVER_ERROR", message: "相册服务暂时不可用。" }, { status: 500 });
  }
}
