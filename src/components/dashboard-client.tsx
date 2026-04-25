"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SectionCard } from "@/components/section-card";
import { defaultNutritionGoals } from "@/lib/default-goals";
import type { DashboardSummary, MacroKey, NutritionGoals, SavedMeal } from "@/lib/types";

type GoalDraft = Record<MacroKey, string>;

const goalPlaceholders: Record<MacroKey, string> = {
  calories: "2200",
  protein: "150",
  carbs: "240",
  fat: "70",
};

export function DashboardClient() {
  const { user, isLoading: authLoading } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeMealId, setActiveMealId] = useState<string | null>(null);
  const [goals, setGoals] = useState<GoalDraft>({
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });
  const [isSavingGoals, setIsSavingGoals] = useState(false);
  const [goalMessage, setGoalMessage] = useState<string | null>(null);
  const [goalError, setGoalError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setSummary(null);
      setIsLoading(false);
      setGoals({
        calories: "",
        protein: "",
        carbs: "",
        fat: "",
      });
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
          setError(payload.error ?? "We couldn't load your dashboard just yet.");
          return;
        }

        setSummary(payload.summary);
        setGoals({
          calories: payload.summary.goals.calories.toString(),
          protein: payload.summary.goals.protein.toString(),
          carbs: payload.summary.goals.carbs.toString(),
          fat: payload.summary.goals.fat.toString(),
        });
      } catch {
        if (!cancelled) {
          setSummary(null);
          setError("We couldn't load your dashboard just yet.");
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
        setError(payload.error ?? "We couldn't refresh the dashboard yet.");
        return;
      }

      setSummary(payload.summary);
      setGoals({
        calories: payload.summary.goals.calories.toString(),
        protein: payload.summary.goals.protein.toString(),
        carbs: payload.summary.goals.carbs.toString(),
        fat: payload.summary.goals.fat.toString(),
      });
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
        setError(payload.error ?? "We couldn't log that meal yet.");
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
        setError(payload.error ?? "We couldn't delete that meal yet.");
        return;
      }

      await refreshSummary();
    } finally {
      setActiveMealId(null);
    }
  }

  async function handleSaveGoals() {
    setGoalError(null);
    setGoalMessage(null);

    if (!user) {
      return;
    }

    setIsSavingGoals(true);

    try {
      const response = await fetch("/api/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goals: {
            calories: Number(goals.calories) || 0,
            protein: Number(goals.protein) || 0,
            carbs: Number(goals.carbs) || 0,
            fat: Number(goals.fat) || 0,
          } satisfies NutritionGoals,
        }),
      });

      const payload = (await response.json()) as {
        goals?: NutritionGoals;
        error?: string;
      };

      if (!response.ok || !payload.goals) {
        setGoalError(payload.error ?? "We couldn't save those goals yet.");
        return;
      }

      setGoals({
        calories: payload.goals.calories.toString(),
        protein: payload.goals.protein.toString(),
        carbs: payload.goals.carbs.toString(),
        fat: payload.goals.fat.toString(),
      });
      setGoalMessage("Goals saved. Meal Builder and Build a Meal for Me will use these too.");
      await refreshSummary();
    } catch {
      setGoalError("We couldn't save those goals yet.");
    } finally {
      setIsSavingGoals(false);
    }
  }

  function updateGoal(key: MacroKey, value: string) {
    setGoals((current) => ({ ...current, [key]: value }));
    setGoalError(null);
    setGoalMessage(null);
  }

  const displayedGoals = summary?.goals ?? defaultNutritionGoals;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-5 pb-12 pt-4 sm:px-8">
        <section className="mb-8 max-w-4xl">
          <p className="mb-3 text-sm font-semibold uppercase text-[var(--primary)]">
            Dashboard
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-[var(--foreground)] sm:text-5xl">
            {user
              ? "A calmer view of what you've saved and how today is shaping up."
              : "A warm home base for the meals you want to keep coming back to."}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
            {user
              ? "Keep your goals nearby, log meals as they happen, and come back to the ones you already know you'd make again."
              : "Sign in when you're ready to save meals, keep your nutrition goals in sync, and build a simple history that stays with you."}
          </p>
        </section>

        {authLoading ? (
          <WarmLoadingState />
        ) : !user ? (
          <SignedOutDashboard />
        ) : isLoading ? (
          <WarmLoadingState />
        ) : error && !summary ? (
          <SectionCard title="We hit a snag" eyebrow="Dashboard">
            <p className="text-sm leading-6 text-[var(--muted)]">{error}</p>
          </SectionCard>
        ) : summary ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
            <div className="space-y-6">
              <SectionCard title="Today's Progress" eyebrow="Daily totals">
                <div className="grid gap-3 sm:grid-cols-4">
                  <SummaryStat
                    label="Calories"
                    value={`${summary.today.totals.calories}`}
                    helper={`${summary.today.remaining.calories} left`}
                  />
                  <SummaryStat
                    label="Protein"
                    value={`${summary.today.totals.protein}g`}
                    helper={`${summary.today.remaining.protein}g left`}
                  />
                  <SummaryStat
                    label="Carbs"
                    value={`${summary.today.totals.carbs}g`}
                    helper={`${summary.today.remaining.carbs}g left`}
                  />
                  <SummaryStat
                    label="Fat"
                    value={`${summary.today.totals.fat}g`}
                    helper={`${summary.today.remaining.fat}g left`}
                  />
                </div>
              </SectionCard>

              <SectionCard title="Today's Logs" eyebrow="Meals logged today">
                {summary.today.logs.length > 0 ? (
                  <div className="space-y-3">
                    {summary.today.logs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-[12px] border border-[var(--border)] bg-white/80 px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-[var(--foreground)]">
                              {log.title}
                            </p>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              {formatCompactDate(log.logDate)}
                            </p>
                          </div>
                          <div className="text-right text-sm text-[var(--muted)]">
                            <p>{log.calories} kcal</p>
                            <p>
                              {log.protein}P / {log.carbs}C / {log.fat}F
                            </p>
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
                      className="grid grid-cols-[1fr_auto] items-start gap-4 rounded-[12px] border border-[var(--border)] bg-white/80 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {formatCompactDate(day.date)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {day.totals.calories} kcal
                        </p>
                        <p className="mt-1 text-[11px] text-[var(--muted)]">
                          {day.totals.protein}P / {day.totals.carbs}C / {day.totals.fat}F
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>

            <div className="space-y-6">
              <SectionCard
                title="Nutrition Goals"
                eyebrow="Targets"
                action={
                  <button
                    className="rounded-[10px] bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-[var(--primary-strong)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSavingGoals}
                    type="button"
                    onClick={() => void handleSaveGoals()}
                  >
                    {isSavingGoals ? "Saving..." : "Save Goals"}
                  </button>
                }
              >
                <div className="grid grid-cols-2 gap-3">
                  {(["calories", "protein", "carbs", "fat"] as MacroKey[]).map((key) => (
                    <label key={key} className="block">
                      <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
                        {labelForMacro(key)} ({unitForMacro(key)})
                      </span>
                      <input
                        className="focus-ring h-11 w-full rounded-[12px] border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)]"
                        min="0"
                        step={key === "calories" ? 10 : 1}
                        type="number"
                        placeholder={goalPlaceholders[key]}
                        value={goals[key]}
                        onChange={(event) => updateGoal(key, event.target.value)}
                      />
                    </label>
                  ))}
                </div>
                {goalMessage ? (
                  <p className="mt-4 text-sm font-medium text-[var(--primary-strong)]">
                    {goalMessage}
                  </p>
                ) : null}
                {goalError ? (
                  <p className="mt-4 text-sm font-medium text-[var(--danger)]">
                    {goalError}
                  </p>
                ) : null}
              </SectionCard>

              <SectionCard title="Current Targets" eyebrow="Saved goals">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SummaryStat
                    label="Calories"
                    value={`${displayedGoals.calories}`}
                    helper="daily target"
                  />
                  <SummaryStat
                    label="Protein"
                    value={`${displayedGoals.protein}g`}
                    helper="daily target"
                  />
                  <SummaryStat
                    label="Carbs"
                    value={`${displayedGoals.carbs}g`}
                    helper="daily target"
                  />
                  <SummaryStat
                    label="Fat"
                    value={`${displayedGoals.fat}g`}
                    helper="daily target"
                  />
                </div>
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
                            <p className="text-sm font-semibold text-[var(--foreground)]">
                              {meal.title}
                            </p>
                            <p className="mt-1 text-sm text-[var(--muted)]">{meal.summary}</p>
                            <p className="mt-2 text-xs text-[var(--muted)]">
                              {meal.calories} kcal - {meal.protein}P / {meal.carbs}C /{" "}
                              {meal.fat}F
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
                      Save a meal from Meal Builder or Build a Meal for Me and it'll show up
                      here.
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
                        Open Build a Meal for Me
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

function SignedOutDashboard() {
  return (
    <div className="space-y-6">
      <SectionCard title="Save the meals worth repeating" eyebrow="A better starting point">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
          <div>
            <p className="text-sm leading-6 text-[var(--muted)]">
              NutriPilot still works great for quick calculations without an account.
              Signing in gives you a calmer home base: saved meals, grocery lists you
              can reopen later, and goals that stay in sync across the app.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-[12px] bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-[var(--primary-strong)] active:scale-[0.99]"
              >
                Create account
              </Link>
              <Link
                href="/login"
                className="rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition duration-200 hover:bg-[var(--muted-soft)] active:scale-[0.99]"
              >
                Log in
              </Link>
            </div>
          </div>
          <div className="grid gap-3">
            <WarmFeatureCard
              title="Keep your goals nearby"
              body="Set your calories and macros once, then use the same targets in Meal Builder and Build a Meal for Me."
            />
            <WarmFeatureCard
              title="Come back to saved meals"
              body="Keep the meals you liked, reopen them later, and pull the grocery list back up when you need it."
            />
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-3">
        <WarmFeatureCard
          title="Meal Builder"
          body="Total the meal you're already planning and see how it compares."
          href="/meal-builder"
        />
        <WarmFeatureCard
          title="Build a Meal for Me"
          body="Start with your targets, cuisine, and anchor food, then let NutriPilot sketch something satisfying."
          href="/generate-meal"
        />
        <WarmFeatureCard
          title="Import Recipe"
          body="Pull in a recipe link, clean up the ingredients, and carry it into the same nutrition workflow."
          href="/import-recipe"
        />
      </div>
    </div>
  );
}

function WarmFeatureCard({
  title,
  body,
  href,
}: {
  title: string;
  body: string;
  href?: string;
}) {
  const content = (
    <>
      <p className="text-base font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{body}</p>
      {href ? (
        <span className="mt-4 inline-flex text-sm font-semibold text-[var(--primary)]">
          Open
        </span>
      ) : null}
    </>
  );

  if (!href) {
    return (
      <div className="rounded-[14px] border border-[var(--border)] bg-white/80 px-4 py-4 shadow-sm">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="rounded-[14px] border border-[var(--border)] bg-white/80 px-4 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-white"
    >
      {content}
    </Link>
  );
}

function WarmLoadingState() {
  return (
    <SectionCard title="Getting your space ready" eyebrow="Dashboard">
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-[14px] border border-[var(--border)] bg-white/75 px-4 py-4"
          >
            <div className="h-3 w-24 animate-pulse rounded-full bg-[var(--muted-soft)]" />
            <div className="mt-4 h-7 w-20 animate-pulse rounded-full bg-[var(--muted-soft)]" />
            <div className="mt-3 h-3 w-28 animate-pulse rounded-full bg-[var(--muted-soft)]" />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function formatCompactDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);

  if (!year || !month || !day) {
    return dateString;
  }

  return `${month}/${day}/${String(year).slice(-2)}`;
}

function labelForMacro(key: MacroKey) {
  switch (key) {
    case "calories":
      return "Calories";
    case "protein":
      return "Protein";
    case "carbs":
      return "Carbs";
    case "fat":
      return "Fat";
  }
}

function unitForMacro(key: MacroKey) {
  return key === "calories" ? "kcal" : "g";
}
