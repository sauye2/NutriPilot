import { NextResponse } from "next/server";
import { getFoodDetails } from "@/lib/food-data-central";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fdcId: string }> },
) {
  const { fdcId } = await params;
  const parsedId = Number.parseInt(fdcId, 10);

  if (!Number.isFinite(parsedId)) {
    return NextResponse.json({ error: "Invalid food id." }, { status: 400 });
  }

  try {
    const food = await getFoodDetails(parsedId);

    if (!food) {
      return NextResponse.json(
        { error: "Could not normalize nutrition data for this food." },
        { status: 404 },
      );
    }

    return NextResponse.json({ food });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Food details failed unexpectedly.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
