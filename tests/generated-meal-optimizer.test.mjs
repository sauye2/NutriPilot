import test from "node:test";
import assert from "node:assert/strict";

import { optimizeGeneratedIngredientsForGoals } from "../src/lib/generated-meal-optimizer.ts";

test("optimizer trims oversized beef-heavy meals toward low protein and calorie targets", () => {
  const ingredients = [
    ingredient("ribeye steak", 450, "g", { calories: 255, protein: 25.6, carbs: 0, fat: 17.6 }),
    ingredient("broccoli florets", 300, "g", { calories: 34, protein: 2.8, carbs: 6.6, fat: 0.4 }),
    ingredient("sesame oil", 2, "tbsp", { calories: 884, protein: 0, carbs: 0, fat: 100 }, { tbsp: 13.6 }),
  ];

  const optimized = optimizeGeneratedIngredientsForGoals(ingredients, {
    calories: 1500,
    protein: 30,
    carbs: 60,
    fat: 24,
  });

  const totals = sumTotals(optimized);
  const ribeye = optimized.find((ingredient) => ingredient.name === "ribeye steak");

  assert.ok(ribeye);
  assert.ok(ribeye.amount < 450, "steak portion should be reduced");
  assert.ok(totals.protein < 70, `protein should come down meaningfully, got ${totals.protein}`);
  assert.ok(totals.calories < 1500, `calories should stay under the target cap, got ${totals.calories}`);
});

test("optimizer rescales very rich pork belly meals instead of leaving them thousands of calories over", () => {
  const ingredients = [
    ingredient("pork belly", 300, "g", { calories: 518, protein: 9.3, carbs: 0, fat: 53 }),
    ingredient("rice cooked", 250, "g", { calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3 }),
    ingredient("sesame oil", 1, "tbsp", { calories: 884, protein: 0, carbs: 0, fat: 100 }, { tbsp: 13.6 }),
  ];

  const optimized = optimizeGeneratedIngredientsForGoals(ingredients, {
    calories: 1000,
    protein: 50,
    carbs: 50,
    fat: 35,
  });

  const totals = sumTotals(optimized);
  const porkBelly = optimized.find((ingredient) => ingredient.name === "pork belly");

  assert.ok(porkBelly);
  assert.ok(porkBelly.amount < 300, "pork belly portion should be reduced");
  assert.ok(totals.calories < 1300, `calories should be much closer to target, got ${totals.calories}`);
});

test("optimizer prioritizes protein first when filling a calorie gap", () => {
  const ingredients = [
    ingredient("sirloin steak", 190, "g", { calories: 206, protein: 28.6, carbs: 0, fat: 10.6 }),
    ingredient("broccoli florets", 150, "g", { calories: 34, protein: 2.8, carbs: 6.6, fat: 0.4 }),
    ingredient("neutral oil", 0.8, "tbsp", { calories: 884, protein: 0, carbs: 0, fat: 100 }, { tbsp: 13.6 }),
    ingredient("cornstarch", 0.8, "tbsp", { calories: 381, protein: 0.3, carbs: 91.3, fat: 0.1 }, { tbsp: 8 }),
  ];

  const optimized = optimizeGeneratedIngredientsForGoals(ingredients, {
    calories: 1000,
    protein: 50,
    carbs: 60,
    fat: 24,
  });

  const totals = sumTotals(optimized);
  const steak = optimized.find((ingredient) => ingredient.name === "sirloin steak");

  assert.ok(steak);
  assert.ok(
    (steak?.amount ?? 0) > 190,
    "protein should be increased first when the meal is light and still under the protein target",
  );
  assert.ok(totals.calories > 500, `calories should come up meaningfully, got ${totals.calories}`);
  assert.ok(totals.protein > 60, `protein should come up aggressively, got ${totals.protein}`);
});

test("optimizer boosts protein-forward ingredients when the draft is far under the protein target", () => {
  const ingredients = [
    ingredient("chicken breast", 180, "g", { calories: 165, protein: 31, carbs: 0, fat: 3.6 }),
    ingredient("rice cooked", 180, "g", { calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3 }),
    ingredient("broccoli florets", 180, "g", { calories: 34, protein: 2.8, carbs: 6.6, fat: 0.4 }),
    ingredient("olive oil", 1, "tbsp", { calories: 884, protein: 0, carbs: 0, fat: 100 }, { tbsp: 13.6 }),
  ];

  const optimized = optimizeGeneratedIngredientsForGoals(ingredients, {
    calories: 1500,
    protein: 100,
    carbs: 90,
    fat: 45,
  });

  const totals = sumTotals(optimized);
  const chicken = optimized.find((ingredient) => ingredient.name === "chicken breast");

  assert.ok(chicken);
  assert.ok((chicken?.amount ?? 0) > 180, "lean protein should be increased when protein is well under target");
  assert.ok(totals.protein >= 80, `protein should come much closer to target, got ${totals.protein}`);
  assert.ok(totals.calories >= 1000, `calories should also stay meaningfully filled in, got ${totals.calories}`);
});

function ingredient(name, amount, unit, per100g, gramsByUnit = { g: 1 }) {
  return {
    id: `${name}-${unit}`,
    name,
    amount,
    unit,
    notes: null,
    food: {
      fdcId: 1,
      description: name,
      displayName: name,
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g,
      gramsByUnit,
    },
    resolution: null,
    totals: calculateTotals(per100g, amount, unit, gramsByUnit),
    supported: true,
  };
}

function calculateTotals(per100g, amount, unit, gramsByUnit) {
  const grams = (gramsByUnit[unit] ?? 0) * amount;
  const scale = grams / 100;

  return {
    calories: Math.round(per100g.calories * scale),
    protein: Math.round(per100g.protein * scale * 10) / 10,
    carbs: Math.round(per100g.carbs * scale * 10) / 10,
    fat: Math.round(per100g.fat * scale * 10) / 10,
  };
}

function sumTotals(ingredients) {
  return ingredients.reduce(
    (sum, ingredient) => ({
      calories: sum.calories + ingredient.totals.calories,
      protein: sum.protein + ingredient.totals.protein,
      carbs: sum.carbs + ingredient.totals.carbs,
      fat: sum.fat + ingredient.totals.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}
