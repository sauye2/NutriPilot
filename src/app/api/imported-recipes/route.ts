import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { buildImportedRecipeRecord } from "@/lib/meal-persistence";
import type { ImportedRecipe } from "@/lib/types";

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser();

  if (auth.response || !auth.user) {
    return auth.response;
  }

  const body = (await request.json()) as { recipe?: ImportedRecipe };

  if (!body.recipe) {
    return NextResponse.json({ error: "Imported recipe data is required." }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("imported_recipes")
    .insert({
      user_id: auth.user.id,
      ...buildImportedRecipeRecord(body.recipe),
    })
    .select("id,title,source_url,image_url,ingredients,warnings,created_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "We could not save that recipe yet." },
      { status: 500 },
    );
  }

  return NextResponse.json({ recipe: data });
}
