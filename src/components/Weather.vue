<template>
  <div class="weather" v-if="weatherText">
    <span>{{ weatherText }}</span>
  </div>
  <div class="weather" v-else>
    <span>天气加载中</span>
  </div>
</template>

<script setup>
import { getAdcode, getIpLocation, getOpenMeteoWeather, getWeather } from "@/api";

const mainKey = import.meta.env.VITE_WEATHER_KEY;
const weatherText = ref("");

const weatherMap = {
  0: "晴",
  1: "晴间多云",
  2: "多云",
  3: "阴",
  45: "雾",
  48: "霜雾",
  51: "小毛毛雨",
  53: "毛毛雨",
  55: "大毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  80: "阵雨",
  81: "强阵雨",
  82: "暴雨",
  95: "雷雨",
};

const windDirection = (degree) => {
  if (degree == null) return "";
  const dirs = ["北风", "东北风", "东风", "东南风", "南风", "西南风", "西风", "西北风"];
  return dirs[Math.round(Number(degree) / 45) % 8];
};

const setOpenMeteoWeather = async () => {
  const location = await getIpLocation();
  if (location.success === false || !location.latitude || !location.longitude) {
    throw new Error("IP 定位失败");
  }
  const result = await getOpenMeteoWeather(location.latitude, location.longitude);
  const current = result.current;
  if (!current) throw new Error("天气数据为空");
  const city = location.city || location.region || "当前位置";
  const weather = weatherMap[current.weather_code] || "天气";
  const temp = Math.round(current.temperature_2m);
  const wind = windDirection(current.wind_direction_10m);
  const speed = Math.round(current.wind_speed_10m);
  weatherText.value = `${city} ${weather} ${temp}℃ ${wind} ${speed}km/h`;
};

const setAmapWeather = async () => {
  const adCode = await getAdcode(mainKey);
  if (adCode.infocode !== "10000") throw new Error("地区查询失败");
  const result = await getWeather(mainKey, adCode.adcode);
  const live = result.lives?.[0];
  if (!live) throw new Error("天气数据为空");
  const wind = live.winddirection?.endsWith("风") ? live.winddirection : `${live.winddirection}风`;
  weatherText.value = `${adCode.city} ${live.weather} ${live.temperature}℃ ${wind} ${live.windpower}级`;
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
    weatherText.value = "天气暂不可用";
  }
};

onMounted(() => {
  getWeatherData();
});
</script>
