<template>
  <div class="today-info" :title="tipText">
    <div class="today-icon" aria-hidden="true">
      <span class="orbit" />
      <span class="star s1" />
      <span class="star s2" />
      <span class="dot" />
    </div>
    <div class="today-copy">
      <span class="title">{{ titleText }}</span>
      <span class="meta">{{ metaText }}</span>
    </div>
  </div>
</template>

<script setup>
const now = ref(new Date());
let timer = null;

const fixedDays = {
  "01-01": "元旦",
  "02-14": "情人节",
  "03-08": "妇女节",
  "03-12": "植树节",
  "04-04": "清明节",
  "05-01": "劳动节",
  "05-04": "青年节",
  "06-01": "儿童节",
  "07-01": "建党节",
  "08-01": "建军节",
  "09-10": "教师节",
  "10-01": "国庆节",
  "12-25": "圣诞节",
};

const lunar2026 = {
  "02-17": "春节",
  "03-03": "元宵节",
  "06-19": "端午节",
  "09-25": "中秋节",
  "10-18": "重阳节",
};

const solarTerms2026 = {
  "01-05": "小寒",
  "01-20": "大寒",
  "02-04": "立春",
  "02-19": "雨水",
  "03-05": "惊蛰",
  "03-20": "春分",
  "04-05": "清明",
  "04-20": "谷雨",
  "05-05": "立夏",
  "05-21": "小满",
  "06-05": "芒种",
  "06-21": "夏至",
  "07-07": "小暑",
  "07-23": "大暑",
  "08-07": "立秋",
  "08-23": "处暑",
  "09-07": "白露",
  "09-23": "秋分",
  "10-08": "寒露",
  "10-23": "霜降",
  "11-07": "立冬",
  "11-22": "小雪",
  "12-07": "大雪",
  "12-22": "冬至",
};

const pad = (value) => String(value).padStart(2, "0");
const dateKey = (date) => `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const dayOfYear = (date) => {
  const start = new Date(date.getFullYear(), 0, 1);
  return Math.floor((startOfDay(date) - start) / 86400000) + 1;
};

const weekOfYear = (date) => {
  const start = new Date(date.getFullYear(), 0, 1);
  return Math.ceil((dayOfYear(date) + start.getDay()) / 7);
};

const weekParity = (week) => (week % 2 === 0 ? "双周" : "单周");

const daysUntil = (from, monthDay) => {
  const [month, day] = monthDay.split("-").map(Number);
  let target = new Date(from.getFullYear(), month - 1, day);
  if (target < startOfDay(from)) {
    target = new Date(from.getFullYear() + 1, month - 1, day);
  }
  return Math.round((target - startOfDay(from)) / 86400000);
};

const todayName = computed(() => {
  const key = dateKey(now.value);
  return fixedDays[key] || lunar2026[key] || solarTerms2026[key] || "";
});

const nextSpecialDay = computed(() => {
  const merged = { ...fixedDays, ...lunar2026, ...solarTerms2026 };
  return Object.entries(merged)
    .map(([key, name]) => ({ key, name, days: daysUntil(now.value, key) }))
    .filter((item) => item.days > 0)
    .sort((a, b) => a.days - b.days)[0];
});

const currentWeek = computed(() => weekOfYear(now.value));
const titleText = computed(() => todayName.value || `今年第 ${dayOfYear(now.value)} 天`);

const metaText = computed(() => {
  const weekText = `第 ${currentWeek.value} 周 · ${weekParity(currentWeek.value)}`;
  if (todayName.value) return `${weekText} · 今天是 ${todayName.value}`;
  if (nextSpecialDay.value) return `${weekText} · 距离${nextSpecialDay.value.name} ${nextSpecialDay.value.days} 天`;
  return `${weekText} · 平凡的一天也值得记录`;
});

const tipText = computed(() => `${now.value.getFullYear()} 年今日信息`);

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = new Date();
  }, 60 * 1000);
});

onBeforeUnmount(() => {
  window.clearInterval(timer);
});
</script>

<style lang="scss" scoped>
.today-info {
  width: 100%;
  min-height: 54px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 0 12px;
  color: #efefef;
  text-shadow: 0 0 5px #00000050;
  overflow: hidden;
  font-family: "HarmonyOS_Regular", sans-serif;
}

.today-icon {
  position: relative;
  flex: 0 0 42px;
  width: 42px;
  height: 42px;
}

.orbit {
  position: absolute;
  inset: 5px;
  border: 2px solid #ffffffcc;
  border-radius: 50%;
  box-shadow: 0 0 12px #ffffff55;
  animation: today-orbit 6s linear infinite;
}

.orbit::after {
  content: "";
  position: absolute;
  right: -3px;
  top: 6px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ffd86b;
  box-shadow: 0 0 10px #ffd86bcc;
}

.star,
.dot {
  position: absolute;
  display: block;
  border-radius: 50%;
  background: #fff;
}

.s1 {
  width: 4px;
  height: 4px;
  left: 4px;
  top: 8px;
  opacity: 0.8;
}

.s2 {
  width: 3px;
  height: 3px;
  right: 5px;
  bottom: 7px;
  opacity: 0.6;
}

.dot {
  left: calc(50% - 4px);
  top: calc(50% - 4px);
  width: 8px;
  height: 8px;
}

.today-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.25;
}

.title,
.meta {
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title {
  font-size: 1.08rem;
  font-weight: 700;
}

.meta {
  margin-top: 4px;
  font-size: 0.9rem;
  opacity: 0.9;
}

@keyframes today-orbit {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
