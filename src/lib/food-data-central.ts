import type {
  FoodSearchResult,
  IngredientResolution,
  MacroTotals,
  ResolvedFood,
  Unit,
} from "./types";

const API_BASE = "https://api.nal.usda.gov/fdc/v1";
const GENERIC_DATA_TYPES = ["Foundation", "SR Legacy", "Survey (FNDDS)"] as const;
const ALL_DATA_TYPES = [...GENERIC_DATA_TYPES, "Branded"] as const;
const PREPARED_DISH_TERMS = [
  "pepper steak",
  "swiss steak",
  "steak sauce",
  "steak tartare",
  "steak teriyaki",
  "salisbury steak",
  "sandwich steak",
  "with gravy",
  "stew",
  "curry",
  "stroganoff",
  "salad",
  "wellington",
  "burgundy",
  "prepared",
  "restaurant",
  "fast food",
  "frozen meal",
];
const PROTEIN_TERMS = [
  "anchovy",
  "anchovies",
  "tuna",
  "salmon",
  "sardine",
  "sardines",
  "chicken",
  "turkey",
  "pork",
  "beef",
  "lamb",
  "shrimp",
];
const QUERY_PROTEIN_HINTS = ["steak", "breast", "belly", "thigh", "fillet", "meat", "loin"];
const PANTRY_FORM_TERMS = ["flour", "powder", "mix", "dressing", "soup", "spread"];
const PREP_WORDS = [
  "chopped",
  "minced",
  "diced",
  "sliced",
  "julienned",
  "shredded",
  "grated",
  "crushed",
  "peeled",
  "trimmed",
  "rinsed",
  "drained",
  "divided",
  "softened",
  "melted",
  "room",
  "temperature",
  "beaten",
  "optional",
];
const RECIPE_NOISE_WORDS = [
  "fresh",
  "large",
  "small",
  "medium",
  "about",
  "plus",
  "more",
  "for",
  "serving",
  "to",
  "taste",
  "your",
  "choice",
  "halved",
  "roughly",
  "thinly",
  "lightly",
  "rough",
];
const UNIT_WORDS = [
  "g",
  "gram",
  "grams",
  "kg",
  "kilogram",
  "kilograms",
  "oz",
  "ounce",
  "ounces",
  "lb",
  "lbs",
  "pound",
  "pounds",
  "cup",
  "cups",
  "tbsp",
  "tablespoon",
  "tablespoons",
  "tsp",
  "teaspoon",
  "teaspoons",
  "piece",
  "pieces",
  "can",
  "cans",
  "package",
  "packages",
  "jar",
  "jars",
  "container",
  "containers",
  "clove",
  "cloves",
  "sprig",
  "sprigs",
  "bunch",
  "bunches",
];
const BRANDED_HINTS = [
  "kirkland",
  "trader joe",
  "whole foods",
  "great value",
  "signature select",
  "365",
  "oreo",
  "coca cola",
  "gatorade",
  "cheerios",
];
const emptyTotals: MacroTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

type IngredientKind = "generic" | "branded";

type NormalizedIngredient = {
  rawText: string;
  normalizedText: string;
  canonicalQuery: string;
  mainTokens: string[];
  meaningfulDescriptors: string[];
  fatDescriptor: string | null;
  cookedState: "raw" | "cooked" | null;
  dairyDescriptor: string | null;
  shelfDescriptor: "canned" | "frozen" | "dried" | null;
};

type SynonymEntry = {
  canonical: string;
  aliases: string[];
  searchExpansions?: string[];
};

type FdcSearchResponse = {
  foods?: FdcSearchFood[];
};

type FdcSearchFood = {
  fdcId: number;
  description: string;
  dataType: string;
  brandName?: string;
  brandOwner?: string;
};

type RankedCandidate = FdcSearchFood & {
  _score: number;
  _confidence: number;
  _needsReview: boolean;
  _rationale: string;
};

