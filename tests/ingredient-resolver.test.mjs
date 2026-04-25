import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeIngredientText,
  resolveIngredientMatch,
  resolveIngredientsBatch,
  searchFoods,
} from "../src/lib/food-data-central.ts";

const originalFetch = globalThis.fetch;

const SEARCH_FIXTURES = [
  {
    match: ["hanger steak", "hanging tender", "beef steak", "beef flank steak raw", "beef skirt steak raw"],
    foods: [
      food(101, "Beef, hanging tender steak, separable lean only, trimmed to 0\" fat, choice, raw", "Foundation"),
      food(102, "Pepper steak, frozen meal", "Branded", "QuickBite"),
    ],
  },
  {
    match: ["olive oil"],
    foods: [
      food(201, "Oil, olive, salad or cooking", "Foundation"),
      food(202, "Extra virgin olive oil", "Branded", "Fancy Farm"),
    ],
  },
  {
    match: ["butter", "butter salted"],
    foods: [food(205, "Butter, salted", "SR Legacy")],
  },
  {
    match: ["neutral oil", "vegetable oil", "oil vegetable", "canola oil"],
    foods: [food(211, "Oil, vegetable, soybean, salad or cooking", "SR Legacy")],
  },
  {
    match: ["heavy cream", "cream heavy"],
    foods: [food(216, "Cream, heavy", "Survey (FNDDS)")],
  },
  {
    match: ["half and half", "cream half and half"],
    foods: [food(217, "Cream, fluid, half and half", "SR Legacy")],
  },
  {
    match: ["cornstarch", "corn starch"],
    foods: [food(212, "Cornstarch", "SR Legacy")],
  },
  {
    match: ["bell pepper", "bell pepper raw", "sweet pepper"],
    foods: [food(213, "Peppers, bell, green, raw", "Foundation")],
  },
  {
    match: ["yellow onion", "onions yellow raw", "onions raw"],
    foods: [food(214, "Onions, yellow, raw", "Foundation")],
  },
  {
    match: ["avocado", "avocados raw", "avocado raw"],
    foods: [food(215, "Avocados, raw, california", "SR Legacy")],
  },
  {
    match: ["white rice", "rice white", "rice"],
    foods: [
      food(301, "Rice, white, long-grain, regular, cooked", "SR Legacy"),
      food(302, "Rice bowl with vegetables", "Survey (FNDDS)"),
    ],
  },
  {
    match: ["potatoes raw", "potato raw"],
    foods: [food(303, "Potatoes, flesh and skin, raw", "SR Legacy")],
  },
  {
    match: ["apple", "apple raw", "apples raw"],
    foods: [
      food(2709215, "Apple, raw", "Survey (FNDDS)"),
      food(174988, "Croissants, apple", "SR Legacy"),
      food(175032, "Strudel, apple", "SR Legacy"),
      food(2709294, "Apple, candied", "Survey (FNDDS)"),
    ],
  },
  {
    match: ["pear", "pear raw", "pears raw"],
    foods: [
      food(2709254, "Pear, raw", "Survey (FNDDS)"),
      food(167718, "Babyfood, juice, pear", "SR Legacy"),
      food(168177, "Pears, asian, raw", "SR Legacy"),
      food(2709349, "Pear nectar", "Survey (FNDDS)"),
    ],
  },
  {
    match: ["sirloin steak", "beef top sirloin cooked", "beef sirloin steak cooked", "beef steak cooked"],
    foods: [
      food(
        311,
        "Beef, top sirloin, separable lean and fat, trimmed to 1/8\" fat, choice, cooked, grilled",
        "SR Legacy",
      ),
    ],
  },
  {
    match: ["chicken breast"],
    foods: [
      food(171477, "Chicken, broilers or fryers, breast, meat only, cooked, roasted", "SR Legacy"),
      food(171514, "Chicken breast tenders, breaded, cooked, microwaved", "SR Legacy"),
      food(2705954, "Chicken breast, NS as to cooking method, skin not eaten", "Survey (FNDDS)"),
      food(171075, "Chicken, broilers or fryers, breast, meat and skin, cooked, roasted", "SR Legacy"),
    ],
  },
  {
    match: ["beef ribeye lean and fat eaten", "beef ribeye cooked", "beef ribeye steak"],
    foods: [
      food(2705829, "Beef, steak, ribeye, lean and fat eaten", "Survey (FNDDS)"),
      food(2705830, "Beef, steak, ribeye, lean only eaten", "Survey (FNDDS)"),
      food(172599, "Game meat, bison, ribeye, separable lean only, 1\" steak, cooked, broiled", "SR Legacy"),
      food(2646172, "Beef, ribeye, steak, boneless, choice, raw", "Foundation"),
    ],
  },
  {
    match: ["fish salmon atlantic cooked dry heat", "fish salmon cooked dry heat", "salmon cooked"],
    foods: [
      food(175168, "Fish, salmon, Atlantic, farmed, cooked, dry heat", "SR Legacy"),
      food(171998, "Fish, salmon, Atlantic, wild, cooked, dry heat", "SR Legacy"),
      food(171999, "Fish, salmon, chinook, cooked, dry heat", "SR Legacy"),
      food(173750, "Fish oil, salmon", "SR Legacy"),
      food(173722, "Salmon nuggets, cooked as purchased, unheated", "SR Legacy"),
    ],
  },
  {
    match: ["spices lemon grass citronella raw", "citronella raw"],
    foods: [
      food(168573, "Lemon grass (citronella), raw", "SR Legacy"),
      food(2709168, "Lemon, raw", "Survey (FNDDS)"),
    ],
  },
  {
    match: ["roma tomato", "tomato"],
    foods: [food(501, "Tomatoes, red, ripe, raw, year round average", "Foundation")],
  },
  {
    match: ["baby bella mushrooms", "mushrooms"],
    foods: [food(601, "Mushrooms, white, raw", "Foundation")],
  },
  {
    match: ["basil fresh", "basil raw"],
    foods: [food(611, "Basil, fresh", "Foundation")],
  },
  {
    match: ["parsley fresh", "parsley raw"],
    foods: [food(612, "Parsley, fresh", "Foundation")],
  },
  {
    match: ["mint fresh", "mint raw"],
    foods: [food(613, "Mint, fresh", "Foundation")],
  },
  {
    match: ["okra raw"],
    foods: [food(614, "Okra, raw", "Foundation")],
  },
  {
    match: ["plantains raw", "plantain raw"],
    foods: [food(615, "Plantains, raw", "SR Legacy")],
  },
  {
    match: ["cassava raw", "yuca raw"],
    foods: [food(616, "Cassava, raw", "SR Legacy")],
  },
  {
    match: ["greek yogurt", "yogurt greek"],
    foods: [food(701, "Yogurt, Greek, plain, nonfat", "SR Legacy")],
  },
  {
    match: ["scallions", "green onions"],
    foods: [food(801, "Onions, young green, tops and bulb, raw", "Foundation")],
  },
  {
    match: ["ground beef 90 percent lean", "ground beef 90% lean"],
    foods: [
      food(901, "Beef, ground, 90% lean meat / 10% fat, raw", "SR Legacy"),
      food(902, "Beef, ground, 70% lean meat / 30% fat, raw", "SR Legacy"),
    ],
  },
  {
    match: ["ground beef cooked"],
    foods: [food(903, "Beef, ground, unspecified fat content, cooked", "SR Legacy")],
  },
  {
    match: ["shredded cheddar cheese", "cheddar cheese"],
    foods: [food(1001, "Cheese, cheddar", "Foundation")],
  },
  {
    match: ["soy sauce"],
    foods: [food(1101, "Sauce, soy, made from soy and wheat", "SR Legacy")],
  },
  {
    match: ["fish sauce", "sauce fish"],
    foods: [food(1102, "Sauce, fish", "SR Legacy")],
  },
  {
    match: ["chicken broth", "chicken broth ready to serve", "soup chicken broth ready-to-serve"],
    foods: [
      food(1103, "Soup, chicken broth, ready-to-serve", "SR Legacy"),
      food(1104, "Chicken, canned, no broth", "SR Legacy"),
    ],
  },
  {
    match: ["beef broth", "beef broth ready to serve", "soup beef broth ready-to-serve"],
    foods: [food(1105, "Soup, beef broth or bouillon, canned, ready-to-serve", "SR Legacy")],
  },
  {
    match: ["vegetable broth", "vegetable broth ready to serve", "soup vegetable broth ready to serve"],
    foods: [food(1106, "Soup, vegetable broth, ready to serve", "SR Legacy")],
  },
  {
    match: ["rice vinegar", "vinegar rice", "vinegar rice wine"],
    foods: [food(1151, "Vinegar, rice", "SR Legacy")],
  },
  {
    match: ["lemon", "lemon raw", "lemons raw without peel"],
    foods: [food(1153, "Lemons, raw, without peel", "SR Legacy")],
  },
  {
    match: ["lime juice", "lime juice raw", "juice lime"],
    foods: [food(1152, "Lime juice, raw", "SR Legacy")],
  },
  {
    match: ["lime", "lime raw", "limes raw"],
    foods: [food(1154, "Limes, raw", "SR Legacy")],
  },
  {
    match: ["sesame oil", "oil sesame", "sesame seed oil"],
    foods: [food(1161, "Oil, sesame, salad or cooking", "Foundation")],
  },
  {
    match: ["coconut milk", "coconut milk canned", "nuts coconut milk canned liquid expressed from grated meat and water"],
    foods: [
      food(1162, "Nuts, coconut milk, canned (liquid expressed from grated meat and water)", "SR Legacy"),
      food(1163, "Coconut milk", "Survey (FNDDS)"),
    ],
  },
  {
    match: ["salt", "salt table"],
    foods: [food(1164, "Salt, table", "SR Legacy")],
  },
  {
    match: ["water", "water tap"],
    foods: [
      food(1165, "Water, tap", "Survey (FNDDS)"),
      food(1166, "Crackers, water", "Survey (FNDDS)"),
    ],
  },
  {
    match: ["black pepper", "spices pepper black", "pepper black"],
    foods: [
      food(1171, "Spices, pepper, black", "SR Legacy"),
      food(1172, "Black pepper crackers", "Branded", "CrunchCo"),
    ],
  },
  {
    match: ["ground cumin", "cumin", "spices cumin seed", "cumin seed"],
    foods: [food(1173, "Spices, cumin seed", "SR Legacy")],
  },
  {
    match: ["chili powder", "spices chili powder"],
    foods: [food(1174, "Spices, chili powder", "SR Legacy")],
  },
  {
    match: ["gochugaru", "pepper red or cayenne", "red pepper flakes", "chili flakes"],
    foods: [food(1181, "Spices, pepper, red or cayenne", "SR Legacy")],
  },
  {
    match: ["scotch bonnet pepper", "scotch bonnet", "peppers hot raw", "hot pepper raw", "jalapeno pepper raw"],
    foods: [food(1182, "Peppers, hot, raw", "Survey (FNDDS)")],
  },
  {
    match: ["egg", "eggs whole raw", "egg whole raw"],
    foods: [
      food(1191, "Egg, whole, raw, fresh", "Foundation"),
      food(1192, "Egg yolk, raw, fresh", "Foundation"),
    ],
  },
  {
    match: ["pork belly", "pork fresh belly", "pork"],
    foods: [
      food(1201, "Pork, fresh, belly, raw", "Foundation"),
      food(1202, "Sausage, Italian, pork, mild, cooked, pan-fried", "Foundation"),
      food(1203, "Sausage, pork, chorizo, link or ground, cooked, pan-fried", "Foundation"),
      food(1204, "Pork, pickled pork hocks", "SR Legacy"),
    ],
  },
  {
    match: ["pork nfs", "pork loin raw", "pork shoulder raw"],
    foods: [
      food(2705862, "Pork, NFS", "Survey (FNDDS)"),
      food(2646168, "Pork, loin, boneless, raw", "Foundation"),
      food(167843, "Pork, fresh, shoulder, whole, separable lean and fat, raw", "SR Legacy"),
      food(169157, "Pork, pickled pork hocks", "SR Legacy"),
      food(168287, "Pork, cured, salt pork, raw", "SR Legacy"),
      food(2705895, "Pork, cracklings", "Survey (FNDDS)"),
    ],
  },
];

