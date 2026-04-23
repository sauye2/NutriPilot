"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  calculateMealTotals,
  compareGoals,
  generateSuggestions,
} from "@/lib/nutrition";
import { clearImportedRecipe, readImportedRecipe } from "@/lib/imported-recipe-storage";
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
const goalPlaceholders: Record<MacroKey, string> = {
  calories: "650",
  protein: "45",
  carbs: "65",
  fat: "22",
};

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

  const searchTimers = useRef<Record<string, number | undefined>>({});
  const ingredientsRef = useRef(ingredients);

  useEffect(() => {
    ingredientsRef.current = ingredients;
  }, [ingredients]);

  useEffect(() => {
    if (importedRecipe) {
      clearImportedRecipe();
    }
  }, [importedRecipe]);

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

  function updateGoal(key: MacroKey, value: string) {
    setGoals((current) => ({ ...current, [key]: value }));
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
          Already know what you want to cook? Calculate it, then tune it.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Search real USDA foods, enter precise quantities, compare the meal
          against your targets, and make cleaner ingredient decisions fast.
        </p>
      </section>

      {importedRecipe ? (
        <div className="mb-6 rounded-[8px] border border-[var(--border)] bg-white/80 px-5 py-4 shadow-sm">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Imported from {importedRecipe.title}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Exact ingredient lines were brought into the builder. NutriPilot already
            picked generic USDA matches where it could, and every row stays editable if
            you want to fine-tune the match.
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
          <CaloriesCard totals={totals} goals={parsedGoals} hasAnyGoal={hasAnyGoal} />
          <MacroSummaryCard totals={totals} goals={parsedGoals} hasAnyGoal={hasAnyGoal} />
          <GoalsCard goals={goals} onUpdate={updateGoal} />
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
      eyebrow="Primary workflow"
      title="Ingredients"
      action={
        <div className="flex items-center gap-2">
          <Link
            className="rounded-[8px] border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--muted-soft)]"
            href="/import-recipe"
          >
            Import recipe
          </Link>
          <button
            className="rounded-[8px] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
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
    <div className="grid gap-3 rounded-[8px] border border-[var(--border)] bg-white/70 p-3 md:grid-cols-[1.5fr_0.55fr_0.75fr_0.8fr_44px] md:items-start">
      <div className="relative">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--muted)] md:hidden">
            Food
          </span>
          <input
            className="focus-ring h-11 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)]"
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
          <div className="absolute z-10 mt-2 w-full rounded-[8px] border border-[var(--border)] bg-white shadow-[var(--shadow)]">
            {isSearching ? (
              <p className="px-3 py-3 text-sm text-[var(--muted)]">Searching USDA...</p>
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
          className="focus-ring h-11 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)]"
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
          className="focus-ring h-11 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)]"
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
        <div className="rounded-[8px] bg-[var(--muted-soft)] px-3 py-2">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {isResolving
              ? "Loading..."
              : calculated.supported
                ? ingredient.resolution?.needsReview
                  ? "Using closest match"
                  : "Matched automatically"
                : ingredient.name.trim()
                  ? "Needs a closer match"
                  : "Blank"}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {isResolving
              ? "Fetching live nutrition data"
              : calculated.supported
                ? `${calculated.totals.calories} kcal - ${calculated.totals.protein}P ${calculated.totals.carbs}C ${calculated.totals.fat}F`
                : ingredient.name.trim()
                  ? searchResults.length > 0
                    ? "Pick a different match if you want"
                    : "Try a broader food name"
                  : "Start typing a food"}
          </p>
        </div>
      </div>

      <button
        aria-label="Remove ingredient"
        className="h-11 rounded-[8px] border border-[var(--border)] bg-white text-lg leading-none text-[var(--muted)] transition hover:border-[var(--danger-soft)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
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
  const delta = totals.calories - goals.calories;
  const label =
    !hasAnyGoal
      ? "set a calorie target"
      : Math.abs(delta) <= 35
        ? "near target"
        : delta > 0
          ? `${Math.abs(delta)} over`
          : `${Math.abs(delta)} under`;

  return (
    <SectionCard className="!bg-[var(--primary-strong)] text-white">
      <p className="text-sm font-medium text-white/75">Meal total</p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-5xl font-semibold leading-none">{totals.calories}</p>
          <p className="mt-2 text-sm text-white/75">calories</p>
        </div>
        <div className="rounded-[8px] bg-white/10 px-3 py-2 text-right">
          <p className="text-xs text-white/70">Goal</p>
          <p className="text-sm font-semibold">
            {hasAnyGoal ? `${goals.calories} kcal` : "Example: 650 kcal"}
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm font-medium text-white/80">{label}</p>
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
    <SectionCard title="Macros" eyebrow="Live totals">
      <div className="space-y-4">
        {(["protein", "carbs", "fat"] as MacroKey[]).map((key) => (
          <MacroBar
            key={key}
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
  label,
  actual,
  goal,
  hasGoal,
  unit,
  color,
}: {
  label: string;
  actual: number;
  goal: number;
  hasGoal: boolean;
  unit: string;
  color: string;
}) {
  const percent = goal > 0 ? Math.min((actual / goal) * 100, 130) : 0;

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
          className="h-full rounded-full transition-all"
          style={{ width: `${percent}%`, background: color }}
        />
      </div>
    </div>
  );
}

function GoalsCard({
  goals,
  onUpdate,
}: {
  goals: GoalDraft;
  onUpdate: (key: MacroKey, value: string) => void;
}) {
  return (
    <SectionCard title="Nutrition Goals" eyebrow="Targets">
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(goals) as MacroKey[]).map((key) => (
          <label key={key} className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
              {macroMeta[key].label}
            </span>
            <input
              className="focus-ring h-11 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)]"
              min="0"
              step={key === "calories" ? 10 : 1}
              type="number"
              placeholder={goalPlaceholders[key]}
              value={goals[key]}
              onChange={(event) => onUpdate(key, event.target.value)}
            />
          </label>
        ))}
      </div>
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
    <SectionCard title="Goal Gap" eyebrow="What needs tuning">
      {hasAnyGoal ? (
        <div className="space-y-3">
          {gaps.map((gap) => (
            <div
              key={gap.key}
              className="flex items-center justify-between gap-3 rounded-[8px] bg-[var(--muted-soft)] px-3 py-3"
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
          Add calorie or macro targets to compare this meal against a goal.
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
    <SectionCard title="Suggestions" eyebrow="Next best changes">
      <div className="space-y-3">
        {suggestions.map((suggestion) => (
          <article
            key={suggestion.id}
            className="rounded-[8px] border border-[var(--border)] bg-white/70 p-4"
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
    <SectionCard title="Review Matches" eyebrow="Friendly note">
      <p className="text-sm leading-6 text-[var(--muted)]">
        NutriPilot still needs a closer nutrition match for{" "}
        <span className="font-semibold text-[var(--foreground)]">
          {names.join(", ")}
        </span>
        . Most ingredients resolve automatically, but these few may need a lighter edit
        or a manual pick from the USDA list.
      </p>
    </SectionCard>
  );
}
