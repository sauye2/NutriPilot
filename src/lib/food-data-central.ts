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
const BAD_PACKAGED_TERMS = [
  "cracker",
  "crackers",
  "cake",
  "cakes",
  "snack",
  "snacks",
  "marinade",
  "dip",
  "seasoning mix",
  "instant",
  "meal kit",
];
const SPECIAL_FORM_PENALTIES: Array<{ query: RegExp; forbidden: RegExp }> = [
  { query: /\brice\b/, forbidden: /\bcracker|crackers|cake|cakes|sushi\b/ },
  { query: /\begg|eggs\b/, forbidden: /\byolk|white|whites|dried\b/ },
  { query: /\bblack pepper\b/, forbidden: /\bcracker|seasoning blend|marinade\b/ },
  { query: /\bgochugaru\b/, forbidden: /\bseasoning blend|sauce|marinade\b/ },
  { query: /\bsesame oil\b/, forbidden: /\bdressing|blend\b/ },
  { query: /\brice vinegar\b/, forbidden: /\bdressing|seasoned\b/ },
];
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

type PreferredGenericProfile = {
  canonicalQuery: string;
  food: ResolvedFood;
  confidence: number;
  rationale: string;
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
    canonical: "yellow onion",
    aliases: ["yellow onion", "yellow onions", "onion", "onions"],
    searchExpansions: ["onions yellow raw", "onions raw"],
  },
  {
    canonical: "avocado",
    aliases: ["avocado", "avocados"],
    searchExpansions: ["avocados raw", "avocado raw"],
  },
  {
    canonical: "olive oil",
    aliases: ["extra virgin olive oil", "olive oil", "evoo"],
    searchExpansions: ["olive oil"],
  },
  {
    canonical: "neutral oil",
    aliases: ["neutral oil", "vegetable oil", "canola oil", "avocado oil", "grapeseed oil"],
    searchExpansions: ["vegetable oil", "oil vegetable", "canola oil"],
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
    searchExpansions: ["rice white", "rice", "rice white long-grain regular cooked"],
  },
  {
    canonical: "soy sauce",
    aliases: ["soy sauce"],
    searchExpansions: ["soy sauce"],
  },
  {
    canonical: "rice vinegar",
    aliases: ["rice vinegar", "rice wine vinegar"],
    searchExpansions: ["vinegar rice", "vinegar rice wine"],
  },
  {
    canonical: "lemon juice",
    aliases: ["lemon juice", "fresh lemon juice", "juice of lemon", "juice from lemon"],
    searchExpansions: ["lemon juice raw", "juice lemon"],
  },
  {
    canonical: "lime juice",
    aliases: ["lime juice", "fresh lime juice", "juice of lime", "juice from lime"],
    searchExpansions: ["lime juice raw", "juice lime"],
  },
  {
    canonical: "sesame oil",
    aliases: ["sesame oil", "toasted sesame oil"],
    searchExpansions: ["oil sesame", "sesame seed oil"],
  },
  {
    canonical: "black pepper",
    aliases: ["black pepper", "ground black pepper"],
    searchExpansions: ["spices pepper black", "pepper black"],
  },
  {
    canonical: "ground cumin",
    aliases: ["ground cumin", "cumin"],
    searchExpansions: ["spices cumin seed", "cumin seed"],
  },
  {
    canonical: "chili powder",
    aliases: ["chili powder"],
    searchExpansions: ["spices chili powder"],
  },
  {
    canonical: "scotch bonnet pepper",
    aliases: ["scotch bonnet", "scotch bonnet pepper", "scotch bonnet peppers"],
    searchExpansions: ["peppers hot raw", "hot pepper raw", "jalapeno pepper raw"],
  },
  {
    canonical: "gochugaru",
    aliases: ["gochugaru", "korean chili flakes", "korean chile flakes"],
    searchExpansions: ["pepper red or cayenne", "chili flakes", "red pepper flakes"],
  },
  {
    canonical: "gochujang",
    aliases: ["gochujang", "korean chili paste"],
    searchExpansions: ["chili paste", "pepper paste"],
  },
  {
    canonical: "egg",
    aliases: ["egg", "eggs"],
    searchExpansions: ["egg whole raw", "eggs whole raw"],
  },
  {
    canonical: "shredded cheddar cheese",
    aliases: ["shredded cheddar cheese", "cheddar cheese shredded"],
    searchExpansions: ["cheddar cheese"],
  },
  {
    canonical: "pork belly",
    aliases: ["pork belly"],
    searchExpansions: ["pork belly cooked", "pork fresh belly", "pork"],
  },
  {
    canonical: "chicken breast",
    aliases: ["chicken breast", "boneless skinless chicken breast"],
    searchExpansions: ["chicken breast roasted", "chicken breast cooked", "chicken breast"],
  },
  {
    canonical: "sirloin steak",
    aliases: ["sirloin steak", "top sirloin steak"],
    searchExpansions: ["beef top sirloin cooked", "beef sirloin steak cooked"],
  },
  {
    canonical: "steak",
    aliases: ["steak", "beef steak"],
    searchExpansions: ["beef steak cooked", "beef sirloin steak cooked"],
  },
];

