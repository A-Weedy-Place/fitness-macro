import { AppState, FoodItem, PendingOperation } from '../types';
import { removeActivity, removeEntry, removePlan, removeWeight, saveState, setProfile, upsertActivity, upsertEntry, upsertFood, upsertGoal, upsertPlan, upsertWeight } from '../storage/localDb';
import * as agent from './agentClient';

function mergeFoods(state: AppState, foods: FoodItem[]): AppState {
  return foods.reduce((next, food) => upsertFood(next, food), state);
}

export async function searchAndCacheFoods(state: AppState, query: string): Promise<{ state: AppState; items: FoodItem[] }> {
  const result = await agent.searchFoods(query, 8);
  const next = mergeFoods(state, result.items);
  await saveState(next);
  return { state: next, items: result.items };
}

async function sendOperation(state: AppState, operation: PendingOperation): Promise<AppState> {
  switch (operation.kind) {
    case 'food': {
      const response = await agent.createCustomFood(operation.payload);
      return upsertFood(state, response.item);
    }
    case 'entry': {
      const response = await agent.upsertEntry(operation.payload);
      return upsertEntry(state, response.item);
    }
    case 'weight': {
      const response = await agent.logWeight(operation.payload);
      return upsertWeight(state, response.item);
    }
    case 'activity': {
      const response = await agent.logActivity(operation.payload);
      return upsertActivity(state, response.item);
    }
    case 'profile': {
      const response = await agent.saveProfile(operation.payload);
      return upsertGoal(setProfile(state, response.profile), response.recommendedGoal);
    }
    case 'goal': {
      const response = await agent.saveGoal(operation.payload);
      return upsertGoal(state, response.item);
    }
    case 'plan': {
      const response = await agent.saveMealPlan(operation.payload);
      return upsertPlan(state, response.item);
    }
    case 'deleteEntry':
      await agent.deleteEntry(operation.payload.id);
      return removeEntry(state, operation.payload.id);
    case 'deleteWeight':
      await agent.deleteWeight(operation.payload.id);
      return removeWeight(state, operation.payload.id);
    case 'deleteActivity':
      await agent.deleteActivity(operation.payload.id);
      return removeActivity(state, operation.payload.id);
    case 'deletePlan':
      await agent.deletePlan(operation.payload.id);
      return removePlan(state, operation.payload.id);
  }
}

export async function flushPendingOperations(state: AppState) {
  let next = state;
  const remaining: PendingOperation[] = [];
  let synced = 0;
  for (const operation of state.pendingOperations) {
    try {
      next = await sendOperation(next, operation);
      synced += 1;
    } catch {
      remaining.push(operation);
    }
  }
  next = {
    ...next,
    pendingOperations: remaining,
    lastSyncedAt: synced > 0 ? new Date().toISOString() : next.lastSyncedAt
  };
  await saveState(next);
  return { state: next, synced, failed: remaining.length };
}

export async function pullDayFromAgent(state: AppState, date: string): Promise<AppState> {
  const [entries, weights, activities, goals, plans] = await Promise.all([
    agent.listEntriesForDate(date),
    agent.listWeights(),
    agent.listActivities(date, date),
    agent.listGoals(date, date),
    agent.listPlans()
  ]);
  let next = state;
  for (const item of entries) next = upsertEntry(next, item);
  for (const item of weights) next = upsertWeight(next, item);
  for (const item of activities) next = upsertActivity(next, item);
  for (const item of goals) next = upsertGoal(next, item);
  for (const item of plans) next = upsertPlan(next, item);
  next = { ...next, lastSyncedAt: new Date().toISOString() };
  await saveState(next);
  return next;
}

export async function pullAllFromAgent(state: AppState): Promise<AppState> {
  const [entries, weights, activities, goals, plans] = await Promise.all([
    agent.listAllEntries(),
    agent.listWeights(),
    agent.listActivities(),
    agent.listGoals(),
    agent.listPlans()
  ]);
  let next = state;
  for (const item of entries) next = upsertEntry(next, item);
  for (const item of weights) next = upsertWeight(next, item);
  for (const item of activities) next = upsertActivity(next, item);
  for (const item of goals) next = upsertGoal(next, item);
  for (const item of plans) next = upsertPlan(next, item);
  next = { ...next, lastSyncedAt: new Date().toISOString() };
  await saveState(next);
  return next;
}
