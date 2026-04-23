import { NextResponse } from "next/server";
import { importRecipeFromUrl } from "@/lib/recipe-import";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };
    const url = body.url?.trim();

    if (!url) {
      return NextResponse.json({ error: "Recipe URL is required." }, { status: 400 });
    }

    const recipe = await importRecipeFromUrl(url);
    return NextResponse.json({ recipe });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Recipe import failed unexpectedly.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
