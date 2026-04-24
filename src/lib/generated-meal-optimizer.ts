import type {
  GeneratedMealIngredient,
  MacroTotals,
  NutritionGoals,
  Unit,
} from "./types";

export function optimizeGeneratedIngredientsForGoals(
  ingredients: GeneratedMealIngredient[],
  goals: NutritionGoals,
) {
  if (!ingredients.length) {
    return ingredients;
  }

  let current = ingredients.map((ingredient) => ({
    ...ingredient,
    totals: { ...ingredient.totals },
  }));
  const totals = summarizeIngredients(current);
  const thresholds = getGoalThresholds(goals);
  const calorieFloorForTrim = goals.calories > 0 ? goals.calories * 0.85 : 0;
  const needsTrim = (Object.keys(thresholds) as Array<keyof MacroTotals>).some(
    (key) =>
      thresholds[key] > 0 &&
      totals[key] > thresholds[key] &&
      (key === "calories" || !goals.calories || totals.calories >= calorieFloorForTrim),
  );

  if (!needsTrim) {
    return boostGeneratedIngredientsTowardGoals(current, goals);
  }

  const scaleFactors = (Object.keys(thresholds) as Array<keyof MacroTotals>)
    .filter((key) => thresholds[key] > 0 && totals[key] > thresholds[key])
    .map((key) => thresholds[key] / totals[key])
    .filter((value) => Number.isFinite(value) && value > 0 && value < 1);

  const globalScale = scaleFactors.length ? Math.max(Math.min(...scaleFactors), 0.35) : 1;

  if (globalScale < 0.92) {
    current = current.map((ingredient) =>
      shouldParticipateInGlobalScale(ingredient)
        ? rescaleIngredient(ingredient, globalScale)
        : ingredient,
    );
  }

  for (let iteration = 0; iteration < 12; iteration += 1) {
    const currentTotals = summarizeIngredients(current);

    if (isCloseEnoughToGoals(currentTotals, thresholds)) {
      break;
    }

    const candidate = pickTrimCandidate(current, currentTotals, thresholds);

    if (!candidate) {
      break;
    }

    const next = rescaleIngredient(candidate, getTrimFactor(candidate, currentTotals, thresholds));

    if (next.amount === candidate.amount) {
      break;
    }

    current = current.map((ingredient) => (ingredient.id === candidate.id ? next : ingredient));
  }

  return boostGeneratedIngredientsTowardGoals(current, goals);
}

function getGoalThresholds(goals: NutritionGoals): NutritionGoals {
  return {
    calories: goals.calories > 0 ? goals.calories * 1.12 : 0,
    protein: goals.protein > 0 ? Math.max(goals.protein * 1.2, goals.protein + 10) : 0,
    carbs: goals.carbs > 0 ? Math.max(goals.carbs * 1.2, goals.carbs + 12) : 0,
    fat: goals.fat > 0 ? Math.max(goals.fat * 1.18, goals.fat + 6) : 0,
  };
}

function isCloseEnoughToGoals(totals: MacroTotals, thresholds: NutritionGoals) {
  return (Object.keys(thresholds) as Array<keyof MacroTotals>).every(
    (key) => thresholds[key] === 0 || totals[key] <= thresholds[key],
  );
}

function summarizeIngredients(ingredients: GeneratedMealIngredient[]) {
  return roundTotals(
    ingredients.reduce<MacroTotals>(
      (sum, ingredient) => ({
        calories: sum.calories + ingredient.totals.calories,
        protein: sum.protein + ingredient.totals.protein,
        carbs: sum.carbs + ingredient.totals.carbs,
        fat: sum.fat + ingredient.totals.fat,
      }),
      zeroTotals(),
    ),
  );
}

function shouldParticipateInGlobalScale(ingredient: GeneratedMealIngredient) {
  if (!ingredient.supported || !ingredient.food) {
    return false;
  }

  const category = categorizeIngredientForOptimization(ingredient.name);
  return category !== "aromatic" && category !== "seasoning";
}

