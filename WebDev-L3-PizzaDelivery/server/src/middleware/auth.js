const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { config } = require("../config");

const COOKIE_NAME = "oibsip_pizza_token";

function authCookieOptions() {
  return {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 1000,
    path: "/"
  };
}

async function authenticate(request, response, next) {
  const token = request.cookies[COOKIE_NAME];
  if (!token) return response.status(401).json({ error: "Please sign in to continue." });
  try {
    const payload = jwt.verify(token, config.jwtSecret, { issuer: "oibsip-pizza" });
    const user = await User.findById(payload.sub).select("_id username email role emailVerified");
    if (!user) return response.status(401).json({ error: "Please sign in to continue." });
    request.authUser = user;
    next();
  } catch (error) {
    response.clearCookie(COOKIE_NAME, authCookieOptions());
    if (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError") {
      return response.status(401).json({ error: "Your session expired. Please sign in again." });
    }
    next(error);
  }
}

function requireRole(role) {
  return (request, response, next) => {
    if (!request.authUser || request.authUser.role !== role) {
      return response.status(403).json({ error: "You do not have permission to access this resource." });
    }
    next();
  };
}

function requireVerified(request, response, next) {
  if (!request.authUser?.emailVerified) {
    return response.status(403).json({ error: "Verify your email address before ordering." });
  }
  next();
}

module.exports = { COOKIE_NAME, authCookieOptions, authenticate, requireRole, requireVerified };
