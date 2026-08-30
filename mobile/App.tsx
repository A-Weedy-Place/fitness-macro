import React, { useEffect, useState } from 'react';
import { Alert, AppState as NativeAppState, DevSettings, LayoutAnimation, Linking, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityEntry,
  ActivityInput,
  AgentResolution,
  AssistantAction,
  AssistantMessage,
  AssistantPlan,
  AppState,
  BodyMetricLog,
  CustomFoodInput,
  FoodEntry,
  FoodEntryInput,
  FoodItem,
  MealPlan,
  MealType,
  PendingOperation,
  ProfileInput,
  Recipe,
  RecipeInput,
  UserProfile,
  WeightInput
} from './src/types';
import {
  EMPTY_STATE,
  enqueueOperation,
  loadState,
  removeActivity,
  removeEntry,
  removePlan,
  removeWeight,
  saveState,
  setProfile,
  upsertActivity,
  upsertEntry,
  upsertFood,
  upsertGoal,
  upsertPlan,
  upsertRecipe,
  upsertWeight
} from './src/storage/localDb';
import { flushPendingOperations, pullAllFromAgent, searchAndCacheFoods } from './src/services/sync';
import { agentStatus, audioStatus, getGoalRecommendation, getStravaAuthorizationUrl, getStravaStatus, GoalReviewResponse, lookupFoodByBarcode, planAssistantCommand, resolveTranscript, StravaStatus, syncStrava, transcribeRecording } from './src/services/agentClient';
import { recommendDailyGoal } from './src/logic/tdee';
import { buildPlanFromDay, instantiatePlan } from './src/logic/plans';
import { shiftDate, today } from './src/utils/dates';
import { BottomTabs, TabKey } from './src/components/ui';
import { TodayScreen } from './src/screens/TodayScreen';
import { PlansScreen } from './src/screens/PlansScreen';
import { TrendsScreen } from './src/screens/TrendsScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { AssistantScreen } from './src/screens/AssistantScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { activeTheme, AppThemeName, atmosphere, colors, isDarkTheme, saveAppTheme } from './src/theme';
import { withDemoData } from './src/logic/demoData';
import { createPortableBackup, restorePortableBackup } from './src/logic/backup';
import { QuickLogSheet, PlateItem } from './src/components/QuickLogSheet';
import { calculateRecipe } from './src/logic/recipes';
import { currentTime, mealForTime } from './src/logic/time';
import { estimateActivityCalories } from './src/logic/activityEnergy';
import { HealthConnectStatus, openHealthConnectSettings, syncStravaCaloriesFromHealthConnect } from './src/services/healthConnect';

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function now() {
  return new Date().toISOString();
}

export default function App() {
  return <SafeAreaProvider><FitnessApp /></SafeAreaProvider>;
}