type FdcFoodDetail = {
  fdcId: number;
  description: string;
  dataType: string;
  brandName?: string;
  brandOwner?: string;
  foodNutrients?: Array<{
    nutrient?: {
      id?: number;
      number?: string;
      name?: string;
      unitName?: string;
    };
    amount?: number;
  }>;
  labelNutrients?: {
    calories?: { value?: number };
    protein?: { value?: number };
    carbohydrates?: { value?: number };
    fat?: { value?: number };
  };
  foodPortions?: Array<{
    amount?: number;
    gramWeight?: number;
    modifier?: string;
    measureUnit?: {
      name?: string;
      abbreviation?: string;
    };
  }>;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
};

const SYNONYM_DICTIONARY: SynonymEntry[] = [
  {
    canonical: "hanger steak",
    aliases: ["hanger steak", "hanging tender", "hanging tender steak"],
    searchExpansions: ["beef hanging tender steak", "beef flank steak raw", "beef skirt steak raw"],
  },
  {
    canonical: "skirt steak",
    aliases: ["skirt steak"],
    searchExpansions: [
      "beef plate steak inside skirt",
      "beef plate steak outside skirt",
      "beef steak",
    ],
  },
  {
    canonical: "scallions",
    aliases: ["scallion", "scallions", "green onion", "green onions"],
    searchExpansions: ["green onions"],
  },
  {
    canonical: "cilantro",
    aliases: ["cilantro"],
    searchExpansions: ["coriander leaves", "fresh coriander"],
  },
  {
    canonical: "confectioners sugar",
    aliases: ["confectioners sugar", "powdered sugar", "icing sugar"],
    searchExpansions: ["powdered sugar"],
  },
  {
    canonical: "zucchini",
    aliases: ["zucchini", "courgette"],
    searchExpansions: ["summer squash"],
  },
  {
    canonical: "bell pepper",
    aliases: ["bell pepper", "bell peppers"],
    searchExpansions: ["sweet pepper"],
  },
  {
    canonical: "olive oil",
    aliases: ["extra virgin olive oil", "olive oil", "evoo"],
    searchExpansions: ["olive oil"],
  },
  {
    canonical: "caster sugar",
    aliases: ["caster sugar", "superfine sugar"],
    searchExpansions: ["sugar"],
  },
  {
    canonical: "cornstarch",
    aliases: ["cornstarch", "corn starch"],
    searchExpansions: ["cornstarch"],
  },
  {
    canonical: "baby bella mushrooms",
    aliases: ["baby bella mushroom", "baby bella mushrooms", "cremini mushrooms"],
    searchExpansions: ["mushrooms"],
  },
  {
    canonical: "roma tomato",
    aliases: ["roma tomato", "roma tomatoes"],
    searchExpansions: ["tomato"],
  },
  {
    canonical: "greek yogurt",
    aliases: ["greek yogurt", "greek yoghurt"],
    searchExpansions: ["yogurt greek"],
  },
  {
    canonical: "white rice",
    aliases: ["white rice"],
    searchExpansions: ["rice white", "rice"],
  },
  {
    canonical: "soy sauce",
    aliases: ["soy sauce"],
    searchExpansions: ["soy sauce"],
  },
  {
    canonical: "shredded cheddar cheese",
    aliases: ["shredded cheddar cheese", "cheddar cheese shredded"],
    searchExpansions: ["cheddar cheese"],
  },
  {
    canonical: "pork belly",
    aliases: ["pork belly"],
    searchExpansions: ["pork fresh belly", "pork"],
  },
  {
    canonical: "chicken breast",
    aliases: ["chicken breast", "boneless skinless chicken breast"],
    searchExpansions: ["chicken breast"],
  },
];

function getApiKey() {
  const key = process.env.USDA_FOODDATA_API_KEY;

  if (!key) {
    throw new Error("Missing USDA_FOODDATA_API_KEY");
  }

  return key;
}

