const mongoose = require("mongoose");
const { config, validateConfig } = require("./config");
const { seedCatalog } = require("./services/catalog");
const { startLowStockJob } = require("./services/lowStock");
const { createApp } = require("./app");

async function start() {
  validateConfig();
  await mongoose.connect(config.mongoUri);
  await seedCatalog();
  const { app, emailService } = createApp();
  const server = app.listen(config.port, () => {
    console.info(`Pizza Studio API listening at http://127.0.0.1:${config.port}`);
  });
  const lowStockJob = startLowStockJob({ emailService, adminEmail: config.adminEmail });

  async function shutdown(signal) {
    console.info(`${signal} received; shutting down.`);
    lowStockJob.stop();
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  }
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

start().catch((error) => {
  console.error("Could not start Pizza Studio API:", error);
  process.exitCode = 1;
});
