"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { GroceryListPanel } from "@/components/grocery-list-panel";
import { SectionCard } from "@/components/section-card";
import { saveAcceptedGeneratedMeal } from "@/lib/generated-meal-storage";
import {
  formatIngredientCalories,
  formatIngredientLine,
} from "@/lib/ingredient-text";
import type {
  GeneratedMeal,
  GeneratedMealFeedback,
  GeneratedMealRevision,
  GoalGap,
  MacroKey,
  NutritionGoals,
} from "@/lib/types";

type GoalDraft = Record<MacroKey, string>;

const goalPlaceholders: GoalDraft = {
  calories: "700",
  protein: "45",
  carbs: "60",
  fat: "24",
};

const goalLabels: Record<MacroKey, string> = {
  calories: "Calories (kcal)",
  protein: "Protein (g)",
  carbs: "Carbs (g)",
  fat: "Fat (g)",
};

type OptimizationSuggestion = {
  id: string;
  title: string;
  body: string;
  prompt: string;
};

export function GenerateMealClient() {
  const [goals, setGoals] = useState<GoalDraft>({
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });
  const [cuisine, setCuisine] = useState("");
  const [anchorFood, setAnchorFood] = useState("");
  const [dietaryNotes, setDietaryNotes] = useState("");
  const [feedback, setFeedback] = useState("");
  const [meal, setMeal] = useState<GeneratedMeal | null>(null);
  const [revision, setRevision] = useState<GeneratedMealRevision | null>(null);
  const [acceptedMeal, setAcceptedMeal] = useState<GeneratedMeal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [dismissedOptimizationIds, setDismissedOptimizationIds] = useState<string[]>([]);

  const parsedGoals = useMemo<NutritionGoals>(
    () => ({
      calories: Number.parseFloat(goals.calories) || 0,
      protein: Number.parseFloat(goals.protein) || 0,
      carbs: Number.parseFloat(goals.carbs) || 0,
      fat: Number.parseFloat(goals.fat) || 0,
    }),
    [goals],
  );

  const hasGoals = Object.values(parsedGoals).some((value) => value > 0);
  const activeMeal = revision?.updatedMeal ?? meal;
  const optimizationSuggestions = useMemo(
    () =>
      activeMeal
        ? buildOptimizationSuggestions(activeMeal).filter(
            (suggestion) => !dismissedOptimizationIds.includes(suggestion.id),
          )
        : [],
    [activeMeal, dismissedOptimizationIds],
  );

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    setRevision(null);
    setAcceptedMeal(null);
    setDismissedOptimizationIds([]);

    try {
      const response = await fetch("/api/generate-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goals: parsedGoals,
          cuisine,
          anchorFood,
          dietaryNotes,
        }),
      });

      const payload = (await response.json()) as {
        meal?: GeneratedMeal;
        error?: string;
      };

      if (!response.ok || !payload.meal) {
        setMeal(null);
        setError(payload.error ?? "Lazy Mode could not generate a meal.");
        return;
      }

      setMeal(payload.meal);
    } catch {
      setMeal(null);
      setError("Lazy Mode could not generate a meal.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRevise(accepted: boolean, overrideFeedback?: string) {
    const feedbackText = overrideFeedback?.trim() || feedback.trim();

    if (!meal || !feedbackText) {
      return;
    }

    setIsRevising(true);
    setError(null);

    try {
      const response = await fetch("/api/generate-meal/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meal: revision?.updatedMeal ?? meal,
          goals: parsedGoals,
          feedback: {
            accepted,
            feedback: feedbackText,
          } satisfies GeneratedMealFeedback,
        }),
      });

      const payload = (await response.json()) as GeneratedMealRevision & {
        error?: string;
      };

      if (!response.ok || !payload.updatedMeal) {
        setError(payload.error ?? "Lazy Mode could not revise the meal.");
        return;
      }

      setRevision({
        summary: payload.summary,
        updatedMeal: payload.updatedMeal,
      });
      setDismissedOptimizationIds([]);
    } catch {
      setError("Lazy Mode could not revise the meal.");
    } finally {
      setIsRevising(false);
    }
  }

  async function applyOptimizationSuggestion(suggestion: OptimizationSuggestion) {
    setFeedback(suggestion.prompt);
    await handleRevise(true, suggestion.prompt);
  }

  function dismissOptimizationSuggestion(id: string) {
    setDismissedOptimizationIds((current) => [...current, id]);
  }

  function acceptCurrentMeal() {
    if (!activeMeal) {
      return;
    }

    setAcceptedMeal(activeMeal);
    saveAcceptedGeneratedMeal(activeMeal);
  }

  function keepOriginalMeal() {
    setRevision(null);
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-5 pb-12 pt-4 sm:px-8">
        <section className="mb-8 max-w-4xl">
          <p className="mb-3 text-sm font-semibold uppercase text-[var(--primary)]">
            Optional workflow
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-[var(--foreground)] sm:text-5xl">
            Let AI build a meal that sounds good and aims for your targets.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
            Give NutriPilot your calorie and macro targets, then steer the meal with a
            cuisine or anchor ingredient like steak, pasta, or salmon. You can revise
            the meal with feedback before accepting it and exporting a grocery list.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(340px,0.9fr)_minmax(0,1.1fr)]">
          <SectionCard title="Lazy Mode" eyebrow="Generate a meal">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(goals) as MacroKey[]).map((key) => (
                  <label key={key} className="block">
                    <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
                      {goalLabels[key]}
                    </span>
                    <input
                      className="focus-ring h-11 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)]"
                      placeholder={goalPlaceholders[key]}
                      value={goals[key]}
                      onChange={(event) =>
                        setGoals((current) => ({ ...current, [key]: event.target.value }))
                      }
                    />
                  </label>
                ))}
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
                  Cuisine
                </span>
                <input
                  className="focus-ring h-11 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)]"
                  placeholder="Italian, Mexican, Korean..."
                  value={cuisine}
                  onChange={(event) => setCuisine(event.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
                  Anchor Food or Dish
                </span>
                <input
                  className="focus-ring h-11 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)]"
                  placeholder="Steak, pasta, salmon, chicken bowl..."
                  value={anchorFood}
                  onChange={(event) => setAnchorFood(event.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
                  Extra Notes
                </span>
                <textarea
                  className="focus-ring min-h-28 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 py-3 text-sm text-[var(--foreground)]"
                  placeholder="Anything to avoid, time constraints, flavor preferences..."
                  value={dietaryNotes}
                  onChange={(event) => setDietaryNotes(event.target.value)}
                />
              </label>

              <button
                className="rounded-[8px] bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isGenerating || !hasGoals}
                type="button"
                onClick={() => void handleGenerate()}
              >
                {isGenerating ? "Generating..." : "Generate Meal"}
              </button>

              <div className="rounded-[8px] bg-[var(--muted-soft)] px-4 py-4 text-sm leading-6 text-[var(--muted)]">
                AI proposes the meal, then NutriPilot reruns the ingredient list through
                the app&apos;s USDA-backed nutrition pipeline to judge how close it actually
                is.
              </div>

              {error ? (
                <div className="rounded-[8px] border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
                  {error}
                </div>
              ) : null}
            </div>
          </SectionCard>

          <div className="space-y-6">
            <SectionCard
              title={activeMeal ? activeMeal.title : "Generated Meal"}
              eyebrow={revision ? "Revision preview" : "AI meal"}
              action={
                activeMeal ? (
                  <button
                    className="rounded-[8px] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
                    type="button"
                    onClick={acceptCurrentMeal}
                  >
                    Accept Meal
                  </button>
                ) : undefined
              }
            >
              {activeMeal ? (
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Metric label="Calories" value={String(activeMeal.totals.calories)} />
                    <Metric label="Protein" value={`${activeMeal.totals.protein}g`} />
                    <Metric label="Carbs" value={`${activeMeal.totals.carbs}g`} />
                    <Metric label="Fat" value={`${activeMeal.totals.fat}g`} />
                  </div>

                  <div className="rounded-[8px] bg-[var(--muted-soft)] px-4 py-4 text-sm leading-6 text-[var(--muted)]">
                    <p className="font-semibold text-[var(--foreground)]">{activeMeal.cuisine}</p>
                    <p className="mt-2">{activeMeal.summary}</p>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <div>
                      <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                        Ingredients
                      </h3>
                      <div className="space-y-2">
                        {activeMeal.ingredients.map((ingredient) => (
                          <div
                            key={ingredient.id}
                            className="rounded-[8px] border border-[var(--border)] bg-white/80 px-3 py-3"
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
                              {ingredient.supported
                                ? formatIngredientCalories(ingredient)
                                : "Nutrition estimate still needs review"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-5">
                      <div>
                        <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                          Why it works
                        </h3>
                        <div className="space-y-2">
                          {activeMeal.whyItWorks.map((point) => (
                            <div
                              key={point}
                              className="rounded-[8px] border border-[var(--border)] bg-white/80 px-3 py-3 text-sm leading-6 text-[var(--muted)]"
                            >
                              {point}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                          Instructions
                        </h3>
                        <div className="space-y-2">
                          {activeMeal.instructions.map((step, index) => (
                            <div
                              key={`${index + 1}-${step}`}
                              className="rounded-[8px] border border-[var(--border)] bg-white/80 px-3 py-3 text-sm leading-6 text-[var(--muted)]"
                            >
                              <span className="mr-2 font-semibold text-[var(--foreground)]">
                                {index + 1}.
                              </span>
                              {step}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {revision ? (
                    <div className="rounded-[8px] bg-[var(--primary-soft)] px-4 py-4 text-sm text-[var(--primary-strong)]">
                      {revision.summary}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-[8px] border border-dashed border-[var(--border)] bg-[var(--muted-soft)] px-4 py-8 text-center">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    Generate a meal to preview it here.
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
                    Lazy Mode works best when you provide goals and a little steering like
                    cuisine or a protein you want included.
                  </p>
                </div>
              )}
            </SectionCard>

            {activeMeal && optimizationSuggestions.length > 0 ? (
              <SectionCard title="Optimization Pass" eyebrow="Optional">
                <div className="space-y-3">
                  {optimizationSuggestions.map((suggestion) => (
                    <article
                      key={suggestion.id}
                      className="rounded-[8px] border border-[var(--border)] bg-white/80 p-4"
                    >
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {suggestion.title}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                        {suggestion.body}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          className="rounded-[8px] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isRevising}
                          type="button"
                          onClick={() => void applyOptimizationSuggestion(suggestion)}
                        >
                          {isRevising ? "Applying..." : "Apply Suggestion"}
                        </button>
                        <button
                          className="rounded-[8px] border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--muted-soft)]"
                          type="button"
                          onClick={() => dismissOptimizationSuggestion(suggestion.id)}
                        >
                          Dismiss
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                  NutriPilot keeps these tweaks optional. Apply a suggestion to revise
                  the meal, or dismiss it and keep the current version.
                </p>
              </SectionCard>
            ) : null}

            {meal ? (
              <SectionCard title="Refine the Meal" eyebrow="Feedback loop">
                <div className="space-y-4">
                  <textarea
                    className="focus-ring min-h-28 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 py-3 text-sm text-[var(--foreground)]"
                    placeholder="Ask for more vegetables, remove an ingredient you dislike, change the cuisine feel, or nudge the macros..."
                    value={feedback}
                    onChange={(event) => setFeedback(event.target.value)}
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-[8px] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isRevising || feedback.trim().length < 4}
                      type="button"
                      onClick={() => void handleRevise(true)}
                    >
                      {isRevising ? "Revising..." : "Revise from feedback"}
                    </button>
                    {revision ? (
                      <button
                        className="rounded-[8px] border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--muted-soft)]"
                        type="button"
                        onClick={keepOriginalMeal}
                      >
                        Keep Original
                      </button>
                    ) : null}
                  </div>

                  <p className="text-sm leading-6 text-[var(--muted)]">
                    If the revision looks better, accept it. If not, keep the original
                    version and move on.
                  </p>
                </div>
              </SectionCard>
            ) : null}

            {acceptedMeal ? (
              <>
                <GroceryListPanel meal={acceptedMeal} heading="Grocery List" />
                <SectionCard title="Next Step" eyebrow="Optional">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      className="rounded-[8px] border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--muted-soft)]"
                      href="/shopping-list"
                    >
                      Open Shopping List
                    </Link>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                    On iPhone, the Export button uses the browser share sheet when
                    available. If Notes appears there, you can send the grocery list
                    straight into Apple Notes.
                  </p>
                </SectionCard>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-white/80 px-4 py-4">
      <p className="text-xs font-semibold uppercase text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function buildOptimizationSuggestions(meal: GeneratedMeal): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];
  const byKey = Object.fromEntries(meal.goalGaps.map((gap) => [gap.key, gap])) as Record<
    MacroKey,
    GoalGap
  >;
  const ingredientNames = meal.ingredients.map((ingredient) => ingredient.name.toLowerCase());
  const hasRice = ingredientNames.some((name) => name.includes("rice"));
  const hasChicken = ingredientNames.some((name) => name.includes("chicken"));
  const hasOil = ingredientNames.some((name) => name.includes("oil"));
  const hasPorkBelly = ingredientNames.some((name) => name.includes("pork belly"));

  if (byKey.calories?.status === "over" || byKey.fat?.status === "over") {
    suggestions.push({
      id: "trim-richness",
      title: "Trim the richest parts a little",
      body: "Keep the same dish, but slightly reduce the fattiest ingredients and let vegetables or lettuce carry more of the plate.",
      prompt:
        "Revise this meal so it is a bit lighter while keeping the same overall dish and flavor profile. Trim the richest fats first, keep it tasty, and stay close enough to the original goals.",
    });
  }

  if (byKey.protein?.status === "under" && !hasChicken) {
    suggestions.push({
      id: "boost-protein",
      title: "Add a modest lean protein boost",
      body: "A lean supporting protein can pull the meal closer to target without changing the whole identity of the dish.",
      prompt:
        "Revise this meal to raise protein modestly while keeping it appetizing and reasonably close to the current calories. Favor a practical lean protein boost.",
    });
  }

  if (byKey.carbs?.status === "under" && !hasRice) {
    suggestions.push({
      id: "steady-carbs",
      title: "Add a steadier carb base",
      body: "A small rice or noodle addition can make the meal feel more complete while bringing carbs a bit closer to the target.",
      prompt:
        "Revise this meal by adding a coherent carb element like rice or noodles so it lands a bit closer to the carb target without wrecking the cuisine.",
    });
  }

  if (hasPorkBelly && byKey.fat?.status === "over") {
    suggestions.push({
      id: "balance-pork-belly",
      title: "Balance the pork belly",
      body: "Keep pork belly as the anchor, but let a slightly smaller portion and more greens or lean support carry the meal.",
      prompt:
        "Keep pork belly as the anchor food, but revise the meal so it is a little more balanced and not quite as fat-heavy. Preserve the cuisine and make the result still sound genuinely good.",
    });
  }

  if (hasOil && byKey.calories?.status === "over") {
    suggestions.push({
      id: "pull-back-oil",
      title: "Use a lighter hand on oils",
      body: "A smaller oil or sauce finish often lowers calories without making the meal feel stripped down.",
      prompt:
        "Revise this meal with a lighter hand on added oils or rich sauces while preserving flavor, texture, and the same overall style.",
    });
  }

  return suggestions.slice(0, 3);
}
