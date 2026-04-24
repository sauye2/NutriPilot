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
    return `${formatWholeCount(amount)} ${pluralize("cucumber", amount)}`;
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

  if (/avocado/.test(lowerName)) {
    return `${formattedAmount} ${pluralize("avocado", amount)}`;
  }

  if (/bell pepper|yellow onion|white onion|red onion|onion|lime|lemon/.test(lowerName)) {
    return `${formatWholeCount(amount)} ${pluralize(normalizedName, amount)}`;
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
    return `${formatWholeCount(amount)} ${pluralize("cucumber", amount)}`;
  }

  if (/avocado/.test(lowerLabel)) {
    return `${formattedAmount} ${pluralize("avocado", amount)}`;
  }

  if (/bell pepper|yellow onion|white onion|red onion|onion|lime|lemon/.test(lowerLabel)) {
    return `${formatWholeCount(amount)} ${pluralize(label, amount)}`;
  }

  return `${formattedAmount} ${pluralize("piece", amount)}`;
}

export function formatIngredientCalories(ingredient: GeneratedMealIngredient) {
  return `${ingredient.totals.calories} kcal`;
}

function formatAmount(value: number) {
  if (Math.abs(value - 0.25) < 0.01) return "1/4";
  if (Math.abs(value - 0.5) < 0.01) return "1/2";
  if (Math.abs(value - 0.75) < 0.01) return "3/4";
  if (Math.abs(value - 1.25) < 0.01) return "1 1/4";
  if (Math.abs(value - 1.5) < 0.01) return "1 1/2";
  if (Math.abs(value - 1.75) < 0.01) return "1 3/4";

  if (Number.isInteger(value)) {
    return String(value);
  }

  return (Math.round(value * 10) / 10).toString();
}

function formatWholeCount(amount: number) {
  if (Math.abs(amount - 1) < 0.01) {
    return "1 whole";
  }

  return formatAmount(amount);
}

function pluralize(noun: string, amount: number) {
  return Math.abs(amount) === 1 || Math.abs(amount) < 1 ? noun : `${noun}s`;
}
