const $ = (selector) => document.querySelector(selector);

const state = {
  photos: [],
  storage: null,
  selected: new Set(),
  month: "all",
};

const mediaExtensions = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "mp4", "mov", "webm", "m4v"]);
const videoExtensions = new Set(["mp4", "mov", "webm", "m4v"]);

const api = async (url, options = {}) => {
  const response = await fetch(url, { credentials: "include", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.message || "请求失败");
  return data;
};

const toast = (text) => {
  $("#toast").textContent = text || "";
};

const sizeText = (bytes = 0) => {
  const value = Number(bytes || 0);
  if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
};

const extensionOf = (name = "") => String(name).split(".").pop()?.toLowerCase() || "";

const isVideo = (item) =>
  item?.mediaType === "video" ||
  String(item?.type || "").startsWith("video/") ||
  videoExtensions.has(extensionOf(item?.filename || ""));

const isAllowedMedia = (file) => {
  const type = String(file.type || "");
  return type.startsWith("image/") || type.startsWith("video/") || mediaExtensions.has(extensionOf(file.name || ""));
};

const monthKey = (photo) => `${photo.year}-${String(photo.month).padStart(2, "0")}`;

const monthName = (key) => {
  const [year, month] = key.split("-");
  return `${year} 年 ${Number(month)} 月`;
};

const photosInMonth = (key) => state.photos.filter((photo) => monthKey(photo) === key);

const visiblePhotos = () => (state.month === "all" ? [] : photosInMonth(state.month));

const selectedPhotos = () => state.photos.filter((photo) => state.selected.has(photo.id));

const monthFolders = () => {
  const groups = new Map();
  for (const photo of state.photos) {
    const key = monthKey(photo);
    const folder = groups.get(key) || {
      key,
      title: monthName(key),
      photos: [],
      videos: 0,
      images: 0,
      size: 0,
      cover: null,
    };
    folder.photos.push(photo);
    folder.size += Number(photo.size || 0);
    if (isVideo(photo)) folder.videos += 1;
    else folder.images += 1;
    if (!folder.cover || (!isVideo(photo) && isVideo(folder.cover))) folder.cover = photo;
    groups.set(key, folder);
  }
  return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));
};

const renderMonthFilter = () => {
  const folders = monthFolders();
  const select = $("#monthFilter");
  const current = state.month;
  select.innerHTML = `<option value="all">月份文件夹</option>${folders.map((folder) => `<option value="${folder.key}">${folder.title}</option>`).join("")}`;
  select.value = folders.some((folder) => folder.key === current) ? current : "all";
  state.month = select.value;

  const years = [...new Set(state.photos.map((photo) => photo.year).filter(Boolean))].sort().reverse();
  $("#exportYear").innerHTML = `<option value="">导出全部</option>${years.map((year) => `<option value="${year}">导出 ${year} 年</option>`).join("")}`;
};

const renderSummary = () => {
  const selected = selectedPhotos();
  const selectedSize = selected.reduce((sum, photo) => sum + Number(photo.size || 0), 0);
  if (state.month === "all") {
    $("#selectionSummary").textContent = `共 ${monthFolders().length} 个月份文件夹。`;
    $("#selectedSize").textContent = `${state.photos.length} 个素材`;
    return;
  }
  $("#selectionSummary").textContent = `当前月 ${visiblePhotos().length} 个素材，已选择 ${selected.length} 个。`;
  $("#selectedSize").textContent = sizeText(selectedSize);
};

const renderCapacity = () => {
  const storage = state.storage || { totalBytes: 0, limitBytes: 10 * 1024 ** 3, status: "normal", message: "容量正常。" };
  const percent = Math.min(100, Math.round((Number(storage.totalBytes || 0) / Number(storage.limitBytes || 1)) * 1000) / 10);
  $("#capacity").className = `panel glass capacity status-${storage.status || "normal"}`;
  $("#capacityText").textContent = `${storage.usedGB || 0} GB / 10 GB`;
  $("#capacityBar").style.width = `${percent}%`;
  const statusText = storage.status === "danger" ? "危险" : storage.status === "warning" ? "提醒" : "正常";
  $("#capacityMessage").textContent = `状态：${statusText}。${storage.message || ""}`;
};

const mediaPreview = (photo) => {
  if (isVideo(photo)) {
    return `
      <span class="admin-video-preview">
        <video src="${photo.url}" muted preload="metadata" playsinline></video>
        <span class="media-chip">视频</span>
      </span>`;
  }
  return `
    <span class="admin-video-preview">
      <img src="${photo.thumbnail || photo.url}" alt="${photo.filename}" loading="lazy" />
      <span class="media-chip">照片</span>
    </span>`;
};

