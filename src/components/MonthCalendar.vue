<template>
  <section class="month-calendar cards">
    <div class="clock-hero">
      <div>
        <p class="clock-date">{{ currentYear }} 年 {{ currentMonthText }} 月 {{ todayDate }} 日 {{ todayWeekday }}</p>
        <div class="clock-time">{{ clockTime }}</div>
      </div>
      <TodayInfo class="calendar-today-info" />
    </div>

    <div class="week-row">
      <span v-for="week in weeks" :key="week">{{ week }}</span>
    </div>

    <div class="date-grid">
      <button
        v-for="day in calendarDays"
        :key="day.key"
        type="button"
        :class="[
          'day-cell',
          {
            muted: !day.inMonth,
            today: day.isToday,
            weekend: day.isWeekend,
            hasTodo: day.todoCount > 0,
          },
        ]"
        :title="day.todoCount ? `${day.dateText} 有 ${day.todoCount} 项待完成` : day.dateText"
      >
        <span class="date-number">{{ day.day }}</span>
        <small v-if="day.isToday">今日</small>
        <span v-if="day.todoCount" class="todo-dot">{{ day.todoCount }} 项</span>
      </button>
    </div>

    <footer class="calendar-foot">
      <span>今日待完成 {{ todayTodoCount }} 项</span>
      <span>本月待办 {{ monthTodoCount }} 项</span>
      <span>距月底 {{ monthRemainingDays }} 天</span>
    </footer>
  </section>
</template>

<script setup>
import TodayInfo from "@/components/TodayInfo.vue";

const weeks = ["一", "二", "三", "四", "五", "六", "日"];
const now = ref(new Date());
const studyItems = ref([]);
const clockTimer = ref(null);

const pad = (value) => String(value).padStart(2, "0");
const formatDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const refreshStudyItems = () => {
  try {
    studyItems.value = JSON.parse(localStorage.getItem("hicola-study-items") || "[]");
  } catch (error) {
    console.warn("读取学习收纳盒日历数据失败", error);
    studyItems.value = [];
  }
};

const currentYear = computed(() => now.value.getFullYear());
const currentMonth = computed(() => now.value.getMonth());
const currentMonthText = computed(() => pad(currentMonth.value + 1));
const todayKey = computed(() => formatDate(now.value));
const todayDate = computed(() => now.value.getDate());
const todayWeekday = computed(() => `星期${"日一二三四五六"[now.value.getDay()]}`);
const clockTime = computed(() => {
  return `${pad(now.value.getHours())}:${pad(now.value.getMinutes())}:${pad(now.value.getSeconds())}`;
});
const monthRemainingDays = computed(() => {
  const end = new Date(currentYear.value, currentMonth.value + 1, 0);
  return Math.max(0, end.getDate() - todayDate.value);
});

const todoMap = computed(() => {
  return studyItems.value.reduce((result, item) => {
    if (item.status === "done" || !item.dueDate) return result;
    result[item.dueDate] = (result[item.dueDate] || 0) + 1;
    return result;
  }, {});
});

const calendarDays = computed(() => {
  const year = currentYear.value;
  const month = currentMonth.value;
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const key = formatDate(date);
    const dayOfWeek = date.getDay();
    return {
      key,
      day: date.getDate(),
      dateText: key,
      inMonth: date.getMonth() === month,
      isToday: key === todayKey.value,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      todoCount: todoMap.value[key] || 0,
    };
  });
});

const todayTodoCount = computed(() => todoMap.value[todayKey.value] || 0);
const monthTodoCount = computed(() => {
  const monthPrefix = `${currentYear.value}-${currentMonthText.value}`;
  return Object.entries(todoMap.value).reduce((sum, [date, count]) => {
    return date.startsWith(monthPrefix) ? sum + count : sum;
  }, 0);
});

onMounted(() => {
  refreshStudyItems();
  clockTimer.value = window.setInterval(() => {
    now.value = new Date();
  }, 1000);
  window.addEventListener("storage", refreshStudyItems);
  window.addEventListener("focus", refreshStudyItems);
});

onBeforeUnmount(() => {
  window.clearInterval(clockTimer.value);
  window.removeEventListener("storage", refreshStudyItems);
  window.removeEventListener("focus", refreshStudyItems);
});
</script>

