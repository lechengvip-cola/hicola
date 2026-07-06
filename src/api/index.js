import fetchJsonp from "fetch-jsonp";

export const getPlayerList = async (server, type, id) => {
  const res = await fetch(
    `${import.meta.env.VITE_SONG_API}?server=${server}&type=${type}&id=${id}`,
  );
  const data = await res.json();

  if (data[0].url.startsWith("@")) {
    // eslint-disable-next-line no-unused-vars
    const [handle, jsonpCallback, jsonpCallbackFunction, url] = data[0].url.split("@").slice(1);
    const jsonpData = await fetchJsonp(url).then((res) => res.json());
    const domain = (
      jsonpData.req_0.data.sip.find((i) => !i.startsWith("http://ws")) ||
      jsonpData.req_0.data.sip[0]
    ).replace("http://", "https://");

    return data.map((v, i) => ({
      name: v.name || v.title,
      artist: v.artist || v.author,
      url: domain + jsonpData.req_0.data.midurlinfo[i].purl,
      cover: v.cover || v.pic,
      lrc: v.lrc,
    }));
  }

  return data.map((v) => ({
    name: v.name || v.title,
    artist: v.artist || v.author,
    url: v.url,
    cover: v.cover || v.pic,
    lrc: v.lrc,
  }));
};

export const getHitokoto = async () => {
  const res = await fetch("https://v1.hitokoto.cn");
  return await res.json();
};

export const getAdcode = async (key) => {
  const res = await fetch(`https://restapi.amap.com/v3/ip?key=${key}`);
  return await res.json();
};

export const getWeather = async (key, city) => {
  const res = await fetch(
    `https://restapi.amap.com/v3/weather/weatherInfo?key=${key}&city=${city}`,
  );
  return await res.json();
};

const timeout = (ms) =>
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error("request timeout")), ms);
  });

const normalizeIpwho = (data) => ({
  ok: data.success !== false,
  source: "ipwho.is",
  cityName: data.city || data.region || data.country || "当前位置",
  latitude: data.latitude,
  longitude: data.longitude,
});

export const getIpLocation = async () => {
  try {
    const res = await Promise.race([fetch("https://ipwho.is/?lang=zh-CN"), timeout(1800)]);
    if (res.ok) return normalizeIpwho(await res.json());
  } catch (error) {
    console.warn("浏览器直连 IP 定位不可用，切换站内定位", error);
  }

  const res = await fetch("/api/ip-location");
  if (!res.ok) throw new Error("IP 定位不可用");
  return await res.json();
};

const windMap = {
  N: "北风",
  NNE: "东北偏北风",
  NE: "东北风",
  ENE: "东北偏东风",
  E: "东风",
  ESE: "东南偏东风",
  SE: "东南风",
  SSE: "东南偏南风",
  S: "南风",
  SSW: "西南偏南风",
  SW: "西南风",
  WSW: "西南偏西风",
  W: "西风",
  WNW: "西北偏西风",
  NW: "西北风",
  NNW: "西北偏北风",
};

const weatherCodeMap = {
  113: { text: "晴", kind: "sunny", openMeteo: 0 },
  116: { text: "多云", kind: "cloudy", openMeteo: 2 },
  119: { text: "阴天", kind: "cloudy", openMeteo: 3 },
  122: { text: "阴天", kind: "cloudy", openMeteo: 3 },
  143: { text: "有雾", kind: "foggy", openMeteo: 45 },
  176: { text: "小雨", kind: "rainy", openMeteo: 61 },
  200: { text: "雷雨", kind: "stormy", openMeteo: 95 },
  263: { text: "小雨", kind: "rainy", openMeteo: 61 },
  266: { text: "小雨", kind: "rainy", openMeteo: 61 },
  296: { text: "小雨", kind: "rainy", openMeteo: 61 },
  302: { text: "中雨", kind: "rainy", openMeteo: 63 },
  308: { text: "大雨", kind: "rainy", openMeteo: 65 },
  353: { text: "阵雨", kind: "rainy", openMeteo: 80 },
  356: { text: "强阵雨", kind: "rainy", openMeteo: 81 },
  359: { text: "暴雨", kind: "rainy", openMeteo: 82 },
  386: { text: "雷雨", kind: "stormy", openMeteo: 95 },
  389: { text: "雷雨", kind: "stormy", openMeteo: 95 },
};

const normalizeWttrWeather = (data) => {
  const current = data.current_condition?.[0];
  if (!current) return { ok: false };
  const mapped = weatherCodeMap[Number(current.weatherCode)] || {
    text: "天气",
    kind: "cloudy",
    openMeteo: 2,
  };
  return {
    ok: true,
    source: "wttr.in-browser",
    current: {
      temperature_2m: Number(current.temp_C),
      weather_code: mapped.openMeteo,
      weather_text: mapped.text,
      weather_kind: mapped.kind,
      wind_direction_label: windMap[current.winddir16Point] || current.winddir16Point || "",
      wind_speed_10m: Number(current.windspeedKmph),
    },
  };
};

export const getOpenMeteoWeather = async (latitude, longitude) => {
  try {
    const res = await fetch(`/api/weather?latitude=${latitude}&longitude=${longitude}`);
    if (res.ok) {
      const data = await res.json();
      if (data.ok) return data;
    }
  } catch (error) {
    console.warn("本地天气代理不可用，切换浏览器兜底天气", error);
  }

  const res = await fetch(`https://wttr.in/${latitude},${longitude}?format=j1&lang=zh`);
  return normalizeWttrWeather(await res.json());
};
