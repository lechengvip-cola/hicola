const $ = (selector) => document.querySelector(selector);

const state = {
  photos: [],
  active: "all",
};

const videoExtensions = new Set(["mp4", "mov", "webm", "m4v"]);

const api = async (url, options = {}) => {
  const response = await fetch(url, { credentials: "include", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.message || "请求失败");
  return data;
};

const extensionOf = (name = "") => String(name).split(".").pop()?.toLowerCase() || "";

const isVideo = (item) =>
  item?.mediaType === "video" ||
  String(item?.type || "").startsWith("video/") ||
  videoExtensions.has(extensionOf(item?.filename || ""));

const monthText = (photo) => `${photo.year} 年 ${Number(photo.month)} 月`;

const sizeText = (bytes = 0) => `${Math.max(1, Math.round(Number(bytes || 0) / 1024))} KB`;

const filters = () => {
  const seen = new Set();
  return state.photos
    .map(monthText)
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
};

const renderFilters = () => {
  const toolbar = $("#filters");
  toolbar.innerHTML = `<button class="chip active" data-filter="all">全部素材</button>${filters()
    .map((item) => `<button class="chip" data-filter="${item}">${item}</button>`)
    .join("")}`;
};

const mediaPreview = (item) => {
  if (isVideo(item)) {
    return `
      <span class="video-preview">
        <video src="${item.url}" muted preload="metadata" playsinline></video>
        <span class="play-badge">播放</span>
      </span>`;
  }
  return `<img src="${item.thumbnail || item.url}" alt="${item.filename}" loading="lazy" />`;
};

const renderPhotos = () => {
  const list = $("#photoWall");
  const photos = state.active === "all" ? state.photos : state.photos.filter((item) => monthText(item) === state.active);
  $("#photoCount").textContent = photos.length;
  if (!photos.length) {
    list.innerHTML = `<div class="empty glass"><h2>还没有素材</h2><p class="muted">在后台上传照片或视频后，这里会自动生成成长相册。</p></div>`;
    return;
  }
  list.innerHTML = photos
    .map(
      (photo) => `
        <button class="photo-card" type="button" data-full="${photo.url}" data-kind="${isVideo(photo) ? "video" : "image"}" aria-label="查看${photo.filename}">
          ${mediaPreview(photo)}
          <span class="photo-meta">
            <strong>${monthText(photo)}</strong>
            <span>${isVideo(photo) ? "视频" : "照片"} · ${photo.date} · ${sizeText(photo.size)}</span>
          </span>
        </button>`,
    )
    .join("");
};

const closeLightbox = () => {
  $("#lightbox").classList.remove("open");
  $("#lightboxImage").hidden = true;
  $("#lightboxImage").removeAttribute("src");
  $("#lightboxVideo").pause();
  $("#lightboxVideo").hidden = true;
  $("#lightboxVideo").removeAttribute("src");
};

const openLightbox = (card) => {
  if (card.dataset.kind === "video") {
    $("#lightboxImage").hidden = true;
    $("#lightboxVideo").src = card.dataset.full;
    $("#lightboxVideo").hidden = false;
    $("#lightboxVideo").play().catch(() => {});
  } else {
    $("#lightboxVideo").pause();
    $("#lightboxVideo").hidden = true;
    $("#lightboxImage").src = card.dataset.full;
    $("#lightboxImage").hidden = false;
  }
  $("#lightbox").classList.add("open");
};

const load = async () => {
  const data = await api("/api/gallery");
  state.photos = data.photos || [];
  renderFilters();
  renderPhotos();
};

document.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-filter]");
  if (chip) {
    state.active = chip.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === chip));
    renderPhotos();
  }

  const card = event.target.closest("[data-full]");
  if (card) openLightbox(card);
});

$("#closeLightbox").addEventListener("click", closeLightbox);
$("#lightbox").addEventListener("click", (event) => {
  if (event.target.id === "lightbox") closeLightbox();
});

load().catch(() => {
  $("#photoWall").innerHTML = `<div class="empty glass"><h2>成长相册暂时不可用</h2><p class="muted">请稍后刷新重试。</p></div>`;
});