async function fdcFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = getApiKey();
  const join = path.includes("?") ? "&" : "?";
  const response = await fetch(`${API_BASE}${path}${join}api_key=${apiKey}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`FoodData Central request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export function normalizeIngredientText(rawText: string): NormalizedIngredient {
  const lower = rawText
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b\d+\s*(?:x|ct)\b/g, " ")
    .replace(/\b\d+(?:\.\d+)?(?:\/\d+)?\b/g, " ")
    .replace(/[-,/]/g, " ")
    .replace(/%/g, " percent ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const fatMatch = rawText.match(/\b(\d{2})\s*\/\s*(\d{2})\b/);
  const cookedState = /\bcooked\b/i.test(rawText)
    ? "cooked"
    : /\braw\b/i.test(rawText)
      ? "raw"
      : null;
  const dairyDescriptor = /\bnonfat\b/i.test(rawText)
    ? "nonfat"
    : /\bskim\b/i.test(rawText)
      ? "skim"
      : /\blow[\s-]?fat\b/i.test(rawText)
        ? "low-fat"
        : /\bwhole\b/i.test(rawText)
          ? "whole"
          : /\b2%\b/i.test(rawText)
            ? "2%"
            : null;
  const shelfDescriptor = /\bcanned|can\b/i.test(rawText)
    ? "canned"
    : /\bfrozen\b/i.test(rawText)
      ? "frozen"
      : /\bdried\b/i.test(rawText)
        ? "dried"
        : null;

  const filteredTokens = lower
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !UNIT_WORDS.includes(token))
    .filter((token) => !PREP_WORDS.includes(token))
    .filter((token) => !RECIPE_NOISE_WORDS.includes(token))
    .filter((token) => !["boneless", "skinless", "skin", "less"].includes(token));

  const descriptorTokens = filteredTokens.filter((token) =>
    [
      "raw",
      "cooked",
      "skim",
      "whole",
      "nonfat",
      "low",
      "fat",
      "canned",
      "frozen",
      "dried",
      "lean",
      "extra",
      "virgin",
      "white",
      "brown",
      "greek",
    ].includes(token),
  );

  let canonicalQuery = filteredTokens.join(" ").trim();

  if (fatMatch) {
    canonicalQuery = `${canonicalQuery} ${fatMatch[1]} percent lean`.trim();
  }

  const synonym = lookupSynonym(canonicalQuery);
  if (synonym) {
    canonicalQuery = synonym.canonical;
  }

  if (shelfDescriptor === "canned" && /tomato|pepper|bean|corn/.test(canonicalQuery)) {
    canonicalQuery = `${canonicalQuery} canned`.trim();
  }

  canonicalQuery = canonicalQuery
    .replace(/\bextra virgin\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    rawText,
    normalizedText: lower,
    canonicalQuery,
    mainTokens: tokenize(canonicalQuery),
    meaningfulDescriptors: descriptorTokens,
    fatDescriptor: fatMatch ? `${fatMatch[1]} percent lean` : null,
    cookedState,
    dairyDescriptor,
    shelfDescriptor,
  };
}

export function classifyIngredientType(normalizedText: string): IngredientKind {
  const lower = normalizedText.toLowerCase();
  return BRANDED_HINTS.some((hint) => lower.includes(hint)) ? "branded" : "generic";
}

export function expandSynonyms(normalizedText: string): string[] {
  const synonym = lookupSynonym(normalizedText);
  const queries = [
    normalizedText,
    synonym?.canonical,
    ...(synonym?.searchExpansions ?? []),
  ].filter(Boolean) as string[];

  if (/ground beef/.test(normalizedText) && /\d{2}\s*percent lean/.test(normalizedText)) {
    queries.push(normalizedText.replace("percent lean", "% lean"));
  }

  if (/white rice/.test(normalizedText)) {
    queries.push("rice white cooked", "rice white uncooked");
  }

  return Array.from(new Set(queries.map((query) => query.trim()).filter(Boolean)));
}

export async function searchFoodDataCentral(
  query: string,
  dataTypes: readonly string[],
  pageSize = 12,
): Promise<FdcSearchFood[]> {
  const trimmed = query.trim();

  if (trimmed.length < 2) {
    return [];
  }

  const payload = await fdcFetch<FdcSearchResponse>("/foods/search", {
    method: "POST",
    body: JSON.stringify({
      query: trimmed,
      dataType: dataTypes,
      pageSize,
      sortBy: "dataType.keyword",
      sortOrder: "asc",
    }),
  });

  return payload.foods ?? [];
}

export async function searchFoods(query: string): Promise<FoodSearchResult[]> {
  const resolution = await resolveIngredientMatch(query, { includeFoodDetails: false });
  return resolution.candidates;
}