const PREFERRED_GENERIC_PROFILES: PreferredGenericProfile[] = [
  {
    canonicalQuery: "black pepper",
    confidence: 0.95,
    rationale: "Matched automatically using a preferred USDA generic pantry entry.",
    food: {
      fdcId: 170931,
      description: "Spices, Pepper, Black",
      displayName: "Spices, Pepper, Black",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 251, protein: 10.4, carbs: 64, fat: 3.26 },
      gramsByUnit: { g: 1, tbsp: 6.8, tsp: 2.3 },
    },
  },
  {
    canonicalQuery: "ground cumin",
    confidence: 0.95,
    rationale: "Matched automatically using a preferred USDA spice entry.",
    food: {
      fdcId: 170923,
      description: "Spices, Cumin Seed",
      displayName: "Spices, Cumin Seed",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 375, protein: 17.8, carbs: 44.2, fat: 22.3 },
      gramsByUnit: { g: 1, tbsp: 6, tsp: 2 },
    },
  },
  {
    canonicalQuery: "chili powder",
    confidence: 0.95,
    rationale: "Matched automatically using a preferred USDA spice entry.",
    food: {
      fdcId: 171319,
      description: "Spices, Chili Powder",
      displayName: "Spices, Chili Powder",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 282, protein: 13.5, carbs: 49.7, fat: 14.3 },
      gramsByUnit: { g: 1, tbsp: 8, tsp: 2.7 },
    },
  },
  {
    canonicalQuery: "gochugaru",
    confidence: 0.92,
    rationale: "Matched automatically using a preferred USDA generic red pepper equivalent.",
    food: {
      fdcId: 170932,
      description: "Spices, Pepper, Red Or Cayenne",
      displayName: "Spices, Pepper, Red Or Cayenne",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 318, protein: 12, carbs: 56.6, fat: 17.3 },
      gramsByUnit: { g: 1, tbsp: 6.8, tsp: 2.3 },
    },
  },
  {
    canonicalQuery: "sesame oil",
    confidence: 0.97,
    rationale: "Matched automatically using a preferred USDA generic pantry entry.",
    food: {
      fdcId: 171016,
      description: "Oil, Sesame, Salad Or Cooking",
      displayName: "Oil, Sesame, Salad Or Cooking",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 884, protein: 0, carbs: 0, fat: 100 },
      gramsByUnit: { g: 1, tbsp: 13.6, tsp: 4.5 },
    },
  },
  {
    canonicalQuery: "neutral oil",
    confidence: 0.97,
    rationale: "Matched automatically using a preferred USDA generic pantry entry.",
    food: {
      fdcId: 171413,
      description: "Oil, Vegetable, Soybean, Salad Or Cooking",
      displayName: "Oil, Vegetable, Soybean, Salad Or Cooking",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 884, protein: 0, carbs: 0, fat: 100 },
      gramsByUnit: { g: 1, tbsp: 13.6, tsp: 4.5 },
    },
  },
  {
    canonicalQuery: "yellow onion",
    confidence: 0.95,
    rationale: "Matched automatically using a preferred USDA produce entry.",
    food: {
      fdcId: 790646,
      description: "Onions, Yellow, Raw",
      displayName: "Onions, Yellow, Raw",
      dataType: "Foundation",
      brandName: null,
      sourceLabel: "USDA Foundation",
      servingText: null,
      per100g: { calories: 37, protein: 0.77, carbs: 8.61, fat: 0.09 },
      gramsByUnit: { g: 1, piece: 110, cup: 160 },
    },
  },
  {
    canonicalQuery: "bell pepper",
    confidence: 0.95,
    rationale: "Matched automatically using a preferred USDA produce entry.",
    food: {
      fdcId: 2258588,
      description: "Peppers, Bell, Green, Raw",
      displayName: "Bell Pepper, Raw",
      dataType: "Foundation",
      brandName: null,
      sourceLabel: "USDA Foundation",
      servingText: null,
      per100g: { calories: 20, protein: 0.86, carbs: 4.64, fat: 0.17 },
      gramsByUnit: { g: 1, piece: 119, cup: 92 },
    },
  },
  {
    canonicalQuery: "avocado",
    confidence: 0.95,
    rationale: "Matched automatically using a preferred USDA produce entry.",
    food: {
      fdcId: 171706,
      description: "Avocados, Raw, California",
      displayName: "Avocado, Raw",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 167, protein: 2, carbs: 8.6, fat: 15.4 },
      gramsByUnit: { g: 1, piece: 150, cup: 150 },
    },
  },
  {
    canonicalQuery: "cornstarch",
    confidence: 0.95,
    rationale: "Matched automatically using a preferred USDA generic pantry entry.",
    food: {
      fdcId: 168811,
      description: "Cornstarch",
      displayName: "Cornstarch",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 381, protein: 0.3, carbs: 91.3, fat: 0.1 },
      gramsByUnit: { g: 1, tbsp: 8, tsp: 2.7 },
    },
  },
  {
    canonicalQuery: "rice vinegar",
    confidence: 0.93,
    rationale: "Matched automatically using a preferred USDA pantry entry.",
    food: {
      fdcId: 171265,
      description: "Vinegar, Distilled",
      displayName: "Vinegar, Distilled",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 18, protein: 0, carbs: 0, fat: 0 },
      gramsByUnit: { g: 1, tbsp: 15, tsp: 5 },
    },
  },
  {
    canonicalQuery: "lemon juice",
    confidence: 0.94,
    rationale: "Matched automatically using a preferred USDA pantry entry.",
    food: {
      fdcId: 167747,
      description: "Lemon Juice, Raw",
      displayName: "Lemon Juice, Raw",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 22, protein: 0.4, carbs: 6.9, fat: 0.2 },
      gramsByUnit: { g: 1, tbsp: 15, tsp: 5, piece: 48 },
    },
  },
  {
    canonicalQuery: "lime juice",
    confidence: 0.94,
    rationale: "Matched automatically using a preferred USDA pantry entry.",
    food: {
      fdcId: 168156,
      description: "Lime Juice, Raw",
      displayName: "Lime Juice, Raw",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 25, protein: 0.4, carbs: 8.4, fat: 0.1 },
      gramsByUnit: { g: 1, tbsp: 15, tsp: 5, piece: 44 },
    },
  },
  {
    canonicalQuery: "soy sauce",
    confidence: 0.95,
    rationale: "Matched automatically using a preferred USDA pantry entry.",
    food: {
      fdcId: 172231,
      description: "Sauce, Soy Sauce Made From Soy And Wheat (Shoyu), Low Sodium",
      displayName: "Sauce, Soy Sauce, Low Sodium",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 53, protein: 8.1, carbs: 4.9, fat: 0.6 },
      gramsByUnit: { g: 1, tbsp: 16, tsp: 5.3 },
    },
  },
  {
    canonicalQuery: "oyster sauce",
    confidence: 0.93,
    rationale: "Matched automatically using a preferred USDA pantry entry.",
    food: {
      fdcId: 174279,
      description: "Sauce, Oyster, Ready-To-Serve",
      displayName: "Sauce, Oyster",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 51, protein: 1.4, carbs: 10, fat: 0.1 },
      gramsByUnit: { g: 1, tbsp: 18, tsp: 6 },
    },
  },
  {
    canonicalQuery: "egg",
    confidence: 0.96,
    rationale: "Matched automatically using a preferred USDA generic pantry entry.",
    food: {
      fdcId: 171287,
      description: "Egg, Whole, Raw, Fresh",
      displayName: "Egg, Whole, Raw, Fresh",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 143, protein: 12.6, carbs: 0.72, fat: 9.51 },
      gramsByUnit: { g: 1, piece: 50 },
    },
  },
  {
    canonicalQuery: "white rice cooked",
    confidence: 0.96,
    rationale: "Matched automatically using a preferred USDA generic pantry entry.",
    food: {
      fdcId: 168878,
      description: "Rice, White, Long-Grain, Regular, Enriched, Cooked",
      displayName: "Rice, White, Long-Grain, Regular, Enriched, Cooked",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 130, protein: 2.69, carbs: 28.2, fat: 0.28 },
      gramsByUnit: { g: 1, cup: 158 },
    },
  },
  {
    canonicalQuery: "sirloin steak cooked",
    confidence: 0.96,
    rationale: "Matched automatically using a preferred USDA cooked beef entry.",
    food: {
      fdcId: 2342376,
      description: "Beef, Top Sirloin, Cooked",
      displayName: "Beef, Top Sirloin, Cooked",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 206, protein: 28.6, carbs: 0, fat: 10.6 },
      gramsByUnit: { g: 1, piece: 170 },
    },
  },
  {
    canonicalQuery: "steak cooked",
    confidence: 0.94,
    rationale: "Matched automatically using a preferred USDA cooked beef entry.",
    food: {
      fdcId: 2342376,
      description: "Beef, Top Sirloin, Cooked",
      displayName: "Beef, Top Sirloin, Cooked",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 206, protein: 28.6, carbs: 0, fat: 10.6 },
      gramsByUnit: { g: 1, piece: 170 },
    },
  },
  {
    canonicalQuery: "scotch bonnet pepper",
    confidence: 0.9,
    rationale: "Matched automatically using a preferred USDA hot pepper equivalent.",
    food: {
      fdcId: 2709798,
      description: "Peppers, Hot, Raw",
      displayName: "Peppers, Hot, Raw",
      dataType: "Survey (FNDDS)",
      brandName: null,
      sourceLabel: "USDA Survey (FNDDS)",
      servingText: null,
      per100g: { calories: 40, protein: 2, carbs: 9.5, fat: 0.2 },
      gramsByUnit: { g: 1, piece: 14 },
    },
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
    queries.push("rice white cooked", "rice white uncooked", "rice white long grain cooked");
  }

  if (/rice/.test(normalizedText)) {
    const baseRiceQuery = normalizedText.replace(/\bcooked\b|\braw\b/g, "").trim();
    queries.push(`rice ${baseRiceQuery}`.trim(), `${baseRiceQuery} rice`.trim());

    if (/\bcooked\b/.test(normalizedText)) {
      queries.push("rice cooked", `${baseRiceQuery} cooked rice`.trim(), "rice short grain cooked");
    }

    if (/\braw\b/.test(normalizedText)) {
      queries.push("rice raw", `${baseRiceQuery} raw rice`.trim());
    }
  }

  if (/\begg\b/.test(normalizedText) && !/\bwhite\b|\byolk\b|\bdried\b/.test(normalizedText)) {
    queries.push("egg whole raw", "eggs whole raw");
  }

  if (/black pepper/.test(normalizedText)) {
    queries.push("spices pepper black", "pepper black");
  }

  if (/ground cumin|cumin/.test(normalizedText)) {
    queries.push("spices cumin seed", "cumin seed");
  }

  if (/chili powder/.test(normalizedText)) {
    queries.push("spices chili powder");
  }

  if (/scotch bonnet/.test(normalizedText)) {
    queries.push("peppers hot raw", "hot pepper raw", "jalapeno pepper raw");
  }

  if (/gochugaru/.test(normalizedText)) {
    queries.push("pepper red or cayenne", "red pepper flakes", "chili flakes");
  }

  if (/sesame oil/.test(normalizedText)) {
    queries.push("oil sesame", "sesame seed oil");
  }

  if (/neutral oil/.test(normalizedText)) {
    queries.push("vegetable oil", "oil vegetable", "canola oil");
  }

  if (/rice vinegar/.test(normalizedText)) {
    queries.push("vinegar rice", "vinegar rice wine");
  }

  if (/lemon juice/.test(normalizedText)) {
    queries.push("lemon juice raw", "juice lemon");
  }

  if (/lime juice/.test(normalizedText)) {
    queries.push("lime juice raw", "juice lime");
  }

  if (/yellow onion|onion/.test(normalizedText)) {
    queries.push("onions yellow raw", "onions raw");
  }

  if (/bell pepper/.test(normalizedText)) {
    queries.push("bell pepper raw", "sweet pepper");
  }

  if (/avocado/.test(normalizedText)) {
    queries.push("avocados raw", "avocado raw");
  }

  if (/cornstarch/.test(normalizedText)) {
    queries.push("cornstarch", "corn starch");
  }

  if (/sirloin steak/.test(normalizedText)) {
    queries.push("beef top sirloin cooked", "beef sirloin steak cooked");
  }

  if (/chicken breast/.test(normalizedText) && !/\braw\b/.test(normalizedText)) {
    queries.push("chicken breast roasted", "chicken breast cooked");
  }

  if (/ground beef/.test(normalizedText) && /\bcooked\b/.test(normalizedText)) {
    queries.push("ground beef cooked");
  }

  if (/\bsteak\b/.test(normalizedText) && !/\braw\b/.test(normalizedText)) {
    queries.push("beef steak cooked", "beef sirloin steak cooked");
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

export async function searchFoods(
  query: string,
  options?: { preferCooked?: boolean },
): Promise<FoodSearchResult[]> {
  const resolution = await resolveIngredientMatch(query, {
    includeFoodDetails: false,
    preferCooked: options?.preferCooked,
  });
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
  options?: { includeFoodDetails?: boolean; preferCooked?: boolean },
): Promise<IngredientResolution> {
  const normalized = normalizeIngredientText(rawText);
  const preferCooked = Boolean(options?.preferCooked && !normalized.cookedState);
  const preferred = getPreferredGenericProfile(normalized.canonicalQuery, rawText);

  if (preferred) {
    const candidate = preferredProfileToCandidate(preferred);
    const chosen = {
      candidate,
      food: options?.includeFoodDetails === false ? null : preferred.food,
    };

    return {
      ingredientText: rawText,
      normalizedQuery: normalized.canonicalQuery,
      matchedFoodId: preferred.food.fdcId,
      matchedDescription: preferred.food.description,
      matchedDataType: preferred.food.dataType,
      confidence: roundValue(preferred.confidence),
      needsReview: false,
      rationale: preferred.rationale,
      candidates: [toSearchResult(candidate)],
      food: chosen.food,
    };
  }

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
    preferCooked,
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
      preferCooked,
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
      preferCooked,
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

function getPreferredGenericProfile(
  canonicalQuery: string,
  rawText: string,
): PreferredGenericProfile | null {
  const query = canonicalQuery.toLowerCase().trim();
  const raw = rawText.toLowerCase();

  if (/\bwhite rice\b/.test(query) || /\brice,?\s*cooked\b/.test(raw) || /\bcooked rice\b/.test(raw)) {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "white rice cooked") ?? null;
  }

  if (/\beggs?\b/.test(raw) || query === "egg") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "egg") ?? null;
  }

  if (query === "neutral oil") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "neutral oil") ?? null;
  }

  if (query === "yellow onion" || query === "onion") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "yellow onion") ?? null;
  }

  if (query === "bell pepper") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "bell pepper") ?? null;
  }

  if (query === "avocado") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "avocado") ?? null;
  }

  if (query === "cornstarch") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "cornstarch") ?? null;
  }

  if (query === "rice vinegar") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "rice vinegar") ?? null;
  }

  if (query === "lemon juice") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "lemon juice") ?? null;
  }

  if (query === "lime juice") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "lime juice") ?? null;
  }

  if (query === "soy sauce") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "soy sauce") ?? null;
  }

  if (query === "oyster sauce") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "oyster sauce") ?? null;
  }

  if (query === "ground cumin" || query === "cumin") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "ground cumin") ?? null;
  }

  if (query === "chili powder") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "chili powder") ?? null;
  }

  if (query === "scotch bonnet pepper" || query === "scotch bonnet") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "scotch bonnet pepper") ?? null;
  }

  if (/\bsirloin steak\b/.test(query) || /\bsirloin steak\b/.test(raw)) {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "sirloin steak cooked") ?? null;
  }

  if ((/\bsteak\b/.test(query) || /\bsteak\b/.test(raw)) && !/\braw\b/.test(raw)) {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "steak cooked") ?? null;
  }

  return (
    PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === query) ?? null
  );
}

