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
    match: ["white rice", "rice white", "rice"],
    foods: [
      food(301, "Rice, white, long-grain, regular, cooked", "SR Legacy"),
      food(302, "Rice bowl with vegetables", "Survey (FNDDS)"),
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
    match: ["ground beef 90 percent lean", "ground beef 90% lean", "ground beef"],
    foods: [
      food(901, "Beef, ground, 90% lean meat / 10% fat, raw", "SR Legacy"),
      food(902, "Beef, ground, 70% lean meat / 30% fat, raw", "SR Legacy"),
    ],
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
    match: ["gochugaru", "pepper red or cayenne", "red pepper flakes", "chili flakes"],
    foods: [food(1181, "Spices, pepper, red or cayenne", "SR Legacy")],
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
  301: detail(301, "Rice, white, long-grain, regular, cooked", "SR Legacy", { cup: 158 }),
  401: detail(401, "Chicken, broilers or fryers, breast, meat only, cooked, roasted", "Foundation"),
  501: detail(501, "Tomatoes, red, ripe, raw, year round average", "Foundation", { piece: 123 }),
  601: detail(601, "Mushrooms, white, raw", "Foundation", { cup: 70 }),
  701: detail(701, "Yogurt, Greek, plain, nonfat", "SR Legacy", { cup: 245 }),
  801: detail(801, "Onions, young green, tops and bulb, raw", "Foundation", { cup: 100 }),
  901: detail(901, "Beef, ground, 90% lean meat / 10% fat, raw", "SR Legacy"),
  1001: detail(1001, "Cheese, cheddar", "Foundation", { cup: 113 }),
  1101: detail(1101, "Sauce, soy, made from soy and wheat", "SR Legacy", { tbsp: 16 }),
  1151: detail(1151, "Vinegar, rice", "SR Legacy", { tbsp: 15, tsp: 5 }),
  1161: detail(1161, "Oil, sesame, salad or cooking", "Foundation", { tbsp: 13.5, tsp: 4.5 }),
  1171: detail(1171, "Spices, pepper, black", "SR Legacy", { tbsp: 6.8, tsp: 2.3 }),
  1181: detail(1181, "Spices, pepper, red or cayenne", "SR Legacy", { tbsp: 6.8, tsp: 2.3 }),
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
  "white rice",
  "chicken breast",
  "roma tomatoes",
  "baby bella mushrooms",
  "greek yogurt",
  "scallions",
  "90/10 ground beef",
  "shredded cheddar cheese",
  "soy sauce",
  "rice vinegar",
  "sesame oil",
  "black pepper",
  "gochugaru",
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

test("preferred pantry profiles keep black pepper and gochugaru on sensible generic values", async () => {
  const [pepper, gochugaru, rice, eggs] = await Promise.all([
    resolveIngredientMatch("black pepper"),
    resolveIngredientMatch("gochugaru"),
    resolveIngredientMatch("rice cooked"),
    resolveIngredientMatch("eggs"),
  ]);

  assert.equal(pepper.matchedFoodId, 170931);
  assert.equal(pepper.food?.per100g.calories, 251);
  assert.equal(gochugaru.matchedFoodId, 170932);
  assert.equal(gochugaru.food?.gramsByUnit.tbsp, 6.8);
  assert.equal(rice.matchedFoodId, 168878);
  assert.equal(eggs.matchedFoodId, 171287);
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
      { nutrient: { id: 1008 }, amount: 200 },
      { nutrient: { id: 1003 }, amount: 20 },
      { nutrient: { id: 1005 }, amount: 10 },
      { nutrient: { id: 1004 }, amount: 8 },
    ],
    foodPortions,
  };
}
