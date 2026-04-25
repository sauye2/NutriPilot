import { NextResponse } from "next/server";
import { mapSavedMeal, type MealRow } from "@/lib/saved-meals";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";

const mealSelect =
  "id,title,cuisine,summary,source,calories,protein,carbs,fat,instructions,why_it_works,grocery_list,created_at,meal_ingredients(*)";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthenticatedUser();

  if (auth.response || !auth.user) {
    return auth.response;
  }

  const { id } = await context.params;

  const { data, error } = await auth.supabase
    .from("meals")
    .select(mealSelect)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "We couldn't load that meal yet." },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Meal not found." }, { status: 404 });
  }

  return NextResponse.json({ meal: mapSavedMeal(data as MealRow) });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthenticatedUser();

  if (auth.response || !auth.user) {
    return auth.response;
  }

  const { id } = await context.params;

  const { data: meal, error: mealError } = await auth.supabase
    .from("meals")
    .select("id")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (mealError) {
    return NextResponse.json(
      { error: mealError.message ?? "We could not delete that meal." },
      { status: 500 },
    );
  }

  if (!meal) {
    return NextResponse.json({ error: "Meal not found." }, { status: 404 });
  }

  const { error } = await auth.supabase.from("meals").delete().eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "We could not delete that meal." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
