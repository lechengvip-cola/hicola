<template>
  <div class="time-capsule">
    <div class="title">
      <hourglass-full theme="two-tone" size="24" :fill="['#efefef', '#00000020']" />
      <span>时光胶囊</span>
    </div>
    <div v-if="timeData" class="all-capsule">
      <div v-for="(item, tag, index) in timeData" :key="index" class="capsule-item">
        <div class="item-title">
          <span class="percentage">
            {{ item.name }}已度过
            <strong>{{ item.passed }}</strong>
            {{ tag === "day" ? "小时" : "天" }}
          </span>
          <span class="remaining">
            剩余&nbsp;{{ item.remaining }}&nbsp;{{ tag === "day" ? "小时" : "天" }}
          </span>
        </div>
        <el-progress :text-inside="true" :stroke-width="20" :percentage="parseFloat(item.percentage)" />
      </div>
      <!-- 建站日期 -->
      <div v-if="store.siteStartShow" class="capsule-item start">
        <div class="item-title">{{ startDateText }}</div>
      </div>
      <div class="vacation-group">
        <div v-for="item in vacationData" :key="item.key" class="vacation-card">
          <div class="vacation-info">
            <span class="vacation-name">{{ item.name }}</span>
            <strong>{{ item.main }}</strong>
            <small>{{ item.sub }}</small>
          </div>
          <el-progress
            :text-inside="true"
            :stroke-width="18"
            :percentage="item.percentage"
            :format="() => item.percentText"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { HourglassFull } from "@icon-park/vue-next";
import { getTimeCapsule, siteDateStatistics } from "@/utils/getTime.js";
import { mainStore } from "@/store";
const store = mainStore();

// 进度条数据
const timeData = ref(getTimeCapsule());
const startDate = ref(import.meta.env.VITE_SITE_START);
const startDateText = ref(null);
const timeInterval = ref(null);

const parseDate = (value, endOfDay = false) => {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const dayDiff = (from, to) => Math.max(0, Math.ceil((to - from) / 86400000));

const buildVacationItem = (key, name, startValue, endValue) => {
  const now = new Date();
  const start = parseDate(startValue);
  const end = parseDate(endValue, true);

  if (!start || !end || end < start) {
    return {
      key,
      name,
      main: "日期待设置",
      sub: "请在设置中填写开始和结束日期",
      percentage: 0,
      percentText: "0%",
    };
  }

  const totalDays = Math.max(1, dayDiff(start, end));

  if (now < start) {
    const leftDays = dayDiff(now, start);
    return {
      key,
      name,
      main: `还有 ${leftDays} 天`,
      sub: `${startValue} 开始 · ${endValue} 结束`,
      percentage: 0,
      percentText: "未开始",
    };
  }

  if (now > end) {
    return {
      key,
      name,
      main: "已结束",
      sub: `${startValue} - ${endValue}`,
      percentage: 100,
      percentText: "完成",
    };
  }

  const passedDays = Math.min(totalDays, Math.max(0, Math.floor((now - start) / 86400000) + 1));
  const leftDays = Math.max(0, Math.ceil((end - now) / 86400000));
  const percentage = Math.min(100, Math.max(0, Number(((passedDays / totalDays) * 100).toFixed(1))));

  return {
    key,
    name,
    main: `剩余 ${leftDays} 天`,
    sub: `已过 ${passedDays} 天 · 共 ${totalDays} 天`,
    percentage,
    percentText: `${percentage}%`,
  };
};

const vacationData = computed(() => [
  buildVacationItem("winter", "寒假", store.winterVacationStart, store.winterVacationEnd),
  buildVacationItem("summer", "暑假", store.summerVacationStart, store.summerVacationEnd),
]);

onMounted(() => {
  timeInterval.value = setInterval(() => {
    timeData.value = getTimeCapsule();
    if (startDate.value) startDateText.value = siteDateStatistics(new Date(startDate.value));
  }, 1000);
});

onBeforeUnmount(() => {
  clearInterval(timeInterval.value);
});
</script>

<style lang="scss" scoped>
.time-capsule {
  width: 100%;

  .title {
    display: flex;
    flex-direction: row;
    align-items: center;
    margin: 0.1rem 0 1.35rem;
    font-size: 1.35rem;
    font-weight: 700;

    .i-icon {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-right: 8px;
    }
  }

  .all-capsule {
    .capsule-item {
      margin-bottom: 1.15rem;

      .item-title {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        margin: 0 0 0.55rem;
        font-size: 1.08rem;

        strong {
          font-size: 1.18rem;
        }

        .remaining {
          opacity: 0.68;
          font-size: 0.95rem;
          font-style: oblique;
        }
      }

      &:last-child {
        margin-bottom: 0;
      }

      &.start {
        .item-title {
          justify-content: center;
          opacity: 0.8;
          font-size: 0.95rem;
        }
      }
    }

    .vacation-group {
      margin-top: 1.45rem;
      padding-top: 1.2rem;
      border-top: 1px solid rgb(255 255 255 / 12%);
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;

      .vacation-card {
        padding: 1.05rem;
        border-radius: 6px;
        background: rgb(255 255 255 / 14%);

        .vacation-info {
          margin-bottom: 0.85rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;

          .vacation-name {
            color: rgb(255 255 255 / 76%);
            font-size: 0.96rem;
            font-weight: 700;
          }

          strong {
            font-size: 1.35rem;
            line-height: 1.2;
          }

          small {
            min-height: 2.65em;
            color: rgb(255 255 255 / 68%);
            line-height: 1.4;
            font-size: 0.86rem;
          }
        }
      }

      @media (max-width: 720px) {
        grid-template-columns: 1fr;
      }
    }
  }
}
</style>
