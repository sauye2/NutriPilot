import type { ImportedRecipe } from "@/lib/types";

export const IMPORTED_RECIPE_STORAGE_KEY = "nutripilot-imported-recipe";

export function saveImportedRecipe(recipe: ImportedRecipe) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(IMPORTED_RECIPE_STORAGE_KEY, JSON.stringify(recipe));
}

export function readImportedRecipe() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(IMPORTED_RECIPE_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as ImportedRecipe;
  } catch {
    return null;
  }
}

export function clearImportedRecipe() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(IMPORTED_RECIPE_STORAGE_KEY);
}
