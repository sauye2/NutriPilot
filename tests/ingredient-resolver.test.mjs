import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeIngredientText,
  resolveIngredientMatch,
  resolveIngredientsBatch,
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
    foods: [food(401, "Chicken, broilers or fryers, breast, meat only, cooked, roasted", "Foundation")],
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
    match: ["lime juice", "lime juice raw", "juice lime"],
    foods: [food(1152, "Lime juice, raw", "SR Legacy")],
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
    foods: [food(1201, "Pork, fresh, belly, raw", "Foundation")],
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
  311: detailWithMacros(311, "Beef, top sirloin, separable lean and fat, trimmed to 1/8\" fat, choice, cooked, grilled", "SR Legacy", { calories: 206, protein: 28.6, carbs: 0, fat: 10.6 }, { piece: 170 }),
  401: detail(401, "Chicken, broilers or fryers, breast, meat only, cooked, roasted", "Foundation"),
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
  1001: detail(1001, "Cheese, cheddar", "Foundation", { cup: 113 }),
  1101: detail(1101, "Sauce, soy, made from soy and wheat", "SR Legacy", { tbsp: 16 }),
  1102: detailWithMacros(1102, "Sauce, fish", "SR Legacy", { calories: 35, protein: 6, carbs: 3.6, fat: 0 }, { tbsp: 18, tsp: 6 }),
  1103: detailWithMacros(1103, "Soup, chicken broth, ready-to-serve", "SR Legacy", { calories: 6, protein: 0.64, carbs: 0.44, fat: 0.21 }, { cup: 240, tbsp: 15, tsp: 5 }),
  1104: detailWithMacros(1104, "Chicken, canned, no broth", "SR Legacy", { calories: 185, protein: 23.2, carbs: 0.9, fat: 8.1 }, { cup: 140 }),
  1105: detailWithMacros(1105, "Soup, beef broth or bouillon, canned, ready-to-serve", "SR Legacy", { calories: 7, protein: 1.14, carbs: 0.04, fat: 0.22 }, { cup: 240, tbsp: 15, tsp: 5 }),
  1106: detailWithMacros(1106, "Soup, vegetable broth, ready to serve", "SR Legacy", { calories: 5, protein: 0.24, carbs: 0.93, fat: 0.07 }, { cup: 240, tbsp: 15, tsp: 5 }),
  1151: detail(1151, "Vinegar, rice", "SR Legacy", { tbsp: 15, tsp: 5 }),
  1152: detailWithMacros(1152, "Lime juice, raw", "SR Legacy", { calories: 25, protein: 0.4, carbs: 8.4, fat: 0.1 }, { tbsp: 15, tsp: 5, piece: 44 }),
  1161: detail(1161, "Oil, sesame, salad or cooking", "Foundation", { tbsp: 13.5, tsp: 4.5 }),
  1162: detailWithMacros(1162, "Nuts, coconut milk, canned (liquid expressed from grated meat and water)", "SR Legacy", { calories: 197, protein: 2.02, carbs: 2.81, fat: 21.3 }, { cup: 240, tbsp: 15, tsp: 5 }),
  1163: detailWithMacros(1163, "Coconut milk", "Survey (FNDDS)", { calories: 31, protein: 0.21, carbs: 2.92, fat: 2.08 }, { cup: 240, tbsp: 15, tsp: 5 }),
  1164: detailWithMacros(1164, "Salt, table", "SR Legacy", { calories: 0, protein: 0, carbs: 0, fat: 0 }, { tbsp: 18, tsp: 6 }),
  1171: detail(1171, "Spices, pepper, black", "SR Legacy", { tbsp: 6.8, tsp: 2.3 }),
  1173: detailWithMacros(1173, "Spices, cumin seed", "SR Legacy", { calories: 375, protein: 17.8, carbs: 44.2, fat: 22.3 }, { tbsp: 6, tsp: 2 }),
  1174: detailWithMacros(1174, "Spices, chili powder", "SR Legacy", { calories: 282, protein: 13.5, carbs: 49.7, fat: 14.3 }, { tbsp: 8, tsp: 2.7 }),
  1181: detail(1181, "Spices, pepper, red or cayenne", "SR Legacy", { tbsp: 6.8, tsp: 2.3 }),
  1182: detailWithMacros(1182, "Peppers, hot, raw", "Survey (FNDDS)", { calories: 40, protein: 2, carbs: 9.5, fat: 0.2 }, { piece: 14 }),
  1191: detail(1191, "Egg, whole, raw, fresh", "Foundation", { piece: 50 }),
  1201: detail(1201, "Pork, fresh, belly, raw", "Foundation"),
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

  assert.equal(oliveOil.canonicalQuery, "olive oil");
  assert.equal(groundBeef.canonicalQuery, "ground beef 90 percent lean");
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
  "lime juice",
  "sesame oil",
  "coconut milk",
  "salt",
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

test("preferCooked biases ambiguous proteins toward cooked USDA entries", async () => {
  const resolution = await resolveIngredientMatch("ground beef cooked", {
    preferCooked: true,
  });

  assert.ok(resolution.food);
  assert.equal(resolution.food?.description, "Beef, Ground, Unspecified Fat Content, Cooked");
  assert.equal(resolution.food?.per100g.calories, 254);
});

test("preferred pantry profiles keep spices and produce on sensible generic values", async () => {
  const [pepper, gochugaru, rice, eggs, oil, butter, heavyCream, halfAndHalf, chickenBroth, beefBroth, vegetableBroth, coconutMilk, salt, potatoes, starch, steak, onion, avocado, bellPepper, cumin, chili, limeJuice, scotchBonnet] = await Promise.all([
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
    resolveIngredientMatch("potatoes"),
    resolveIngredientMatch("cornstarch"),
    resolveIngredientMatch("sirloin steak"),
    resolveIngredientMatch("yellow onion"),
    resolveIngredientMatch("avocado"),
    resolveIngredientMatch("bell pepper"),
    resolveIngredientMatch("ground cumin"),
    resolveIngredientMatch("chili powder"),
    resolveIngredientMatch("lime juice"),
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
  assert.equal(potatoes.food?.per100g.calories, 77);
  assert.equal(starch.food?.gramsByUnit.tbsp, 8);
  assert.equal(steak.food?.per100g.calories, 206);
  assert.equal(onion.food?.gramsByUnit.piece, 110);
  assert.equal(avocado.food?.gramsByUnit.piece, 150);
  assert.equal(bellPepper.food?.gramsByUnit.piece, 119);
  assert.equal(cumin.food?.gramsByUnit.tsp, 2);
  assert.equal(chili.food?.gramsByUnit.tsp, 2.7);
  assert.equal(limeJuice.food?.gramsByUnit.tbsp, 15);
  assert.equal(scotchBonnet.food?.gramsByUnit.piece, 14);
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
