const express = require("express");
const mongoose = require("mongoose");
const Ingredient = require("../models/Ingredient");
const Order = require("../models/Order");
const { authenticate, requireVerified } = require("../middleware/auth");
const { reserveInventory, restoreOrderInventory, restoreReservations } = require("../services/inventory");
const { buildOrderItems } = require("../utils/orderLogic");
const { HttpError } = require("../utils/errors");

const router = express.Router();

router.use(authenticate);

router.get("/mine", async (request, response, next) => {
  try {
    const orders = await Order.find({ userId: request.authUser._id })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    response.set("Cache-Control", "no-store").json({ orders });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireVerified, async (request, response, next) => {
  let reservations = [];
  try {
    const selections = request.body?.items;
    if (!Array.isArray(selections) || selections.length < 1 || selections.length > 8) {
      throw new HttpError(400, "Choose between 1 and 8 pizzas per order.");
    }
    if (selections.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
      throw new HttpError(400, "Each pizza selection must be an object.");
    }
    const selectedIds = selections.flatMap((item) => [
      item.baseId,
      item.sauceId,
      item.cheeseId,
      ...(Array.isArray(item.vegetableIds) ? item.vegetableIds : [])
    ]);
    if (selectedIds.some((id) => !mongoose.isValidObjectId(id))) {
      throw new HttpError(400, "One or more selected ingredients are invalid.");
    }

    const uniqueIds = [...new Set(selectedIds.map(String))];
    const availableIngredients = await Ingredient.find({
      _id: { $in: uniqueIds },
      active: true
    }).lean();
    const byId = new Map(availableIngredients.map((ingredient) => [String(ingredient._id), ingredient]));
    const items = buildOrderItems(selections, byId);

    reservations = await reserveInventory(items);
    const totalPaise = items.reduce((sum, item) => sum + item.lineTotalPaise, 0);
    const order = await Order.create({
      userId: request.authUser._id,
      items: items.map(({ components, ...item }) => item),
      totalPaise,
      status: "awaiting_payment",
      payment: { provider: "demo", status: "pending" }
    });
    response.status(201).json({ order });
  } catch (error) {
    if (reservations.length) {
      try {
        await restoreReservations(reservations);
      } catch (restoreError) {
        console.error("Could not roll back reserved stock after order creation failed:", restoreError);
        return next(new HttpError(500, "Order could not be completed and inventory needs administrator review."));
      }
    }
    next(error);
  }
});

router.post("/:orderId/cancel", async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.orderId)) {
      throw new HttpError(400, "Order identifier is invalid.");
    }
    const order = await restoreOrderInventory(request.params.orderId, request.authUser._id);
    response.json({ order });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
