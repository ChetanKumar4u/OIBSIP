const crypto = require("node:crypto");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,128}$/;

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validatePassword(password) {
  return typeof password === "string" && PASSWORD_PATTERN.test(password);
}

function validateRegistration({ username, email, password } = {}) {
  const cleanUsername = typeof username === "string" ? username.trim() : "";
  const cleanEmail = normalizeEmail(email);
  if (cleanUsername.length < 2 || cleanUsername.length > 40) {
    return { error: "Username must be between 2 and 40 characters." };
  }
  if (cleanEmail.length > 254 || !EMAIL_PATTERN.test(cleanEmail)) {
    return { error: "Enter a valid email address." };
  }
  if (!validatePassword(password)) {
    return { error: "Password must be 10–128 characters and include a letter, a number, and a symbol." };
  }
  return { username: cleanUsername, email: cleanEmail, password };
}

function createOpaqueToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function safeEqualHex(left, right) {
  if (typeof left !== "string" || typeof right !== "string" ||
      !/^[a-f\d]{64}$/i.test(left) || !/^[a-f\d]{64}$/i.test(right)) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

module.exports = { createOpaqueToken, hashToken, normalizeEmail, safeEqualHex, validatePassword, validateRegistration };
