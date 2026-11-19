const mongoose = require("mongoose");

const componentSchema = new mongoose.Schema({
  ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: "Ingredient", required: true },
  name: { type: String, required: true },
  pricePaise: { type: Number, min: 0, required: true }
}, { _id: false });

const itemSchema = new mongoose.Schema({
  base: { type: componentSchema, required: true },
  sauce: { type: componentSchema, required: true },
  cheese: { type: componentSchema, required: true },
  vegetables: { type: [componentSchema], default: [] },
  quantity: { type: Number, min: 1, max: 10, required: true },
  unitPricePaise: { type: Number, min: 0, required: true },
  lineTotalPaise: { type: Number, min: 0, required: true }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  items: { type: [itemSchema], required: true },
  totalPaise: { type: Number, min: 0, required: true },
  status: {
    type: String,
    enum: ["awaiting_payment", "order_received", "in_kitchen", "out_for_delivery", "delivered", "cancelled"],
    default: "awaiting_payment",
    index: true
  },
  payment: {
    provider: { type: String, enum: ["razorpay", "demo"], default: "demo" },
    status: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    paidAt: { type: Date, default: null }
  },
  inventoryRestoredAt: { type: Date, default: null },
  statusUpdatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);
