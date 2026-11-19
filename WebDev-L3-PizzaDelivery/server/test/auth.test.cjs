const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createOpaqueToken,
  hashToken,
  normalizeEmail,
  safeEqualHex,
  validatePassword,
  validateRegistration
} = require("../src/utils/auth");

test("registration normalizes email and trims the display name", () => {
  assert.deepEqual(
    validateRegistration({ username: "  SliceFan  ", email: "  USER@Example.com ", password: "Pizza!2025" }),
    { username: "SliceFan", email: "user@example.com", password: "Pizza!2025" }
  );
});

test("registration rejects invalid email and weak passwords", () => {
  assert.match(validateRegistration({ username: "Pat", email: "not-an-email", password: "Pizza!2025" }).error, /email/i);
  assert.match(validateRegistration({ username: "Pat", email: "pat@example.com", password: "password" }).error, /password/i);
  assert.equal(validatePassword("Valid!Password9"), true);
  assert.equal(validatePassword("no-symbol-or-number"), false);
});

test("opaque verification tokens are random and stored as one-way hashes", () => {
  const first = createOpaqueToken();
  const second = createOpaqueToken();
  assert.notEqual(first, second);
  assert.notEqual(hashToken(first), first);
  assert.equal(hashToken(first).length, 64);
});

test("hex comparison is timing-safe and rejects malformed signatures", () => {
  const value = "a".repeat(64);
  assert.equal(safeEqualHex(value, value.toUpperCase()), true);
  assert.equal(safeEqualHex(value, "not-a-signature"), false);
});

test("email normalization safely handles non-string inputs", () => {
  assert.equal(normalizeEmail(null), "");
});
