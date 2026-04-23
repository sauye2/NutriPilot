import { PlaceholderPage } from "@/components/placeholder-page";

export default function DashboardPage() {
  return (
    <PlaceholderPage
      eyebrow="Future tracker"
      title="Daily macro progress, kept calm."
      description="This route is ready for meal history, daily logging, remaining targets, and lightweight progress tracking once saved meals exist."
      bullets={[
        "Reuse NutritionGoals across the meal builder and dashboard.",
        "Log Meal objects into a future day model without changing the calculation pipeline.",
        "Keep progress cards visually aligned with the builder cards.",
        "Avoid dense analytics until the core loop is sticky.",
      ]}
    />
  );
}
