(function () {
  const STORAGE_KEY = "hicola-study-items";
  const FILES_KEY = "hicola-study-files";
  const tabs = ["今日作业", "明日提醒", "本周事项", "学习资料", "通知公告", "错题整理", "已完成"];
  const state = {
    items: [],
    files: [],
    activeTab: "今日作业",
    notifiedToday: false,
  };

  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  const todayDate = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const formatDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const today = () => formatDate(new Date());
  const tomorrow = () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return formatDate(date);
  };
  const formatTime = (date = new Date()) =>
    `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

  function loadStudyItems() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch (error) {
      console.warn("读取学习收纳盒失败", error);
      return [];
    }
  }

  function saveStudyItems(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function saveFiles(files) {
    localStorage.setItem(FILES_KEY, JSON.stringify(files));
  }

  function getTodayTodoCount() {
    return state.items.filter((item) => item.status !== "done" && item.dueDate === today()).length;
  }

  function getTomorrowTodoCount() {
    return state.items.filter((item) => item.status !== "done" && item.dueDate === tomorrow()).length;
  }

  function getThisWeekCount() {
    const now = new Date();
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + 1);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return state.items.filter((item) => {
      const due = new Date(`${item.dueDate}T12:00:00`);
      return item.status !== "done" && due >= monday && due <= sunday;
    }).length;
  }

  function weekDate(weekdayText) {
    const map = { 周一: 1, 周二: 2, 周三: 3, 周四: 4, 周五: 5, 周六: 6, 周日: 7 };
    const target = map[weekdayText];
    if (!target) return today();
    const now = new Date();
    const current = now.getDay() || 7;
    const date = new Date(now);
    date.setDate(now.getDate() + target - current);
    return formatDate(date);
  }

  function detectSubject(text) {
    const rules = [
      ["数学", /数学|口算|练习册|计算|应用题/],
      ["语文", /语文|背诵|朗读|课文|作文|生字/],
      ["英语", /英语|单词|听读|Unit|课文录音/i],
      ["科学", /科学|实验|观察|自然/],
      ["艺体", /美术|音乐|体育|跳绳/],
    ];
    return rules.find(([, reg]) => reg.test(text))?.[0] || "其他";
  }

  function detectType(text) {
    if (/签字|家长签名/.test(text)) return "家长签字";
    if (/错题|订正/.test(text)) return "错题整理";
    if (/考试|测试|测验|单元/.test(text)) return "考试提醒";
    if (/通知|家长会|缴费|报名/.test(text)) return "通知公告";
    if (/明天带|准备|携带/.test(text)) return "重要提醒";
    if (/完成|练习|作业|订正/.test(text)) return "今日作业";
    return "学习资料";
  }

  function detectDueDate(text) {
    if (/明天|明早/.test(text)) return tomorrow();
    if (/今天|今晚|今日/.test(text)) return today();
    const weekday = text.match(/周[一二三四五六日]/)?.[0];
    return weekday ? weekDate(weekday) : today();
  }

  function detectPriority(text, type) {
    if (/必须|务必|检查|考试|明天交|家长签字|家长签名/.test(text)) return "high";
    if (type === "学习资料") return "low";
    return "medium";
  }

  function makeTitle(subject, type, text) {
    if (type === "今日作业") return `${subject}作业`;
    if (type === "家长签字") return `${subject}签字确认`;
    if (type === "错题整理") return `${subject}错题整理`;
    return type;
  }

  function parseHomeworkText(text, sourceFileName = "手动输入") {
    const normalized = text.trim();
    const subject = detectSubject(normalized);
    const type = detectType(normalized);
    const dueDate = detectDueDate(normalized);
    return {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      subject,
      title: makeTitle(subject, type, normalized),
      content: normalized || "未填写具体内容",
      type,
      dueDate,
      priority: detectPriority(normalized, type),
      needParentSign: /签字|家长签名/.test(normalized),
      status: "todo",
      sourceFileName,
      createdAt: formatTime(),
    };
  }

  async function extractTextFromFile(file) {
    if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
      return file.text();
    }

    if (file.type.startsWith("image/")) {
      // TODO: 后续可在这里接入 Tesseract.js 或 POST /api/analyze-homework 做 OCR。
      return "";
    }

    // TODO: PDF / Word 可上传到 Cloudflare R2，再由后端解析并写入 D1。
    // TODO: 未来可接 OpenAI API 自动识别图片文字并总结作业。
    // TODO: 未来可接微信 / 企业微信 / 公众号提醒、日历视图、每周学习资料归档。
    return "";
  }

  function priorityText(priority) {
    return { high: "高", medium: "中", low: "低" }[priority] || "中";
  }

  function tabItems(tab) {
    if (tab === "已完成") return state.items.filter((item) => item.status === "done");
    if (tab === "今日作业") {
      return state.items.filter((item) => item.status !== "done" && item.dueDate === today());
    }
    if (tab === "明日提醒") {
      return state.items.filter((item) => item.status !== "done" && item.dueDate === tomorrow());
    }
    if (tab === "本周事项") {
      const now = new Date();
      const day = now.getDay() || 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - day + 1);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      return state.items.filter((item) => {
        const due = new Date(`${item.dueDate}T12:00:00`);
        return item.status !== "done" && due >= monday && due <= sunday;
      });
    }
    if (tab === "错题整理") return state.items.filter((item) => item.status !== "done" && item.type === "错题整理");
    if (tab === "通知公告") return state.items.filter((item) => item.status !== "done" && item.type === "通知公告");
    if (tab === "学习资料") return state.items.filter((item) => item.status !== "done" && item.type === "学习资料");
    return [];
  }

  function notifyHomeBadge() {
    window.dispatchEvent(new Event("storage"));
  }

  function renderSummary() {
    $("#todayTodo").textContent = `${getTodayTodoCount()} 项`;
    $("#tomorrowTodo").textContent = `${getTomorrowTodoCount()} 项`;
  }

  function renderTabs() {
    $("#tabs").innerHTML = tabs
      .map((tab) => {
        const count = tab === "明日提醒" ? getTomorrowTodoCount() : tab === "本周事项" ? getThisWeekCount() : tabItems(tab).length;
        return `<button class="tab-btn ${tab === state.activeTab ? "active" : ""}" data-tab="${tab}" type="button">${tab} ${count}</button>`;
      })
      .join("");
  }

  function renderFiles() {
    $("#fileCount").textContent = `${state.files.length} 个`;
    if (!state.files.length) {
      $("#fileList").innerHTML = "";
      return;
    }
    $("#fileList").innerHTML = state.files
      .map((file) => {
        const preview = file.preview
          ? `<img class="thumb" src="${file.preview}" alt="${file.name}" />`
          : `<div class="file-icon">${file.ext}</div>`;
        return `
          <article class="file-card" data-file-id="${file.id}">
            <div class="file-top">
              ${preview}
              <div>
                <div class="file-name">${escapeHtml(file.name)}</div>
                <div class="file-time">上传时间：${escapeHtml(file.createdAt)}</div>
              </div>
              <button class="icon-btn delete-file" type="button" aria-label="删除文件">×</button>
            </div>
            <textarea class="file-text" placeholder="这里可以补充或粘贴识别文字">${escapeHtml(file.text || "")}</textarea>
            <button class="primary-btn parse-file" type="button">整理为作业 / 资料</button>
          </article>
        `;
      })
      .join("");
  }

  function emptyMarkup() {
    return `
      <div class="empty-state">
        <strong>今天还没有待完成作业</strong>
        <p>可以拖入老师发的图片或资料，系统会帮你整理。</p>
      </div>
    `;
  }

  function renderItems() {
    const items = tabItems(state.activeTab);
    if (!items.length) {
      $("#itemsList").innerHTML = emptyMarkup();
      return;
    }
    $("#itemsList").innerHTML = items
      .map(
        (item) => `
        <article class="item-card" data-id="${item.id}">
          <div class="item-head">
            <div class="tags">
              <span class="tag">${escapeHtml(item.subject)}</span>
              <span class="tag type">${escapeHtml(item.type)}</span>
              <span class="tag ${item.priority}">重要程度：${priorityText(item.priority)}</span>
              ${item.needParentSign ? `<span class="tag high">家长签字</span>` : ""}
            </div>
            <span class="due">截止：${escapeHtml(item.dueDate)}</span>
          </div>
          <h3 class="item-title">${escapeHtml(item.title)}</h3>
          <p class="item-content">${escapeHtml(item.content)}</p>
          <p class="meta">来源：${escapeHtml(item.sourceFileName)} · 创建：${escapeHtml(item.createdAt)}</p>
          <div class="card-actions">
            ${item.status === "done" ? `<button type="button" class="restore">恢复待办</button>` : `<button type="button" class="done">完成</button>`}
            <button type="button" class="edit">编辑</button>
            <button type="button" class="delete">删除</button>
          </div>
        </article>
      `,
      )
      .join("");
  }

  function renderAll() {
    renderSummary();
    renderTabs();
    renderFiles();
    renderItems();
    notifyHomeBadge();
  }

  function persistItems() {
    saveStudyItems(state.items);
    renderAll();
  }

  async function addFiles(fileList) {
    const supported = /\.(jpe?g|png|webp|pdf|docx?|txt)$/i;
    for (const file of fileList) {
      if (!supported.test(file.name)) continue;
      const isImage = file.type.startsWith("image/");
      const entry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: file.name,
        ext: file.name.split(".").pop().toUpperCase(),
        createdAt: formatTime(),
        text: await extractTextFromFile(file),
        preview: "",
      };
      if (isImage) {
        entry.preview = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => resolve("");
          reader.readAsDataURL(file);
        });
      }
      state.files.unshift(entry);
    }
    saveFiles(state.files);
    renderAll();
  }

  function addItemFromText(text, sourceFileName) {
    if (!text.trim()) {
      alert("请先粘贴或填写需要整理的文字。");
      return;
    }
    state.items.unshift(parseHomeworkText(text, sourceFileName));
    persistItems();
  }

  function openEdit(item) {
    $("#editId").value = item.id;
    $("#editSubject").value = item.subject;
    $("#editType").value = item.type;
    $("#editDueDate").value = item.dueDate;
    $("#editPriority").value = item.priority;
    $("#editStatus").value = item.status;
    $("#editContent").value = item.content;
    $("#editNeedSign").checked = item.needParentSign;
    $("#editModal").hidden = false;
  }

  function closeEdit() {
    $("#editModal").hidden = true;
  }

  function requestNotification() {
    if (!("Notification" in window)) {
      alert("当前浏览器不支持通知功能。");
      return;
    }
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        showTodayNotification();
      }
    });
  }

  function showTodayNotification() {
    if (state.notifiedToday || !("Notification" in window) || Notification.permission !== "granted") return;
    const count = getTodayTodoCount();
    if (count > 0) {
      new Notification("学习收纳盒", { body: `今天还有 ${count} 项作业未完成。` });
      state.notifiedToday = true;
    }
  }

  function bindEvents() {
    $("#fileInput").addEventListener("change", (event) => addFiles(event.target.files));
    $("#parseManualBtn").addEventListener("click", () => addItemFromText($("#manualText").value, "手动输入"));
    $("#notifyBtn").addEventListener("click", requestNotification);
    $("#clearDoneBtn").addEventListener("click", () => {
      state.items = state.items.filter((item) => item.status !== "done");
      persistItems();
    });

    $("#dropZone").addEventListener("dragover", (event) => {
      event.preventDefault();
      $("#dropZone").classList.add("dragging");
    });
    $("#dropZone").addEventListener("dragleave", () => $("#dropZone").classList.remove("dragging"));
    $("#dropZone").addEventListener("drop", (event) => {
      event.preventDefault();
      $("#dropZone").classList.remove("dragging");
      addFiles(event.dataTransfer.files);
    });

    $("#tabs").addEventListener("click", (event) => {
      const button = event.target.closest("[data-tab]");
      if (!button) return;
      state.activeTab = button.dataset.tab;
      renderAll();
    });

    $("#fileList").addEventListener("click", (event) => {
      const card = event.target.closest(".file-card");
      if (!card) return;
      const file = state.files.find((entry) => entry.id === card.dataset.fileId);
      if (!file) return;
      if (event.target.closest(".delete-file")) {
        state.files = state.files.filter((entry) => entry.id !== file.id);
        saveFiles(state.files);
        renderAll();
      }
      if (event.target.closest(".parse-file")) {
        const text = card.querySelector(".file-text").value;
        file.text = text;
        saveFiles(state.files);
        addItemFromText(text, file.name);
      }
    });

    $("#itemsList").addEventListener("click", (event) => {
      const card = event.target.closest(".item-card");
      if (!card) return;
      const item = state.items.find((entry) => entry.id === card.dataset.id);
      if (!item) return;
      if (event.target.closest(".done")) item.status = "done";
      if (event.target.closest(".restore")) item.status = "todo";
      if (event.target.closest(".delete")) state.items = state.items.filter((entry) => entry.id !== item.id);
      if (event.target.closest(".edit")) {
        openEdit(item);
        return;
      }
      persistItems();
    });

    $("#closeEditBtn").addEventListener("click", closeEdit);
    $("#cancelEditBtn").addEventListener("click", closeEdit);
    $("#editModal").addEventListener("click", (event) => {
      if (event.target.id === "editModal") closeEdit();
    });
    $("#editForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const item = state.items.find((entry) => entry.id === $("#editId").value);
      if (!item) return;
      item.subject = $("#editSubject").value;
      item.type = $("#editType").value;
      item.dueDate = $("#editDueDate").value;
      item.priority = $("#editPriority").value;
      item.status = $("#editStatus").value;
      item.content = $("#editContent").value;
      item.title = makeTitle(item.subject, item.type, item.content);
      item.needParentSign = $("#editNeedSign").checked;
      closeEdit();
      persistItems();
    });
  }

  function init() {
    state.items = loadStudyItems();
    try {
      state.files = JSON.parse(localStorage.getItem(FILES_KEY) || "[]");
    } catch {
      state.files = [];
    }
    bindEvents();
    renderAll();
    showTodayNotification();
  }

  window.extractTextFromFile = extractTextFromFile;
  window.parseHomeworkText = parseHomeworkText;
  window.saveStudyItems = saveStudyItems;
  window.getTodayTodoCount = getTodayTodoCount;

  document.addEventListener("DOMContentLoaded", init);
})();
