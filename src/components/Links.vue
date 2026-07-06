<template>
  <div v-if="siteLinks[0]" class="links">
    <Swiper
      v-if="siteLinks[0]"
      :modules="[Pagination, Mousewheel]"
      :slides-per-view="1"
      :space-between="40"
      :pagination="{
        el: '.swiper-pagination',
        clickable: true,
        bulletElement: 'div',
      }"
      :mousewheel="true"
    >
      <SwiperSlide v-for="site in siteLinksList" :key="site">
        <el-row class="link-all" :gutter="20">
          <el-col v-for="(item, index) in site" :key="item.name" :span="8">
            <div
              class="item cards"
              :style="index < 3 ? 'margin-bottom: 20px' : null"
              @click="jumpLink(item)"
            >
              <Icon size="26">
                <component :is="siteIcon[item.icon]" />
              </Icon>
              <span class="content">
                <span class="name text-hidden">{{ item.name }}</span>
                <span class="desc text-hidden">{{ item.description }}</span>
              </span>
            </div>
          </el-col>
        </el-row>
      </SwiperSlide>
      <div class="swiper-pagination" />
    </Swiper>
  </div>
</template>

<script setup>
import { Icon } from "@vicons/utils";
import { Blog, CompactDisc, Cloud, Compass, Book, Fire, LaptopCode } from "@vicons/fa";
import { mainStore } from "@/store";
import { Swiper, SwiperSlide } from "swiper/vue";
import { Pagination, Mousewheel } from "swiper/modules";
import siteLinks from "@/assets/siteLinks.json";

const store = mainStore();

const siteLinksList = computed(() => {
  const result = [];
  for (let i = 0; i < siteLinks.length; i += 6) {
    result.push(siteLinks.slice(i, i + 6));
  }
  return result;
});

const siteIcon = {
  Blog,
  Cloud,
  CompactDisc,
  Compass,
  Book,
  Fire,
  LaptopCode,
};

const jumpLink = (data) => {
  // TODO: 后续替换为百度网盘链接。
  if (data.name === "音乐" && store.musicClick) {
    if (typeof $openList === "function") $openList();
  } else {
    window.open(data.link, "_blank");
  }
};
</script>

<style lang="scss" scoped>
.links {
  margin-top: 2rem;

  .swiper {
    left: -10px;
    width: calc(100% + 20px);
    padding: 5px 10px 0;
    z-index: 0;

    .swiper-slide {
      height: 100%;
    }

    .swiper-pagination {
      margin-top: 12px;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;

      :deep(.swiper-pagination-bullet) {
        background-color: #fff;
        width: 20px;
        height: 4px;
        margin: 0 4px;
        border-radius: 4px;
        opacity: 0.2;
        transition: opacity 0.3s;

        &.swiper-pagination-bullet-active {
          opacity: 1;
        }

        &:hover {
          opacity: 1;
        }
      }
    }
  }

  .link-all {
    height: 220px;

    .item {
      height: 100px;
      width: 100%;
      display: flex;
      align-items: center;
      flex-direction: row;
      justify-content: center;
      padding: 0 10px;
      animation: fade 0.5s;

      &:hover {
        transform: scale(1.02);
        background: rgb(0 0 0 / 40%);
        transition: 0.3s;
      }

      &:active {
        transform: scale(1);
      }

      .content {
        min-width: 0;
        margin-left: 8px;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        line-height: 1.35;
      }

      .name {
        font-size: 1.05rem;
      }

      .desc {
        max-width: 100%;
        margin-top: 4px;
        font-size: 0.78rem;
        opacity: 0.78;
      }

      @media (min-width: 720px) and (max-width: 820px) {
        .content {
          display: none;
        }
      }

      @media (max-width: 720px) {
        height: 80px;
      }

      @media (max-width: 460px) {
        flex-direction: column;

        .content {
          margin-left: 0;
          margin-top: 8px;
          align-items: center;
        }

        .name {
          font-size: 1rem;
        }

        .desc {
          font-size: 0.72rem;
          max-width: 90px;
        }
      }
    }

    @media (max-width: 720px) {
      height: 180px;
    }
  }
}
</style>
