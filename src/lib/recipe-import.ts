import "server-only";

import { resolveIngredientMatch } from "@/lib/food-data-central";
import type { ImportedRecipe, ImportedRecipeIngredient, Unit } from "@/lib/types";

type RecipeNode = {
  "@type"?: string | string[];
  name?: string;
  recipeIngredient?: string[];
  image?: string | string[] | { url?: string } | Array<{ url?: string }>;
  "@graph"?: RecipeNode[];
};

const FRACTION_MAP: Record<string, string> = {
  "\u00BC": "1/4",
  "\u00BD": "1/2",
  "\u00BE": "3/4",
  "\u2150": "1/7",
  "\u2151": "1/9",
  "\u2152": "1/10",
  "\u2153": "1/3",
  "\u2154": "2/3",
  "\u2155": "1/5",
  "\u2156": "2/5",
  "\u2157": "3/5",
  "\u2158": "4/5",
  "\u2159": "1/6",
  "\u215A": "5/6",
  "\u215B": "1/8",
  "\u215C": "3/8",
  "\u215D": "5/8",
  "\u215E": "7/8",
};

const UNIT_ALIASES: Array<{
  pattern: RegExp;
  unit: Unit;
  multiplier?: number;
}> = [
  { pattern: /^(tablespoons?|tbsps?|tbsp)\b/i, unit: "tbsp" },
  { pattern: /^(teaspoons?|tsps?|tsp)\b/i, unit: "tsp" },
  { pattern: /^(cups?|c)\b/i, unit: "cup" },
  { pattern: /^(ounces?|oz)\b/i, unit: "g", multiplier: 28.3495 },
  { pattern: /^(pounds?|lbs?|lb)\b/i, unit: "g", multiplier: 453.592 },
  { pattern: /^(grams?|g)\b/i, unit: "g" },
  {
    pattern:
      /^(cloves?|eggs?|pieces?|fillets?|breasts?|steaks?|cans?|packages?|links?)\b/i,
    unit: "piece",
  },
];

export async function importRecipeFromUrl(inputUrl: string): Promise<ImportedRecipe> {
  const url = validateRecipeUrl(inputUrl);
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; NutriPilot/1.0; +https://localhost:3000)",
      Accept: "text/html,application/xhtml+xml",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`Could not fetch recipe page (${response.status}).`);
  }

  const html = await response.text();
  const recipe = extractRecipeFromHtml(html);

  if (!recipe || !recipe.recipeIngredient?.length) {
    throw new Error(
      "NutriPilot could not find a high-confidence recipe block on that page.",
    );
  }

  const normalizedIngredients = await Promise.all(
    recipe.recipeIngredient
      .map((ingredient) => normalizeIngredientLine(ingredient))
      .filter((ingredient): ingredient is ParsedIngredient => Boolean(ingredient))
      .map(async (ingredient) => {
        const resolution = await resolveIngredientMatch(ingredient.name);

        return {
          id: crypto.randomUUID(),
          originalText: ingredient.originalText,
          name: ingredient.name,
          amount: ingredient.amount,
          unit: ingredient.unit,
          food: resolution.food,
          confidence:
            resolution.food && !resolution.needsReview ? "matched" : "needs-review",
          resolution,
        } satisfies ImportedRecipeIngredient;
      }),
  );

  return {
    title: recipe.name?.trim() || "Imported recipe",
    sourceUrl: url,
    imageUrl: pickRecipeImage(recipe.image),
    ingredients: normalizedIngredients,
    warnings: buildWarnings(normalizedIngredients),
  };
}

type ParsedIngredient = {
  originalText: string;
  name: string;
  amount: number | null;
  unit: Unit;
};

function validateRecipeUrl(inputUrl: string) {
  let parsed: URL;

  try {
    parsed = new URL(inputUrl);
  } catch {
    throw new Error("Please paste a valid recipe URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http and https recipe URLs are supported.");
  }

  return parsed.toString();
}

function extractRecipeFromHtml(html: string): RecipeNode | null {
  const jsonLdRecipe = extractRecipeFromJsonLd(html);

  if (jsonLdRecipe?.recipeIngredient?.length) {
    return jsonLdRecipe;
  }

  const microdataIngredients = extractMicrodataIngredients(html);

  if (microdataIngredients.length > 0) {
    return {
      name: extractTitle(html) ?? "Imported recipe",
      recipeIngredient: microdataIngredients,
    };
  }

  return null;
}

function extractRecipeFromJsonLd(html: string): RecipeNode | null {
  const matches = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  const recipes: RecipeNode[] = [];

  for (const match of matches) {
    const raw = match[1]?.trim();

    if (!raw) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      collectRecipeNodes(parsed).forEach((node) => recipes.push(node));
    } catch {
      continue;
    }
  }

  return (
    recipes
      .filter(
        (node) => Array.isArray(node.recipeIngredient) && node.recipeIngredient.length > 0,
      )
      .sort(
        (left, right) =>
          (right.recipeIngredient?.length ?? 0) - (left.recipeIngredient?.length ?? 0),
      )[0] ?? null
  );
}

