const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/oibsip_pizza",
  jwtSecret: process.env.JWT_SECRET || "",
  emailFrom: process.env.EMAIL_FROM || "OIBSIP Pizza <no-reply@localhost>",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT) || 587,
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  adminEmail: process.env.ADMIN_EMAIL || "admin@localhost",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || ""
};

function validateConfig() {
  if (!config.mongoUri) throw new Error("MONGODB_URI is required.");
  if (Buffer.byteLength(config.jwtSecret) < 32) {
    throw new Error("Set JWT_SECRET to a random secret of at least 32 bytes.");
  }
  if (config.nodeEnv === "production") {
    if (!config.smtpHost || !config.smtpUser || !config.smtpPass || !config.adminEmail) {
      throw new Error("Production requires SMTP_HOST, SMTP_USER, SMTP_PASS, and ADMIN_EMAIL.");
    }
    if (!config.razorpayKeyId || !config.razorpayKeySecret) {
      throw new Error("Production requires Razorpay keys. Use test-mode keys for assessment demos.");
    }
  }
}

module.exports = { config, validateConfig };
