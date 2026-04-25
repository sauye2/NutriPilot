import { NextResponse } from "next/server";
import { defaultNutritionGoals } from "@/lib/default-goals";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import type { MealIngredientRecord, PersistableMeal, SavedMeal } from "@/lib/types";

type MealRow = {
  id: string;
  title: string;
  cuisine: string | null;
  summary: string | null;
  source: "manual" | "generated" | "imported";
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  instructions: string[] | null;
  why_it_works: string[] | null;
  grocery_list: unknown[] | null;
  created_at: string;
  meal_ingredients: Array<{
    id: string;
    name: string;
    amount: number;
    unit: string;
    notes: string | null;
    fdc_id: number | null;
    food_description: string | null;
    food_data_type: string | null;
    source_label: string | null;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>;
};

function isValidPersistableMeal(value: unknown): value is PersistableMeal {
  if (!value || typeof value !== "object") {
    return false;
  }

  const meal = value as Partial<PersistableMeal>;
  return (
    typeof meal.title === "string" &&
    typeof meal.source === "string" &&
    Array.isArray(meal.ingredients) &&
    typeof meal.calories === "number" &&
    typeof meal.protein === "number" &&
    typeof meal.carbs === "number" &&
    typeof meal.fat === "number"
  );
}

function mapSavedMeal(row: MealRow): SavedMeal {
  return {
    id: row.id,
    title: row.title,
    cuisine: row.cuisine,
    summary: row.summary,
    source: row.source,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    instructions: row.instructions ?? [],
    whyItWorks: row.why_it_works ?? [],
    groceryList: (row.grocery_list ?? []) as SavedMeal["groceryList"],
    ingredients: row.meal_ingredients.map((ingredient) => ({
      id: ingredient.id,
      name: ingredient.name,
      amount: ingredient.amount,
      unit: ingredient.unit as MealIngredientRecord["unit"],
      notes: ingredient.notes,
      fdcId: ingredient.fdc_id,
      foodDescription: ingredient.food_description,
      foodDataType: ingredient.food_data_type,
      sourceLabel: ingredient.source_label,
      calories: ingredient.calories,
      protein: ingredient.protein,
      carbs: ingredient.carbs,
      fat: ingredient.fat,
    })),
    createdAt: row.created_at,
  };
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser();

  if (auth.response || !auth.user) {
    return auth.response;
  }

  const body = (await request.json()) as { meal?: PersistableMeal };

  if (!isValidPersistableMeal(body.meal)) {
    return NextResponse.json({ error: "A complete meal payload is required." }, { status: 400 });
  }

  const meal = body.meal;
  const supabase = auth.supabase;

  const { data: insertedMeal, error: mealError } = await supabase
    .from("meals")
    .insert({
      user_id: auth.user.id,
      title: meal.title,
      cuisine: meal.cuisine ?? null,
      summary: meal.summary ?? null,
      source: meal.source,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      instructions: meal.instructions ?? [],
      why_it_works: meal.whyItWorks ?? [],
      grocery_list: meal.groceryList ?? [],
    })
    .select("*")
    .single();

  if (mealError || !insertedMeal) {
    return NextResponse.json(
      { error: mealError?.message ?? "We could not save that meal yet." },
      { status: 500 },
    );
  }

  if (meal.ingredients.length > 0) {
    const ingredientRows = meal.ingredients.map((ingredient) => ({
      meal_id: insertedMeal.id,
      user_id: auth.user.id,
      name: ingredient.name,
      amount: ingredient.amount,
      unit: ingredient.unit,
      notes: ingredient.notes ?? null,
      fdc_id: ingredient.fdcId ?? null,
      food_description: ingredient.foodDescription ?? null,
      food_data_type: ingredient.foodDataType ?? null,
      source_label: ingredient.sourceLabel ?? null,
      calories: ingredient.calories,
      protein: ingredient.protein,
      carbs: ingredient.carbs,
      fat: ingredient.fat,
    }));

    const { error: ingredientError } = await supabase.from("meal_ingredients").insert(ingredientRows);

    if (ingredientError) {
      await supabase.from("meals").delete().eq("id", insertedMeal.id);

      return NextResponse.json(
        { error: ingredientError.message ?? "Meal ingredients could not be saved." },
        { status: 500 },
      );
    }
  }

  const { data: savedMeal, error: savedMealError } = await supabase
    .from("meals")
    .select(
      "id,title,cuisine,summary,source,calories,protein,carbs,fat,instructions,why_it_works,grocery_list,created_at,meal_ingredients(*)",
    )
    .eq("id", insertedMeal.id)
    .single();

  if (savedMealError || !savedMeal) {
    return NextResponse.json({ meal: insertedMeal, goals: defaultNutritionGoals });
  }

  return NextResponse.json({ meal: mapSavedMeal(savedMeal as MealRow) });
}

export async function GET() {
  const auth = await requireAuthenticatedUser();

  if (auth.response || !auth.user) {
    return auth.response;
  }

  const { data, error } = await auth.supabase
    .from("meals")
    .select(
      "id,title,cuisine,summary,source,calories,protein,carbs,fat,instructions,why_it_works,grocery_list,created_at,meal_ingredients(*)",
    )
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "We could not load your saved meals." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    meals: (data as MealRow[]).map(mapSavedMeal),
  });
}
