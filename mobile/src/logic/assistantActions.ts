import type { AppState, AssistantAction, AssistantPlan, UserProfile } from '../types';
import { canonicalAssistantUnit } from './assistantExecution';

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
export function validAssistantDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^(19|20)\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function validAssistantTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
const UNITS = new Set(['g', 'kg', 'ml', 'l', 'cup', 'tbsp', 'tsp', 'piece', 'slice', 'bowl', 'plate', 'serving']);
export function assistantIngredientIssue(value: unknown): string | null {
  const ingredient = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  if (typeof ingredient.name !== 'string' || !ingredient.name.trim() || ingredient.name.length > 160) return 'a food name is missing';
  if (typeof ingredient.unit !== 'string' || !UNITS.has(canonicalAssistantUnit(ingredient.unit))) return 'a food unit is unsupported';
  if (!inRange(ingredient.quantity, 0.0001, 100_000) || !inRange(ingredient.gramsPerUnit, 0.001, 100_000) || ingredient.quantity * ingredient.gramsPerUnit > 1_000_000) return 'a food amount is invalid';
  const unit = canonicalAssistantUnit(ingredient.unit);
  if ((unit === 'g' && ingredient.gramsPerUnit !== 1) || (unit === 'kg' && ingredient.gramsPerUnit !== 1000)) return 'a gram unit has the wrong conversion';
  if (!inRange(ingredient.caloriesPer100g, 0, 1_000) || ![ingredient.proteinPer100g, ingredient.carbsPer100g, ingredient.fatPer100g].every((number) => inRange(number, 0, 100))) return 'food nutrition is outside usable bounds';
  if (!inRange(ingredient.confidence, 0, 1)) return 'food confidence is invalid';
  const protein = ingredient.proteinPer100g as number; const carbs = ingredient.carbsPer100g as number; const fat = ingredient.fatPer100g as number;
  if (protein + carbs + fat > 105 || protein * 4 + carbs * 4 + fat * 9 > ingredient.caloriesPer100g + Math.max(50, ingredient.caloriesPer100g * 0.3)) return 'food calories and macros disagree';
  return null;
}

/** Relay and phone share domain validation; record existence is checked separately. */
export function assistantActionDomainIssue(action: AssistantAction, profile?: UserProfile): string | null {
  if (!action || typeof action !== 'object') return 'the action is missing';
  if (!inRange(action.confidence, 0, 1)) return 'the action confidence is invalid';
  if (action.name != null && (typeof action.name !== 'string' || action.name.length > 160)) return 'the action name is invalid';
  if (action.date != null && !validAssistantDate(action.date)) return 'the date is invalid';
  if (action.time != null && !validAssistantTime(action.time)) return 'the time is invalid';
  if (action.targetDate != null && !validAssistantDate(action.targetDate)) return 'the target date is invalid';
  if (['log_foods', 'save_food', 'create_recipe', 'create_recipe_and_log'].includes(action.type)) {
    if (!Array.isArray(action.ingredients) || !action.ingredients.length || action.ingredients.length > 20) return 'the food ingredients are missing';
    for (const ingredient of action.ingredients) { const issue = assistantIngredientIssue(ingredient); if (issue) return issue; }
    if (action.type.startsWith('create_recipe')) {
      if (!action.name?.trim() || action.name.length > 160) return 'the new dish has no name';
      if (!inRange(action.servings, 0.01, 1_000)) return 'the recipe serving count is invalid';
      if (action.type === 'create_recipe_and_log' && !inRange(action.quantity, 0.0001, 1_000)) return 'the dish portion is invalid';
    }
    return null;
  }
  if (action.type === 'log_weight') return inRange(action.value, 20, 500) ? null : 'the weight must be between 20 and 500 kg';
  if (action.type === 'log_activity') return action.name?.trim() && inRange(action.durationMinutes, 1, 1440) && (action.calories == null || inRange(action.calories, 0, 20_000)) ? null : 'the activity duration or calories are invalid';
  if (action.type === 'change_entry_time') return action.date != null || action.time != null ? null : 'the new date or time is missing';
  if (action.type === 'set_goal') {
    if (!inRange(action.calories, 1200, 6000) || !inRange(action.protein, 1, 500) || !inRange(action.carbs, 0, 1500) || !inRange(action.fat, 0, 500)) return 'the goal is outside the app safety bounds';
    if (Math.abs(action.protein * 4 + action.carbs * 4 + action.fat * 9 - action.calories) > Math.max(80, action.calories * 0.05)) return 'the goal calories and macros disagree';
    if (profile) {
      const base = 10 * profile.bodyWeightKg + 6.25 * profile.heightCm - 5 * profile.ageYears + (profile.sex === 'male' ? 5 : profile.sex === 'female' ? -161 : -78);
      const tdee = profile.adaptiveTdee || Math.round(Math.round(base) * profile.activityFactor);
      if (action.calories < Math.max(1200, tdee * 0.7) - 1 || action.calories > tdee * 1.3 + 1) return 'the goal exceeds the calculated adjustment limit';
    }
    return null;
  }
  if (action.type === 'update_profile') {
    if (action.value != null && !inRange(action.value, 20, 500)) return 'the body weight is invalid';
    if (action.targetWeightKg != null && !inRange(action.targetWeightKg, 20, 500)) return 'the target weight is invalid';
    if (action.activityFactor != null && !inRange(action.activityFactor, 1.2, 2.4)) return 'the activity level is invalid';
    if (action.displayName != null && (typeof action.displayName !== 'string' || !action.displayName.trim() || action.displayName.length > 80)) return 'the profile name is invalid';
    if (action.goalMode != null && !['lose', 'maintain', 'gain', 'recompose'].includes(action.goalMode)) return 'the goal mode is invalid';
    if (action.goalIntensity != null && !['gentle', 'moderate', 'aggressive'].includes(action.goalIntensity)) return 'the goal intensity is invalid';
    return null;
  }
  if (action.type === 'navigate') return action.destination && ['today', 'plans', 'trends', 'assistant', 'library', 'profile'].includes(action.destination) ? null : 'the destination is invalid';
  if (['delete_entry', 'delete_weight', 'delete_activity', 'apply_plan', 'delete_plan', 'create_plan_from_day'].includes(action.type)) return null;
  return 'the requested action is unsupported';
}

