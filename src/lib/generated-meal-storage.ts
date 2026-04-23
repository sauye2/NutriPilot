import type { GeneratedMeal } from "@/lib/types";

export const ACCEPTED_MEAL_STORAGE_KEY = "nutripilot-accepted-generated-meal";

export function saveAcceptedGeneratedMeal(meal: GeneratedMeal) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACCEPTED_MEAL_STORAGE_KEY, JSON.stringify(meal));
}

export function readAcceptedGeneratedMeal() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(ACCEPTED_MEAL_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as GeneratedMeal;
  } catch {
    return null;
  }
}