function collectRecipeNodes(value: unknown): RecipeNode[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectRecipeNodes(item));
  }

  if (typeof value !== "object") {
    return [];
  }

  const node = value as RecipeNode;
  const graphNodes = node["@graph"] ? collectRecipeNodes(node["@graph"]) : [];
  const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
  const isRecipe = types.some((type) => type === "Recipe");

  return [...(isRecipe ? [node] : []), ...graphNodes];
}

function extractMicrodataIngredients(html: string) {
  const results: string[] = [];
  const metaMatches = html.matchAll(
    /<meta[^>]*itemprop=["']recipeIngredient["'][^>]*content=["']([^"']+)["'][^>]*>/gi,
  );

  for (const match of metaMatches) {
    const content = cleanupHtmlText(match[1]);

    if (content) {
      results.push(content);
    }
  }

  const nodeMatches = html.matchAll(
    /<[^>]*itemprop=["']recipeIngredient["'][^>]*>([\s\S]*?)<\/[^>]+>/gi,
  );

  for (const match of nodeMatches) {
    const content = cleanupHtmlText(match[1]);

    if (content) {
      results.push(content);
    }
  }

  return Array.from(new Set(results));
}

function extractTitle(html: string) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);

  return cleanupHtmlText(match?.[1] ?? "");
}

function cleanupHtmlText(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .replace(/^\W+|\W+$/g, "")
      .trim(),
  );
}

function decodeHtmlEntities(value: string) {
  return fixMojibake(
    value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&frac12;/gi, "1/2")
    .replace(/&frac14;/gi, "1/4")
    .replace(/&frac34;/gi, "3/4")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code))),
  );
}

function normalizeIngredientLine(line: string): ParsedIngredient | null {
  const originalText = cleanupIngredientLine(line);

  if (!originalText) {
    return null;
  }

  const normalizedFractions = replaceFractions(originalText);
  const amountMatch = normalizedFractions.match(
    /^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s+/,
  );

  if (!amountMatch) {
    return {
      originalText,
      name: stripPrepPrefixes(normalizedFractions),
      amount: null,
      unit: "piece",
    };
  }

  const amountText = amountMatch[1];
  const amount = parseAmount(amountText);
  let remainder = normalizedFractions.slice(amountMatch[0].length).trim();
  let unit: Unit = "piece";

  for (const alias of UNIT_ALIASES) {
    const unitMatch = remainder.match(alias.pattern);

    if (!unitMatch) {
      continue;
    }

    remainder = remainder.slice(unitMatch[0].length).trim();
    unit = alias.unit;

    return {
      originalText,
      name: stripPrepPrefixes(remainder),
      amount:
        amount !== null && alias.multiplier ? roundValue(amount * alias.multiplier) : amount,
      unit,
    };
  }

  return {
    originalText,
    name: stripPrepPrefixes(remainder),
    amount,
    unit,
  };
}

function cleanupIngredientLine(line: string) {
  return decodeHtmlEntities(
    stripImportNoise(
      line
      .replace(/\s+/g, " ")
      .replace(/^[-*\u2022]\s*/, "")
      .trim(),
    ),
  );
}

function replaceFractions(value: string) {
  return Array.from(value).reduce((result, character) => {
    const mapped = FRACTION_MAP[character];
    return `${result}${mapped ? ` ${mapped} ` : character}`;
  }, "");
}

function parseAmount(value: string) {
  const normalized = value.trim();

  if (/^\d+\/\d+$/.test(normalized)) {
    const [numerator, denominator] = normalized.split("/").map(Number);
    return denominator ? numerator / denominator : null;
  }

  if (/^\d+\s+\d+\/\d+$/.test(normalized)) {
    const [whole, fraction] = normalized.split(/\s+/);
    const [numerator, denominator] = fraction.split("/").map(Number);
    return Number(whole) + (denominator ? numerator / denominator : 0);
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function stripPrepPrefixes(value: string) {
  return value
    .replace(/^[,.;:()\s]+/, "")
    .replace(/\b(for the|such as|plus more for serving)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripImportNoise(value: string) {
  return value
    .replace(/\((?:[^)]*\$[^)]*|[^)]*see notes[^)]*)\)/gi, "")
    .replace(/\s+,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function fixMojibake(value: string) {
  return value
    .replace(/Â/g, "")
    .replace(/Â¼/g, "\u00BC")
    .replace(/Â½/g, "\u00BD")
    .replace(/Â¾/g, "\u00BE")
    .replace(/â€¢/g, "\u2022");
}

function buildWarnings(ingredients: ImportedRecipeIngredient[]) {
  const unmatchedCount = ingredients.filter(
    (ingredient) => ingredient.confidence === "needs-review",
  ).length;
  const warnings: string[] = [];

  if (unmatchedCount > 0) {
    warnings.push(
      `${unmatchedCount} ingredient${unmatchedCount === 1 ? " may" : "s may"} need a quick review. NutriPilot still picked the closest generic USDA match where possible.`,
    );
  }

  return warnings;
}

function pickRecipeImage(image: RecipeNode["image"]) {
  if (!image) {
    return null;
  }

  if (typeof image === "string") {
    return image;
  }

  if (Array.isArray(image)) {
    const first = image[0];
    if (typeof first === "string") return first;
    return first?.url ?? null;
  }

  return image.url ?? null;
}

function roundValue(value: number) {
  return Math.round(value * 10) / 10;
}