const DETAIL_FIXTURES = {
  101: detail(101, "Beef, hanging tender steak, separable lean only, trimmed to 0\" fat, choice, raw", "Foundation"),
  201: detail(201, "Oil, olive, salad or cooking", "Foundation", { tbsp: 13.5, tsp: 4.5 }),
  205: detailWithMacros(205, "Butter, salted", "SR Legacy", { calories: 717, protein: 0.9, carbs: 0.1, fat: 81.1 }, { tbsp: 14.2, tsp: 4.7 }),
  211: detailWithMacros(211, "Oil, vegetable, soybean, salad or cooking", "SR Legacy", { calories: 884, protein: 0, carbs: 0, fat: 100 }, { tbsp: 13.6, tsp: 4.5 }),
  216: detailWithMacros(216, "Cream, heavy", "Survey (FNDDS)", { calories: 343, protein: 2.02, carbs: 3.8, fat: 35.56 }, { tbsp: 15, tsp: 5, cup: 238 }),
  217: detailWithMacros(217, "Cream, fluid, half and half", "SR Legacy", { calories: 123, protein: 3.13, carbs: 4.73, fat: 10.53 }, { tbsp: 15, tsp: 5, cup: 242 }),
  212: detailWithMacros(212, "Cornstarch", "SR Legacy", { calories: 381, protein: 0.3, carbs: 91.3, fat: 0.1 }, { tbsp: 8, tsp: 2.7 }),
  213: detailWithMacros(213, "Peppers, bell, green, raw", "Foundation", { calories: 20, protein: 0.86, carbs: 4.64, fat: 0.17 }, { piece: 119, cup: 92 }),
  214: detailWithMacros(214, "Onions, yellow, raw", "Foundation", { calories: 37, protein: 0.77, carbs: 8.61, fat: 0.09 }, { piece: 110, cup: 160 }),
  215: detailWithMacros(215, "Avocados, raw, california", "SR Legacy", { calories: 167, protein: 2, carbs: 8.6, fat: 15.4 }, { piece: 150, cup: 150 }),
  301: detail(301, "Rice, white, long-grain, regular, cooked", "SR Legacy", { cup: 158 }),
  303: detailWithMacros(303, "Potatoes, flesh and skin, raw", "SR Legacy", { calories: 77, protein: 2, carbs: 17.5, fat: 0.1 }, { piece: 173, cup: 150 }),
  2709215: detailWithMacros(2709215, "Apple, raw", "Survey (FNDDS)", { calories: 61, protein: 0.17, carbs: 14.8, fat: 0.15 }, { piece: 182, cup: 125 }),
  2709254: detailWithMacros(2709254, "Pear, raw", "Survey (FNDDS)", { calories: 59, protein: 0.37, carbs: 15.2, fat: 0.15 }, { piece: 178, cup: 140 }),
  311: detailWithMacros(311, "Beef, top sirloin, separable lean and fat, trimmed to 1/8\" fat, choice, cooked, grilled", "SR Legacy", { calories: 206, protein: 28.6, carbs: 0, fat: 10.6 }, { piece: 170 }),
  401: detail(401, "Chicken, broilers or fryers, breast, meat only, cooked, roasted", "Foundation"),
  171477: detailWithMacros(171477, "Chicken, broilers or fryers, breast, meat only, cooked, roasted", "SR Legacy", { calories: 165, protein: 31.02, carbs: 0, fat: 3.57 }, { piece: 120 }),
  171075: detailWithMacros(171075, "Chicken, broilers or fryers, breast, meat and skin, cooked, roasted", "SR Legacy", { calories: 197, protein: 30.5, carbs: 0, fat: 7.7 }, { piece: 120 }),
  2705954: detailWithMacros(2705954, "Chicken breast, NS as to cooking method, skin not eaten", "Survey (FNDDS)", { calories: 172, protein: 29.8, carbs: 0, fat: 5.4 }, { piece: 120 }),
  501: detail(501, "Tomatoes, red, ripe, raw, year round average", "Foundation", { piece: 123 }),
  601: detail(601, "Mushrooms, white, raw", "Foundation", { cup: 70 }),
  611: detailWithMacros(611, "Basil, fresh", "Foundation", { calories: 23, protein: 3.2, carbs: 2.7, fat: 0.6 }, { cup: 21 }),
  612: detailWithMacros(612, "Parsley, fresh", "Foundation", { calories: 36, protein: 3, carbs: 6.3, fat: 0.8 }, { cup: 30 }),
  613: detailWithMacros(613, "Mint, fresh", "Foundation", { calories: 44, protein: 3.3, carbs: 8.4, fat: 0.7 }, { cup: 25 }),
  614: detailWithMacros(614, "Okra, raw", "Foundation", { calories: 33, protein: 1.9, carbs: 7.5, fat: 0.2 }, { piece: 12, cup: 100 }),
  615: detailWithMacros(615, "Plantains, raw", "SR Legacy", { calories: 122, protein: 1.3, carbs: 32, fat: 0.4 }, { piece: 179, cup: 148 }),
  616: detailWithMacros(616, "Cassava, raw", "SR Legacy", { calories: 160, protein: 1.4, carbs: 38.1, fat: 0.3 }, { cup: 103, piece: 250 }),
  701: detail(701, "Yogurt, Greek, plain, nonfat", "SR Legacy", { cup: 245 }),
  801: detail(801, "Onions, young green, tops and bulb, raw", "Foundation", { cup: 100 }),
  901: detail(901, "Beef, ground, 90% lean meat / 10% fat, raw", "SR Legacy"),
  903: detailWithMacros(903, "Beef, ground, unspecified fat content, cooked", "SR Legacy", { calories: 254, protein: 25.9, carbs: 0, fat: 17.4 }, { g: 1 }),
  2705829: detailWithMacros(2705829, "Beef, steak, ribeye, lean and fat eaten", "Survey (FNDDS)", { calories: 289, protein: 23.5, carbs: 0, fat: 21.6 }, { piece: 150 }),
  2705830: detailWithMacros(2705830, "Beef, steak, ribeye, lean only eaten", "Survey (FNDDS)", { calories: 230, protein: 26.5, carbs: 0, fat: 13.8 }, { piece: 150 }),
  1001: detail(1001, "Cheese, cheddar", "Foundation", { cup: 113 }),
  1101: detail(1101, "Sauce, soy, made from soy and wheat", "SR Legacy", { tbsp: 16 }),
  1102: detailWithMacros(1102, "Sauce, fish", "SR Legacy", { calories: 35, protein: 6, carbs: 3.6, fat: 0 }, { tbsp: 18, tsp: 6 }),
  1103: detailWithMacros(1103, "Soup, chicken broth, ready-to-serve", "SR Legacy", { calories: 6, protein: 0.64, carbs: 0.44, fat: 0.21 }, { cup: 240, tbsp: 15, tsp: 5 }),
  1104: detailWithMacros(1104, "Chicken, canned, no broth", "SR Legacy", { calories: 185, protein: 23.2, carbs: 0.9, fat: 8.1 }, { cup: 140 }),
  1105: detailWithMacros(1105, "Soup, beef broth or bouillon, canned, ready-to-serve", "SR Legacy", { calories: 7, protein: 1.14, carbs: 0.04, fat: 0.22 }, { cup: 240, tbsp: 15, tsp: 5 }),
  1106: detailWithMacros(1106, "Soup, vegetable broth, ready to serve", "SR Legacy", { calories: 5, protein: 0.24, carbs: 0.93, fat: 0.07 }, { cup: 240, tbsp: 15, tsp: 5 }),
  1151: detail(1151, "Vinegar, rice", "SR Legacy", { tbsp: 15, tsp: 5 }),
  1152: detailWithMacros(1152, "Lime juice, raw", "SR Legacy", { calories: 25, protein: 0.4, carbs: 8.4, fat: 0.1 }, { tbsp: 15, tsp: 5, piece: 44 }),
  1153: detailWithMacros(1153, "Lemons, raw, without peel", "SR Legacy", { calories: 29, protein: 1.1, carbs: 9.32, fat: 0.3 }, { piece: 58, tbsp: 15, tsp: 5 }),
  1154: detailWithMacros(1154, "Limes, raw", "SR Legacy", { calories: 30, protein: 0.7, carbs: 10.5, fat: 0.2 }, { piece: 67, tbsp: 15, tsp: 5 }),
  1161: detail(1161, "Oil, sesame, salad or cooking", "Foundation", { tbsp: 13.5, tsp: 4.5 }),
  1162: detailWithMacros(1162, "Nuts, coconut milk, canned (liquid expressed from grated meat and water)", "SR Legacy", { calories: 197, protein: 2.02, carbs: 2.81, fat: 21.3 }, { cup: 240, tbsp: 15, tsp: 5 }),
  1163: detailWithMacros(1163, "Coconut milk", "Survey (FNDDS)", { calories: 31, protein: 0.21, carbs: 2.92, fat: 2.08 }, { cup: 240, tbsp: 15, tsp: 5 }),
  1164: detailWithMacros(1164, "Salt, table", "SR Legacy", { calories: 0, protein: 0, carbs: 0, fat: 0 }, { tbsp: 18, tsp: 6 }),
  1165: detailWithMacros(1165, "Water, tap", "Survey (FNDDS)", { calories: 0, protein: 0, carbs: 0, fat: 0 }, { cup: 237, tbsp: 15, tsp: 5 }),
  1166: detailWithMacros(1166, "Crackers, water", "Survey (FNDDS)", { calories: 384, protein: 9.5, carbs: 72.2, fat: 8.7 }, { piece: 6 }),
  1171: detail(1171, "Spices, pepper, black", "SR Legacy", { tbsp: 6.8, tsp: 2.3 }),
  1173: detailWithMacros(1173, "Spices, cumin seed", "SR Legacy", { calories: 375, protein: 17.8, carbs: 44.2, fat: 22.3 }, { tbsp: 6, tsp: 2 }),
  1174: detailWithMacros(1174, "Spices, chili powder", "SR Legacy", { calories: 282, protein: 13.5, carbs: 49.7, fat: 14.3 }, { tbsp: 8, tsp: 2.7 }),
  1181: detail(1181, "Spices, pepper, red or cayenne", "SR Legacy", { tbsp: 6.8, tsp: 2.3 }),
  1182: detailWithMacros(1182, "Peppers, hot, raw", "Survey (FNDDS)", { calories: 40, protein: 2, carbs: 9.5, fat: 0.2 }, { piece: 14 }),
  1191: detail(1191, "Egg, whole, raw, fresh", "Foundation", { piece: 50 }),
  1201: detail(1201, "Pork, fresh, belly, raw", "Foundation"),
  2705862: detailWithMacros(2705862, "Pork, NFS", "Survey (FNDDS)", { calories: 192, protein: 27.1, carbs: 0, fat: 8.67 }, { piece: 85 }),
  2646168: detailWithMacros(2646168, "Pork, loin, boneless, raw", "Foundation", { calories: 143, protein: 21.4, carbs: 0, fat: 5.4 }, { piece: 120 }),
  167843: detailWithMacros(167843, "Pork, fresh, shoulder, whole, separable lean and fat, raw", "SR Legacy", { calories: 212, protein: 17.9, carbs: 0, fat: 15.2 }, { piece: 120 }),
  168573: detailWithMacros(168573, "Lemon grass (citronella), raw", "SR Legacy", { calories: 99, protein: 1.82, carbs: 25.31, fat: 0.49 }, { piece: 67, cup: 67, tbsp: 5, tsp: 1.7 }),
  175168: detailWithMacros(175168, "Fish, salmon, Atlantic, farmed, cooked, dry heat", "SR Legacy", { calories: 206, protein: 22.1, carbs: 0, fat: 12.35 }, { piece: 154 }),
  171998: detailWithMacros(171998, "Fish, salmon, Atlantic, wild, cooked, dry heat", "SR Legacy", { calories: 182, protein: 25.4, carbs: 0, fat: 8.13 }, { piece: 154 }),
};

