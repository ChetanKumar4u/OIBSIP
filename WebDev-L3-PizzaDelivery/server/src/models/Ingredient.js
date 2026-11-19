const mongoose = require("mongoose");

const ingredientSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, enum: ["base", "sauce", "cheese", "vegetable"], required: true },
  pricePaise: { type: Number, min: 0, required: true },
  stock: { type: Number, min: 0, required: true },
  lowStockThreshold: { type: Number, min: 0, default: 10 },
  lowStockNotifiedAt: { type: Date, default: null },
  active: { type: Boolean, default: true }
}, { timestamps: true });

ingredientSchema.index({ category: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Ingredient", ingredientSchema);