const folderCover = (folder) => {
  if (!folder.cover) {
    return `<span class="folder-empty-cover"><span>暂无封面</span></span>`;
  }
  return mediaPreview(folder.cover);
};

const renderFolders = () => {
  const folders = monthFolders();
  $("#adminPhotos").className = "admin-list folder-list";
  $("#adminPhotos").innerHTML = folders.length
    ? folders
        .map(
          (folder) => `
            <article class="month-folder" data-month="${folder.key}" tabindex="0" aria-label="进入 ${folder.title}">
              ${folderCover(folder)}
              <div class="folder-info">
                <strong>${folder.title}</strong>
                <span>${folder.images} 张照片 · ${folder.videos} 个视频</span>
                <em>${sizeText(folder.size)}</em>
              </div>
            </article>`,
        )
        .join("")
    : `<div class="empty glass"><h2>还没有素材</h2><p class="muted">上传照片或视频后，这里会自动按月份生成文件夹。</p></div>`;
};

const renderPhotos = () => {
  if (state.month === "all") {
    renderFolders();
    return;
  }

  const photos = visiblePhotos();
  $("#adminPhotos").className = "admin-list";
  $("#adminPhotos").innerHTML = photos.length
    ? photos
        .map((photo) => {
          const checked = state.selected.has(photo.id);
          return `
            <article class="admin-photo ${checked ? "selected" : ""}" data-photo-id="${photo.id}" tabindex="0" aria-label="选择 ${photo.filename}">
              <span class="select-chip">${checked ? "已选择" : "点击选择"}</span>
              ${mediaPreview(photo)}
              <p>${photo.date} · ${sizeText(photo.size)}<br />${photo.filename}</p>
            </article>`;
        })
        .join("")
    : `<div class="empty glass"><h2>当前月份没有素材</h2><p class="muted">可以返回月份文件夹，或上传新的照片和视频。</p></div>`;
};

const render = () => {
  $("#totalPhotos").textContent = state.photos.length;
  renderCapacity();
  renderMonthFilter();
  renderSummary();
  renderPhotos();
};

const loadSecurity = async () => {
  const data = await api("/api/admin/gallery/security");
  const security = data.security || {};
  $("#securityStatus").textContent = security.passwordCustomized
    ? `已启用自定义后台密码。上次修改：${security.passwordUpdatedAt || "未知"}。${security.lockPolicy || ""}`
    : `当前使用初始环境密码。建议在这里设置新的后台密码。${security.lockPolicy || ""}`;
};

const load = async () => {
  const data = await api("/api/admin/gallery");
  state.photos = data.photos || [];
  state.storage = data.storage;
  state.selected = new Set([...state.selected].filter((id) => state.photos.some((photo) => photo.id === id)));
  render();
};

const showApp = async () => {
  $("#loginPanel").hidden = true;
  $("#workPanel").hidden = false;
  await Promise.all([load(), loadSecurity()]);
};

const checkAuth = async () => {
  const data = await api("/api/admin/gallery/auth/status");
  if (data.authenticated) await showApp();
};

const login = async () => {
  try {
    $("#loginError").textContent = "";
    await api("/api/admin/gallery/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: $("#adminPassword").value.trim() }),
    });
    $("#adminPassword").value = "";
    await showApp();
  } catch (err) {
    $("#loginError").textContent = err.message || "登录失败";
  }
};

const uploadFiles = async (files) => {
  const media = [...files].filter(isAllowedMedia);
  const skipped = files.length - media.length;
  if (!media.length) {
    toast("请选择照片或视频文件。");
    return;
  }

  toast(`准备上传 ${media.length} 个素材${skipped ? `，已忽略 ${skipped} 个不支持文件` : ""}。`);
  let done = 0;
  for (const file of media) {
    const form = new FormData();
    form.append("file", file);
    await fetch("/api/admin/gallery/upload", { method: "POST", credentials: "include", body: form }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.message || `${file.name} 上传失败`);
    });
    done += 1;
    toast(`已上传 ${done} / ${media.length}`);
  }
  toast("上传完成。");
  $("#fileInput").value = "";
  state.month = "all";
  await load();
};

$("#loginBtn").addEventListener("click", login);
$("#adminPassword").addEventListener("keydown", (event) => {
  if (event.key === "Enter") login();
});

