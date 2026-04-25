import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function requireAuthenticatedUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      response: NextResponse.json(
        { error: "Please sign in to save meals, update goals, and view your dashboard." },
        { status: 401 },
      ),
      supabase,
      user: null,
    };
  }

  return {
    response: null,
    supabase,
    user,
  };
}
