import { getAdminEmail } from "../../../_lib/album/auth.js";
import { error, methodNotAllowed, notFound, ok, readJson } from "../../../_lib/album/response.js";
import {
  changeGalleryPassword,
  clearGalleryAdminCookie,
  clearGalleryLoginFailures,
  createGalleryAdminCookie,
  isGalleryLoginLocked,
  publicGallerySecurity,
  readGallerySecurity,
  recordGalleryLoginFailure,
  verifyGalleryAdminCookie,
  verifyGalleryPassword,
} from "../../../_lib/gallery/security.js";
import { extensionOf, listStorage, nowInZone, photoUrl, readPhotos, safeName, writePhotos } from "../../../_lib/gallery/store.js";

const partsOf = (context) => context.params.path || [];

const requireAdmin = async (request, env) => {
  const email = getAdminEmail(request, env);
  if (email) return { email };
  if (await verifyGalleryAdminCookie(request, env)) return { email: "gallery-admin" };
  return { response: error("ADMIN_REQUIRED", "需要管理员权限。", 401) };
};

const authStatus = async (request, env) => ok({ authenticated: Boolean(getAdminEmail(request, env) || (await verifyGalleryAdminCookie(request, env))) });

const login = async (request, env) => {
  const body = await readJson(request);
  if (await isGalleryLoginLocked(env, request)) {
    return error("ADMIN_LOGIN_LOCKED", "密码错误次数过多，请 10 分钟后再试。", 429);
  }
  if (!(await verifyGalleryPassword(env, String(body.password || "").trim()))) {
    await recordGalleryLoginFailure(env, request);
    return error("ADMIN_PASSWORD_ERROR", "管理员密码错误。", 401);
  }
  await clearGalleryLoginFailures(env, request);
  return ok({ authenticated: true }, { headers: { "set-cookie": await createGalleryAdminCookie(env) } });
};

const logout = () => ok({}, { headers: { "set-cookie": clearGalleryAdminCookie() } });

const securityStatus = async (env) => ok({ security: publicGallerySecurity(await readGallerySecurity(env)) });

const updatePassword = async (request, env) => {
  const body = await readJson(request);
  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");
  const confirmPassword = String(body.confirmPassword || "");
  if (newPassword !== confirmPassword) return error("PASSWORD_CONFIRM_ERROR", "两次输入的新密码不一致。", 400);
  try {
    const security = await changeGalleryPassword(env, currentPassword, newPassword);
    return ok(
      { security: publicGallerySecurity(security) },
      { headers: { "set-cookie": await createGalleryAdminCookie(env) } },
    );
  } catch (err) {
    return error("PASSWORD_CHANGE_FAILED", err.message || "后台密码修改失败。", 400);
  }
};
const dashboard = async (env) => {
  const [photos, storage] = await Promise.all([readPhotos(env), listStorage(env)]);
  return ok({ photos, storage });
};

const importLegacy = async (env) => {
  if (!env.DB) return error("D1_NOT_ENABLED", "旧相册数据库不可用。", 503);
  const result = await env.DB.prepare(
    `SELECT m.id, m.original_filename, m.original_key, m.file_size, m.mime_type, m.captured_at, e.event_date, e.year, e.month
     FROM album_media m
     JOIN album_events e ON e.id = m.event_id
     WHERE m.deleted_at IS NULL
       AND m.is_hidden = 0
       AND e.deleted_at IS NULL
       AND e.status = 'published'
       AND m.media_type = 'image'
     ORDER BY COALESCE(m.captured_at, e.event_date) DESC, m.created_at DESC`,
  ).all();
  const legacy = (result.results || []).map((row) => {
    const date = row.captured_at || row.event_date;
    const [year, month] = String(date).split("-");
    return {
      id: row.id,
      filename: row.original_filename || `${row.id}.jpg`,
      url: `/api/gallery/photo/${row.id}`,
      thumbnail: `/api/gallery/photo/${row.id}`,
      key: row.original_key,
      size: Number(row.file_size || 0),
      type: row.mime_type || "image/jpeg",
      date,
      uploadedAt: `${date} 00:00:00`,
      year: year || String(row.year || ""),
      month: month || String(row.month || "").padStart(2, "0"),
    };
  });
  const current = await readPhotos(env);
  const seen = new Set(current.map((item) => item.id));
  const merged = [...current, ...legacy.filter((item) => !seen.has(item.id))];
  await writePhotos(env, merged);
  return ok({ imported: legacy.length, total: merged.length });
};

const upload = async (request, env) => {
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") return error("NO_FILE", "请选择照片。", 400);
  if (!String(file.type || "").startsWith("image/")) return error("BAD_FILE", "仅支持图片文件。", 400);

  const time = nowInZone(env.ALBUM_TIMEZONE || "Asia/Shanghai");
  const id = crypto.randomUUID();
  const filename = safeName(file.name || `${id}.jpg`);
  const ext = extensionOf(filename, file.type);
  const key = `gallery/photos/${time.year}/${time.month}/${id}.${ext}`;
  await env.ALBUM_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || "image/jpeg" },
    customMetadata: { filename },
  });

  const photos = await readPhotos(env);
  const item = {
    id,
    filename,
    url: photoUrl(id),
    thumbnail: photoUrl(id),
    key,
    size: file.size,
    type: file.type || "image/jpeg",
    date: time.date,
    uploadedAt: time.datetime,
    year: time.year,
    month: time.month,
  };
  const saved = await writePhotos(env, [item, ...photos]);
  return ok({ photo: item, count: saved.length });
};

