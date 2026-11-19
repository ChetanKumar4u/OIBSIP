const cron = require("node-cron");
const Ingredient = require("../models/Ingredient");

function startLowStockJob({ emailService, adminEmail }) {
  return cron.schedule("*/15 * * * *", async () => {
    const lowItems = await Ingredient.find({
      active: true,
      $expr: { $lt: ["$stock", "$lowStockThreshold"] },
      lowStockNotifiedAt: null
    }).lean();

    for (const item of lowItems) {
      try {
        await emailService.send({
          to: adminEmail,
          subject: `Low stock: ${item.name}`,
          text: `${item.name} (${item.category}) has ${item.stock} unit(s) in stock. Reorder threshold: ${item.lowStockThreshold}.`
        });
        await Ingredient.updateOne(
          { _id: item._id, lowStockNotifiedAt: null },
          { $set: { lowStockNotifiedAt: new Date() } }
        );
      } catch (error) {
        console.error(`Could not send low-stock notification for ${item.name}:`, error);
      }
    }
  });
}

module.exports = { startLowStockJob };
