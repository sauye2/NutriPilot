import { foodProfiles } from "@/lib/nutrition-data";
import type {
  CalculatedIngredient,
  FoodProfile,
  GoalGap,
  IngredientInput,
  MacroKey,
  MacroTotals,
  NutritionGoals,
  ResolvedFood,
  Suggestion,
  Unit,
} from "@/lib/types";

const macroLabels: Record<MacroKey, string> = {
  calories: "Calories",
  protein: "Protein",
  carbs: "Carbs",
  fat: "Fat",
};

export const emptyTotals: MacroTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

export function findFoodProfile(name: string): FoodProfile | undefined {
  const normalized = name.trim().toLowerCase();

  if (!normalized) {
    return undefined;
  }

  return foodProfiles.find((profile) =>
    profile.aliases.some((alias) => alias.toLowerCase() === normalized),
  );
}

export function gramsForUnit(profile: FoodProfile, amount: number, unit: Unit) {
  const gramsPerUnit = profile.gramsByUnit[unit];

  if (!gramsPerUnit || !Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  return amount * gramsPerUnit;
}

function gramsForResolvedFood(food: ResolvedFood, amount: number, unit: Unit) {
  const gramsPerUnit = food.gramsByUnit[unit];

  if (!gramsPerUnit || !Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  return amount * gramsPerUnit;
}

export function calculateIngredient(input: IngredientInput): CalculatedIngredient {
  if (input.food) {
    const grams = gramsForResolvedFood(input.food, input.amount, input.unit);
    const scale = grams / 100;

    return {
      ...input,
      grams,
      supported: grams > 0,
      totals: roundTotals({
        calories: input.food.per100g.calories * scale,
        protein: input.food.per100g.protein * scale,
        carbs: input.food.per100g.carbs * scale,
        fat: input.food.per100g.fat * scale,
      }),
    };
  }

  const profile = findFoodProfile(input.name);

  if (!profile) {
    return {
      ...input,
      grams: 0,
      totals: emptyTotals,
      supported: false,
    };
  }

  const grams = gramsForUnit(profile, input.amount, input.unit);
  const scale = grams / 100;

  return {
    ...input,
    name: profile.name,
    grams,
    supported: grams > 0,
    totals: roundTotals({
      calories: profile.per100g.calories * scale,
      protein: profile.per100g.protein * scale,
      carbs: profile.per100g.carbs * scale,
      fat: profile.per100g.fat * scale,
    }),
  };
}

export function calculateMealTotals(ingredients: IngredientInput[]): {
  calculatedIngredients: CalculatedIngredient[];
  totals: MacroTotals;
  unsupportedIngredients: IngredientInput[];
} {
  const calculatedIngredients = ingredients.map(calculateIngredient);

  const totals = calculatedIngredients.reduce<MacroTotals>(
    (sum, ingredient) => ({
      calories: sum.calories + ingredient.totals.calories,
      protein: sum.protein + ingredient.totals.protein,
      carbs: sum.carbs + ingredient.totals.carbs,
      fat: sum.fat + ingredient.totals.fat,
    }),
    { ...emptyTotals },
  );

  return {
    calculatedIngredients,
    totals: roundTotals(totals),
    unsupportedIngredients: ingredients.filter(
      (ingredient) =>
        ingredient.name.trim() && !ingredient.food && !findFoodProfile(ingredient.name),
    ),
  };
}

export function compareGoals(totals: MacroTotals, goals: NutritionGoals): GoalGap[] {
  return (Object.keys(totals) as MacroKey[]).map((key) => {
    const goal = Math.max(goals[key], 0);
    const actual = totals[key];
    const delta = roundValue(actual - goal);
    const tolerance = key === "calories" ? 35 : 3;
    const status =
      Math.abs(delta) <= tolerance ? "on-target" : delta < 0 ? "under" : "over";

    return {
      key,
      label: macroLabels[key],
      goal,
      actual,
      delta,
      percent: goal > 0 ? Math.min((actual / goal) * 100, 140) : 0,
      status,
    };
  });
}

export function generateSuggestions(
  totals: MacroTotals,
  goals: NutritionGoals,
  unsupportedCount: number,
): Suggestion[] {
  const gaps = compareGoals(totals, goals);
  const suggestions: Suggestion[] = [];
  const byKey = Object.fromEntries(gaps.map((gap) => [gap.key, gap])) as Record<
    MacroKey,
    GoalGap
  >;

  if (unsupportedCount > 0) {
    suggestions.push({
      id: "unsupported-foods",
      title: "A couple of ingredients still need a closer match",
      body: "The total may read a little low until those ingredients are matched. Try a broader ingredient name or pick one of the USDA options from the search list.",
      tone: "balance",
    });
  }

  if (byKey.protein.status === "under") {
    suggestions.push({
      id: "add-protein",
      title: "You’re a little low on protein",
      body: `Add about ${Math.ceil(Math.abs(byKey.protein.delta))}g more protein with a lean option like chicken breast, eggs, or a smaller bump of steak.`,
      tone: "add",
    });
  }

  if (byKey.carbs.status === "under" && byKey.calories.status !== "over") {
    suggestions.push({
      id: "add-carbs",
      title: "A small carb boost would round this out",
      body: "A little rice, noodles, or potato would bring the meal closer to target without changing the feel of it too much.",
      tone: "add",
    });
  }

  if (byKey.fat.status === "over") {
    suggestions.push({
      id: "reduce-fat",
      title: "You could trim a richer ingredient first",
      body: "Pull back a little oil or swap part of a fattier protein for something leaner to lower fat without shrinking the plate too much.",
      tone: "reduce",
    });
  }

  if (byKey.calories.status === "over") {
    suggestions.push({
      id: "reduce-calories",
      title: "A few easy changes could bring this closer to your goals",
      body: "Start with the most calorie-dense ingredients like oil or richer cuts of meat, then keep the vegetables and lighter sides steady.",
      tone: "swap",
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: "balanced",
      title: "This meal already looks pretty balanced",
      body: "You’re close enough that small seasoning or vegetable changes should not move the nutrition picture much.",
      tone: "balance",
    });
  }

  return suggestions.slice(0, 4);
}

export function roundValue(value: number) {
  return Math.round(value * 10) / 10;
}

export function roundTotals(totals: MacroTotals): MacroTotals {
  return {
    calories: Math.round(totals.calories),
    protein: roundValue(totals.protein),
    carbs: roundValue(totals.carbs),
    fat: roundValue(totals.fat),
  };
}
