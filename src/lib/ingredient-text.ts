import type { GeneratedMealIngredient, Unit } from "@/lib/types";

export function formatIngredientLine(
  amount: number,
  unit: Unit,
  name: string,
  notes?: string | null,
) {
  const formattedAmount = formatAmount(amount);
  const normalizedName = name.trim();
  const lowerName = normalizedName.toLowerCase();
  const lowerNotes = notes?.toLowerCase() ?? "";

  if (unit === "g") {
    return `${formattedAmount}g ${normalizedName}`;
  }

  if (unit === "tbsp") {
    return `${formattedAmount} tbsp ${normalizedName}`;
  }

  if (unit === "tsp") {
    return `${formattedAmount} tsp ${normalizedName}`;
  }

  if (unit === "cup") {
    return `${formattedAmount} ${pluralize("cup", amount)} ${normalizedName}`;
  }

  if (/scallion|green onion|spring onion/.test(lowerName)) {
    return `${formattedAmount} ${pluralize("scallion", amount)}`;
  }

  if (/lettuce/.test(lowerName) && (/leaf|leaves/.test(lowerName) || /leaf|leaves/.test(lowerNotes))) {
    return `${formattedAmount} lettuce ${pluralize("leaf", amount)}`;
  }

  if (/garlic/.test(lowerName)) {
    return `${formattedAmount} ${pluralize("clove", amount)} garlic`;
  }

  if (/cucumber/.test(lowerName)) {
    return `${formattedAmount} ${pluralize("cucumber", amount)}`;
  }

  if (/egg/.test(lowerName)) {
    return `${formattedAmount} ${pluralize("egg", amount)}`;
  }

  if (/chicken breast/.test(lowerName)) {
    return `${formattedAmount} ${amount === 1 ? "chicken breast" : "chicken breasts"}`;
  }

  if (/steak/.test(lowerName)) {
    return `${formattedAmount} ${amount === 1 ? normalizedName : `${normalizedName}s`}`;
  }

  return `${formattedAmount} ${pluralize("piece", amount)} ${normalizedName}`;
}

export function formatGroceryQuantity(
  amount: number,
  unit: Unit,
  label: string,
  notes?: string | null,
) {
  const formattedAmount = formatAmount(amount);
  const lowerLabel = label.toLowerCase();
  const lowerNotes = notes?.toLowerCase() ?? "";

  if (unit === "g") {
    return `${formattedAmount} g`;
  }

  if (unit === "tbsp") {
    return `${formattedAmount} tbsp`;
  }

  if (unit === "tsp") {
    return `${formattedAmount} tsp`;
  }

  if (unit === "cup") {
    return `${formattedAmount} ${pluralize("cup", amount)}`;
  }

  if (/scallion|green onion|spring onion/.test(lowerLabel)) {
    return `${formattedAmount} ${pluralize("stalk", amount)}`;
  }

  if (/lettuce/.test(lowerLabel) && (/leaf|leaves/.test(lowerLabel) || /leaf|leaves/.test(lowerNotes))) {
    return `${formattedAmount} ${pluralize("leaf", amount)}`;
  }

  if (/garlic/.test(lowerLabel)) {
    return `${formattedAmount} ${pluralize("clove", amount)}`;
  }

  if (/cucumber/.test(lowerLabel)) {
    return `${formattedAmount} ${pluralize("cucumber", amount)}`;
  }

  return `${formattedAmount} ${pluralize("piece", amount)}`;
}

export function formatIngredientCalories(ingredient: GeneratedMealIngredient) {
  return `${ingredient.totals.calories} kcal`;
}

function formatAmount(value: number) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return (Math.round(value * 10) / 10).toString();
}

function pluralize(noun: string, amount: number) {
  return Math.abs(amount) === 1 ? noun : `${noun}s`;
}
