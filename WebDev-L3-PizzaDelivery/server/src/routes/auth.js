const bcrypt = require("bcryptjs");
const express = require("express");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const { config } = require("../config");
const { COOKIE_NAME, authCookieOptions, authenticate } = require("../middleware/auth");
const { createOpaqueToken, hashToken, normalizeEmail, validatePassword, validateRegistration } = require("../utils/auth");
const { HttpError } = require("../utils/errors");

const DUMMY_PASSWORD_HASH = bcrypt.hashSync("not-a-real-password", 12);
const emailLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many account requests. Please try again later." }
});
const DAY = 24 * 60 * 60 * 1000;

function issueSession(response, user) {
  const token = jwt.sign(
    { role: user.role },
    config.jwtSecret,
    { subject: String(user._id), issuer: "oibsip-pizza", expiresIn: "1h" }
  );
  response.cookie(COOKIE_NAME, token, authCookieOptions());
}

function publicUser(user) {
  return {
    id: String(user._id),
    username: user.username,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function accountMessage(response, message, developmentLink) {
  response.status(201).json({
    message,
    ...(config.nodeEnv === "development" && !process.env.SMTP_HOST && developmentLink
      ? { developmentLink }
      : {})
  });
}

function createAuthRouter({ emailService }) {
  const router = express.Router();
  router.post("/register", emailLimit, async (request, response, next) => {
    try {
      const input = validateRegistration(request.body || {});
      if (input.error) throw new HttpError(400, input.error);

      const usernamePattern = new RegExp(`^${escapeRegex(input.username)}$`, "i");
      const existing = await User.findOne({
        $or: [{ email: input.email }, { username: usernamePattern }]
      }).select("_id");
      if (existing) throw new HttpError(409, "That username or email is already registered.");

      const verificationToken = createOpaqueToken();
      const verificationUrl = `${config.clientUrl}/?verify=${encodeURIComponent(verificationToken)}`;
      const user = await User.create({
        username: input.username,
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, 12),
        verificationTokenHash: hashToken(verificationToken),
        verificationExpiresAt: new Date(Date.now() + DAY)
      });
      await emailService.send({
        to: user.email,
        subject: "Verify your Pizza Studio account",
        text: `Welcome to Pizza Studio. Verify your email within 24 hours: ${verificationUrl}`
      });

      return accountMessage(response, "Account created. Verify your email to place an order.", verificationUrl);
    } catch (error) {
      next(error);
    }
  });

  router.post("/verify-email", emailLimit, async (request, response, next) => {
    try {
      const token = typeof request.body?.token === "string" ? request.body.token : "";
      if (!token) throw new HttpError(400, "Verification link is missing or invalid.");
      const user = await User.findOne({
        verificationTokenHash: hashToken(token),
        verificationExpiresAt: { $gt: new Date() }
      }).select("+verificationTokenHash +verificationExpiresAt");
      if (!user) throw new HttpError(400, "Verification link is invalid or expired.");
      user.emailVerified = true;
      user.verificationTokenHash = undefined;
      user.verificationExpiresAt = undefined;
      await user.save();
      response.json({ message: "Email verified. You can now sign in and order." });
    } catch (error) {
      next(error);
    }
  });

  router.post("/verify-resend", emailLimit, async (request, response, next) => {
    try {
      const email = normalizeEmail(request.body?.email);
      const user = email ? await User.findOne({ email }) : null;
      let developmentLink;
      if (user && !user.emailVerified) {
        const token = createOpaqueToken();
        user.verificationTokenHash = hashToken(token);
        user.verificationExpiresAt = new Date(Date.now() + DAY);
        await user.save();
        developmentLink = `${config.clientUrl}/?verify=${encodeURIComponent(token)}`;
        await emailService.send({
          to: user.email,
          subject: "Verify your Pizza Studio account",
          text: `Verify your email within 24 hours: ${developmentLink}`
        });
      }
      response.json({
        message: "If an unverified account exists for that email, a verification link has been sent.",
        ...(config.nodeEnv === "development" && !process.env.SMTP_HOST && developmentLink
          ? { developmentLink }
          : {})
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/login", emailLimit, async (request, response, next) => {
    try {
      const identifier = typeof request.body?.identifier === "string" ? request.body.identifier.trim() : "";
      const password = typeof request.body?.password === "string" ? request.body.password : "";
      if (!identifier || !password) throw new HttpError(400, "Enter your username/email and password.");
      const normalized = normalizeEmail(identifier);
      const user = await User.findOne({
        $or: [
          { email: normalized },
          { username: new RegExp(`^${escapeRegex(identifier)}$`, "i") }
        ]
      }).select("+passwordHash");
      const valid = user
        ? await bcrypt.compare(password, user.passwordHash)
        : await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      if (!user || !valid) throw new HttpError(401, "The username/email or password is incorrect.");
      if (user.role === "user" && !user.emailVerified) {
        throw new HttpError(403, "Verify your email before signing in.");
      }
      issueSession(response, user);
      response.json({ user: publicUser(user) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/login", emailLimit, async (request, response, next) => {
    try {
      const email = normalizeEmail(request.body?.email);
      const password = typeof request.body?.password === "string" ? request.body.password : "";
      const user = email && password
        ? await User.findOne({ email, role: "admin" }).select("+passwordHash")
        : null;
      const valid = user
        ? await bcrypt.compare(password, user.passwordHash)
        : await bcrypt.compare(password || "invalid-password", DUMMY_PASSWORD_HASH);
      if (!user || !valid) throw new HttpError(401, "The admin email or password is incorrect.");
      issueSession(response, user);
      response.json({ user: publicUser(user) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/forgot-password", emailLimit, async (request, response, next) => {
    try {
      const email = normalizeEmail(request.body?.email);
      const user = email ? await User.findOne({ email }) : null;
      let developmentLink;
      if (user) {
        const token = createOpaqueToken();
        user.resetTokenHash = hashToken(token);
        user.resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await user.save();
        developmentLink = `${config.clientUrl}/?reset=${encodeURIComponent(token)}`;
        await emailService.send({
          to: user.email,
          subject: "Reset your Pizza Studio password",
          text: `This link expires in one hour. Reset your password: ${developmentLink}`
        });
      }
      response.json({
        message: "If an account exists for that email, a reset link has been sent.",
        ...(config.nodeEnv === "development" && !process.env.SMTP_HOST && developmentLink
          ? { developmentLink }
          : {})
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/reset-password", emailLimit, async (request, response, next) => {
    try {
      const token = typeof request.body?.token === "string" ? request.body.token : "";
      const password = request.body?.password;
      if (!token || !validatePassword(password)) {
        throw new HttpError(400, "Use a valid reset link and a password with 10–128 characters, a letter, a number, and a symbol.");
      }
      const user = await User.findOne({
        resetTokenHash: hashToken(token),
        resetExpiresAt: { $gt: new Date() }
      }).select("+resetTokenHash +resetExpiresAt +passwordHash");
      if (!user) throw new HttpError(400, "Reset link is invalid or expired.");
      user.passwordHash = await bcrypt.hash(password, 12);
      user.resetTokenHash = undefined;
      user.resetExpiresAt = undefined;
      await user.save();
      response.json({ message: "Password updated. Sign in with your new password." });
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", authenticate, (request, response) => {
    response.set("Cache-Control", "no-store").json({ user: publicUser(request.authUser) });
  });

  router.post("/logout", (request, response) => {
    response.clearCookie(COOKIE_NAME, authCookieOptions());
    response.status(204).end();
  });

  return router;
}

module.exports = { createAuthRouter };