function pickTrimCandidate(
  ingredients: GeneratedMealIngredient[],
  totals: MacroTotals,
  thresholds: NutritionGoals,
) {
  const scored = ingredients
    .filter((ingredient) => ingredient.supported && ingredient.food && ingredient.totals.calories > 0)
    .map((ingredient) => ({
      ingredient,
      score: scoreTrimCandidate(ingredient, totals, thresholds),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  return scored[0]?.ingredient ?? null;
}

function scoreTrimCandidate(
  ingredient: GeneratedMealIngredient,
  totals: MacroTotals,
  thresholds: NutritionGoals,
) {
  const category = categorizeIngredientForOptimization(ingredient.name);
  const minimumAmount = getMinimumAmount(ingredient);

  if (ingredient.amount <= minimumAmount) {
    return 0;
  }

  let score = 0;

  if (thresholds.calories > 0 && totals.calories > thresholds.calories) {
    score += ingredient.totals.calories * getCategoryWeight(category, "calories");
  }

  if (thresholds.protein > 0 && totals.protein > thresholds.protein) {
    score += ingredient.totals.protein * 18 * getCategoryWeight(category, "protein");
  }

  if (thresholds.fat > 0 && totals.fat > thresholds.fat) {
    score += ingredient.totals.fat * 14 * getCategoryWeight(category, "fat");
  }

  if (thresholds.carbs > 0 && totals.carbs > thresholds.carbs) {
    score += ingredient.totals.carbs * 10 * getCategoryWeight(category, "carbs");
  }

  return score;
}

function getCategoryWeight(
  category: ReturnType<typeof categorizeIngredientForOptimization>,
  macro: keyof MacroTotals,
) {
  if (category === "protein") {
    return macro === "protein" || macro === "calories" || macro === "fat" ? 1.25 : 0.7;
  }

  if (category === "fat") {
    return macro === "fat" || macro === "calories" ? 1.2 : 0.55;
  }

  if (category === "carb") {
    return macro === "carbs" || macro === "calories" ? 1.05 : 0.65;
  }

  if (category === "produce") {
    return 0.45;
  }

  if (category === "seasoning" || category === "aromatic") {
    return 0.18;
  }

  return 0.7;
}

function getTrimFactor(
  ingredient: GeneratedMealIngredient,
  totals: MacroTotals,
  thresholds: NutritionGoals,
) {
  const category = categorizeIngredientForOptimization(ingredient.name);
  const severeOvershoot =
    (thresholds.calories > 0 && totals.calories > thresholds.calories * 1.45) ||
    (thresholds.protein > 0 && totals.protein > thresholds.protein * 1.55);

  if (category === "protein") {
    return severeOvershoot ? 0.72 : 0.84;
  }

  if (category === "fat") {
    return severeOvershoot ? 0.68 : 0.8;
  }

  if (category === "carb") {
    return severeOvershoot ? 0.78 : 0.88;
  }

  if (category === "produce") {
    return 0.92;
  }

  return 0.9;
}

function rescaleIngredient(ingredient: GeneratedMealIngredient, factor: number): GeneratedMealIngredient {
  const nextAmount = roundAmountForUnit(
    Math.max(getMinimumAmount(ingredient), ingredient.amount * factor),
    ingredient.unit,
  );

  if (
    !ingredient.food ||
    !ingredient.supported ||
    nextAmount <= 0 ||
    Math.abs(nextAmount - ingredient.amount) < 0.01
  ) {
    return ingredient;
  }

  return {
    ...ingredient,
    amount: nextAmount,
    totals: calculateIngredientTotals(
      ingredient.food.per100g,
      nextAmount,
      ingredient.unit,
      ingredient.food.gramsByUnit,
    ),
  };
}

function categorizeIngredientForOptimization(name: string) {
  const value = name.toLowerCase();

  if (/(ribeye|steak|chicken|beef|pork|salmon|shrimp|egg|turkey|belly|thigh|breast)/.test(value)) {
    return "protein";
  }

  if (/(oil|butter|cream|mayo|sesame oil|olive oil|avocado)/.test(value)) {
    return "fat";
  }

  if (/(rice|pasta|potato|bread|noodle|tortilla|dumpling|bun)/.test(value)) {
    return "carb";
  }

  if (/(broccoli|lettuce|cucumber|pepper|onion|scallion|green onion|mushroom|bok choy|spinach|cabbage)/.test(value)) {
    return "produce";
  }

  if (/(garlic|ginger|shallot)/.test(value)) {
    return "aromatic";
  }

  if (/(soy sauce|vinegar|pepper|gochugaru|gochujang|sugar|salt|spice|sesame seed)/.test(value)) {
    return "seasoning";
  }

  return "other";
}

function getMinimumAmount(ingredient: GeneratedMealIngredient) {
  if (ingredient.unit === "g") {
    const category = categorizeIngredientForOptimization(ingredient.name);
    if (category === "protein") return 60;
    if (category === "carb") return 50;
    if (category === "fat") return 8;
    if (category === "produce") return 30;
    return 5;
  }

  if (ingredient.unit === "cup") {
    return 0.25;
  }

  if (ingredient.unit === "tbsp" || ingredient.unit === "tsp") {
    return 0.25;
  }

  return 1;
}

function roundAmountForUnit(amount: number, unit: Unit) {
  if (unit === "g") {
    if (amount >= 100) {
      return Math.round(amount / 5) * 5;
    }

    return Math.max(1, Math.round(amount));
  }

  if (unit === "tbsp" || unit === "tsp" || unit === "cup") {
    return Math.max(0.25, Math.round(amount * 4) / 4);
  }

  return Math.max(1, Math.round(amount));
}

function calculateIngredientTotals(
  per100g: MacroTotals,
  amount: number,
  unit: Unit,
  gramsByUnit: Partial<Record<Unit, number>>,
) {
  const grams = (gramsByUnit[unit] ?? 0) * amount;

  if (!grams) {
    return zeroTotals();
  }

  const scale = grams / 100;

  return roundTotals({
    calories: per100g.calories * scale,
    protein: per100g.protein * scale,
    carbs: per100g.carbs * scale,
    fat: per100g.fat * scale,
  });
}

function zeroTotals(): MacroTotals {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

function roundValue(value: number) {
  return Math.round(value * 10) / 10;
}

function roundTotals(totals: MacroTotals): MacroTotals {
  return {
    calories: Math.round(totals.calories),
    protein: roundValue(totals.protein),
    carbs: roundValue(totals.carbs),
    fat: roundValue(totals.fat),
  };
}

function boostGeneratedIngredientsTowardGoals(
  ingredients: GeneratedMealIngredient[],
  goals: NutritionGoals,
) {
  if (!goals.calories) {
    return ingredients;
  }

  let current = ingredients.map((ingredient) => ({
    ...ingredient,
    totals: { ...ingredient.totals },
  }));

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const totals = summarizeIngredients(current);
    const calorieFloor = goals.calories * 0.82;

    if (totals.calories >= calorieFloor || !shouldAttemptCalorieBoost(totals, goals)) {
      break;
    }

    const candidate = pickBoostCandidate(current, totals, goals);

    if (!candidate) {
      break;
    }

    const next = rescaleIngredient(candidate, getBoostFactor(candidate, totals, goals));

    if (next.amount === candidate.amount) {
      break;
    }

    current = current.map((ingredient) => (ingredient.id === candidate.id ? next : ingredient));
  }

  return current;
}

function shouldAttemptCalorieBoost(totals: MacroTotals, goals: NutritionGoals) {
  const proteinCap = goals.protein > 0 ? Math.max(goals.protein * 1.2, goals.protein + 15) : Infinity;
  const fatCap = goals.fat > 0 ? Math.max(goals.fat * 1.35, goals.fat + 12) : Infinity;

  return totals.protein <= proteinCap && totals.fat <= fatCap;
}

function pickBoostCandidate(
  ingredients: GeneratedMealIngredient[],
  totals: MacroTotals,
  goals: NutritionGoals,
) {
  const scored = ingredients
    .filter((ingredient) => ingredient.supported && ingredient.food && ingredient.totals.calories > 0)
    .map((ingredient) => ({
      ingredient,
      score: scoreBoostCandidate(ingredient, totals, goals),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  return scored[0]?.ingredient ?? null;
}

function scoreBoostCandidate(
  ingredient: GeneratedMealIngredient,
  totals: MacroTotals,
  goals: NutritionGoals,
) {
  const category = categorizeIngredientForOptimization(ingredient.name);
  const maxAmount = getMaximumAmount(ingredient);

  if (ingredient.amount >= maxAmount) {
    return 0;
  }

  if (category === "protein" && goals.protein > 0 && totals.protein >= goals.protein) {
    return 0;
  }

  let score = ingredient.totals.calories;

  if (goals.calories > 0 && totals.calories < goals.calories * 0.82) {
    score += ingredient.totals.calories * 0.8;
  }

  if (category === "carb") {
    score += 120;
  } else if (category === "fat") {
    score += 95;
  } else if (
    category === "protein" &&
    goals.protein > 0 &&
    totals.protein < goals.protein * 0.95
  ) {
    score += 70;
  } else if (category === "produce") {
    score -= 40;
  } else if (category === "seasoning" || category === "aromatic") {
    score -= 70;
  }

  if (goals.protein > 0 && totals.protein > goals.protein * 1.25 && category === "protein") {
    score -= 120;
  }

  return score;
}

function getBoostFactor(
  ingredient: GeneratedMealIngredient,
  totals: MacroTotals,
  goals: NutritionGoals,
) {
  const category = categorizeIngredientForOptimization(ingredient.name);
  const severeUndershoot = goals.calories > 0 && totals.calories < goals.calories * 0.65;

  if (category === "carb") {
    return severeUndershoot ? 1.45 : 1.28;
  }

  if (category === "fat") {
    return severeUndershoot ? 1.4 : 1.22;
  }

  if (category === "protein") {
    return severeUndershoot ? 1.22 : 1.12;
  }

  return 1.1;
}

function getMaximumAmount(ingredient: GeneratedMealIngredient) {
  if (ingredient.unit === "g") {
    const category = categorizeIngredientForOptimization(ingredient.name);
    if (category === "protein") return Math.max(ingredient.amount * 1.5, 260);
    if (category === "carb") return Math.max(ingredient.amount * 1.85, 260);
    if (category === "fat") return Math.max(ingredient.amount * 2, 28);
    if (category === "produce") return Math.max(ingredient.amount * 1.6, 240);
    return Math.max(ingredient.amount * 1.5, 60);
  }

  if (ingredient.unit === "tbsp" || ingredient.unit === "tsp") {
    return Math.max(ingredient.amount * 2, 2.5);
  }

  if (ingredient.unit === "cup") {
    return Math.max(ingredient.amount * 1.6, 1.5);
  }

  return Math.max(ingredient.amount * 1.4, 3);
}
