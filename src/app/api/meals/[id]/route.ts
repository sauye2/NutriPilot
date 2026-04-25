import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";

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
