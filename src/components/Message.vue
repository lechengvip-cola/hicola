<template>
  <div class="message">
    <Teleport to="body">
      <div :class="{ brand: true, 'text-hidden': true, long: siteUrl[0].length >= 6 }">
        <span class="bg">{{ siteUrl[0] }}</span>
        <span class="sm">.{{ siteUrl[1] }}</span>
      </div>
      <div class="clock-anchor">
        <AnalogClock />
      </div>
    </Teleport>

    <div class="logo-spacer" />

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
:global(body > .brand) {
  position: fixed;
  left: clamp(28px, 5vw, 72px);
  top: clamp(24px, 5vh, 56px);
  z-index: 2;
  max-width: min(42vw, 360px);
  font-family: "Pacifico-Regular", cursive;
  animation: fade 0.5s;
  text-shadow: 0 8px 22px #00000030;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #fff;
}

:global(body > .brand .bg) {
  font-size: clamp(3rem, 5vw, 4.6rem);
  line-height: 1;
}

:global(body > .brand .sm) {
  margin-left: 6px;
  font-size: clamp(1.25rem, 2vw, 1.75rem);
}

@media (max-width: 720px) {
  :global(body > .brand) {
    position: fixed;
    left: 20px;
    top: 18px;
    max-width: calc(100vw - 40px);
  }

  :global(body > .brand .bg) {
    font-size: 3.2rem;
  }

  :global(body > .brand .sm) {
    font-size: 1.3rem;
  }
}

:global(body > .clock-anchor) {
  position: fixed;
  left: clamp(34px, 5.2vw, 76px);
  top: clamp(118px, 17vh, 150px);
  z-index: 2;
  width: 96px;
  height: 96px;
  animation: fade 0.5s;
}

:global(body > .clock-anchor .analog-clock) {
  width: 96px;
  height: 96px;
  padding: 7px;
}

:global(body > .clock-anchor .tick) {
  transform-origin: 1px 37px;
}

:global(body > .clock-anchor .hour) {
  height: 22px;
}

:global(body > .clock-anchor .minute) {
  height: 30px;
}

:global(body > .clock-anchor .second) {
  height: 34px;
}

@media (max-width: 720px) {
  :global(body > .clock-anchor) {
    left: 22px;
    top: 92px;
    width: 86px;
    height: 86px;
  }

  :global(body > .clock-anchor .analog-clock) {
    width: 86px;
    height: 86px;
  }

  :global(body > .clock-anchor .tick) {
    transform-origin: 1px 33px;
  }
}

.message {
  .brand {
    position: fixed;
    left: clamp(28px, 5vw, 72px);
    top: clamp(24px, 5vh, 56px);
    z-index: 2;
    max-width: min(42vw, 360px);
    font-family: "Pacifico-Regular", cursive;
    animation: fade 0.5s;
    text-shadow: 0 8px 22px #00000030;

    .bg {
      font-size: clamp(3rem, 5vw, 4.6rem);
      line-height: 1;
    }

    .sm {
      margin-left: 6px;
      font-size: clamp(1.25rem, 2vw, 1.75rem);
    }

    @media (max-width: 720px) {
      position: relative;
      left: auto;
      top: auto;
      max-width: 100%;
      margin-bottom: 1.5rem;
      text-align: center;

      .bg {
        font-size: 3.4rem;
      }

      .sm {
        font-size: 1.35rem;
      }
    }
  }

  .logo-spacer {
    height: 120px;

    @media (max-width: 720px) {
      height: 116px;
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
