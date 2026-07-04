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
const now = ref(new Date());
let timer = null;

const hourDeg = computed(() => {
  const hours = now.value.getHours() % 12;
  const minutes = now.value.getMinutes();
  return hours * 30 + minutes * 0.5;
});

const minuteDeg = computed(() => {
  const minutes = now.value.getMinutes();
  const seconds = now.value.getSeconds();
  return minutes * 6 + seconds * 0.1;
});

const secondDeg = computed(() => now.value.getSeconds() * 6);

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = new Date();
  }, 1000);
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
  transition: transform 0.24s ease-out;
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
