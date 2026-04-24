import "server-only";

import { formatGroceryQuantity } from "@/lib/ingredient-text";
import { optimizeGeneratedIngredientsForGoals } from "@/lib/generated-meal-optimizer";
import { compareGoals, roundTotals } from "@/lib/nutrition";
import { resolveIngredientMatch } from "@/lib/food-data-central";
import type {
  GeneratedMeal,
  GeneratedMealFeedback,
  GeneratedMealIngredient,
  GeneratedMealRequest,
  GroceryListItem,
  GroceryListSection,
  MacroTotals,
  NutritionGoals,
  Unit,
} from "@/lib/types";

const OPENAI_BASE_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = process.env.OPENAI_MEAL_MODEL || "gpt-5.4-mini";

export class MealGenerationError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "MealGenerationError";
    this.status = status;
  }
}

type ResponsesApiPayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
      json?: unknown;
    }>;
  }>;
};

type AiMealDraft = {
  title: string;
  cuisine: string;
  summary: string;
  whyItWorks: string[];
  ingredients: Array<{
    name: string;
    amount: number;
    unit: Unit;
    notes?: string | null;
  }>;
  instructions: string[];
};

export async function generateMealDraft(
  request: GeneratedMealRequest,
): Promise<GeneratedMeal> {
  const varietyDirection = chooseVarietyDirection();
  const prompt = [
    "Generate a meal plan in JSON.",
    "The meal should taste good in a normal home-cooking sense, not just hit macros.",
    "Keep ingredients practical, coherent, and limited to a single meal.",
    "Prefer common grocery ingredients and avoid obscure supplements or duplicate ingredients.",
    "Being close to the nutrition targets is fine; the meal does not need to match them exactly.",
    "Draft a realistic single serving. If the anchor ingredient is rich, reduce the portion size instead of massively overshooting calories, protein, or fat.",
    "Aim for variety in dish format and do not default to lettuce wraps when other strong options fit the brief.",
    "For Korean-inspired meals with pork belly, consider a broader range of formats like rice bowls, stir-fries, ssam, noodle dishes, stews, and skillet meals.",
    `Variety direction for this draft: ${varietyDirection}`,
    `Calorie target: ${request.goals.calories}`,
    `Protein target: ${request.goals.protein}g`,
    `Carb target: ${request.goals.carbs}g`,
    `Fat target: ${request.goals.fat}g`,
    `Cuisine preference: ${request.cuisine || "none provided"}`,
    `Anchor food or dish style: ${request.anchorFood || "none provided"}`,
    `Dietary notes: ${request.dietaryNotes || "none provided"}`,
    "Use only these units for ingredients: g, tbsp, tsp, cup, piece.",
    "Prefer grams for meats, rice, sauces, chopped vegetables, and anything that is not naturally countable.",
    "Use piece only for clearly countable items like eggs, cucumbers, scallions, garlic cloves, lettuce leaves, chicken breasts, or steaks.",
    "Every ingredient must have an amount greater than 0.",
    "Keep the ingredient list concise and avoid garnish-only filler.",
    "Write instructions in a realistic cooking order. Prep work like mincing, slicing, mixing sauces, and heating pans should appear before the steps that use them.",
    "Make the instructions comprehensive enough for a home cook to follow without guessing.",
  ].join("\n");

  const draft = await generateStructuredMeal(prompt);
  return hydrateGeneratedMeal(draft, request.goals);
}

function chooseVarietyDirection() {
  const directions = [
    "lean into a rice bowl or plated entree format",
    "favor a skillet or stir-fry format",
    "favor a composed plate with sides rather than wraps",
    "favor a noodle or rice-cake style if it suits the cuisine",
    "favor a brothy or stew-adjacent format if it still works as a single meal",
    "favor a crisp, grill-forward format with strong contrast in textures",
  ];

  return directions[Math.floor(Math.random() * directions.length)];
}

export async function reviseMealDraft(
  meal: GeneratedMeal,
  goals: NutritionGoals,
  feedback: GeneratedMealFeedback,
): Promise<{ summary: string; updatedMeal: GeneratedMeal }> {
  const prompt = [
    "Revise the meal in JSON.",
    `Accepted state: ${feedback.accepted ? "user liked the meal but wants a tweak" : "user did not accept the current meal"}`,
    `User feedback: ${feedback.feedback}`,
    `Current meal title: ${meal.title}`,
    `Current cuisine: ${meal.cuisine}`,
    `Current totals: ${meal.totals.calories} calories, ${meal.totals.protein}g protein, ${meal.totals.carbs}g carbs, ${meal.totals.fat}g fat.`,
    "Current ingredients:",
    ...meal.ingredients.map(
      (ingredient) =>
        `- ${ingredient.amount} ${ingredient.unit} ${ingredient.name}${ingredient.notes ? ` (${ingredient.notes})` : ""}`,
    ),
    "Preserve the spirit of the meal unless the feedback clearly asks for a larger change.",
    "Keep ingredients practical and coherent, and use only the units g, tbsp, tsp, cup, piece.",
    "Prefer grams for meats, rice, sauces, chopped vegetables, and anything that is not naturally countable.",
    "Write instructions in a realistic prep-then-cook order so the timing makes sense for a home cook.",
  ].join("\n");

  const draft = await generateStructuredMeal(prompt);
  const updatedMeal = await hydrateGeneratedMeal(draft, goals);

  return {
    summary: "Here is a revised version based on your feedback.",
    updatedMeal,
  };
}

