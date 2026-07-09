<template>
  <div class="box cards" @mouseenter="closeShow = true" @mouseleave="closeShow = false">
    <transition name="el-fade-in-linear">
      <close-one
        class="close"
        theme="filled"
        size="28"
        fill="#ffffff60"
        v-show="closeShow"
        @click="store.boxOpenState = false"
      />
    </transition>
    <transition name="el-fade-in-linear">
      <setting-two
        class="setting"
        theme="filled"
        size="28"
        fill="#ffffff60"
        v-show="closeShow"
        @click="store.setOpenState = true"
      />
    </transition>
    <div class="content">
      <div class="box-title">
        <span>成长刻度</span>
        <small>把每一天的进度安静收好</small>
      </div>
      <TimeCapsule />
    </div>
  </div>
</template>

<script setup>
import { CloseOne, SettingTwo } from "@icon-park/vue-next";
import { mainStore } from "@/store";
import TimeCapsule from "@/components/TimeCapsule.vue";

const store = mainStore();
const closeShow = ref(false);
</script>

<style lang="scss" scoped>
.box {
  flex: 1 0 0%;
  margin-left: 0.75rem;
  min-height: 0;
  height: auto;
  max-height: min(82vh, 760px);
  max-width: min(50%, 780px);
  position: relative;
  animation: fade 0.5s;
  overflow: hidden;

  &:hover {
    transform: scale(1);
  }

  .close,
  .setting {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 28px;
    height: 28px;
    transition:
      transform 0.3s,
      opacity 0.3s;

    &:hover {
      transform: scale(1.2);
    }

    &:active {
      transform: scale(1);
    }
  }

  .setting {
    right: 56px;
  }

  .content {
    display: flex;
    flex-direction: column;
    padding: clamp(32px, 4vw, 46px);
    width: 100%;
    height: 100%;
    max-height: min(82vh, 760px);
    overflow-y: auto;
  }

  .box-title {
    margin-bottom: 1.7rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;

    span {
      font-size: clamp(1.65rem, 2.1vw, 2rem);
      font-weight: 700;
      line-height: 1.15;
    }

    small {
      color: rgb(255 255 255 / 68%);
      font-size: 1rem;
    }
  }

  @media (max-width: 720px) {
    max-width: 100%;
    margin-left: 0;

    .content {
      padding: 28px;
    }
  }
}
</style>
