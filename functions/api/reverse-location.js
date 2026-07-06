const normalizeCityName = (value) => {
  if (!value) return "";
  return String(value)
    .replace(/省|市|自治区|特别行政区|地区|盟|都$/g, "")
    .trim();
};

const pickCity = (address = {}) =>
  normalizeCityName(
    address.city ||
      address.town ||
      address.village ||
      address.county ||
      address.state ||
      address.region ||
      address.country,
  );

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const latitude = url.searchParams.get("latitude");
  const longitude = url.searchParams.get("longitude");

  if (!latitude || !longitude) {
    return Response.json(
      { ok: false, message: "missing latitude or longitude" },
      { status: 400 },
    );
  }

  try {
    const upstream = new URL("https://nominatim.openstreetmap.org/reverse");
    upstream.searchParams.set("format", "jsonv2");
    upstream.searchParams.set("lat", latitude);
    upstream.searchParams.set("lon", longitude);
    upstream.searchParams.set("accept-language", "zh-CN");

    const response = await fetch(upstream, {
      headers: {
        "User-Agent": "hicola.net location helper",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
    });
    const data = await response.json();
    const cityName = pickCity(data.address);

    return Response.json(
      {
        ok: Boolean(cityName),
        source: "browser-geolocation+nominatim",
        cityName: cityName || "当前位置",
        displayName: data.display_name || "",
      },
      {
        headers: {
          "Cache-Control": "public, max-age=1800",
        },
      },
    );
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
