const $ = (selector) => document.querySelector(selector);
const state = { photos: [], active: "all" };

const api = async (url, options = {}) => {
  const response = await fetch(url, { credentials: "include", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.message || "请求失败");
  return data;
};

const monthText = (photo) => `${photo.year} 年 ${Number(photo.month)} 月`;

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
  toolbar.innerHTML = `<button class="chip active" data-filter="all">全部照片</button>${filters()
    .map((item) => `<button class="chip" data-filter="${item}">${item}</button>`)
    .join("")}`;
};

const renderPhotos = () => {
  const list = $("#photoWall");
  const photos = state.active === "all" ? state.photos : state.photos.filter((item) => monthText(item) === state.active);
  $("#photoCount").textContent = photos.length;
  if (!photos.length) {
    list.innerHTML = `<div class="empty glass"><h2>还没有照片</h2><p class="muted">在后台上传照片后，这里会自动生成成长照片墙。</p></div>`;
    return;
  }
  list.innerHTML = photos
    .map(
      (photo) => `
        <button class="photo-card" type="button" data-full="${photo.url}" aria-label="查看${photo.filename}">
          <img src="${photo.thumbnail || photo.url}" alt="${photo.filename}" loading="lazy" />
          <span class="photo-meta">
            <strong>${monthText(photo)}</strong>
            <span>${photo.date} · ${Math.max(1, Math.round(Number(photo.size || 0) / 1024))} KB</span>
          </span>
        </button>`,
    )
    .join("");
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
  if (card) {
    $("#lightboxImage").src = card.dataset.full;
    $("#lightbox").classList.add("open");
  }
});

$("#closeLightbox").addEventListener("click", () => $("#lightbox").classList.remove("open"));
$("#lightbox").addEventListener("click", (event) => {
  if (event.target.id === "lightbox") $("#lightbox").classList.remove("open");
});

load().catch(() => {
  $("#photoWall").innerHTML = `<div class="empty glass"><h2>照片墙暂时不可用</h2><p class="muted">请稍后刷新重试。</p></div>`;
});

