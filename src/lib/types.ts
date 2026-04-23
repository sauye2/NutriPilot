export type Unit = "g" | "tbsp" | "tsp" | "cup" | "piece";

export type IngredientInput = {
  id: string;
  name: string;
  amount: number;
  unit: Unit;
  food?: ResolvedFood | null;
  resolution?: IngredientResolution | null;
};

export type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type NutritionGoals = MacroTotals;

export type Meal = {
  id: string;
  name?: string;
  ingredients: IngredientInput[];
  totals: MacroTotals;
};

export type FoodProfile = {
  name: string;
  aliases: string[];
  per100g: MacroTotals;
  gramsByUnit: Partial<Record<Unit, number>>;
};

export type ResolvedFood = {
  fdcId: number;
  description: string;
  displayName: string;
  dataType: string;
  brandName?: string | null;
  sourceLabel: string;
  servingText?: string | null;
  per100g: MacroTotals;
  gramsByUnit: Partial<Record<Unit, number>>;
};

export type FoodSearchResult = {
  fdcId: number;
  description: string;
  displayName: string;
  dataType: string;
  brandName?: string | null;
  subtitle: string;
  confidence: number;
  needsReview: boolean;
  rationale?: string;
};

export type IngredientResolution = {
  ingredientText: string;
  normalizedQuery: string;
  matchedFoodId: number | null;
  matchedDescription: string | null;
  matchedDataType: string | null;
  confidence: number;
  needsReview: boolean;
  rationale: string;
  candidates: FoodSearchResult[];
  food: ResolvedFood | null;
};

export type ImportedRecipeIngredient = {
  id: string;
  originalText: string;
  name: string;
  amount: number | null;
  unit: Unit;
  food: ResolvedFood | null;
  confidence: "matched" | "needs-review";
  resolution: IngredientResolution | null;
};

export type ImportedRecipe = {
  title: string;
  sourceUrl: string;
  imageUrl?: string | null;
  ingredients: ImportedRecipeIngredient[];
  warnings: string[];
};

export type CalculatedIngredient = IngredientInput & {
  grams: number;
  totals: MacroTotals;
  supported: boolean;
};

export type MacroKey = keyof MacroTotals;

export type GoalGap = {
  key: MacroKey;
  label: string;
  goal: number;
  actual: number;
  delta: number;
  percent: number;
  status: "under" | "over" | "on-target";
};

export type Suggestion = {
  id: string;
  title: string;
  body: string;
  tone: "add" | "reduce" | "swap" | "balance";
};

export type GeneratedMealIngredient = {
  id: string;
  name: string;
  amount: number;
  unit: Unit;
  notes?: string | null;
  food: ResolvedFood | null;
  resolution?: IngredientResolution | null;
  totals: MacroTotals;
  supported: boolean;
};

export type GeneratedMeal = {
  title: string;
  cuisine: string;
  summary: string;
  whyItWorks: string[];
  ingredients: GeneratedMealIngredient[];
  instructions: string[];
  groceryList: GroceryListSection[];
  totals: MacroTotals;
  goalGaps: GoalGap[];
};

export type GeneratedMealRequest = {
  goals: NutritionGoals;
  cuisine: string;
  anchorFood: string;
  dietaryNotes: string;
};

export type GeneratedMealFeedback = {
  accepted: boolean;
  feedback: string;
};

export type GeneratedMealRevision = {
  summary: string;
  updatedMeal: GeneratedMeal;
};

export type GroceryListItem = {
  id: string;
  label: string;
  quantity: string;
};

export type GroceryListSection = {
  id: string;
  title: string;
  items: GroceryListItem[];
};