function preferredProfileToCandidate(profile: PreferredGenericProfile): RankedCandidate {
  return {
    fdcId: profile.food.fdcId,
    description: profile.food.description,
    dataType: profile.food.dataType,
    brandName: undefined,
    brandOwner: undefined,
    _score: 999,
    _confidence: profile.confidence,
    _needsReview: false,
    _rationale: profile.rationale,
  };
}

function rankCandidates(
  ingredient: NormalizedIngredient,
  foods: FdcSearchFood[],
  ingredientType: IngredientKind,
  expandedQueries: string[],
  preferCooked = false,
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

      if (preferCooked && !ingredient.cookedState) {
        if (description.includes("cooked")) score += 16;
        if (description.includes("raw")) score -= 18;
      }

      if (ingredient.cookedState === "cooked" && description.includes("raw")) {
        score -= 20;
      }

      if (ingredient.cookedState === "raw" && description.includes("cooked")) {
        score -= 20;
      }

      if (ingredient.dairyDescriptor && description.includes(ingredient.dairyDescriptor)) {
        score += 12;
      }

      if (ingredient.shelfDescriptor && description.includes(ingredient.shelfDescriptor)) {
        score += 10;
      }

      if (!ingredient.shelfDescriptor && description.includes("dried")) {
        score -= 40;
      }

      if (!queryText.includes("sushi") && description.includes("sushi")) {
        score -= 18;
      }

      if (ingredientType === "generic" && food.brandName) {
        score -= 28;
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

      if (
        BAD_PACKAGED_TERMS.some((term) => description.includes(term)) &&
        !BAD_PACKAGED_TERMS.some((term) => queryText.includes(term))
      ) {
        score -= 42;
      }

      for (const penalty of SPECIAL_FORM_PENALTIES) {
        if (penalty.query.test(queryText) && penalty.forbidden.test(description)) {
          score -= 44;
        }
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

  const heuristicUnits = getHeuristicUnitWeights(detail.description.toLowerCase());

  for (const [unit, grams] of Object.entries(heuristicUnits) as Array<[Unit, number]>) {
    if (!gramsByUnit[unit]) {
      gramsByUnit[unit] = grams;
    }
  }

  return gramsByUnit;
}

function mapUnitLabel(label: string): Unit | null {
  if (/\bcups?\b/.test(label)) return "cup";
  if (/\b(tbsp|tablespoon|tablespoons)\b/.test(label)) return "tbsp";
  if (/\b(tsp|teaspoon|teaspoons)\b/.test(label)) return "tsp";
  if (/\b(piece|pieces|breast|egg|eggs|patty|patties|link|links|fillet|fillets|steak|leaf|leaves|clove|cloves|stalk|stalks|cucumber|scallion|scallions)\b/.test(label)) {
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

function getHeuristicUnitWeights(description: string): Partial<Record<Unit, number>> {
  if (/olive oil|sesame oil|vegetable oil|canola oil|oil,/.test(description)) {
    return { tbsp: 13.5, tsp: 4.5 };
  }

  if (/cornstarch|corn starch/.test(description)) {
    return { tbsp: 8, tsp: 2.7 };
  }

  if (/vinegar/.test(description)) {
    return { tbsp: 15, tsp: 5 };
  }

  if (/lemon juice|lime juice/.test(description)) {
    return { tbsp: 15, tsp: 5 };
  }

  if (/soy sauce/.test(description)) {
    return { tbsp: 16, tsp: 5.3 };
  }

  if (/pepper, black|black pepper|red pepper|cayenne|chili flakes|chile flakes|gochugaru/.test(description)) {
    return { tbsp: 6.8, tsp: 2.3 };
  }

  if (/cumin/.test(description)) {
    return { tbsp: 6, tsp: 2 };
  }

  if (/chili powder/.test(description)) {
    return { tbsp: 8, tsp: 2.7 };
  }

  if (/gochujang|chili paste|pepper paste/.test(description)) {
    return { tbsp: 17, tsp: 5.7 };
  }

  if (/sugar/.test(description)) {
    return { tbsp: 12.5, tsp: 4.2 };
  }

  if (/lettuce|romaine|butterhead|leaf lettuce/.test(description)) {
    return { piece: 8 };
  }

  if (/cucumber/.test(description)) {
    return { piece: 300 };
  }

  if (/scallion|green onion|spring onion/.test(description)) {
    return { piece: 15 };
  }

  if (/garlic/.test(description)) {
    return { piece: 3 };
  }

  if (/egg/.test(description)) {
    return { piece: 50 };
  }

  if (/jalapeno|serrano|chili pepper/.test(description)) {
    return { piece: 45 };
  }

  if (/peppers, hot|hot pepper|jalapeno pepper/.test(description)) {
    return { piece: 14 };
  }

  if (/bell pepper|sweet pepper/.test(description)) {
    return { piece: 119 };
  }

  if (/yellow onion|onions, raw|onions, yellow/.test(description)) {
    return { piece: 110 };
  }

  if (/avocado/.test(description)) {
    return { piece: 150 };
  }

  if (/lemon|lime/.test(description)) {
    return { piece: 65 };
  }

  return {};
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
