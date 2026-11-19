const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateExpression } = require("./calculator.js");

test("evaluates chained operations using arithmetic precedence", () => {
  assert.equal(evaluateExpression("5+3*2"), 11);
  assert.equal(evaluateExpression("20/5-1"), 3);
});

test("supports decimals and unary negative values", () => {
  assert.equal(evaluateExpression("-.5+2.25"), 1.75);
  assert.equal(evaluateExpression("5*-2"), -10);
  assert.equal(evaluateExpression("5+-2"), 3);
});

test("rejects division by zero and malformed input", () => {
  assert.throws(() => evaluateExpression("8/0"), /zero/i);
  assert.throws(() => evaluateExpression("2+*3"), /expression/i);
  assert.throws(() => evaluateExpression("2+3x"), /expression/i);
});
