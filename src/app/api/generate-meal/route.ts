import { NextResponse } from "next/server";
import { generateMealDraft, MealGenerationError } from "@/lib/openai-meal-generator";
import type { GeneratedMealRequest } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GeneratedMealRequest;
    const meal = await generateMealDraft(body);
    return NextResponse.json({ meal });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Meal generation failed unexpectedly.";
    const status = error instanceof MealGenerationError ? error.status : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