test.before(() => {
  process.env.USDA_FOODDATA_API_KEY = "test-key";
  globalThis.fetch = async (input, init) => {
    const url = String(input);

    if (url.includes("/foods/search")) {
      const body = JSON.parse(init?.body ?? "{}");
      const query = String(body.query ?? "").toLowerCase();
      const fixture = SEARCH_FIXTURES.find((entry) =>
        entry.match.some((term) => query.includes(term)),
      );

      return Response.json({ foods: fixture?.foods ?? [] });
    }

    if (url.includes("/food/")) {
      const match = url.match(/\/food\/(\d+)/);
      const id = match ? Number(match[1]) : NaN;
      return Response.json(DETAIL_FIXTURES[id] ?? {});
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };
});

test.after(() => {
  globalThis.fetch = originalFetch;
});

test("normalization preserves meaningful descriptors and strips recipe noise", () => {
  const oliveOil = normalizeIngredientText("2 tbsp extra virgin olive oil");
  const groundBeef = normalizeIngredientText("1 lb 90/10 ground beef");
  const filteredWater = normalizeIngredientText("2 cups filtered water");

  assert.equal(oliveOil.canonicalQuery, "olive oil");
  assert.equal(groundBeef.canonicalQuery, "ground beef 90 percent lean");
  assert.equal(filteredWater.canonicalQuery, "water");
});

for (const ingredient of [
  "hanger steak",
  "extra virgin olive oil",
  "butter",
  "neutral oil",
  "heavy cream",
  "half and half",
  "cornstarch",
  "bell pepper",
  "yellow onion",
  "avocado",
  "white rice",
  "potatoes",
  "apple",
  "pear",
  "pork",
  "sirloin steak",
  "chicken breast",
  "roma tomatoes",
  "baby bella mushrooms",
  "fish sauce",
  "chicken broth",
  "beef broth",
  "vegetable broth",
  "greek yogurt",
  "scallions",
  "90/10 ground beef",
  "shredded cheddar cheese",
  "soy sauce",
  "rice vinegar",
  "lemon",
  "lemongrass",
  "lime juice",
  "lime",
  "sesame oil",
  "coconut milk",
  "salt",
  "water",
  "black pepper",
  "ground cumin",
  "chili powder",
  "gochugaru",
  "scotch bonnet pepper",
  "eggs",
  "pork belly",
]) {
  test(`auto-matches ${ingredient} without requiring review`, async () => {
    const resolution = await resolveIngredientMatch(ingredient);

    assert.ok(resolution.food, `${ingredient} should resolve to a USDA food`);
    assert.equal(resolution.needsReview, false);
    assert.ok(resolution.confidence >= 0.44);
    assert.ok(
      ["Foundation", "SR Legacy", "Survey (FNDDS)"].includes(
        resolution.matchedDataType ?? "",
      ),
    );
  });
}

for (const ingredient of [
  "shallot",
  "red onion",
  "serrano pepper",
  "poblano pepper",
  "fresno pepper",
  "thai basil",
  "parsley",
  "mint",
  "okra",
  "plantain",
  "cassava",
  "chicken stock",
  "vegetable stock",
  "kosher salt",
  "sea salt",
]) {
  test(`falls back to a usable generic family match for ${ingredient}`, async () => {
    const resolution = await resolveIngredientMatch(ingredient);

    assert.ok(resolution.food, `${ingredient} should still resolve to a usable USDA food`);
    assert.equal(resolution.needsReview, false);
    assert.ok(resolution.confidence >= 0.5);
  });
}

test("batch resolution keeps common ingredients auto-matched", async () => {
  const results = await resolveIngredientsBatch([
    "hanger steak",
    "white rice",
    "extra virgin olive oil",
  ]);

  assert.equal(results.length, 3);
  assert.equal(results.filter((item) => item.needsReview).length, 0);
  assert.equal(results.every((item) => item.food), true);
});

test("common protein searches surface sensible generic options first", async () => {
  const [chickenResults, ribeyeResults, salmonResults, porkResults, appleResults, pearResults] = await Promise.all([
    searchFoods("chicken breast", { preferCooked: true }),
    searchFoods("ribeye", { preferCooked: true }),
    searchFoods("salmon", { preferCooked: true }),
    searchFoods("pork"),
    searchFoods("apple"),
    searchFoods("pear"),
  ]);

  assert.equal(chickenResults[0]?.description, "Chicken, Broilers Or Fryers, Breast, Meat Only, Cooked, Roasted");
  assert.ok(chickenResults.every((result) => !/tenders|breaded/i.test(result.description)));

  assert.equal(ribeyeResults[0]?.description, "Beef, Steak, Ribeye, Lean And Fat Eaten");
  assert.ok(ribeyeResults.slice(0, 2).every((result) => /beef/i.test(result.description)));

  assert.equal(salmonResults[0]?.description, "Fish, Salmon, Atlantic, Farmed, Cooked, Dry Heat");
  assert.ok(salmonResults.every((result) => !/fish oil/i.test(result.description)));

  assert.equal(porkResults[0]?.description, "Pork, NFS");
  assert.ok(porkResults.every((result) => !/sausage|chorizo|pickled|hocks|cracklings/i.test(result.description)));

  assert.equal(appleResults[0]?.description, "Apple, Raw");
  assert.ok(appleResults.every((result) => !/croissant|strudel|candied|pie/i.test(result.description)));

  assert.equal(pearResults[0]?.description, "Pear, Raw");
  assert.ok(pearResults.every((result) => !/babyfood|juice|nectar/i.test(result.description)));
});

test("common protein auto-matches use sensible cooked generic profiles", async () => {
  const [chicken, ribeye, salmon, pork, apple, pear] = await Promise.all([
    resolveIngredientMatch("chicken breast", { preferCooked: true }),
    resolveIngredientMatch("ribeye", { preferCooked: true }),
    resolveIngredientMatch("salmon", { preferCooked: true }),
    resolveIngredientMatch("pork"),
    resolveIngredientMatch("apple"),
    resolveIngredientMatch("pear"),
  ]);

  assert.equal(chicken.food?.description, "Chicken, Broilers Or Fryers, Breast, Meat Only, Cooked, Roasted");
  assert.equal(chicken.food?.per100g.calories, 165);

  assert.equal(ribeye.food?.description, "Beef, Steak, Ribeye, Lean And Fat Eaten");
  assert.equal(ribeye.food?.per100g.calories, 289);

  assert.equal(salmon.food?.description, "Fish, Salmon, Atlantic, Farmed, Cooked, Dry Heat");
  assert.equal(salmon.food?.per100g.calories, 206);

  assert.equal(pork.food?.description, "Pork, NFS");
  assert.equal(pork.food?.per100g.calories, 192);

  assert.equal(apple.food?.description, "Apple, Raw");
  assert.equal(apple.food?.per100g.calories, 61);

  assert.equal(pear.food?.description, "Pear, Raw");
  assert.equal(pear.food?.per100g.calories, 59);
});

test("preferCooked biases ambiguous proteins toward cooked USDA entries", async () => {
  const resolution = await resolveIngredientMatch("ground beef cooked", {
    preferCooked: true,
  });

  assert.ok(resolution.food);
  assert.equal(resolution.food?.description, "Beef, Ground, Unspecified Fat Content, Cooked");
  assert.equal(resolution.food?.per100g.calories, 254);
});

test("preferred pantry profiles keep spices and produce on sensible generic values", async () => {
  const [pepper, gochugaru, rice, eggs, oil, butter, heavyCream, halfAndHalf, chickenBroth, beefBroth, vegetableBroth, coconutMilk, salt, water, potatoes, starch, steak, onion, avocado, bellPepper, cumin, chili, lemon, lemongrass, limeJuice, lime, scotchBonnet] = await Promise.all([
    resolveIngredientMatch("black pepper"),
    resolveIngredientMatch("gochugaru"),
    resolveIngredientMatch("rice cooked"),
    resolveIngredientMatch("eggs"),
    resolveIngredientMatch("neutral oil"),
    resolveIngredientMatch("butter"),
    resolveIngredientMatch("heavy cream"),
    resolveIngredientMatch("half and half"),
    resolveIngredientMatch("chicken broth"),
    resolveIngredientMatch("beef broth"),
    resolveIngredientMatch("vegetable broth"),
    resolveIngredientMatch("coconut milk"),
    resolveIngredientMatch("salt"),
    resolveIngredientMatch("water"),
    resolveIngredientMatch("potatoes"),
    resolveIngredientMatch("cornstarch"),
    resolveIngredientMatch("sirloin steak"),
    resolveIngredientMatch("yellow onion"),
    resolveIngredientMatch("avocado"),
    resolveIngredientMatch("bell pepper"),
    resolveIngredientMatch("ground cumin"),
    resolveIngredientMatch("chili powder"),
    resolveIngredientMatch("lemon"),
    resolveIngredientMatch("lemongrass"),
    resolveIngredientMatch("lime juice"),
    resolveIngredientMatch("lime"),
    resolveIngredientMatch("scotch bonnet pepper"),
  ]);

  assert.equal(pepper.matchedFoodId, 170931);
  assert.equal(pepper.food?.per100g.calories, 251);
  assert.equal(gochugaru.matchedFoodId, 170932);
  assert.equal(gochugaru.food?.gramsByUnit.tbsp, 6.8);
  assert.equal(rice.matchedFoodId, 168878);
  assert.equal(eggs.matchedFoodId, 171287);
  assert.equal(oil.food?.gramsByUnit.tbsp, 13.6);
  assert.equal(butter.food?.per100g.calories, 717);
  assert.equal(butter.food?.gramsByUnit.tbsp, 14.2);
  assert.equal(heavyCream.food?.per100g.calories, 343);
  assert.equal(heavyCream.food?.gramsByUnit.tbsp, 15);
  assert.equal(halfAndHalf.food?.per100g.calories, 123);
  assert.equal(chickenBroth.food?.per100g.calories, 6);
  assert.equal(chickenBroth.food?.gramsByUnit.cup, 240);
  assert.equal(beefBroth.food?.per100g.calories, 7);
  assert.equal(vegetableBroth.food?.per100g.calories, 5);
  assert.equal(coconutMilk.food?.per100g.calories, 197);
  assert.equal(coconutMilk.food?.gramsByUnit.cup, 240);
  assert.equal(salt.food?.per100g.calories, 0);
  assert.equal(salt.food?.gramsByUnit.tsp, 6);
  assert.equal(water.food?.per100g.calories, 0);
  assert.equal(water.food?.gramsByUnit.cup, 237);
  assert.equal(potatoes.food?.per100g.calories, 77);
  assert.equal(starch.food?.gramsByUnit.tbsp, 8);
  assert.equal(steak.food?.per100g.calories, 206);
  assert.equal(onion.food?.gramsByUnit.piece, 110);
  assert.equal(avocado.food?.gramsByUnit.piece, 150);
  assert.equal(bellPepper.food?.gramsByUnit.piece, 119);
  assert.equal(cumin.food?.gramsByUnit.tsp, 2);
  assert.equal(chili.food?.gramsByUnit.tsp, 2.7);
  assert.equal(lemon.food?.per100g.calories, 29);
  assert.equal(lemon.food?.gramsByUnit.piece, 58);
  assert.equal(lemongrass.food?.per100g.calories, 99);
  assert.equal(lemongrass.food?.description, "Lemon Grass (Citronella), Raw");
  assert.equal(limeJuice.food?.gramsByUnit.tbsp, 15);
  assert.equal(lime.food?.per100g.calories, 30);
  assert.equal(scotchBonnet.food?.gramsByUnit.piece, 14);
});

for (const ingredient of [
  "water",
  "tap water",
  "plain water",
  "filtered water",
  "2 cups water",
]) {
  test(`${ingredient} resolves to the plain water profile with zero macros`, async () => {
    const resolution = await resolveIngredientMatch(ingredient);

    assert.ok(resolution.food, `${ingredient} should resolve to a USDA water entry`);
    assert.equal(resolution.food?.description, "Water, Tap");
    assert.equal(resolution.food?.per100g.calories, 0);
    assert.equal(resolution.food?.per100g.protein, 0);
    assert.equal(resolution.food?.per100g.carbs, 0);
    assert.equal(resolution.food?.per100g.fat, 0);
    assert.equal(resolution.needsReview, false);
  });
}

test("water never prefers water crackers", async () => {
  const resolution = await resolveIngredientMatch("water");

  assert.equal(resolution.food?.description, "Water, Tap");
  assert.ok(
    resolution.candidates.every((candidate) => candidate.description !== "Crackers, Water"),
    "water crackers should never surface once the preferred water profile is selected",
  );
});

test("generated meal hydration math stays at zero for water", async () => {
  const resolution = await resolveIngredientMatch("2 cups water");

  assert.ok(resolution.food);

  const grams = (resolution.food?.gramsByUnit.cup ?? 0) * 2;
  const calories = (grams * (resolution.food?.per100g.calories ?? 0)) / 100;
  const protein = (grams * (resolution.food?.per100g.protein ?? 0)) / 100;
  const carbs = (grams * (resolution.food?.per100g.carbs ?? 0)) / 100;
  const fat = (grams * (resolution.food?.per100g.fat ?? 0)) / 100;

  assert.equal(calories, 0);
  assert.equal(protein, 0);
  assert.equal(carbs, 0);
  assert.equal(fat, 0);
});

test("category fallback keeps future ingredient families from losing nutrition data", async () => {
  const [shallot, redOnion, serrano, poblano, fresno, thaiBasil, parsley, mint, okra, plantain, cassava, fishSauce, chickenStock, vegetableStock, kosherSalt, seaSalt] = await Promise.all([
    resolveIngredientMatch("shallot"),
    resolveIngredientMatch("red onion"),
    resolveIngredientMatch("serrano pepper"),
    resolveIngredientMatch("poblano pepper"),
    resolveIngredientMatch("fresno pepper"),
    resolveIngredientMatch("thai basil"),
    resolveIngredientMatch("parsley"),
    resolveIngredientMatch("mint"),
    resolveIngredientMatch("okra"),
    resolveIngredientMatch("plantain"),
    resolveIngredientMatch("cassava"),
    resolveIngredientMatch("fish sauce"),
    resolveIngredientMatch("chicken stock"),
    resolveIngredientMatch("vegetable stock"),
    resolveIngredientMatch("kosher salt"),
    resolveIngredientMatch("sea salt"),
  ]);

  assert.equal(shallot.food?.description, "Onions, Yellow, Raw");
  assert.equal(redOnion.food?.description, "Onions, Yellow, Raw");
  assert.equal(serrano.food?.description, "Peppers, Hot, Raw");
  assert.equal(poblano.food?.description, "Peppers, Hot, Raw");
  assert.equal(fresno.food?.description, "Peppers, Hot, Raw");
  assert.equal(thaiBasil.food?.description, "Basil, Fresh");
  assert.equal(parsley.food?.description, "Parsley, Fresh");
  assert.equal(mint.food?.description, "Mint, Fresh");
  assert.equal(okra.food?.description, "Okra, Raw");
  assert.equal(plantain.food?.description, "Plantains, Raw");
  assert.equal(cassava.food?.description, "Cassava, Raw");
  assert.equal(fishSauce.food?.description, "Sauce, Fish");
  assert.equal(chickenStock.food?.description, "Soup, Chicken Broth, Ready-To-Serve");
  assert.equal(vegetableStock.food?.description, "Soup, Vegetable Broth, Ready To Serve");
  assert.equal(kosherSalt.food?.description, "Salt, Table");
  assert.equal(seaSalt.food?.description, "Salt, Table");
});

function food(fdcId, description, dataType, brandName = undefined) {
  return {
    fdcId,
    description,
    dataType,
    brandName,
  };
}

function detail(fdcId, description, dataType, gramsByUnit = { g: 1, piece: 100 }) {
  return detailWithMacros(
    fdcId,
    description,
    dataType,
    { calories: 200, protein: 20, carbs: 10, fat: 8 },
    gramsByUnit,
  );
}

function detailWithMacros(fdcId, description, dataType, per100g, gramsByUnit = { g: 1, piece: 100 }) {
  const foodPortions = [];

  for (const [unit, grams] of Object.entries(gramsByUnit)) {
    if (unit === "g") {
      continue;
    }

    foodPortions.push({
      amount: 1,
      gramWeight: grams,
      modifier: unit,
      measureUnit: {
        name: unit,
        abbreviation: unit,
      },
    });
  }

  return {
    fdcId,
    description,
    dataType,
    foodNutrients: [
      { nutrient: { id: 1008 }, amount: per100g.calories },
      { nutrient: { id: 1003 }, amount: per100g.protein },
      { nutrient: { id: 1005 }, amount: per100g.carbs },
      { nutrient: { id: 1004 }, amount: per100g.fat },
    ],
    foodPortions,
  };
}
