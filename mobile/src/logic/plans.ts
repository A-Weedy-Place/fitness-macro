import { FoodEntry, MealPlan, MealPlanInput } from '../types';

export function buildPlanFromDay(input: {
  id: string;
  name: string;
  description?: string;
  entries: FoodEntry[];
  now: string;
  makeItemId: () => string;
}): { plan: MealPlan; payload: MealPlanInput } {
  const items = input.entries.map((entry) => ({
    id: input.makeItemId(),
    eatenAt: entry.eatenAt,
    mealType: entry.mealType,
    foodId: entry.foodId,
    portion: { ...entry.portion },
    note: entry.note
  }));
  const plan: MealPlan = {
    id: input.id,
    name: input.name,
    description: input.description,
    items,
    createdAt: input.now,
    updatedAt: input.now
  };
  return {
    plan,
    payload: {
      clientId: input.id,
      name: input.name,
      description: input.description,
      items: items.map((item) => ({ ...item, clientId: item.id }))
    }
  };
}

export function instantiatePlan(input: {
  plan: MealPlan;
  date: string;
  now: string;
  makeEntryId: () => string;
}): FoodEntry[] {
  return input.plan.items.map((item) => ({
    id: input.makeEntryId(),
    date: input.date,
    eatenAt: item.eatenAt,
    mealType: item.mealType,
    foodId: item.foodId,
    portion: { ...item.portion },
    note: item.note,
    enteredAt: input.now,
    source: { source: 'manual', confidence: 1 }
  }));
}
