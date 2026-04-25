"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { SignInPrompt } from "@/components/sign-in-prompt";
import {
  calculateMealTotals,
  compareGoals,
  generateSuggestions,
} from "@/lib/nutrition";
import { clearImportedRecipe, readImportedRecipe } from "@/lib/imported-recipe-storage";
import { buildManualMealPayload, buildManualMealTitle } from "@/lib/meal-persistence";
import type {
  FoodSearchResult,
  GoalGap,
  IngredientResolution,
  ImportedRecipe,
  MacroKey,
  MacroTotals,
  NutritionGoals,
  ResolvedFood,
  Suggestion,
  Unit,
} from "@/lib/types";
import { EmptyState } from "@/components/empty-state";
import { SectionCard } from "@/components/section-card";

const units: Unit[] = ["g", "tbsp", "tsp", "cup", "piece"];
type IngredientDraft = {
  id: string;
  name: string;
  amount: string;
  unit: Unit;
  food: ResolvedFood | null;
  resolution: IngredientResolution | null;
};

type GoalDraft = Record<MacroKey, string>;

const macroMeta: Record<
  MacroKey,
  { label: string; unit: string; helper: string; color: string }
> = {
  calories: {
    label: "Calories",
    unit: "kcal",
    helper: "Meal energy",
    color: "var(--primary)",
  },
  protein: {
    label: "Protein",
    unit: "g",
    helper: "Build and repair",
    color: "#336d9d",
  },
  carbs: {
    label: "Carbs",
    unit: "g",
    helper: "Fuel and fullness",
    color: "#9b6a2f",
  },
  fat: {
    label: "Fat",
    unit: "g",
    helper: "Density and flavor",
    color: "#8f5f74",
  },
};