<style lang="scss" scoped>
.month-calendar {
  width: min(92%, 560px);
  margin-top: 0;
  margin-left: auto;
  margin-right: clamp(14px, 2.6vw, 46px);
  padding: 1.05rem 1.1rem 1rem;
  background:
    linear-gradient(145deg, rgb(255 255 255 / 14%), rgb(0 0 0 / 18%)),
    rgb(0 0 0 / 22%);
  backdrop-filter: blur(14px);
  box-shadow:
    0 22px 60px rgb(0 0 0 / 22%),
    inset 0 1px 0 rgb(255 255 255 / 12%);
  animation: fade 0.5s;

  .clock-hero {
    margin-bottom: 1rem;
    padding: 1rem 1.05rem;
    border-radius: 8px;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    align-items: center;
    background:
      radial-gradient(circle at 12% 20%, rgb(238 255 249 / 22%), transparent 32%),
      rgb(0 0 0 / 18%);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 12%);

    .clock-date {
      color: rgb(255 255 255 / 76%);
      font-size: 1rem;
      font-weight: 700;
    }

    .clock-time {
      margin-top: 0.35rem;
      font-family: "UnidreamLED", "HarmonyOS_Regular", sans-serif;
      font-size: clamp(3.1rem, 5.2vw, 4.7rem);
      line-height: 0.95;
      letter-spacing: 1px;
      text-shadow: 0 10px 28px rgb(0 0 0 / 28%);
    }

    :deep(.calendar-today-info) {
      min-height: 68px;
      justify-content: flex-start;
      padding: 0.65rem 0.95rem;
      border-radius: 8px;
      background: rgb(255 255 255 / 12%);
      overflow: visible;
    }

    :deep(.calendar-today-info .today-icon) {
      flex-basis: 46px;
      width: 46px;
      height: 46px;
    }

    :deep(.calendar-today-info .today-copy) {
      flex: 1;
      min-width: 0;
      line-height: 1.35;
    }

    :deep(.calendar-today-info .title),
    :deep(.calendar-today-info .meta) {
      max-width: none;
      white-space: normal;
      overflow: visible;
      text-overflow: clip;
    }

    :deep(.calendar-today-info .title) {
      font-size: 1.16rem;
      font-weight: 800;
    }

    :deep(.calendar-today-info .meta) {
      margin-top: 4px;
      font-size: 0.92rem;
    }
  }

  .week-row,
  .date-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }

  .week-row {
    overflow: hidden;
    border-radius: 8px 8px 0 0;
    background: rgb(230 255 246 / 12%);

    span {
      min-height: 38px;
      display: grid;
      place-items: center;
      text-align: center;
      color: rgb(255 255 255 / 78%);
      font-size: 0.95rem;
      font-weight: 700;
    }
  }

  .date-grid {
    overflow: hidden;
    border-radius: 0 0 8px 8px;
  }

  .day-cell {
    position: relative;
    min-height: 58px;
    aspect-ratio: 1.26;
    min-width: 0;
    border: 0;
    border-right: 1px solid rgb(255 255 255 / 8%);
    border-bottom: 1px solid rgb(255 255 255 / 8%);
    border-radius: 0;
    color: #fff;
    background: rgb(255 255 255 / 7%);
    transition:
      transform 0.2s,
      background-color 0.2s;

    &:hover {
      z-index: 1;
      transform: translateY(-1px) scale(1.02);
      background: rgb(255 255 255 / 18%);
    }

    &.muted {
      opacity: 0.36;
    }

    &.weekend:not(.muted) {
      background: rgb(255 255 255 / 12%);
    }

    &.today {
      color: #153736;
      background: rgb(238 255 249 / 92%);
      box-shadow:
        0 0 0 1px rgb(255 255 255 / 54%),
        0 10px 24px rgb(238 255 249 / 18%);

      .date-number {
        font-weight: 800;
      }

      small {
        color: rgb(21 55 54 / 66%);
      }
    }

    &.hasTodo:not(.today) {
      background: rgb(73 169 143 / 28%);
    }
  }

  .date-number {
    position: absolute;
    top: 0.48rem;
    left: 0.58rem;
    font-size: 1.28rem;
    line-height: 1;
  }

  small {
    position: absolute;
    top: 0.58rem;
    right: 0.58rem;
    color: rgb(255 255 255 / 56%);
    font-size: 0.7rem;
    font-weight: 700;
  }

  .todo-dot {
    position: absolute;
    left: 0.52rem;
    right: 0.52rem;
    bottom: 0.44rem;
    min-height: 18px;
    padding: 0 0.35rem;
    display: grid;
    place-items: center;
    border-radius: 999px;
    color: #153736;
    background: rgb(238 255 249 / 92%);
    font-size: 0.68rem;
    font-weight: 800;
    line-height: 1;
  }

  .calendar-foot {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 0.95rem;
    color: rgb(255 255 255 / 76%);
    font-size: 0.9rem;
    font-weight: 700;
  }

  @media (max-width: 1200px) {
    width: min(94%, 540px);

    .clock-hero {
      grid-template-columns: 1fr;
      gap: 0.65rem;

      .clock-time {
        font-size: clamp(2.8rem, 6vw, 4.2rem);
      }
    }

    .day-cell {
      min-height: 52px;
    }
  }

  @media (max-width: 720px) {
    width: min(92vw, 440px);
    margin: 20vh auto 1rem;
    padding: 0.85rem;

    .clock-hero {
      padding: 0.85rem;
    }
  }

  @media (max-width: 460px) {
    .clock-hero {
      .clock-date {
        font-size: 0.86rem;
      }

      .clock-time {
        font-size: 2.45rem;
      }

      :deep(.calendar-today-info) {
        min-height: 58px;
        padding: 0.55rem 0.7rem;
      }

      :deep(.calendar-today-info .today-icon) {
        flex-basis: 36px;
        width: 36px;
        height: 36px;
      }

      :deep(.calendar-today-info .title) {
        font-size: 0.98rem;
      }

      :deep(.calendar-today-info .meta) {
        font-size: 0.78rem;
      }
    }
    .day-cell {
      min-height: 44px;
    }

    .date-number {
      top: 0.36rem;
      left: 0.42rem;
      font-size: 1rem;
    }

    small {
      display: none;
    }

    .todo-dot {
      left: 0.3rem;
      right: 0.3rem;
      bottom: 0.3rem;
      font-size: 0.58rem;
    }

    .calendar-foot {
      flex-direction: column;
      gap: 0.25rem;
    }
  }
}
</style>
