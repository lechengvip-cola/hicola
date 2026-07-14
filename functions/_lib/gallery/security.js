import { parseCookies, verifyAdminPassword } from "../album/auth.js";
import { clientIpHash, hashPassword, randomHex, sha256Hex, timingSafeEqual } from "../album/crypto.js";

const SECURITY_KEY = "gallery/security.json";
const COOKIE_NAME = "hicola_gallery_admin";
const MAX_FAILED = 5;
const LOCK_MINUTES = 10;

const nowIso = () => new Date().toISOString();

const defaultSecurity = () => ({
  adminPasswordHash: "",
  adminPasswordSalt: "",
  adminPasswordIterations: 1,
  adminPasswordAlgorithm: "SHA-256",
  adminPasswordVersion: 1,
  adminPasswordUpdatedAt: "",
  failedLogins: {},
});

export const readGallerySecurity = async (env) => {
  const object = await env.ALBUM_BUCKET.get(SECURITY_KEY);
  if (!object) return defaultSecurity();
  try {
    return { ...defaultSecurity(), ...JSON.parse(await object.text()) };
  } catch {
    return defaultSecurity();
  }
};

export const writeGallerySecurity = async (env, security) => {
  await env.ALBUM_BUCKET.put(SECURITY_KEY, JSON.stringify(security, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
  return security;
};

const cookieSecret = async (env, security) =>
  env.SESSION_SECRET || security.adminPasswordHash || env.ADMIN_ALBUM_PASSWORD || "hicola-gallery-admin";

const cookieSignature = async (payload, env, security) => sha256Hex(`${payload}.${await cookieSecret(env, security)}`);

export const createGalleryAdminCookie = async (env) => {
  const security = await readGallerySecurity(env);
  const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
  const version = Number(security.adminPasswordVersion || 1);
  const payload = `${version}.${expiresAt}.${randomHex(16)}`;
  const signature = await cookieSignature(payload, env, security);
  return [
    `${COOKIE_NAME}=${encodeURIComponent(`${payload}.${signature}`)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=43200",
  ].join("; ");
};

export const clearGalleryAdminCookie = () => `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export const verifyGalleryAdminCookie = async (request, env) => {
  const token = parseCookies(request)[COOKIE_NAME];
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 4) return false;
  const [version, expiresAt, nonce, signature] = parts;
  if (Number(expiresAt) <= Date.now()) return false;
  const security = await readGallerySecurity(env);
  if (Number(version) !== Number(security.adminPasswordVersion || 1)) return false;
  const payload = `${version}.${expiresAt}.${nonce}`;
  return timingSafeEqual(await cookieSignature(payload, env, security), signature);
};

export const validateGalleryPassword = (password) =>
  typeof password === "string" && password.length >= 6 && password.length <= 64 && password.trim().length > 0;

export const verifyGalleryPassword = async (env, password) => {
  const security = await readGallerySecurity(env);
  if (security.adminPasswordHash && security.adminPasswordSalt) {
    const hashed = await hashPassword(password, security.adminPasswordSalt, Number(security.adminPasswordIterations || 1));
    return timingSafeEqual(hashed.hash, security.adminPasswordHash);
  }
  return verifyAdminPassword(env, password);
};

const cleanFailures = (failedLogins = {}) => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return Object.fromEntries(
    Object.entries(failedLogins).filter(([, item]) => new Date(item.updatedAt || 0).getTime() > cutoff),
  );
};

export const isGalleryLoginLocked = async (env, request) => {
  const security = await readGallerySecurity(env);
  const ipHash = await clientIpHash(request, env.SESSION_SECRET || "hicola-gallery");
  const failure = security.failedLogins?.[ipHash];
  return Boolean(failure?.lockedUntil && new Date(failure.lockedUntil).getTime() > Date.now());
};

export const recordGalleryLoginFailure = async (env, request) => {
  const security = await readGallerySecurity(env);
  const ipHash = await clientIpHash(request, env.SESSION_SECRET || "hicola-gallery");
  const failedLogins = cleanFailures(security.failedLogins);
  const current = failedLogins[ipHash] || { count: 0 };
  const count = Number(current.count || 0) + 1;
  failedLogins[ipHash] = {
    count,
    lockedUntil: count >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString() : "",
    updatedAt: nowIso(),
  };
  await writeGallerySecurity(env, { ...security, failedLogins });
};

export const clearGalleryLoginFailures = async (env, request) => {
  const security = await readGallerySecurity(env);
  const ipHash = await clientIpHash(request, env.SESSION_SECRET || "hicola-gallery");
  const failedLogins = cleanFailures(security.failedLogins);
  delete failedLogins[ipHash];
  await writeGallerySecurity(env, { ...security, failedLogins });
};

export const changeGalleryPassword = async (env, currentPassword, newPassword) => {
  if (!(await verifyGalleryPassword(env, currentPassword))) {
    throw new Error("当前管理员密码不正确。");
  }
  if (!validateGalleryPassword(newPassword)) {
    throw new Error("新密码需要 6 到 64 个字符，且不能是纯空格。");
  }
  if (currentPassword === newPassword) {
    throw new Error("新密码不能和当前密码相同。");
  }
  const security = await readGallerySecurity(env);
  const hashed = await hashPassword(newPassword);
  const next = {
    ...security,
    adminPasswordHash: hashed.hash,
    adminPasswordSalt: hashed.salt,
    adminPasswordIterations: hashed.iterations,
    adminPasswordAlgorithm: hashed.algorithm,
    adminPasswordVersion: Number(security.adminPasswordVersion || 1) + 1,
    adminPasswordUpdatedAt: nowIso(),
    failedLogins: {},
  };
  return writeGallerySecurity(env, next);
};

export const publicGallerySecurity = (security) => ({
  passwordCustomized: Boolean(security.adminPasswordHash),
  passwordUpdatedAt: security.adminPasswordUpdatedAt || "",
  passwordVersion: Number(security.adminPasswordVersion || 1),
  lockPolicy: `连续 ${MAX_FAILED} 次错误会锁定 ${LOCK_MINUTES} 分钟`,
});
