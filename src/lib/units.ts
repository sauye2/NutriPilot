import type { Unit } from "@/lib/types";

export const UNIT_OPTIONS: Array<{
  unit: Unit;
  label: string;
  group: "Weight" | "Volume" | "Count";
}> = [
  { unit: "g", label: "g", group: "Weight" },
  { unit: "oz", label: "oz", group: "Weight" },
  { unit: "lb", label: "lb", group: "Weight" },
  { unit: "tsp", label: "tsp", group: "Volume" },
  { unit: "tbsp", label: "tbsp", group: "Volume" },
  { unit: "cup", label: "cup", group: "Volume" },
  { unit: "pint", label: "pint", group: "Volume" },
  { unit: "quart", label: "quart", group: "Volume" },
  { unit: "piece", label: "piece", group: "Count" },
];

const WEIGHT_GRAMS: Partial<Record<Unit, number>> = {
  g: 1,
  oz: 28.3495,
  lb: 453.592,
};

export function getUnitWeight(
  gramsByUnit: Partial<Record<Unit, number>> | null | undefined,
  unit: Unit,
) {
  const base = gramsByUnit ?? {};

  if (base[unit]) {
    return base[unit] ?? null;
  }

  if (unit === "oz") {
    return WEIGHT_GRAMS.oz ?? null;
  }

  if (unit === "lb") {
    return WEIGHT_GRAMS.lb ?? null;
  }

  if (unit === "g") {
    return WEIGHT_GRAMS.g ?? null;
  }

  if (unit === "pint" && base.cup) {
    return base.cup * 2;
  }

  if (unit === "quart" && base.cup) {
    return base.cup * 4;
  }

  if (unit === "cup" && base.pint) {
    return base.pint / 2;
  }

  if (unit === "cup" && base.quart) {
    return base.quart / 4;
  }

  return null;
}

export function canConvertBetweenUnits(
  gramsByUnit: Partial<Record<Unit, number>> | null | undefined,
  fromUnit: Unit,
  toUnit: Unit,
) {
  return (
    getUnitWeight(gramsByUnit, fromUnit) !== null &&
    getUnitWeight(gramsByUnit, toUnit) !== null
  );
}

export function convertAmountBetweenUnits(
  amount: number,
  gramsByUnit: Partial<Record<Unit, number>> | null | undefined,
  fromUnit: Unit,
  toUnit: Unit,
) {
  const fromWeight = getUnitWeight(gramsByUnit, fromUnit);
  const toWeight = getUnitWeight(gramsByUnit, toUnit);

  if (!fromWeight || !toWeight || !Number.isFinite(amount)) {
    return null;
  }

  return (amount * fromWeight) / toWeight;
}

export function roundAmountForInput(value: number) {
  if (!Number.isFinite(value)) {
    return "";
  }
  return formatExactNumber(value);
}

export function normalizeImportedUnit(unitText: string): Unit | null {
  const normalized = unitText.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (/^(g|gram|grams)$/.test(normalized)) return "g";
  if (/^(oz|ounce|ounces)$/.test(normalized)) return "oz";
  if (/^(lb|lbs|pound|pounds)$/.test(normalized)) return "lb";
  if (/^(tsp|teaspoon|teaspoons)$/.test(normalized)) return "tsp";
  if (/^(tbsp|tablespoon|tablespoons)$/.test(normalized)) return "tbsp";
  if (/^(cup|cups)$/.test(normalized)) return "cup";
  if (/^(pint|pints|pt)$/.test(normalized)) return "pint";
  if (/^(quart|quarts|qt)$/.test(normalized)) return "quart";
  if (/^(piece|pieces|clove|cloves|egg|eggs|breast|breasts|fillet|fillets|steak|steaks|link|links)$/.test(normalized)) {
    return "piece";
  }

  return null;
}

export function formatExactNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "";
  }

  return value.toFixed(6).replace(/\.?0+$/, "");
}