function positive(value: number | null | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function validIngredients(action: AssistantAction): boolean {
  return action.ingredients.length > 0 && action.ingredients.every((ingredient) => (
    Boolean(ingredient.name.trim())
    && Boolean(ingredient.unit.trim())
    && positive(ingredient.quantity)
    && positive(ingredient.gramsPerUnit)
    && [ingredient.caloriesPer100g, ingredient.proteinPer100g, ingredient.carbsPer100g, ingredient.fatPer100g]
      .every((value) => Number.isFinite(value) && value >= 0)
  ));
}

/**
 * Returns a safe reason instead of letting an incomplete model plan reach the
 * Apply button. The plan is checked again on Apply in case the diary changed
 * while the confirmation card was open.
 */
export function assistantActionIssue(action: AssistantAction, state: AppState, defaultDate?: string): string | null {
  const domainIssue = assistantActionDomainIssue(action, state.profile);
  if (domainIssue) return domainIssue;
  if (action.type === 'log_foods' || action.type === 'save_food') {
    return validIngredients(action) ? null : 'a food item is missing its amount or nutrition';
  }
  if (action.type === 'create_recipe' || action.type === 'create_recipe_and_log') {
    if (!action.name?.trim()) return 'the new dish has no name';
    if (!validIngredients(action)) return 'the new dish has no usable ingredients';
    return null;
  }
  if (action.type === 'log_weight') return positive(action.value) ? null : 'the weight value is missing';
  if (action.type === 'log_activity') return action.name?.trim() && positive(action.durationMinutes) ? null : 'the activity name or duration is missing';
  if (action.type === 'change_entry_time' || action.type === 'delete_entry') return action.targetId && state.entries.some((entry) => entry.id === action.targetId) ? null : 'the diary item could not be matched';
  if (action.type === 'delete_weight') return action.targetId && state.weights.some((item) => item.id === action.targetId) ? null : 'the weight record could not be matched';
  if (action.type === 'delete_activity') return action.targetId && state.activities.some((item) => item.id === action.targetId) ? null : 'the activity could not be matched';
  if (action.type === 'set_goal') {
    const macrosValid = [action.carbs, action.fat].every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0);
    return positive(action.calories) && positive(action.protein) && macrosValid ? null : 'one or more goal values are missing';
  }
  if (action.type === 'update_profile') {
    const hasChange = [action.displayName, action.value, action.targetWeightKg, action.activityFactor, action.goalMode, action.goalIntensity, action.targetDate].some((value) => value != null);
    return state.profile && hasChange ? null : 'the profile change is incomplete';
  }
  if (action.type === 'create_plan_from_day') return action.name?.trim() && state.entries.some((entry) => entry.date === (action.date || defaultDate)) ? null : 'the day template has no name or foods';
  if (action.type === 'apply_plan' || action.type === 'delete_plan') return action.targetId && state.plans.some((plan) => plan.id === action.targetId && (action.type !== 'apply_plan' || plan.items.length > 0)) ? null : 'the saved day could not be matched or is empty';
  if (action.type === 'navigate') return action.destination ? null : 'the destination is missing';
  return 'the requested action is not supported';
}

export function assistantPlanIssue(plan: AssistantPlan, state: AppState, defaultDate?: string): string | null {
  if (!Array.isArray(plan.actions) || !plan.actions.length || plan.actions.length > 8) return 'the assistant returned no usable actions';
  for (const action of plan.actions) {
    const issue = assistantActionIssue(action, state, defaultDate);
    if (issue) return `${action.type}: ${issue}`;
  }
  return null;
}
