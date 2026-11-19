const test = require("node:test");
const assert = require("node:assert/strict");
const { hashPassword, normalizeIdentifier, validateRegistration, verifyPassword } = require("./auth.js");

test("validates registration fields and password requirements", () => {
  assert.equal(validateRegistration({
    username: "Alex Morgan",
    email: "ALEX@example.com",
    password: "example9pass"
  }).email, "alex@example.com");
  assert.match(validateRegistration({
    username: "A",
    email: "not-an-email",
    password: "short"
  }).error, /username/i);
  assert.match(validateRegistration({
    username: "Alex",
    email: "alex@example.com",
    password: "longpassword"
  }).error, /number/i);
});

test("normalizes login identifiers", () => {
  assert.equal(normalizeIdentifier("  Alex@Example.com "), "alex@example.com");
});

test("hashes passwords with a unique salt and verifies only the matching password", async () => {
  const first = await hashPassword("assessment9");
  const second = await hashPassword("assessment9");
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.hash, second.hash);
  assert.equal(await verifyPassword("assessment9", first.salt, first.hash), true);
  assert.equal(await verifyPassword("different9", first.salt, first.hash), false);
});
