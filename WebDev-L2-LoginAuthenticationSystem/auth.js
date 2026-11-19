"use strict";

const crypto = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(crypto.scrypt);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_BYTES = 64;

function normalizeIdentifier(value) {
  return value.trim().toLowerCase();
}

function validateRegistration({ username, email, password }) {
  const cleanUsername = typeof username === "string" ? username.trim() : "";
  const cleanEmail = typeof email === "string" ? normalizeIdentifier(email) : "";

  if (cleanUsername.length < 2 || cleanUsername.length > 40) {
    return { error: "Username must be between 2 and 40 characters." };
  }
  if (cleanEmail.length > 254 || !EMAIL_PATTERN.test(cleanEmail)) {
    return { error: "Enter a valid email address." };
  }
  if (typeof password !== "string" || password.length < 8 || !/\d/.test(password)) {
    return { error: "Password must be at least 8 characters and contain at least one number." };
  }
  return { username: cleanUsername, email: cleanEmail, password };
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derivedKey = await scrypt(password, salt, PASSWORD_BYTES);
  return { salt: salt.toString("hex"), hash: derivedKey.toString("hex") };
}

async function verifyPassword(password, saltHex, hashHex) {
  if (typeof password !== "string" || !/^[a-f\d]{32}$/i.test(saltHex) ||
      !/^[a-f\d]{128}$/i.test(hashHex)) {
    return false;
  }
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), PASSWORD_BYTES);
  return crypto.timingSafeEqual(actual, expected);
}

module.exports = { hashPassword, normalizeIdentifier, validateRegistration, verifyPassword };
