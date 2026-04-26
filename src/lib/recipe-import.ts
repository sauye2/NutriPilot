import "server-only";

import { resolveIngredientMatch } from "@/lib/food-data-central";
import type { ImportedRecipe, ImportedRecipeIngredient, Unit } from "@/lib/types";
import {
  convertAmountBetweenUnits,
  normalizeImportedUnit,
  roundAmountForInput,
} from "@/lib/units";

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
}> = [
  { pattern: /^(tablespoons?|tbsps?|tbsp)\b/i, unit: "tbsp" },
  { pattern: /^(teaspoons?|tsps?|tsp)\b/i, unit: "tsp" },
  { pattern: /^(cups?|c)\b/i, unit: "cup" },
  { pattern: /^(pints?|pt)\b/i, unit: "pint" },
  { pattern: /^(quarts?|qt)\b/i, unit: "quart" },
  { pattern: /^(ounces?|oz)\b/i, unit: "oz" },
  { pattern: /^(pounds?|lbs?|lb)\b/i, unit: "lb" },
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

  const normalizedLines = consolidateParsedIngredients(
    recipe.recipeIngredient
      .map((ingredient) => normalizeIngredientLine(ingredient))
      .filter((ingredient): ingredient is ParsedIngredient => Boolean(ingredient)),
  );

  const normalizedIngredients = await Promise.all(
    normalizedLines.map(async (ingredient) => {
        const resolution = await resolveIngredientMatch(ingredient.name);

        return {
          id: crypto.randomUUID(),
          originalText: formatImportedIngredientLine(ingredient),
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

  const frameworkRecipe = extractRecipeFromFrameworkState(html);

  if (frameworkRecipe?.recipeIngredient?.length) {
    return frameworkRecipe;
  }

  const embeddedJsonRecipe = extractRecipeFromEmbeddedJsonScripts(html);

  if (embeddedJsonRecipe?.recipeIngredient?.length) {
    return embeddedJsonRecipe;
  }

  const sectionIngredients = extractIngredientSectionFallback(html);

  if (sectionIngredients.length > 0) {
    return {
      name: extractTitle(html) ?? "Imported recipe",
      recipeIngredient: sectionIngredients,
    };
  }

  return null;
}

function extractRecipeFromEmbeddedJsonScripts(html: string): RecipeNode | null {
  const matches = html.matchAll(
    /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  const records: RecipeNode[] = [];

  for (const match of matches) {
    const raw = match[1]?.trim();

    if (!raw) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      records.push(...collectFrameworkRecipeRecords(parsed));
    } catch {
      continue;
    }
  }

  return (
    records
      .filter((record) => Array.isArray(record.recipeIngredient) && record.recipeIngredient.length > 0)
      .sort(
        (left, right) =>
          (right.recipeIngredient?.length ?? 0) - (left.recipeIngredient?.length ?? 0),
      )[0] ?? null
  );
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

function extractRecipeFromFrameworkState(html: string): RecipeNode | null {
  const nextDataMatch = html.match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i,
  );

  if (!nextDataMatch?.[1]) {
    return null;
  }

  try {
    const parsed = JSON.parse(nextDataMatch[1]) as unknown;
    const records = collectFrameworkRecipeRecords(parsed);

    return (
      records
        .filter((record) => Array.isArray(record.recipeIngredient) && record.recipeIngredient.length > 0)
        .sort(
          (left, right) =>
            (right.recipeIngredient?.length ?? 0) - (left.recipeIngredient?.length ?? 0),
        )[0] ?? null
    );
  } catch {
    return null;
  }
}

function collectFrameworkRecipeRecords(value: unknown): RecipeNode[] {
  const records: RecipeNode[] = [];
  const seen = new WeakSet<object>();

  function walk(node: unknown) {
    if (!node || typeof node !== "object") {
      return;
    }

    if (seen.has(node)) {
      return;
    }

    seen.add(node);

    if (Array.isArray(node)) {
      node.forEach((item) => walk(item));
      return;
    }

    const record = node as Record<string, unknown>;
    const recipe = extractFrameworkRecipeRecord(record);

    if (recipe?.recipeIngredient?.length) {
      records.push(recipe);
    }

    Object.values(record).forEach((child) => walk(child));
  }

  walk(value);
  return records;
}

function extractFrameworkRecipeRecord(record: Record<string, unknown>): RecipeNode | null {
  const ingredientsArray = Array.isArray(record.ingredientsArray) ? record.ingredientsArray : null;

  if (ingredientsArray?.length) {
    const ingredientLines = ingredientsArray
      .map((entry) => formatFrameworkIngredient(entry))
      .filter((line): line is string => Boolean(line));

    if (ingredientLines.length > 0) {
      return {
        name: pickFirstString(record.title, record.name, record.seoTitle),
        image: pickFrameworkImage(record),
        recipeIngredient: ingredientLines,
      };
    }
  }

  const recipeIngredient = normalizeStringArray(record.recipeIngredient);

  if (recipeIngredient.length > 0) {
    return {
      name: pickFirstString(record.title, record.name, record.seoTitle),
      image: pickFrameworkImage(record),
      recipeIngredient,
    };
  }

  return null;
}

function formatFrameworkIngredient(entry: unknown) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const ingredient = entry as Record<string, unknown>;

  if (ingredient._type !== "ingredient") {
    return null;
  }

  const item = cleanupIngredientLine(String(ingredient.item ?? ""));

  if (!item) {
    return null;
  }

  let amount =
    typeof ingredient.amount === "number"
      ? ingredient.amount
      : typeof ingredient.amount === "string"
        ? Number.parseFloat(ingredient.amount.trim())
        : null;
  let unitText = typeof ingredient.unit === "string" ? ingredient.unit.trim() : "";

  const note = extractPortableTextSummary(ingredient.notes);
  const normalizedRiceCup = normalizeRiceCup(amount, unitText, note);

  if (normalizedRiceCup) {
    amount = normalizedRiceCup.amount;
    unitText = normalizedRiceCup.unit;
  }

  const amountLabel = amount !== null ? trimNumber(amount) : "";
  const unitLabel = normalizeDisplayUnit(unitText);

  return [amountLabel, unitLabel, item].filter(Boolean).join(" ").trim();
}

function extractPortableTextSummary(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  const text = value
    .flatMap((block) => {
      if (!block || typeof block !== "object") {
        return [];
      }

      const children = (block as { children?: unknown }).children;

      if (!Array.isArray(children)) {
        return [];
      }

      return children
        .map((child) =>
          child && typeof child === "object" && typeof (child as { text?: unknown }).text === "string"
            ? (child as { text: string }).text
            : "",
        )
        .filter(Boolean);
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return cleanupIngredientLine(text);
}

function extractIngredientSectionFallback(html: string) {
  const headingMatch = html.match(
    /<h[1-6][^>]*>\s*Ingredients\s*<\/h[1-6]>([\s\S]{0,20000}?)(?:<h[1-6][^>]*>|<\/main>|<\/article>|<\/body>)/i,
  );

  if (!headingMatch?.[1]) {
    return [];
  }

  const section = headingMatch[1];
  const listItems = Array.from(
    section.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi),
    (match) => cleanupIngredientLine(cleanupHtmlText(match[1] ?? "")),
  ).filter(Boolean);

  if (listItems.length >= 3) {
    return Array.from(new Set(listItems));
  }

  return [];
}

function extractTitle(html: string) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);

  return cleanupHtmlText(match?.[1] ?? "");
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => cleanupIngredientLine(item))
    .filter(Boolean);
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

  const normalizedFractions = normalizeRecipeLine(replaceFractions(originalText));
  const amountMatch = normalizedFractions.match(
    /^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s+/,
  );

  if (!amountMatch) {
    return {
      originalText,
      name: stripPrepPrefixes(normalizeIngredientName(normalizedFractions)),
      amount: null,
      unit: "piece",
    };
  }

  const amountText = amountMatch[1];
  let amount = parseAmount(amountText);
  let remainder = normalizedFractions.slice(amountMatch[0].length).trim();
  let unit: Unit = "piece";

  for (const alias of UNIT_ALIASES) {
    const unitMatch = remainder.match(alias.pattern);

    if (!unitMatch) {
      continue;
    }

    remainder = remainder.slice(unitMatch[0].length).trim();
    unit = alias.unit;

    const riceCup = normalizeRiceCup(amount, unitMatch[0], normalizedFractions);

    if (riceCup) {
      amount = riceCup.amount;
      unit = riceCup.unit;
    }

    return {
      originalText,
      name: stripPrepPrefixes(normalizeIngredientName(remainder)),
      unit,
      amount: amount !== null ? roundValue(amount) : amount,
    };
  }

  return {
    originalText,
    name: stripPrepPrefixes(normalizeIngredientName(remainder)),
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

function normalizeRecipeLine(value: string) {
  return value
    .replace(/\(\s*Amazon\s*\)/gi, "")
    .replace(/\(\s*for [^)]+\)/gi, "")
    .replace(/\(\s*use any amount you want\s*\)/gi, "")
    .replace(/\(\s*to taste\s*\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeIngredientName(value: string) {
  return value
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bfor marinade\b/gi, " ")
    .replace(/\bfor boiling\b/gi, " ")
    .replace(/\bfor soup flavor\b/gi, " ")
    .replace(/\bAmazon\b/gi, " ")
    .replace(/\buse any amount you want\b/gi, " ")
    .replace(/\bto taste\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeRiceCup(amount: number | null, unitText: string, context: string) {
  if (amount === null) {
    return null;
  }

  const combined = `${unitText} ${context}`.toLowerCase();

  if (!/\brice cup\b/.test(combined)) {
    return null;
  }

  return {
    amount: roundValue(amount * 0.75),
    unit: "cup" as Unit,
  };
}

function normalizeDisplayUnit(unitText: string) {
  const mapped = normalizeImportedUnit(unitText);

  return mapped ?? unitText.trim().toLowerCase();
}

function consolidateParsedIngredients(ingredients: ParsedIngredient[]) {
  const merged = new Map<string, ParsedIngredient>();

  for (const ingredient of ingredients) {
    const normalizedName = normalizeIngredientName(ingredient.name);
    const key = normalizedName.toLowerCase();
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        ...ingredient,
        name: normalizedName,
      });
      continue;
    }

    const combined = mergeIngredientAmounts(existing, {
      ...ingredient,
      name: normalizedName,
    });

    if (combined) {
      merged.set(key, combined);
    } else {
      merged.set(`${key}-${ingredient.unit}-${ingredient.amount ?? "na"}`, {
        ...ingredient,
        name: normalizedName,
      });
    }
  }

  return Array.from(merged.values());
}

function mergeIngredientAmounts(left: ParsedIngredient, right: ParsedIngredient) {
  if (left.name.toLowerCase() !== right.name.toLowerCase()) {
    return null;
  }

  if (left.amount === null || right.amount === null) {
    return null;
  }

  if (left.unit === right.unit) {
    return {
      ...left,
      amount: roundValue(left.amount + right.amount),
      originalText: formatImportedIngredientLine({
        ...left,
        amount: roundValue(left.amount + right.amount),
      }),
    };
  }

  const volumeConversion = convertImportedUnits(right.amount, right.unit, left.unit);

  if (volumeConversion !== null) {
    return {
      ...left,
      amount: roundValue(left.amount + volumeConversion),
      originalText: formatImportedIngredientLine({
        ...left,
        amount: roundValue(left.amount + volumeConversion),
      }),
    };
  }

  return null;
}

function convertImportedUnits(amount: number, fromUnit: Unit, toUnit: Unit) {
  const gramsByUnit = getImportedVolumeWeightMap();
  return convertAmountBetweenUnits(amount, gramsByUnit, fromUnit, toUnit);
}

function getImportedVolumeWeightMap(): Partial<Record<Unit, number>> {
  return {
    g: 1,
    oz: 28.3495,
    lb: 453.592,
    tsp: 5,
    tbsp: 15,
    cup: 240,
    pint: 480,
    quart: 960,
  };
}

function formatImportedIngredientLine(ingredient: ParsedIngredient) {
  if (ingredient.amount === null) {
    return ingredient.name;
  }

  return `${roundAmountForImport(ingredient.amount, ingredient.unit)} ${ingredient.unit} ${ingredient.name}`;
}

function roundAmountForImport(amount: number, unit: Unit) {
  return roundAmountForInput(amount, unit);
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

function pickFrameworkImage(record: Record<string, unknown>): RecipeNode["image"] {
  const candidates = [
    record.image,
    record.heroImage,
    record.mainImage,
    record.coverImage,
    record.ogImage,
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (typeof candidate === "string" || Array.isArray(candidate)) {
      return candidate as RecipeNode["image"];
    }

    if (typeof candidate === "object") {
      const url = extractImageUrl(candidate);

      if (url) {
        return url;
      }
    }
  }

  return undefined;
}

function extractImageUrl(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.url === "string") {
    return record.url;
  }

  if (typeof record.src === "string") {
    return record.src;
  }

  if (record.asset && typeof record.asset === "object") {
    const asset = record.asset as Record<string, unknown>;

    if (typeof asset.url === "string") {
      return asset.url;
    }
  }

  return null;
}

function pickFirstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function trimNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(roundValue(value));
}

function roundValue(value: number) {
  return Math.round(value * 10) / 10;
}