export function MealBuilder() {
  const { user } = useAuth();
  const [importedRecipe] = useState<ImportedRecipe | null>(() => readImportedRecipe());
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(() =>
    importedRecipe?.ingredients.length
      ? importedRecipe.ingredients.map((ingredient) => ({
          id: ingredient.id,
          name: ingredient.name,
          amount: ingredient.amount?.toString() ?? "",
          unit: ingredient.unit,
          food: ingredient.food,
          resolution: ingredient.resolution,
        }))
      : [createIngredientDraft()],
  );
  const [goals, setGoals] = useState<GoalDraft>({
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });
  const [searchResults, setSearchResults] = useState<Record<string, FoodSearchResult[]>>(
    {},
  );
  const [searchLoadingId, setSearchLoadingId] = useState<string | null>(null);
  const [resolvingFoodId, setResolvingFoodId] = useState<string | null>(null);
  const [openSearchId, setOpenSearchId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSignInPrompt, setShowSignInPrompt] = useState<string | null>(null);
  const [isSavingMeal, setIsSavingMeal] = useState(false);

  const searchTimers = useRef<Record<string, number | undefined>>({});
  const ingredientsRef = useRef(ingredients);
  const loadedGoalsForUser = useRef<string | null>(null);

  useEffect(() => {
    ingredientsRef.current = ingredients;
  }, [ingredients]);

  useEffect(() => {
    if (importedRecipe) {
      clearImportedRecipe();
    }
  }, [importedRecipe]);

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

        setGoals({
          calories: payload.goals.calories.toString(),
          protein: payload.goals.protein.toString(),
          carbs: payload.goals.carbs.toString(),
          fat: payload.goals.fat.toString(),
        });
      } catch {
        // Keep the current local draft if loading saved goals fails.
      }
    };

    void loadGoals();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const parsedIngredients = useMemo(
    () =>
      ingredients.map((ingredient) => ({
        id: ingredient.id,
        name: ingredient.name,
        amount: Number.parseFloat(ingredient.amount) || 0,
        unit: ingredient.unit,
        food: ingredient.food,
        resolution: ingredient.resolution,
      })),
    [ingredients],
  );

  const parsedGoals = useMemo<NutritionGoals>(
    () => ({
      calories: Number.parseFloat(goals.calories) || 0,
      protein: Number.parseFloat(goals.protein) || 0,
      carbs: Number.parseFloat(goals.carbs) || 0,
      fat: Number.parseFloat(goals.fat) || 0,
    }),
    [goals],
  );

  const hasAnyGoal = Object.values(goals).some((value) => value.trim().length > 0);

  const { calculatedIngredients, totals, unsupportedIngredients } = useMemo(
    () => calculateMealTotals(parsedIngredients),
    [parsedIngredients],
  );

  const gaps = useMemo(
    () => compareGoals(totals, parsedGoals),
    [parsedGoals, totals],
  );
  const savableIngredients = useMemo(
    () =>
      calculatedIngredients.filter(
        (ingredient) => ingredient.name.trim().length > 0 && ingredient.amount > 0,
      ),
    [calculatedIngredients],
  );
  const mealDraftTitle = useMemo(
    () => buildManualMealTitle(savableIngredients.map((ingredient) => ingredient.name)),
    [savableIngredients],
  );

  const suggestions = useMemo(
    () =>
      hasAnyGoal
        ? generateSuggestions(totals, parsedGoals, unsupportedIngredients.length)
        : [
            {
              id: "set-goals",
              title: "Add goals to unlock tuning",
              body: "Use the example placeholders for calories, protein, carbs, and fat, then NutriPilot will compare the meal and suggest concrete changes.",
              tone: "balance" as const,
            },
          ],
    [hasAnyGoal, parsedGoals, totals, unsupportedIngredients.length],
  );

  function updateIngredient(id: string, patch: Partial<IngredientDraft>) {
    setIngredients((current) =>
      current.map((ingredient) =>
        ingredient.id === id ? { ...ingredient, ...patch } : ingredient,
      ),
    );
  }

  function removeIngredient(id: string) {
    if (searchTimers.current[id]) {
      window.clearTimeout(searchTimers.current[id]);
    }

    setSearchResults((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });

    setIngredients((current) =>
      current.length === 1
        ? [{ ...createIngredientDraft(), id }]
        : current.filter((ingredient) => ingredient.id !== id),
    );
  }

  function addIngredient() {
    setIngredients((current) => [...current, createIngredientDraft()]);
  }

  async function handleSaveMeal() {
    setSaveMessage(null);
    setSaveError(null);

    if (savableIngredients.length === 0) {
      setSaveError("Add at least one ingredient before saving this meal.");
      return;
    }

    if (!user) {
      setShowSignInPrompt(
        "You can keep using Meal Builder without an account. Log in when you want this meal waiting for you in the dashboard later.",
      );
      return;
    }

    setIsSavingMeal(true);
    setShowSignInPrompt(null);

    try {
      const meal = buildManualMealPayload({
        title: mealDraftTitle,
        ingredients: savableIngredients,
      });

      const response = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meal }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setSaveError(payload.error ?? "We couldn’t save that meal yet.");
        return;
      }

      setSaveMessage("Meal saved. You can log it from the dashboard whenever you need it.");
    } catch {
      setSaveError("We couldn’t save that meal yet.");
    } finally {
      setIsSavingMeal(false);
    }
  }

  function handleNameChange(id: string, value: string) {
    updateIngredient(id, { name: value, food: null, resolution: null });
    setOpenSearchId(id);

    if (searchTimers.current[id]) {
      window.clearTimeout(searchTimers.current[id]);
    }

    const trimmed = value.trim();

    if (trimmed.length < 2) {
      setSearchResults((current) => ({ ...current, [id]: [] }));
      setSearchLoadingId((current) => (current === id ? null : current));
      return;
    }

    searchTimers.current[id] = window.setTimeout(async () => {
      setSearchLoadingId(id);

      try {
        const response = await fetch(`/api/foods/search?q=${encodeURIComponent(trimmed)}`);
        const payload = (await response.json()) as {
          foods?: FoodSearchResult[];
          resolution?: IngredientResolution | null;
        };

        const latestIngredient = ingredientsRef.current.find(
          (ingredient) => ingredient.id === id,
        );

        if (latestIngredient?.name.trim() === trimmed) {
          setSearchResults((current) => ({
            ...current,
            [id]: payload.foods ?? [],
          }));

          if (payload.resolution?.food) {
            updateIngredient(id, {
              food: payload.resolution.food,
              resolution: payload.resolution,
              unit: isUnitAvailable(payload.resolution.food, latestIngredient.unit)
                ? latestIngredient.unit
                : choosePreferredUnit(payload.resolution.food),
            });
          } else {
            updateIngredient(id, {
              food: null,
              resolution: payload.resolution ?? null,
            });
          }
        }
      } catch {
        setSearchResults((current) => ({ ...current, [id]: [] }));
      } finally {
        setSearchLoadingId((current) => (current === id ? null : current));
      }
    }, 250);
  }

  async function selectFood(id: string, suggestion: FoodSearchResult) {
    setResolvingFoodId(id);

    try {
      const response = await fetch(`/api/foods/${suggestion.fdcId}`);
      const payload = (await response.json()) as {
        food?: ResolvedFood;
      };

      if (!response.ok || !payload.food) {
        return;
      }

      const preferredUnit = choosePreferredUnit(payload.food);

      updateIngredient(id, {
        food: payload.food,
        resolution: {
          ingredientText: suggestion.displayName,
          normalizedQuery: suggestion.description.toLowerCase(),
          matchedFoodId: suggestion.fdcId,
          matchedDescription: suggestion.description,
          matchedDataType: suggestion.dataType,
          confidence: 0.99,
          needsReview: false,
          rationale: "Match selected manually.",
          candidates: [suggestion],
          food: payload.food,
        },
        unit: preferredUnit,
      });
      setSearchResults((current) => ({ ...current, [id]: [] }));
      setOpenSearchId((current) => (current === id ? null : current));
    } finally {
      setResolvingFoodId((current) => (current === id ? null : current));
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-5 pb-12 pt-4 sm:px-8">
      <section className="mb-8 max-w-4xl">
        <p className="mb-3 text-sm font-semibold uppercase text-[var(--primary)]">
          Meal builder
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-[var(--foreground)] sm:text-5xl">
          Already know what you want to cook? We’ll help you total it and tune it.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Add the ingredients you already have in mind, check how the meal stacks
          up against your targets, and make a few confident tweaks without turning
          dinner into a spreadsheet.
        </p>
      </section>

      {importedRecipe ? (
        <div className="mb-6 rounded-[14px] border border-[var(--border)] bg-white/80 px-5 py-4 shadow-sm">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Imported from {importedRecipe.title}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            We pulled the ingredient list straight into the builder and matched what
            we could to reliable USDA nutrition data. Every row still stays editable
            if you want to tighten anything up.
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.85fr)]">
        <div className="order-2 space-y-6 lg:order-1">
          <IngredientTable
            ingredients={ingredients}
            calculatedIngredients={calculatedIngredients}
            onAdd={addIngredient}
            onRemove={removeIngredient}
            onUpdate={updateIngredient}
            onNameChange={handleNameChange}
            onSelectFood={selectFood}
            openSearchId={openSearchId}
            onOpenSearch={setOpenSearchId}
            resolvingFoodId={resolvingFoodId}
            searchLoadingId={searchLoadingId}
            searchResults={searchResults}
          />
          {unsupportedIngredients.length > 0 ? (
            <UnsupportedFoods names={unsupportedIngredients.map((item) => item.name)} />
          ) : null}
        </div>

        <aside className="order-1 space-y-6 lg:order-2">
          <SectionCard
            title="Save This Meal"
            eyebrow="Cloud saving"
            action={
              <button
                className="rounded-[10px] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-[var(--primary-strong)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSavingMeal || savableIngredients.length === 0}
                type="button"
                onClick={() => void handleSaveMeal()}
              >
                {isSavingMeal ? "Saving..." : "Save Meal"}
              </button>
            }
          >
            <p className="text-sm leading-6 text-[var(--muted)]">
              {savableIngredients.length > 0
                ? `${mealDraftTitle} is ready to save when you are.`
                : "As soon as you add a few ingredients, you can save this setup to your account."}
            </p>
            {saveMessage ? (
              <p className="mt-3 text-sm font-medium text-[var(--primary-strong)]">{saveMessage}</p>
            ) : null}
            {saveError ? (
              <p className="mt-3 text-sm font-medium text-[var(--danger)]">{saveError}</p>
            ) : null}
            {showSignInPrompt ? (
              <div className="mt-4">
                <SignInPrompt message={showSignInPrompt} />
              </div>
            ) : null}
          </SectionCard>
          <CaloriesCard totals={totals} goals={parsedGoals} hasAnyGoal={hasAnyGoal} />
          <MacroSummaryCard totals={totals} goals={parsedGoals} hasAnyGoal={hasAnyGoal} />
          <GoalsPreviewCard
            goals={parsedGoals}
            hasAnyGoal={hasAnyGoal}
            userEmail={user?.email ?? null}
          />
          <GoalGapCard gaps={gaps} hasAnyGoal={hasAnyGoal} />
          <SuggestionsCard suggestions={suggestions} />
        </aside>
      </div>
    </div>
  );
}

