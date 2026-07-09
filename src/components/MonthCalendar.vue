<template>
  <section class="month-calendar cards">
    <header class="calendar-head">
      <div>
        <p class="eyebrow">本月安排</p>
        <h2>{{ currentYear }} 年 {{ currentMonthText }} 月</h2>
      </div>
      <div class="today-pill">
        <strong>{{ todayDate }}</strong>
        <span>{{ todayWeekday }}</span>
      </div>
    </header>

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
        <span v-if="day.todoCount" class="todo-dot">{{ day.todoCount }}</span>
      </button>
    </div>

    <footer class="calendar-foot">
      <span>今日待完成 {{ todayTodoCount }} 项</span>
      <span>本月待办 {{ monthTodoCount }} 项</span>
    </footer>
  </section>
</template>

<script setup>
const weeks = ["一", "二", "三", "四", "五", "六", "日"];
const now = ref(new Date());
const studyItems = ref([]);

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
  window.addEventListener("storage", refreshStudyItems);
  window.addEventListener("focus", refreshStudyItems);
});

onBeforeUnmount(() => {
  window.removeEventListener("storage", refreshStudyItems);
  window.removeEventListener("focus", refreshStudyItems);
});
</script>

<style lang="scss" scoped>
.month-calendar {
  width: min(76%, 520px);
  margin-top: 11.5rem;
  margin-left: auto;
  margin-right: clamp(18px, 4vw, 70px);
  padding: 1rem;
  background-color: #00000024;
  backdrop-filter: blur(12px);
  animation: fade 0.5s;

  .calendar-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.85rem;

    .eyebrow {
      margin-bottom: 0.25rem;
      color: rgb(255 255 255 / 62%);
      font-size: 0.78rem;
    }

    h2 {
      font-size: 1.25rem;
      line-height: 1.2;
    }
  }

  .today-pill {
    min-width: 70px;
    padding: 0.5rem 0.65rem;
    border-radius: 8px;
    text-align: center;
    background: rgb(255 255 255 / 14%);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 12%);

    strong,
    span {
      display: block;
    }

    strong {
      font-size: 1.35rem;
      line-height: 1;
    }

    span {
      margin-top: 0.25rem;
      color: rgb(255 255 255 / 70%);
      font-size: 0.72rem;
    }
  }

  .week-row,
  .date-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 0.35rem;
  }

  .week-row {
    margin-bottom: 0.45rem;

    span {
      text-align: center;
      color: rgb(255 255 255 / 58%);
      font-size: 0.74rem;
    }
  }

  .day-cell {
    position: relative;
    aspect-ratio: 1;
    min-width: 0;
    border: 0;
    border-radius: 7px;
    color: #fff;
    background: rgb(255 255 255 / 8%);
    transition:
      transform 0.2s,
      background-color 0.2s;

    &:hover {
      transform: translateY(-1px);
      background: rgb(255 255 255 / 16%);
    }

    &.muted {
      opacity: 0.34;
    }

    &.weekend:not(.muted) {
      background: rgb(255 255 255 / 12%);
    }

    &.today {
      color: #153736;
      background: rgb(238 255 249 / 92%);
      box-shadow: 0 8px 22px rgb(255 255 255 / 14%);

      .date-number {
        font-weight: 800;
      }
    }

    &.hasTodo:not(.today) {
      background: rgb(73 169 143 / 28%);
    }
  }

  .date-number {
    font-size: 0.94rem;
  }

  .todo-dot {
    position: absolute;
    right: 4px;
    bottom: 4px;
    min-width: 15px;
    height: 15px;
    padding: 0 4px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    color: #153736;
    background: rgb(238 255 249 / 92%);
    font-size: 0.62rem;
    font-weight: 800;
    line-height: 1;
  }

  .calendar-foot {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 0.85rem;
    color: rgb(255 255 255 / 70%);
    font-size: 0.78rem;
  }

  @media (max-width: 1200px) {
    width: min(86%, 500px);
  }

  @media (max-width: 720px) {
    width: min(92vw, 440px);
    margin: 20vh auto 1rem;
    padding: 0.85rem;

    .calendar-head h2 {
      font-size: 1.15rem;
    }
  }

  @media (max-width: 460px) {
    .week-row,
    .date-grid {
      gap: 0.25rem;
    }

    .date-number {
      font-size: 0.82rem;
    }

    .calendar-foot {
      flex-direction: column;
      gap: 0.25rem;
    }
  }
}
</style>
