const $ = (selector) => document.querySelector(selector);

const state = {
  events: [],
  favorites: [],
  detailMedia: [],
  lightboxIndex: 0,
};

const api = async (url, options = {}) => {
  const response = await fetch(url, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.message || "请求失败");
  return data;
};

const setHidden = (el, hidden) => {
  if (el) el.hidden = hidden;
};

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatDateCn = (value = "") => {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${year} 年 ${Number(month)} 月 ${Number(day)} 日` : value;
};

const formatEventTitle = (event) => event.title || formatDateCn(event.eventDate);

const updateViewTitle = (title) => {
  const el = $("#viewTitle");
  if (el) el.textContent = title;
};

const updateTabs = (view) => {
  document.querySelectorAll(".tab[data-view]").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === view);
  });
};

const checkStatus = async () => {
  const data = await api("/api/album/auth/status");
  if (data.authenticated) {
    setHidden($("#loginView"), true);
    setHidden($("#albumView"), false);
    await loadAlbum();
    return;
  }

  setHidden($("#loginView"), false);
  setHidden($("#albumView"), true);
  const msg = $("#closedMessage");
  if (!msg) return;
  if (data.reason === "not_configured") msg.textContent = "成长相册暂未开放。";
  else if (data.reason === "disabled") msg.textContent = "成长相册暂时关闭。";
  else msg.textContent = "";
};

const loadAlbum = async () => {
  const [eventsData, yearsData, favoritesData] = await Promise.all([
    api("/api/album/events"),
    api("/api/album/years"),
    api("/api/album/favorites"),
  ]);
  state.events = eventsData.events || [];
  state.favorites = favoritesData.media || [];

  $("#eventCount").textContent = state.events.length;
  $("#favoriteCount").textContent = state.favorites.length;

  const years = yearsData.years || [];
  $("#yearSelect").innerHTML = `<option value="">全部年份</option>${years
    .map((year) => `<option value="${year}">${year} 年</option>`)
    .join("")}`;

  updateTabs("all");
  updateViewTitle("全部相册");
  renderEvents(state.events);
};

const renderEvents = (events) => {
  const panel = $("#eventsPanel");
  if (!events.length) {
    panel.innerHTML = `
      <div class="empty glass">
        <h3>还没有发布的成长相册</h3>
        <p>上传并发布照片后，这里会按日期生成一本本小相册。</p>
      </div>`;
    return;
  }

  panel.innerHTML = events
    .map((event) => {
      const title = escapeHtml(formatEventTitle(event));
      const date = escapeHtml(event.eventDate || "");
      const photoCount = Number(event.photoCount || 0);
      const videoCount = Number(event.videoCount || 0);
      const countText = `${photoCount} 张照片${videoCount ? ` · ${videoCount} 个视频` : ""}`;
      const cover = event.coverMediaId
        ? `<img class="cover" loading="lazy" src="/api/album/media/${event.coverMediaId}/thumbnail" alt="${title}">`
        : `<div class="cover">暂无封面</div>`;

      return `
        <a class="album-card glass" href="#" data-event-id="${event.id}">
          <div class="album-cover-wrap">
            ${cover}
            <span class="photo-pill">${countText}</span>
          </div>
          <div class="body">
            <h3>${title}</h3>
            <p class="muted">${date} · ${countText}</p>
          </div>
        </a>`;
    })
    .join("");
};

const showDetail = async (id) => {
  const data = await api(`/api/album/events/${id}`);
  state.detailMedia = data.media || [];
  setHidden($("#eventsPanel"), true);
  setHidden($("#favoritesPanel"), true);
  updateViewTitle(formatEventTitle(data.event));

  const panel = $("#detailPanel");
  setHidden(panel, false);
  panel.innerHTML = `
    <div class="detail-head">
      <button class="btn" id="backToEvents" type="button">返回相册</button>
      <p class="muted">${escapeHtml(data.event.eventDate || "")} · ${Number(data.event.photoCount || 0)} 张照片 · ${Number(
        data.event.videoCount || 0,
      )} 个视频</p>
    </div>
    <div class="media-grid">
      ${state.detailMedia
        .map(
          (item, index) => `
            <button class="media-card glass" data-media-index="${index}" type="button">
              ${
                item.media_type === "video"
                  ? `<div class="thumb video-thumb">视频</div>`
                  : `<img class="thumb" loading="lazy" src="/api/album/media/${item.id}/thumbnail" alt="">`
              }
            </button>`,
        )
        .join("")}
    </div>`;

  $("#backToEvents").addEventListener("click", () => {
    setHidden(panel, true);
    setHidden($("#eventsPanel"), false);
    updateViewTitle("全部相册");
  });
};

const renderFavorites = () => {
  setHidden($("#eventsPanel"), true);
  setHidden($("#detailPanel"), true);
  updateViewTitle("精选照片");

  const panel = $("#favoritesPanel");
  setHidden(panel, false);
  state.detailMedia = state.favorites;
  panel.innerHTML = state.favorites.length
    ? state.favorites
        .map(
          (item, index) => `
            <button class="media-card glass" data-media-index="${index}" type="button">
              <img class="thumb" loading="lazy" src="/api/album/media/${item.id}/thumbnail" alt="">
            </button>`,
        )
        .join("")
    : `<div class="empty glass"><h3>还没有精选照片</h3><p>在后台标记精选后，这里会出现漂亮的照片墙。</p></div>`;
};

const openLightbox = (index) => {
  state.lightboxIndex = index;
  const item = state.detailMedia[index];
  if (!item) return;

  const content = $("#lightboxContent");
  content.innerHTML =
    item.media_type === "video"
      ? `<video src="/api/album/media/${item.id}/video" controls autoplay></video>`
      : `<img src="/api/album/media/${item.id}/preview" alt="">`;
  $("#lightbox").classList.add("open");
};

const moveLightbox = (step) => {
  if (!state.detailMedia.length) return;
  openLightbox((state.lightboxIndex + step + state.detailMedia.length) % state.detailMedia.length);
};

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#loginToast").textContent = "";
  try {
    await api("/api/album/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: $("#passwordInput").value, remember: $("#rememberDevice").checked }),
    });
    await checkStatus();
  } catch (err) {
    $("#loginToast").textContent = err.message || "密码错误，请重新输入。";
  }
});

$("#showPassword").addEventListener("change", (event) => {
  $("#passwordInput").type = event.target.checked ? "text" : "password";
});

document.addEventListener("click", async (event) => {
  const card = event.target.closest("[data-event-id]");
  if (card) {
    event.preventDefault();
    await showDetail(card.dataset.eventId);
  }

  const media = event.target.closest("[data-media-index]");
  if (media) openLightbox(Number(media.dataset.mediaIndex));
});

document.querySelectorAll(".tab[data-view]").forEach((tab) => {
  tab.addEventListener("click", () => {
    updateTabs(tab.dataset.view);
    if (tab.dataset.view === "favorites") {
      renderFavorites();
      return;
    }
    updateViewTitle("全部相册");
    setHidden($("#eventsPanel"), false);
    setHidden($("#detailPanel"), true);
    setHidden($("#favoritesPanel"), true);
    renderEvents(state.events);
  });
});

$("#yearSelect").addEventListener("change", async (event) => {
  const year = event.target.value;
  const data = await api(`/api/album/events${year ? `?year=${year}` : ""}`);
  updateTabs("all");
  updateViewTitle(year ? `${year} 年相册` : "全部相册");
  setHidden($("#eventsPanel"), false);
  setHidden($("#detailPanel"), true);
  setHidden($("#favoritesPanel"), true);
  renderEvents(data.events || []);
});

$(".lightbox .close").addEventListener("click", () => $("#lightbox").classList.remove("open"));
$(".lightbox .prev").addEventListener("click", () => moveLightbox(-1));
$(".lightbox .next").addEventListener("click", () => moveLightbox(1));
document.addEventListener("keydown", (event) => {
  if (!$("#lightbox").classList.contains("open")) return;
  if (event.key === "Escape") $("#lightbox").classList.remove("open");
  if (event.key === "ArrowLeft") moveLightbox(-1);
  if (event.key === "ArrowRight") moveLightbox(1);
});

checkStatus();
