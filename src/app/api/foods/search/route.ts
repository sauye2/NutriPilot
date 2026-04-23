import { NextResponse } from "next/server";
import { resolveIngredientMatch, searchFoods } from "@/lib/food-data-central";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ foods: [], resolution: null });
  }

  try {
    const [foods, resolution] = await Promise.all([
      searchFoods(query),
      resolveIngredientMatch(query),
    ]);
    return NextResponse.json({ foods, resolution });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Food search failed unexpectedly.";

    return NextResponse.json(
      { foods: [], resolution: null, error: message },
      { status: 500 },
    );
  }
}
