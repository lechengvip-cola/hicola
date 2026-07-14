export const META_KEY = "gallery/photos.json";
export const R2_LIMIT_BYTES = 10 * 1024 * 1024 * 1024;

export const nowInZone = (timeZone = "Asia/Shanghai") => {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value || "00";
  const date = `${value("year")}-${value("month")}-${value("day")}`;
  return {
    date,
    year: value("year"),
    month: value("month"),
    datetime: `${date} ${value("hour")}:${value("minute")}:${value("second")}`,
  };
};

export const safeName = (name = "photo") =>
  String(name)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "photo";

export const extensionOf = (name = "", type = "") => {
  const ext = String(name).split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext)) return ext;
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/heic") return "heic";
  if (type === "image/heif") return "heif";
  return "jpg";
};

export const photoUrl = (id) => `/api/gallery/photo/${encodeURIComponent(id)}`;

export const readPhotos = async (env) => {
  const object = await env.ALBUM_BUCKET.get(META_KEY);
  if (!object) return [];
  try {
    const data = JSON.parse(await object.text());
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

export const writePhotos = async (env, photos) => {
  const sorted = [...photos].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || "")));
  await env.ALBUM_BUCKET.put(META_KEY, JSON.stringify(sorted, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
  return sorted;
};

export const listStorage = async (env) => {
  let cursor;
  let totalBytes = 0;
  let objectCount = 0;
  do {
    const page = await env.ALBUM_BUCKET.list({ cursor, limit: 1000 });
    for (const object of page.objects || []) {
      totalBytes += Number(object.size || 0);
      objectCount += 1;
    }
    cursor = page.truncated ? page.cursor : null;
  } while (cursor);

  const gb = totalBytes / 1024 / 1024 / 1024;
  const status = gb >= 9 ? "danger" : gb >= 8 ? "warning" : "normal";
  const message = gb >= 9 ? "建议立即清理。" : gb >= 8 ? "请归档照片。" : "容量正常。";
  return {
    totalBytes,
    limitBytes: R2_LIMIT_BYTES,
    objectCount,
    usedGB: Number(gb.toFixed(3)),
    limitGB: 10,
    status,
    message,
  };
};
