const Ingredient = require("../models/Ingredient");
const Order = require("../models/Order");
const { aggregateInventoryRequirements } = require("../utils/orderLogic");
const { HttpError } = require("../utils/errors");

async function reserveInventory(items) {
  const reservations = [];
  for (const [ingredientId, quantity] of aggregateInventoryRequirements(items)) {
    const updated = await Ingredient.findOneAndUpdate(
      { _id: ingredientId, active: true, stock: { $gte: quantity } },
      { $inc: { stock: -quantity } },
      { new: true, runValidators: true }
    );
    if (!updated) {
      await restoreReservations(reservations);
      throw new HttpError(409, "An ingredient just sold out. Refresh the menu and try again.");
    }
    reservations.push({ ingredientId, quantity });
  }
  return reservations;
}

async function restoreReservations(reservations) {
  for (const reservation of reservations) {
    await Ingredient.updateOne(
      { _id: reservation.ingredientId },
      { $inc: { stock: reservation.quantity } }
    );
  }
}

async function restoreOrderInventory(orderId, userId) {
  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      userId,
      status: "awaiting_payment",
      inventoryRestoredAt: null
    },
    {
      $set: {
        status: "cancelled",
        inventoryRestoredAt: new Date(),
        "payment.status": "failed",
        statusUpdatedAt: new Date()
      }
    },
    { new: true }
  );
  if (!order) throw new HttpError(409, "This order cannot be cancelled.");

  const requirements = aggregateInventoryRequirements(order.items);
  for (const [ingredientId, quantity] of requirements) {
    await Ingredient.updateOne(
      { _id: ingredientId },
      { $inc: { stock: quantity } }
    );
  }
  return order;
}

module.exports = { reserveInventory, restoreOrderInventory, restoreReservations };
