const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const api = async (url, options = {}) => {
  const headers = options.body instanceof FormData ? options.headers || {} : { "content-type": "application/json", ...(options.headers || {}) };
  const response = await fetch(url, { credentials: "include", headers, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.message || "请求失败");
  return data;
};

const toast = (message) => {
  $("#adminToast").textContent = message;
};

const showPanel = (name) => {
  ["upload", "pending", "published", "settings"].forEach((item) => {
    $(`#${item}Panel`).hidden = item !== name;
  });
  $$(".admin-nav a").forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${name}`));
  if (name === "pending") loadPending();
  if (name === "published") loadPublished();
  if (name === "settings") loadSecurity();
};

const pad = (value) => String(value).padStart(2, "0");
const dateOnly = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const sha256Hex = async (file) => {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join("");
};

const extractExifDate = async (file) => {
  if (!file.type.includes("jpeg")) return { date: dateOnly(new Date(file.lastModified || Date.now())), source: "file_mtime" };
  const buffer = await file.slice(0, 256 * 1024).arrayBuffer();
  const text = new TextDecoder("latin1").decode(buffer);
  const match = text.match(/(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (match) return { date: `${match[1]}-${match[2]}-${match[3]}`, source: "exif" };
  return { date: dateOnly(new Date(file.lastModified || Date.now())), source: "file_mtime" };
};

const blobFromCanvas = (canvas, quality = 0.82) =>
  new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/webp", quality));

const imagePreview = async (file, maxSize) => {
  if (!file.type.startsWith("image/") || file.type.includes("heic") || file.type.includes("heif")) return { blob: null, width: 0, height: 0 };
  const img = new Image();
  img.decoding = "async";
  img.src = URL.createObjectURL(file);
  await img.decode();
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(img.src);
  return { blob: await blobFromCanvas(canvas), width: img.naturalWidth, height: img.naturalHeight };
};

const flattenItems = async (items) => {
  const files = [];
  const walk = async (entry) => {
    if (entry.isFile) {
      await new Promise((resolve) => entry.file((file) => {
        files.push(file);
        resolve();
      }));
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const read = () =>
        new Promise((resolve) => {
          reader.readEntries(async (entries) => {
            for (const child of entries) await walk(child);
            resolve(entries.length);
          });
        });
      let hasMore = true;
      while (hasMore) {
        hasMore = Boolean(await read());
      }
    }
  };
  for (const item of items) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) await walk(entry);
    else if (item.getAsFile?.()) files.push(item.getAsFile());
  }
  return files.filter(Boolean);
};

const uploadFiles = async (files) => {
  const accepted = files.filter((file) => /^(image|video)\//.test(file.type));
  if (!accepted.length) return;
  const batch = await api("/api/admin/album/batches", {
    method: "POST",
    body: JSON.stringify({ totalFiles: accepted.length, totalBytes: accepted.reduce((sum, file) => sum + file.size, 0) }),
  });
  let done = 0;
  let duplicate = 0;
  let failed = 0;
  $("#uploadList").innerHTML = "";
  const queue = [...accepted];
  const worker = async () => {
    while (queue.length) {
      const file = queue.shift();
      const row = document.createElement("div");
      row.className = "row-card glass";
      row.innerHTML = `<div class="thumb">上传</div><div><strong>${file.name}</strong><p class="muted">处理中</p></div><div class="row-actions"></div>`;
      $("#uploadList").prepend(row);
      try {
        const [hash, exif, thumb, preview] = await Promise.all([
          sha256Hex(file),
          extractExifDate(file),
          imagePreview(file, 420),
          imagePreview(file, 1400),
        ]);
        const form = new FormData();
        form.append("batchId", batch.batchId);
        form.append("file", file);
        form.append("sha256", hash);
        form.append("capturedAt", exif.date);
        form.append("dateSource", exif.source);
        form.append("width", thumb.width || preview.width || 0);
        form.append("height", thumb.height || preview.height || 0);
        if (thumb.blob) form.append("thumbnail", thumb.blob, `${file.name}.thumb.webp`);
        if (preview.blob) form.append("preview", preview.blob, `${file.name}.preview.webp`);
        const result = await api("/api/admin/album/upload/complete", { method: "POST", body: form });
        if (result.duplicate) duplicate += 1;
        done += 1;
        row.querySelector("p").textContent = result.duplicate ? "重复文件，已跳过" : "上传完成，已进入待整理箱";
      } catch (err) {
        failed += 1;
        row.querySelector("p").textContent = `失败：${err.message}`;
        const retry = document.createElement("button");
        retry.className = "btn";
        retry.textContent = "重试";
        retry.addEventListener("click", () => uploadFiles([file]));
        row.querySelector(".row-actions").append(retry);
      }
      const percent = Math.round(((done + failed) / accepted.length) * 100);
      $("#uploadProgress").style.width = `${percent}%`;
      $("#uploadSummary").textContent = `总数 ${accepted.length} · 完成 ${done} · 重复 ${duplicate} · 失败 ${failed}`;
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, accepted.length) }, worker));
};

const eventCard = (event, published = false) => `
  <div class="row-card glass">
    ${
      event.cover_media_id
        ? `<img class="thumb" src="/api/admin/album/media/${event.cover_media_id}/thumbnail" alt="">`
        : `<div class="thumb">封面</div>`
    }
    <div>
      <strong>${event.title || event.event_date}</strong>
      <p class="muted">${event.event_date} · ${event.photo_count || 0} 张照片 · ${event.video_count || 0} 个视频</p>
      <label class="form-row"><span>标题</span><input value="${event.title || ""}" data-title="${event.id}"></label>
    </div>
    <div class="row-actions">
      <button class="btn" data-save-event="${event.id}">保存</button>
      ${published ? "" : `<button class="btn primary" data-publish-one="${event.id}">发布</button>`}
      <button class="btn danger" data-delete-event="${event.id}">删除</button>
    </div>
  </div>`;

const loadPending = async () => {
  const data = await api("/api/admin/album/pending");
  $("#pendingList").innerHTML = data.events?.length ? data.events.map((event) => eventCard(event)).join("") : `<div class="empty">待整理箱为空</div>`;
};

const loadPublished = async () => {
  const data = await api("/api/admin/album/published");
  $("#publishedList").innerHTML = data.events?.length ? data.events.map((event) => eventCard(event, true)).join("") : `<div class="empty">暂无已发布相册</div>`;
};

const loadSecurity = async () => {
  const data = await api("/api/admin/album/security");
  $("#accessEnabled").checked = data.settings.accessEnabled;
  $("#sessionDays").value = data.settings.sessionDays || 30;
  $("#securityStatus").textContent = `家庭密码：${data.settings.passwordSet ? "已设置" : "未设置"} · 有效家庭会话：${data.settings.activeSessionCount || 0}`;
};

$$(".admin-nav a").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showPanel(link.getAttribute("href").slice(1));
  });
});

$("#pickFiles").addEventListener("click", () => $("#fileInput").click());
$("#pickFolder").addEventListener("click", () => $("#folderInput").click());
$("#pickCamera").addEventListener("click", () => $("#cameraInput").click());
["fileInput", "folderInput", "cameraInput"].forEach((id) => {
  $(`#${id}`).addEventListener("change", (event) => uploadFiles([...event.target.files]));
});

