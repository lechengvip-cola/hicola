<template>
  <div :class="store.mobileFuncState ? 'function mobile' : 'function'">
    <el-row :gutter="20">
      <el-col :span="24">
        <div class="left">
          <Hitokoto />
          <Music v-if="playerHasId" />
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { mainStore } from "@/store";
import Music from "@/components/Music.vue";
import Hitokoto from "@/components/Hitokoto.vue";

const store = mainStore();
const playerHasId = import.meta.env.VITE_SONG_ID;
</script>

<style lang="scss" scoped>
.function {
  height: 188px;
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

      @media (max-width: 910px) {
        padding: 0 !important;
        flex: none;
        max-width: none;
        width: 100%;
      }
    }

    .left {
      width: 100%;
      height: 100%;
    }

    .left {
      display: flex;
      gap: 20px;
      align-items: center;
      justify-content: stretch;
      animation: fade 0.5s;

      :deep(.hitokoto),
      :deep(.music) {
        flex: 1 1 0;
      }
    }
  }
}

@media (max-width: 910px) {
  .function {
    height: 180px;

    .el-row .left {
      gap: 12px;
    }
  }
}
</style>
