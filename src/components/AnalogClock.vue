<template>
  <div class="analog-clock" aria-label="当前时间">
    <div class="dial">
      <span v-for="tick in 12" :key="tick" class="tick" :style="{ '--tick': tick }" />
      <span class="hand hour" :style="{ transform: `rotate(${hourDeg}deg)` }" />
      <span class="hand minute" :style="{ transform: `rotate(${minuteDeg}deg)` }" />
      <span class="hand second" :style="{ transform: `rotate(${secondDeg}deg)` }" />
      <span class="pin" />
    </div>
  </div>
</template>

<script setup>
const elapsedSeconds = ref(0);
let timer = null;
let startTimestamp = 0;
let startSeconds = 0;

const getSecondsSinceMidnight = (date) =>
  date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds() + date.getMilliseconds() / 1000;

const updateElapsedSeconds = () => {
  elapsedSeconds.value = startSeconds + (Date.now() - startTimestamp) / 1000;
};

const hourDeg = computed(() => elapsedSeconds.value / 120);
const minuteDeg = computed(() => elapsedSeconds.value * 0.1);
const secondDeg = computed(() => elapsedSeconds.value * 6);

onMounted(() => {
  const now = new Date();
  startTimestamp = Date.now();
  startSeconds = getSecondsSinceMidnight(now);
  updateElapsedSeconds();
  timer = window.setInterval(updateElapsedSeconds, 500);
});

onBeforeUnmount(() => {
  window.clearInterval(timer);
});
</script>

<style lang="scss" scoped>
.analog-clock {
  flex: 0 0 auto;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  padding: 8px;
  background: linear-gradient(145deg, #ffffff, #d8d8d8);
  box-shadow:
    0 12px 26px #00000045,
    inset 0 0 0 1px #ffffffa0;
}

.dial {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background:
    radial-gradient(circle at 40% 35%, #4f5556 0, #2f3334 48%, #17191a 100%);
  box-shadow:
    inset 0 4px 12px #ffffff24,
    inset 0 -10px 18px #00000075;
}

.tick {
  position: absolute;
  left: calc(50% - 1px);
  top: 7px;
  width: 2px;
  height: 7px;
  border-radius: 2px;
  background: #ffffff85;
  transform-origin: 1px 47px;
  transform: rotate(calc(var(--tick) * 30deg));
}

.hand {
  position: absolute;
  left: calc(50% - 2px);
  bottom: 50%;
  width: 4px;
  border-radius: 999px;
  transform-origin: 50% 100%;
  transition: transform 0.45s linear;
}

.hour {
  height: 28px;
  background: #eef0f1;
  box-shadow: 0 0 5px #00000070;
}

.minute {
  height: 38px;
  background: #f7f7f7;
  box-shadow: 0 0 5px #00000070;
}

.second {
  left: calc(50% - 1px);
  width: 2px;
  height: 43px;
  background: #ef2e33;
  box-shadow: 0 0 6px #ef2e3370;
}

.pin {
  position: absolute;
  left: calc(50% - 4px);
  top: calc(50% - 4px);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 0 0 2px #ef2e33;
}

@media (max-width: 768px) {
  .analog-clock {
    width: 100px;
    height: 100px;
  }

  .tick {
    transform-origin: 1px 39px;
  }

  .hour {
    height: 23px;
  }

  .minute {
    height: 31px;
  }

  .second {
    height: 35px;
  }
}
</style>
