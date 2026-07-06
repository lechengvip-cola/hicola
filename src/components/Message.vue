<template>
  <div class="message">
    <div class="logo">
      <AnalogClock />
      <div :class="{ name: true, 'text-hidden': true, long: siteUrl[0].length >= 6 }">
        <span class="bg">{{ siteUrl[0] }}</span>
        <span class="sm">.{{ siteUrl[1] }}</span>
      </div>
    </div>

    <div class="description cards" @click="changeBox">
      <div class="content">
        <Icon size="16">
          <QuoteLeft />
        </Icon>
        <Transition name="fade" mode="out-in">
          <div :key="descriptionText.hello + descriptionText.text" class="text">
            <p>{{ descriptionText.hello }}</p>
            <p>{{ descriptionText.text }}</p>
          </div>
        </Transition>
        <Icon size="16">
          <QuoteRight />
        </Icon>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Icon } from "@vicons/utils";
import { QuoteLeft, QuoteRight } from "@vicons/fa";
import { Error } from "@icon-park/vue-next";
import { mainStore } from "@/store";
import AnalogClock from "@/components/AnalogClock.vue";

const store = mainStore();

const siteUrl = computed(() => {
  const url = import.meta.env.VITE_SITE_URL;
  if (!url) return "imsyy.top".split(".");
  if (url.startsWith("http://") || url.startsWith("https://")) {
    const urlFormat = url.replace(/^(https?:\/\/)/, "");
    return urlFormat.split(".");
  }
  return url.split(".");
});

const descriptionText = reactive({
  hello: import.meta.env.VITE_DESC_HELLO,
  text: import.meta.env.VITE_DESC_TEXT,
});

const changeBox = () => {
  if (store.getInnerWidth >= 721) {
    store.boxOpenState = !store.boxOpenState;
  } else {
    ElMessage({
      message: "当前页面宽度不足以开启盒子",
      grouping: true,
      icon: h(Error, {
        theme: "filled",
        fill: "#efefef",
      }),
    });
  }
};

watch(
  () => store.boxOpenState,
  (value) => {
    if (value) {
      descriptionText.hello = import.meta.env.VITE_DESC_HELLO_OTHER;
      descriptionText.text = import.meta.env.VITE_DESC_TEXT_OTHER;
    } else {
      descriptionText.hello = import.meta.env.VITE_DESC_HELLO;
      descriptionText.text = import.meta.env.VITE_DESC_TEXT;
    }
  },
);
</script>

<style lang="scss" scoped>
.message {
  .logo {
    display: flex;
    flex-direction: row;
    align-items: center;
    animation: fade 0.5s;
    max-width: 500px;

    .name {
      width: 100%;
      padding-left: 22px;
      transform: translateY(-8px);
      font-family: "Pacifico-Regular", cursive;

      .bg {
        font-size: 5rem;
      }

      .sm {
        margin-left: 6px;
        font-size: 2rem;

        @media (min-width: 721px) and (max-width: 789px) {
          display: none;
        }
      }
    }

    @media (max-width: 768px) {
      .name {
        height: 128px;

        .bg {
          font-size: 4.5rem;
        }
      }
    }

    @media (max-width: 720px) {
      max-width: 100%;
    }
  }

  .description {
    padding: 1rem;
    margin-top: 3.5rem;
    max-width: 460px;
    animation: fade 0.5s;

    .content {
      display: flex;
      justify-content: space-between;
      font-family: "HarmonyOS_Regular", sans-serif;

      .text {
        margin: 0.75rem 1rem;
        line-height: 2rem;
        margin-right: auto;
        transition: opacity 0.2s;
        font-family: "HarmonyOS_Regular", sans-serif;
      }

      .xicon:nth-of-type(2) {
        align-self: flex-end;
      }
    }

    @media (max-width: 720px) {
      max-width: 100%;
      pointer-events: none;
    }
  }
}
</style>
