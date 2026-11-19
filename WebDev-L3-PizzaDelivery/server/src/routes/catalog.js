const express = require("express");
const { getCatalog } = require("../services/catalog");

const router = express.Router();

router.get("/", async (request, response, next) => {
  try {
    response.set("Cache-Control", "no-store").json(await getCatalog());
  } catch (error) {
    next(error);
  }
});

module.exports = router;
