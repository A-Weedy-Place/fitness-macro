import { AppState, AssistantAction, AssistantPlan } from '../types';

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
  if (action.type === 'apply_plan' || action.type === 'delete_plan') return action.targetId && state.plans.some((plan) => plan.id === action.targetId) ? null : 'the saved day could not be matched';
  if (action.type === 'navigate') return action.destination ? null : 'the destination is missing';
  return 'the requested action is not supported';
}

export function assistantPlanIssue(plan: AssistantPlan, state: AppState, defaultDate?: string): string | null {
  if (!plan.actions.length) return 'the assistant returned no actions';
  for (const action of plan.actions) {
    const issue = assistantActionIssue(action, state, defaultDate);
    if (issue) return `${action.type}: ${issue}`;
  }
  return null;
}
