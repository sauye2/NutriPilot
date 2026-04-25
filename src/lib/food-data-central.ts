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
const STRONGLY_PROCESSED_FORM_TERMS = [
  "breaded",
  "battered",
  "tenders",
  "tenderloins",
  "nuggets",
  "patty",
  "patties",
  "microwaved",
  "smoked",
  "jerky",
  "deli",
  "luncheon",
  "salad",
  "spread",
  "roll",
];
const PROCESSED_MEAT_TERMS = [
  "sausage",
  "chorizo",
  "pickled",
  "hocks",
  "hock",
  "cured",
  "salt pork",
  "cracklings",
  "ears",
  "bones",
  "carnitas",
  "ham",
  "bacon",
  "salami",
  "pepperoni",
];
const SWEET_PREPARED_TERMS = [
  "babyfood",
  "juice",
  "nectar",
  "dried",
  "canned",
  "syrup",
  "pie",
  "strudel",
  "cobbler",
  "crisp",
  "candied",
  "cider",
  "filling",
  "turnover",
  "tart",
  "sauce",
  "pastry",
  "croissant",
];
const COMMON_FRUIT_TERMS = [
  "apple",
  "pear",
  "banana",
  "orange",
  "grape",
  "peach",
  "plum",
  "strawberry",
  "blueberry",
  "raspberry",
  "blackberry",
  "mango",
  "pineapple",
  "kiwi",
];
const SPECIAL_FORM_PENALTIES: Array<{ query: RegExp; forbidden: RegExp }> = [
  { query: /\brice\b/, forbidden: /\bcracker|crackers|cake|cakes|sushi\b/ },
  { query: /\begg|eggs\b/, forbidden: /\byolk|white|whites|dried\b/ },
  { query: /\bblack pepper\b/, forbidden: /\bcracker|seasoning blend|marinade\b/ },
  { query: /\bgochugaru\b/, forbidden: /\bseasoning blend|sauce|marinade\b/ },
  { query: /\bsesame oil\b/, forbidden: /\bdressing|blend\b/ },
  { query: /\brice vinegar\b/, forbidden: /\bdressing|seasoned\b/ },
  { query: /\bbroth|stock\b/, forbidden: /\bno broth|chunky|gravy|stew|sauce\b/ },
  { query: /\bsalt\b/, forbidden: /\bsalted\b/ },
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

type CategoryFallbackRule = {
  test: (ingredient: NormalizedIngredient, rawText: string) => boolean;
  queries: string[];
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
    canonical: "basil",
    aliases: ["basil", "thai basil", "sweet basil"],
    searchExpansions: ["basil fresh", "basil raw"],
  },
  {
    canonical: "parsley",
    aliases: ["parsley", "italian parsley", "flat leaf parsley", "curly parsley"],
    searchExpansions: ["parsley fresh", "parsley raw"],
  },
  {
    canonical: "mint",
    aliases: ["mint", "fresh mint", "spearmint", "peppermint"],
    searchExpansions: ["mint fresh", "mint raw"],
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
    canonical: "butter",
    aliases: ["butter", "salted butter", "unsalted butter"],
    searchExpansions: ["butter", "butter salted"],
  },
  {
    canonical: "neutral oil",
    aliases: ["neutral oil", "vegetable oil", "canola oil", "avocado oil", "grapeseed oil"],
    searchExpansions: ["vegetable oil", "oil vegetable", "canola oil"],
  },
  {
    canonical: "heavy cream",
    aliases: ["heavy cream", "heavy whipping cream", "whipping cream"],
    searchExpansions: ["heavy cream", "cream heavy"],
  },
  {
    canonical: "half and half",
    aliases: ["half and half", "half-and-half"],
    searchExpansions: ["half and half", "cream half and half"],
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
    canonical: "okra",
    aliases: ["okra"],
    searchExpansions: ["okra raw"],
  },
  {
    canonical: "plantain",
    aliases: ["plantain", "plantains"],
    searchExpansions: ["plantains raw", "plantain raw"],
  },
  {
    canonical: "cassava",
    aliases: ["cassava", "yuca", "manioc"],
    searchExpansions: ["cassava raw", "yuca raw"],
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
    canonical: "potatoes",
    aliases: ["potato", "potatoes", "russet potato", "russet potatoes", "yellow potato", "gold potato"],
    searchExpansions: ["potatoes raw", "potato raw"],
  },
  {
    canonical: "apple",
    aliases: ["apple", "apples"],
    searchExpansions: ["apple raw", "apples raw"],
  },
  {
    canonical: "pear",
    aliases: ["pear", "pears"],
    searchExpansions: ["pear raw", "pears raw"],
  },
  {
    canonical: "pork",
    aliases: ["pork"],
    searchExpansions: ["pork nfs", "pork loin raw", "pork shoulder raw"],
  },
  {
    canonical: "soy sauce",
    aliases: ["soy sauce"],
    searchExpansions: ["soy sauce"],
  },
  {
    canonical: "fish sauce",
    aliases: ["fish sauce", "nam pla", "nuoc mam"],
    searchExpansions: ["fish sauce", "sauce fish"],
  },
  {
    canonical: "chicken broth",
    aliases: ["chicken broth", "chicken stock"],
    searchExpansions: ["chicken broth ready to serve", "soup chicken broth ready-to-serve"],
  },
  {
    canonical: "beef broth",
    aliases: ["beef broth", "beef stock"],
    searchExpansions: ["beef broth ready to serve", "soup beef broth ready-to-serve"],
  },
  {
    canonical: "vegetable broth",
    aliases: ["vegetable broth", "vegetable stock", "veg broth", "veg stock"],
    searchExpansions: ["vegetable broth ready to serve", "soup vegetable broth ready to serve"],
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
    canonical: "lemon",
    aliases: ["lemon", "whole lemon", "fresh lemon"],
    searchExpansions: ["lemon raw", "lemons raw without peel"],
  },
  {
    canonical: "lime juice",
    aliases: ["lime juice", "fresh lime juice", "juice of lime", "juice from lime"],
    searchExpansions: ["lime juice raw", "juice lime"],
  },
  {
    canonical: "lime",
    aliases: ["lime", "whole lime", "fresh lime"],
    searchExpansions: ["lime raw", "limes raw"],
  },
  {
    canonical: "sesame oil",
    aliases: ["sesame oil", "toasted sesame oil"],
    searchExpansions: ["oil sesame", "sesame seed oil"],
  },
  {
    canonical: "coconut milk",
    aliases: ["coconut milk", "canned coconut milk", "light coconut milk"],
    searchExpansions: [
      "coconut milk canned",
      "nuts coconut milk canned liquid expressed from grated meat and water",
    ],
  },
  {
    canonical: "coconut cream",
    aliases: ["coconut cream"],
    searchExpansions: ["coconut cream canned"],
  },
  {
    canonical: "salt",
    aliases: ["salt", "table salt", "kosher salt", "sea salt"],
    searchExpansions: ["salt table"],
  },
  {
    canonical: "water",
    aliases: ["water", "tap water", "plain water"],
    searchExpansions: ["water tap"],
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
    aliases: [
      "chicken breast",
      "boneless skinless chicken breast",
      "skinless chicken breast",
      "boneless chicken breast",
      "chicken breast filet",
      "chicken breast fillet",
    ],
    searchExpansions: [
      "chicken broilers fryers breast meat only cooked roasted",
      "chicken breast meat only cooked roasted",
      "chicken breast roasted",
      "chicken breast cooked",
      "chicken breast",
    ],
  },
  {
    canonical: "ribeye steak",
    aliases: ["ribeye", "ribeye steak", "rib eye", "rib eye steak"],
    searchExpansions: [
      "beef ribeye lean and fat eaten",
      "beef ribeye cooked",
      "beef ribeye steak",
    ],
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
  {
    canonical: "salmon",
    aliases: ["salmon", "salmon fillet", "salmon filet"],
    searchExpansions: [
      "fish salmon atlantic cooked dry heat",
      "fish salmon cooked dry heat",
      "salmon cooked",
    ],
  },
  {
    canonical: "lemongrass",
    aliases: ["lemongrass", "lemon grass"],
    searchExpansions: ["spices lemon grass citronella raw", "citronella raw"],
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
    canonicalQuery: "apple",
    confidence: 0.95,
    rationale: "Matched automatically using a preferred USDA whole-fruit apple entry.",
    food: {
      fdcId: 2709215,
      description: "Apple, Raw",
      displayName: "Apple, Raw",
      dataType: "Survey (FNDDS)",
      brandName: null,
      sourceLabel: "USDA Survey (FNDDS)",
      servingText: null,
      per100g: { calories: 61, protein: 0.17, carbs: 14.8, fat: 0.15 },
      gramsByUnit: { g: 1, piece: 182, cup: 125 },
    },
  },
  {
    canonicalQuery: "pear",
    confidence: 0.95,
    rationale: "Matched automatically using a preferred USDA whole-fruit pear entry.",
    food: {
      fdcId: 2709254,
      description: "Pear, Raw",
      displayName: "Pear, Raw",
      dataType: "Survey (FNDDS)",
      brandName: null,
      sourceLabel: "USDA Survey (FNDDS)",
      servingText: null,
      per100g: { calories: 59, protein: 0.37, carbs: 15.2, fat: 0.15 },
      gramsByUnit: { g: 1, piece: 178, cup: 140 },
    },
  },
  {
    canonicalQuery: "pork",
    confidence: 0.91,
    rationale: "Matched automatically using a broad USDA pork entry when no specific cut was given.",
    food: {
      fdcId: 2705862,
      description: "Pork, NFS",
      displayName: "Pork, NFS",
      dataType: "Survey (FNDDS)",
      brandName: null,
      sourceLabel: "USDA Survey (FNDDS)",
      servingText: null,
      per100g: { calories: 192, protein: 27.1, carbs: 0, fat: 8.67 },
      gramsByUnit: { g: 1, piece: 85 },
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
    canonicalQuery: "olive oil",
    confidence: 0.97,
    rationale: "Matched automatically using a preferred USDA generic pantry entry.",
    food: {
      fdcId: 171413,
      description: "Oil, Olive, Salad Or Cooking",
      displayName: "Olive Oil",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 884, protein: 0, carbs: 0, fat: 100 },
      gramsByUnit: { g: 1, tbsp: 13.5, tsp: 4.5 },
    },
  },
  {
    canonicalQuery: "heavy cream",
    confidence: 0.96,
    rationale: "Matched automatically using a preferred USDA generic dairy cream entry.",
    food: {
      fdcId: 2705597,
      description: "Cream, Heavy",
      displayName: "Heavy Cream",
      dataType: "Survey (FNDDS)",
      brandName: null,
      sourceLabel: "USDA Survey (FNDDS)",
      servingText: null,
      per100g: { calories: 343, protein: 2.02, carbs: 3.8, fat: 35.56 },
      gramsByUnit: { g: 1, tbsp: 15, tsp: 5, cup: 238 },
    },
  },
  {
    canonicalQuery: "half and half",
    confidence: 0.95,
    rationale: "Matched automatically using a preferred USDA dairy entry.",
    food: {
      fdcId: 171263,
      description: "Cream, Fluid, Half And Half",
      displayName: "Half And Half",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 123, protein: 3.13, carbs: 4.73, fat: 10.53 },
      gramsByUnit: { g: 1, tbsp: 15, tsp: 5, cup: 242 },
    },
  },
  {
    canonicalQuery: "butter",
    confidence: 0.97,
    rationale: "Matched automatically using a preferred USDA generic butter entry.",
    food: {
      fdcId: 173410,
      description: "Butter, Salted",
      displayName: "Butter",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 717, protein: 0.9, carbs: 0.1, fat: 81.1 },
      gramsByUnit: { g: 1, tbsp: 14.2, tsp: 4.7 },
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
    canonicalQuery: "lemon",
    confidence: 0.95,
    rationale: "Matched automatically using a preferred USDA fresh lemon entry.",
    food: {
      fdcId: 167746,
      description: "Lemons, Raw, Without Peel",
      displayName: "Lemon, Raw",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 29, protein: 1.1, carbs: 9.32, fat: 0.3 },
      gramsByUnit: { g: 1, piece: 58, tbsp: 15, tsp: 5 },
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
    canonicalQuery: "lime",
    confidence: 0.95,
    rationale: "Matched automatically using a preferred USDA fresh lime entry.",
    food: {
      fdcId: 168155,
      description: "Limes, Raw",
      displayName: "Lime, Raw",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 30, protein: 0.7, carbs: 10.5, fat: 0.2 },
      gramsByUnit: { g: 1, piece: 67, tbsp: 15, tsp: 5 },
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
    canonicalQuery: "chicken broth",
    confidence: 0.95,
    rationale: "Matched automatically using a preferred USDA broth entry.",
    food: {
      fdcId: 174536,
      description: "Soup, Chicken Broth, Ready-To-Serve",
      displayName: "Chicken Broth",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 6, protein: 0.64, carbs: 0.44, fat: 0.21 },
      gramsByUnit: { g: 1, cup: 240, tbsp: 15, tsp: 5 },
    },
  },
  {
    canonicalQuery: "beef broth",
    confidence: 0.95,
    rationale: "Matched automatically using a preferred USDA broth entry.",
    food: {
      fdcId: 171538,
      description: "Soup, Beef Broth Or Bouillon, Canned, Ready-To-Serve",
      displayName: "Beef Broth",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 7, protein: 1.14, carbs: 0.04, fat: 0.22 },
      gramsByUnit: { g: 1, cup: 240, tbsp: 15, tsp: 5 },
    },
  },
  {
    canonicalQuery: "vegetable broth",
    confidence: 0.95,
    rationale: "Matched automatically using a preferred USDA broth entry.",
    food: {
      fdcId: 171583,
      description: "Soup, Vegetable Broth, Ready To Serve",
      displayName: "Vegetable Broth",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 5, protein: 0.24, carbs: 0.93, fat: 0.07 },
      gramsByUnit: { g: 1, cup: 240, tbsp: 15, tsp: 5 },
    },
  },
  {
    canonicalQuery: "coconut milk",
    confidence: 0.95,
    rationale: "Matched automatically using a preferred USDA canned coconut milk entry.",
    food: {
      fdcId: 170173,
      description: "Nuts, Coconut Milk, Canned (Liquid Expressed From Grated Meat And Water)",
      displayName: "Coconut Milk",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 197, protein: 2.02, carbs: 2.81, fat: 21.3 },
      gramsByUnit: { g: 1, cup: 240, tbsp: 15, tsp: 5 },
    },
  },
  {
    canonicalQuery: "salt",
    confidence: 0.97,
    rationale: "Matched automatically using a preferred USDA table salt entry.",
    food: {
      fdcId: 173468,
      description: "Salt, Table",
      displayName: "Salt, Table",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      gramsByUnit: { g: 1, tbsp: 18, tsp: 6 },
    },
  },
  {
    canonicalQuery: "water",
    confidence: 0.98,
    rationale: "Matched automatically using a preferred USDA plain water entry.",
    food: {
      fdcId: 2710707,
      description: "Water, Tap",
      displayName: "Water",
      dataType: "Survey (FNDDS)",
      brandName: null,
      sourceLabel: "USDA Survey (FNDDS)",
      servingText: null,
      per100g: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      gramsByUnit: { g: 1, cup: 237, tbsp: 15, tsp: 5 },
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
    canonicalQuery: "potatoes",
    confidence: 0.95,
    rationale: "Matched automatically using a preferred USDA generic potato entry.",
    food: {
      fdcId: 170026,
      description: "Potatoes, Flesh And Skin, Raw",
      displayName: "Potatoes, Raw",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 77, protein: 2, carbs: 17.5, fat: 0.1 },
      gramsByUnit: { g: 1, piece: 173, cup: 150 },
    },
  },
  {
    canonicalQuery: "chicken breast cooked",
    confidence: 0.97,
    rationale: "Matched automatically using a preferred USDA cooked chicken breast entry.",
    food: {
      fdcId: 171477,
      description: "Chicken, Broilers Or Fryers, Breast, Meat Only, Cooked, Roasted",
      displayName: "Chicken Breast, Meat Only, Cooked",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 165, protein: 31.02, carbs: 0, fat: 3.57 },
      gramsByUnit: { g: 1, piece: 120 },
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
    canonicalQuery: "ribeye steak cooked",
    confidence: 0.96,
    rationale: "Matched automatically using a preferred USDA cooked ribeye entry.",
    food: {
      fdcId: 2705829,
      description: "Beef, Steak, Ribeye, Lean And Fat Eaten",
      displayName: "Beef, Ribeye Steak, Cooked",
      dataType: "Survey (FNDDS)",
      brandName: null,
      sourceLabel: "USDA Survey (FNDDS)",
      servingText: null,
      per100g: { calories: 289, protein: 23.5, carbs: 0, fat: 21.6 },
      gramsByUnit: { g: 1, piece: 150 },
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
    canonicalQuery: "salmon cooked",
    confidence: 0.96,
    rationale: "Matched automatically using a preferred USDA cooked salmon entry.",
    food: {
      fdcId: 175168,
      description: "Fish, Salmon, Atlantic, Farmed, Cooked, Dry Heat",
      displayName: "Salmon, Cooked",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 206, protein: 22.1, carbs: 0, fat: 12.35 },
      gramsByUnit: { g: 1, piece: 154 },
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
  {
    canonicalQuery: "lemongrass",
    confidence: 0.94,
    rationale: "Matched automatically using a preferred USDA lemongrass entry.",
    food: {
      fdcId: 168573,
      description: "Lemon Grass (Citronella), Raw",
      displayName: "Lemongrass, Raw",
      dataType: "SR Legacy",
      brandName: null,
      sourceLabel: "USDA SR Legacy",
      servingText: null,
      per100g: { calories: 99, protein: 1.82, carbs: 25.31, fat: 0.49 },
      gramsByUnit: { g: 1, piece: 67, cup: 67, tbsp: 5, tsp: 1.7 },
    },
  },
];

const CATEGORY_FALLBACK_RULES: CategoryFallbackRule[] = [
  {
    test: (ingredient, rawText) =>
      /\bshallot|red onion|sweet onion|white onion|vidalia onion|onion\b/.test(
        `${ingredient.canonicalQuery} ${rawText}`.toLowerCase(),
      ),
    queries: ["onions yellow raw", "onions raw"],
    rationale: "Used a generic USDA onion profile to keep the estimate usable.",
  },
  {
    test: (ingredient, rawText) =>
      /\bserrano|jalapeno|jalapeño|habanero|scotch bonnet|thai chili|thai chile|bird.?s eye|birds eye|fresno|anaheim|poblano|hot pepper|chili pepper|chile pepper\b/.test(
        `${ingredient.canonicalQuery} ${rawText}`.toLowerCase(),
      ),
    queries: ["peppers hot raw", "hot pepper raw", "jalapeno pepper raw"],
    rationale: "Used a generic USDA hot pepper profile for a close family match.",
  },
  {
    test: (ingredient, rawText) =>
      /\bbell pepper|sweet pepper|capsicum\b/.test(
        `${ingredient.canonicalQuery} ${rawText}`.toLowerCase(),
      ),
    queries: ["sweet pepper", "bell pepper raw"],
    rationale: "Used a generic USDA bell pepper profile for a close family match.",
  },
  {
    test: (ingredient, rawText) =>
      /\bbasil|thai basil|sweet basil\b/.test(
        `${ingredient.canonicalQuery} ${rawText}`.toLowerCase(),
      ),
    queries: ["basil fresh", "basil raw"],
    rationale: "Used a generic USDA fresh basil profile for a close herb match.",
  },
  {
    test: (ingredient, rawText) =>
      /\bparsley|italian parsley|flat leaf parsley|curly parsley\b/.test(
        `${ingredient.canonicalQuery} ${rawText}`.toLowerCase(),
      ),
    queries: ["parsley fresh", "parsley raw"],
    rationale: "Used a generic USDA parsley profile for a close herb match.",
  },
  {
    test: (ingredient, rawText) =>
      /\bmint|spearmint|peppermint\b/.test(
        `${ingredient.canonicalQuery} ${rawText}`.toLowerCase(),
      ),
    queries: ["mint fresh", "mint raw"],
    rationale: "Used a generic USDA fresh mint profile for a close herb match.",
  },
  {
    test: (ingredient, rawText) =>
      /\bokra\b/.test(`${ingredient.canonicalQuery} ${rawText}`.toLowerCase()),
    queries: ["okra raw"],
    rationale: "Used a generic USDA okra profile to keep the estimate accurate.",
  },
  {
    test: (ingredient, rawText) =>
      /\bpotato|potatoes|russet|yukon gold|yellow potato|gold potato\b/.test(
        `${ingredient.canonicalQuery} ${rawText}`.toLowerCase(),
      ),
    queries: ["potatoes raw", "potato raw"],
    rationale: "Used a generic USDA potato profile to keep the estimate accurate.",
  },
  {
    test: (ingredient, rawText) =>
      /\bplantain|plantains\b/.test(`${ingredient.canonicalQuery} ${rawText}`.toLowerCase()),
    queries: ["plantains raw", "plantain raw"],
    rationale: "Used a generic USDA plantain profile for a close produce match.",
  },
  {
    test: (ingredient, rawText) =>
      /\bcassava|yuca|manioc\b/.test(`${ingredient.canonicalQuery} ${rawText}`.toLowerCase()),
    queries: ["cassava raw", "yuca raw"],
    rationale: "Used a generic USDA cassava profile for a close produce match.",
  },
  {
    test: (ingredient, rawText) =>
      /\b(extra virgin olive oil|olive oil|sesame oil|vegetable oil|canola oil|avocado oil|grapeseed oil|neutral oil|oil)\b/.test(
        `${ingredient.canonicalQuery} ${rawText}`.toLowerCase(),
      ),
    queries: ["vegetable oil", "olive oil"],
    rationale: "Used a generic USDA cooking oil profile to avoid a missing estimate.",
  },
  {
    test: (ingredient, rawText) =>
      /\bbutter|salted butter|unsalted butter\b/.test(
        `${ingredient.canonicalQuery} ${rawText}`.toLowerCase(),
      ),
    queries: ["butter", "butter salted"],
    rationale: "Used a generic USDA butter profile to keep the estimate accurate.",
  },
  {
    test: (ingredient, rawText) =>
      /\bheavy cream|heavy whipping cream|whipping cream|half and half|half-and-half\b/.test(
        `${ingredient.canonicalQuery} ${rawText}`.toLowerCase(),
      ),
    queries: ["heavy cream", "cream heavy"],
    rationale: "Used a generic USDA dairy cream profile to keep the estimate accurate.",
  },
  {
    test: (ingredient, rawText) =>
      /\bcoconut milk|canned coconut milk|light coconut milk|coconut cream\b/.test(
        `${ingredient.canonicalQuery} ${rawText}`.toLowerCase(),
      ),
    queries: [
      "coconut milk canned",
      "nuts coconut milk canned liquid expressed from grated meat and water",
    ],
    rationale: "Used a generic USDA coconut milk profile for a close pantry match.",
  },
  {
    test: (ingredient, rawText) =>
      /\b(chicken|beef|vegetable|veggie|veg)\s+(broth|stock)\b|\bbroth\b|\bstock\b/.test(
        `${ingredient.canonicalQuery} ${rawText}`.toLowerCase(),
      ),
    queries: [
      "chicken broth ready to serve",
      "vegetable broth ready to serve",
      "beef broth ready to serve",
    ],
    rationale: "Used a generic USDA broth profile to avoid dropping the estimate.",
  },
  {
    test: (ingredient, rawText) =>
      /\bsalt|kosher salt|sea salt|table salt\b/.test(
        `${ingredient.canonicalQuery} ${rawText}`.toLowerCase(),
      ),
    queries: ["salt table"],
    rationale: "Used a generic USDA table salt profile so the pantry item still resolves cleanly.",
  },
  {
    test: (ingredient, rawText) =>
      /\blemon juice|lime juice|juice of lemon|juice of lime|juice lemon|juice lime\b/.test(
        `${ingredient.canonicalQuery} ${rawText}`.toLowerCase(),
      ),
    queries: ["lime juice raw", "lemon juice raw"],
    rationale: "Used a generic USDA citrus juice profile for a close family match.",
  },
  {
    test: (ingredient, rawText) =>
      /\bblack pepper|peppercorn|ground pepper\b/.test(
        `${ingredient.canonicalQuery} ${rawText}`.toLowerCase(),
      ),
    queries: ["spices pepper black", "pepper black"],
    rationale: "Used a generic USDA black pepper profile for the estimate.",
  },
  {
    test: (ingredient, rawText) =>
      /\bcumin|coriander seed|caraway\b/.test(
        `${ingredient.canonicalQuery} ${rawText}`.toLowerCase(),
      ),
    queries: ["spices cumin seed", "cumin seed"],
    rationale: "Used a close USDA spice profile to keep the estimate usable.",
  },
  {
    test: (ingredient, rawText) =>
      /\bchili powder|chile powder|paprika|red pepper flakes|chili flakes|chile flakes|gochugaru\b/.test(
        `${ingredient.canonicalQuery} ${rawText}`.toLowerCase(),
      ),
    queries: ["spices chili powder", "pepper red or cayenne"],
    rationale: "Used a generic USDA chile spice profile for a close pantry match.",
  },
  {
    test: (ingredient, rawText) =>
      /\bfish sauce|nam pla|nuoc mam\b/.test(
        `${ingredient.canonicalQuery} ${rawText}`.toLowerCase(),
      ),
    queries: ["fish sauce", "sauce fish"],
    rationale: "Used a generic USDA fish sauce profile for a close pantry match.",
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

  if (/heavy cream|whipping cream/.test(normalizedText)) {
    queries.push("heavy cream", "cream heavy");
  }

  if (/half and half/.test(normalizedText)) {
    queries.push("half and half", "cream half and half");
  }

  if (/coconut milk|coconut cream/.test(normalizedText)) {
    queries.push(
      "coconut milk canned",
      "nuts coconut milk canned liquid expressed from grated meat and water",
    );
  }

  if (/chicken broth|chicken stock/.test(normalizedText)) {
    queries.push("chicken broth ready to serve", "soup chicken broth ready-to-serve");
  }

  if (/beef broth|beef stock/.test(normalizedText)) {
    queries.push("beef broth ready to serve", "soup beef broth ready-to-serve");
  }

  if (/vegetable broth|vegetable stock|veg broth|veg stock/.test(normalizedText)) {
    queries.push("vegetable broth ready to serve", "soup vegetable broth ready to serve");
  }

  if (/salt/.test(normalizedText)) {
    queries.push("salt table");
  }

  if (/\bwater\b/.test(normalizedText)) {
    queries.push("water tap");
  }

  if (/rice vinegar/.test(normalizedText)) {
    queries.push("vinegar rice", "vinegar rice wine");
  }

  if (/lemon juice/.test(normalizedText)) {
    queries.push("lemon juice raw", "juice lemon");
  }

  if (/\blemon\b/.test(normalizedText) && !/juice/.test(normalizedText)) {
    queries.push("lemon raw", "lemons raw without peel");
  }

  if (/lime juice/.test(normalizedText)) {
    queries.push("lime juice raw", "juice lime");
  }

  if (/\blime\b/.test(normalizedText) && !/juice/.test(normalizedText)) {
    queries.push("lime raw", "limes raw");
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

  if (/ribeye|rib eye/.test(normalizedText)) {
    queries.push("beef ribeye lean and fat eaten", "beef ribeye cooked", "beef ribeye steak");
  }

  if (/chicken breast/.test(normalizedText) && !/\braw\b/.test(normalizedText)) {
    queries.push(
      "chicken broilers fryers breast meat only cooked roasted",
      "chicken breast meat only cooked roasted",
      "chicken breast roasted",
      "chicken breast cooked",
    );
  }

  if (/ground beef/.test(normalizedText) && /\bcooked\b/.test(normalizedText)) {
    queries.push("ground beef cooked");
  }

  if (/salmon/.test(normalizedText) && !/\braw\b/.test(normalizedText)) {
    queries.push("fish salmon atlantic cooked dry heat", "fish salmon cooked dry heat");
  }

  if (/lemongrass|lemon grass/.test(normalizedText)) {
    queries.push("spices lemon grass citronella raw", "citronella raw");
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
  const normalized = normalizeIngredientText(query);
  const preferCooked = Boolean(options?.preferCooked && !normalized.cookedState);
  const preferred = getPreferredGenericProfile(normalized.canonicalQuery, query);
  const ranked = await gatherRankedCandidates(
    normalized,
    classifyIngredientType(normalized.canonicalQuery),
    expandSynonyms(normalized.canonicalQuery),
    preferCooked,
  );
  const preferredCandidate = preferred ? preferredProfileToCandidate(preferred) : null;
  const candidates = dedupeRankedCandidates(
    [preferredCandidate, ...ranked].filter(Boolean) as RankedCandidate[],
  );
  const filtered = candidates.filter((candidate) => candidate._confidence >= 0.42);

  return (filtered.length > 0 ? filtered : candidates).slice(0, 6).map(toSearchResult);
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
  const ranked = await gatherRankedCandidates(
    normalized,
    ingredientType,
    expandedQueries,
    preferCooked,
  );

  const topCandidates = ranked.slice(0, 3);
  let chosen = await hydrateBestCandidate(topCandidates, options?.includeFoodDetails ?? true);

  if (!chosen?.food) {
    const categoryFallback = await resolveCategoryFallback(
      normalized,
      rawText,
      ingredientType,
      preferCooked,
      options?.includeFoodDetails ?? true,
    );

    if (categoryFallback) {
      chosen = categoryFallback;
      if (!topCandidates.some((candidate) => candidate.fdcId === categoryFallback.candidate.fdcId)) {
        topCandidates.unshift(categoryFallback.candidate);
      }
    }
  }

  const confidence = chosen?.candidate._confidence ?? 0;
  const needsReview = chosen ? chosen.candidate._needsReview : true;
  const rationale =
    chosen?.candidate._rationale ??
    "We couldn't confidently match this ingredient yet, so it still needs a quick look.";

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

async function gatherRankedCandidates(
  normalized: NormalizedIngredient,
  ingredientType: IngredientKind,
  expandedQueries: string[],
  preferCooked: boolean,
) {
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

  return ranked;
}

async function resolveCategoryFallback(
  normalized: NormalizedIngredient,
  rawText: string,
  ingredientType: IngredientKind,
  preferCooked: boolean,
  includeFoodDetails: boolean,
): Promise<{ candidate: RankedCandidate; food: ResolvedFood | null } | null> {
  const fallbackQueries = getCategoryFallbackQueries(normalized, rawText);

  if (!fallbackQueries.length) {
    return null;
  }

  const fallbackResults = await Promise.all(
    fallbackQueries.map((query) => searchFoodDataCentral(query, GENERIC_DATA_TYPES)),
  );
  const ranked = rankCandidates(
    normalized,
    dedupeFoods(fallbackResults.flat()),
    ingredientType,
    fallbackQueries,
    preferCooked,
  );
  const fallback = ranked[0];

  if (!fallback || fallback._confidence < 0.38) {
    return null;
  }

  const rule = getCategoryFallbackRule(normalized, rawText);
  const candidate: RankedCandidate = {
    ...fallback,
    _confidence: Math.max(fallback._confidence, 0.52),
    _needsReview: false,
    _rationale:
      rule?.rationale ??
      "Used a close generic USDA ingredient profile so the meal still has a usable estimate.",
  };
  const food = includeFoodDetails ? await getFoodDetails(candidate.fdcId) : null;

  if (includeFoodDetails && !food) {
    return null;
  }

  return { candidate, food };
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

  if (query === "heavy cream" || query === "whipping cream") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "heavy cream") ?? null;
  }

  if (query === "half and half") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "half and half") ?? null;
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

  if (query === "lemon") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "lemon") ?? null;
  }

  if (query === "lime juice") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "lime juice") ?? null;
  }

  if (query === "lime") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "lime") ?? null;
  }

  if (query === "water") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "water") ?? null;
  }

  if (query === "soy sauce") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "soy sauce") ?? null;
  }

  if (query === "chicken broth" || query === "chicken stock") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "chicken broth") ?? null;
  }

  if (query === "beef broth" || query === "beef stock") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "beef broth") ?? null;
  }

  if (query === "vegetable broth" || query === "vegetable stock") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "vegetable broth") ?? null;
  }

  if (query === "oyster sauce") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "oyster sauce") ?? null;
  }

  if (query === "coconut milk" || query === "coconut cream") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "coconut milk") ?? null;
  }

  if (query === "salt") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "salt") ?? null;
  }

  if (query === "apple") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "apple") ?? null;
  }

  if (query === "pear") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "pear") ?? null;
  }

  if (query === "pork") {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "pork") ?? null;
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

  if (/\blemongrass\b|\blemon grass\b/.test(query) || /\blemongrass\b|\blemon grass\b/.test(raw)) {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "lemongrass") ?? null;
  }

  if ((/\bchicken breast\b/.test(query) || /\bchicken breast\b/.test(raw)) && !/\braw\b/.test(raw)) {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "chicken breast cooked") ?? null;
  }

  if ((/\bribeye\b/.test(query) || /\brib eye\b/.test(raw)) && !/\braw\b/.test(raw)) {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "ribeye steak cooked") ?? null;
  }

  if ((/\bsalmon\b/.test(query) || /\bsalmon\b/.test(raw)) && !/\braw\b/.test(raw)) {
    return PREFERRED_GENERIC_PROFILES.find((profile) => profile.canonicalQuery === "salmon cooked") ?? null;
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

function getCategoryFallbackQueries(
  normalized: NormalizedIngredient,
  rawText: string,
): string[] {
  return getCategoryFallbackRule(normalized, rawText)?.queries ?? [];
}

function getCategoryFallbackRule(
  normalized: NormalizedIngredient,
  rawText: string,
): CategoryFallbackRule | null {
  return (
    CATEGORY_FALLBACK_RULES.find((rule) => rule.test(normalized, rawText)) ?? null
  );
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

      if (/\bbroth|stock\b/.test(queryText)) {
        if (!/\bbroth|stock\b/.test(description)) score -= 95;
        if (/no broth/.test(description)) score -= 140;
        if (/chunky|gravy|stew|with vegetables|with noodles|with rice/.test(description)) score -= 35;
      }

      if (/\bheavy cream|whipping cream|half and half|coconut milk|coconut cream\b/.test(queryText)) {
        if (!/\bcream|milk\b/.test(description)) score -= 65;
      }

      if (/\bsalt\b/.test(queryText) && !/\bsalt\b/.test(description)) {
        score -= 90;
      }

      if (
        BAD_PACKAGED_TERMS.some((term) => description.includes(term)) &&
        !BAD_PACKAGED_TERMS.some((term) => queryText.includes(term))
      ) {
        score -= 42;
      }

      if (
        STRONGLY_PROCESSED_FORM_TERMS.some((term) => description.includes(term)) &&
        !STRONGLY_PROCESSED_FORM_TERMS.some((term) => queryText.includes(term))
      ) {
        score -= 70;
      }

      if (/\bchicken breast\b/.test(queryText)) {
        if (!/\bchicken\b/.test(description) || !/\bbreast\b/.test(description)) {
          score -= 140;
        }

        if (/breaded|tenders|tenderloins|nuggets|patty|patties|roll|microwaved/.test(description)) {
          score -= 110;
        }

        if (/meat only|skin not eaten/.test(description)) {
          score += 26;
        }

        if (/cooked|roasted|grilled|broiled/.test(description)) {
          score += 18;
        }

        if (/meat and skin|skin eaten/.test(description) && !/\bskin on\b|\bwith skin\b/.test(queryText)) {
          score -= 18;
        }
      }

      if (/\bribeye\b|\brib eye\b/.test(queryText)) {
        if (!/\bribeye\b/.test(description)) {
          score -= 145;
        }

        if (/\bbison|game meat\b/.test(description) && !/\bbison\b|\bgame\b/.test(queryText)) {
          score -= 150;
        }

        if (/\bbeef\b/.test(description)) {
          score += 24;
        }

        if (/lean and fat eaten/.test(description)) {
          score += 16;
        }
      }

      if (/\bsalmon\b/.test(queryText)) {
        if (!/\bsalmon\b/.test(description)) {
          score -= 150;
        }

        if (/fish oil| oil,/.test(description)) {
          score -= 200;
        }

        if (/smoked|nuggets|spread|salad/.test(description) && !/smoked/.test(queryText)) {
          score -= 90;
        }

        if (/cooked, dry heat/.test(description)) {
          score += 18;
        }

        if (/atlantic/.test(description)) {
          score += 6;
        }
      }

      if (/\blemongrass\b|\blemon grass\b/.test(queryText)) {
        if (!/\blemon grass\b|\bcitronella\b|\blemongrass\b/.test(description)) {
          score -= 220;
        }
      }

      if (queryText === "pork") {
        if (!/\bpork\b/.test(description)) {
          score -= 180;
        }

        if (PROCESSED_MEAT_TERMS.some((term) => description.includes(term))) {
          score -= 170;
        }

        if (/\bnfs\b/.test(description)) {
          score += 42;
        }

        if (/\bground|loin|tenderloin|roast|shoulder\b/.test(description)) {
          score += 20;
        }
      }

      if (/\bpork belly\b/.test(queryText)) {
        if (!/\bbelly\b/.test(description)) {
          score -= 170;
        }

        if (PROCESSED_MEAT_TERMS.some((term) => description.includes(term))) {
          score -= 180;
        }
      }

      if (COMMON_FRUIT_TERMS.includes(queryText)) {
        if (!new RegExp(`\\b${queryText}\\b`).test(description)) {
          score -= 170;
        }

        if (SWEET_PREPARED_TERMS.some((term) => description.includes(term))) {
          score -= 180;
        }

        if (/\braw\b/.test(description)) {
          score += 34;
        }

        if (/\bfoundation\b/.test(food.dataType.toLowerCase()) || /\bsurvey\b/.test(food.dataType.toLowerCase())) {
          score += 8;
        }
      }

      if (/\boil\b/.test(description) && !/\boil\b/.test(queryText) && /\bsalmon|fish|tuna\b/.test(queryText)) {
        score -= 180;
      }

      if (/\bbeef|steak|ribeye|sirloin\b/.test(queryText) && /\bbison|game meat\b/.test(description) && !/\bbison\b|\bgame\b/.test(queryText)) {
        score -= 120;
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

function dedupeRankedCandidates(candidates: RankedCandidate[]) {
  const seen = new Map<number, RankedCandidate>();

  for (const candidate of candidates) {
    const existing = seen.get(candidate.fdcId);

    if (!existing || candidate._score > existing._score) {
      seen.set(candidate.fdcId, candidate);
    }
  }

  return Array.from(seen.values()).sort((left, right) => right._score - left._score);
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
    entry.aliases.some((alias) => matchesAliasPhrase(normalized, alias.toLowerCase())),
  );
}

function matchesAliasPhrase(value: string, alias: string) {
  const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|\\s)${escapedAlias}(?=\\s|$)`);

  return pattern.test(value);
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

  if (/broth|stock|bouillon|consomme/.test(description)) {
    return { cup: 240, tbsp: 15, tsp: 5 };
  }

  if (/heavy cream|cream, heavy|whipping cream|half and half/.test(description)) {
    return { cup: 240, tbsp: 15, tsp: 5 };
  }

  if (/coconut milk|coconut cream/.test(description)) {
    return { cup: 240, tbsp: 15, tsp: 5 };
  }

  if (/milk, whole|milk, reduced fat|milk, low fat|milk, nonfat|milk, buttermilk/.test(description)) {
    return { cup: 244, tbsp: 15.3, tsp: 5.1 };
  }

  if (/water, tap|^water$/.test(description)) {
    return { cup: 237, tbsp: 15, tsp: 5 };
  }

  if (/salt/.test(description)) {
    return { tbsp: 18, tsp: 6 };
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

  if (/fish sauce/.test(description)) {
    return { tbsp: 18, tsp: 6 };
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

  if (/basil|parsley|mint/.test(description)) {
    return { cup: 20 };
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

  if (/okra/.test(description)) {
    return { piece: 12, cup: 100 };
  }

  if (/plantain/.test(description)) {
    return { piece: 179, cup: 148 };
  }

  if (/cassava/.test(description)) {
    return { cup: 103, piece: 250 };
  }

  if (/lemon|lime/.test(description)) {
    return { piece: 65 };
  }

  return {};
}

function formatFoodLabel(value: string) {
  const lower = value.toLowerCase();

  return lower
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .replace(/\bNfs\b/g, "NFS")
    .replace(/\bNs\b/g, "NS");
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
