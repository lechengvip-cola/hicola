import { readPhotos } from "../../_lib/gallery/store.js";
import { error, methodNotAllowed, notFound, ok } from "../../_lib/album/response.js";

const partsOf = (context) => context.params.path || [];

const list = async (env) => {
  if (!env.ALBUM_BUCKET) return error("R2_NOT_ENABLED", "照片存储暂未启用。", 503);
  const photos = await readPhotos(env);
  return ok(
    { photos, count: photos.length },
    {
      headers: {
        "cache-control": "public, max-age=60, s-maxage=120",
        "x-content-type-options": "nosniff",
      },
    },
  );
};

const photo = async (env, id) => {
  if (!env.ALBUM_BUCKET) return error("R2_NOT_ENABLED", "照片存储暂未启用。", 503);
  const photos = await readPhotos(env);
  const item = photos.find((entry) => entry.id === id);
  if (!item) return notFound();
  const object = await env.ALBUM_BUCKET.get(item.key);
  if (!object) return notFound();
  const headers = new Headers();
  headers.set("content-type", item.type || "image/jpeg");
  headers.set("cache-control", "public, max-age=86400, s-maxage=604800");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
};

export async function onRequest(context) {
  const { request, env } = context;
  const parts = partsOf(context);
  try {
    if (request.method === "GET" && !parts[0]) return list(env);
    if (request.method === "GET" && parts[0] === "photo" && parts[1]) return photo(env, parts[1]);
    return request.method === "GET" ? notFound() : methodNotAllowed();
  } catch (err) {
    return error("GALLERY_ERROR", "成长照片库暂时不可用。", 500);
  }
}
