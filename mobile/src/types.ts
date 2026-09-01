export const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack', 'other'] as const;
export type MealType = (typeof mealTypes)[number];
export type SourceKind = 'local' | 'openfoodfacts' | 'usda' | 'manual' | 'llm';

export interface SourceMeta {
  source: SourceKind;
  rawId?: string;
  confidence?: number;
  fetchedAt?: string;
}

export interface NutritionPer100g {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodiumMg?: number;
}

export interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  /** Owner-selected display overrides. They never change nutrition data. */
  emoji?: string;
  imageUri?: string;
  barcode?: string;
  serving: { unit: string; amount: number; gramsPerUnit: number };
  nutrition: NutritionPer100g;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  source: SourceMeta;
}

export interface FoodPortion {
  foodId: string;
  quantity: number;
  unit: string;
}

export interface FoodEntry {
  id: string;
  date: string;
  eatenAt?: string;
  mealType: MealType;
  foodId: string;
  portion: FoodPortion;
  note?: string;
  enteredAt: string;
  source: SourceMeta;
}

export interface BodyMetricLog {
  id: string;
  date: string;
  weightKg: number;
  bodyFatPercent?: number;
  waistCm?: number;
  notes?: string;
  enteredAt: string;
}

export interface ActivityEntry {
  id: string;
  date: string;
  name: string;
  source: 'strava' | 'health_connect' | 'manual';
  /** The originating tracker when this was imported through Health Connect. */
  importSource?: string;
  type: string;
  durationMinutes: number;
  distanceMeters?: number;
  caloriesEstimated: number;
  createdAt: string;
}

export interface DailyGoal {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealPlanItem {
  id: string;
  eatenAt?: string;
  mealType: MealType;
  foodId: string;
  portion: FoodPortion;
  note?: string;
}

export interface MealPlan {
  id: string;
  name: string;
  description?: string;
  items: MealPlanItem[];
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  foodId: string;
  quantity: number;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  servings: number;
  finalWeightGrams: number;
  ingredients: RecipeIngredient[];
  foodId: string;
  sourceDescription?: string;
  reviewStatus?: 'manual' | 'ai_estimated' | 'reference_reviewed';
  sourceName?: string;
  sourceUrl?: string;
  sourceLicense?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeInput {
  name: string;
  servings: number;
  finalWeightGrams?: number;
  ingredients: RecipeIngredient[];
  sourceDescription?: string;
  emoji?: string;
  imageUri?: string;
}

export type AgentIntent = 'log_foods' | 'create_recipe_and_log' | 'clarify';

export interface AgentActionPlan {
  intent: AgentIntent;
  title: string;
  summary: string;
  requiresConfirmation: boolean;
  clarification?: string;
  dish?: { name: string; servings: number; finalWeightGrams: number };
  items: Array<{ foodId: string; quantity: number; unit: string; confidence: number }>;
  log: { date: string; eatenAt: string; quantity: number };
}

export interface AgentResolution {
  transcript: string;
  foods: FoodItem[];
  quantities: Record<string, number>;
  notes: string[];
  plan?: AgentActionPlan;
}

export interface AssistantIngredient {
  name: string; brand: string | null; quantity: number; unit: string; gramsPerUnit: number;
  caloriesPer100g: number; proteinPer100g: number; carbsPer100g: number; fatPer100g: number; confidence: number;
}

export type AssistantActionType = 'log_foods' | 'save_food' | 'create_recipe' | 'create_recipe_and_log' | 'log_weight' | 'log_activity' | 'change_entry_time' | 'delete_entry' | 'delete_weight' | 'delete_activity' | 'set_goal' | 'update_profile' | 'create_plan_from_day' | 'apply_plan' | 'delete_plan' | 'navigate';

export interface AssistantAction {
  type: AssistantActionType; summary: string; confidence: number; targetId: string | null; date: string | null; time: string | null; name: string | null;
  value: number | null; quantity: number | null; servings: number | null; durationMinutes: number | null; calories: number | null; protein: number | null; carbs: number | null; fat: number | null;
  displayName: string | null; targetWeightKg: number | null; activityFactor: number | null; goalMode: 'lose' | 'maintain' | 'gain' | 'recompose' | null;
  goalIntensity: 'gentle' | 'moderate' | 'aggressive' | null; targetDate: string | null; destination: 'today' | 'plans' | 'trends' | 'assistant' | 'library' | 'profile' | null;
  ingredients: AssistantIngredient[];
}

export interface AssistantPlan { reply: string; requiresConfirmation: boolean; actions: AssistantAction[]; notes: string[] }
export interface AssistantMessage { id: string; role: 'user' | 'assistant'; text: string; createdAt: string }

export interface UserProfile {
  id: string;
  displayName?: string;
  profilePhotoUri?: string;
  sex: 'male' | 'female' | 'other';
  ageYears: number;
  heightCm: number;
  bodyWeightKg: number;
  targetWeightKg?: number;
  activityFactor: number;
  weeklyWeightChangeKg: number;
  goalMode?: 'lose' | 'maintain' | 'gain' | 'recompose';
  goalIntensity?: 'gentle' | 'moderate' | 'aggressive';
  targetDate?: string;
  onboardingComplete?: boolean;
  preferredHeightUnit?: 'cm' | 'ft';
  preferredWeightUnit?: 'kg' | 'lb';
  /** `device` follows the phone. Any valid IANA zone is also accepted. */
  timeZone?: string;
  adaptiveTdee?: number;
  adaptiveTdeeUpdatedAt?: string;
  dietStyle?: 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian';
  preferredCuisine?: 'pakistani' | 'indian' | 'south_asian' | 'southeast_asian' | 'mixed';
  excludedFoods?: string;
  mealsPerDay?: number;
  createdAt: string;
  updatedAt: string;
}

export interface NutritionProgramMeal {
  label: string;
  time: string;
  targetCalories: number;
  targetProtein: number;
  foods: string[];
}

export interface NutritionProgram {
  createdAt: string;
  profileUpdatedAt: string;
  summary: string;
  actions: string[];
  cautions: string[];
  meals: NutritionProgramMeal[];
  sources: Array<{ title: string; url: string }>;
  aiGenerated: boolean;
}

export type ProfileInput = Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>;
export type FoodEntryInput = Omit<FoodEntry, 'id' | 'enteredAt' | 'source'> & { clientId: string };
export type WeightInput = Omit<BodyMetricLog, 'id' | 'enteredAt'> & { clientId: string };
export type ActivityInput = Omit<ActivityEntry, 'id' | 'createdAt' | 'source'> & { clientId: string };
export type CustomFoodInput = Pick<FoodItem, 'name' | 'brand' | 'barcode' | 'serving' | 'nutrition'> & { clientId: string };
export type MealPlanInput = Pick<MealPlan, 'name' | 'description'> & {
  clientId: string;
  items: Array<Omit<MealPlanItem, 'id'> & { clientId: string }>;
};

export interface AppState {
  version: 7;
  profile?: UserProfile;
  foods: FoodItem[];
  entries: FoodEntry[];
  weights: BodyMetricLog[];
  activities: ActivityEntry[];
  goals: DailyGoal[];
  plans: MealPlan[];
  recipes: Recipe[];
  nutritionProgram?: NutritionProgram;
}
