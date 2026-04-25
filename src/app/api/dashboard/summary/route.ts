import { NextResponse } from "next/server";
import { defaultNutritionGoals } from "@/lib/default-goals";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { roundTotals } from "@/lib/nutrition";
import type { DashboardSummary, MacroTotals } from "@/lib/types";

function clampRemaining(goal: number, actual: number) {
  return Math.round((goal - actual) * 10) / 10;
}

function emptyTotals(): MacroTotals {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

export async function GET() {
  const auth = await requireAuthenticatedUser();

  if (auth.response || !auth.user) {
    return auth.response;
  }

  const supabase = auth.supabase;
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 6);
  const weekStartIso = weekStart.toISOString().slice(0, 10);

  const [goalsResult, todayLogsResult, recentMealsResult, weeklyLogsResult] = await Promise.all([
    supabase
      .from("nutrition_goals")
      .select("calories,protein,carbs,fat")
      .eq("user_id", auth.user.id)
      .maybeSingle(),
    supabase
      .from("daily_logs")
      .select("id,meal_id,log_date,title,calories,protein,carbs,fat,created_at")
      .eq("user_id", auth.user.id)
      .eq("log_date", todayIso)
      .order("created_at", { ascending: false }),
    supabase
      .from("meals")
      .select(
        "id,title,cuisine,summary,source,calories,protein,carbs,fat,instructions,why_it_works,grocery_list,created_at,meal_ingredients(*)",
      )
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("daily_logs")
      .select("log_date,calories,protein,carbs,fat")
      .eq("user_id", auth.user.id)
      .gte("log_date", weekStartIso)
      .lte("log_date", todayIso),
  ]);

  if (goalsResult.error || todayLogsResult.error || recentMealsResult.error || weeklyLogsResult.error) {
    return NextResponse.json(
      {
        error:
          goalsResult.error?.message ??
          todayLogsResult.error?.message ??
          recentMealsResult.error?.message ??
          weeklyLogsResult.error?.message ??
          "We could not load your dashboard yet.",
      },
      { status: 500 },
    );
  }

  const goals = goalsResult.data
    ? roundTotals(goalsResult.data)
    : defaultNutritionGoals;

  const todayTotals = roundTotals(
    (todayLogsResult.data ?? []).reduce(
      (sum, log) => ({
        calories: sum.calories + log.calories,
        protein: sum.protein + log.protein,
        carbs: sum.carbs + log.carbs,
        fat: sum.fat + log.fat,
      }),
      emptyTotals(),
    ),
  );

  const weekMap = new Map<string, MacroTotals>();
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + offset);
    weekMap.set(date.toISOString().slice(0, 10), emptyTotals());
  }

  for (const log of weeklyLogsResult.data ?? []) {
    const totals = weekMap.get(log.log_date) ?? emptyTotals();
    weekMap.set(
      log.log_date,
      roundTotals({
        calories: totals.calories + log.calories,
        protein: totals.protein + log.protein,
        carbs: totals.carbs + log.carbs,
        fat: totals.fat + log.fat,
      }),
    );
  }

  const summary: DashboardSummary = {
    goals,
    today: {
      date: todayIso,
      totals: todayTotals,
      remaining: {
        calories: clampRemaining(goals.calories, todayTotals.calories),
        protein: clampRemaining(goals.protein, todayTotals.protein),
        carbs: clampRemaining(goals.carbs, todayTotals.carbs),
        fat: clampRemaining(goals.fat, todayTotals.fat),
      },
      logs: (todayLogsResult.data ?? []).map((log) => ({
        id: log.id,
        mealId: log.meal_id,
        logDate: log.log_date,
        title: log.title,
        calories: log.calories,
        protein: log.protein,
        carbs: log.carbs,
        fat: log.fat,
        createdAt: log.created_at,
      })),
    },
    recentMeals: (recentMealsResult.data ?? []).map((meal) => ({
      id: meal.id,
      title: meal.title,
      cuisine: meal.cuisine,
      summary: meal.summary,
      source: meal.source,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      instructions: meal.instructions ?? [],
      whyItWorks: meal.why_it_works ?? [],
      groceryList: (meal.grocery_list ?? []) as DashboardSummary["recentMeals"][number]["groceryList"],
      ingredients: (meal.meal_ingredients ?? []).map((ingredient) => ({
        id: ingredient.id,
        name: ingredient.name,
        amount: ingredient.amount,
        unit: ingredient.unit,
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
      createdAt: meal.created_at,
    })),
    weekly: Array.from(weekMap.entries()).map(([date, totals]) => ({
      date,
      totals,
    })),
  };

  return NextResponse.json({ summary });
}
