const $ = (selector) => document.querySelector(selector);

const state = {
  photos: [],
  active: "months",
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

const monthText = (item) => `${item.year} 年 ${Number(item.month)} 月`;

const monthKey = (item) => `${item.year}-${String(Number(item.month)).padStart(2, "0")}`;

const sizeText = (bytes = 0) => `${Math.max(1, Math.round(Number(bytes || 0) / 1024))} KB`;

const mediaPreview = (item) => {
  if (isVideo(item)) {
    return `
      <span class="video-preview">
        <video src="${item.url}" muted preload="metadata" playsinline></video>
        <span class="play-badge">播放</span>
      </span>`;
  }
  return `<img src="${item.thumbnail || item.url}" alt="${item.filename || ""}" loading="lazy" />`;
};

const monthGroups = () => {
  const groups = new Map();

  state.photos.forEach((item) => {
    const key = monthKey(item);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: monthText(item),
        items: [],
      });
    }
    groups.get(key).items.push(item);
  });

  return [...groups.values()]
    .map((group) => {
      group.items.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
      const seed = group.key.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
      group.cover = group.items[seed % group.items.length];
      group.photoCount = group.items.filter((item) => !isVideo(item)).length;
      group.videoCount = group.items.filter(isVideo).length;
      return group;
    })
    .sort((a, b) => b.key.localeCompare(a.key));
};

const renderFilters = () => {
  const groups = monthGroups();
  $("#filters").innerHTML = `
    <button class="chip ${state.active === "months" ? "active" : ""}" data-filter="months">全部月份</button>
    ${groups
      .map(
        (group) =>
          `<button class="chip ${state.active === group.label ? "active" : ""}" data-filter="${group.label}">${group.label}</button>`,
      )
      .join("")}
  `;
};

const renderMonthFolders = () => {
  const list = $("#photoWall");
  const groups = monthGroups();
  list.className = "month-wall";
  $("#photoCount").textContent = state.photos.length;

  if (!groups.length) {
    list.innerHTML = `<div class="empty glass"><h2>还没有成长素材</h2><p class="muted">在后台上传照片或视频后，这里会按月份自动整理。</p></div>`;
    return;
  }

  list.innerHTML = groups
    .map(
      (group) => `
        <button class="month-card" type="button" data-month="${group.label}" aria-label="打开${group.label}">
          <span class="month-cover">${mediaPreview(group.cover)}</span>
          <span class="month-info">
            <span class="month-tag">月份相册</span>
            <strong>${group.label}</strong>
            <span>${group.photoCount} 张照片${group.videoCount ? ` · ${group.videoCount} 个视频` : ""}</span>
          </span>
        </button>`,
    )
    .join("");
};

const renderPhotos = () => {
  if (state.active === "months") {
    renderMonthFolders();
    return;
  }

  const list = $("#photoWall");
  const photos = state.photos.filter((item) => monthText(item) === state.active);
  list.className = "masonry";
  $("#photoCount").textContent = photos.length;

  if (!photos.length) {
    list.innerHTML = `<div class="empty glass"><h2>这个月份还没有素材</h2><p class="muted">可以返回全部月份查看其它相册。</p></div>`;
    return;
  }

  list.innerHTML = photos
    .map(
      (item) => `
        <button class="photo-card" type="button" data-full="${item.url}" data-kind="${isVideo(item) ? "video" : "image"}" aria-label="查看${item.filename || "素材"}">
          ${mediaPreview(item)}
          <span class="photo-meta">
            <strong>${monthText(item)}</strong>
            <span>${isVideo(item) ? "视频" : "照片"} · ${item.date} · ${sizeText(item.size)}</span>
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
    renderFilters();
    renderPhotos();
    return;
  }

  const monthCard = event.target.closest("[data-month]");
  if (monthCard) {
    state.active = monthCard.dataset.month;
    renderFilters();
    renderPhotos();
    return;
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
