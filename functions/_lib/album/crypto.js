const encoder = new TextEncoder();

export const toHex = (buffer) =>
  [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, "0")).join("");

const fromHex = (hex) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
};

export const randomHex = (bytes = 32) => {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return toHex(values.buffer);
};

export const sha256Hex = async (value) => {
  const input = typeof value === "string" ? encoder.encode(value) : value;
  return toHex(await crypto.subtle.digest("SHA-256", input));
};

export const hashPassword = async (password, saltHex = randomHex(16), iterations = 1) => {
  const bits = await crypto.subtle.digest("SHA-256", encoder.encode(`${saltHex}:${password}`));
  return {
    hash: toHex(bits),
    salt: saltHex,
    iterations,
    algorithm: "SHA-256",
  };
};

export const hashPasswordPbkdf2 = async (password, saltHex = randomHex(16), iterations = 1) => {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: fromHex(saltHex),
      iterations,
    },
    key,
    256,
  );
  return {
    hash: toHex(bits),
    salt: saltHex,
    iterations,
    algorithm: "PBKDF2-SHA-256",
  };
};

export const timingSafeEqual = (left, right) => {
  if (!left || !right || left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return mismatch === 0;
};

export const summarizeUserAgent = (ua = "") => ua.slice(0, 180);

export const clientIpHash = async (request, secret = "hicola-album") => {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return sha256Hex(`${secret}:${ip}`);
};
