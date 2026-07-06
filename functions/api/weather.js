const weatherCodeMap = {
  113: { text: "晴", kind: "sunny", openMeteo: 0 },
  116: { text: "多云", kind: "cloudy", openMeteo: 2 },
  119: { text: "阴天", kind: "cloudy", openMeteo: 3 },
  122: { text: "阴天", kind: "cloudy", openMeteo: 3 },
  143: { text: "有雾", kind: "foggy", openMeteo: 45 },
  176: { text: "小雨", kind: "rainy", openMeteo: 61 },
  179: { text: "小雪", kind: "snowy", openMeteo: 71 },
  182: { text: "雨夹雪", kind: "snowy", openMeteo: 73 },
  185: { text: "冻雨", kind: "rainy", openMeteo: 61 },
  200: { text: "雷雨", kind: "stormy", openMeteo: 95 },
  227: { text: "小雪", kind: "snowy", openMeteo: 71 },
  230: { text: "大雪", kind: "snowy", openMeteo: 75 },
  248: { text: "有雾", kind: "foggy", openMeteo: 45 },
  260: { text: "有雾", kind: "foggy", openMeteo: 45 },
  263: { text: "小雨", kind: "rainy", openMeteo: 61 },
  266: { text: "小雨", kind: "rainy", openMeteo: 61 },
  281: { text: "冻雨", kind: "rainy", openMeteo: 61 },
  284: { text: "冻雨", kind: "rainy", openMeteo: 61 },
  293: { text: "小雨", kind: "rainy", openMeteo: 61 },
  296: { text: "小雨", kind: "rainy", openMeteo: 61 },
  299: { text: "中雨", kind: "rainy", openMeteo: 63 },
  302: { text: "中雨", kind: "rainy", openMeteo: 63 },
  305: { text: "大雨", kind: "rainy", openMeteo: 65 },
  308: { text: "大雨", kind: "rainy", openMeteo: 65 },
  311: { text: "冻雨", kind: "rainy", openMeteo: 61 },
  314: { text: "冻雨", kind: "rainy", openMeteo: 61 },
  317: { text: "雨夹雪", kind: "snowy", openMeteo: 73 },
  320: { text: "小雪", kind: "snowy", openMeteo: 71 },
  323: { text: "小雪", kind: "snowy", openMeteo: 71 },
  326: { text: "小雪", kind: "snowy", openMeteo: 71 },
  329: { text: "中雪", kind: "snowy", openMeteo: 73 },
  332: { text: "中雪", kind: "snowy", openMeteo: 73 },
  335: { text: "大雪", kind: "snowy", openMeteo: 75 },
  338: { text: "大雪", kind: "snowy", openMeteo: 75 },
  350: { text: "冰粒", kind: "snowy", openMeteo: 73 },
  353: { text: "阵雨", kind: "rainy", openMeteo: 80 },
  356: { text: "强阵雨", kind: "rainy", openMeteo: 81 },
  359: { text: "暴雨", kind: "rainy", openMeteo: 82 },
  362: { text: "雨夹雪", kind: "snowy", openMeteo: 73 },
  365: { text: "雨夹雪", kind: "snowy", openMeteo: 73 },
  368: { text: "小雪", kind: "snowy", openMeteo: 71 },
  371: { text: "大雪", kind: "snowy", openMeteo: 75 },
  386: { text: "雷雨", kind: "stormy", openMeteo: 95 },
  389: { text: "雷雨", kind: "stormy", openMeteo: 95 },
  392: { text: "雷雪", kind: "stormy", openMeteo: 95 },
  395: { text: "大雪", kind: "snowy", openMeteo: 75 },
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

const timeout = (ms) =>
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error("weather timeout")), ms);
  });

const fetchJsonWithTimeout = async (url, ms) => {
  const response = await Promise.race([fetch(url), timeout(ms)]);
  if (!response.ok) throw new Error(`weather upstream ${response.status}`);
  return await response.json();
};

const normalizeOpenMeteo = (data) => {
  const current = data.current || data.current_weather;
  if (!current) throw new Error("empty open-meteo weather");
  return {
    source: "open-meteo",
    current: {
      temperature_2m: current.temperature_2m ?? current.temperature,
      weather_code: current.weather_code ?? current.weathercode,
      wind_direction_10m: current.wind_direction_10m ?? current.winddirection,
      wind_speed_10m: current.wind_speed_10m ?? current.windspeed,
    },
  };
};

const normalizeWttr = (data) => {
  const current = data.current_condition?.[0];
  if (!current) throw new Error("empty wttr weather");
  const code = Number(current.weatherCode);
  const mapped = weatherCodeMap[code] || { text: "天气", kind: "cloudy", openMeteo: 2 };
  return {
    source: "wttr.in",
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

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const latitude = url.searchParams.get("latitude");
  const longitude = url.searchParams.get("longitude");

  if (!latitude || !longitude) {
    return new Response(JSON.stringify({ ok: false, message: "missing latitude or longitude" }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  try {
    const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_direction_10m,wind_speed_10m&timezone=auto`;
    const data = await fetchJsonWithTimeout(openMeteoUrl, 2200);
    return Response.json({ ok: true, ...normalizeOpenMeteo(data) });
  } catch {
    try {
      const wttrUrl = `https://wttr.in/${latitude},${longitude}?format=j1&lang=zh`;
      const data = await fetchJsonWithTimeout(wttrUrl, 4500);
      return Response.json({ ok: true, ...normalizeWttr(data) });
    } catch (error) {
      return Response.json(
        {
          ok: false,
          message: error.message,
        },
        { status: 200 },
      );
    }
  }
}
