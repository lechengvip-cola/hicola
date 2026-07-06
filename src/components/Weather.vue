<template>
  <div class="weather-card" :class="weatherClass" :title="locationTip">
    <div class="weather-icon" aria-hidden="true">
      <span class="sun-core" />
      <span class="sun-ray r1" />
      <span class="sun-ray r2" />
      <span class="sun-ray r3" />
      <span class="cloud c1" />
      <span class="cloud c2" />
      <span class="rain d1" />
      <span class="rain d2" />
      <span class="rain d3" />
      <span class="snow s1" />
      <span class="snow s2" />
      <span class="bolt" />
      <span class="fog f1" />
      <span class="fog f2" />
    </div>
    <div class="weather-copy">
      <span class="city">{{ cityText }}</span>
      <span class="meta">{{ detailText }}</span>
    </div>
  </div>
</template>

<script setup>
import { getAdcode, getIpLocation, getOpenMeteoWeather, getWeather } from "@/api";

const mainKey = import.meta.env.VITE_WEATHER_KEY;
const cityText = ref("定位中");
const detailText = ref("天气加载中");
const locationTip = ref("正在获取位置");
const weatherKind = ref("cloudy");

const weatherMap = {
  0: { text: "晴", kind: "sunny" },
  1: { text: "晴间多云", kind: "partly" },
  2: { text: "多云", kind: "cloudy" },
  3: { text: "阴天", kind: "cloudy" },
  45: { text: "有雾", kind: "foggy" },
  48: { text: "雾凇", kind: "foggy" },
  51: { text: "小雨", kind: "rainy" },
  53: { text: "小雨", kind: "rainy" },
  55: { text: "中雨", kind: "rainy" },
  61: { text: "小雨", kind: "rainy" },
  63: { text: "中雨", kind: "rainy" },
  65: { text: "大雨", kind: "rainy" },
  71: { text: "小雪", kind: "snowy" },
  73: { text: "中雪", kind: "snowy" },
  75: { text: "大雪", kind: "snowy" },
  80: { text: "阵雨", kind: "rainy" },
  81: { text: "强阵雨", kind: "rainy" },
  82: { text: "暴雨", kind: "rainy" },
  95: { text: "雷雨", kind: "stormy" },
};

const weatherClass = computed(() => `is-${weatherKind.value}`);

const windDirection = (degree) => {
  if (degree == null) return "";
  const dirs = ["北风", "东北风", "东风", "东南风", "南风", "西南风", "西风", "西北风"];
  return dirs[Math.round(Number(degree) / 45) % 8];
};

const normalizeCity = (city) => {
  if (!city) return "当前位置";
  const value = String(city).trim();
  const cityMap = {
    Chengdu: "成都",
    "Chengdu City": "成都",
    "Hong Kong": "香港",
    HongKong: "香港",
    Guangzhou: "广州",
    Shenzhen: "深圳",
    Beijing: "北京",
    Shanghai: "上海",
    Singapore: "新加坡",
    Tokyo: "东京",
    "Tokyo Metropolis": "东京",
    "东京都": "东京",
  };

  return (cityMap[value] || value).replace(/省|市|自治区|特别行政区|地区|盟$/g, "");
};

const getGeo = async () => {
  const location = await getIpLocation();
  if (!location.latitude || !location.longitude) {
    throw new Error("IP 定位失败");
  }
  return {
    city: normalizeCity(location.cityName),
    latitude: location.latitude,
    longitude: location.longitude,
    source: location.source || "IP 定位",
  };
};

const setOpenMeteoWeather = async () => {
  const geo = await getGeo();
  const result = await getOpenMeteoWeather(geo.latitude, geo.longitude);
  const current = result.current;
  if (!result.ok || !current) throw new Error("天气数据为空");

  const weather = weatherMap[current.weather_code] || { text: "天气", kind: "cloudy" };
  const windText = current.wind_direction_label || windDirection(current.wind_direction_10m);
  weatherKind.value = current.weather_kind || weather.kind;
  cityText.value = geo.city;
  locationTip.value = `${geo.source}，如有偏差可刷新或切换网络后重试`;
  detailText.value = `${current.weather_text || weather.text} ${Math.round(
    current.temperature_2m,
  )}℃${windText ? ` ${windText}` : ""}`;
};

const setAmapWeather = async () => {
  const adCode = await getAdcode(mainKey);
  if (adCode.infocode !== "10000") throw new Error("地区查询失败");
  const result = await getWeather(mainKey, adCode.adcode);
  const live = result.lives?.[0];
  if (!live) throw new Error("天气数据为空");
  const text = live.weather || "天气";
  const kind = text.includes("雨")
    ? "rainy"
    : text.includes("雪")
      ? "snowy"
      : text.includes("雷")
        ? "stormy"
        : text.includes("晴")
          ? "sunny"
          : text.includes("雾")
            ? "foggy"
            : "cloudy";
  const wind = live.winddirection?.endsWith("风") ? live.winddirection : `${live.winddirection}风`;
  weatherKind.value = kind;
  cityText.value = normalizeCity(adCode.city);
  locationTip.value = "高德 IP 定位";
  detailText.value = `${text} ${live.temperature}℃ ${wind}`;
};

const getWeatherData = async () => {
  try {
    if (mainKey) {
      await setAmapWeather();
    } else {
      await setOpenMeteoWeather();
    }
  } catch (error) {
    console.error("天气信息获取失败:", error);
    cityText.value = "当前位置";
    detailText.value = "天气暂不可用";
    locationTip.value = "定位或天气服务暂不可用";
    weatherKind.value = "cloudy";
  }
};