async function generateStructuredMeal(prompt: string): Promise<AiMealDraft> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new MealGenerationError(
      "Missing OPENAI_API_KEY. Add it to .env.local to enable Lazy Mode.",
      500,
    );
  }

  const response = await fetch(OPENAI_BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      input: [
        {
          role: "system",
          content:
            "You are a culinary nutrition assistant. Output JSON only. Create meals that are appetizing, coherent, and realistic for one meal.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "generated_meal",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "title",
              "cuisine",
              "summary",
              "whyItWorks",
              "ingredients",
              "instructions",
            ],
            properties: {
              title: { type: "string" },
              cuisine: { type: "string" },
              summary: { type: "string" },
              whyItWorks: {
                type: "array",
                items: { type: "string" },
              },
              ingredients: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["name", "amount", "unit", "notes"],
                  properties: {
                    name: { type: "string" },
                    amount: { type: "number" },
                    unit: {
                      type: "string",
                      enum: ["g", "tbsp", "tsp", "cup", "piece"],
                    },
                    notes: {
                      anyOf: [{ type: "string" }, { type: "null" }],
                    },
                  },
                },
              },
              instructions: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    let details = "";

    try {
      const errorPayload = (await response.json()) as {
        error?: {
          message?: string;
          type?: string;
          code?: string;
        };
      };

      details = errorPayload.error?.message?.trim() ?? "";
    } catch {
      details = "";
    }

    if (response.status === 429) {
      throw new MealGenerationError(
        details ||
          "NutriPilot could not generate a meal right now because the AI quota or billing limit was reached.",
        429,
      );
    }

    throw new MealGenerationError(
      details || `NutriPilot meal generation failed with ${response.status}.`,
      response.status,
    );
  }

  const payload = (await response.json()) as ResponsesApiPayload;
  const structuredText = extractStructuredText(payload);

  if (!structuredText) {
    throw new MealGenerationError("NutriPilot did not return a structured meal.", 502);
  }

  try {
    return JSON.parse(structuredText) as AiMealDraft;
  } catch {
    throw new MealGenerationError("NutriPilot returned meal data in an unreadable format.", 502);
  }
}

async function hydrateGeneratedMeal(
  draft: AiMealDraft,
  goals: NutritionGoals,
): Promise<GeneratedMeal> {
  const hydratedIngredients = await Promise.all(
    draft.ingredients.map(async (ingredient) => {
      const resolution = await resolveIngredientMatch(ingredient.name);
      const food = resolution.food;
      const chosenUnit = chooseGeneratedUnit(
        ingredient.unit,
        food?.gramsByUnit ?? {},
        ingredient.name,
      );
      const totals = food
        ? calculateIngredientTotals(food.per100g, ingredient.amount, chosenUnit, food.gramsByUnit)
        : zeroTotals();

      return {
        id: crypto.randomUUID(),
        name: ingredient.name,
        amount: ingredient.amount,
        unit: chosenUnit,
        notes: ingredient.notes ?? null,
        food,
        resolution,
        totals,
        supported: Boolean(food),
      } satisfies GeneratedMealIngredient;
    }),
  );

  const ingredients = optimizeGeneratedIngredientsForGoals(hydratedIngredients, goals);

  const totals = roundTotals(
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

  const goalGaps = compareGoals(totals, goals);

  return {
    title: draft.title,
    cuisine: draft.cuisine,
    summary: draft.summary,
    whyItWorks: draft.whyItWorks,
    ingredients,
    instructions: draft.instructions,
    groceryList: buildGroceryList(ingredients),
    totals,
    goalGaps,
  };
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

function buildGroceryList(ingredients: GeneratedMealIngredient[]): GroceryListSection[] {
  const sections = new Map<string, GroceryListItem[]>();

  for (const ingredient of ingredients) {
    const title = categorizeIngredient(ingredient.name);
    const item: GroceryListItem = {
      id: ingredient.id,
      label: ingredient.name,
      quantity: formatGroceryQuantity(
        ingredient.amount,
        ingredient.unit,
        ingredient.name,
        ingredient.notes,
      ),
    };
    const existing = sections.get(title) ?? [];
    existing.push(item);
    sections.set(title, existing);
  }

  return Array.from(sections.entries()).map(([title, items], index) => ({
    id: `section-${index + 1}`,
    title,
    items,
  }));
}

function categorizeIngredient(name: string) {
  const value = name.toLowerCase();

  if (/(steak|chicken|beef|pork|salmon|shrimp|egg|turkey)/.test(value)) return "Protein";
  if (/(rice|pasta|potato|bread|flour|noodle|tortilla)/.test(value)) return "Carbs";
  if (/(oil|butter|cream|cheese|avocado|olive)/.test(value)) return "Fats & Dairy";
  if (/(onion|garlic|pepper|tomato|cilantro|parsley|spinach|basil|lemon)/.test(value))
    return "Produce";

  return "Pantry";
}

function zeroTotals(): MacroTotals {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

function chooseGeneratedUnit(
  preferredUnit: Unit,
  gramsByUnit: Partial<Record<Unit, number>>,
  ingredientName: string,
): Unit {
  if (gramsByUnit[preferredUnit]) {
    return preferredUnit;
  }

  if (
    preferredUnit === "piece" &&
    /scallion|green onion|garlic|lettuce|cucumber|egg|steak|breast/i.test(ingredientName) &&
    gramsByUnit.piece
  ) {
    return "piece";
  }

  return preferredUnit;
}

function extractStructuredText(payload: ResponsesApiPayload) {
  if (payload.output_text?.trim()) {
    return stripCodeFences(payload.output_text.trim());
  }

  for (const output of payload.output ?? []) {
    for (const content of output.content ?? []) {
      if (typeof content.text === "string" && content.text.trim()) {
        return stripCodeFences(content.text.trim());
      }

      if (content.json) {
        return JSON.stringify(content.json);
      }
    }
  }

  return null;
}

function stripCodeFences(value: string) {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}
