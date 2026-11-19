const Ingredient = require("../models/Ingredient");
const { ingredients, pizzas } = require("../data/menu");

async function seedCatalog() {
  for (const ingredient of ingredients) {
    await Ingredient.updateOne(
      { category: ingredient.category, name: ingredient.name },
      { $setOnInsert: ingredient },
      { upsert: true }
    );
  }
}

async function getCatalog() {
  const inventory = await Ingredient.find({ active: true }).sort({ category: 1, name: 1 }).lean();
  const byName = new Map(inventory.map((item) => [item.name, item]));
  return {
    ingredients: inventory.map((item) => ({
      id: String(item._id),
      name: item.name,
      category: item.category,
      pricePaise: item.pricePaise,
      available: item.stock > 0
    })),
    pizzas: pizzas.map((pizza) => {
      const recipe = {
        base: byName.get(pizza.recipe.base),
        sauce: byName.get(pizza.recipe.sauce),
        cheese: byName.get(pizza.recipe.cheese),
        vegetables: pizza.recipe.vegetables.map((name) => byName.get(name))
      };
      const available = Object.values(recipe).flat().every((ingredient) => ingredient && ingredient.stock > 0);
      const components = [recipe.base, recipe.sauce, recipe.cheese, ...recipe.vegetables];
      const totalPaise = components.every(Boolean)
        ? components.reduce((sum, ingredient) => sum + ingredient.pricePaise, 0)
        : null;
      return {
        id: pizza.id,
        name: pizza.name,
        description: pizza.description,
        available,
        pricePaise: totalPaise,
        selection: components.every(Boolean) ? {
          baseId: String(recipe.base._id),
          sauceId: String(recipe.sauce._id),
          cheeseId: String(recipe.cheese._id),
          vegetableIds: recipe.vegetables.map((item) => String(item._id))
        } : null
      };
    })
  };
}

module.exports = { getCatalog, seedCatalog };
