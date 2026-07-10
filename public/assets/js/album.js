const $ = (selector) => document.querySelector(selector);
const state = { events: [], favorites: [], detailMedia: [], lightboxIndex: 0 };

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
  el.hidden = hidden;
};

const formatDateCn = (value = "") => {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${year}年${Number(month)}月${Number(day)}日` : value;
};

const formatEventTitle = (event) => event.title || `${formatDateCn(event.eventDate)} · ${event.photoCount || 0}张照片`;

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
  $("#yearSelect").innerHTML = `<option value="">全部年份</option>${years.map((year) => `<option value="${year}">${year} 年</option>`).join("")}`;
  renderEvents(state.events);
};

const renderEvents = (events) => {
  const panel = $("#eventsPanel");
  if (!events.length) {
    panel.innerHTML = `<div class="empty glass">还没有发布的成长相册</div>`;
    return;
  }
  panel.innerHTML = events
    .map(
      (event) => `
      <a class="album-card glass" href="#" data-event-id="${event.id}">
        ${
          event.coverMediaId
            ? `<img class="cover" loading="lazy" src="/api/album/media/${event.coverMediaId}/thumbnail" alt="">`
            : `<div class="cover">暂无封面</div>`
        }
        <div class="body">
          <h3>${formatEventTitle(event)}</h3>
          <p class="muted">${event.eventDate} · ${event.photoCount || 0} 张照片 · ${event.videoCount || 0} 个视频</p>
        </div>
      </a>`,
    )
    .join("");
};

const showDetail = async (id) => {
  const data = await api(`/api/album/events/${id}`);
  state.detailMedia = data.media || [];
  setHidden($("#eventsPanel"), true);
  setHidden($("#favoritesPanel"), true);
  const panel = $("#detailPanel");
  setHidden(panel, false);
  panel.innerHTML = `
    <p><button class="btn" id="backToEvents">返回相册</button></p>
    <h1>${formatEventTitle(data.event)}</h1>
    <p class="muted">${data.event.eventDate} · ${data.event.photoCount || 0} 张照片 · ${data.event.videoCount || 0} 个视频</p>
    <div class="media-grid">
      ${state.detailMedia
        .map(
          (item, index) => `
          <button class="media-card glass" data-media-index="${index}" type="button">
            ${
              item.media_type === "video"
                ? `<div class="thumb">视频</div>`
                : `<img class="thumb" loading="lazy" src="/api/album/media/${item.id}/thumbnail" alt="">`
            }
            <div class="body"><span>${item.original_filename || "成长照片"}</span></div>
          </button>`,
        )
        .join("")}
    </div>`;
  $("#backToEvents").addEventListener("click", () => {
    setHidden(panel, true);
    setHidden($("#eventsPanel"), false);
  });
};

const renderFavorites = () => {
  setHidden($("#eventsPanel"), true);
  setHidden($("#detailPanel"), true);
  const panel = $("#favoritesPanel");
  setHidden(panel, false);
  state.detailMedia = state.favorites;
  panel.innerHTML = state.favorites.length
    ? state.favorites
        .map(
          (item, index) => `
          <button class="media-card glass" data-media-index="${index}" type="button">
            <img class="thumb" loading="lazy" src="/api/album/media/${item.id}/thumbnail" alt="">
            <div class="body"><h3>${item.title || item.event_date || "精选成长"}</h3></div>
          </button>`,
        )
        .join("")
    : `<div class="empty glass">还没有精选照片</div>`;
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

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    if (tab.dataset.view === "favorites") renderFavorites();
    else {
      setHidden($("#eventsPanel"), false);
      setHidden($("#detailPanel"), true);
      setHidden($("#favoritesPanel"), true);
    }
  });
});

$("#yearSelect").addEventListener("change", async (event) => {
  const year = event.target.value;
  const data = await api(`/api/album/events${year ? `?year=${year}` : ""}`);
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
