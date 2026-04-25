import { NextResponse } from "next/server";
import { defaultNutritionGoals } from "@/lib/default-goals";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import type { NutritionGoals } from "@/lib/types";

function sanitizeGoals(input: Partial<NutritionGoals>): NutritionGoals {
  return {
    calories: Math.max(0, Math.round(Number(input.calories) || 0)),
    protein: Math.max(0, Math.round((Number(input.protein) || 0) * 10) / 10),
    carbs: Math.max(0, Math.round((Number(input.carbs) || 0) * 10) / 10),
    fat: Math.max(0, Math.round((Number(input.fat) || 0) * 10) / 10),
  };
}

export async function GET() {
  const auth = await requireAuthenticatedUser();

  if (auth.response || !auth.user) {
    return auth.response;
  }

  const supabase = auth.supabase;
  const { data, error } = await supabase
    .from("nutrition_goals")
    .select("calories,protein,carbs,fat")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "We could not load your goals." },
      { status: 500 },
    );
  }

  if (data) {
    return NextResponse.json({ goals: sanitizeGoals(data) });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("nutrition_goals")
    .insert({
      user_id: auth.user.id,
      ...defaultNutritionGoals,
    })
    .select("calories,protein,carbs,fat")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json({ goals: defaultNutritionGoals });
  }

  return NextResponse.json({ goals: sanitizeGoals(inserted) });
}

export async function PUT(request: Request) {
  const auth = await requireAuthenticatedUser();

  if (auth.response || !auth.user) {
    return auth.response;
  }

  const body = (await request.json()) as { goals?: Partial<NutritionGoals> };

  if (!body.goals) {
    return NextResponse.json({ error: "Goals are required." }, { status: 400 });
  }

  const goals = sanitizeGoals(body.goals);

  const { data, error } = await auth.supabase
    .from("nutrition_goals")
    .upsert(
      {
        user_id: auth.user.id,
        ...goals,
      },
      {
        onConflict: "user_id",
      },
    )
    .select("calories,protein,carbs,fat")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "We could not update your goals." },
      { status: 500 },
    );
  }

  return NextResponse.json({ goals: sanitizeGoals(data) });
}
