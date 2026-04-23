import { NextResponse } from "next/server";
import { MealGenerationError, reviseMealDraft } from "@/lib/openai-meal-generator";
import type { GeneratedMeal, GeneratedMealFeedback, NutritionGoals } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      meal: GeneratedMeal;
      goals: NutritionGoals;
      feedback: GeneratedMealFeedback;
    };
    const revision = await reviseMealDraft(body.meal, body.goals, body.feedback);
    return NextResponse.json(revision);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Meal revision failed unexpectedly.";
    const status = error instanceof MealGenerationError ? error.status : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
