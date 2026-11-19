const express = require("express");
const mongoose = require("mongoose");
const Ingredient = require("../models/Ingredient");
const Order = require("../models/Order");
const { authenticate, requireRole } = require("../middleware/auth");
const { HttpError } = require("../utils/errors");

const router = express.Router();
router.use(authenticate, requireRole("admin"));

router.get("/inventory", async (request, response, next) => {
  try {
    const ingredients = await Ingredient.find().sort({ category: 1, name: 1 }).lean();
    response.set("Cache-Control", "no-store").json({ ingredients });
  } catch (error) {
    next(error);
  }
});

router.patch("/inventory/:ingredientId", async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.ingredientId)) {
      throw new HttpError(400, "Ingredient identifier is invalid.");
    }
    const fields = ["stock", "lowStockThreshold", "active"];
    const updates = {};
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(request.body || {}, field)) {
        const value = request.body[field];
        if (field === "active") {
          if (typeof value !== "boolean") throw new HttpError(400, "Active must be true or false.");
        } else if (!Number.isInteger(value) || value < 0 || value > 100000) {
          throw new HttpError(400, `${field} must be a whole number between 0 and 100000.`);
        }
        updates[field] = value;
      }
    }
    if (!Object.keys(updates).length) throw new HttpError(400, "Provide stock, low-stock threshold, or active status.");
    const ingredient = await Ingredient.findById(request.params.ingredientId);
    if (!ingredient) throw new HttpError(404, "Ingredient was not found.");
    Object.assign(ingredient, updates);
    if (ingredient.stock >= ingredient.lowStockThreshold) ingredient.lowStockNotifiedAt = null;
    await ingredient.save();
    response.json({ ingredient });
  } catch (error) {
    next(error);
  }
});

router.get("/orders", async (request, response, next) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("userId", "username email")
      .lean();
    response.set("Cache-Control", "no-store").json({ orders });
  } catch (error) {
    next(error);
  }
});

router.patch("/orders/:orderId/status", async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.orderId)) {
      throw new HttpError(400, "Order identifier is invalid.");
    }
    const transitions = {
      order_received: "in_kitchen",
      in_kitchen: "out_for_delivery",
      out_for_delivery: "delivered"
    };
    const order = await Order.findById(request.params.orderId);
    if (!order) throw new HttpError(404, "Order was not found.");
    if (transitions[order.status] !== request.body?.status) {
      throw new HttpError(409, "That order status transition is not allowed.");
    }
    order.status = request.body.status;
    order.statusUpdatedAt = new Date();
    await order.save();
    response.json({ order });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
