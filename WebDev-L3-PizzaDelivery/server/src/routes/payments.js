const crypto = require("node:crypto");
const express = require("express");
const mongoose = require("mongoose");
const Razorpay = require("razorpay");
const Order = require("../models/Order");
const { authenticate } = require("../middleware/auth");
const { restoreOrderInventory } = require("../services/inventory");
const { config } = require("../config");
const { safeEqualHex } = require("../utils/auth");
const { HttpError } = require("../utils/errors");

const router = express.Router();
const razorpayEnabled = Boolean(config.razorpayKeyId && config.razorpayKeySecret);
const razorpay = razorpayEnabled
  ? new Razorpay({ key_id: config.razorpayKeyId, key_secret: config.razorpayKeySecret })
  : null;

router.use(authenticate);

router.post("/:orderId/checkout", async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.orderId)) throw new HttpError(400, "Order identifier is invalid.");
    const order = await Order.findOne({ _id: request.params.orderId, userId: request.authUser._id });
    if (!order || order.status !== "awaiting_payment" || order.payment.status !== "pending") {
      throw new HttpError(404, "Pending order was not found.");
    }

    if (!razorpay) {
      await Order.updateOne(
        { _id: order._id, status: "awaiting_payment", "payment.status": "pending" },
        { $set: { "payment.provider": "demo" } }
      );
      return response.json({ mode: "demo", orderId: String(order._id), amountPaise: order.totalPaise });
    }

    let razorpayOrderId = order.payment.razorpayOrderId;
    if (!razorpayOrderId) {
      const checkoutOrder = await razorpay.orders.create({
        amount: order.totalPaise,
        currency: "INR",
        receipt: String(order._id)
      });
      razorpayOrderId = checkoutOrder.id;
      const updated = await Order.findOneAndUpdate(
        { _id: order._id, status: "awaiting_payment", "payment.status": "pending" },
        { $set: { "payment.provider": "razorpay", "payment.razorpayOrderId": razorpayOrderId } },
        { new: true }
      );
      if (!updated) throw new HttpError(409, "This order is no longer awaiting payment.");
    }
    response.json({
      mode: "razorpay",
      keyId: config.razorpayKeyId,
      orderId: String(order._id),
      razorpayOrderId,
      amountPaise: order.totalPaise,
      currency: "INR"
    });
  } catch (error) {
    next(error);
  }
});

async function markPaid({ orderId, userId, provider, razorpayOrderId, paymentId }) {
  const conditions = {
    _id: orderId,
    userId,
    status: "awaiting_payment",
    "payment.status": "pending",
    "payment.provider": provider,
    inventoryRestoredAt: null
  };
  if (razorpayOrderId) conditions["payment.razorpayOrderId"] = razorpayOrderId;
  const updated = await Order.findOneAndUpdate(conditions, {
    $set: {
      "payment.status": "paid",
      "payment.paidAt": new Date(),
      "payment.razorpayPaymentId": paymentId || null,
      status: "order_received",
      statusUpdatedAt: new Date()
    }
  }, { new: true });
  if (!updated) throw new HttpError(409, "This order is no longer awaiting payment.");
  return updated;
}

router.post("/:orderId/razorpay/verify", async (request, response, next) => {
  try {
    if (!razorpay) throw new HttpError(503, "Razorpay test checkout is not configured.");
    if (!mongoose.isValidObjectId(request.params.orderId)) throw new HttpError(400, "Order identifier is invalid.");
    const { razorpay_order_id: razorpayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = request.body || {};
    if (![razorpayOrderId, paymentId, signature].every((value) => typeof value === "string")) {
      throw new HttpError(400, "Payment verification details are incomplete.");
    }
    const order = await Order.findOne({ _id: request.params.orderId, userId: request.authUser._id });
    if (!order || order.status !== "awaiting_payment" || order.payment.status !== "pending" ||
        order.payment.razorpayOrderId !== razorpayOrderId) {
      throw new HttpError(400, "Payment does not match this order.");
    }
    const expected = crypto.createHmac("sha256", config.razorpayKeySecret)
      .update(`${razorpayOrderId}|${paymentId}`)
      .digest("hex");
    if (!safeEqualHex(expected, signature)) throw new HttpError(400, "Payment signature is invalid.");
    const updated = await markPaid({
      orderId: order._id,
      userId: request.authUser._id,
      provider: "razorpay",
      razorpayOrderId,
      paymentId
    });
    response.json({ order: updated });
  } catch (error) {
    next(error);
  }
});

router.post("/:orderId/demo-success", async (request, response, next) => {
  try {
    if (razorpayEnabled || config.nodeEnv === "production") {
      throw new HttpError(404, "The local test payment simulator is disabled.");
    }
    if (!mongoose.isValidObjectId(request.params.orderId)) throw new HttpError(400, "Order identifier is invalid.");
    const order = await Order.findOne({
      _id: request.params.orderId,
      userId: request.authUser._id,
      status: "awaiting_payment",
      "payment.status": "pending",
      "payment.provider": "demo"
    });
    if (!order) throw new HttpError(404, "Pending test order was not found.");
    const updated = await markPaid({
      orderId: order._id,
      userId: request.authUser._id,
      provider: "demo"
    });
    response.json({ order: updated });
  } catch (error) {
    next(error);
  }
});

router.post("/:orderId/demo-failure", async (request, response, next) => {
  try {
    if (razorpayEnabled || config.nodeEnv === "production") {
      throw new HttpError(404, "The local test payment simulator is disabled.");
    }
    if (!mongoose.isValidObjectId(request.params.orderId)) throw new HttpError(400, "Order identifier is invalid.");
    const order = await restoreOrderInventory(request.params.orderId, request.authUser._id);
    response.json({ order });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
