import { roundTotals } from "@/lib/nutrition";
import type {
  CalculatedIngredient,
  GeneratedMeal,
  GeneratedMealIngredient,
  ImportedRecipe,
  MealIngredientRecord,
  PersistableMeal,
} from "@/lib/types";

type ManualMealInput = {
  title?: string;
  summary?: string;
  ingredients: Array<CalculatedIngredient | GeneratedMealIngredient>;
};

function toMealIngredientRecord(
  ingredient: CalculatedIngredient | GeneratedMealIngredient,
): MealIngredientRecord {
  return {
    id: ingredient.id,
    name: ingredient.name,
    amount: ingredient.amount,
    unit: ingredient.unit,
    notes: "notes" in ingredient ? ingredient.notes ?? null : null,
    fdcId: ingredient.food?.fdcId ?? null,
    foodDescription: ingredient.food?.description ?? null,
    foodDataType: ingredient.food?.dataType ?? null,
    sourceLabel: ingredient.food?.sourceLabel ?? null,
    calories: ingredient.totals.calories,
    protein: ingredient.totals.protein,
    carbs: ingredient.totals.carbs,
    fat: ingredient.totals.fat,
  };
}

export function buildGeneratedMealPayload(meal: GeneratedMeal): PersistableMeal {
  return {
    title: meal.title,
    cuisine: meal.cuisine,
    summary: meal.summary,
    source: "generated",
    calories: meal.totals.calories,
    protein: meal.totals.protein,
    carbs: meal.totals.carbs,
    fat: meal.totals.fat,
    instructions: meal.instructions,
    whyItWorks: meal.whyItWorks,
    groceryList: meal.groceryList,
    ingredients: meal.ingredients.map(toMealIngredientRecord),
  };
}

export function buildManualMealPayload({
  title,
  summary,
  ingredients,
}: ManualMealInput): PersistableMeal {
  const usedIngredients = ingredients.filter(
    (ingredient) => ingredient.name.trim().length > 0 && ingredient.amount > 0,
  );
  const totals = roundTotals(
    usedIngredients.reduce(
      (sum, ingredient) => ({
        calories: sum.calories + ingredient.totals.calories,
        protein: sum.protein + ingredient.totals.protein,
        carbs: sum.carbs + ingredient.totals.carbs,
        fat: sum.fat + ingredient.totals.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    ),
  );

  return {
    title: title?.trim() || buildManualMealTitle(usedIngredients.map((ingredient) => ingredient.name)),
    cuisine: null,
    summary:
      summary?.trim() ||
      "A manually built meal saved from NutriPilot so you can come back to the same ingredient setup later.",
    source: "manual",
    calories: totals.calories,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    instructions: [],
    whyItWorks: [],
    groceryList: [],
    ingredients: usedIngredients.map(toMealIngredientRecord),
  };
}

export function buildImportedRecipeRecord(recipe: ImportedRecipe) {
  return {
    title: recipe.title,
    source_url: recipe.sourceUrl,
    image_url: recipe.imageUrl ?? null,
    ingredients: recipe.ingredients,
    warnings: recipe.warnings,
  };
}

export function buildImportedMealPayload(recipe: ImportedRecipe): PersistableMeal {
  const matchedIngredients = recipe.ingredients
    .filter((ingredient) => ingredient.amount && ingredient.food)
    .map((ingredient) => ({
      id: ingredient.id,
      name: ingredient.name,
      amount: ingredient.amount ?? 0,
      unit: ingredient.unit,
      notes: ingredient.originalText,
      food: ingredient.food,
      totals: roundTotals({
        calories:
          ingredient.food && ingredient.amount
            ? ((ingredient.food.gramsByUnit[ingredient.unit] ?? 0) * ingredient.amount * ingredient.food.per100g.calories) / 100
            : 0,
        protein:
          ingredient.food && ingredient.amount
            ? ((ingredient.food.gramsByUnit[ingredient.unit] ?? 0) * ingredient.amount * ingredient.food.per100g.protein) / 100
            : 0,
        carbs:
          ingredient.food && ingredient.amount
            ? ((ingredient.food.gramsByUnit[ingredient.unit] ?? 0) * ingredient.amount * ingredient.food.per100g.carbs) / 100
            : 0,
        fat:
          ingredient.food && ingredient.amount
            ? ((ingredient.food.gramsByUnit[ingredient.unit] ?? 0) * ingredient.amount * ingredient.food.per100g.fat) / 100
            : 0,
      }),
      supported: Boolean(ingredient.food),
      resolution: ingredient.resolution,
    }));

  return buildManualMealPayload({
    title: recipe.title,
    summary: `Imported from ${recipe.sourceUrl}`,
    ingredients: matchedIngredients,
  });
}

export function buildManualMealTitle(names: string[]) {
  const trimmed = names.filter(Boolean).slice(0, 3);

  if (trimmed.length === 0) {
    return "Saved NutriPilot Meal";
  }

  if (trimmed.length === 1) {
    return trimmed[0];
  }

  if (trimmed.length === 2) {
    return `${trimmed[0]} and ${trimmed[1]}`;
  }

  return `${trimmed[0]}, ${trimmed[1]}, and ${trimmed[2]}`;
}
