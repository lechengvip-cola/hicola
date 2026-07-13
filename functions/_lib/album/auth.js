import { clientIpHash, hashPassword, hashPasswordPbkdf2, randomHex, sha256Hex, timingSafeEqual } from "./crypto.js";
import { getSettings, nowIso, publicSettings, uuid } from "./db.js";

const cookieName = "hicola_album_session";
const adminCookieName = "hicola_album_admin";

export const parseCookies = (request) => {
  const header = request.headers.get("cookie") || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
      }),
  );
};

export const sessionCookie = (token, expiresAt, remember) => {
  const maxAge = remember ? Math.max(1, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)) : null;
  return [
    `${cookieName}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    maxAge ? `Max-Age=${maxAge}` : "",
  ]
    .filter(Boolean)
    .join("; ");
};

export const clearSessionCookie = () =>
  `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

const adminSignature = async (payload, secret) => sha256Hex(`${payload}.${secret || "hicola-admin"}`);

const familySignature = async (payload, env) =>
  sha256Hex(`${payload}.${env.SESSION_SECRET || env.ADMIN_ALBUM_PASSWORD || "hicola-family"}`);

export const createAdminCookie = async (env) => {
  const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
  const payload = `${expiresAt}.${randomHex(16)}`;
  const signature = await adminSignature(payload, env.SESSION_SECRET || env.ADMIN_ALBUM_PASSWORD || "hicola-admin");
  return [
    `${adminCookieName}=${encodeURIComponent(`${payload}.${signature}`)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=43200",
  ].join("; ");
};

export const clearAdminCookie = () =>
  `${adminCookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export const verifyAdminCookie = async (request, env) => {
  const token = parseCookies(request)[adminCookieName];
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  if (Number(parts[0]) < Date.now()) return false;
  const expected = await adminSignature(payload, env.SESSION_SECRET || env.ADMIN_ALBUM_PASSWORD || "hicola-admin");
  return timingSafeEqual(expected, parts[2]);
};

export const validatePasswordInput = (password) =>
  typeof password === "string" && password.length >= 6 && password.length <= 64 && password.trim().length > 0;

export const updateFamilyPassword = async (env, password, adminEmail) => {
  if (!validatePasswordInput(password)) {
    throw new Error("家庭密码需要 6 至 64 个字符，且不能是纯空格。");
  }
  const settings = await getSettings(env);
  const hashed = await hashPassword(password);
  const now = nowIso();
  await env.DB.prepare(
    `UPDATE album_security_settings
     SET family_password_hash = ?,
         family_password_salt = ?,
         family_password_iterations = ?,
         family_password_algorithm = ?,
         family_password_version = ?,
         password_updated_at = ?,
         password_updated_by = ?,
         updated_at = ?
     WHERE id = 1`,
  )
    .bind(
      hashed.hash,
      hashed.salt,
      hashed.iterations,
      hashed.algorithm,
      Number(settings.family_password_version || 1) + 1,
      now,
      adminEmail || "unknown",
      now,
    )
    .run();
  await env.DB.prepare("UPDATE family_sessions SET revoked_at = ? WHERE revoked_at IS NULL").bind(now).run();
};

export const verifyPassword = async (settings, password) => {
  if (settings.family_plain_password && timingSafeEqual(String(settings.family_plain_password), password)) return true;
  if (!settings.family_password_hash || !settings.family_password_salt) return false;
  const iterations = Number(settings.family_password_iterations || 1);
  const hasher = settings.family_password_algorithm === "PBKDF2-SHA-256" ? hashPasswordPbkdf2 : hashPassword;
  const hashed = await hasher(password, settings.family_password_salt, iterations);
  return timingSafeEqual(hashed.hash, settings.family_password_hash);
};

export const createFamilySession = async (env, request, remember) => {
  const settings = await getSettings(env);
  const days = Math.min(30, Math.max(1, Number(settings.family_session_days || 30)));
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
  const payload = [
    Number(settings.family_password_version || 1),
    new Date(expiresAt).getTime(),
    randomHex(16),
  ].join(".");
  const token = `${payload}.${await familySignature(payload, env)}`;
  return { token, expiresAt, cookie: sessionCookie(token, expiresAt, remember) };
};

export const verifyFamilySession = async (env, request) => {
  const settings = await getSettings(env);
  const status = { authenticated: false, settings: publicSettings(settings), reason: null };
  if (!settings.family_password_hash) return { ...status, reason: "not_configured" };
  if (!settings.family_access_enabled) return { ...status, reason: "disabled" };
  const token = parseCookies(request)[cookieName];
  if (!token) return { ...status, reason: "missing" };
  const parts = token.split(".");
  if (parts.length !== 4) return { ...status, reason: "invalid" };
  const payload = parts.slice(0, 3).join(".");
  const [version, expiresAt] = parts;
  if (Number(expiresAt) <= Date.now()) return { ...status, reason: "expired" };
  if (Number(version) !== Number(settings.family_password_version)) return { ...status, reason: "password_changed" };
  if (!timingSafeEqual(await familySignature(payload, env), parts[3])) return { ...status, reason: "invalid" };
  return { authenticated: true, settings: publicSettings(settings), session: { password_version: Number(version) } };
};

export const recordLoginFailure = async (env, request) => {
  const ipHash = await clientIpHash(request, env.SESSION_SECRET || "hicola-album");
  const now = nowIso();
  const row = await env.DB.prepare("SELECT * FROM album_login_attempts WHERE ip_hash = ?").bind(ipHash).first();
  const count = row ? Number(row.failed_count || 0) + 1 : 1;
  const lockedUntil = count >= 5 ? new Date(Date.now() + 10 * 60 * 1000).toISOString() : null;
  await env.DB.prepare(
    `INSERT INTO album_login_attempts (id, ip_hash, failed_count, locked_until, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(ip_hash) DO UPDATE SET failed_count = ?, locked_until = ?, updated_at = ?`,
  )
    .bind(uuid(), ipHash, count, lockedUntil, now, count, lockedUntil, now)
    .run();
};

export const clearLoginFailures = async (env, request) => {
  const ipHash = await clientIpHash(request, env.SESSION_SECRET || "hicola-album");
  await env.DB.prepare("DELETE FROM album_login_attempts WHERE ip_hash = ?").bind(ipHash).run();
};

export const isLoginLocked = async (env, request) => {
  const ipHash = await clientIpHash(request, env.SESSION_SECRET || "hicola-album");
  const row = await env.DB.prepare("SELECT locked_until FROM album_login_attempts WHERE ip_hash = ?").bind(ipHash).first();
  return Boolean(row?.locked_until && new Date(row.locked_until).getTime() > Date.now());
};

export const getAdminEmail = (request, env) => {
  const accessEmail =
    request.headers.get("cf-access-authenticated-user-email") ||
    request.headers.get("cf-access-user-email") ||
    request.headers.get("x-admin-email");
  const allowed = String(env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (accessEmail && allowed.includes(accessEmail.toLowerCase())) return accessEmail;
  if (env.ENVIRONMENT !== "production" && env.DEV_ADMIN_TOKEN && request.headers.get("x-dev-admin-token") === env.DEV_ADMIN_TOKEN) {
    return "dev-admin@local";
  }
  return null;
};

export const verifyAdminPassword = async (env, password) => {
  const configured = env.ADMIN_ALBUM_PASSWORD;
  if (!configured || typeof password !== "string") return false;
  return timingSafeEqual(configured, password);
};