export async function resolveFoodMatch(query: string) {
  const resolution = await resolveIngredientMatch(query);

  if (!resolution.matchedFoodId) {
    return null;
  }

  return {
    fdcId: resolution.matchedFoodId,
    description: resolution.matchedDescription ?? "",
    dataType: resolution.matchedDataType ?? "",
  };
}

export async function resolveIngredientsBatch(
  ingredientTexts: string[],
): Promise<IngredientResolution[]> {
  return Promise.all(ingredientTexts.map((ingredientText) => resolveIngredientMatch(ingredientText)));
}

export async function resolveIngredientMatch(
  rawText: string,
  options?: { includeFoodDetails?: boolean },
): Promise<IngredientResolution> {
  const normalized = normalizeIngredientText(rawText);
  const ingredientType = classifyIngredientType(normalized.canonicalQuery);
  const expandedQueries = expandSynonyms(normalized.canonicalQuery);

  const genericResults = await Promise.all(
    expandedQueries.map((query) => searchFoodDataCentral(query, GENERIC_DATA_TYPES)),
  );
  let ranked = rankCandidates(
    normalized,
    dedupeFoods(genericResults.flat()),
    ingredientType,
    expandedQueries,
  );

  if ((!ranked[0] || ranked[0]._confidence < 0.6) && ingredientType === "generic") {
    const brandedFallback = await Promise.all(
      expandedQueries.map((query) => searchFoodDataCentral(query, ALL_DATA_TYPES)),
    );
    ranked = rankCandidates(
      normalized,
      dedupeFoods(brandedFallback.flat()),
      ingredientType,
      expandedQueries,
    );
  }

  if (ingredientType === "branded" && (!ranked[0] || ranked[0]._confidence < 0.6)) {
    const allResults = await Promise.all(
      expandedQueries.map((query) => searchFoodDataCentral(query, ALL_DATA_TYPES)),
    );
    ranked = rankCandidates(
      normalized,
      dedupeFoods(allResults.flat()),
      ingredientType,
      expandedQueries,
    );
  }

  const topCandidates = ranked.slice(0, 3);
  const chosen = await hydrateBestCandidate(topCandidates, options?.includeFoodDetails ?? true);
  const confidence = chosen?.candidate._confidence ?? 0;
  const needsReview = chosen ? chosen.candidate._needsReview : true;
  const rationale = chosen?.candidate._rationale ?? "No confident USDA match yet.";

  logResolution({
    ingredientText: rawText,
    normalizedQuery: normalized.canonicalQuery,
    synonymQueries: expandedQueries,
    candidateResults: topCandidates.map((candidate) => ({
      fdcId: candidate.fdcId,
      description: candidate.description,
      dataType: candidate.dataType,
      confidence: candidate._confidence,
      needsReview: candidate._needsReview,
      score: candidate._score,
    })),
    chosen: chosen
      ? {
          fdcId: chosen.candidate.fdcId,
          description: chosen.candidate.description,
          dataType: chosen.candidate.dataType,
          confidence,
          needsReview,
        }
      : null,
  });

  return {
    ingredientText: rawText,
    normalizedQuery: normalized.canonicalQuery,
    matchedFoodId: chosen?.candidate.fdcId ?? null,
    matchedDescription: chosen?.candidate.description
      ? formatFoodLabel(chosen.candidate.description)
      : null,
    matchedDataType: chosen?.candidate.dataType ?? null,
    confidence: roundValue(confidence),
    needsReview,
    rationale,
    candidates: topCandidates.map(toSearchResult),
    food: chosen?.food ?? null,
  };
}