const remove = async (request, env) => {
  const body = await readJson(request);
  const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
  if (!body.confirmBackup) return error("BACKUP_REQUIRED", "请确认照片已经备份到百度网盘。", 400);
  if (!ids.length) return error("NO_SELECTION", "请选择要删除的照片。", 400);

  const photos = await readPhotos(env);
  const selected = photos.filter((item) => ids.includes(item.id));
  for (const item of selected) {
    if (item.key) await env.ALBUM_BUCKET.delete(item.key);
  }
  await writePhotos(env, photos.filter((item) => !ids.includes(item.id)));
  return ok({ deleted: selected.length });
};

const crcTable = new Uint32Array(256).map((_, index) => {
  let c = index;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const crc32Update = (crc, bytes) => {
  let next = crc;
  for (const byte of bytes) next = crcTable[(next ^ byte) & 0xff] ^ (next >>> 8);
  return next;
};

const u16 = (value) => new Uint8Array([value & 255, (value >>> 8) & 255]);
const u32 = (value) => new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
const bytesOf = (text) => new TextEncoder().encode(text);
const concat = (chunks) => {
  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
};

const zipFiles = (files) => {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const name = bytesOf(file.name);
    const data = file.data;
    const crc = crc32(data);
    const local = concat([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data]);
    chunks.push(local);
    central.push(concat([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
    offset += local.length;
  }
  const centralOffset = offset;
  const centralData = concat(central);
  const end = concat([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(centralData.length), u32(centralOffset), u16(0)]);
  return concat([...chunks, centralData, end]);
};

const streamZip = (items, env) => {
  const central = [];
  let offset = 0;
  return new ReadableStream({
    async start(controller) {
      try {
        for (const item of items) {
          const object = await env.ALBUM_BUCKET.get(item.key);
          if (!object) continue;
          const name = bytesOf(`${item.year}/${item.month}/${safeName(item.filename)}`);
          const size = Number(item.size || object.size || 0);
          const local = concat([
            u32(0x04034b50),
            u16(20),
            u16(0x08),
            u16(0),
            u16(0),
            u16(0),
            u32(0),
            u32(0),
            u32(0),
            u16(name.length),
            u16(0),
            name,
          ]);
          controller.enqueue(local);
          const localOffset = offset;
          offset += local.length;

          let crc = 0xffffffff;
          let actualSize = 0;
          const reader = object.body.getReader();
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
            crc = crc32Update(crc, chunk);
            actualSize += chunk.length;
            offset += chunk.length;
            controller.enqueue(chunk);
          }
          crc = (crc ^ 0xffffffff) >>> 0;
          const finalSize = size || actualSize;
          const descriptor = concat([u32(0x08074b50), u32(crc), u32(finalSize), u32(finalSize)]);
          controller.enqueue(descriptor);
          offset += descriptor.length;
          central.push(
            concat([
              u32(0x02014b50),
              u16(20),
              u16(20),
              u16(0x08),
              u16(0),
              u16(0),
              u16(0),
              u32(crc),
              u32(finalSize),
              u32(finalSize),
              u16(name.length),
              u16(0),
              u16(0),
              u16(0),
              u16(0),
              u32(0),
              u32(localOffset),
              name,
            ]),
          );
        }
        const centralOffset = offset;
        const centralData = concat(central);
        controller.enqueue(centralData);
        const end = concat([u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length), u32(centralData.length), u32(centralOffset), u16(0)]);
        controller.enqueue(end);
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
};

const exportZip = async (request, env) => {
  const url = new URL(request.url);
  const year = url.searchParams.get("year");
  const month = url.searchParams.get("month");
  const photos = (await readPhotos(env)).filter((item) => (!year || item.year === year) && (!month || item.month === month));
  if (!photos.length) return error("NO_PHOTOS", "所选时间范围没有照片。", 404);

  const filename = `hicola-gallery-${year || "all"}${month ? `-${month}` : ""}.zip`;
  return new Response(streamZip(photos, env), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
};

export async function onRequest(context) {
  const { request, env } = context;
  const parts = partsOf(context);
  try {
    if (!env.ALBUM_BUCKET) return error("R2_NOT_ENABLED", "R2 未启用。", 503);
    if (request.method === "GET" && parts[0] === "auth" && parts[1] === "status") return authStatus(request, env);
    if (request.method === "POST" && parts[0] === "auth" && parts[1] === "login") return login(request, env);
    if (request.method === "POST" && parts[0] === "auth" && parts[1] === "logout") return logout();
    const guard = await requireAdmin(request, env);
    if (guard.response) return guard.response;
    if (request.method === "GET" && !parts[0]) return dashboard(env);
    if (request.method === "GET" && parts[0] === "security") return securityStatus(env);
    if (request.method === "POST" && parts[0] === "security" && parts[1] === "password") return updatePassword(request, env);
    if (request.method === "POST" && parts[0] === "import-legacy") return importLegacy(env);
    if (request.method === "POST" && parts[0] === "upload") return upload(request, env);
    if (request.method === "POST" && parts[0] === "delete") return remove(request, env);
    if (request.method === "GET" && parts[0] === "export") return exportZip(request, env);
    return request.method === "GET" ? notFound() : methodNotAllowed();
  } catch (err) {
    return error("GALLERY_ADMIN_ERROR", "成长照片库后台暂时不可用。", 500);
  }
}

