import type { MealIngredientRecord, SavedMeal } from "@/lib/types";

export type MealRow = {
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

export function mapSavedMeal(row: MealRow): SavedMeal {
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
    groceryList: (row.grocery_list as SavedMeal["groceryList"] | null) ?? [],
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