function createIngredientDraft(): IngredientDraft {
  return {
    id: crypto.randomUUID(),
    name: "",
    amount: "",
    unit: "g",
    food: null,
    resolution: null,
  };
}

function choosePreferredUnit(food: ResolvedFood): Unit {
  if (food.gramsByUnit.piece) {
    return "piece";
  }

  return "g";
}

function isUnitAvailable(food: ResolvedFood | null, unit: Unit) {
  if (!food) {
    return true;
  }

  return Boolean(food.gramsByUnit[unit]);
}

function IngredientTable({
  ingredients,
  calculatedIngredients,
  onAdd,
  onRemove,
  onUpdate,
  onNameChange,
  onSelectFood,
  openSearchId,
  onOpenSearch,
  resolvingFoodId,
  searchLoadingId,
  searchResults,
}: {
  ingredients: IngredientDraft[];
  calculatedIngredients: ReturnType<typeof calculateMealTotals>["calculatedIngredients"];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<IngredientDraft>) => void;
  onNameChange: (id: string, value: string) => void;
  onSelectFood: (id: string, suggestion: FoodSearchResult) => Promise<void>;
  openSearchId: string | null;
  onOpenSearch: (id: string | null) => void;
  resolvingFoodId: string | null;
  searchLoadingId: string | null;
  searchResults: Record<string, FoodSearchResult[]>;
}) {
  return (
    <SectionCard
      eyebrow="Main workflow"
      title="Ingredients"
      action={
        <div className="flex items-center gap-2">
          <Link
            className="rounded-[10px] border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition duration-200 hover:bg-[var(--muted-soft)] active:scale-[0.99]"
            href="/import-recipe"
          >
            Import recipe
          </Link>
          <button
            className="rounded-[10px] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-[var(--primary-strong)] active:scale-[0.99]"
            type="button"
            onClick={onAdd}
          >
            Add ingredient
          </button>
        </div>
      }
    >
      <div className="hidden grid-cols-[1.5fr_0.55fr_0.75fr_0.8fr_44px] gap-3 px-1 pb-3 text-xs font-semibold uppercase text-[var(--muted)] md:grid">
        <span>Food</span>
        <span>Amount</span>
        <span>Unit</span>
        <span>Match</span>
        <span />
      </div>

      {ingredients.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {ingredients.map((ingredient, index) => (
            <IngredientRow
              key={ingredient.id}
              ingredient={ingredient}
              calculated={calculatedIngredients[index]}
              onRemove={onRemove}
              onUpdate={onUpdate}
              onNameChange={onNameChange}
              onSelectFood={onSelectFood}
              isOpen={openSearchId === ingredient.id}
              onOpenSearch={onOpenSearch}
              isResolving={resolvingFoodId === ingredient.id}
              isSearching={searchLoadingId === ingredient.id}
              searchResults={searchResults[ingredient.id] ?? []}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function IngredientRow({
  ingredient,
  calculated,
  onRemove,
  onUpdate,
  onNameChange,
  onSelectFood,
  isOpen,
  onOpenSearch,
  isResolving,
  isSearching,
  searchResults,
}: {
  ingredient: IngredientDraft;
  calculated: ReturnType<typeof calculateMealTotals>["calculatedIngredients"][number];
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<IngredientDraft>) => void;
  onNameChange: (id: string, value: string) => void;
  onSelectFood: (id: string, suggestion: FoodSearchResult) => Promise<void>;
  isOpen: boolean;
  onOpenSearch: (id: string | null) => void;
  isResolving: boolean;
  isSearching: boolean;
  searchResults: FoodSearchResult[];
}) {
  const unitUnavailable = ingredient.food
    ? !isUnitAvailable(ingredient.food, ingredient.unit)
    : false;

  return (
    <div className="ingredient-row grid gap-3 rounded-[14px] border border-[var(--border)] bg-white/78 p-3 md:grid-cols-[1.5fr_0.55fr_0.75fr_0.8fr_44px] md:items-start">
      <div className="relative">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--muted)] md:hidden">
            Food
          </span>
          <input
            className="focus-ring h-11 w-full rounded-[12px] border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)]"
            placeholder="Chicken breast"
            value={ingredient.name}
            onFocus={() => onOpenSearch(ingredient.id)}
            onBlur={() => {
              window.setTimeout(() => onOpenSearch(null), 120);
            }}
            onChange={(event) => onNameChange(ingredient.id, event.target.value)}
          />
        </label>

        {ingredient.food ? (
          <div className="mt-2 space-y-1">
            <p className="text-xs text-[var(--muted)]">
              {ingredient.resolution?.rationale ?? "Using USDA nutrition data."}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {ingredient.food.sourceLabel}
              {ingredient.food.servingText ? ` - ${ingredient.food.servingText}` : ""}
            </p>
          </div>
        ) : null}

        {isOpen && (searchResults.length > 0 || isSearching) ? (
          <div className="absolute z-10 mt-2 w-full rounded-[12px] border border-[var(--border)] bg-white shadow-[var(--shadow)]">
            {isSearching ? (
              <p className="px-3 py-3 text-sm text-[var(--muted)]">Looking for a good match...</p>
            ) : (
              <ul className="max-h-72 overflow-y-auto py-2">
                {searchResults.map((result) => (
                  <li key={result.fdcId}>
                    <button
                      className="w-full px-3 py-2 text-left transition hover:bg-[var(--muted-soft)]"
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => void onSelectFood(ingredient.id, result)}
                    >
                      <span className="block text-sm font-medium text-[var(--foreground)]">
                        {result.displayName}
                      </span>
                      <span className="block text-xs text-[var(--muted)]">
                        {result.subtitle} - {Math.round(result.confidence * 100)}% match
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-[var(--muted)] md:hidden">
          Amount
        </span>
        <input
          className="focus-ring h-11 w-full rounded-[12px] border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)]"
          min="0"
          step="0.1"
          type="number"
          placeholder="150"
          value={ingredient.amount}
          onChange={(event) =>
            onUpdate(ingredient.id, {
              amount: event.target.value,
            })
          }
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-[var(--muted)] md:hidden">
          Unit
        </span>
        <select
          className="focus-ring h-11 w-full rounded-[12px] border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)]"
          value={ingredient.unit}
          onChange={(event) =>
            onUpdate(ingredient.id, { unit: event.target.value as Unit })
          }
        >
          {units.map((unit) => (
            <option
              key={unit}
              value={unit}
              disabled={ingredient.food ? !isUnitAvailable(ingredient.food, unit) : false}
            >
              {unit}
            </option>
          ))}
        </select>
        {unitUnavailable ? (
          <p className="mt-2 text-xs text-[var(--warning)]">
            USDA does not expose a {ingredient.unit} portion for this food.
          </p>
        ) : null}
      </label>

      <div>
        <span className="mb-1 block text-xs font-semibold text-[var(--muted)] md:hidden">
          Match
        </span>
          <div className="rounded-[12px] bg-[var(--muted-soft)] px-3 py-2">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {isResolving
                ? "Loading..."
                : calculated.supported
                  ? ingredient.resolution?.needsReview
                    ? "Using a close match"
                    : "Matched automatically"
                : ingredient.name.trim()
                  ? "Take a quick look"
                  : "Blank"}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {isResolving
                ? "Pulling in live nutrition data"
                : calculated.supported
                  ? `${calculated.totals.calories} kcal`
                  : ingredient.name.trim()
                    ? searchResults.length > 0
                      ? "You can swap this if you want something closer"
                      : "Try a broader ingredient name"
                    : "Start typing an ingredient"}
            </p>
          </div>
      </div>

      <button
        aria-label="Remove ingredient"
        className="h-11 rounded-[12px] border border-[var(--border)] bg-white text-lg leading-none text-[var(--muted)] transition duration-200 hover:border-[var(--danger-soft)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] active:scale-[0.99]"
        type="button"
        onClick={() => onRemove(ingredient.id)}
      >
        x
      </button>
    </div>
  );
}

function CaloriesCard({
  totals,
  goals,
  hasAnyGoal,
}: {
  totals: MacroTotals;
  goals: NutritionGoals;
  hasAnyGoal: boolean;
}) {
  return (
    <SectionCard className="!bg-[var(--primary-strong)] text-white">
      <p className="text-sm font-medium text-white/75">Meal total</p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <p className="flex items-end gap-3 text-5xl font-semibold leading-none">
            <span>{totals.calories}</span>
            <span className="pb-1 text-base font-medium text-white/75">calories</span>
          </p>
        </div>
        <div className="rounded-[12px] bg-white/10 px-3 py-2 text-right">
          <p className="text-xs text-white/70">Goal</p>
          <p className="text-sm font-semibold">
            {hasAnyGoal ? `${goals.calories} kcal` : "Example: 650 kcal"}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

function MacroSummaryCard({
  totals,
  goals,
  hasAnyGoal,
}: {
  totals: MacroTotals;
  goals: NutritionGoals;
  hasAnyGoal: boolean;
}) {
  return (
    <SectionCard title="Meal Summary" eyebrow="Live totals">
      <div className="space-y-4">
        {(["calories", "protein", "carbs", "fat"] as MacroKey[]).map((key) => (
          <MacroBar
            key={key}
            macroKey={key}
            label={macroMeta[key].label}
            actual={totals[key]}
            goal={goals[key]}
            hasGoal={hasAnyGoal}
            unit={macroMeta[key].unit}
            color={macroMeta[key].color}
          />
        ))}
      </div>
    </SectionCard>
  );
}

function MacroBar({
  macroKey,
  label,
  actual,
  goal,
  hasGoal,
  unit,
  color,
}: {
  macroKey: MacroKey;
  label: string;
  actual: number;
  goal: number;
  hasGoal: boolean;
  unit: string;
  color: string;
}) {
  const percent = goal > 0 ? Math.min((actual / goal) * 100, 130) : 0;
  const delta = actual - goal;
  const helper =
    !hasGoal
      ? unit
      : macroKey === "calories"
        ? Math.abs(delta) <= 35
          ? "near target"
          : delta > 0
            ? `${Math.abs(delta)} over`
            : `${Math.abs(delta)} under`
        : Math.abs(delta) <= 3
          ? "near target"
          : delta > 0
            ? `${Math.abs(roundToTenth(delta))}${unit} over`
            : `${Math.abs(roundToTenth(delta))}${unit} under`;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
        <span className="text-sm text-[var(--muted)]">
          <strong className="font-semibold text-[var(--foreground)]">{actual}</strong>{" "}
          {hasGoal ? (
            <>
              / {goal}
              {unit}
            </>
          ) : (
            unit
          )}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--muted-soft)]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${percent}%`, background: color }}
        />
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">{helper}</p>
    </div>
  );
}

function roundToTenth(value: number) {
  return Math.round(value * 10) / 10;
}

function GoalsPreviewCard({
  goals,
  hasAnyGoal,
  userEmail,
}: {
  goals: NutritionGoals;
  hasAnyGoal: boolean;
  userEmail: string | null;
}) {
  return (
    <SectionCard
      title="Nutrition Goals"
      eyebrow="Targets"
      action={
        <Link
          href="/dashboard"
          className="rounded-[10px] border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition duration-200 hover:bg-[var(--muted-soft)] active:scale-[0.99]"
        >
          Edit in Dashboard
        </Link>
      }
    >
      {hasAnyGoal ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {(["calories", "protein", "carbs", "fat"] as MacroKey[]).map((key) => (
            <div
              key={key}
              className="rounded-[12px] border border-[var(--border)] bg-white/80 px-4 py-4"
            >
              <p className="text-xs font-semibold uppercase text-[var(--muted)]">
                {macroMeta[key].label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                {goals[key]}
                <span className="ml-1 text-base font-medium text-[var(--muted)]">
                  {macroMeta[key].unit}
                </span>
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-[var(--muted)]">
          {userEmail
            ? "Set your targets in the dashboard and Meal Builder will use them here automatically."
            : "Sign in when you want your saved nutrition goals to carry across Meal Builder, Build a Meal for Me, and the dashboard."}
        </p>
      )}
    </SectionCard>
  );
}

function GoalGapCard({
  gaps,
  hasAnyGoal,
}: {
  gaps: GoalGap[];
  hasAnyGoal: boolean;
}) {
  return (
    <SectionCard title="How It Compares" eyebrow="At a glance">
      {hasAnyGoal ? (
        <div className="space-y-3">
          {gaps.map((gap) => (
            <div
              key={gap.key}
              className="flex items-center justify-between gap-3 rounded-[12px] bg-[var(--muted-soft)] px-3 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {gap.label}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {gap.actual} of {gap.goal}
                  {gap.key === "calories" ? " kcal" : "g"}
                </p>
              </div>
              <GapBadge gap={gap} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-[var(--muted)]">
          Add a few targets and we’ll show where this meal lands, what feels close,
          and what might need a little nudge.
        </p>
      )}
    </SectionCard>
  );
}

function GapBadge({ gap }: { gap: GoalGap }) {
  const unit = gap.key === "calories" ? "kcal" : "g";
  const amount = Math.abs(gap.delta);
  const text =
    gap.status === "on-target"
      ? "on target"
      : `${amount} ${unit} ${gap.status === "over" ? "over" : "under"}`;
  const colorClass =
    gap.status === "on-target"
      ? "bg-[var(--primary-soft)] text-[var(--primary-strong)]"
      : gap.status === "over"
        ? "bg-[var(--warning-soft)] text-[var(--warning)]"
        : "bg-white text-[var(--muted)]";

  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${colorClass}`}
    >
      {text}
    </span>
  );
}

function SuggestionsCard({ suggestions }: { suggestions: Suggestion[] }) {
  return (
    <SectionCard title="What to Tweak" eyebrow="Helpful recommendations">
      <div className="space-y-3">
        {suggestions.map((suggestion) => (
          <article
            key={suggestion.id}
            className="rounded-[12px] border border-[var(--border)] bg-white/70 p-4"
          >
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {suggestion.title}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {suggestion.body}
            </p>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}

function UnsupportedFoods({ names }: { names: string[] }) {
  return (
    <SectionCard title="Take a Quick Look" eyebrow="A couple of ingredients may need help">
      <p className="text-sm leading-6 text-[var(--muted)]">
        We couldn’t confidently match{" "}
        <span className="font-semibold text-[var(--foreground)]">
          {names.join(", ")}
        </span>
        {" "}yet. Most ingredients resolve automatically, but these few may need a
        broader search term or a quick manual pick from the USDA list.
      </p>
    </SectionCard>
  );
}
