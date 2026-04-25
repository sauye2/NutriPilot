"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { SectionCard } from "@/components/section-card";
import { saveImportedRecipe } from "@/lib/imported-recipe-storage";
import type { ImportedRecipe } from "@/lib/types";

export function ImportRecipeClient() {
  const { user } = useAuth();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [recipe, setRecipe] = useState<ImportedRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleImport() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/recipes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const payload = (await response.json()) as {
        recipe?: ImportedRecipe;
        error?: string;
      };

      if (!response.ok || !payload.recipe) {
        setRecipe(null);
        setError(payload.error ?? "Recipe import failed.");
        return;
      }

      setRecipe(payload.recipe);
    } catch {
      setRecipe(null);
      setError("Recipe import failed. Try a direct recipe page URL.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSendToBuilder() {
    if (!recipe) {
      return;
    }

    saveImportedRecipe(recipe);
    router.push("/meal-builder");
  }

  async function handleSaveRecipe() {
    setSaveMessage(null);
    setSaveError(null);

    if (!recipe) {
      return;
    }

    if (!user) {
      setSaveError("Log in to keep imported recipes in your account.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/imported-recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setSaveError(payload.error ?? "We couldn’t save that recipe yet.");
        return;
      }

      setSaveMessage("Recipe saved. You can still send it to Meal Builder whenever you want.");
    } catch {
      setSaveError("We couldn’t save that recipe yet.");
    } finally {
      setIsSaving(false);
    }
  }

  const matchedCount =
    recipe?.ingredients.filter((ingredient) => ingredient.confidence === "matched").length ?? 0;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-5 pb-12 pt-4 sm:px-8">
        <section className="mb-8 max-w-4xl">
          <p className="mb-3 text-sm font-semibold uppercase text-[var(--primary)]">
            Recipe import
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-[var(--foreground)] sm:text-5xl">
            Paste in a recipe link and bring the ingredient list straight into your meal.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
            The importer stays careful on purpose. It preserves the ingredient lines
            from the recipe, looks for dependable USDA matches, and only asks for a
            second look when something truly feels fuzzy.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <SectionCard title="Import from Link" eyebrow="Bring in a recipe">
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                  Recipe URL
                </span>
                <input
                  className="focus-ring h-12 w-full rounded-[12px] border border-[var(--border)] bg-white px-4 text-sm text-[var(--foreground)]"
                  placeholder="https://example.com/your-recipe"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                />
              </label>

              <button
                className="rounded-[12px] bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-[var(--primary-strong)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading || url.trim().length < 8}
                type="button"
                onClick={() => void handleImport()}
              >
                {isLoading ? "Importing..." : "Import recipe"}
              </button>

              <div className="rounded-[12px] bg-[var(--muted-soft)] px-4 py-4 text-sm leading-6 text-[var(--muted)]">
                If a page does not expose a clean ingredient list, NutriPilot will stop
                rather than guessing and adding extras you never asked for.
              </div>

              {error ? (
                <div className="rounded-[12px] border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
                  {error}
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title={recipe ? recipe.title : "Recipe Preview"}
            eyebrow={recipe ? "Ready to send over" : "What lands in the builder"}
            action={
              recipe ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-[12px] border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition duration-200 hover:bg-[var(--muted-soft)] active:scale-[0.99]"
                    type="button"
                    onClick={() => void handleSaveRecipe()}
                  >
                    {isSaving ? "Saving..." : "Save Recipe"}
                  </button>
                  <button
                    className="rounded-[12px] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-[var(--primary-strong)] active:scale-[0.99]"
                    type="button"
                    onClick={handleSendToBuilder}
                  >
                    Add to Meal Builder
                  </button>
                </div>
              ) : undefined
            }
          >
            {recipe ? (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Metric label="Ingredients" value={String(recipe.ingredients.length)} />
                  <Metric label="Matched foods" value={String(matchedCount)} />
                  <Metric
                    label="Needs review"
                    value={String(recipe.ingredients.length - matchedCount)}
                  />
                </div>

                <div className="space-y-3">
                  {recipe.ingredients.map((ingredient) => (
                    <div
                      key={ingredient.id}
                      className="rounded-[12px] border border-[var(--border)] bg-white/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--foreground)]">
                            {ingredient.originalText}
                          </p>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {ingredient.amount ?? "?"} {ingredient.unit} - {ingredient.name}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {ingredient.resolution?.rationale ??
                              (ingredient.food
                                ? ingredient.food.sourceLabel
                                : "Food match not locked yet")}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                            ingredient.confidence === "matched"
                              ? "bg-[var(--primary-soft)] text-[var(--primary-strong)]"
                              : "bg-[var(--warning-soft)] text-[var(--warning)]"
                          }`}
                        >
                          {ingredient.confidence === "matched" ? "matched" : "quick look"}
                        </span>
                      </div>
                      {ingredient.confidence === "needs-review" &&
                      ingredient.resolution?.candidates.length ? (
                        <div className="mt-3 rounded-[12px] bg-[var(--muted-soft)] px-3 py-3">
                          <p className="text-xs font-semibold uppercase text-[var(--muted)]">
                            Top matches
                          </p>
                          <div className="mt-2 space-y-1">
                            {ingredient.resolution.candidates.slice(0, 3).map((candidate) => (
                              <p
                                key={`${ingredient.id}-${candidate.fdcId}`}
                                className="text-xs text-[var(--muted)]"
                              >
                                {candidate.displayName} - {candidate.subtitle}
                              </p>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                {recipe.warnings.length > 0 ? (
                  <div className="space-y-2">
                    {recipe.warnings.map((warning) => (
                      <div
                        key={warning}
                        className="rounded-[12px] bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--warning)]"
                      >
                        {warning}
                      </div>
                    ))}
                  </div>
                ) : null}
                {saveMessage ? (
                  <div className="rounded-[12px] bg-[var(--muted-soft)] px-4 py-3 text-sm text-[var(--foreground)]">
                    {saveMessage}
                  </div>
                ) : null}
                {saveError ? user ? (
                  <div className="rounded-[12px] border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
                    {saveError}
                  </div>
                ) : (
                  <SignInPrompt message={saveError} />
                ) : null}
              </div>
            ) : (
              <div className="rounded-[12px] border border-dashed border-[var(--border)] bg-[var(--muted-soft)] px-4 py-8 text-center">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Paste a recipe link to preview the ingredient list.
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
                  You’ll see the ingredient lines first, then choose when to bring them
                  into the builder.
                </p>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card rounded-[12px] border border-[var(--border)] bg-white/80 px-4 py-4">
      <p className="text-xs font-semibold uppercase text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
