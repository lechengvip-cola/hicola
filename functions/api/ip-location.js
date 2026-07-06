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

const normalizeCityName = (city) => {
  if (!city) return "";
  const trimmed = String(city).trim();
  return (cityMap[trimmed] || trimmed).replace(/省|市|自治区|特别行政区|地区|盟$/g, "");
};

const pickLineValue = (text, label) => {
  const line = text.split(/\r?\n/).find((item) => item.trim().startsWith(label));
  if (!line) return "";
  return line.split(":").slice(1).join(":").trim();
};

const cleanLocation = (value) => value.split("|")[0].replace(/\s+/g, " ").trim();

const extractCityName = (locationText) => {
  if (!locationText) return "";
  const parts = locationText
    .replace(/省|市|自治区|特别行政区|地区|盟/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (parts.length >= 3 && parts[0] === "中国") return normalizeCityName(parts[2]);
  return normalizeCityName(parts[parts.length - 1] || "");
};

const timeout = (ms) =>
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error("cip.cc timeout")), ms);
  });

const getCipLocation = async (ip) => {
  const url = ip ? `https://www.cip.cc/${encodeURIComponent(ip)}` : "https://www.cip.cc/";
  const response = await fetch(url, {
    headers: {
      "User-Agent": "curl/8.0",
    },
  });
  const text = await response.text();
  const address = cleanLocation(pickLineValue(text, "地址"));
  const dataTwo = cleanLocation(pickLineValue(text, "数据二"));
  const locationText = address || dataTwo;
  return {
    source: "cip.cc",
    locationText,
    cityName: extractCityName(locationText),
  };
};

export async function onRequest({ request }) {
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "";
  const cf = request.cf || {};

  const edgeLocation = {
    source: "cloudflare",
    cityName: normalizeCityName(cf.city || cf.region || cf.country || ""),
    region: normalizeCityName(cf.region || ""),
    country: cf.country || "",
    latitude: cf.latitude ? Number(cf.latitude) : null,
    longitude: cf.longitude ? Number(cf.longitude) : null,
    timezone: cf.timezone || "",
  };

  let cipLocation = null;
  try {
    cipLocation = await Promise.race([getCipLocation(ip), timeout(900)]);
  } catch (error) {
    cipLocation = {
      source: "cip.cc",
      error: error.message,
    };
  }

  const cityName =
    cipLocation?.cityName || edgeLocation.cityName || edgeLocation.region || edgeLocation.country;

  return Response.json(
    {
      ok: Boolean(edgeLocation.latitude && edgeLocation.longitude),
      ip,
      source: "cloudflare+cip.cc",
      cityName: normalizeCityName(cityName),
      locationText: cipLocation?.locationText || "",
      latitude: edgeLocation.latitude,
      longitude: edgeLocation.longitude,
      timezone: edgeLocation.timezone,
      edge: edgeLocation,
      cip: cipLocation,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
