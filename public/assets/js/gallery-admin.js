const $ = (selector) => document.querySelector(selector);
const state = { photos: [], storage: null };

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

const render = () => {
  const storage = state.storage || { totalBytes: 0, limitBytes: 10 * 1024 ** 3, status: "normal", message: "容量正常。" };
  const percent = Math.min(100, Math.round((storage.totalBytes / storage.limitBytes) * 1000) / 10);
  $("#capacity").className = `panel glass capacity status-${storage.status}`;
  $("#capacityText").textContent = `${storage.usedGB || 0} GB / 10 GB`;
  $("#capacityBar").style.width = `${percent}%`;
  $("#capacityMessage").textContent = storage.status === "normal" ? "状态：正常" : `状态：${storage.status === "warning" ? "提醒" : "危险"}，${storage.message}`;
  $("#totalPhotos").textContent = state.photos.length;

  $("#adminPhotos").innerHTML = state.photos.length
    ? state.photos
        .map(
          (photo) => `
            <article class="admin-photo">
              <label><input type="checkbox" value="${photo.id}" /> 选择</label>
              <img src="${photo.thumbnail || photo.url}" alt="${photo.filename}" loading="lazy" />
              <p>${photo.date} · ${sizeText(photo.size)}<br />${photo.filename}</p>
            </article>`,
        )
        .join("")
    : `<div class="empty glass"><h2>还没有照片</h2><p class="muted">上传后会自动进入成长照片库。</p></div>`;
};

const load = async () => {
  const data = await api("/api/admin/gallery");
  state.photos = data.photos || [];
  state.storage = data.storage;
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

$("#exportBtn").addEventListener("click", () => {
  const year = $("#exportYear").value;
  const url = `/api/admin/gallery/export${year ? `?year=${encodeURIComponent(year)}` : ""}`;
  window.location.href = url;
  toast("ZIP 下载后，请上传百度网盘完成长期备份。");
});

$("#deleteBtn").addEventListener("click", async () => {
  const ids = [...document.querySelectorAll(".admin-photo input:checked")].map((input) => input.value);
  if (!ids.length) return toast("请先选择照片。");
  if (!confirm("请确认照片已经备份到百度网盘。确认后将从 R2 删除。")) return;
  await api("/api/admin/gallery/delete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids, confirmBackup: true }),
  });
  toast("已删除选中照片。");
  await load();
});

checkAuth().catch(() => {});

