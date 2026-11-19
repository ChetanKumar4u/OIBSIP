const path = require("node:path");
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { config } = require("./config");
const { createEmailService } = require("./services/email");
const { createAuthRouter } = require("./routes/auth");
const catalogRouter = require("./routes/catalog");
const ordersRouter = require("./routes/orders");
const paymentsRouter = require("./routes/payments");
const adminRouter = require("./routes/admin");
const { HttpError } = require("./utils/errors");

function createApp() {
  const app = express();
  const emailService = createEmailService(config);
  const razorpayOrigins = config.razorpayKeyId
    ? ["https://checkout.razorpay.com", "https://api.razorpay.com"]
    : [];
  app.disable("x-powered-by");
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        scriptSrc: ["'self'", ...razorpayOrigins.slice(0, 1)],
        connectSrc: ["'self'", ...razorpayOrigins],
        frameSrc: ["'self'", ...razorpayOrigins],
        styleSrc: ["'self'", ...(razorpayOrigins.length ? ["'unsafe-inline'"] : [])],
        imgSrc: ["'self'", "data:", ...razorpayOrigins]
      }
    }
  }));
  app.use(cors({ origin: config.clientUrl, credentials: true }));
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());
  app.use("/api", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false
  }));
  app.get("/api/health", (request, response) => response.json({ status: "ok" }));
  app.use("/api/auth", createAuthRouter({ emailService }));
  app.use("/api/catalog", catalogRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/admin", adminRouter);

  const clientDist = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.get("*path", (request, response, next) => {
    if (request.path.startsWith("/api/")) return next(new HttpError(404, "API route was not found."));
    response.sendFile(path.join(clientDist, "index.html"), (error) => {
      if (error) next(new HttpError(404, "Page was not found."));
    });
  });

  app.use((error, request, response, next) => {
    if (response.headersSent) return next(error);
    if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
      return response.status(400).json({ error: "Request body must be valid JSON." });
    }
    const status = error.code === 11000
      ? 409
      : Number.isInteger(error.status) && error.status >= 400 && error.status < 600
      ? error.status
      : 500;
    if (status >= 500) console.error("Request failed:", error);
    response.status(status).json({
      error: status === 500
        ? "The request could not be completed. Please try again."
        : status === 409 && error.code === 11000
          ? "That username or email is already in use."
          : error.message
    });
  });

  return { app, emailService };
}

module.exports = { createApp };
