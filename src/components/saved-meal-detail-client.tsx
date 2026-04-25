"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { GroceryListPanel } from "@/components/grocery-list-panel";
import { SectionCard } from "@/components/section-card";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { useAuth } from "@/components/auth-provider";
import {
  formatIngredientCalories,
  formatIngredientLine,
} from "@/lib/ingredient-text";
import type { SavedMeal } from "@/lib/types";

export function SavedMealDetailClient({ mealId }: { mealId: string }) {
  const { user, isLoading: authLoading } = useAuth();
  const [meal, setMeal] = useState<SavedMeal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    let cancelled = false;

    const loadMeal = async () => {
      setIsLoading(true);
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
          setMeal(null);
          setError(payload.error ?? "We couldn't open that saved meal yet.");
          return;
        }

        setMeal(payload.meal);
      } catch {
        if (!cancelled) {
          setMeal(null);
          setError("We couldn't open that saved meal yet.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadMeal();

    return () => {
      cancelled = true;
    };
  }, [authLoading, mealId, user]);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-5 pb-12 pt-4 sm:px-8">
        <section className="mb-8 max-w-4xl">
          <p className="mb-3 text-sm font-semibold uppercase text-[var(--primary)]">
            Saved Meal
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-[var(--foreground)] sm:text-5xl">
            Come back to a meal you already liked, with the details still intact.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
            Ingredients, instructions, and the grocery list stay close by so it is easy
            to pick this up again later.
          </p>
        </section>

        {authLoading || (user ? isLoading : false) ? (
          <SectionCard title="Opening your meal" eyebrow="Saved">
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-16 animate-pulse rounded-[12px] bg-[var(--muted-soft)]"
                />
              ))}
            </div>
          </SectionCard>
        ) : !user ? (
          <SectionCard title="Sign in to reopen saved meals" eyebrow="Cloud saving">
            <SignInPrompt message="Saved meals live in your account, so you'll want to sign in before opening them again." />
          </SectionCard>
        ) : error || !meal ? (
          <SectionCard title="We couldn't open that meal" eyebrow="Saved meal">
            <p className="text-sm leading-6 text-[var(--muted)]">
              {error ?? "That meal doesn't seem to be available right now."}
            </p>
            <div className="mt-4">
              <Link
                className="inline-flex rounded-[10px] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-[var(--primary-strong)]"
                href="/dashboard"
              >
                Back to Dashboard
              </Link>
            </div>
          </SectionCard>
        ) : (
          <div className="space-y-6">
            <SectionCard
              title={meal.title}
              eyebrow={meal.cuisine || meal.source}
              action={
                <div className="flex flex-wrap gap-2">
                  {meal.groceryList.length > 0 ? (
                    <Link
                      className="rounded-[10px] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-[var(--primary-strong)]"
                      href={`/shopping-list?mealId=${meal.id}`}
                    >
                      Open Grocery List
                    </Link>
                  ) : null}
                  <Link
                    className="rounded-[10px] border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition duration-200 hover:bg-[var(--muted-soft)]"
                    href="/dashboard"
                  >
                    Back to Dashboard
                  </Link>
                </div>
              }
            >
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-4">
                  <SavedMealStat label="Calories" value={`${meal.calories}`} />
                  <SavedMealStat label="Protein" value={`${meal.protein}g`} />
                  <SavedMealStat label="Carbs" value={`${meal.carbs}g`} />
                  <SavedMealStat label="Fat" value={`${meal.fat}g`} />
                </div>

                {meal.summary ? (
                  <div className="rounded-[12px] bg-[var(--muted-soft)] px-4 py-4 text-sm leading-6 text-[var(--muted)]">
                    {meal.summary}
                  </div>
                ) : null}

                <div className="grid gap-5 lg:grid-cols-2">
                  <div>
                    <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                      Ingredients
                    </h2>
                    <div className="space-y-2">
                      {meal.ingredients.map((ingredient) => (
                        <div
                          key={ingredient.id ?? `${ingredient.name}-${ingredient.amount}-${ingredient.unit}`}
                          className="rounded-[12px] border border-[var(--border)] bg-white/80 px-4 py-3"
                        >
                          <p className="text-sm font-medium text-[var(--foreground)]">
                            {formatIngredientLine(
                              ingredient.amount,
                              ingredient.unit,
                              ingredient.name,
                              ingredient.notes,
                            )}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {formatIngredientCalories({
                              totals: {
                                calories: ingredient.calories,
                              },
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-5">
                    {meal.whyItWorks.length > 0 ? (
                      <div>
                        <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                          Why it still works
                        </h2>
                        <div className="space-y-2">
                          {meal.whyItWorks.map((point) => (
                            <div
                              key={point}
                              className="rounded-[12px] border border-[var(--border)] bg-white/80 px-4 py-3 text-sm leading-6 text-[var(--muted)]"
                            >
                              {point}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {meal.instructions.length > 0 ? (
                      <div>
                        <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                          Instructions
                        </h2>
                        <div className="space-y-2">
                          {meal.instructions.map((step, index) => (
                            <div
                              key={`${index + 1}-${step}`}
                              className="rounded-[12px] border border-[var(--border)] bg-white/80 px-4 py-3 text-sm leading-6 text-[var(--muted)]"
                            >
                              <span className="mr-2 font-semibold text-[var(--foreground)]">
                                {index + 1}.
                              </span>
                              {step}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {meal.groceryList.length === 0 ? (
                      <div className="rounded-[12px] border border-dashed border-[var(--border)] bg-[var(--muted-soft)] px-4 py-6">
                        <p className="text-sm font-medium text-[var(--foreground)]">
                          No grocery list was saved with this one.
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                          Manual meals can still live in your dashboard even when they
                          do not have a bundled shopping list.
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </SectionCard>

            {meal.groceryList.length > 0 ? (
              <GroceryListPanel meal={meal} heading={`${meal.title} Grocery List`} />
            ) : null}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function SavedMealStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-white/80 px-4 py-4">
      <p className="text-xs font-semibold uppercase text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
