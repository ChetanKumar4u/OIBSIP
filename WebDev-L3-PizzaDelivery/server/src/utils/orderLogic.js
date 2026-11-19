const { HttpError } = require("./errors");

function buildOrderItems(selections, ingredientsById) {
  if (!Array.isArray(selections) || selections.length < 1 || selections.length > 8) {
    throw new HttpError(400, "Choose between 1 and 8 pizzas per order.");
  }

  return selections.map((selection) => {
    const quantity = Number(selection.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      throw new HttpError(400, "Each pizza quantity must be between 1 and 10.");
    }
    if (!Array.isArray(selection.vegetableIds) || selection.vegetableIds.length > 8) {
      throw new HttpError(400, "Choose no more than 8 vegetable toppings per pizza.");
    }

    const base = ingredientsById.get(String(selection.baseId));
    const sauce = ingredientsById.get(String(selection.sauceId));
    const cheese = ingredientsById.get(String(selection.cheeseId));
    const vegetableIds = [...new Set(selection.vegetableIds.map(String))];
    const vegetables = vegetableIds.map((id) => ingredientsById.get(id));
    if (!base || !sauce || !cheese || vegetables.some((item) => !item)) {
      throw new HttpError(400, "One or more selected ingredients are unavailable.");
    }
    if (base.category !== "base" || sauce.category !== "sauce" ||
        cheese.category !== "cheese" || vegetables.some((item) => item.category !== "vegetable")) {
      throw new HttpError(400, "Choose ingredients from their matching categories.");
    }

    const unitPricePaise = [base, sauce, cheese, ...vegetables]
      .reduce((sum, ingredient) => sum + ingredient.pricePaise, 0);
    return {
      base: snapshot(base),
      sauce: snapshot(sauce),
      cheese: snapshot(cheese),
      vegetables: vegetables.map(snapshot),
      quantity,
      unitPricePaise,
      lineTotalPaise: unitPricePaise * quantity
    };
  });
}

function snapshot(ingredient) {
  return {
    ingredientId: ingredient._id,
    name: ingredient.name,
    pricePaise: ingredient.pricePaise
  };
}

function aggregateInventoryRequirements(items) {
  const quantities = new Map();
  for (const item of items) {
    for (const component of [item.base, item.sauce, item.cheese, ...item.vegetables]) {
      const id = String(component.ingredientId);
      quantities.set(id, (quantities.get(id) || 0) + item.quantity);
    }
  }
  return quantities;
}

module.exports = { aggregateInventoryRequirements, buildOrderItems };
