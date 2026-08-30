import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DailyGoal, UserProfile } from '../contracts.js';
import { requestGroqJson } from './groqJson.js';

interface AdviceDraft {
  summary: string;
  actions: string[];
  cautions: string[];
  meals: Array<{ label: string; time: string; foods: string[] }>;
}

export interface NutritionProgramResponse {
  summary: string;
  actions: string[];
  cautions: string[];
  meals: Array<{ label: string; time: string; targetCalories: number; targetProtein: number; foods: string[] }>;
  sources: Array<{ title: string; url: string }>;
  aiGenerated: boolean;
}

const providerDir = path.dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(fs.readFileSync(path.resolve(providerDir, '../../goal-plan/advice-output.schema.json'), 'utf8')) as Record<string, unknown>;
const sources = [
  { title: 'WHO: What are healthy diets?', url: 'https://www.who.int/publications/i/item/9789240101876' },
  { title: 'ICMR-NIN: Dietary Guidelines for Indians 2024', url: 'https://www.nin.res.in/dietaryguidelines/pdfjs/locale/DGI07052024P.pdf' },
  { title: 'Dietary Guidelines for Americans 2025–2030', url: 'https://odphp.health.gov/our-work/nutrition-physical-activity/dietary-guidelines' }
];

const SYSTEM = [
  'You personalize an evidence-informed food structure for a local-first nutrition app.',
  'The calorie and macro targets supplied by the app are locked safety calculations. Do not change them.',
  'Return practical sample meals, not medical treatment. Respect diet style and exclusions exactly.',
  'Prefer familiar Pakistani, Indian, South Asian, or Southeast Asian foods when the profile requests them.',
  'Use ordinary foods and realistic portions. Do not claim live web research, official approval, diagnosis, or guaranteed results.',
  'The output is a flexible example day; variety and user recipes remain allowed.'
].join('\n');

function distribution(count: number): number[] {
  if (count <= 2) return [0.45, 0.55];
  if (count === 3) return [0.3, 0.4, 0.3];
  if (count === 4) return [0.25, 0.35, 0.3, 0.1];
  if (count === 5) return [0.22, 0.1, 0.32, 0.1, 0.26];
  return [0.2, 0.08, 0.27, 0.08, 0.27, 0.1];
}

function allocate(total: number, shares: number[]): number[] {
  const values = shares.map((share) => Math.round(total * share));
  values[values.length - 1] += total - values.reduce((sum, value) => sum + value, 0);
  return values;
}

export async function personalizeGoal(profile: UserProfile, goal: DailyGoal, tdee: number): Promise<NutritionProgramResponse> {
  const requestedMeals = Math.min(6, Math.max(2, profile.mealsPerDay || 3));
  const result = await requestGroqJson<AdviceDraft>({
    system: SYSTEM,
    user: JSON.stringify({ profile: { sex: profile.sex, ageYears: profile.ageYears, heightCm: profile.heightCm, bodyWeightKg: profile.bodyWeightKg, targetWeightKg: profile.targetWeightKg, activityFactor: profile.activityFactor, goalMode: profile.goalMode, dietStyle: profile.dietStyle || 'omnivore', preferredCuisine: profile.preferredCuisine || 'south_asian', excludedFoods: profile.excludedFoods || 'none', mealsPerDay: requestedMeals }, lockedTargets: goal, estimatedMaintenanceCalories: tdee }),
    schemaName: 'nutrition_program_advice',
    schema
  });
  const meals = result.value.meals.slice(0, requestedMeals);
  const shares = distribution(meals.length);
  const calories = allocate(goal.calories, shares);
  const protein = allocate(goal.protein, shares);
  return {
    summary: result.value.summary,
    actions: result.value.actions,
    cautions: result.value.cautions,
    meals: meals.map((meal, index) => ({ ...meal, targetCalories: calories[index], targetProtein: protein[index] })),
    sources,
    aiGenerated: true
  };
}

export function localGoalAdvice(goal: DailyGoal, tdee: number, weeklyChangeKg: number): NutritionProgramResponse {
  const shares = distribution(3);
  const calories = allocate(goal.calories, shares);
  const protein = allocate(goal.protein, shares);
  const labels = [['Breakfast', '08:00'], ['Main meal', '13:00'], ['Evening meal', '19:00']] as const;
  return {
    summary: `The ${goal.calories} kcal target starts from an estimated ${tdee} kcal maintenance level and a bounded ${weeklyChangeKg} kg weekly direction.`,
    actions: ['Log food consistently before changing the target.', 'Build meals around a protein food, vegetables or fruit, and a measured starch or grain.', 'Review the rolling weight trend after at least two weeks.'],
    cautions: ['This estimate is not medical care. Seek qualified guidance for illness, pregnancy, an eating disorder, or concerning symptoms.'],
    meals: labels.map(([label, time], index) => ({ label, time, targetCalories: calories[index], targetProtein: protein[index], foods: ['Choose a protein-rich food', 'Add vegetables, fruit, or a whole grain'] })),
    sources,
    aiGenerated: false
  };
}
