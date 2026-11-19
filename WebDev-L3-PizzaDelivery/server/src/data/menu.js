const ingredients = [
  { name: "Classic Crust", category: "base", pricePaise: 17900, stock: 30, lowStockThreshold: 20 },
  { name: "Thin Crust", category: "base", pricePaise: 18900, stock: 26, lowStockThreshold: 20 },
  { name: "Whole Wheat", category: "base", pricePaise: 19900, stock: 24, lowStockThreshold: 18 },
  { name: "Gluten-Free", category: "base", pricePaise: 21900, stock: 22, lowStockThreshold: 18 },
  { name: "Pan Crust", category: "base", pricePaise: 20900, stock: 25, lowStockThreshold: 18 },
  { name: "Tomato Basil", category: "sauce", pricePaise: 3900, stock: 35, lowStockThreshold: 20 },
  { name: "Pesto", category: "sauce", pricePaise: 5900, stock: 22, lowStockThreshold: 12 },
  { name: "Arrabbiata", category: "sauce", pricePaise: 4500, stock: 28, lowStockThreshold: 15 },
  { name: "White Garlic", category: "sauce", pricePaise: 4900, stock: 24, lowStockThreshold: 12 },
  { name: "Smoky BBQ", category: "sauce", pricePaise: 4900, stock: 24, lowStockThreshold: 12 },
  { name: "Mozzarella", category: "cheese", pricePaise: 7900, stock: 32, lowStockThreshold: 18 },
  { name: "Aged Cheddar", category: "cheese", pricePaise: 8900, stock: 24, lowStockThreshold: 14 },
  { name: "Vegan Cheese", category: "cheese", pricePaise: 9900, stock: 18, lowStockThreshold: 10 },
  { name: "Bell Pepper", category: "vegetable", pricePaise: 2900, stock: 28, lowStockThreshold: 14 },
  { name: "Red Onion", category: "vegetable", pricePaise: 2500, stock: 30, lowStockThreshold: 14 },
  { name: "Mushroom", category: "vegetable", pricePaise: 3500, stock: 22, lowStockThreshold: 12 },
  { name: "Black Olive", category: "vegetable", pricePaise: 3900, stock: 20, lowStockThreshold: 10 },
  { name: "Spinach", category: "vegetable", pricePaise: 2900, stock: 24, lowStockThreshold: 12 },
  { name: "Jalapeño", category: "vegetable", pricePaise: 2900, stock: 18, lowStockThreshold: 10 }
];

const pizzas = [
  {
    id: "garden-classic",
    name: "Garden Classic",
    description: "Tomato basil, mozzarella, bell pepper, and red onion.",
    recipe: { base: "Classic Crust", sauce: "Tomato Basil", cheese: "Mozzarella", vegetables: ["Bell Pepper", "Red Onion"] }
  },
  {
    id: "wild-mushroom",
    name: "Wild Mushroom",
    description: "Pesto, aged cheddar, mushroom, and spinach.",
    recipe: { base: "Thin Crust", sauce: "Pesto", cheese: "Aged Cheddar", vegetables: ["Mushroom", "Spinach"] }
  },
  {
    id: "smoky-market",
    name: "Smoky Market",
    description: "Smoky BBQ, mozzarella, black olive, and jalapeño.",
    recipe: { base: "Pan Crust", sauce: "Smoky BBQ", cheese: "Mozzarella", vegetables: ["Black Olive", "Jalapeño"] }
  },
  {
    id: "green-table",
    name: "Green Table",
    description: "White garlic, vegan cheese, spinach, and bell pepper.",
    recipe: { base: "Whole Wheat", sauce: "White Garlic", cheese: "Vegan Cheese", vegetables: ["Spinach", "Bell Pepper"] }
  }
];

module.exports = { ingredients, pizzas };
