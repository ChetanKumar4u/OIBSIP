const test = require("node:test");
const assert = require("node:assert/strict");
const { aggregateInventoryRequirements, buildOrderItems } = require("../src/utils/orderLogic");
const { HttpError } = require("../src/utils/errors");

function ingredient(_id, category, pricePaise) {
  return { _id, category, name: _id, pricePaise };
}

const catalog = new Map([
  ["base-1", ingredient("base-1", "base", 17900)],
  ["sauce-1", ingredient("sauce-1", "sauce", 3900)],
  ["cheese-1", ingredient("cheese-1", "cheese", 7900)],
  ["veg-1", ingredient("veg-1", "vegetable", 2900)]
]);

test("order pricing is computed from catalog prices and snapshots the selections", () => {
  const [item] = buildOrderItems([{
    baseId: "base-1",
    sauceId: "sauce-1",
    cheeseId: "cheese-1",
    vegetableIds: ["veg-1"],
    quantity: 2
  }], catalog);
  assert.equal(item.unitPricePaise, 32600);
  assert.equal(item.lineTotalPaise, 65200);
  assert.equal(item.base.name, "base-1");
});

test("inventory requirements combine repeated ingredients across pizza lines", () => {
  const items = buildOrderItems([
    { baseId: "base-1", sauceId: "sauce-1", cheeseId: "cheese-1", vegetableIds: ["veg-1"], quantity: 2 },
    { baseId: "base-1", sauceId: "sauce-1", cheeseId: "cheese-1", vegetableIds: [], quantity: 1 }
  ], catalog);
  assert.deepEqual([...aggregateInventoryRequirements(items)], [
    ["base-1", 3],
    ["sauce-1", 3],
    ["cheese-1", 3],
    ["veg-1", 2]
  ]);
});

test("orders reject unavailable, miscategorized, and over-quantity ingredients", () => {
  assert.throws(() => buildOrderItems([{
    baseId: "missing", sauceId: "sauce-1", cheeseId: "cheese-1", vegetableIds: [], quantity: 1
  }], catalog), (error) => error instanceof HttpError && error.status === 400);
  assert.throws(() => buildOrderItems([{
    baseId: "sauce-1", sauceId: "sauce-1", cheeseId: "cheese-1", vegetableIds: [], quantity: 1
  }], catalog), (error) => error instanceof HttpError && error.status === 400);
  assert.throws(() => buildOrderItems([{
    baseId: "base-1", sauceId: "sauce-1", cheeseId: "cheese-1", vegetableIds: [], quantity: 11
  }], catalog), (error) => error instanceof HttpError && error.status === 400);
});
