"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/nutrition-ui";
import { useAuth } from "@/components/auth-provider";
import { GroceryListPanel } from "@/components/grocery-list-panel";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { readAcceptedGeneratedMeal } from "@/lib/generated-meal-storage";
import type { SavedMeal } from "@/lib/types";

export function ShoppingListClient() {
  const searchParams = useSearchParams();
  const mealId = searchParams.get("mealId");
  const { user, isLoading: authLoading } = useAuth();
  const acceptedMeal = readAcceptedGeneratedMeal();
  const [savedMeal, setSavedMeal] = useState<SavedMeal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingSavedMeal, setIsLoadingSavedMeal] = useState(false);

  useEffect(() => {
    if (!mealId || authLoading || !user) {
      return;
    }

    let cancelled = false;

    const loadSavedMeal = async () => {
      setIsLoadingSavedMeal(true);
      setError(null);

      try {
        const response = await fetch(`/api/meals/${mealId}`);
        const payload = (await response.json()) as {
          meal?: SavedMeal;
          error?: string;
        };

        if (cancelled) {
          return;
        }

        if (!response.ok || !payload.meal) {
          setSavedMeal(null);
          setError(payload.error ?? "We couldn't reopen that grocery list yet.");
          return;
        }

        setSavedMeal(payload.meal);
      } catch {
        if (!cancelled) {
          setSavedMeal(null);
          setError("We couldn't reopen that grocery list yet.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSavedMeal(false);
        }
      }
    };

    void loadSavedMeal();

    return () => {
      cancelled = true;
    };
  }, [authLoading, mealId, user]);

  const meal = mealId ? savedMeal : acceptedMeal;
  const heading = mealId && savedMeal ? `${savedMeal.title} Grocery List` : "Grocery List";

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-5 pb-12 pt-4 sm:px-8">
        <PageHeader
          eyebrow="Shopping List"
          title="Grocery list for a meal you want to cook again."
        />

        {isLoadingSavedMeal || authLoading ? (
          <section className="premium-card rounded-[22px] border border-[var(--border)] p-6 shadow-[var(--shadow)]">
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-14 animate-pulse rounded-[12px] bg-[var(--muted-soft)]"
                />
              ))}
            </div>
          </section>
        ) : mealId && !user ? (
          <section className="premium-card rounded-[22px] border border-[var(--border)] p-6 shadow-[var(--shadow)]">
            <SignInPrompt message="Saved grocery lists live with your account, so you'll want to sign in before reopening this one." />
          </section>
        ) : meal ? (
          meal.groceryList.length > 0 ? (
            <GroceryListPanel meal={meal} heading={heading} />
          ) : (
            <section className="premium-card rounded-[22px] border border-[var(--border)] p-6 shadow-[var(--shadow)]">
              <p className="text-sm font-medium text-[var(--foreground)]">
                This meal doesn&apos;t have a saved grocery list yet.
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                You can still reopen the meal details from your dashboard, but there
                wasn&apos;t a bundled shopping list saved with this version.
              </p>
              {savedMeal ? (
                <Link
                  className="mt-4 inline-flex rounded-[8px] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
                  href={`/meals/${savedMeal.id}`}
                >
                  Open Saved Meal
                </Link>
              ) : null}
            </section>
          )
        ) : error ? (
          <section className="premium-card rounded-[22px] border border-[var(--border)] p-6 shadow-[var(--shadow)]">
            <p className="text-sm font-medium text-[var(--foreground)]">
              We couldn&apos;t reopen that grocery list yet.
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{error}</p>
            <Link
              className="mt-4 inline-flex rounded-[8px] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
              href="/dashboard"
            >
              Back to Dashboard
            </Link>
          </section>
        ) : (
          <section className="premium-card rounded-[22px] border border-[var(--border)] p-6 shadow-[var(--shadow)]">
            <p className="text-sm font-medium text-[var(--foreground)]">
              No meal selected yet.
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Accept a generated meal in Lazy Mode, or open a saved meal from your
              dashboard to bring the grocery list back here.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                className="inline-flex rounded-[8px] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
                href="/generate-meal"
              >
                Go to Lazy Mode
              </Link>
              <Link
                className="inline-flex rounded-[8px] border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--muted-soft)]"
                href="/dashboard"
              >
                Open Dashboard
              </Link>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