onMounted(() => {
  getWeatherData();
});
</script>

<style lang="scss" scoped>
.weather-card {
  width: 100%;
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 8px;
  color: #efefef;
  text-shadow: 0 0 5px #00000050;
  overflow: hidden;
  font-family: "HarmonyOS_Regular", sans-serif;

  .weather-icon {
    position: relative;
    flex: 0 0 34px;
    width: 34px;
    height: 34px;
    transform: translateZ(0);
  }

  .weather-copy {
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    line-height: 1.25;
    font-family: "HarmonyOS_Regular", sans-serif;
  }

  .city,
  .meta {
    max-width: 190px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: "HarmonyOS_Regular", sans-serif;
  }

  .city {
    font-size: 0.92rem;
    font-weight: 700;
  }

  .meta {
    margin-top: 2px;
    font-size: 0.78rem;
    opacity: 0.9;
  }
}

.sun-core,
.cloud,
.rain,
.snow,
.bolt,
.fog,
.sun-ray {
  position: absolute;
  display: block;
}

.sun-core {
  width: 15px;
  height: 15px;
  left: 4px;
  top: 4px;
  border-radius: 50%;
  background: #ffd86b;
  box-shadow: 0 0 14px #ffd86bcc;
  animation: weather-pulse 2.4s ease-in-out infinite;
}

.sun-ray {
  width: 3px;
  height: 8px;
  left: 10px;
  top: 0;
  border-radius: 3px;
  background: #ffe9a0;
  transform-origin: 1.5px 17px;
  opacity: 0.9;
}

.r2 {
  transform: rotate(55deg);
}

.r3 {
  transform: rotate(110deg);
}

.cloud {
  background: #f5f7ff;
  box-shadow: inset -5px -5px 10px #cfd7e080;
}

.c1 {
  width: 24px;
  height: 12px;
  right: 2px;
  bottom: 7px;
  border-radius: 12px;
  animation: weather-float 3.4s ease-in-out infinite;
}

.c2 {
  width: 14px;
  height: 14px;
  right: 9px;
  bottom: 13px;
  border-radius: 50%;
  animation: weather-float 3.4s ease-in-out infinite;
}

.rain {
  width: 2px;
  height: 8px;
  bottom: 0;
  border-radius: 2px;
  background: #9fd7ff;
  opacity: 0;
  animation: weather-rain 1.1s linear infinite;
}

.d1 {
  left: 13px;
}

.d2 {
  left: 20px;
  animation-delay: 0.18s;
}

.d3 {
  left: 27px;
  animation-delay: 0.36s;
}

.snow {
  width: 4px;
  height: 4px;
  bottom: 2px;
  border-radius: 50%;
  background: #ffffff;
  opacity: 0;
  animation: weather-snow 1.8s ease-in-out infinite;
}

.s1 {
  left: 15px;
}

.s2 {
  left: 25px;
  animation-delay: 0.45s;
}

.bolt {
  left: 18px;
  bottom: 2px;
  width: 8px;
  height: 14px;
  clip-path: polygon(45% 0, 100% 0, 64% 45%, 100% 45%, 30% 100%, 48% 55%, 12% 55%);
  background: #ffe16b;
  opacity: 0;
  animation: weather-flash 1.7s ease-in-out infinite;
}

.fog {
  left: 7px;
  width: 22px;
  height: 2px;
  border-radius: 2px;
  background: #eef2f7cc;
  opacity: 0;
  animation: weather-fog 2.5s ease-in-out infinite;
}

.f1 {
  bottom: 8px;
}

.f2 {
  bottom: 3px;
  animation-delay: 0.4s;
}

.weather-card {
  &.is-sunny {
    .cloud,
    .rain,
    .snow,
    .bolt,
    .fog {
      display: none;
    }
  }

  &.is-partly {
    .rain,
    .snow,
    .bolt,
    .fog {
      display: none;
    }
  }

  &.is-cloudy {
    .sun-core,
    .sun-ray,
    .rain,
    .snow,
    .bolt,
    .fog {
      display: none;
    }
  }

  &.is-rainy {
    .sun-core,
    .sun-ray,
    .snow,
    .bolt,
    .fog {
      display: none;
    }
  }

  &.is-snowy {
    .sun-core,
    .sun-ray,
    .rain,
    .bolt,
    .fog {
      display: none;
    }
  }

  &.is-stormy {
    .sun-core,
    .sun-ray,
    .snow,
    .fog {
      display: none;
    }
  }

  &.is-foggy {
    .sun-core,
    .sun-ray,
    .rain,
    .snow,
    .bolt {
      display: none;
    }
  }
}

@keyframes weather-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.08);
  }
}

@keyframes weather-float {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(2px);
  }
}

@keyframes weather-rain {
  0% {
    opacity: 0;
    transform: translateY(-4px) rotate(12deg);
  }
  35% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(8px) rotate(12deg);
  }
}

@keyframes weather-snow {
  0% {
    opacity: 0;
    transform: translateY(-3px);
  }
  40% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(9px);
  }
}

@keyframes weather-flash {
  0%,
  70%,
  100% {
    opacity: 0;
  }
  75%,
  82% {
    opacity: 1;
  }
}

@keyframes weather-fog {
  0%,
  100% {
    opacity: 0.35;
    transform: translateX(-2px);
  }
  50% {
    opacity: 0.95;
    transform: translateX(3px);
  }
}
</style>
