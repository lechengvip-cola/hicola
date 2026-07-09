<template>
  <div :class="store.mobileOpenState ? 'right' : 'right hidden'">
    <!-- 移动端 Logo -->
    <div class="logo text-hidden" @click="store.mobileFuncState = !store.mobileFuncState">
      <span class="bg">{{ siteUrl[0] }}</span>
      <span class="sm">.{{ siteUrl[1] }}</span>
    </div>
    <div class="tagline cards">
      <Icon size="16" class="quote">
        <QuoteLeft />
      </Icon>
      <div class="tagline-text">
        <p>{{ descriptionText.hello }}</p>
        <p>{{ descriptionText.text }}</p>
      </div>
      <button class="capsule-entry" type="button" @click="store.boxOpenState = true">
        <HourglassFull theme="filled" size="16" fill="#fff" />
        <span>时光胶囊</span>
      </button>
      <Icon size="16" class="quote end">
        <QuoteRight />
      </Icon>
    </div>
    <!-- 功能区 -->
    <Func />
    <!-- 网站链接 -->
    <Link />
  </div>
</template>

<script setup>
import { mainStore } from "@/store";
import { Icon } from "@vicons/utils";
import { QuoteLeft, QuoteRight } from "@vicons/fa";
import { HourglassFull } from "@icon-park/vue-next";
import Func from "@/views/Func/index.vue";
import Link from "@/components/Links.vue";
const store = mainStore();
const descriptionText = {
  hello: import.meta.env.VITE_DESC_HELLO,
  text: import.meta.env.VITE_DESC_TEXT,
};

// 站点链接
const siteUrl = computed(() => {
  const url = import.meta.env.VITE_SITE_URL;
  if (!url) return "imsyy.top".split(".");
  // 判断协议前缀
  if (url.startsWith("http://") || url.startsWith("https://")) {
    const urlFormat = url.replace(/^(https?:\/\/)/, "");
    return urlFormat.split(".");
  }
  return url.split(".");
});
</script>

<style lang="scss" scoped>
.right {
  // flex: 1 0 0%;
  width: 50%;
  margin-left: 0.75rem;

  .tagline {
    min-height: 84px;
    margin-bottom: 1.25rem;
    padding: 0.85rem 1.25rem;
    display: flex;
    align-items: center;
    gap: 0.9rem;
    background-color: #00000022;
    backdrop-filter: blur(12px);
    animation: fade 0.5s;

    .quote {
      flex: 0 0 auto;
      opacity: 0.92;
    }

    .end {
      align-self: flex-end;
    }

    .tagline-text {
      min-width: 0;
      flex: 1;
      line-height: 1.65;
      font-family: "HarmonyOS_Regular", sans-serif;

      p {
        font-size: 0.92rem;
      }
    }

    .capsule-entry {
      flex: 0 0 auto;
      height: 34px;
      padding: 0 12px;
      border: 0;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #fff;
      font-family: "HarmonyOS_Regular", sans-serif;
      font-size: 0.86rem;
      background: rgb(255 255 255 / 15%);
      cursor: pointer;
      transition:
        transform 0.2s,
        background 0.2s;

      &:hover {
        transform: translateY(-1px);
        background: rgb(255 255 255 / 24%);
      }

      &:active {
        transform: scale(0.97);
      }
    }
  }

  .logo {
    width: 100%;
    font-family: "Pacifico-Regular";
    font-size: 2.25rem;
    position: fixed;
    top: 6%;
    left: 0;
    text-align: center;
    transition: transform 0.3s;
    animation: fade 0.5s;
    &:active {
      transform: scale(0.95);
    }
    @media (min-width: 721px) {
      display: none;
    }
    @media (max-height: 720px) {
      width: calc(100% + 6px);
      top: 43.26px; // 721px * 0.06
    }
    @media (max-width: 390px) {
        width: 391px;
    }
  }
  @media (max-width: 720px) {
    margin-left: 0;
    width: 100%;

    .tagline {
      display: none;
    }

    &.hidden {
      display: none;
    }
  }
}
</style>
