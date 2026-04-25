import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";

type DailyLogRequest = {
  mealId?: string | null;
  logDate?: string;
  title?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser();

  if (auth.response || !auth.user) {
    return auth.response;
  }

  const body = (await request.json()) as DailyLogRequest;
  const logDate = body.logDate ?? new Date().toISOString().slice(0, 10);

  let snapshot = {
    title: body.title ?? "Saved meal",
    calories: Math.round(Number(body.calories) || 0),
    protein: Math.round((Number(body.protein) || 0) * 10) / 10,
    carbs: Math.round((Number(body.carbs) || 0) * 10) / 10,
    fat: Math.round((Number(body.fat) || 0) * 10) / 10,
  };

  if (body.mealId) {
    const { data: meal, error: mealError } = await auth.supabase
      .from("meals")
      .select("id,title,calories,protein,carbs,fat")
      .eq("id", body.mealId)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (mealError) {
      return NextResponse.json(
        { error: mealError.message ?? "We could not find that meal." },
        { status: 500 },
      );
    }

    if (!meal) {
      return NextResponse.json({ error: "Meal not found." }, { status: 404 });
    }

    snapshot = {
      title: meal.title,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
    };
  }

  const { data, error } = await auth.supabase
    .from("daily_logs")
    .insert({
      user_id: auth.user.id,
      meal_id: body.mealId ?? null,
      log_date: logDate,
      ...snapshot,
    })
    .select("id,meal_id,log_date,title,calories,protein,carbs,fat,created_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "We could not log that meal." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    log: {
      id: data.id,
      mealId: data.meal_id,
      logDate: data.log_date,
      title: data.title,
      calories: data.calories,
      protein: data.protein,
      carbs: data.carbs,
      fat: data.fat,
      createdAt: data.created_at,
    },
  });
}
