const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { config } = require("../config");
const User = require("../models/User");
const { normalizeEmail, validatePassword } = require("../utils/auth");

async function seedAdmin() {
  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const username = (process.env.ADMIN_USERNAME || "PizzaAdmin").trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !username || !validatePassword(password)) {
    throw new Error("Set ADMIN_EMAIL, ADMIN_USERNAME, and a strong ADMIN_PASSWORD in the server .env file.");
  }

  await mongoose.connect(config.mongoUri);
  const existing = await User.findOne({ email }).select("+passwordHash");
  if (existing && existing.role !== "admin") {
    throw new Error("ADMIN_EMAIL belongs to a customer account; choose a separate email for the admin.");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  if (existing) {
    existing.username = username;
    existing.passwordHash = passwordHash;
    existing.emailVerified = true;
    await existing.save();
    console.info(`Updated admin account ${email}.`);
  } else {
    await User.create({
      username,
      email,
      passwordHash,
      role: "admin",
      emailVerified: true
    });
    console.info(`Created admin account ${email}.`);
  }
}

seedAdmin()
  .catch((error) => {
    console.error("Could not seed admin account:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