function FitnessApp() {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('today');
  const [date, setDate] = useState(today());
  const [libraryTime, setLibraryTime] = useState('08:00');
  const [quickLogVisible, setQuickLogVisible] = useState(false);
  const [quickLogTime, setQuickLogTime] = useState('12:00');
  const [status, setStatus] = useState('All data is stored locally first.');
  const [strava, setStrava] = useState<StravaStatus | null>(null);
  const [audioConfigured, setAudioConfigured] = useState<boolean | null>(null);
  const [appAgentEnabled, setAppAgentEnabled] = useState<boolean | null>(null);
  const [goalReview, setGoalReview] = useState<GoalReviewResponse | null>(null);
  const [healthConnect, setHealthConnect] = useState<HealthConnectStatus | null>(null);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [assistantPlan, setAssistantPlan] = useState<AssistantPlan | null>(null);
  const [assistantBusy, setAssistantBusy] = useState(false);

  useEffect(() => {
    void loadState().then((loaded) => {
      setState(loaded);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) void saveState(state);
  }, [state, hydrated]);

  useEffect(() => {
    if (hydrated && activeTab === 'profile') void refreshIntegrationStatus();
  }, [hydrated, activeTab]);

  useEffect(() => {
    if (!hydrated) return;
    void refreshHealthConnect(false);
    const subscription = NativeAppState.addEventListener('change', (next) => { if (next === 'active') void refreshHealthConnect(false); });
    return () => subscription.remove();
  }, [hydrated]);

  function changeTab(tab: TabKey) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
  }

  async function commit(nextState: AppState, operations: PendingOperation[], success: string) {
    let queued = nextState;
    for (const operation of operations) queued = enqueueOperation(queued, operation);
    setState(queued);
    const result = await flushPendingOperations(queued);
    setState(result.state);
    setStatus(result.failed ? `${success}. ${result.failed} change(s) are waiting for the PC.` : `${success}. Synced with the PC.`);
  }

  function operation<K extends PendingOperation['kind']>(kind: K, payload: Extract<PendingOperation, { kind: K }>['payload']): Extract<PendingOperation, { kind: K }> {
    return { id: makeId('op'), kind, payload, createdAt: now() } as Extract<PendingOperation, { kind: K }>;
  }

  async function addPlate(items: PlateItem[], eatenAt: string, logDate = date) {
    const mealType = mealForTime(eatenAt);
    const enteredAt = now();
    let next = state;
    const operations: PendingOperation[] = [];
    const queuedFoods = new Set<string>();
    for (const item of items) {
      const id = makeId('entry');
      const payload: FoodEntryInput = { clientId: id, date: logDate, eatenAt, mealType, foodId: item.food.id, portion: { foodId: item.food.id, quantity: item.quantity, unit: item.food.serving.unit }, note: item.note };
      const entry: FoodEntry = { id, date: logDate, eatenAt, mealType, foodId: item.food.id, portion: payload.portion, note: item.note, enteredAt, source: { source: 'manual', confidence: 1 } };
      next = upsertEntry(next, entry);
      if (item.food.tags?.includes('starter') && !queuedFoods.has(item.food.id)) {
        queuedFoods.add(item.food.id);
        operations.push(operation('food', { clientId: item.food.id, name: item.food.name, brand: item.food.brand, barcode: item.food.barcode, serving: item.food.serving, nutrition: item.food.nutrition }));
      }
      operations.push(operation('entry', payload));
    }
    await commit(next, operations, `${items.length} food${items.length === 1 ? '' : 's'} added at ${eatenAt}`);
  }

  async function addFoodEntry(food: FoodItem, quantity: number, eatenAt: string, note?: string) {
    await addPlate([{ food, quantity, note }], eatenAt);
  }

  async function addWeight(weightKg: number) {
    const id = makeId('weight');
    const enteredAt = now();
    const payload: WeightInput = { clientId: id, date, weightKg };
    const item: BodyMetricLog = { id, date, weightKg, enteredAt };
    await commit(upsertWeight(state, item), [operation('weight', payload)], 'Weight logged');
  }

  async function addActivity(name: string, durationMinutes: number) {
    const id = makeId('activity');
    const createdAt = now();
    const currentWeight = state.weights.filter((item) => item.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0]?.weightKg || state.profile?.bodyWeightKg || 75;
    const caloriesEstimated = estimateActivityCalories(name, durationMinutes, currentWeight).calories;
    const payload: ActivityInput = { clientId: id, date, name, type: name.toLowerCase(), durationMinutes, caloriesEstimated };
    const item: ActivityEntry = { id, date, name, type: payload.type, durationMinutes, caloriesEstimated, source: 'manual', createdAt };
    await commit(upsertActivity(state, item), [operation('activity', payload)], 'Activity logged');
  }

  async function createCustomFood(values: { name: string; brand?: string; servingGrams: number; calories: number; protein: number; carbs: number; fat: number }) {
    const id = makeId('food');
    const timestamp = now();
    const scale = 100 / values.servingGrams;
    const payload: CustomFoodInput = {
      clientId: id,
      name: values.name,
      brand: values.brand,
      serving: { unit: 'serving', amount: 1, gramsPerUnit: values.servingGrams },
      nutrition: { calories: values.calories * scale, protein: values.protein * scale, carbs: values.carbs * scale, fat: values.fat * scale }
    };
    const food: FoodItem = { id, name: payload.name, brand: payload.brand, serving: payload.serving, nutrition: payload.nutrition, createdAt: timestamp, updatedAt: timestamp, source: { source: 'manual', confidence: 1 } };
    await commit(upsertFood(state, food), [operation('food', payload)], `${food.name} saved to your library`);
    return food;
  }

  async function searchFoods(query: string) {
    const local = state.foods.filter((food) => `${food.name} ${food.brand || ''}`.toLowerCase().includes(query.toLowerCase()));
    try {
      const result = await searchAndCacheFoods(state, query);
      setState(result.state);
      const combined = [...local, ...result.items];
      const unique = combined.filter((food, index) => combined.findIndex((candidate) => candidate.id === food.id) === index);
      const normalized = query.toLowerCase().trim();
      const score = (food: FoodItem) => {
        const name = food.name.toLowerCase();
        const relevance = name === normalized ? 100 : name.startsWith(normalized) ? 80 : name.includes(normalized) ? 60 : normalized.split(/\s+/).filter((token) => name.includes(token)).length * 10;
        const source = food.tags?.includes('recipe') || food.tags?.includes('custom-dish') ? 10000 : food.source.source === 'manual' ? 5000 : food.tags?.includes('starter') ? 25 : food.source.source === 'local' ? 20 : food.source.source === 'usda' ? 10 : 0;
        return relevance + source;
      };
      return unique.sort((a, b) => score(b) - score(a));
    } catch (error) {
      if (local.length) return local;
      throw error;
    }
  }

  async function barcodeFood(code: string) {
    const response = await lookupFoodByBarcode(code);
    setState((current) => upsertFood(current, response.item));
    return response.item;
  }

  async function resolveFoods(phrase: string, defaultTime = currentTime()): Promise<AgentResolution> {
    const response = await resolveTranscript(phrase, date, defaultTime, assistantContext());
    setState((current) => response.candidates.reduce((next, food) => upsertFood(next, food), current));
    return {
      foods: response.candidates,
      transcript: response.transcript,
      quantities: Object.fromEntries((response.suggestions || []).map((suggestion) => [suggestion.foodId, suggestion.quantity])),
      notes: response.notes,
      plan: response.plan
    };
  }

  async function executeAgentResolution(resolution: AgentResolution, fallbackTime: string) {
    const plan = resolution.plan;
    if (!plan || plan.intent === 'clarify') throw new Error(plan?.clarification || 'The assistant needs more detail.');
    const resolvedById = new Map([...state.foods, ...resolution.foods].map((food) => [food.id, food]));
    if (plan.intent === 'log_foods') {
      const items = plan.items.map((item) => resolvedById.get(item.foodId)).filter((food): food is FoodItem => Boolean(food)).map((food) => ({ food, quantity: plan.items.find((item) => item.foodId === food.id)?.quantity || food.serving.amount, note: `AI resolved from: ${resolution.transcript}` }));
      if (!items.length) throw new Error('The assistant could not match a reliable food.');
      await addPlate(items, plan.log.eatenAt || fallbackTime, plan.log.date || date);
      return;
    }
    const ingredients = plan.items.filter((item) => resolvedById.has(item.foodId)).map((item) => ({ foodId: item.foodId, quantity: item.quantity, unit: item.unit }));
    const availableFoods = [...resolvedById.values()];
    const calculation = calculateRecipe(ingredients, availableFoods, plan.dish?.finalWeightGrams);
    if (!ingredients.length || !calculation.finalGrams) throw new Error('The assistant could not build this dish from reliable ingredients.');
    const timestamp = now();
    const foodId = makeId('recipe_food');
    const recipeId = makeId('recipe');
    const servings = Math.max(plan.dish?.servings || 1, 1);
    const confidence = plan.items.reduce((sum, item) => sum + item.confidence, 0) / Math.max(plan.items.length, 1);
    const food: FoodItem = { id: foodId, name: plan.dish?.name || plan.title, serving: { unit: 'serving', amount: 1, gramsPerUnit: calculation.finalGrams / servings }, nutrition: calculation.per100g, tags: ['recipe', 'custom-dish', 'ai-created'], createdAt: timestamp, updatedAt: timestamp, source: { source: 'llm', confidence } };
    const recipe: Recipe = { id: recipeId, name: food.name, servings, finalWeightGrams: calculation.finalGrams, ingredients, foodId, sourceDescription: resolution.transcript, createdAt: timestamp, updatedAt: timestamp };
    const entryId = makeId('entry');
    const eatenAt = plan.log.eatenAt || fallbackTime;
    const logDate = plan.log.date || date;
    const mealType = mealForTime(eatenAt);
    const entryPayload: FoodEntryInput = { clientId: entryId, date: logDate, eatenAt, mealType, foodId, portion: { foodId, quantity: plan.log.quantity || 1, unit: 'serving' }, note: 'Created and logged by the AI assistant.' };
    const entry: FoodEntry = { id: entryId, date: logDate, eatenAt, mealType, foodId, portion: entryPayload.portion, note: entryPayload.note, enteredAt: timestamp, source: { source: 'llm', confidence } };
    let next = state;
    for (const resolved of resolution.foods) next = upsertFood(next, resolved);
    next = upsertEntry(upsertRecipe(upsertFood(next, food), recipe), entry);
    const foodPayload: CustomFoodInput = { clientId: foodId, name: food.name, serving: food.serving, nutrition: food.nutrition };
    await commit(next, [operation('food', foodPayload), operation('entry', entryPayload)], `${food.name} created, saved, and logged`);
  }

  function changeTheme(theme: AppThemeName) {
    if (theme === activeTheme) return;
    saveAppTheme(theme);
    setTimeout(() => DevSettings.reload(), 80);
  }

  async function transcribeFood(uri: string) {
    const result = await transcribeRecording(uri);
    setStatus(`Audio transcribed by ${result.engine}; raw audio was not retained.`);
    return result.text;
  }

  async function refreshHealthConnect(requestAccess: boolean) {
    const result = await syncStravaCaloriesFromHealthConnect(requestAccess);
    setHealthConnect(result.status);
    if (result.activities.length) setState((current) => result.activities.reduce((next, activity) => upsertActivity(next, activity), current));
    if (requestAccess) setStatus(result.activities.length ? `${result.activities.length} Strava calorie record(s) imported from Health Connect.` : result.status.message);
  }

  function assistantContext() {
    const names = new Map(state.foods.map((food) => [food.id, food.name]));
    return {
      currentDate: date,
      currentTime: currentTime(),
      profile: state.profile,
      goals: state.goals.slice(-30),
      entries: state.entries.slice(-500).map((entry) => ({ id: entry.id, date: entry.date, time: entry.eatenAt, mealType: entry.mealType, foodId: entry.foodId, foodName: names.get(entry.foodId), quantity: entry.portion.quantity, unit: entry.portion.unit })),
      weights: state.weights.slice(-120),
      activities: state.activities.slice(-120),
      recipes: state.recipes.map((recipe) => ({ id: recipe.id, foodId: recipe.foodId, name: recipe.name, servings: recipe.servings, ingredients: recipe.ingredients.map((item) => ({ ...item, foodName: names.get(item.foodId) })) })),
      plans: state.plans.map((plan) => ({ id: plan.id, name: plan.name, description: plan.description, itemCount: plan.items.length })),
      userFoods: [...new Map([...state.foods.filter((food) => food.source.source === 'manual' || food.tags?.includes('recipe')), ...state.foods.slice(-500)].map((food) => [food.id, food])).values()].map((food) => ({ id: food.id, name: food.name, brand: food.brand, serving: food.serving, nutrition: food.nutrition, tags: food.tags, source: food.source, createdAt: food.createdAt, updatedAt: food.updatedAt })),
      capabilities: ['read app data', 'log/save food', 'create/log dishes', 'log weight', 'log activity', 'change diary time/date', 'delete records', 'set goals', 'update profile', 'create/apply/delete plans', 'navigate']
    };
  }

  async function askAssistant(command: string) {
    const userMessage: AssistantMessage = { id: makeId('message'), role: 'user', text: command, createdAt: now() };
    setAssistantMessages((current) => [...current, userMessage]);
    setAssistantPlan(null);
    setAssistantBusy(true);
    try {
      const plan = await planAssistantCommand(command, assistantContext());
      setAssistantMessages((current) => [...current, { id: makeId('message'), role: 'assistant', text: plan.reply, createdAt: now() }]);
      setAssistantPlan(plan.actions.length ? plan : null);
    } catch (error) {
      setAssistantMessages((current) => [...current, { id: makeId('message'), role: 'assistant', text: error instanceof Error ? error.message : 'The local agent could not prepare a plan.', createdAt: now() }]);
    } finally {
      setAssistantBusy(false);
    }
  }

  async function executeAssistantPlan() {
    if (!assistantPlan?.actions.length) return;
    setAssistantBusy(true);
    try {
      let next = state;
      const operations: PendingOperation[] = [];
      let destination: TabKey | null = null;
      const timestamp = now();
      const foodFor = (ingredient: AssistantAction['ingredients'][number]): FoodItem => {
        const existing = next.foods.find((food) => food.name.toLowerCase() === ingredient.name.toLowerCase() && (food.brand || '').toLowerCase() === (ingredient.brand || '').toLowerCase());
        if (existing) return existing;
        const food: FoodItem = { id: makeId('ai_food'), name: ingredient.name, brand: ingredient.brand || undefined, serving: { unit: ingredient.unit, amount: 1, gramsPerUnit: ingredient.gramsPerUnit }, nutrition: { calories: ingredient.caloriesPer100g, protein: ingredient.proteinPer100g, carbs: ingredient.carbsPer100g, fat: ingredient.fatPer100g }, tags: ['ai-created'], createdAt: timestamp, updatedAt: timestamp, source: { source: 'llm', confidence: ingredient.confidence } };
        next = upsertFood(next, food);
        operations.push(operation('food', { clientId: food.id, name: food.name, brand: food.brand, serving: food.serving, nutrition: food.nutrition }));
        return food;
      };
      const addEntry = (food: FoodItem, quantity: number, entryDate: string, eatenAt: string, note: string) => {
        const id = makeId('entry'); const mealType = mealForTime(eatenAt);
        const payload: FoodEntryInput = { clientId: id, date: entryDate, eatenAt, mealType, foodId: food.id, portion: { foodId: food.id, quantity, unit: food.serving.unit }, note };
        next = upsertEntry(next, { id, date: entryDate, eatenAt, mealType, foodId: food.id, portion: payload.portion, note, enteredAt: timestamp, source: { source: 'llm', confidence: 1 } });
        operations.push(operation('entry', payload));
      };
      for (const action of assistantPlan.actions) {
        const actionDate = action.date || date; const actionTime = action.time || currentTime();
        if (action.type === 'save_food') action.ingredients.forEach(foodFor);
        else if (action.type === 'log_foods') action.ingredients.forEach((ingredient) => { const food = foodFor(ingredient); addEntry(food, ingredient.quantity, actionDate, actionTime, 'Logged by the AI assistant.'); });
        else if (action.type === 'create_recipe' || action.type === 'create_recipe_and_log') {
          const recipeIngredients = action.ingredients.map((ingredient) => { const food = foodFor(ingredient); return { foodId: food.id, quantity: ingredient.quantity, unit: ingredient.unit }; });
          const calculation = calculateRecipe(recipeIngredients, next.foods);
          if (!calculation.finalGrams) continue;
          const foodId = makeId('recipe_food'); const recipeId = makeId('recipe'); const servings = Math.max(action.servings || 1, 1);
          const dish: FoodItem = { id: foodId, name: action.name || 'AI dish', serving: { unit: 'serving', amount: 1, gramsPerUnit: calculation.finalGrams / servings }, nutrition: calculation.per100g, tags: ['recipe', 'custom-dish', 'ai-created'], createdAt: timestamp, updatedAt: timestamp, source: { source: 'llm', confidence: action.confidence } };
          const recipe: Recipe = { id: recipeId, name: dish.name, servings, finalWeightGrams: calculation.finalGrams, ingredients: recipeIngredients, foodId, sourceDescription: action.summary, createdAt: timestamp, updatedAt: timestamp };
          next = upsertRecipe(upsertFood(next, dish), recipe);
          operations.push(operation('food', { clientId: dish.id, name: dish.name, serving: dish.serving, nutrition: dish.nutrition }));
          if (action.type === 'create_recipe_and_log') addEntry(dish, action.quantity || 1, actionDate, actionTime, 'Created and logged by the AI assistant.');
        } else if (action.type === 'log_weight' && action.value) {
          const id = makeId('weight'); const payload: WeightInput = { clientId: id, date: actionDate, weightKg: action.value };
          next = upsertWeight(next, { id, date: actionDate, weightKg: action.value, enteredAt: timestamp }); operations.push(operation('weight', payload));
        } else if (action.type === 'log_activity' && action.name && action.durationMinutes) {
          const id = makeId('activity'); const calories = action.calories ?? estimateActivityCalories(action.name, action.durationMinutes, next.profile?.bodyWeightKg || 75).calories;
          const payload: ActivityInput = { clientId: id, date: actionDate, name: action.name, type: action.name.toLowerCase(), durationMinutes: action.durationMinutes, caloriesEstimated: calories };
          next = upsertActivity(next, { id, date: actionDate, name: action.name, type: payload.type, durationMinutes: action.durationMinutes, caloriesEstimated: calories, source: 'manual', createdAt: timestamp }); operations.push(operation('activity', payload));
        } else if (action.type === 'change_entry_time' && action.targetId) {
          const entry = next.entries.find((item) => item.id === action.targetId); if (!entry) continue;
          const updated = { ...entry, date: actionDate || entry.date, eatenAt: actionTime, mealType: mealForTime(actionTime) };
          next = upsertEntry(next, updated); operations.push(operation('entry', { clientId: updated.id, date: updated.date, eatenAt: updated.eatenAt, mealType: updated.mealType, foodId: updated.foodId, portion: updated.portion, note: updated.note }));
        } else if (action.type === 'delete_entry' && action.targetId) { next = removeEntry(next, action.targetId); operations.push(operation('deleteEntry', { id: action.targetId })); }
        else if (action.type === 'delete_weight' && action.targetId) { next = removeWeight(next, action.targetId); operations.push(operation('deleteWeight', { id: action.targetId })); }
        else if (action.type === 'delete_activity' && action.targetId) { next = removeActivity(next, action.targetId); operations.push(operation('deleteActivity', { id: action.targetId })); }
        else if (action.type === 'set_goal' && action.calories != null && action.protein != null && action.carbs != null && action.fat != null) {
          const goal = { date: actionDate, calories: action.calories, protein: action.protein, carbs: action.carbs, fat: action.fat }; next = upsertGoal(next, goal); operations.push(operation('goal', goal));
        } else if (action.type === 'update_profile' && next.profile) {
          const current = next.profile; const input: ProfileInput = { displayName: action.displayName ?? current.displayName, sex: current.sex, ageYears: current.ageYears, heightCm: current.heightCm, bodyWeightKg: action.value ?? current.bodyWeightKg, targetWeightKg: action.targetWeightKg ?? current.targetWeightKg, activityFactor: action.activityFactor ?? current.activityFactor, weeklyWeightChangeKg: current.weeklyWeightChangeKg, goalMode: action.goalMode ?? current.goalMode, goalIntensity: action.goalIntensity ?? current.goalIntensity, targetDate: action.targetDate ?? current.targetDate, onboardingComplete: true, preferredHeightUnit: current.preferredHeightUnit, preferredWeightUnit: current.preferredWeightUnit, adaptiveTdee: current.adaptiveTdee, adaptiveTdeeUpdatedAt: current.adaptiveTdeeUpdatedAt };
          next = setProfile(next, { ...current, ...input, updatedAt: timestamp }); operations.push(operation('profile', input));
        } else if (action.type === 'create_plan_from_day' && action.name) {
          const built = buildPlanFromDay({ id: makeId('plan'), name: action.name, description: action.summary, entries: next.entries.filter((entry) => entry.date === actionDate), now: timestamp, makeItemId: () => makeId('plan_item') }); next = upsertPlan(next, built.plan); operations.push(operation('plan', built.payload));
        } else if (action.type === 'apply_plan' && action.targetId) {
          const plan = next.plans.find((item) => item.id === action.targetId); if (!plan) continue;
          const entries = instantiatePlan({ plan, date: actionDate, now: timestamp, makeEntryId: () => makeId('entry') });
          for (const entry of entries) { next = upsertEntry(next, entry); operations.push(operation('entry', { clientId: entry.id, date: entry.date, eatenAt: entry.eatenAt, mealType: entry.mealType, foodId: entry.foodId, portion: entry.portion, note: entry.note })); }
        } else if (action.type === 'delete_plan' && action.targetId) { next = removePlan(next, action.targetId); operations.push(operation('deletePlan', { id: action.targetId })); }
        else if (action.type === 'navigate' && action.destination) destination = action.destination;
      }
      if (operations.length) await commit(next, operations, `Assistant applied ${operations.length} change${operations.length === 1 ? '' : 's'}`);
      if (destination) changeTab(destination);
      setAssistantMessages((current) => [...current, { id: makeId('message'), role: 'assistant', text: `Applied ${assistantPlan.actions.length} approved action${assistantPlan.actions.length === 1 ? '' : 's'}.`, createdAt: now() }]);
      setAssistantPlan(null);
    } catch (error) {
      setAssistantMessages((current) => [...current, { id: makeId('message'), role: 'assistant', text: error instanceof Error ? error.message : 'I could not apply that plan.', createdAt: now() }]);
    } finally { setAssistantBusy(false); }
  }

  async function saveProfileInput(input: ProfileInput) {
    const timestamp = now();
    const profile: UserProfile = { ...input, id: state.profile?.id || makeId('profile'), createdAt: state.profile?.createdAt || timestamp, updatedAt: timestamp };
    const goal = recommendDailyGoal(profile, date);
    await commit(upsertGoal(setProfile(state, profile), goal), [operation('profile', input)], `Targets updated to ${goal.calories} kcal and ${goal.protein}g protein`);
  }

  async function completeOnboarding(input: ProfileInput, includeDemo: boolean) {
    const timestamp = now();
    const profile: UserProfile = { ...input, onboardingComplete: true, id: makeId('profile'), createdAt: timestamp, updatedAt: timestamp };
    const base = includeDemo ? withDemoData(state, date, profile) : state;
    const goal = recommendDailyGoal(profile, date);
    await commit(upsertGoal(setProfile(base, profile), goal), [operation('profile', input)], includeDemo ? 'Profile ready with 60 days of demo history' : 'Profile and targets ready');
  }

  function loadDemo() {
    setState((current) => withDemoData(current, date, current.profile));
    setStatus('Demo history loaded locally. Trends now show 60 days of food, weight, and activity data.');
  }

  function importBackup(text: string) {
    try {
      setState(restorePortableBackup(text));
      setStatus('Portable backup restored successfully.');
    } catch {
      Alert.alert('Backup not recognized', 'Paste a complete FitnessMacro JSON backup or PC-agent export.');
    }
  }

  async function reviewCurrentGoal() {
    if (!state.profile) return;
    try {
      const review = await getGoalRecommendation(state.profile);
      setGoalReview(review);
      setStatus('Goal reviewed with the local safety calculation.');
    } catch {
      setStatus('PC advisor unavailable. Your deterministic calorie target remains active.');
    }
  }

  async function applyAdaptiveTdee(value: number) {
    if (!state.profile) return;
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = state.profile;
    await saveProfileInput({ ...input, adaptiveTdee: value, adaptiveTdeeUpdatedAt: now() });
  }

  async function createPlan(name: string, description?: string) {
    const entries = state.entries.filter((entry) => entry.date === date);
    const timestamp = now();
    const built = buildPlanFromDay({ id: makeId('plan'), name, description, entries, now: timestamp, makeItemId: () => makeId('plan_item') });
    await commit(upsertPlan(state, built.plan), [operation('plan', built.payload)], `${name} saved as a food plan`);
  }

  async function createRecipe(input: RecipeInput) {
    const calculation = calculateRecipe(input.ingredients, state.foods, input.finalWeightGrams);
    if (!calculation.finalGrams || !input.servings) throw new Error('invalid_recipe');
    const timestamp = now();
    const foodId = makeId('recipe_food');
    const recipeId = makeId('recipe');
    const food: FoodItem = {
      id: foodId, name: input.name, serving: { unit: 'serving', amount: 1, gramsPerUnit: calculation.finalGrams / input.servings }, nutrition: calculation.per100g,
      tags: ['recipe', 'custom-dish'], createdAt: timestamp, updatedAt: timestamp, source: { source: 'manual', confidence: 1 }
    };
    const recipe: Recipe = { id: recipeId, name: input.name, servings: input.servings, finalWeightGrams: calculation.finalGrams, ingredients: input.ingredients, foodId, sourceDescription: input.sourceDescription, createdAt: timestamp, updatedAt: timestamp };
    const payload: CustomFoodInput = { clientId: foodId, name: food.name, serving: food.serving, nutrition: food.nutrition };
    await commit(upsertRecipe(upsertFood(state, food), recipe), [operation('food', payload)], `${food.name} saved as a reusable dish`);
    return food;
  }

  function applyPlan(plan: MealPlan) {
    Alert.alert('Add this food plan?', `${plan.items.length} foods will be added to ${date}. Existing diary entries will remain.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Add plan', onPress: () => void applyPlanConfirmed(plan) }
    ]);
  }

  async function applyPlanConfirmed(plan: MealPlan) {
    const timestamp = now();
    const entries = instantiatePlan({ plan, date, now: timestamp, makeEntryId: () => makeId('entry') });
    let next = state;
    const operations: PendingOperation[] = [];
    for (const entry of entries) {
      next = upsertEntry(next, entry);
      const payload: FoodEntryInput = { clientId: entry.id, date, eatenAt: entry.eatenAt, mealType: entry.mealType, foodId: entry.foodId, portion: entry.portion, note: entry.note };
      operations.push(operation('entry', payload));
    }
    await commit(next, operations, `${plan.name} added to ${date}`);
    changeTab('today');
  }

  function confirmDelete(label: string, onConfirm: () => void) {
    Alert.alert(`Delete ${label}?`, 'This will also be removed from the PC when synchronization is available.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: onConfirm }]);
  }

  function deleteEntry(id: string) {
    confirmDelete('food entry', () => void commit(removeEntry(state, id), [operation('deleteEntry', { id })], 'Food entry deleted'));
  }

  function deleteWeight(id: string) {
    confirmDelete('weight log', () => void commit(removeWeight(state, id), [operation('deleteWeight', { id })], 'Weight log deleted'));
  }

  function deleteActivity(id: string) {
    confirmDelete('activity', () => void commit(removeActivity(state, id), [operation('deleteActivity', { id })], 'Activity deleted'));
  }

  function deletePlan(id: string) {
    confirmDelete('food plan', () => void commit(removePlan(state, id), [operation('deletePlan', { id })], 'Food plan deleted'));
  }

  async function syncAll() {
    setStatus('Synchronizing local changes and history...');
    try {
      const pushed = await flushPendingOperations(state);
      const pulled = await pullAllFromAgent(pushed.state);
      setState(pulled);
      setStatus(`Sync complete. ${pushed.synced} queued change(s) sent.`);
    } catch {
      setStatus(`PC agent unavailable. ${state.pendingOperations.length} change(s) remain safely stored on this device.`);
    }
  }

  async function refreshIntegrationStatus() {
    try {
      const [stravaResult, audioResult, agentResult] = await Promise.all([getStravaStatus(), audioStatus(), agentStatus()]);
      setStrava(stravaResult);
      setAudioConfigured(audioResult.configured);
      setAppAgentEnabled(agentResult.appAgent.enabled);
    } catch {
      setStrava(null);
      setAudioConfigured(null);
      setAppAgentEnabled(null);
    }
  }

  async function connectStrava() {
    try {
      const url = await getStravaAuthorizationUrl();
      await Linking.openURL(url);
      setStatus('Complete authorization in the browser, return to the app, then tap Refresh integration status.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not start Strava authorization.');
    }
  }

  async function importStrava() {
    setStatus('Importing recent Strava activities...');
    try {
      const after = shiftDate(today(), -90);
      const result = await syncStrava(after);
      let next = state;
      for (const activity of result.activities) next = upsertActivity(next, activity);
      setState(next);
      setStatus(`${result.imported} Strava activities imported or refreshed.`);
      await refreshIntegrationStatus();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Strava synchronization failed.');
    }
  }

  function changeDate(offset: number | 'today') {
    setDate(offset === 'today' ? today() : shiftDate(date, offset));
  }

  function openLibrary(time?: string) {
    if (time) setLibraryTime(time);
    changeTab('library');
  }

  function openQuickLog(time: string) {
    setQuickLogTime(time);
    setQuickLogVisible(true);
  }

  if (!hydrated) return <SafeAreaView style={styles.root} />;
  if (!state.profile?.onboardingComplete) return <SafeAreaView style={styles.root}><StatusBar barStyle={isDarkTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.paper} /><OnboardingScreen date={date} onComplete={completeOnboarding} /></SafeAreaView>;

  let screen: React.ReactNode;
  if (activeTab === 'today') screen = <TodayScreen state={state} date={date} status={status} onDateChange={changeDate} onQuickAddAt={openQuickLog} onAddWeight={addWeight} onAddActivity={addActivity} onDeleteEntry={deleteEntry} onDeleteWeight={deleteWeight} onDeleteActivity={deleteActivity} onSync={syncAll} />;
  else if (activeTab === 'plans') screen = <PlansScreen state={state} date={date} review={goalReview} onReview={() => void reviewCurrentGoal()} onApplyAdaptive={(value) => void applyAdaptiveTdee(value)} onEditProfile={() => changeTab('profile')} onCreate={createPlan} onApply={applyPlan} onDelete={deletePlan} />;
  else if (activeTab === 'trends') screen = <TrendsScreen state={state} endDate={date} />;
  else if (activeTab === 'assistant') screen = <AssistantScreen messages={assistantMessages} plan={assistantPlan} busy={assistantBusy} onCommand={askAssistant} onTranscribe={transcribeFood} onConfirm={executeAssistantPlan} onDiscard={() => setAssistantPlan(null)} />;
  else if (activeTab === 'library') screen = <LibraryScreen state={state} date={date} initialTime={libraryTime} onSearch={searchFoods} onBarcode={barcodeFood} onResolve={resolveFoods} onTranscribe={transcribeFood} onAdd={addFoodEntry} onCreateCustom={createCustomFood} onCreateRecipe={createRecipe} />;
  else screen = <ProfileScreen state={state} date={date} status={status} strava={strava} healthConnect={healthConnect} audioConfigured={audioConfigured} appAgentEnabled={appAgentEnabled} activeTheme={activeTheme} onThemeChange={changeTheme} onSave={saveProfileInput} onSync={syncAll} onLoadDemo={loadDemo} onExport={() => createPortableBackup(state)} onImport={importBackup} onConnectStrava={connectStrava} onSyncStrava={importStrava} onConnectHealth={() => void refreshHealthConnect(true)} onOpenHealthSettings={() => void openHealthConnectSettings()} onRefreshIntegrations={() => { void refreshIntegrationStatus(); void refreshHealthConnect(false); }} />;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle={isDarkTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.paper} />
      <View style={styles.atmosphereOne} />
      <View style={styles.atmosphereTwo} />
      <View style={styles.content}>{screen}</View>
      <QuickLogSheet visible={quickLogVisible} initialTime={quickLogTime} foods={state.foods} onSearch={searchFoods} onResolve={resolveFoods} onTranscribe={transcribeFood} onExecuteAgent={executeAgentResolution} onClose={() => setQuickLogVisible(false)} onLog={addPlate} />
      <BottomTabs active={activeTab} onChange={changeTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { flex: 1 },
  atmosphereOne: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: atmosphere.one, opacity: 0.38, top: -150, right: -90 },
  atmosphereTwo: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: atmosphere.two, opacity: 0.34, bottom: 100, left: -150 }
});
