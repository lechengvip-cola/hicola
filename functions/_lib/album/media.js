export const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "mp4", "mov", "webm"]);
export const allowedMimes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

export const extensionOf = (name = "") => name.split(".").pop()?.toLowerCase() || "";

export const mediaTypeOf = (mime = "") => (mime.startsWith("video/") ? "video" : "image");

export const assertAllowedFile = (file, maxSize) => {
  const ext = extensionOf(file.name);
  if (!allowedExtensions.has(ext) || !allowedMimes.has(file.type)) {
    throw new Error("不支持的文件类型");
  }
  if (file.size > maxSize) {
    throw new Error("文件过大");
  }
};

export const objectKeys = (year, id, ext, mediaType) => {
  const base = mediaType === "video" ? `album/videos/${year}/${id}.${ext}` : `album/originals/${year}/${id}.${ext}`;
  return {
    originalKey: base,
    previewKey: mediaType === "image" ? `album/previews/${year}/${id}.webp` : null,
    thumbnailKey: `album/thumbnails/${year}/${id}.webp`,
  };
};
