const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true, minlength: 2, maxlength: 40 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["user", "admin"], default: "user", required: true },
  emailVerified: { type: Boolean, default: false },
  verificationTokenHash: { type: String, select: false },
  verificationExpiresAt: { type: Date, select: false },
  resetTokenHash: { type: String, select: false },
  resetExpiresAt: { type: Date, select: false }
}, { timestamps: true });

userSchema.index({ username: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

module.exports = mongoose.model("User", userSchema);