function rankCandidates(
  ingredient: NormalizedIngredient,
  foods: FdcSearchFood[],
  ingredientType: IngredientKind,
  expandedQueries: string[],
): RankedCandidate[] {
  const ingredientTokens = ingredient.mainTokens.map(normalizeTokenForCompare);
  const expandedTokenSets = expandedQueries.map((query) =>
    tokenize(query).map(normalizeTokenForCompare),
  );

  return foods
    .filter((food) => food.fdcId && food.description)
    .map((food) => {
      const description = food.description.toLowerCase();
      const queryText = ingredient.canonicalQuery.toLowerCase();
      const descriptionTokens = tokenize(description);
      const comparableDescriptionTokens = descriptionTokens.map(normalizeTokenForCompare);
      const overlap = ingredientTokens.filter((token) =>
        comparableDescriptionTokens.includes(token),
      );
      const extraWords = descriptionTokens.filter(
        (token) =>
          !ingredientTokens.includes(normalizeTokenForCompare(token)) && !token.match(/^\d+$/),
      );
      const typePreference =
        food.dataType === "Foundation"
          ? 32
          : food.dataType === "SR Legacy"
            ? 26
            : food.dataType === "Survey (FNDDS)"
              ? 16
              : ingredientType === "generic"
                ? -12
                : 8;

      let score = typePreference;

      if (description === ingredient.canonicalQuery) score += 80;
      if (description.includes(ingredient.canonicalQuery)) score += 38;

      const bestExpandedMatch = expandedTokenSets.some((tokens) =>
        tokens.every((token) => comparableDescriptionTokens.includes(token)),
      );
      if (bestExpandedMatch) score += 28;

      score += overlap.length * 14;

      if (ingredientTokens.length > 0) {
        score += (overlap.length / ingredientTokens.length) * 30;
      }

      if (
        ingredient.fatDescriptor &&
        (description.includes(ingredient.fatDescriptor) ||
          description.includes(ingredient.fatDescriptor.replace(" percent lean", "% lean")))
      ) {
        score += 25;
      }

      if (ingredient.cookedState && description.includes(ingredient.cookedState)) {
        score += 12;
      }

      if (ingredient.dairyDescriptor && description.includes(ingredient.dairyDescriptor)) {
        score += 12;
      }

      if (ingredient.shelfDescriptor && description.includes(ingredient.shelfDescriptor)) {
        score += 10;
      }

      if (ingredientType === "generic" && food.brandName) {
        score -= 14;
      }

      if (PREPARED_DISH_TERMS.some((term) => description.includes(term))) {
        score -= 65;
      }

      if (
        PROTEIN_TERMS.some((term) => description.includes(term)) &&
        !PROTEIN_TERMS.some((term) => queryText.includes(term)) &&
        !QUERY_PROTEIN_HINTS.some((term) => queryText.includes(term))
      ) {
        score -= 70;
      }

      if (
        PANTRY_FORM_TERMS.some((term) => description.includes(term)) &&
        !PANTRY_FORM_TERMS.some((term) => queryText.includes(term))
      ) {
        score -= 22;
      }

      score -= Math.min(extraWords.length, 6) * 2.5;

      const confidence = scoreToConfidence(score, overlap.length, ingredientTokens.length);
      const needsReview = confidence < 0.44;

      return {
        ...food,
        _score: score,
        _confidence: confidence,
        _needsReview: needsReview,
        _rationale: buildRationale(food, confidence, needsReview),
      };
    })
    .sort((left, right) => right._score - left._score);
}

function scoreToConfidence(score: number, overlapCount: number, tokenCount: number) {
  let confidence = 0.18;

  if (score >= 115) confidence = 0.92;
  else if (score >= 95) confidence = 0.82;
  else if (score >= 75) confidence = 0.7;
  else if (score >= 55) confidence = 0.58;
  else if (score >= 38) confidence = 0.44;
  else confidence = 0.28;

  if (tokenCount > 0 && overlapCount === tokenCount) {
    confidence += 0.05;
  }

  return Math.min(0.99, roundValue(confidence));
}

function buildRationale(food: FdcSearchFood, confidence: number, needsReview: boolean) {
  const genericLabel = food.brandName ? "branded USDA result" : "generic USDA result";

  if (!needsReview && confidence >= 0.72) {
    return `Matched automatically using ${genericLabel}.`;
  }

  if (!needsReview) {
    return `Using ${genericLabel}; you can edit the match if you want something closer.`;
  }

  return `Closest ${genericLabel} so far. Review is optional if you want a tighter match.`;
}

