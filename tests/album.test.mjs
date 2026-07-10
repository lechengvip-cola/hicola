import assert from "node:assert/strict";

assert.ok(globalThis.crypto?.subtle, "Web Crypto API is required");

const cryptoModule = await import("../functions/_lib/album/crypto.js");
const authModule = await import("../functions/_lib/album/auth.js");

const password = "family-pass-123";
const hashed = await cryptoModule.hashPassword(password);
const rehashed = await cryptoModule.hashPassword(password, hashed.salt, hashed.iterations);

assert.equal(hashed.algorithm, "PBKDF2-SHA-256");
assert.equal(cryptoModule.timingSafeEqual(hashed.hash, rehashed.hash), true);
assert.equal(cryptoModule.timingSafeEqual(hashed.hash, "0".repeat(hashed.hash.length)), false);
assert.equal(authModule.validatePasswordInput("      "), false);
assert.equal(authModule.validatePasswordInput("12345"), false);
assert.equal(authModule.validatePasswordInput("123456"), true);

const groupDate = (value) => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return {
    eventDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    year,
    month,
  };
};

assert.deepEqual(groupDate("2026-07-10"), { eventDate: "2026-07-10", year: 2026, month: 7 });

const shaA = await cryptoModule.sha256Hex("same-photo");
const shaB = await cryptoModule.sha256Hex("same-photo");
const shaC = await cryptoModule.sha256Hex("other-photo");
assert.equal(shaA, shaB);
assert.notEqual(shaA, shaC);

console.log("album tests passed");
