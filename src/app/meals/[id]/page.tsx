import { SavedMealDetailClient } from "@/components/saved-meal-detail-client";

export default async function SavedMealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <SavedMealDetailClient mealId={id} />;
}