async function hydrateBestCandidate(
  candidates: RankedCandidate[],
  includeFoodDetails: boolean,
): Promise<{ candidate: RankedCandidate; food: ResolvedFood | null } | null> {
  for (const candidate of candidates) {
    let food: ResolvedFood | null = null;

    if (includeFoodDetails) {
      try {
        food = await getFoodDetails(candidate.fdcId);
      } catch {
        food = null;
      }
    }

    if (includeFoodDetails && !food) {
      continue;
    }

    return { candidate, food };
  }

  return null;
}

function dedupeFoods(foods: FdcSearchFood[]) {
  const seen = new Map<number, FdcSearchFood>();

  for (const food of foods) {
    if (!seen.has(food.fdcId)) {
      seen.set(food.fdcId, food);
    }
  }

  return Array.from(seen.values());
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9%\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeTokenForCompare(token: string) {
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.endsWith("oes") && token.length > 4) {
    return token.slice(0, -2);
  }

  if (token.endsWith("es") && token.length > 4) {
    return token.slice(0, -2);
  }

  if (token.endsWith("s") && token.length > 3) {
    return token.slice(0, -1);
  }

  return token;
}

function lookupSynonym(value: string) {
  const normalized = value.trim().toLowerCase();

  return SYNONYM_DICTIONARY.find((entry) =>
    entry.aliases.some((alias) => normalized.includes(alias.toLowerCase())),
  );
}

function toSearchResult(candidate: RankedCandidate): FoodSearchResult {
  const cleanDescription = formatFoodLabel(candidate.description);
  const brand = candidate.brandName?.trim();

  return {
    fdcId: candidate.fdcId,
    description: cleanDescription,
    displayName: brand ? `${cleanDescription} (${brand})` : cleanDescription,
    dataType: candidate.dataType,
    brandName: brand ?? null,
    subtitle: brand ? `${candidate.dataType} - ${brand}` : candidate.dataType,
    confidence: candidate._confidence,
    needsReview: candidate._needsReview,
    rationale: candidate._rationale,
  };
}

function logResolution(payload: {
  ingredientText: string;
  normalizedQuery: string;
  synonymQueries: string[];
  candidateResults: Array<{
    fdcId: number;
    description: string;
    dataType: string;
    confidence: number;
    needsReview: boolean;
    score: number;
  }>;
  chosen: {
    fdcId: number;
    description: string;
    dataType: string;
    confidence: number;
    needsReview: boolean;
  } | null;
}) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.debug("[ingredient-resolver]", JSON.stringify(payload));
}

export async function getFoodDetails(fdcId: number): Promise<ResolvedFood | null> {
  const detail = await fdcFetch<FdcFoodDetail>(`/food/${fdcId}`);
  const per100g = extractPer100g(detail);

  if (!per100g) {
    return null;
  }

  return {
    fdcId: detail.fdcId,
    description: formatFoodLabel(detail.description),
    displayName: detail.brandName?.trim()
      ? `${formatFoodLabel(detail.description)} (${detail.brandName.trim()})`
      : formatFoodLabel(detail.description),
    dataType: detail.dataType,
    brandName: detail.brandName?.trim() || null,
    sourceLabel: detail.brandName?.trim()
      ? `USDA ${detail.dataType} - ${detail.brandName.trim()}`
      : `USDA ${detail.dataType}`,
    servingText: detail.householdServingFullText?.trim() || null,
    per100g,
    gramsByUnit: extractUnitWeights(detail),
  };
}

function extractPer100g(detail: FdcFoodDetail): MacroTotals | null {
  const direct = extractMacrosFromFoodNutrients(detail.foodNutrients);
  const branded = detail.dataType === "Branded";

  if (branded) {
    if (
      detail.servingSize &&
      detail.servingSize > 0 &&
      detail.servingSizeUnit?.toLowerCase() === "g"
    ) {
      const servingMacros = direct ?? extractMacrosFromLabel(detail.labelNutrients);

      if (!servingMacros) {
        return null;
      }

      const scale = 100 / detail.servingSize;

      return roundTotals({
        calories: servingMacros.calories * scale,
        protein: servingMacros.protein * scale,
        carbs: servingMacros.carbs * scale,
        fat: servingMacros.fat * scale,
      });
    }

    return null;
  }

  return direct ? roundTotals(direct) : null;
}

