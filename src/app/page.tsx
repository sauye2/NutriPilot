import { AppShell } from "@/components/app-shell";
import { MealBuilder } from "@/components/meal-builder";

export default function Home() {
  return (
    <AppShell>
      <MealBuilder />
    </AppShell>
  );
}
