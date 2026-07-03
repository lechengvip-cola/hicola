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

  if (parts.length >= 3 && parts[0] === "中国") return parts[2];
  const city = parts[parts.length - 1] || "";
  if (city === "东京都") return "东京";
  return city.replace(/都$/, "");
};

export async function onRequest({ request }) {
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "";

  const url = ip ? `https://www.cip.cc/${encodeURIComponent(ip)}` : "https://www.cip.cc/";

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "curl/8.0",
      },
    });
    const text = await response.text();
    const address = cleanLocation(pickLineValue(text, "地址"));
    const dataTwo = cleanLocation(pickLineValue(text, "数据二"));
    const locationText = address || dataTwo;

    return new Response(
      JSON.stringify({
        ok: Boolean(locationText),
        source: "cip.cc",
        ip,
        locationText,
        cityName: extractCityName(locationText),
      }),
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        source: "cip.cc",
        ip,
        message: error.message,
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
