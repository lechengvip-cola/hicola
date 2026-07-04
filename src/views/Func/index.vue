<template>
  <div :class="store.mobileFuncState ? 'function mobile' : 'function'">
    <el-row :gutter="20">
      <el-col :span="12">
        <div class="left">
          <Hitokoto />
          <Music v-if="playerHasId && !isMobile" />
        </div>
      </el-col>
      <el-col :span="12">
        <div class="right cards">
          <div class="time">
            <div class="date">
              <span>{{ currentTime.year }} 年 </span>
              <span>{{ currentTime.month }} 月 </span>
              <span>{{ currentTime.day }} 日 </span>
              <span class="sm-hidden">{{ currentTime.weekday }}</span>
            </div>
            <div class="text">
              <span>{{ currentTime.hour }}:{{ currentTime.minute }}:{{ currentTime.second }}</span>
            </div>
          </div>
          <Weather />
          <div class="mobile-music">
            <Music v-if="playerHasId && isMobile" />
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { getCurrentTime } from "@/utils/getTime";
import { mainStore } from "@/store";
import Music from "@/components/Music.vue";
import Hitokoto from "@/components/Hitokoto.vue";
import Weather from "@/components/Weather.vue";

const store = mainStore();
const currentTime = ref({});
const timeInterval = ref(null);
const playerHasId = import.meta.env.VITE_SONG_ID;
const isMobile = computed(() => store.getInnerWidth <= 910);

const updateTimeData = () => {
  currentTime.value = getCurrentTime();
};

onMounted(() => {
  updateTimeData();
  timeInterval.value = setInterval(updateTimeData, 1000);
});

onBeforeUnmount(() => {
  clearInterval(timeInterval.value);
});
</script>

<style lang="scss" scoped>
.function {
  height: 165px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  &.mobile {
    .el-row {
      .el-col {
        &:nth-of-type(1) {
          display: contents;
        }

        &:nth-of-type(2) {
          display: none;
        }
      }
    }
  }

  .el-row {
    height: 100%;
    width: 100%;
    margin: 0 !important;

    .el-col {
      &:nth-of-type(1) {
        padding-left: 0 !important;
      }

      &:nth-of-type(2) {
        padding-right: 0 !important;
      }

      @media (max-width: 910px) {
        &:nth-of-type(1) {
          display: none;
        }

        &:nth-of-type(2) {
          padding: 0 !important;
          flex: none;
          max-width: none;
          width: 100%;
        }
      }
    }

    .left,
    .right {
      width: 100%;
      height: 100%;
    }

    .right {
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      animation: fade 0.5s;

      .time {
        font-size: 1.1rem;
        text-align: center;

        .date {
          text-overflow: ellipsis;
          overflow-x: hidden;
          white-space: nowrap;
        }

        .text {
          margin-top: 10px;
          font-size: 3.25rem;
          letter-spacing: 2px;
          font-family: "UnidreamLED";
        }

        @media (min-width: 1201px) and (max-width: 1280px) {
          font-size: 1rem;
        }

        @media (min-width: 911px) and (max-width: 992px) {
          font-size: 1rem;

          .text {
            font-size: 2.75rem;
          }
        }
      }

      .mobile-music {
        display: none;
        width: 100%;
      }
    }
  }
}

@media (max-width: 910px) {
  .function {
    height: 250px;

    .el-row .right {
      gap: 10px;
      padding: 16px;

      .time {
        .text {
          margin-top: 6px;
          font-size: 2.55rem;
        }
      }

      .mobile-music {
        display: block;
        height: 92px;
      }
    }
  }
}
</style>
