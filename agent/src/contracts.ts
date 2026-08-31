import { z } from 'zod';

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
  barcode?: string;
  serving: {
    unit: string;
    amount: number;
    gramsPerUnit: number;
  };
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
  source: 'strava' | 'manual';
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

export interface SyncEvent {
  id: string;
  type: 'created' | 'updated' | 'deleted';
  resource: 'food' | 'entry' | 'weight' | 'activity' | 'goal' | 'profile' | 'plan';
  resourceId: string;
  createdAt: string;
}

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
  adaptiveTdee?: number;
  adaptiveTdeeUpdatedAt?: string;
  dietStyle?: 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian';
  preferredCuisine?: 'pakistani' | 'indian' | 'south_asian' | 'southeast_asian' | 'mixed';
  excludedFoods?: string;
  mealsPerDay?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DbSchema {
  version: 5;
  userProfile?: UserProfile;
  foodItems: FoodItem[];
  entries: FoodEntry[];
  weights: BodyMetricLog[];
  activities: ActivityEntry[];
  goals: DailyGoal[];
  plans: MealPlan[];
  syncEvents: SyncEvent[];
}

export interface SearchResponse {
  query: string;
  items: FoodItem[];
  fromCache: boolean;
  cachedCount: number;
}

export type AgentIntent = 'log_foods' | 'create_recipe_and_log' | 'clarify';

export interface AgentActionPlan {
  intent: AgentIntent;
  title: string;
  summary: string;
  requiresConfirmation: boolean;
  clarification?: string;
  dish?: {
    name: string;
    servings: number;
    finalWeightGrams: number;
  };
  items: Array<{
    foodId: string;
    quantity: number;
    unit: string;
    confidence: number;
  }>;
  log: {
    date: string;
    eatenAt: string;
    quantity: number;
  };
}

export interface ResolveResponse {
  transcript: string;
  candidates: FoodItem[];
  suggestions?: Array<{
    foodId: string;
    quantity: number;
    unit: string;
    confidence: number;
    sourceUrl?: string;
  }>;
  notes: string[];
  plan?: AgentActionPlan;
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const clientIdSchema = z.string().min(1).max(120).optional();

export const ResolveSchema = z.object({
  transcript: z.string().min(1).max(4000),
  defaultDate: dateSchema,
  defaultTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  context: z.unknown().optional()
});

export const AppCommandSchema = z.object({
  command: z.string().min(1).max(4000),
  context: z.unknown()
});

export const WeightSchema = z.object({
  clientId: clientIdSchema,
  date: dateSchema,
  weightKg: z.number().positive().max(500),
  bodyFatPercent: z.number().min(0).max(100).optional(),
  waistCm: z.number().positive().max(500).optional(),
  notes: z.string().max(500).optional()
});

export const FoodEntrySchema = z.object({
  clientId: clientIdSchema,
  date: dateSchema,
  eatenAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  mealType: z.enum(mealTypes),
  foodId: z.string().min(1),
  portion: z.object({
    foodId: z.string().min(1),
    quantity: z.number().positive().max(100000),
    unit: z.string().min(1).max(40)
  }),
  note: z.string().max(500).optional()
});

export const ActivitySchema = z.object({
  clientId: clientIdSchema,
  date: dateSchema,
  name: z.string().min(1).max(120),
  type: z.string().min(1).max(80),
  durationMinutes: z.number().positive().max(1440),
  distanceMeters: z.number().nonnegative().max(1_000_000).optional(),
  caloriesEstimated: z.number().nonnegative().max(20_000)
});

export const ProfileSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  profilePhotoUri: z.string().max(2_000).optional(),
  sex: z.enum(['male', 'female', 'other']),
  ageYears: z.number().int().min(13).max(120),
  heightCm: z.number().min(80).max(260),
  bodyWeightKg: z.number().min(25).max(500),
  targetWeightKg: z.number().min(25).max(500).optional(),
  activityFactor: z.number().min(1.1).max(2.5),
  weeklyWeightChangeKg: z.number().min(-1.5).max(1),
  goalMode: z.enum(['lose', 'maintain', 'gain', 'recompose']).optional(),
  goalIntensity: z.enum(['gentle', 'moderate', 'aggressive']).optional(),
  targetDate: dateSchema.optional(),
  onboardingComplete: z.boolean().optional()
  ,preferredHeightUnit: z.enum(['cm', 'ft']).optional(),
  preferredWeightUnit: z.enum(['kg', 'lb']).optional()
  ,adaptiveTdee: z.number().min(800).max(10000).optional(),
  adaptiveTdeeUpdatedAt: z.string().datetime().optional()
  ,dietStyle: z.enum(['omnivore', 'vegetarian', 'vegan', 'pescatarian']).optional(),
  preferredCuisine: z.enum(['pakistani', 'indian', 'south_asian', 'southeast_asian', 'mixed']).optional(),
  excludedFoods: z.string().max(500).optional(),
  mealsPerDay: z.number().int().min(2).max(6).optional()
});

export const DailyGoalSchema = z.object({
  date: dateSchema,
  calories: z.number().positive().max(20_000),
  protein: z.number().nonnegative().max(2000),
  carbs: z.number().nonnegative().max(3000),
  fat: z.number().nonnegative().max(1000)
});

export const CustomFoodSchema = z.object({
  clientId: clientIdSchema,
  name: z.string().min(1).max(160),
  brand: z.string().max(120).optional(),
  barcode: z.string().max(80).optional(),
  serving: z.object({
    unit: z.string().min(1).max(40),
    amount: z.number().positive(),
    gramsPerUnit: z.number().positive()
  }),
  nutrition: z.object({
    calories: z.number().nonnegative().max(5000),
    protein: z.number().nonnegative().max(1000),
    carbs: z.number().nonnegative().max(1000),
    fat: z.number().nonnegative().max(1000),
    fiber: z.number().nonnegative().max(1000).optional(),
    sugar: z.number().nonnegative().max(1000).optional(),
    sodiumMg: z.number().nonnegative().max(1_000_000).optional()
  })
});

export const MealPlanSchema = z.object({
  clientId: clientIdSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  items: z.array(z.object({
    clientId: clientIdSchema,
    eatenAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    mealType: z.enum(mealTypes),
    foodId: z.string().min(1),
    portion: z.object({
      foodId: z.string().min(1),
      quantity: z.number().positive().max(100000),
      unit: z.string().min(1).max(40)
    }),
    note: z.string().max(500).optional()
  })).min(1).max(100)
});
