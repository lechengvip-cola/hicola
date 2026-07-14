const $ = (selector) => document.querySelector(selector);
const state = { photos: [], storage: null, selected: new Set(), month: "all" };

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
  if (bytes > 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const monthKey = (photo) => `${photo.year}-${String(photo.month).padStart(2, "0")}`;
const monthName = (key) => {
  const [year, month] = key.split("-");
  return `${year} 年 ${Number(month)} 月`;
};

const visiblePhotos = () => (state.month === "all" ? state.photos : state.photos.filter((photo) => monthKey(photo) === state.month));

const selectedPhotos = () => state.photos.filter((photo) => state.selected.has(photo.id));

const renderMonthFilter = () => {
  const months = [...new Set(state.photos.map(monthKey))].sort().reverse();
  const select = $("#monthFilter");
  const current = state.month;
  select.innerHTML = `<option value="all">全部月份</option>${months.map((key) => `<option value="${key}">${monthName(key)}</option>`).join("")}`;
  select.value = months.includes(current) ? current : "all";
  state.month = select.value;
};

const renderSummary = () => {
  const visible = visiblePhotos();
  const selected = selectedPhotos();
  const selectedSize = selected.reduce((sum, photo) => sum + Number(photo.size || 0), 0);
  $("#selectionSummary").textContent = `当前显示 ${visible.length} 张，已选 ${selected.length} 张。`;
  $("#selectedSize").textContent = sizeText(selectedSize);
};

const render = () => {
  const storage = state.storage || { totalBytes: 0, limitBytes: 10 * 1024 ** 3, status: "normal", message: "容量正常。" };
  const percent = Math.min(100, Math.round((storage.totalBytes / storage.limitBytes) * 1000) / 10);
  $("#capacity").className = `panel glass capacity status-${storage.status}`;
  $("#capacityText").textContent = `${storage.usedGB || 0} GB / 10 GB`;
  $("#capacityBar").style.width = `${percent}%`;
  $("#capacityMessage").textContent =
    storage.status === "normal" ? "状态：正常" : `状态：${storage.status === "warning" ? "提醒" : "危险"}，${storage.message}`;
  $("#totalPhotos").textContent = state.photos.length;

  renderMonthFilter();
  renderSummary();
  const photos = visiblePhotos();
  $("#adminPhotos").innerHTML = photos.length
    ? photos
        .map((photo) => {
          const checked = state.selected.has(photo.id);
          return `
            <article class="admin-photo ${checked ? "selected" : ""}" data-photo-id="${photo.id}" tabindex="0">
              <span class="select-chip">${checked ? "已选择" : "点击选择"}</span>
              <img src="${photo.thumbnail || photo.url}" alt="${photo.filename}" loading="lazy" />
              <p>${photo.date} · ${sizeText(photo.size)}<br />${photo.filename}</p>
            </article>`;
        })
        .join("")
    : `<div class="empty glass"><h2>当前筛选没有照片</h2><p class="muted">可以切换月份或上传新照片。</p></div>`;
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
  await load();
};

const checkAuth = async () => {
  const data = await api("/api/admin/gallery/auth/status");
  if (data.authenticated) await showApp();
};

$("#loginBtn").addEventListener("click", async () => {
  try {
    await api("/api/admin/gallery/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: $("#adminPassword").value.trim() }),
    });
    await showApp();
  } catch (err) {
    $("#loginError").textContent = err.message || "登录失败";
  }
});

const uploadFiles = async (files) => {
  const images = [...files].filter((file) => file.type.startsWith("image/"));
  if (!images.length) return;
  toast(`准备上传 ${images.length} 张照片...`);
  let done = 0;
  for (const file of images) {
    const form = new FormData();
    form.append("file", file);
    await fetch("/api/admin/gallery/upload", { method: "POST", credentials: "include", body: form }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.message || "上传失败");
    });
    done += 1;
    toast(`已上传 ${done} / ${images.length}`);
  }
  toast("上传完成。");
  await load();
};

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
  render();
});

$("#selectVisible").addEventListener("click", () => {
  visiblePhotos().forEach((photo) => state.selected.add(photo.id));
  render();
});

$("#invertVisible").addEventListener("click", () => {
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
  if (state.month === "all") return toast("请先选择一个月份，再选择更早月份。");
  state.photos.filter((photo) => monthKey(photo) < state.month).forEach((photo) => state.selected.add(photo.id));
  render();
});

$("#adminPhotos").addEventListener("click", (event) => {
  const card = event.target.closest("[data-photo-id]");
  if (!card) return;
  const id = card.dataset.photoId;
  if (state.selected.has(id)) state.selected.delete(id);
  else state.selected.add(id);
  render();
});

$("#adminPhotos").addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest("[data-photo-id]");
  if (!card) return;
  event.preventDefault();
  card.click();
});

$("#exportBtn").addEventListener("click", () => {
  const year = $("#exportYear").value;
  const url = `/api/admin/gallery/export${year ? `?year=${encodeURIComponent(year)}` : ""}`;
  window.location.href = url;
  toast("ZIP 下载后，请上传百度网盘完成长期备份。");
});

$("#deleteBtn").addEventListener("click", async () => {
  const ids = [...state.selected];
  if (!ids.length) return toast("请先选择照片。");
  const count = ids.length;
  const size = sizeText(selectedPhotos().reduce((sum, photo) => sum + Number(photo.size || 0), 0));
  if (!confirm(`将删除 ${count} 张照片，合计约 ${size}。\n\n请确认照片已经备份到百度网盘。确认后将从 R2 删除。`)) return;
  await api("/api/admin/gallery/delete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids, confirmBackup: true }),
  });
  state.selected.clear();
  toast("已删除选中照片。");
  await load();
});

checkAuth().catch(() => {});
