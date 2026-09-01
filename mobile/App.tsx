import React, { useEffect, useState } from 'react';
import { Alert, AppState as NativeAppState, LayoutAnimation, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { NavigationBar } from 'expo-navigation-bar';
import * as Updates from 'expo-updates';
import * as SecureStore from 'expo-secure-store';
import {
  ActivityEntry,
  AgentResolution,
  AssistantAction,
  AssistantMessage,
  AssistantPlan,
  AppState,
  BodyMetricLog,
  FoodEntry,
  FoodItem,
  MealPlan,
  MealType,
  NutritionProgram,
  ProfileInput,
  Recipe,
  RecipeInput,
  UserProfile,
} from './src/types';
import {
  EMPTY_STATE,
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
import { agentStatus, audioStatus, getGoalRecommendation, lookupFoodByBarcode, planAssistantCommand, resolveTranscript, searchFoods as searchHostedFoods, transcribeRecording } from './src/services/agentClient';
import { estimateTdee, mifflinStJeor, recommendDailyGoal } from './src/logic/tdee';
import { buildPlanFromDay, instantiatePlan } from './src/logic/plans';
import { dateDistance, dateFor, shiftDate, today } from './src/utils/dates';
import { BottomTabs, TabKey } from './src/components/ui';
import { TodayScreen } from './src/screens/TodayScreen';
import { PlansScreen } from './src/screens/PlansScreen';
import { TrendsScreen } from './src/screens/TrendsScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { AssistantScreen } from './src/screens/AssistantScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { AccountLockScreen } from './src/screens/AccountLockScreen';
import { activeTheme, AppThemeName, atmosphere, colors, consumeThemeAppearanceReturn, isDarkTheme, saveAppTheme, saveThemeAppearanceReturn } from './src/theme';
import { withDemoData } from './src/logic/demoData';
import { createPortableBackup, restorePortableBackup } from './src/logic/backup';
import { QuickLogSheet, PlateItem } from './src/components/QuickLogSheet';
import { calculateRecipe } from './src/logic/recipes';
import { currentTime, mealForTime } from './src/logic/time';
import { estimateActivityCalories } from './src/logic/activityEnergy';
import { HealthConnectStatus, openHealthConnectSettings, syncHealthConnect } from './src/services/healthConnect';
import { buildDailySeries } from './src/logic/analytics';
import { estimateAdaptiveExpenditure } from './src/logic/expenditure';

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function now() {
  return new Date().toISOString();
}

const LOCAL_PIN_KEY = 'fitness-macro-local-pin-v1';

export default function App() {
  return <SafeAreaProvider><NavigationBar hidden={false} style={isDarkTheme ? 'dark' : 'light'} /><FitnessApp /></SafeAreaProvider>;
}

function FitnessApp() {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [returnToAppearance] = useState(() => consumeThemeAppearanceReturn());
  const [activeTab, setActiveTab] = useState<TabKey>(() => returnToAppearance ? 'profile' : 'today');
  const [date, setDate] = useState(today());
  const [libraryTime, setLibraryTime] = useState('08:00');
  const [quickLogVisible, setQuickLogVisible] = useState(false);
  const [quickLogTime, setQuickLogTime] = useState('12:00');
  const [status, setStatus] = useState('All data is stored locally first.');
  const [audioConfigured, setAudioConfigured] = useState<boolean | null>(null);
  const [appAgentEnabled, setAppAgentEnabled] = useState<boolean | null>(null);
  const [pendingTheme, setPendingTheme] = useState<AppThemeName>(activeTheme);
  const [healthConnect, setHealthConnect] = useState<HealthConnectStatus | null>(null);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [assistantPlan, setAssistantPlan] = useState<AssistantPlan | null>(null);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [lockReady, setLockReady] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    void loadState().then((loaded) => {
      setState(loaded);
      setDate(today(loaded.profile?.timeZone));
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    void SecureStore.getItemAsync(LOCAL_PIN_KEY).then((storedPin) => {
      setPinEnabled(Boolean(storedPin));
      setUnlocked(!storedPin);
      setLockReady(true);
    }).catch(() => {
      // Never strand the owner outside their local data if secure storage is unavailable.
      setUnlocked(true);
      setLockReady(true);
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
    const subscription = NativeAppState.addEventListener('change', (next) => {
      if (next === 'active') void refreshHealthConnect(false);
      else if (pinEnabled) setUnlocked(false);
    });
    return () => subscription.remove();
  }, [hydrated, pinEnabled]);

  useEffect(() => {
    if (!hydrated || !state.profile) return;
    const profile = state.profile;
    const baseline = estimateTdee(mifflinStJeor(profile), profile.activityFactor);
    const endDate = today(profile.timeZone);
    const series = buildDailySeries({ endDate, days: 28, entries: state.entries, foods: state.foods, activities: state.activities, goals: state.goals, profile });
    const adaptive = estimateAdaptiveExpenditure(series, state.weights, baseline);
    if (adaptive.status !== 'updating' || adaptive.confidence < 0.45) return;
    const current = profile.adaptiveTdee || baseline;
    const lastDate = profile.adaptiveTdeeUpdatedAt ? dateFor(new Date(profile.adaptiveTdeeUpdatedAt), profile.timeZone) : undefined;
    if (lastDate && dateDistance(lastDate, endDate) < 7) return;
    const next = Math.round(Math.max(current - 100, Math.min(current + 100, adaptive.estimate)));
    if (Math.abs(next - current) < 50) return;
    const updated = { ...profile, adaptiveTdee: next, adaptiveTdeeUpdatedAt: now(), updatedAt: now() };
    setState((currentState) => currentState.profile?.updatedAt === profile.updatedAt ? setProfile(currentState, updated) : currentState);
    setStatus(`Your plan checked 14+ days of food and weight data and adjusted maintenance by ${next - current > 0 ? '+' : ''}${next - current} kcal/day. The daily target now follows it.`);
  }, [hydrated, state.profile, state.entries, state.weights, state.foods, state.activities, state.goals]);

  function changeTab(tab: TabKey) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
  }

  async function commit(nextState: AppState, success: string) {
    setState(nextState);
    setStatus(success);
  }

  async function addPlate(items: PlateItem[], eatenAt: string, logDate = date) {
    const mealType = mealForTime(eatenAt);
    const enteredAt = now();
    let next = state;
    for (const item of items) {
      const id = makeId('entry');
      const portion = { foodId: item.food.id, quantity: item.quantity, unit: item.food.serving.unit };
      const entry: FoodEntry = { id, date: logDate, eatenAt, mealType, foodId: item.food.id, portion, note: item.note, enteredAt, source: { source: 'manual', confidence: 1 } };
      next = upsertEntry(next, entry);
    }
    await commit(next, `${items.length} food${items.length === 1 ? '' : 's'} added at ${eatenAt}`);
  }

  async function addFoodEntry(food: FoodItem, quantity: number, eatenAt: string, note?: string) {
    await addPlate([{ food, quantity, note }], eatenAt);
  }

  async function addWeight(weightKg: number) {
    const id = state.weights.find((item) => item.date === date)?.id || makeId('weight');
    const enteredAt = now();
    const item: BodyMetricLog = { id, date, weightKg, enteredAt };
    await commit(upsertWeight(state, item), 'Weight logged');
  }

  async function addActivity(name: string, durationMinutes: number) {
    const id = makeId('activity');
    const createdAt = now();
    const currentWeight = state.weights.filter((item) => item.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0]?.weightKg || state.profile?.bodyWeightKg || 75;
    const caloriesEstimated = estimateActivityCalories(name, durationMinutes, currentWeight).calories;
    const item: ActivityEntry = { id, date, name, type: name.toLowerCase(), durationMinutes, caloriesEstimated, source: 'manual', createdAt };
    await commit(upsertActivity(state, item), 'Activity logged');
  }

  async function createCustomFood(values: { name: string; brand?: string; servingGrams: number; calories: number; protein: number; carbs: number; fat: number }) {
    const id = makeId('food');
    const timestamp = now();
    const scale = 100 / values.servingGrams;
    const food: FoodItem = { id, name: values.name, brand: values.brand, serving: { unit: 'serving', amount: 1, gramsPerUnit: values.servingGrams }, nutrition: { calories: values.calories * scale, protein: values.protein * scale, carbs: values.carbs * scale, fat: values.fat * scale }, createdAt: timestamp, updatedAt: timestamp, source: { source: 'manual', confidence: 1 } };
    await commit(upsertFood(state, food), `${food.name} saved to your library`);
    return food;
  }

  async function searchFoods(query: string) {
    const normalized = query.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const aliases: Record<string, string[]> = { dal: ['daal', 'dhal', 'lentil'], daal: ['dal', 'dhal', 'lentil'], dhal: ['dal', 'daal', 'lentil'], mash: ['urad'], urad: ['mash'], roti: ['chapati'], chapati: ['roti'], aloo: ['potato'], keema: ['mince', 'minced'] };
    const ignored = new Set(['a', 'an', 'and', 'the', 'with', 'of', 'ki', 'ka', 'ke', 'kiya', 'plate', 'dish', 'cooked']);
    const words = [...new Set(normalized.split(/\s+/).filter((word) => word && !ignored.has(word)).flatMap((word) => [word, ...(aliases[word] || [])]))];
    const score = (food: FoodItem) => {
      const name = `${food.name} ${food.brand || ''} ${(food.tags || []).join(' ')}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
      const matchedWords = words.filter((word) => name.includes(word)).length;
      const relevance = name.trim() === normalized ? 1_000 : name.startsWith(normalized) ? 800 : name.includes(normalized) ? 600 : matchedWords * 100;
      // A personal recipe should win a tie, but a partial word match must never
      // outrank an exact regional food just because it was saved earlier.
      const source = food.tags?.includes('recipe') || food.tags?.includes('custom-dish') ? 80 : food.source.source === 'manual' ? 40 : food.tags?.includes('starter') ? 20 : food.source.source === 'local' ? 15 : food.source.source === 'usda' ? 10 : 0;
      return relevance + source;
    };
    const local = state.foods.filter((food) => {
      const name = `${food.name} ${food.brand || ''} ${(food.tags || []).join(' ')}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
      return name.includes(normalized) || words.some((word) => name.includes(word));
    }).sort((a, b) => score(b) - score(a));
    try {
      const result = await searchHostedFoods(query, 8);
      setState((current) => result.items.reduce((next, food) => upsertFood(next, food), current));
      const combined = [...local, ...result.items];
      const unique = combined.filter((food, index) => combined.findIndex((candidate) => candidate.id === food.id) === index);
      return unique.sort((a, b) => score(b) - score(a));
    } catch {
      // Manual local search stays available even when the optional catalogue
      // lookup is offline, rate-limited, or returns no compatible result.
      return local;
    }
  }

  async function barcodeFood(code: string) {
    const response = await lookupFoodByBarcode(code);
    setState((current) => upsertFood(current, response.item));
    return response.item;
  }

  async function resolveFoods(phrase: string, defaultTime = currentTime(state.profile?.timeZone)): Promise<AgentResolution> {
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
      const logDate = plan.log.date || date;
      await addPlate(items, plan.log.eatenAt || fallbackTime, logDate);
      setDate(logDate);
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
    const recipe: Recipe = { id: recipeId, name: food.name, servings, finalWeightGrams: calculation.finalGrams, ingredients, foodId, sourceDescription: resolution.transcript, reviewStatus: 'ai_estimated', sourceName: 'Groq ingredient estimate', createdAt: timestamp, updatedAt: timestamp };
    const entryId = makeId('entry');
    const eatenAt = plan.log.eatenAt || fallbackTime;
    const logDate = plan.log.date || date;
    const mealType = mealForTime(eatenAt);
    const portion = { foodId, quantity: plan.log.quantity || 1, unit: 'serving' };
    const entry: FoodEntry = { id: entryId, date: logDate, eatenAt, mealType, foodId, portion, note: 'Created and logged by the AI assistant.', enteredAt: timestamp, source: { source: 'llm', confidence } };
    let next = state;
    for (const resolved of resolution.foods) next = upsertFood(next, resolved);
    next = upsertEntry(upsertRecipe(upsertFood(next, food), recipe), entry);
    await commit(next, `${food.name} created, saved, and logged`);
    setDate(logDate);
  }

  function changeTheme(theme: AppThemeName) {
    if (theme === pendingTheme) return;
    saveAppTheme(theme);
    saveThemeAppearanceReturn();
    setPendingTheme(theme);
    // Existing StyleSheets capture colors at module-load time. A controlled
    // reload is the safe way to apply every surface at once; the return marker
    // reopens Appearance instead of dumping the owner on Today.
    void Updates.reloadAsync().catch(() => setStatus('Theme saved. Close and reopen Weed Fitness to apply it.'));
  }

  async function transcribeFood(uri: string) {
    const result = await transcribeRecording(uri);
    setStatus(`Audio transcribed by ${result.engine}; raw audio was not retained.`);
    return result.text;
  }

  async function refreshHealthConnect(requestAccess: boolean) {
    const result = await syncHealthConnect(requestAccess);
    setHealthConnect(result.status);
    if (result.activities.length || result.weights.length || result.replaceLegacyActivities) setState((current) => {
      // v0.3 used one generic row per calorie record. Newer builds import
      // tracker sessions instead, so clear only those legacy imported rows to
      // prevent a single Strava workout being counted twice.
      const withoutLegacyHealthRows = result.replaceLegacyActivities ? { ...current, activities: current.activities.filter((activity) => !activity.id.startsWith('health_strava_')) } : current;
      const withActivities = result.activities.reduce((next, activity) => upsertActivity(next, activity), withoutLegacyHealthRows);
      return result.weights.reduce((next, weight) => {
        const existing = next.weights.find((item) => item.date === weight.date);
        // A deliberate in-app check-in wins over an imported source for that day.
        return !existing || existing.notes === 'Imported from Health Connect' ? upsertWeight(next, weight) : next;
      }, withActivities);
    });
    if (requestAccess) {
      setStatus(result.status.message);
      Alert.alert('Health Connect', result.status.message);
    }
  }

  function assistantContext() {
    const names = new Map(state.foods.map((food) => [food.id, food.name]));
    return {
      currentDate: date,
      currentTime: currentTime(state.profile?.timeZone),
      profile: state.profile,
      goals: state.goals.slice(-30),
      entries: state.entries.slice(-500).map((entry) => ({ id: entry.id, date: entry.date, time: entry.eatenAt, mealType: entry.mealType, foodId: entry.foodId, foodName: names.get(entry.foodId), quantity: entry.portion.quantity, unit: entry.portion.unit })),
      weights: state.weights.slice(-120),
      activities: state.activities.slice(-120),
      recipes: state.recipes.map((recipe) => ({ id: recipe.id, foodId: recipe.foodId, name: recipe.name, servings: recipe.servings, reviewStatus: recipe.reviewStatus || 'manual', sourceName: recipe.sourceName, sourceUrl: recipe.sourceUrl, ingredients: recipe.ingredients.map((item) => ({ ...item, foodName: names.get(item.foodId) })) })),
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
      setAssistantMessages((current) => [...current, { id: makeId('message'), role: 'assistant', text: error instanceof Error ? error.message : 'The assistant could not prepare a plan.', createdAt: now() }]);
    } finally {
      setAssistantBusy(false);
    }
  }

  async function executeAssistantPlan() {
    if (!assistantPlan?.actions.length) return;
    setAssistantBusy(true);
    try {
      let next = state;
      let appliedChanges = 0;
      let destination: TabKey | null = null;
      let diaryDate: string | null = null;
      const timestamp = now();
      const foodFor = (ingredient: AssistantAction['ingredients'][number]): FoodItem => {
        const existing = next.foods.find((food) => food.name.toLowerCase() === ingredient.name.toLowerCase() && (food.brand || '').toLowerCase() === (ingredient.brand || '').toLowerCase());
        if (existing) return existing;
        const food: FoodItem = { id: makeId('ai_food'), name: ingredient.name, brand: ingredient.brand || undefined, serving: { unit: ingredient.unit, amount: 1, gramsPerUnit: ingredient.gramsPerUnit }, nutrition: { calories: ingredient.caloriesPer100g, protein: ingredient.proteinPer100g, carbs: ingredient.carbsPer100g, fat: ingredient.fatPer100g }, tags: ['ai-created'], createdAt: timestamp, updatedAt: timestamp, source: { source: 'llm', confidence: ingredient.confidence } };
        next = upsertFood(next, food);
        appliedChanges += 1;
        return food;
      };
      const addEntry = (food: FoodItem, quantity: number, entryDate: string, eatenAt: string, note: string) => {
        const id = makeId('entry'); const mealType = mealForTime(eatenAt);
        const portion = { foodId: food.id, quantity, unit: food.serving.unit };
        next = upsertEntry(next, { id, date: entryDate, eatenAt, mealType, foodId: food.id, portion, note, enteredAt: timestamp, source: { source: 'llm', confidence: 1 } });
        appliedChanges += 1;
        diaryDate = entryDate;
      };
      for (const action of assistantPlan.actions) {
        const actionDate = action.date || date; const actionTime = action.time || currentTime(next.profile?.timeZone);
        if (action.type === 'save_food') action.ingredients.forEach(foodFor);
        else if (action.type === 'log_foods') action.ingredients.forEach((ingredient) => { const food = foodFor(ingredient); addEntry(food, ingredient.quantity, actionDate, actionTime, 'Logged by the AI assistant.'); });
        else if (action.type === 'create_recipe' || action.type === 'create_recipe_and_log') {
          const recipeIngredients = action.ingredients.map((ingredient) => { const food = foodFor(ingredient); return { foodId: food.id, quantity: ingredient.quantity, unit: ingredient.unit }; });
          const calculation = calculateRecipe(recipeIngredients, next.foods);
          if (!calculation.finalGrams) continue;
          const foodId = makeId('recipe_food'); const recipeId = makeId('recipe'); const servings = Math.max(action.servings || 1, 1);
          const dish: FoodItem = { id: foodId, name: action.name || 'AI dish', serving: { unit: 'serving', amount: 1, gramsPerUnit: calculation.finalGrams / servings }, nutrition: calculation.per100g, tags: ['recipe', 'custom-dish', 'ai-created'], createdAt: timestamp, updatedAt: timestamp, source: { source: 'llm', confidence: action.confidence } };
          const recipe: Recipe = { id: recipeId, name: dish.name, servings, finalWeightGrams: calculation.finalGrams, ingredients: recipeIngredients, foodId, sourceDescription: action.summary, reviewStatus: 'ai_estimated', sourceName: 'Groq ingredient estimate', createdAt: timestamp, updatedAt: timestamp };
          next = upsertRecipe(upsertFood(next, dish), recipe);
          appliedChanges += 1;
          if (action.type === 'create_recipe_and_log') addEntry(dish, action.quantity || 1, actionDate, actionTime, 'Created and logged by the AI assistant.');
        } else if (action.type === 'log_weight' && action.value) {
          const id = next.weights.find((item) => item.date === actionDate)?.id || makeId('weight');
          next = upsertWeight(next, { id, date: actionDate, weightKg: action.value, enteredAt: timestamp }); appliedChanges += 1;
        } else if (action.type === 'log_activity' && action.name && action.durationMinutes) {
          const id = makeId('activity'); const calories = action.calories ?? estimateActivityCalories(action.name, action.durationMinutes, next.profile?.bodyWeightKg || 75).calories;
          next = upsertActivity(next, { id, date: actionDate, name: action.name, type: action.name.toLowerCase(), durationMinutes: action.durationMinutes, caloriesEstimated: calories, source: 'manual', createdAt: timestamp }); appliedChanges += 1;
        } else if (action.type === 'change_entry_time' && action.targetId) {
          const entry = next.entries.find((item) => item.id === action.targetId); if (!entry) continue;
          const entryDate = action.date || entry.date;
          const updated = { ...entry, date: entryDate, eatenAt: actionTime, mealType: mealForTime(actionTime) };
          diaryDate = entryDate;
          next = upsertEntry(next, updated); appliedChanges += 1;
        } else if (action.type === 'delete_entry' && action.targetId) { const entry = next.entries.find((item) => item.id === action.targetId); if (!entry) continue; diaryDate = entry.date; next = removeEntry(next, action.targetId); appliedChanges += 1; }
        else if (action.type === 'delete_weight' && action.targetId) { next = removeWeight(next, action.targetId); appliedChanges += 1; }
        else if (action.type === 'delete_activity' && action.targetId) { next = removeActivity(next, action.targetId); appliedChanges += 1; }
        else if (action.type === 'set_goal' && action.calories != null && action.protein != null && action.carbs != null && action.fat != null) {
          const goal = { date: actionDate, calories: action.calories, protein: action.protein, carbs: action.carbs, fat: action.fat }; next = upsertGoal(next, goal); appliedChanges += 1;
        } else if (action.type === 'update_profile' && next.profile) {
          const current = next.profile; const input: ProfileInput = { displayName: action.displayName ?? current.displayName, profilePhotoUri: current.profilePhotoUri, sex: current.sex, ageYears: current.ageYears, heightCm: current.heightCm, bodyWeightKg: action.value ?? current.bodyWeightKg, targetWeightKg: action.targetWeightKg ?? current.targetWeightKg, activityFactor: action.activityFactor ?? current.activityFactor, weeklyWeightChangeKg: current.weeklyWeightChangeKg, goalMode: action.goalMode ?? current.goalMode, goalIntensity: action.goalIntensity ?? current.goalIntensity, targetDate: action.targetDate ?? current.targetDate, onboardingComplete: true, preferredHeightUnit: current.preferredHeightUnit, preferredWeightUnit: current.preferredWeightUnit, timeZone: current.timeZone, adaptiveTdee: current.adaptiveTdee, adaptiveTdeeUpdatedAt: current.adaptiveTdeeUpdatedAt, dietStyle: current.dietStyle, preferredCuisine: current.preferredCuisine, mealsPerDay: current.mealsPerDay, excludedFoods: current.excludedFoods };
          next = setProfile(next, { ...current, ...input, updatedAt: timestamp }); appliedChanges += 1;
        } else if (action.type === 'create_plan_from_day' && action.name) {
          const built = buildPlanFromDay({ id: makeId('plan'), name: action.name, description: action.summary, entries: next.entries.filter((entry) => entry.date === actionDate), now: timestamp, makeItemId: () => makeId('plan_item') }); next = upsertPlan(next, built.plan); appliedChanges += 1;
        } else if (action.type === 'apply_plan' && action.targetId) {
          const plan = next.plans.find((item) => item.id === action.targetId); if (!plan) continue;
          const entries = instantiatePlan({ plan, date: actionDate, now: timestamp, makeEntryId: () => makeId('entry') });
          for (const entry of entries) { next = upsertEntry(next, entry); appliedChanges += 1; diaryDate = entry.date; }
        } else if (action.type === 'delete_plan' && action.targetId) { next = removePlan(next, action.targetId); appliedChanges += 1; }
        else if (action.type === 'navigate' && action.destination) destination = action.destination;
      }
      if (appliedChanges) await commit(next, `Assistant applied ${appliedChanges} change${appliedChanges === 1 ? '' : 's'}`);
      if (diaryDate) { setDate(diaryDate); changeTab('today'); }
      else if (destination) changeTab(destination);
      setAssistantMessages((current) => [...current, { id: makeId('message'), role: 'assistant', text: `Applied ${assistantPlan.actions.length} approved action${assistantPlan.actions.length === 1 ? '' : 's'}.`, createdAt: now() }]);
      setAssistantPlan(null);
    } catch (error) {
      setAssistantMessages((current) => [...current, { id: makeId('message'), role: 'assistant', text: error instanceof Error ? error.message : 'I could not apply that plan.', createdAt: now() }]);
    } finally { setAssistantBusy(false); }
  }

  async function saveProfileInput(input: ProfileInput) {
    const timestamp = now();
    const profile: UserProfile = { ...state.profile, ...input, id: state.profile?.id || makeId('profile'), createdAt: state.profile?.createdAt || timestamp, updatedAt: timestamp };
    const goal = recommendDailyGoal(profile, date);
    await commit(upsertGoal(setProfile(state, profile), goal), `Targets updated to ${goal.calories} kcal and ${goal.protein}g protein`);
    if (input.timeZone !== state.profile?.timeZone) setDate(today(input.timeZone));
    await personalizeProgram(profile);
  }

  async function saveProfilePhoto(profilePhotoUri?: string) {
    if (!state.profile) return;
    const timestamp = now();
    const profile = { ...state.profile, profilePhotoUri, updatedAt: timestamp };
    await commit(setProfile(state, profile), profilePhotoUri ? 'Profile photo updated' : 'Profile photo removed');
  }

  async function setLocalPin(pin: string | null) {
    if (pin) {
      await SecureStore.setItemAsync(LOCAL_PIN_KEY, pin);
      setPinEnabled(true);
      setUnlocked(true);
      setStatus('Local app lock enabled. The PIN is stored only in encrypted device storage.');
      return;
    }
    await SecureStore.deleteItemAsync(LOCAL_PIN_KEY);
    setPinEnabled(false);
    setUnlocked(true);
    setStatus('Local app lock removed.');
  }

  async function unlockLocalPin(pin: string) {
    const storedPin = await SecureStore.getItemAsync(LOCAL_PIN_KEY);
    if (!storedPin || storedPin !== pin) return false;
    setUnlocked(true);
    return true;
  }

  async function completeOnboarding(input: ProfileInput, includeDemo: boolean) {
    const timestamp = now();
    const profile: UserProfile = { ...input, onboardingComplete: true, id: makeId('profile'), createdAt: timestamp, updatedAt: timestamp };
    const base = includeDemo ? withDemoData(state, date, profile) : state;
    const goal = recommendDailyGoal(profile, date);
    await commit(upsertGoal(setProfile(base, profile), goal), includeDemo ? 'Profile ready with 60 days of demo history' : 'Profile and targets ready');
    await personalizeProgram(profile);
  }

  async function personalizeProgram(profile: UserProfile) {
    try {
      const response = await getGoalRecommendation(profile);
      const program: NutritionProgram = { createdAt: now(), profileUpdatedAt: profile.updatedAt, ...response.review };
      setState((current) => ({ ...current, nutritionProgram: program }));
      setStatus(response.review.aiGenerated ? 'Personalized food structure created with locked local targets.' : 'Safe local food structure created; AI personalization was unavailable.');
    } catch {
      setStatus('Profile saved. Your local targets remain active while the hosted AI is unavailable.');
    }
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
      Alert.alert('Backup not recognized', 'Paste a complete Weed Fitness JSON backup or legacy export.');
    }
  }

  async function updateEntry(entry: FoodEntry) {
    const eatenAt = entry.eatenAt || '12:00';
    const updated = { ...entry, eatenAt, mealType: mealForTime(eatenAt) };
    await commit(upsertEntry(state, updated), `Updated ${state.foods.find((food) => food.id === entry.foodId)?.name || 'food'} in your diary`);
  }

  async function createPlan(name: string, description?: string) {
    const entries = state.entries.filter((entry) => entry.date === date);
    const timestamp = now();
    const built = buildPlanFromDay({ id: makeId('plan'), name, description, entries, now: timestamp, makeItemId: () => makeId('plan_item') });
    await commit(upsertPlan(state, built.plan), `${name} saved as a food plan`);
  }

  async function createRecipe(input: RecipeInput) {
    const calculation = calculateRecipe(input.ingredients, state.foods, input.finalWeightGrams);
    if (!calculation.finalGrams || !input.servings) throw new Error('invalid_recipe');
    const timestamp = now();
    const foodId = makeId('recipe_food');
    const recipeId = makeId('recipe');
    const food: FoodItem = {
      id: foodId, name: input.name, serving: { unit: 'serving', amount: 1, gramsPerUnit: calculation.finalGrams / input.servings }, nutrition: calculation.per100g,
      emoji: input.emoji, imageUri: input.imageUri, tags: ['recipe', 'custom-dish'], createdAt: timestamp, updatedAt: timestamp, source: { source: 'manual', confidence: 1 }
    };
    const recipe: Recipe = { id: recipeId, name: input.name, servings: input.servings, finalWeightGrams: calculation.finalGrams, ingredients: input.ingredients, foodId, sourceDescription: input.sourceDescription, reviewStatus: 'manual', sourceName: 'Personal cookbook', reviewedAt: timestamp, createdAt: timestamp, updatedAt: timestamp };
    await commit(upsertRecipe(upsertFood(state, food), recipe), `${food.name} saved as a reusable dish`);
    return food;
  }

  async function updateFood(food: FoodItem) {
    await commit(upsertFood(state, food), `${food.name} updated in your library`);
  }

  async function updateRecipe(recipeId: string, input: RecipeInput) {
    const previousRecipe = state.recipes.find((recipe) => recipe.id === recipeId);
    if (!previousRecipe) throw new Error('recipe_not_found');
    const previousFood = state.foods.find((food) => food.id === previousRecipe.foodId);
    if (!previousFood) throw new Error('recipe_food_not_found');
    const calculation = calculateRecipe(input.ingredients, state.foods, input.finalWeightGrams);
    if (!calculation.finalGrams || !input.servings) throw new Error('invalid_recipe');
    const timestamp = now();
    const food: FoodItem = { ...previousFood, name: input.name, emoji: input.emoji, imageUri: input.imageUri, serving: { unit: 'serving', amount: 1, gramsPerUnit: calculation.finalGrams / input.servings }, nutrition: calculation.per100g, updatedAt: timestamp };
    const recipe: Recipe = { ...previousRecipe, name: input.name, servings: input.servings, finalWeightGrams: calculation.finalGrams, ingredients: input.ingredients, sourceDescription: input.sourceDescription, reviewStatus: 'manual', sourceName: 'Personal cookbook', reviewedAt: timestamp, updatedAt: timestamp };
    await commit(upsertRecipe(upsertFood(state, food), recipe), `${food.name} recipe updated`);
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
    for (const entry of entries) {
      next = upsertEntry(next, entry);
    }
    await commit(next, `${plan.name} added to ${date}`);
    changeTab('today');
  }

  function confirmDelete(label: string, onConfirm: () => void) {
    Alert.alert(`Delete ${label}?`, 'This will be removed from this device.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: onConfirm }]);
  }

  function deleteEntry(id: string) {
    confirmDelete('food entry', () => void commit(removeEntry(state, id), 'Food entry deleted'));
  }

  function deleteWeight(id: string) {
    confirmDelete('weight log', () => void commit(removeWeight(state, id), 'Weight log deleted'));
  }

  function deleteActivity(id: string) {
    confirmDelete('activity', () => void commit(removeActivity(state, id), 'Activity deleted'));
  }

  function deletePlan(id: string) {
    confirmDelete('food plan', () => void commit(removePlan(state, id), 'Food plan deleted'));
  }

  async function refreshIntegrationStatus() {
    const [audioResult, agentResult] = await Promise.allSettled([audioStatus(), agentStatus()]);
    setAudioConfigured(audioResult.status === 'fulfilled' ? audioResult.value.configured : false);
    setAppAgentEnabled(agentResult.status === 'fulfilled' ? agentResult.value.appAgent.enabled : false);
  }

  function changeDate(offset: number | 'today') {
    setDate(offset === 'today' ? today(state.profile?.timeZone) : shiftDate(date, offset));
  }

  function openLibrary(time?: string) {
    if (time) setLibraryTime(time);
    changeTab('library');
  }

  function openQuickLog(time: string) {
    setQuickLogTime(time);
    setQuickLogVisible(true);
  }

  if (!hydrated || !lockReady) return <SafeAreaView style={styles.root} />;
  if (pinEnabled && !unlocked) return <SafeAreaView style={styles.root}><StatusBar barStyle={isDarkTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.paper} /><AccountLockScreen onUnlock={unlockLocalPin} /></SafeAreaView>;
  if (!state.profile?.onboardingComplete) return <SafeAreaView style={styles.root}><StatusBar barStyle={isDarkTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.paper} /><OnboardingScreen date={date} onComplete={completeOnboarding} /></SafeAreaView>;

  let screen: React.ReactNode;
  if (activeTab === 'today') screen = <TodayScreen state={state} date={date} status={status} timeZone={state.profile?.timeZone} onDateChange={changeDate} onQuickAddAt={openQuickLog} onAddWeight={addWeight} onAddActivity={addActivity} onUpdateEntry={updateEntry} onDeleteEntry={deleteEntry} onDeleteWeight={deleteWeight} onDeleteActivity={deleteActivity} />;
  else if (activeTab === 'plans') screen = <PlansScreen state={state} date={date} onEditProfile={() => changeTab('profile')} onCreate={createPlan} onApply={applyPlan} onDelete={deletePlan} />;
  else if (activeTab === 'trends') screen = <TrendsScreen state={state} endDate={date} />;
  else if (activeTab === 'assistant') screen = <AssistantScreen messages={assistantMessages} plan={assistantPlan} busy={assistantBusy} onCommand={askAssistant} onTranscribe={transcribeFood} onConfirm={executeAssistantPlan} onDiscard={() => setAssistantPlan(null)} />;
  else if (activeTab === 'library') screen = <LibraryScreen state={state} date={date} initialTime={libraryTime} timeZone={state.profile?.timeZone} onSearch={searchFoods} onBarcode={barcodeFood} onResolve={resolveFoods} onTranscribe={transcribeFood} onAdd={addFoodEntry} onCreateCustom={createCustomFood} onCreateRecipe={createRecipe} onUpdateFood={updateFood} onUpdateRecipe={updateRecipe} />;
  else screen = <ProfileScreen state={state} date={date} status={status} healthConnect={healthConnect} audioConfigured={audioConfigured} appAgentEnabled={appAgentEnabled} initialPanel={returnToAppearance ? 'appearance' : undefined} activeTheme={pendingTheme} onThemeChange={changeTheme} onSave={saveProfileInput} onSavePhoto={saveProfilePhoto} pinEnabled={pinEnabled} onSetLocalPin={setLocalPin} onLoadDemo={loadDemo} onExport={() => createPortableBackup(state)} onImport={importBackup} onConnectHealth={() => void refreshHealthConnect(true)} onOpenHealthSettings={() => void openHealthConnectSettings()} onRefreshIntegrations={() => { void refreshIntegrationStatus(); void refreshHealthConnect(false); }} />;

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
