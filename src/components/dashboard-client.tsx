"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SectionCard } from "@/components/section-card";
import { SignInPrompt } from "@/components/sign-in-prompt";
import type { DashboardSummary, SavedMeal } from "@/lib/types";

export function DashboardClient() {
  const { user, isLoading: authLoading } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeMealId, setActiveMealId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      return;
    }

    let cancelled = false;

    const loadSummary = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/dashboard/summary");
        const payload = (await response.json()) as {
          summary?: DashboardSummary;
          error?: string;
        };

        if (cancelled) {
          return;
        }

        if (!response.ok || !payload.summary) {
          setSummary(null);
          setError(payload.error ?? "We couldn’t load your dashboard yet.");
          return;
        }

        setSummary(payload.summary);
      } catch {
        if (!cancelled) {
          setSummary(null);
          setError("We couldn’t load your dashboard yet.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadSummary();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  async function refreshSummary() {
    if (!user) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/dashboard/summary");
      const payload = (await response.json()) as {
        summary?: DashboardSummary;
        error?: string;
      };

      if (!response.ok || !payload.summary) {
        setError(payload.error ?? "We couldn’t refresh the dashboard yet.");
        return;
      }

      setSummary(payload.summary);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function logMealToday(meal: SavedMeal) {
    setActiveMealId(meal.id);
    setError(null);

    try {
      const response = await fetch("/api/daily-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealId: meal.id }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "We couldn’t log that meal yet.");
        return;
      }

      await refreshSummary();
    } finally {
      setActiveMealId(null);
    }
  }

  async function deleteMeal(meal: SavedMeal) {
    setActiveMealId(meal.id);
    setError(null);

    try {
      const response = await fetch(`/api/meals/${meal.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "We couldn’t delete that meal yet.");
        return;
      }

      await refreshSummary();
    } finally {
      setActiveMealId(null);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-5 pb-12 pt-4 sm:px-8">
        <section className="mb-8 max-w-4xl">
          <p className="mb-3 text-sm font-semibold uppercase text-[var(--primary)]">
            Dashboard
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-[var(--foreground)] sm:text-5xl">
            A calmer view of what you’ve saved and what today looks like.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
            Keep your goals nearby, log meals as they happen, and come back to the
            meals you already know you’d make again.
          </p>
        </section>

        {authLoading || isLoading ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <SectionCard title="Today’s progress" eyebrow="Loading">
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-16 animate-pulse rounded-[12px] bg-[var(--muted-soft)]"
                  />
                ))}
              </div>
            </SectionCard>
            <SectionCard title="Recent meals" eyebrow="Loading">
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-24 animate-pulse rounded-[12px] bg-[var(--muted-soft)]"
                  />
                ))}
              </div>
            </SectionCard>
          </div>
        ) : !user ? (
          <SectionCard title="Sign in for your dashboard" eyebrow="Cloud saving">
            <SignInPrompt message="Your dashboard comes to life once you’re signed in. That’s what unlocks saved meals, daily logs, and your personal goals." />
          </SectionCard>
        ) : error && !summary ? (
          <SectionCard title="We hit a snag" eyebrow="Dashboard">
            <p className="text-sm leading-6 text-[var(--muted)]">{error}</p>
          </SectionCard>
        ) : summary ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
            <div className="space-y-6">
              <SectionCard title="Today’s Progress" eyebrow="Daily totals">
                <div className="grid gap-3 sm:grid-cols-4">
                  <SummaryStat label="Calories" value={`${summary.today.totals.calories}`} helper={`${summary.today.remaining.calories} left`} />
                  <SummaryStat label="Protein" value={`${summary.today.totals.protein}g`} helper={`${summary.today.remaining.protein}g left`} />
                  <SummaryStat label="Carbs" value={`${summary.today.totals.carbs}g`} helper={`${summary.today.remaining.carbs}g left`} />
                  <SummaryStat label="Fat" value={`${summary.today.totals.fat}g`} helper={`${summary.today.remaining.fat}g left`} />
                </div>
              </SectionCard>

              <SectionCard title="Today’s Logs" eyebrow="Meals logged today">
                {summary.today.logs.length > 0 ? (
                  <div className="space-y-3">
                    {summary.today.logs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-[12px] border border-[var(--border)] bg-white/80 px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-[var(--foreground)]">{log.title}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">{log.logDate}</p>
                          </div>
                          <div className="text-right text-sm text-[var(--muted)]">
                            <p>{log.calories} kcal</p>
                            <p>{log.protein}P / {log.carbs}C / {log.fat}F</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[12px] border border-dashed border-[var(--border)] bg-[var(--muted-soft)] px-4 py-8 text-center">
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      Nothing logged yet today.
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      Save a meal first, then log it from the recent meals list on the right.
                    </p>
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Last 7 Days" eyebrow="Weekly rhythm">
                <div className="space-y-3">
                  {summary.weekly.map((day) => (
                    <div
                      key={day.date}
                      className="flex items-center justify-between gap-4 rounded-[12px] border border-[var(--border)] bg-white/80 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">{day.date}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {day.totals.protein}P / {day.totals.carbs}C / {day.totals.fat}F
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {day.totals.calories} kcal
                      </p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>

            <div className="space-y-6">
              <SectionCard title="Your Goals" eyebrow="Saved targets">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SummaryStat label="Calories" value={`${summary.goals.calories}`} helper="daily target" />
                  <SummaryStat label="Protein" value={`${summary.goals.protein}g`} helper="daily target" />
                  <SummaryStat label="Carbs" value={`${summary.goals.carbs}g`} helper="daily target" />
                  <SummaryStat label="Fat" value={`${summary.goals.fat}g`} helper="daily target" />
                </div>
                <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                  Need to adjust these? The Nutrition Goals card in Meal Builder updates the same saved targets.
                </p>
              </SectionCard>

              <SectionCard title="Recent Meals" eyebrow="Ready to reuse">
                {summary.recentMeals.length > 0 ? (
                  <div className="space-y-3">
                    {summary.recentMeals.map((meal) => (
                      <div
                        key={meal.id}
                        className="rounded-[12px] border border-[var(--border)] bg-white/80 px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-[var(--foreground)]">{meal.title}</p>
                            <p className="mt-1 text-sm text-[var(--muted)]">{meal.summary}</p>
                            <p className="mt-2 text-xs text-[var(--muted)]">
                              {meal.calories} kcal · {meal.protein}P / {meal.carbs}C / {meal.fat}F
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link
                            className="rounded-[10px] border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition duration-200 hover:bg-[var(--muted-soft)] active:scale-[0.99]"
                            href={`/meals/${meal.id}`}
                          >
                            Open Meal
                          </Link>
                          {meal.groceryList.length > 0 ? (
                            <Link
                              className="rounded-[10px] border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition duration-200 hover:bg-[var(--muted-soft)] active:scale-[0.99]"
                              href={`/shopping-list?mealId=${meal.id}`}
                            >
                              Grocery List
                            </Link>
                          ) : null}
                          <button
                            className="rounded-[10px] bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-[var(--primary-strong)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={activeMealId === meal.id}
                            type="button"
                            onClick={() => void logMealToday(meal)}
                          >
                            {activeMealId === meal.id ? "Working..." : "Log Today"}
                          </button>
                          <button
                            className="rounded-[10px] border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition duration-200 hover:bg-[var(--muted-soft)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={activeMealId === meal.id}
                            type="button"
                            onClick={() => void deleteMeal(meal)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[12px] border border-dashed border-[var(--border)] bg-[var(--muted-soft)] px-4 py-8 text-center">
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      No saved meals yet.
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      Save a meal from Meal Builder or Lazy Mode and it’ll show up here.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <Link
                        className="rounded-[10px] bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-[var(--primary-strong)] active:scale-[0.99]"
                        href="/meal-builder"
                      >
                        Open Meal Builder
                      </Link>
                      <Link
                        className="rounded-[10px] border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition duration-200 hover:bg-[var(--muted-soft)] active:scale-[0.99]"
                        href="/generate-meal"
                      >
                        Open Lazy Mode
                      </Link>
                    </div>
                  </div>
                )}
              </SectionCard>

              {error ? (
                <SectionCard title="Heads up" eyebrow="Dashboard">
                  <p className="text-sm leading-6 text-[var(--danger)]">{error}</p>
                </SectionCard>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function SummaryStat({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-white/80 px-4 py-4">
      <p className="text-xs font-semibold uppercase text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{helper}</p>
    </div>
  );
}