$("#dropZone").addEventListener("dragover", (event) => {
  event.preventDefault();
  $("#dropZone").classList.add("dragover");
});
$("#dropZone").addEventListener("dragleave", () => $("#dropZone").classList.remove("dragover"));
$("#dropZone").addEventListener("drop", async (event) => {
  event.preventDefault();
  $("#dropZone").classList.remove("dragover");
  await uploadFiles(await flattenItems([...event.dataTransfer.items]));
});

$("#publishAll").addEventListener("click", async () => {
  await api("/api/admin/album/publish", { method: "POST", body: JSON.stringify({}) });
  toast("已发布全部待整理相册。");
  loadPending();
});

document.addEventListener("click", async (event) => {
  const saveId = event.target.closest("[data-save-event]")?.dataset.saveEvent;
  if (saveId) {
    await api(`/api/admin/album/events/${saveId}`, {
      method: "PATCH",
      body: JSON.stringify({ title: document.querySelector(`[data-title="${saveId}"]`).value }),
    });
    toast("相册已保存。");
    loadPending();
    loadPublished();
  }
  const publishId = event.target.closest("[data-publish-one]")?.dataset.publishOne;
  if (publishId) {
    await api("/api/admin/album/publish", { method: "POST", body: JSON.stringify({ eventIds: [publishId] }) });
    toast("相册已发布。");
    loadPending();
  }
  const deleteId = event.target.closest("[data-delete-event]")?.dataset.deleteEvent;
  if (deleteId && confirm("确定删除这个相册吗？")) {
    await api(`/api/admin/album/events/${deleteId}`, { method: "DELETE" });
    toast("相册已删除。");
    loadPending();
    loadPublished();
  }
});

$("#saveSecurity").addEventListener("click", async () => {
  await api("/api/admin/album/security", {
    method: "PATCH",
    body: JSON.stringify({ accessEnabled: $("#accessEnabled").checked, sessionDays: Number($("#sessionDays").value) }),
  });
  toast("访问设置已保存。");
  loadSecurity();
});

$("#showAdminPassword").addEventListener("change", (event) => {
  $("#newPassword").type = event.target.checked ? "text" : "password";
  $("#confirmPassword").type = event.target.checked ? "text" : "password";
});

$("#savePassword").addEventListener("click", async () => {
  if (!confirm("保存后所有家庭设备需要重新登录，确定继续吗？")) return;
  await api("/api/admin/album/security/password", {
    method: "POST",
    body: JSON.stringify({ password: $("#newPassword").value, confirmPassword: $("#confirmPassword").value }),
  });
  $("#newPassword").value = "";
  $("#confirmPassword").value = "";
  toast("家庭密码已更新，所有家庭设备需要重新登录。");
  loadSecurity();
});

$("#logoutAll").addEventListener("click", async () => {
  if (!confirm("确定退出所有家庭设备吗？")) return;
  await api("/api/admin/album/security/logout-all", { method: "POST", body: "{}" });
  toast("所有家庭设备已退出。");
  loadSecurity();
});

showPanel(location.hash?.slice(1) || "upload");
