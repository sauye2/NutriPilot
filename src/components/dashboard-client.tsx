"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { MetricTile, PageHeader } from "@/components/nutrition-ui";
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

const dashboardMacroColors: Record<MacroKey, string> = {
  calories: "var(--primary)",
  protein: "#336d9d",
  carbs: "#9b6a2f",
  fat: "#8f5f74",
};

const weeklyCardClasses = [
  "bg-[#f5ede0] border-[#ead9c0]",
  "bg-[#f1efe6] border-[#e1ddd1]",
  "bg-[#f3e6e7] border-[#e8d0d2]",
  "bg-[#eaf1eb] border-[#d6e4d8]",
  "bg-[#eee8f2] border-[#ddd2e6]",
  "bg-[#f5ece7] border-[#ead8cd]",
  "bg-[#eef2e8] border-[#dce6d1]",
];

export function DashboardClient() {
  const { user, isLoading: authLoading } = useAuth();
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
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
  const [goalPlaceholdersByState, setGoalPlaceholdersByState] = useState<GoalDraft>({
    calories: goalPlaceholders.calories,
    protein: goalPlaceholders.protein,
    carbs: goalPlaceholders.carbs,
    fat: goalPlaceholders.fat,
  });

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
        const response = await fetch(`/api/dashboard/summary?tz=${encodeURIComponent(timeZone)}`);
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
        setGoals({ calories: "", protein: "", carbs: "", fat: "" });
        setGoalPlaceholdersByState({
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
  }, [authLoading, timeZone, user]);

  async function refreshSummary() {
    if (!user) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/dashboard/summary?tz=${encodeURIComponent(timeZone)}`);
      const payload = (await response.json()) as {
        summary?: DashboardSummary;
        error?: string;
      };

      if (!response.ok || !payload.summary) {
        setError(payload.error ?? "We couldn't refresh the dashboard yet.");
        return;
      }

      setSummary(payload.summary);
      setGoalPlaceholdersByState({
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
        body: JSON.stringify({ mealId: meal.id, timeZone }),
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
      const goalsPayload: NutritionGoals = {
        calories: parseGoalDraftValue(goals.calories, displayedGoals.calories),
        protein: parseGoalDraftValue(goals.protein, displayedGoals.protein),
        carbs: parseGoalDraftValue(goals.carbs, displayedGoals.carbs),
        fat: parseGoalDraftValue(goals.fat, displayedGoals.fat),
      };

      const response = await fetch("/api/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goals: goalsPayload,
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

      setGoals({ calories: "", protein: "", carbs: "", fat: "" });
      setGoalPlaceholdersByState({
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
  const inputGoalPlaceholders = user ? goalPlaceholdersByState : goalPlaceholders;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-5 pb-12 pt-4 sm:px-8">
        <PageHeader
          eyebrow="Dashboard"
          title={
            user
              ? "A calmer view of your meals, goals, and today."
              : "A warm home base for meals worth repeating."
          }
          showPreview
        >
          <p>
            {user
              ? "Keep your goals nearby, log meals as they happen, and come back to the ones you already know you'd make again."
              : "Sign in when you're ready to save meals, keep your nutrition goals in sync, and build a simple history that stays with you."}
          </p>
        </PageHeader>

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
                <div className="space-y-4">
                  {(["calories", "protein", "carbs", "fat"] as MacroKey[]).map((key) => (
                    <DashboardProgressBar
                      key={key}
                      label={labelForMacro(key)}
                      actual={summary.today.totals[key]}
                      goal={displayedGoals[key]}
                      unit={unitForMacro(key)}
                      color={dashboardMacroColors[key]}
                    />
                  ))}
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
                  {[...summary.weekly].reverse().map((day) => (
                    <div
                      key={day.date}
                      className={`grid grid-cols-[1fr_auto] items-center gap-4 rounded-[12px] border px-4 py-3 ${weeklyCardClasses[getWeeklyCardIndex(day.date)]}`}
                    >
                      <div className="flex min-h-[44px] items-center">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {formatCompactDate(day.date)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {day.totals.calories} kcal
                        </p>
                        <p className="mt-1 text-[10px] text-[var(--muted)]">
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
                        placeholder={inputGoalPlaceholders[key]}
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
                            className="rounded-[10px] border border-[#e6c8c6] bg-[#fff1f0] px-3 py-2 text-sm font-semibold text-[#9b4b47] transition duration-200 hover:bg-[#fde7e5] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
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
                      Save a meal from Meal Builder or Build a Meal for Me and it&apos;ll show up
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
    <MetricTile label={label} value={value} helper={helper} />
  );
}

function DashboardProgressBar({
  label,
  actual,
  goal,
  unit,
  color,
}: {
  label: string;
  actual: number;
  goal: number;
  unit: string;
  color: string;
}) {
  const percent = goal > 0 ? Math.min((actual / goal) * 100, 100) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
        <span className="text-sm text-[var(--muted)]">
          <strong className="font-semibold text-[var(--foreground)]">{actual}</strong> / {goal}
          {unit}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--muted-soft)] shadow-inner">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percent}%`, background: color }}
        />
      </div>
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
              Calora still works great for quick calculations without an account.
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
          body="Start with your targets, cuisine, and anchor food, then let Calora sketch something satisfying."
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
      <div className="premium-card rounded-[18px] border border-[var(--border)] px-4 py-4 shadow-sm">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="premium-card rounded-[18px] border border-[var(--border)] px-4 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-white"
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

function getWeeklyCardIndex(dateString: string) {
  const digits = dateString.replace(/\D/g, "");
  const sum = digits.split("").reduce((total, digit) => total + Number(digit), 0);

  return sum % weeklyCardClasses.length;
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

function parseGoalDraftValue(value: string, fallback: number) {
  const trimmed = value.trim();

  if (!trimmed) {
    return fallback;
  }

  return Number(trimmed) || 0;
}
