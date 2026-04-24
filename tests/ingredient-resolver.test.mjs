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
    match: ["neutral oil", "vegetable oil", "oil vegetable", "canola oil"],
    foods: [food(211, "Oil, vegetable, soybean, salad or cooking", "SR Legacy")],
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
  211: detailWithMacros(211, "Oil, vegetable, soybean, salad or cooking", "SR Legacy", { calories: 884, protein: 0, carbs: 0, fat: 100 }, { tbsp: 13.6, tsp: 4.5 }),
  212: detailWithMacros(212, "Cornstarch", "SR Legacy", { calories: 381, protein: 0.3, carbs: 91.3, fat: 0.1 }, { tbsp: 8, tsp: 2.7 }),
  213: detailWithMacros(213, "Peppers, bell, green, raw", "Foundation", { calories: 20, protein: 0.86, carbs: 4.64, fat: 0.17 }, { piece: 119, cup: 92 }),
  214: detailWithMacros(214, "Onions, yellow, raw", "Foundation", { calories: 37, protein: 0.77, carbs: 8.61, fat: 0.09 }, { piece: 110, cup: 160 }),
  215: detailWithMacros(215, "Avocados, raw, california", "SR Legacy", { calories: 167, protein: 2, carbs: 8.6, fat: 15.4 }, { piece: 150, cup: 150 }),
  301: detail(301, "Rice, white, long-grain, regular, cooked", "SR Legacy", { cup: 158 }),
  311: detailWithMacros(311, "Beef, top sirloin, separable lean and fat, trimmed to 1/8\" fat, choice, cooked, grilled", "SR Legacy", { calories: 206, protein: 28.6, carbs: 0, fat: 10.6 }, { piece: 170 }),
  401: detail(401, "Chicken, broilers or fryers, breast, meat only, cooked, roasted", "Foundation"),
  501: detail(501, "Tomatoes, red, ripe, raw, year round average", "Foundation", { piece: 123 }),
  601: detail(601, "Mushrooms, white, raw", "Foundation", { cup: 70 }),
  701: detail(701, "Yogurt, Greek, plain, nonfat", "SR Legacy", { cup: 245 }),
  801: detail(801, "Onions, young green, tops and bulb, raw", "Foundation", { cup: 100 }),
  901: detail(901, "Beef, ground, 90% lean meat / 10% fat, raw", "SR Legacy"),
  903: detailWithMacros(903, "Beef, ground, unspecified fat content, cooked", "SR Legacy", { calories: 254, protein: 25.9, carbs: 0, fat: 17.4 }, { g: 1 }),
  1001: detail(1001, "Cheese, cheddar", "Foundation", { cup: 113 }),
  1101: detail(1101, "Sauce, soy, made from soy and wheat", "SR Legacy", { tbsp: 16 }),
  1151: detail(1151, "Vinegar, rice", "SR Legacy", { tbsp: 15, tsp: 5 }),
  1152: detailWithMacros(1152, "Lime juice, raw", "SR Legacy", { calories: 25, protein: 0.4, carbs: 8.4, fat: 0.1 }, { tbsp: 15, tsp: 5, piece: 44 }),
  1161: detail(1161, "Oil, sesame, salad or cooking", "Foundation", { tbsp: 13.5, tsp: 4.5 }),
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
  "neutral oil",
  "cornstarch",
  "bell pepper",
  "yellow onion",
  "avocado",
  "white rice",
  "sirloin steak",
  "chicken breast",
  "roma tomatoes",
  "baby bella mushrooms",
  "greek yogurt",
  "scallions",
  "90/10 ground beef",
  "shredded cheddar cheese",
  "soy sauce",
  "rice vinegar",
  "lime juice",
  "sesame oil",
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
  const [pepper, gochugaru, rice, eggs, oil, starch, steak, onion, avocado, bellPepper, cumin, chili, limeJuice, scotchBonnet] = await Promise.all([
    resolveIngredientMatch("black pepper"),
    resolveIngredientMatch("gochugaru"),
    resolveIngredientMatch("rice cooked"),
    resolveIngredientMatch("eggs"),
    resolveIngredientMatch("neutral oil"),
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

test("category fallback keeps future onion and pepper variants from losing nutrition data", async () => {
  const [shallot, redOnion, serrano, poblano, fresno] = await Promise.all([
    resolveIngredientMatch("shallot"),
    resolveIngredientMatch("red onion"),
    resolveIngredientMatch("serrano pepper"),
    resolveIngredientMatch("poblano pepper"),
    resolveIngredientMatch("fresno pepper"),
  ]);

  assert.equal(shallot.food?.description, "Onions, Yellow, Raw");
  assert.equal(redOnion.food?.description, "Onions, Yellow, Raw");
  assert.equal(serrano.food?.description, "Peppers, Hot, Raw");
  assert.equal(poblano.food?.description, "Peppers, Hot, Raw");
  assert.equal(fresno.food?.description, "Peppers, Hot, Raw");
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
