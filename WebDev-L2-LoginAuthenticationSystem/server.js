"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const session = require("express-session");
const { hashPassword, normalizeIdentifier, validateRegistration, verifyPassword } = require("./auth.js");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const DATA_DIRECTORY = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIRECTORY, "users.json");
const PUBLIC_DIRECTORY = path.join(__dirname, "public");
const DASHBOARD_FILE = path.join(__dirname, "views", "dashboard.html");
let userWriteQueue = Promise.resolve();

if (typeof SESSION_SECRET !== "string" || Buffer.byteLength(SESSION_SECRET) < 32) {
  throw new Error("Set SESSION_SECRET to a random value of at least 32 bytes before starting the server.");
}

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use(session({
  name: "oibsip.sid",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PRODUCTION,
    maxAge: 1000 * 60 * 60 * 2
  }
}));
app.use(express.static(PUBLIC_DIRECTORY, { index: "index.html" }));

async function readUsers() {
  const contents = await fs.readFile(USERS_FILE, "utf8");
  const users = JSON.parse(contents);
  if (!Array.isArray(users)) throw new Error("User data store must contain a JSON array.");
  return users;
}

async function writeUsers(users) {
  const temporaryFile = `${USERS_FILE}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporaryFile, JSON.stringify(users, null, 2), { encoding: "utf8", mode: 0o600 });
  await fs.rename(temporaryFile, USERS_FILE);
}

function updateUsers(update) {
  const operation = userWriteQueue.then(async () => {
    const users = await readUsers();
    const result = await update(users);
    if (result.changed) await writeUsers(users);
    return result.value;
  });
  userWriteQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

function startSession(request, response, user) {
  request.session.regenerate((regenerateError) => {
    if (regenerateError) return response.status(500).json({ error: "Unable to start a session. Please try again." });
    request.session.user = { id: user.id, username: user.username, email: user.email };
    request.session.save((saveError) => {
      if (saveError) return response.status(500).json({ error: "Unable to start a session. Please try again." });
      response.json({ user: request.session.user });
    });
  });
}

function requireLogin(request, response, next) {
  if (!request.session.user) {
    if (request.path === "/dashboard") return response.redirect("/");
    return response.status(401).json({ error: "Please sign in to continue." });
  }
  next();
}

app.post("/api/register", async (request, response) => {
  const validation = validateRegistration(request.body || {});
  if (validation.error) return response.status(400).json({ error: validation.error });

  try {
    const credentials = await hashPassword(validation.password);
    const user = await updateUsers((users) => {
      const duplicate = users.some((existing) =>
        normalizeIdentifier(existing.username) === normalizeIdentifier(validation.username) ||
        normalizeIdentifier(existing.email) === validation.email
      );
      if (duplicate) return { changed: false, value: null };
      const newUser = {
        id: crypto.randomUUID(),
        username: validation.username,
        email: validation.email,
        passwordSalt: credentials.salt,
        passwordHash: credentials.hash,
        createdAt: new Date().toISOString()
      };
      users.push(newUser);
      return { changed: true, value: newUser };
    });
    if (!user) return response.status(409).json({ error: "An account with that username or email already exists." });
    return startSession(request, response, user);
  } catch (error) {
    console.error("Registration failed:", error);
    return response.status(500).json({ error: "Registration could not be completed. Please try again." });
  }
});

app.post("/api/login", async (request, response) => {
  const identifier = typeof request.body?.identifier === "string"
    ? normalizeIdentifier(request.body.identifier)
    : "";
  const password = typeof request.body?.password === "string" ? request.body.password : "";
  if (!identifier || !password) return response.status(400).json({ error: "Enter your username or email and password." });

  try {
    const users = await readUsers();
    const user = users.find((existing) =>
      normalizeIdentifier(existing.username) === identifier ||
      normalizeIdentifier(existing.email) === identifier
    );
    const validPassword = user
      ? await verifyPassword(password, user.passwordSalt, user.passwordHash)
      : false;
    if (!validPassword) return response.status(401).json({ error: "The username/email or password is incorrect." });
    return startSession(request, response, user);
  } catch (error) {
    console.error("Login failed:", error);
    return response.status(500).json({ error: "Login could not be completed. Please try again." });
  }
});

app.get("/api/me", requireLogin, (request, response) => {
  response.set("Cache-Control", "no-store");
  response.json({ user: request.session.user });
});

app.post("/api/logout", requireLogin, (request, response) => {
  request.session.destroy((error) => {
    if (error) {
      console.error("Logout failed:", error);
      return response.status(500).json({ error: "Logout could not be completed. Please try again." });
    }
    response.clearCookie("oibsip.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PRODUCTION,
      path: "/"
    });
    response.status(204).end();
  });
});

app.get("/dashboard", requireLogin, (request, response) => {
  response.set("Cache-Control", "no-store");
  response.sendFile("dashboard.html", { root: path.dirname(DASHBOARD_FILE) });
});

app.use((error, request, response, next) => {
  console.error("Unhandled request error:", error);
  if (response.headersSent) return next(error);
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600
    ? error.status
    : 500;
  const message = status === 413
    ? "Request is too large."
    : status === 400
      ? "Request body must be valid JSON."
      : "An unexpected server error occurred.";
  response.status(status).json({ error: message });
});

async function start() {
  await fs.mkdir(DATA_DIRECTORY, { recursive: true });
  try {
    await fs.access(USERS_FILE);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await writeUsers([]);
  }
  app.listen(PORT, () => {
    console.log(`OIBSIP login demo running at http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Server startup failed:", error);
    process.exitCode = 1;
  });
}

module.exports = { app, start };