$("#changePasswordBtn").addEventListener("click", async () => {
  try {
    await api("/api/admin/gallery/security/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: $("#currentPassword").value,
        newPassword: $("#newAdminPassword").value,
        confirmPassword: $("#confirmAdminPassword").value,
      }),
    });
    $("#currentPassword").value = "";
    $("#newAdminPassword").value = "";
    $("#confirmAdminPassword").value = "";
    toast("后台密码已修改。");
    await loadSecurity();
  } catch (err) {
    toast(err.message || "修改密码失败");
  }
});

$("#adminLogoutBtn").addEventListener("click", async () => {
  await api("/api/admin/gallery/auth/logout", { method: "POST" }).catch(() => {});
  location.reload();
});

$("#fileInput").addEventListener("change", (event) => uploadFiles(event.target.files).catch((err) => toast(err.message)));
$("#pickFiles").addEventListener("click", () => $("#fileInput").click());
$("#dropZone").addEventListener("dragover", (event) => {
  event.preventDefault();
  $("#dropZone").classList.add("dragover");
});
$("#dropZone").addEventListener("dragleave", () => $("#dropZone").classList.remove("dragover"));
$("#dropZone").addEventListener("drop", (event) => {
  event.preventDefault();
  $("#dropZone").classList.remove("dragover");
  uploadFiles(event.dataTransfer.files).catch((err) => toast(err.message));
});

$("#monthFilter").addEventListener("change", (event) => {
  state.month = event.target.value;
  state.selected.clear();
  render();
});

$("#selectVisible").addEventListener("click", () => {
  if (state.month === "all") {
    toast("请先进入一个月份文件夹。");
    return;
  }
  visiblePhotos().forEach((photo) => state.selected.add(photo.id));
  render();
});

$("#invertVisible").addEventListener("click", () => {
  if (state.month === "all") {
    toast("请先进入一个月份文件夹。");
    return;
  }
  visiblePhotos().forEach((photo) => {
    if (state.selected.has(photo.id)) state.selected.delete(photo.id);
    else state.selected.add(photo.id);
  });
  render();
});

$("#clearSelection").addEventListener("click", () => {
  state.selected.clear();
  render();
});

$("#selectBeforeMonth").addEventListener("click", () => {
  if (state.month === "all") {
    toast("请先选择一个月份，再选择更早月份。");
    return;
  }
  state.photos.filter((photo) => monthKey(photo) < state.month).forEach((photo) => state.selected.add(photo.id));
  render();
});

$("#adminPhotos").addEventListener("click", (event) => {
  const folder = event.target.closest("[data-month]");
  if (folder) {
    state.month = folder.dataset.month;
    state.selected.clear();
    render();
    return;
  }

  const card = event.target.closest("[data-photo-id]");
  if (!card) return;
  const id = card.dataset.photoId;
  if (state.selected.has(id)) state.selected.delete(id);
  else state.selected.add(id);
  render();
});

$("#adminPhotos").addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest("[data-photo-id], [data-month]");
  if (!card) return;
  event.preventDefault();
  card.click();
});

$("#exportBtn").addEventListener("click", () => {
  const year = $("#exportYear").value;
  window.location.href = `/api/admin/gallery/export${year ? `?year=${encodeURIComponent(year)}` : ""}`;
  toast("ZIP 下载后，请上传百度网盘完成长期备份。");
});

$("#reindexDatesBtn").addEventListener("click", async () => {
  if (!confirm("将重新读取素材日期，并按年份和月份重新整理。继续吗？")) return;
  toast("正在重新识别素材日期...");
  const data = await api("/api/admin/gallery/reindex-dates", { method: "POST" });
  toast(`日期整理完成：共 ${data.total || 0} 个，更新 ${data.updated || 0} 个。`);
  state.selected.clear();
  await load();
});

$("#deleteBtn").addEventListener("click", async () => {
  const ids = [...state.selected];
  if (!ids.length) {
    toast("请先进入月份并选择素材。");
    return;
  }
  const size = sizeText(selectedPhotos().reduce((sum, photo) => sum + Number(photo.size || 0), 0));
  if (!confirm(`将删除 ${ids.length} 个素材，合计约 ${size}。\n\n请确认素材已经备份到百度网盘。确认后将从 R2 删除。`)) return;
  await api("/api/admin/gallery/delete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids, confirmBackup: true }),
  });
  state.selected.clear();
  toast("已删除选中素材。");
  await load();
});

checkAuth().catch(() => {});