function extractMacrosFromFoodNutrients(
  nutrients: FdcFoodDetail["foodNutrients"],
): MacroTotals | null {
  if (!nutrients?.length) {
    return null;
  }

  const totals = { ...emptyTotals };

  for (const nutrient of nutrients) {
    const nutrientId = nutrient.nutrient?.id;
    const amount = nutrient.amount ?? 0;

    if (nutrientId === 1008) totals.calories = amount;
    if (nutrientId === 1003) totals.protein = amount;
    if (nutrientId === 1005) totals.carbs = amount;
    if (nutrientId === 1004 || nutrientId === 1085) totals.fat = amount;
  }

  if (!totals.calories && (totals.protein || totals.carbs || totals.fat)) {
    totals.calories = totals.protein * 4 + totals.carbs * 4 + totals.fat * 9;
  }

  if (!totals.calories && !totals.protein && !totals.carbs && !totals.fat) {
    return null;
  }

  return totals;
}

function extractMacrosFromLabel(label: FdcFoodDetail["labelNutrients"]): MacroTotals | null {
  if (!label) {
    return null;
  }

  const totals = {
    calories: label.calories?.value ?? 0,
    protein: label.protein?.value ?? 0,
    carbs: label.carbohydrates?.value ?? 0,
    fat: label.fat?.value ?? 0,
  };

  if (!totals.calories && (totals.protein || totals.carbs || totals.fat)) {
    totals.calories = totals.protein * 4 + totals.carbs * 4 + totals.fat * 9;
  }

  if (!totals.calories && !totals.protein && !totals.carbs && !totals.fat) {
    return null;
  }

  return totals;
}

function extractUnitWeights(detail: FdcFoodDetail): Partial<Record<Unit, number>> {
  const gramsByUnit: Partial<Record<Unit, number>> = { g: 1 };

  for (const portion of detail.foodPortions ?? []) {
    const amount = portion.amount && portion.amount > 0 ? portion.amount : 1;
    const gramWeight = portion.gramWeight ?? 0;

    if (!gramWeight) {
      continue;
    }

    const label = `${portion.modifier ?? ""} ${portion.measureUnit?.name ?? ""} ${
      portion.measureUnit?.abbreviation ?? ""
    }`.toLowerCase();
    const mappedUnit = mapUnitLabel(label);

    if (mappedUnit && !gramsByUnit[mappedUnit]) {
      gramsByUnit[mappedUnit] = gramWeight / amount;
    }
  }

  if (
    detail.servingSize &&
    detail.servingSize > 0 &&
    detail.servingSizeUnit?.toLowerCase() === "g" &&
    detail.householdServingFullText
  ) {
    const householdUnit = mapUnitLabel(detail.householdServingFullText.toLowerCase());
    const parsedAmount = parseLeadingAmount(detail.householdServingFullText);

    if (householdUnit && !gramsByUnit[householdUnit]) {
      gramsByUnit[householdUnit] = detail.servingSize / parsedAmount;
    }
  }

  return gramsByUnit;
}

function mapUnitLabel(label: string): Unit | null {
  if (/\bcups?\b/.test(label)) return "cup";
  if (/\b(tbsp|tablespoon|tablespoons)\b/.test(label)) return "tbsp";
  if (/\b(tsp|teaspoon|teaspoons)\b/.test(label)) return "tsp";
  if (/\b(piece|pieces|breast|egg|eggs|patty|patties|link|links|fillet|fillets|steak)\b/.test(label)) {
    return "piece";
  }

  return null;
}

function parseLeadingAmount(value: string) {
  const match = value.trim().match(/^(\d+(\.\d+)?)/);

  if (!match) {
    return 1;
  }

  return Number.parseFloat(match[1]) || 1;
}

function formatFoodLabel(value: string) {
  const lower = value.toLowerCase();

  return lower.replace(/\b\w/g, (character) => character.toUpperCase());
}

function roundValue(value: number) {
  return Math.round(value * 100) / 100;
}

function roundTotals(totals: MacroTotals): MacroTotals {
  return {
    calories: Math.round(totals.calories),
    protein: Math.round(totals.protein * 10) / 10,
    carbs: Math.round(totals.carbs * 10) / 10,
    fat: Math.round(totals.fat * 10) / 10,
  };
}
