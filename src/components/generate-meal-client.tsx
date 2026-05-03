"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { GroceryListPanel } from "@/components/grocery-list-panel";
import { PageHeader } from "@/components/nutrition-ui";
import { SectionCard } from "@/components/section-card";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { defaultNutritionGoals } from "@/lib/default-goals";
import { saveAcceptedGeneratedMeal } from "@/lib/generated-meal-storage";
import { buildGeneratedMealPayload } from "@/lib/meal-persistence";
import {
  formatIngredientCalories,
  formatIngredientLine,
} from "@/lib/ingredient-text";
import type {
  GeneratedMeal,
  GeneratedMealFeedback,
  GoalGap,
  MacroKey,
  NutritionGoals,
} from "@/lib/types";

type GoalDraft = Record<MacroKey, string>;
type MealPlannerMode = "lazy" | "pantry";

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
  kind: "Add" | "Reduce" | "Swap";
  title: string;
  body: string;
  prompt: string;
};

type OptimizationStatus = "active" | "accepted" | "dismissed";

type OptimizationSuggestionState = OptimizationSuggestion & {
  status: OptimizationStatus;
};

export function GenerateMealClient() {
  const { user } = useAuth();
  const mealSummaryRef = useRef<HTMLDivElement | null>(null);
  const [goals, setGoals] = useState<GoalDraft>({
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });
  const [cuisine, setCuisine] = useState("");
  const [anchorFood, setAnchorFood] = useState("");
  const [dietaryNotes, setDietaryNotes] = useState("");
  const [plannerMode, setPlannerMode] = useState<MealPlannerMode>("lazy");
  const [pantryInput, setPantryInput] = useState("");
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("");
  const [meal, setMeal] = useState<GeneratedMeal | null>(null);
  const [acceptedMeal, setAcceptedMeal] = useState<GeneratedMeal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [optimizationSuggestions, setOptimizationSuggestions] = useState<
    OptimizationSuggestionState[]
  >([]);
  const [acceptMessage, setAcceptMessage] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [isSavingAcceptedMeal, setIsSavingAcceptedMeal] = useState(false);
  const [savedGoalPlaceholders, setSavedGoalPlaceholders] = useState<GoalDraft>(goalPlaceholders);
  const loadedGoalsForUser = useRef<string | null>(null);
  const greeting = useMemo(() => getGreeting(), []);

  const effectiveGoalDefaults = useMemo<NutritionGoals>(
    () => ({
      calories: Number.parseFloat(savedGoalPlaceholders.calories) || defaultNutritionGoals.calories,
      protein: Number.parseFloat(savedGoalPlaceholders.protein) || defaultNutritionGoals.protein,
      carbs: Number.parseFloat(savedGoalPlaceholders.carbs) || defaultNutritionGoals.carbs,
      fat: Number.parseFloat(savedGoalPlaceholders.fat) || defaultNutritionGoals.fat,
    }),
    [savedGoalPlaceholders],
  );

  const parsedGoals = useMemo<NutritionGoals>(
    () => ({
      calories: parseGoalValue(goals.calories, effectiveGoalDefaults.calories),
      protein: parseGoalValue(goals.protein, effectiveGoalDefaults.protein),
      carbs: parseGoalValue(goals.carbs, effectiveGoalDefaults.carbs),
      fat: parseGoalValue(goals.fat, effectiveGoalDefaults.fat),
    }),
    [effectiveGoalDefaults, goals],
  );

  const hasGoals =
    Object.values(goals).some((value) => value.trim().length > 0) ||
    Object.values(effectiveGoalDefaults).some((value) => value > 0);
  const activeGoalPlaceholders = user ? savedGoalPlaceholders : goalPlaceholders;
  const shouldMoveSupportCardsLeft = Boolean(
    meal && meal.ingredients.length + meal.instructions.length + meal.whyItWorks.length >= 13,
  );
  const isCurrentMealAccepted = Boolean(meal && acceptedMeal === meal);

  useEffect(() => {
    if (!user) {
      loadedGoalsForUser.current = null;
      return;
    }

    if (loadedGoalsForUser.current === user.id) {
      return;
    }

    let cancelled = false;
    loadedGoalsForUser.current = user.id;

    const loadGoals = async () => {
      try {
        const response = await fetch("/api/goals");
        const payload = (await response.json()) as { goals?: NutritionGoals };

        if (!response.ok || !payload.goals || cancelled) {
          return;
        }

        setSavedGoalPlaceholders({
          calories: payload.goals.calories.toString(),
          protein: payload.goals.protein.toString(),
          carbs: payload.goals.carbs.toString(),
          fat: payload.goals.fat.toString(),
        });
      } catch {
        // Leave the current goal draft alone if loading fails.
      }
    };

    void loadGoals();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    setAcceptedMeal(null);
    setOptimizationSuggestions([]);
    setFeedback("");

    try {
      const response = await fetch("/api/generate-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goals: parsedGoals,
          cuisine,
          anchorFood,
          dietaryNotes,
          mode: plannerMode,
          pantryIngredients: pantryItems,
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
      setOptimizationSuggestions(
        buildOptimizationSuggestions(payload.meal).map((suggestion) => ({
          ...suggestion,
          status: "active",
        })),
      );
    } catch {
      setMeal(null);
      setError("Lazy Mode could not generate a meal.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRevise(
    accepted: boolean,
    overrideFeedback?: string,
  ): Promise<GeneratedMeal | null> {
    const feedbackText = overrideFeedback?.trim() || feedback.trim();

    if (!meal || !feedbackText) {
      return null;
    }

    scrollToMealSummary(mealSummaryRef);
    setIsRevising(true);
    setError(null);

    try {
      const response = await fetch("/api/generate-meal/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meal,
          goals: parsedGoals,
          feedback: {
            accepted,
            feedback: feedbackText,
          } satisfies GeneratedMealFeedback,
        }),
      });

      const payload = (await response.json()) as {
        summary?: string;
        updatedMeal?: GeneratedMeal;
        error?: string;
      };

      if (!response.ok || !payload.updatedMeal) {
        setError(payload.error ?? "Lazy Mode could not revise the meal.");
        return null;
      }

      setMeal(payload.updatedMeal);
      setAcceptedMeal(null);

      if (!overrideFeedback) {
        setFeedback("");
        setOptimizationSuggestions(
          buildOptimizationSuggestions(payload.updatedMeal).map((suggestion) => ({
            ...suggestion,
            status: "active",
          })),
        );
      }

      return payload.updatedMeal;
    } catch {
      setError("Lazy Mode could not revise the meal.");
      return null;
    } finally {
      setIsRevising(false);
    }
  }

  async function applyOptimizationSuggestion(suggestion: OptimizationSuggestion) {
    const updatedMeal = await handleRevise(true, suggestion.prompt);

    if (!updatedMeal) {
      return;
    }

    setOptimizationSuggestions((current) => {
      const accepted = current.map((item) =>
        item.id === suggestion.id ? { ...item, status: "accepted" as const } : item,
      );

      return mergeOptimizationSuggestions(accepted, buildOptimizationSuggestions(updatedMeal));
    });
  }

  function dismissOptimizationSuggestion(id: string) {
    setOptimizationSuggestions((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status: "dismissed" as const } : item,
      ),
    );
  }

  async function acceptCurrentMeal() {
    if (!meal) {
      return;
    }

    setAcceptError(null);
    setAcceptMessage(null);
    setAcceptedMeal(meal);
    saveAcceptedGeneratedMeal(meal);

    if (!user) {
      setAcceptMessage(
        "Meal accepted on this device. Log in when you want it saved to your account too.",
      );
      return;
    }

    setIsSavingAcceptedMeal(true);

    try {
      const response = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meal: buildGeneratedMealPayload(meal),
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setAcceptError(payload.error ?? "We couldn’t save that accepted meal yet.");
        return;
      }

      setAcceptMessage("Meal accepted and saved to your dashboard.");
    } catch {
      setAcceptError("We couldn’t save that accepted meal yet.");
    } finally {
      setIsSavingAcceptedMeal(false);
    }
  }

  function handleGenerateSubmit() {
    if (isGenerating || !hasGoals) {
      return;
    }

    void handleGenerate();
  }

  function addPantryItemFromInput() {
    const trimmed = pantryInput.trim();

    if (!trimmed) {
      return false;
    }

    setPantryItems((current) => {
      if (current.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
        return current;
      }

      return [...current, trimmed];
    });
    setPantryInput("");
    return true;
  }

  function removePantryItem(itemToRemove: string) {
    setPantryItems((current) => current.filter((item) => item !== itemToRemove));
  }

  function handleReviseSubmit() {
    if (isRevising || feedback.trim().length < 4) {
      return;
    }

    void handleRevise(true);
  }

  function handleEnterSubmit(
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    submit: () => void,
  ) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    submit();
  }

  function handlePantryKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (!addPantryItemFromInput()) {
      handleGenerateSubmit();
    }
  }

  const supportCards = (
    <>
      {meal &&
      optimizationSuggestions.some((suggestion) => suggestion.status !== "dismissed") ? (
        <SectionCard title="Suggested Optimizations" eyebrow="A few easy ways to tune it">
          <div className="space-y-3">
            {optimizationSuggestions
              .filter((suggestion) => suggestion.status !== "dismissed")
              .map((suggestion) => {
                const isAccepted = suggestion.status === "accepted";

                return (
                  <article
                    key={suggestion.id}
                    className={`rounded-[8px] border border-[var(--border)] bg-white/80 p-4 transition-all duration-300 ${
                      isAccepted ? "opacity-60" : "opacity-100"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {suggestion.title}
                      </p>
                      <div className="flex shrink-0 items-center gap-2">
                        {isAccepted ? (
                          <span className="rounded-full border border-[var(--primary-soft)] bg-[var(--muted-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--primary-strong)]">
                            Accepted
                          </span>
                        ) : null}
                        <span className="rounded-full bg-[var(--primary-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--primary-strong)]">
                          {suggestion.kind}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      {suggestion.body}
                    </p>
                    {isAccepted ? (
                      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                        Applied to the current meal.
                      </p>
                    ) : (
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
                    )}
                  </article>
                );
              })}
          </div>
        </SectionCard>
      ) : meal ? (
        <SectionCard title="Suggested Optimizations" eyebrow="A few easy ways to tune it">
          <p className="text-sm leading-6 text-[var(--muted)]">
            This meal already looks pretty balanced for the goals you set.
          </p>
        </SectionCard>
      ) : null}

      {meal ? (
        <SectionCard title="Make It Your Own" eyebrow="Add a note">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleReviseSubmit();
            }}
          >
            <textarea
              className="focus-ring soft-input min-h-28 w-full rounded-[16px] border px-3 py-3 text-sm text-[var(--foreground)]"
              placeholder="Want a little more heat, fewer onions, another side, or a different feel? Add a note here."
              value={feedback}
              onKeyDown={(event) => handleEnterSubmit(event, handleReviseSubmit)}
              onChange={(event) => setFeedback(event.target.value)}
            />

            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-[8px] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isRevising || feedback.trim().length < 4}
                type="submit"
              >
                {isRevising ? "Revising..." : "Revise from feedback"}
              </button>
            </div>
          </form>
        </SectionCard>
      ) : null}
    </>
  );

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-5 pb-12 pt-4 sm:px-8">
        <PageHeader
          eyebrow={greeting}
          title="Need a starting point? We’ll sketch a meal that feels good to eat."
        >
          <p>
            Set your targets, pick a cuisine or anchor ingredient, and Calora will
            put together a meal idea, check the numbers, and smooth out obvious portion
            issues before it lands here.
          </p>
        </PageHeader>

        <div className="grid gap-6 lg:grid-cols-[minmax(340px,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-6">
          <SectionCard
            title="Build a Meal for Me"
            eyebrow={plannerMode === "lazy" ? "Lazy Mode" : "Pantry Mode"}
            action={
              <div className="inline-flex rounded-full border border-[var(--border)] bg-white p-1 shadow-sm">
                {(["lazy", "pantry"] as MealPlannerMode[]).map((mode) => {
                  const isActive = plannerMode === mode;
                  return (
                    <button
                      key={mode}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-300 ${
                        isActive
                          ? "bg-[var(--primary)] text-white shadow-sm"
                          : "text-[var(--muted)] hover:bg-[var(--muted-soft)]"
                      }`}
                      type="button"
                      onClick={() => setPlannerMode(mode)}
                    >
                      {mode === "lazy" ? "Lazy Mode" : "Pantry Mode"}
                    </button>
                  );
                })}
              </div>
            }
          >
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                handleGenerateSubmit();
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(goals) as MacroKey[]).map((key) => (
                  <label key={key} className="block">
                    <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
                      {goalLabels[key]}
                    </span>
                    <input
                      className="focus-ring soft-input h-11 w-full rounded-[14px] border px-3 text-sm text-[var(--foreground)]"
                      placeholder={activeGoalPlaceholders[key]}
                      value={goals[key]}
                      onKeyDown={(event) => handleEnterSubmit(event, handleGenerateSubmit)}
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
                  className="focus-ring soft-input h-11 w-full rounded-[14px] border px-3 text-sm text-[var(--foreground)]"
                  placeholder="Italian, Mexican, Korean..."
                  value={cuisine}
                  onKeyDown={(event) => handleEnterSubmit(event, handleGenerateSubmit)}
                  onChange={(event) => setCuisine(event.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
                  Anchor Food or Dish
                </span>
                <input
                  className="focus-ring soft-input h-11 w-full rounded-[14px] border px-3 text-sm text-[var(--foreground)]"
                  placeholder="Steak, pasta, salmon, chicken bowl..."
                  value={anchorFood}
                  onKeyDown={(event) => handleEnterSubmit(event, handleGenerateSubmit)}
                  onChange={(event) => setAnchorFood(event.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
                  Extra Notes
                </span>
                <textarea
                  className="focus-ring soft-input min-h-28 w-full rounded-[14px] border px-3 py-3 text-sm text-[var(--foreground)]"
                  placeholder="Anything to avoid, time constraints, flavor preferences..."
                  value={dietaryNotes}
                  onKeyDown={(event) => handleEnterSubmit(event, handleGenerateSubmit)}
                  onChange={(event) => setDietaryNotes(event.target.value)}
                />
              </label>

              {plannerMode === "pantry" ? (
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
                    Pantry Ingredients
                  </span>
                  <div className="focus-ring soft-input flex min-h-11 flex-wrap items-center gap-2 rounded-[16px] border px-3 py-2 transition duration-200">
                    {pantryItems.map((item) => (
                      <span
                        key={item}
                          className="inline-flex items-center gap-2 rounded-full bg-[var(--primary-soft)] px-3 py-1.5 text-sm font-medium text-[var(--primary-strong)] shadow-sm transition-all duration-200"
                      >
                        {item}
                        <button
                          className="text-[var(--primary-strong)]/80 transition hover:text-[var(--primary-strong)]"
                          type="button"
                          onClick={() => removePantryItem(item)}
                        >
                          x
                        </button>
                      </span>
                    ))}
                    <input
                      className="min-w-[160px] flex-1 border-0 bg-transparent px-0 py-1 text-sm text-[var(--foreground)] outline-none"
                      placeholder={
                        pantryItems.length
                          ? "Add another pantry item..."
                          : "Type an ingredient and press Enter..."
                      }
                      value={pantryInput}
                      onChange={(event) => setPantryInput(event.target.value)}
                      onKeyDown={handlePantryKeyDown}
                    />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                    Add what you already have, and Calora will try to build around
                    those ingredients before filling in the rest.
                  </p>
                </label>
              ) : null}

              <button
                className="rounded-[14px] bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(34,116,95,0.2)] transition hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isGenerating || !hasGoals}
                type="submit"
              >
                {isGenerating ? "Generating..." : "Generate Meal"}
              </button>

              <div className="rounded-[16px] bg-[var(--muted-soft)]/86 px-4 py-4 text-sm leading-6 text-[var(--muted)] shadow-inner">
                {plannerMode === "lazy"
                  ? "Calora shapes a meal around your goals and preferences, then checks the ingredient list against USDA-backed nutrition data before showing it here."
                  : "Calora builds around your goals and the pantry items you already have, then checks the ingredient list against USDA-backed nutrition data before showing it here."}
              </div>

              {error ? (
                <div className="rounded-[14px] border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
                  {error}
                </div>
              ) : null}
            </form>
          </SectionCard>
          {shouldMoveSupportCardsLeft ? supportCards : null}
          </div>

          <div className="space-y-6">
            <div ref={mealSummaryRef}>
              <SectionCard
                title={meal ? meal.title : "Meal Idea"}
                eyebrow="Meal Idea"
                action={
                  meal ? (
                    <button
                      className={`inline-flex items-center gap-2 rounded-[14px] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(34,116,95,0.2)] transition hover:bg-[var(--primary-strong)] disabled:cursor-default ${
                        isCurrentMealAccepted ? "accepted-meal-button" : ""
                      }`}
                      disabled={isSavingAcceptedMeal || isCurrentMealAccepted}
                      type="button"
                      onClick={() => void acceptCurrentMeal()}
                    >
                      {isCurrentMealAccepted ? (
                        <>
                          <span className="accepted-check inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/18">
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          </span>
                          Meal Accepted
                        </>
                      ) : isSavingAcceptedMeal ? (
                        "Saving..."
                      ) : (
                        "Accept Meal"
                      )}
                    </button>
                  ) : undefined
                }
              >
                {meal ? (
                  <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <AnimatedMetric
                      label="Calories"
                      value={meal.totals.calories}
                      formatValue={(value) => formatAnimatedNumber(value, 0)}
                    />
                    <AnimatedMetric
                      label="Protein"
                      value={meal.totals.protein}
                      formatValue={(value) => `${formatAnimatedNumber(value, 1)}g`}
                    />
                    <AnimatedMetric
                      label="Carbs"
                      value={meal.totals.carbs}
                      formatValue={(value) => `${formatAnimatedNumber(value, 1)}g`}
                    />
                    <AnimatedMetric
                      label="Fat"
                      value={meal.totals.fat}
                      formatValue={(value) => `${formatAnimatedNumber(value, 1)}g`}
                    />
                  </div>

                  <div className="rounded-[16px] bg-[var(--muted-soft)]/86 px-4 py-4 text-sm leading-6 text-[var(--muted)] shadow-inner">
                    <p className="font-semibold text-[var(--foreground)]">{meal.cuisine}</p>
                    <p className="mt-2">{meal.summary}</p>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <div>
                      <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                        Ingredients
                      </h3>
                      <div className="space-y-2">
                        {meal.ingredients.map((ingredient) => (
                          <div
                            key={ingredient.id}
                            className="ingredient-row rounded-[16px] border border-[var(--border)] bg-[var(--card)]/82 px-3 py-3 shadow-sm"
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
                          Why this feels satisfying
                        </h3>
                        <div className="space-y-2">
                          {meal.whyItWorks.map((point) => (
                            <div
                              key={point}
                              className="rounded-[16px] border border-[var(--border)] bg-[var(--card)]/82 px-3 py-3 text-sm leading-6 text-[var(--muted)] shadow-sm"
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
                          {meal.instructions.map((step, index) => (
                            <div
                              key={`${index + 1}-${step}`}
                              className="rounded-[16px] border border-[var(--border)] bg-[var(--card)]/82 px-3 py-3 text-sm leading-6 text-[var(--muted)] shadow-sm"
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
                  </div>
                ) : (
                  <div className="rounded-[18px] border border-dashed border-[var(--border)] bg-[var(--muted-soft)]/82 px-4 py-8 text-center shadow-inner">
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      Start with a few goals and we&apos;ll sketch out a meal here.
                    </p>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
                      A little direction goes a long way. Choose a cuisine, pick a food to
                      build around, and we&apos;ll handle the first draft.
                    </p>
                  </div>
                )}
              </SectionCard>
            </div>

            {!shouldMoveSupportCardsLeft ? supportCards : null}

            {acceptedMeal ? (
              <>
                <GroceryListPanel meal={acceptedMeal} heading="Grocery List" />
                <SectionCard title="Next Step" eyebrow="Optional">
                  {acceptMessage ? (
                    <p className="mb-3 text-sm font-medium text-[var(--primary-strong)]">{acceptMessage}</p>
                  ) : null}
                  {acceptError ? user ? (
                    <p className="mb-3 text-sm font-medium text-[var(--danger)]">{acceptError}</p>
                  ) : (
                    <div className="mb-4">
                      <SignInPrompt message={acceptError} />
                    </div>
                  ) : null}
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

function mergeOptimizationSuggestions(
  current: OptimizationSuggestionState[],
  next: OptimizationSuggestion[],
) {
  const nextById = new Map(next.map((suggestion) => [suggestion.id, suggestion]));
  const merged = current.map((suggestion) => {
    const replacement = nextById.get(suggestion.id);
    nextById.delete(suggestion.id);

    if (!replacement) {
      return suggestion;
    }

    return {
      ...replacement,
      status: suggestion.status,
    };
  });

  for (const suggestion of nextById.values()) {
    merged.push({
      ...suggestion,
      status: "active",
    });
  }

  return merged;
}

function scrollToMealSummary(ref: RefObject<HTMLDivElement | null>) {
  requestAnimationFrame(() => {
    const target = ref.current;

    if (!target) {
      return;
    }

    const startY = window.scrollY;
    const targetY = target.getBoundingClientRect().top + window.scrollY - 20;
    const distance = targetY - startY;
    const durationMs = 3000;
    let startTime: number | null = null;

    const step = (timestamp: number) => {
      if (startTime === null) {
        startTime = timestamp;
      }

      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      window.scrollTo({
        top: startY + distance * easedProgress,
        behavior: "auto",
      });

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  });
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-surface rounded-[18px] px-4 py-4 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-sm">
      <p className="text-xs font-semibold uppercase text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function AnimatedMetric({
  label,
  value,
  formatValue,
}: {
  label: string;
  value: number;
  formatValue: (value: number) => string;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValueRef = useRef(value);
  const initialRenderRef = useRef(true);

  useEffect(() => {
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      previousValueRef.current = value;
      setDisplayValue(value);
      return;
    }

    const startValue = previousValueRef.current;
    const endValue = value;
    const durationMs = 1100;
    let animationFrame = 0;
    let startTime: number | null = null;

    const step = (timestamp: number) => {
      if (startTime === null) {
        startTime = timestamp;
      }

      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextValue = startValue + (endValue - startValue) * easedProgress;

      setDisplayValue(nextValue);

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(step);
      } else {
        previousValueRef.current = endValue;
      }
    };

    animationFrame = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      previousValueRef.current = endValue;
    };
  }, [value]);

  return <Metric label={label} value={formatValue(displayValue)} />;
}

function formatAnimatedNumber(value: number, decimals: number) {
  const rounded = Number(value.toFixed(decimals));

  if (decimals === 0) {
    return String(Math.round(rounded));
  }

  return rounded.toFixed(decimals).replace(/\.0$/, "");
}

function buildOptimizationSuggestions(meal: GeneratedMeal): OptimizationSuggestion[] {
  const suggestions = new Map<string, OptimizationSuggestion>();
  const byKey = Object.fromEntries(meal.goalGaps.map((gap) => [gap.key, gap])) as Record<
    MacroKey,
    GoalGap
  >;
  const ingredientNames = meal.ingredients.map((ingredient) => ingredient.name.toLowerCase());
  const hasRice = ingredientNames.some((name) => name.includes("rice"));
  const hasChicken = ingredientNames.some((name) => name.includes("chicken"));
  const hasOil = ingredientNames.some((name) => name.includes("oil"));
  const hasPorkBelly = ingredientNames.some((name) => name.includes("pork belly"));
  const hasNoodles = ingredientNames.some((name) => name.includes("noodle"));

  if (byKey.calories?.status === "over" || byKey.fat?.status === "over") {
    suggestions.set("trim-richness", {
      id: "trim-richness",
      kind: "Reduce",
      title: "Trim the richest parts a little",
      body: "A slightly smaller portion of the richest ingredients would bring this closer to your target without changing the spirit of the dish.",
      prompt:
        "Revise this meal so it is a bit lighter while keeping the same overall dish and flavor profile. Trim the richest fats first, keep it tasty, and stay close enough to the original goals.",
    });
  }

  if (byKey.protein?.status === "under" && !hasChicken) {
    suggestions.set("boost-protein", {
      id: "boost-protein",
      kind: "Add",
      title: "Add a modest lean protein boost",
      body: "A small lean add-in could raise protein without changing the whole personality of the meal.",
      prompt:
        "Revise this meal to raise protein modestly while keeping it appetizing and reasonably close to the current calories. Favor a practical lean protein boost.",
    });
  }

  if (byKey.carbs?.status === "under" && !hasRice && !hasNoodles) {
    suggestions.set("steady-carbs", {
      id: "steady-carbs",
      kind: "Add",
      title: "Add a steadier carb base",
      body: "A little rice or noodles would make this feel more complete and help close the calorie gap at the same time.",
      prompt:
        "Revise this meal by adding a coherent carb element like rice or noodles so it lands a bit closer to the carb target without wrecking the cuisine.",
    });
  }

  if (hasPorkBelly && byKey.fat?.status === "over") {
    suggestions.set("balance-pork-belly", {
      id: "balance-pork-belly",
      kind: "Swap",
      title: "Balance the pork belly",
      body: "Keep pork belly as the anchor, but lean on a slightly smaller portion and more supporting volume so the meal stays satisfying.",
      prompt:
        "Keep pork belly as the anchor food, but revise the meal so it is a little more balanced and not quite as fat-heavy. Preserve the cuisine and make the result still sound genuinely good.",
    });
  }

  if (hasOil && byKey.calories?.status === "over") {
    suggestions.set("pull-back-oil", {
      id: "pull-back-oil",
      kind: "Reduce",
      title: "Use a lighter hand on oils",
      body: "A lighter hand with oil or sauce can pull calories down without making the meal feel stripped back.",
      prompt:
        "Revise this meal with a lighter hand on added oils or rich sauces while preserving flavor, texture, and the same overall style.",
    });
  }

  return Array.from(suggestions.values()).slice(0, 3);
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function parseGoalValue(value: string, fallback: number) {
  const trimmed = value.trim();

  if (!trimmed) {
    return fallback;
  }

  return Number.parseFloat(trimmed) || 0;
}
