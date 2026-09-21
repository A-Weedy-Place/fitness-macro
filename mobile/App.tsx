import { themedStyles } from './src/theme';
import { useAndroidBack } from './src/hooks/useAndroidBack';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState as NativeAppState, LayoutAnimation, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
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
  FoodPortion,
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
  loadPreRestoreRecovery,
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
import { LaunchScreen } from './src/components/LaunchScreen';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { activeTheme, AppThemeName, atmosphere, colors, consumeThemeAppearanceReturn, isDarkTheme, saveAppTheme, useAppTheme } from './src/theme';
import { withDemoData } from './src/logic/demoData';
import { previewPortableBackup, prepareBackupRestore } from './src/logic/backup';
import { exportBackupWithMedia, materializeBackupMedia, retainImage } from './src/services/portableMedia';
import { QuickLogSheet, PlateItem } from './src/components/QuickLogSheet';
import { calculateRecipe } from './src/logic/recipes';
import { currentTime, mealForTime } from './src/logic/time';
import { estimateActivityCalories } from './src/logic/activityEnergy';
import { HealthConnectStatus, openHealthConnectSettings, syncHealthConnect, reconcileHealthConnectSync } from './src/services/healthConnect';
import { buildDailySeries } from './src/logic/analytics';
import { estimateAdaptiveExpenditure } from './src/logic/expenditure';
import { diagnosticActions, exportAiDiagnostics, recordAiDiagnostic } from './src/logic/diagnostics';
import { initializeLocalDiagnostics, recordLocalDiagnostic, localDiagnosticsEnabled } from './src/logic/localDiagnostics';
import { assistantPlanIssue, assistantIngredientIssue, validAssistantDate, validAssistantTime } from './src/logic/assistantActions';
import { resolvedServingQuantity } from './src/logic/resolvedPortions';
import { weeklyChangeForGoal } from './src/logic/goals';
import { assistantFoodPortion, foodQueryTerms } from './src/logic/assistantExecution';
import { createDurableStore, mergeStateTransition } from './src/logic/durableStore';

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function now() {
  return new Date().toISOString();
}

/** Test-only copy sent to the private diagnostic store. Device-only photo paths are useless remotely. */
function testingSnapshot(state: AppState) {
  return {
    version: state.version,
    profile: state.profile ? { ...state.profile, profilePhotoUri: undefined } : undefined,
    foods: state.foods.map(({ imageUri: _imageUri, ...food }) => food),
    entries: state.entries,
    weights: state.weights,
    activities: state.activities,
    goals: state.goals,
    plans: state.plans,
    recipes: state.recipes,
    nutritionProgram: state.nutritionProgram
  };
}

function collectionDelta(before: Array<{ id: string }>, after: Array<{ id: string }>) {
  const previous = new Map(before.map((item) => [item.id, JSON.stringify(item)]));
  const next = new Map(after.map((item) => [item.id, JSON.stringify(item)]));
  return {
    before: before.length,
    after: after.length,
    added: [...next.keys()].filter((id) => !previous.has(id)),
    removed: [...previous.keys()].filter((id) => !next.has(id)),
    updated: [...next.keys()].filter((id) => previous.has(id) && previous.get(id) !== next.get(id))
  };
}

function testingStateDelta(before: AppState, after: AppState) {
  return {
    foods: collectionDelta(before.foods, after.foods),
    entries: collectionDelta(before.entries, after.entries),
    weights: collectionDelta(before.weights, after.weights),
    activities: collectionDelta(before.activities, after.activities),
    plans: collectionDelta(before.plans, after.plans),
    recipes: collectionDelta(before.recipes, after.recipes),
    profileChanged: JSON.stringify(before.profile) !== JSON.stringify(after.profile),
    goalsChanged: JSON.stringify(before.goals) !== JSON.stringify(after.goals)
  };
}

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

const LOCAL_PIN_KEY = 'fitness-macro-local-pin-v1';
type GlobalErrorUtils = { getGlobalHandler?: () => ((error: Error, isFatal?: boolean) => void); setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void };

export default function App() {
  useEffect(() => {
    // The first React frame is LaunchScreen, so it is safe to fade the native
    // splash now without exposing an unpainted white window.
    void SplashScreen.hideAsync();
  }, []);
  return (
    <AppErrorBoundary onError={(error, info) => recordLocalDiagnostic('render_error', { message: error.message, componentStack: info.componentStack?.slice(0, 2_000) })}>
      <SafeAreaProvider><FitnessApp /></SafeAreaProvider>
    </AppErrorBoundary>
  );
}

function FitnessApp() {
  useAppTheme();
  const [state, setRenderedState] = useState<AppState>(EMPTY_STATE);
  const [store] = useState(() => createDurableStore(EMPTY_STATE, saveState, setRenderedState));
  const [hydrated, setHydrated] = useState(false);
  const [returnToAppearance] = useState(() => consumeThemeAppearanceReturn());
  const [activeTab, setActiveTab] = useState<TabKey>(() => returnToAppearance ? 'profile' : 'today');
  useAndroidBack(() => {
    if (!hydrated || !state.profile?.onboardingComplete || activeTab === 'today') return false;
    changeTab('today');
    return true;
  }, 0);
  const [date, setDate] = useState(today());
  const [libraryTime, setLibraryTime] = useState('08:00');
  const [quickLogVisible, setQuickLogVisible] = useState(false);
  const [quickLogTime, setQuickLogTime] = useState('12:00');
  const [status, setStatus] = useState('All data is stored locally first.');
  const [audioConfigured, setAudioConfigured] = useState<boolean | null>(null);
  const [appAgentEnabled, setAppAgentEnabled] = useState<boolean | null>(null);
  const [pendingTheme, setPendingTheme] = useState<AppThemeName>(activeTheme);
  const [healthConnect, setHealthConnect] = useState<HealthConnectStatus | null>(null);
  const assistantMessages = state.assistantMessages || [];
  const assistantPlan = state.assistantPlan || null;
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [lockReady, setLockReady] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [startupError, setStartupError] = useState<Error | null>(null);
  const wasBackgrounded = useRef(false);
  const applyingAssistant = useRef(false);
  const healthSyncQueue = useRef<Promise<void>>(Promise.resolve());
  function reportSaveFailure(error: unknown) {
    const message = error instanceof Error ? error.message : 'The phone could not save this change.';
    setStatus(`Not saved: ${message}`);
    recordLocalDiagnostic('storage_write_failed', { message });
    Alert.alert('Change not saved', message);
  }
  function setState(update: AppState | ((current: AppState) => AppState)) {
    void store.update(update).catch(reportSaveFailure);
  }
  function setAssistantMessages(update: AssistantMessage[] | ((messages: AssistantMessage[]) => AssistantMessage[])) {
    setState((current) => ({ ...current, assistantMessages: (typeof update === 'function' ? update(current.assistantMessages || []) : update).slice(-80) }));
  }
  function setAssistantPlan(plan: AssistantPlan | null) { setState((current) => ({ ...current, assistantPlan: plan })); }

  useEffect(() => {
    const errorUtils = (globalThis as typeof globalThis & { ErrorUtils?: GlobalErrorUtils }).ErrorUtils;
    const previous = errorUtils?.getGlobalHandler?.();
    if (!errorUtils?.setGlobalHandler || !previous) return;
    const handler = (error: Error, isFatal?: boolean) => {
      recordLocalDiagnostic('global_js_error', { message: error?.message || String(error), isFatal: Boolean(isFatal), stack: error?.stack?.slice(0, 4_000) });
      previous(error, isFatal);
    };
    errorUtils.setGlobalHandler(handler);
    return () => errorUtils.setGlobalHandler?.(previous);
  }, []);

  useEffect(() => {
    let mounted = true;
    void initializeLocalDiagnostics();
    recordLocalDiagnostic('bootstrap_started');
    void loadState().then(async (loaded) => {
      if (loaded.profile && !loaded.goalHistory?.length) {
        const effectiveFrom = today(loaded.profile.timeZone);
        const { date: _, ...target } = loaded.goals.find(goal => goal.date === effectiveFrom) || recommendDailyGoal(loaded.profile, effectiveFrom);
        loaded = { ...loaded, goalHistory: [{ effectiveFrom, ...target }] };
        await saveState(loaded);
      }
      if (!mounted) return;
      store.hydrate(loaded);
      setDate(today(loaded.profile?.timeZone));
      setHydrated(true);
      recordLocalDiagnostic('app_loaded', { hasProfile: Boolean(loaded.profile?.onboardingComplete), localSchema: loaded.version });
    }).catch((error) => {
      if (!mounted) return;
      const failure = error instanceof Error ? error : new Error(String(error));
      recordLocalDiagnostic('bootstrap_failed', { message: failure.message });
      setStartupError(failure);
    });
    return () => { mounted = false; };
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
    if (!hydrated) return;
    const timer = setTimeout(() => recordLocalDiagnostic('state_snapshot', { snapshot: testingSnapshot(state) }), 800);
    return () => clearTimeout(timer);
  }, [state, hydrated]);

  useEffect(() => { if (hydrated) void refreshHealthConnect(false); }, [hydrated]);

  useEffect(() => {
    if (hydrated && activeTab === 'profile') {
      void refreshIntegrationStatus();
      void refreshHealthConnect(false);
    }
  }, [hydrated, activeTab]);

  useEffect(() => {
    if (!hydrated) return;
    const subscription = NativeAppState.addEventListener('change', (next) => {
      if (next === 'active') {
        if (wasBackgrounded.current) {
          recordLocalDiagnostic('app_foregrounded');
          void initializeLocalDiagnostics();
          void refreshHealthConnect(false);
        }
        wasBackgrounded.current = false;
      } else {
        wasBackgrounded.current = true;
        if (pinEnabled) setUnlocked(false);
      }
    });
    return () => subscription.remove();
  }, [hydrated, pinEnabled]);

  useEffect(() => {
    if (!hydrated || !state.profile) return;
    const profile = state.profile;
    const baseline = estimateTdee(mifflinStJeor(profile), profile.activityFactor);
    const endDate = today(profile.timeZone);
    const series = buildDailySeries({ endDate, days: 28, entries: state.entries, foods: state.foods, activities: state.activities, goals: state.goals, goalHistory: state.goalHistory, profile });
    const adaptive = estimateAdaptiveExpenditure(series, state.weights, baseline, { completedFoodDays: state.completedFoodDays, today: endDate });
    if (adaptive.status !== 'updating' || adaptive.confidence < 0.45) return;
    const current = profile.adaptiveTdee || baseline;
    const lastDate = profile.adaptiveTdeeUpdatedAt ? dateFor(new Date(profile.adaptiveTdeeUpdatedAt), profile.timeZone) : undefined;
    if (lastDate && dateDistance(lastDate, endDate) < 7) return;
    const next = Math.round(Math.max(current - 100, Math.min(current + 100, adaptive.estimate)));
    if (Math.abs(next - current) < 50) return;
    const updated = { ...profile, adaptiveTdee: next, adaptiveTdeeUpdatedAt: now(), updatedAt: now() };
    void store.update((currentState) => currentState.profile?.updatedAt === profile.updatedAt ? withGoalHistory(setProfile(currentState, updated), updated) : currentState)
      .then(() => setStatus('Your plan reviewed confirmed complete food days and weigh-ins. Updated targets apply from today.')).catch(reportSaveFailure);
  }, [hydrated, state.profile, state.entries, state.weights, state.foods, state.activities, state.goals, state.completedFoodDays]);

  function withGoalHistory(value: AppState, profile: UserProfile): AppState {
    const effectiveFrom = today(profile.timeZone);
    const { date: _date, ...target } = recommendDailyGoal(profile, effectiveFrom);
    return { ...upsertGoal(value, { date: effectiveFrom, ...target }), goalHistory: [...(value.goalHistory || []).filter((goal) => goal.effectiveFrom !== effectiveFrom), { effectiveFrom, ...target }].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)) };
  }

  async function toggleFoodDayComplete() {
    if (date > today(state.profile?.timeZone)) return;
    const complete = state.completedFoodDays?.includes(date);
    const days = new Set(state.completedFoodDays || []);
    if (complete) days.delete(date); else days.add(date);
    await commit({ ...state, completedFoodDays: [...days].sort() }, complete ? 'Day reopened. It will not be used for adaptive targets.' : 'Food day marked complete. Only completed past days inform your plan.');
  }

  function changeTab(tab: TabKey) {
    recordLocalDiagnostic('navigation', { destination: tab });
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
  }

  async function commit(nextState: AppState, success: string) {
    try {
      await store.update((current) => mergeStateTransition(state, nextState, current));
      setStatus(success);
      recordLocalDiagnostic('state_committed', { message: success, changes: testingStateDelta(state, nextState) });
    } catch (error) { reportSaveFailure(error); throw error; }
  }

  async function addPlate(items: PlateItem[], eatenAt: string, logDate = date) {
    if (!items.length || !validAssistantDate(logDate) || !validAssistantTime(eatenAt) || items.some(item => !Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity * item.food.serving.gramsPerUnit > 1_000_000)) throw new Error('Check the food amounts, date and time before logging.');
    const mealType = mealForTime(eatenAt);
    const enteredAt = now();
    let next = state;
    for (const item of items) {
      const id = makeId('entry');
      const portion = { foodId: item.food.id, quantity: item.quantity, unit: item.food.serving.unit };
      const entry: FoodEntry = { id, date: logDate, eatenAt, mealType, foodId: item.food.id, portion, note: item.note, enteredAt, source: { source: 'manual', confidence: 1 } };
      next = upsertEntry(upsertFood(next, item.food), entry);
    }
    await commit(next, `${items.length} food${items.length === 1 ? '' : 's'} added at ${eatenAt}`);
  }

  async function addFoodEntry(food: FoodItem, quantity: number, eatenAt: string, note?: string) {
    await addPlate([{ food, quantity, note }], eatenAt);
  }

  async function addWeight(weightKg: number) {
    if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 500) throw new Error('Enter a weight between 20 and 500 kg.');
    const id = state.weights.find((item) => item.date === date)?.id || makeId('weight');
    const enteredAt = now();
    const item: BodyMetricLog = { id, date, weightKg, enteredAt, source: 'manual' };
    await commit(upsertWeight(state, item), 'Weight logged');
  }

  async function addActivity(name: string, durationMinutes: number) {
    if (!name.trim() || !Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) throw new Error('Choose an activity and a duration from 1 to 1,440 minutes.');
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
    const issue = assistantIngredientIssue({ name: values.name, quantity: 1, unit: 'serving', gramsPerUnit: values.servingGrams, caloriesPer100g: values.calories * scale, proteinPer100g: values.protein * scale, carbsPer100g: values.carbs * scale, fatPer100g: values.fat * scale, confidence: 1 });
    if (issue) throw new Error(`Check this food: ${issue}.`);
    const food: FoodItem = { id, name: values.name, brand: values.brand, serving: { unit: 'serving', amount: 1, gramsPerUnit: values.servingGrams }, nutrition: { calories: values.calories * scale, protein: values.protein * scale, carbs: values.carbs * scale, fat: values.fat * scale }, createdAt: timestamp, updatedAt: timestamp, source: { source: 'manual', confidence: 1 } };
    await commit(upsertFood(state, food), `${food.name} saved to your library`);
    return food;
  }

  async function searchFoods(query: string) {
    recordLocalDiagnostic('food_search_requested', { query: query.slice(0, 120) });
    const normalized = query.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const words = foodQueryTerms(query);
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
    if (local.length) {
      recordLocalDiagnostic('food_search_finished', { query: query.slice(0, 120), localCount: local.length, resultCount: local.length });
      return local;
    }
    try {
      const result = await searchHostedFoods(query, 8);
      await store.update((current) => result.items.reduce((next, food) => upsertFood(next, food), current));
      const combined = [...local, ...result.items];
      const unique = combined.filter((food, index) => combined.findIndex((candidate) => candidate.id === food.id) === index);
      const sorted = unique.sort((a, b) => score(b) - score(a));
      recordLocalDiagnostic('food_search_finished', { query: query.slice(0, 120), localCount: local.length, hostedCount: result.items.length, resultCount: sorted.length });
      return sorted;
    } catch {
      // Manual local search stays available even when the optional catalogue
      // lookup is offline, rate-limited, or returns no compatible result.
      recordLocalDiagnostic('food_search_finished', { query: query.slice(0, 120), localCount: local.length, hostedCount: 0, resultCount: local.length, hostedUnavailable: true });
      return local;
    }
  }

  async function barcodeFood(code: string) {
    const response = await lookupFoodByBarcode(code);
    await store.update((current) => upsertFood(current, response.item));
    return response.item;
  }

  async function resolveFoods(phrase: string, defaultTime = currentTime(state.profile?.timeZone)): Promise<AgentResolution> {
    recordAiDiagnostic({ area: 'quick_log', outcome: 'requested', command: phrase });
    try {
      const response = await resolveTranscript(phrase, date, defaultTime, assistantContext());
      const quantities: Record<string, number> = {};
      for (const suggestion of response.suggestions || []) {
        const food = response.candidates.find(item => item.id === suggestion.foodId);
        if (!food) throw new Error('A proposed food is missing. Please retry the request.');
        quantities[food.id] = (quantities[food.id] || 0) + resolvedServingQuantity(food, suggestion.quantity, suggestion.unit);
      }
      const resolution: AgentResolution = { foods: response.candidates, transcript: response.transcript, quantities, notes: response.notes, plan: response.plan };
      await store.update((current) => response.candidates.reduce((next, food) => upsertFood(next, food), current));
      recordAiDiagnostic({ area: 'quick_log', outcome: response.plan?.intent === 'clarify' ? 'no_action' : 'plan_ready', command: phrase, reply: response.plan?.summary || response.notes.join(' '), actions: response.plan ? [{ type: response.plan.intent, name: response.plan.dish?.name || response.plan.title, date: response.plan.log.date, time: response.plan.log.eatenAt }] : [] });
      return resolution;
    } catch (error) {
      recordAiDiagnostic({ area: 'quick_log', outcome: 'failed', command: phrase, error: error instanceof Error ? error.message : 'Food AI request failed.', errorCode: errorCode(error) });
      throw error;
    }
  }

  async function executeAgentResolution(resolution: AgentResolution, fallbackTime: string) {
    const plan = resolution.plan;
    if (!plan || plan.intent === 'clarify') {
      recordAiDiagnostic({ area: 'quick_log', outcome: 'no_action', command: resolution.transcript, reply: plan?.clarification || 'The assistant needs more detail.' });
      throw new Error(plan?.clarification || 'The assistant needs more detail.');
    }
    recordAiDiagnostic({ area: 'quick_log', outcome: 'apply_requested', command: resolution.transcript, actions: [{ type: plan.intent, name: plan.dish?.name || plan.title, date: plan.log.date, time: plan.log.eatenAt }] });
    const resolvedById = new Map([...state.foods, ...resolution.foods].map((food) => [food.id, food]));
    if (plan.intent === 'log_foods') {
      const items = plan.items.map((item) => {
        const food = resolvedById.get(item.foodId);
        if (!food) throw new Error('One proposed food is missing. Nothing was logged; please retry.');
        return { food, quantity: resolvedServingQuantity(food, item.quantity, item.unit), note: `AI resolved from: ${resolution.transcript}` };
      });
      if (!items.length) {
        recordAiDiagnostic({ area: 'quick_log', outcome: 'failed', command: resolution.transcript, error: 'No reliable foods were matched for the proposed log.' });
        throw new Error('The assistant could not match a reliable food.');
      }
      const logDate = plan.log.date || date;
      await addPlate(items, plan.log.eatenAt || fallbackTime, logDate);
      setDate(logDate);
      recordAiDiagnostic({ area: 'quick_log', outcome: 'applied', command: resolution.transcript, actions: [{ type: plan.intent, name: plan.title, date: logDate, time: plan.log.eatenAt }], appliedChanges: items.length });
      return;
    }
    const ingredients = plan.items.map((item) => {
      const food = resolvedById.get(item.foodId);
      if (!food) throw new Error('A recipe ingredient is missing. Nothing was saved.');
      return { foodId: item.foodId, quantity: resolvedServingQuantity(food, item.quantity, item.unit), unit: food.serving.unit };
    });
    const availableFoods = [...resolvedById.values()];
    const calculation = calculateRecipe(ingredients, availableFoods, plan.dish?.finalWeightGrams);
    if (!ingredients.length || !calculation.finalGrams) {
      recordAiDiagnostic({ area: 'quick_log', outcome: 'failed', command: resolution.transcript, error: 'The proposed dish did not contain valid ingredients.' });
      throw new Error('The assistant could not build this dish from reliable ingredients.');
    }
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
    recordAiDiagnostic({ area: 'quick_log', outcome: 'applied', command: resolution.transcript, actions: [{ type: plan.intent, name: food.name, date: logDate, time: eatenAt }], appliedChanges: 2 });
  }

  function changeTheme(theme: AppThemeName) {
    if (theme === pendingTheme) return;
    try { saveAppTheme(theme); setPendingTheme(theme); recordLocalDiagnostic('theme_changed', { theme }); }
    catch { Alert.alert('Theme not saved', 'The phone could not store the appearance preference. Please try again.'); }
  }

  async function transcribeFood(uri: string) {
    try {
      const result = await transcribeRecording(uri);
      setStatus(`Audio transcribed by ${result.engine}; raw audio was not retained.`);
      recordAiDiagnostic({ area: 'voice', outcome: 'plan_ready', command: result.text, reply: `Transcribed with ${result.engine}.` });
      return result.text;
    } catch (error) {
      recordAiDiagnostic({ area: 'voice', outcome: 'failed', error: error instanceof Error ? error.message : 'Voice transcription failed.', errorCode: errorCode(error) });
      throw error;
    }
  }

  function refreshHealthConnect(requestAccess: boolean): Promise<void> {
    const work = healthSyncQueue.current.then(() => performHealthConnectSync(requestAccess));
    healthSyncQueue.current = work.catch(() => undefined);
    return work;
  }

  async function performHealthConnectSync(requestAccess: boolean) {
    recordLocalDiagnostic('health_connect_sync_started', { requestAccess });
    const result = await syncHealthConnect(requestAccess, 30, store.get().profile?.timeZone);
    recordLocalDiagnostic('health_connect_sync_finished', { available: result.status.available, permissionGranted: result.status.permissionGranted, activityCount: result.activities.length, weightCount: result.weights.length });
    setHealthConnect(result.status);
    if (result.syncWindow) {
      try { await store.update((current) => reconcileHealthConnectSync(current, result)); }
      catch (error) { reportSaveFailure(error); return; }
    }
    if (requestAccess) {
      setStatus(result.status.message);
      Alert.alert('Health Connect', result.status.message);
    }
  }

  function assistantContext() {
    const names = new Map(state.foods.map((food) => [food.id, food.name]));
    return {
      currentDate: today(state.profile?.timeZone),
      selectedDiaryDate: date,
      history: assistantMessages.slice(-6).map(({ role, text }) => ({ role, text: text.slice(0, 900) })),
      currentTime: currentTime(state.profile?.timeZone),
      profile: state.profile ? { ...state.profile, profilePhotoUri: undefined } : undefined,
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
    recordAiDiagnostic({ area: 'assistant', outcome: 'requested', command });
    try {
      const plan = await planAssistantCommand(command, assistantContext());
      const askedForChange = /\b(log|logged|lock|locked|add|record|delete|remove|change|move|update|edit|save|create|set|weigh|weight|ate|had|drank)\b/i.test(command);
      const issue = plan.actions.length ? assistantPlanIssue(plan, state, date) : null;
      const noAction = Boolean(issue) || (askedForChange && !plan.actions.length);
      const reply = noAction ? `${plan.reply}\n\n${issue ? 'That plan was incomplete, so I did not enable Apply and nothing changed.' : 'No change is ready to apply yet.'} Please try again with the food, amount, and time.` : plan.reply;
      setAssistantMessages((current) => [...current, { id: makeId('message'), role: 'assistant', text: reply, createdAt: now() }]);
      setAssistantPlan(!noAction && plan.actions.length ? plan : null);
      recordAiDiagnostic({ area: 'assistant', outcome: noAction ? 'no_action' : 'plan_ready', command, reply: plan.reply, error: issue || undefined, actions: diagnosticActions(plan) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The assistant could not prepare a plan.';
      setAssistantMessages((current) => [...current, { id: makeId('message'), role: 'assistant', text: message, createdAt: now() }]);
      recordAiDiagnostic({ area: 'assistant', outcome: 'failed', command, error: message, errorCode: errorCode(error) });
    } finally {
      setAssistantBusy(false);
    }
  }

  async function executeAssistantPlan() {
    if (!assistantPlan?.actions.length || applyingAssistant.current) return;
    applyingAssistant.current = true;
    setAssistantBusy(true);
    recordAiDiagnostic({ area: 'assistant', outcome: 'apply_requested', actions: diagnosticActions(assistantPlan) });
    try {
      const planIssue = assistantPlanIssue(assistantPlan, state, date);
      if (planIssue) throw new Error(`This plan is incomplete (${planIssue}). Nothing was changed. Please ask me to prepare it again.`);
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
        return food;
      };
      const addEntry = (food: FoodItem, quantity: number, entryDate: string, eatenAt: string, note: string, requestedPortion?: FoodPortion) => {
        const id = makeId('entry'); const mealType = mealForTime(eatenAt);
        const portion = requestedPortion || { foodId: food.id, quantity, unit: food.serving.unit };
        next = upsertEntry(next, { id, date: entryDate, eatenAt, mealType, foodId: food.id, portion, note, enteredAt: timestamp, source: { source: 'llm', confidence: 1 } });
        appliedChanges += 1;
        diaryDate = entryDate;
      };
      for (const action of assistantPlan.actions) {
        const actionDate = action.date || date; const actionTime = action.time || currentTime(next.profile?.timeZone);
        if (action.type === 'save_food') { const before = next.foods.length; action.ingredients.forEach(foodFor); appliedChanges += next.foods.length - before; }
        else if (action.type === 'log_foods') action.ingredients.forEach((ingredient) => { const food = foodFor(ingredient); addEntry(food, ingredient.quantity, actionDate, actionTime, 'Logged by the AI assistant.', assistantFoodPortion(food, ingredient)); });
        else if (action.type === 'create_recipe' || action.type === 'create_recipe_and_log') {
          const recipeIngredients = action.ingredients.map((ingredient) => assistantFoodPortion(foodFor(ingredient), ingredient));
          const calculation = calculateRecipe(recipeIngredients, next.foods);
          if (!calculation.finalGrams) throw new Error('This recipe plan has no usable ingredient weight. Nothing was changed.');
          const foodId = makeId('recipe_food'); const recipeId = makeId('recipe'); const servings = Math.max(action.servings || 1, 1);
          const dish: FoodItem = { id: foodId, name: action.name || 'AI dish', serving: { unit: 'serving', amount: 1, gramsPerUnit: calculation.finalGrams / servings }, nutrition: calculation.per100g, tags: ['recipe', 'custom-dish', 'ai-created'], createdAt: timestamp, updatedAt: timestamp, source: { source: 'llm', confidence: action.confidence } };
          const recipe: Recipe = { id: recipeId, name: dish.name, servings, finalWeightGrams: calculation.finalGrams, ingredients: recipeIngredients, foodId, sourceDescription: action.summary, reviewStatus: 'ai_estimated', sourceName: action.sourceName || 'Groq ingredient estimate', sourceUrl: action.sourceUrl, sourceLicense: action.sourceLicense, createdAt: timestamp, updatedAt: timestamp };
          next = upsertRecipe(upsertFood(next, dish), recipe);
          appliedChanges += 1;
          if (action.type === 'create_recipe_and_log') addEntry(dish, action.quantity || 1, actionDate, actionTime, 'Created and logged by the AI assistant.');
        } else if (action.type === 'log_weight' && action.value) {
          const id = next.weights.find((item) => item.date === actionDate)?.id || makeId('weight');
          next = upsertWeight(next, { id, date: actionDate, weightKg: action.value, enteredAt: timestamp, source: 'manual' }); appliedChanges += 1;
        } else if (action.type === 'log_activity' && action.name && action.durationMinutes) {
          const id = makeId('activity'); const calories = action.calories ?? estimateActivityCalories(action.name, action.durationMinutes, next.profile?.bodyWeightKg || 75).calories;
          next = upsertActivity(next, { id, date: actionDate, name: action.name, type: action.name.toLowerCase(), durationMinutes: action.durationMinutes, caloriesEstimated: calories, source: 'manual', createdAt: timestamp }); appliedChanges += 1;
        } else if (action.type === 'change_entry_time' && action.targetId) {
          const entry = next.entries.find((item) => item.id === action.targetId); if (!entry) continue;
          const entryDate = action.date || entry.date;
          const entryTime = action.time || entry.eatenAt || actionTime;
          const updated = { ...entry, date: entryDate, eatenAt: entryTime, mealType: mealForTime(entryTime) };
          diaryDate = entryDate;
          next = upsertEntry(next, updated); appliedChanges += 1;
        } else if (action.type === 'delete_entry' && action.targetId) { const entry = next.entries.find((item) => item.id === action.targetId); if (!entry) continue; diaryDate = entry.date; next = removeEntry(next, action.targetId); appliedChanges += 1; }
        else if (action.type === 'delete_weight' && action.targetId) { next = removeWeight(next, action.targetId); appliedChanges += 1; }
        else if (action.type === 'delete_activity' && action.targetId) { next = removeActivity(next, action.targetId); appliedChanges += 1; }
        else if (action.type === 'set_goal' && action.calories != null && action.protein != null && action.carbs != null && action.fat != null) {
          const goal = { date: actionDate, calories: action.calories, protein: action.protein, carbs: action.carbs, fat: action.fat }; next = upsertGoal(next, goal); appliedChanges += 1;
        } else if (action.type === 'update_profile' && next.profile) {
          const current = next.profile; const input: ProfileInput = { displayName: action.displayName ?? current.displayName, profilePhotoUri: current.profilePhotoUri, sex: current.sex, ageYears: current.ageYears, heightCm: current.heightCm, bodyWeightKg: action.value ?? current.bodyWeightKg, targetWeightKg: action.targetWeightKg ?? current.targetWeightKg, activityFactor: action.activityFactor ?? current.activityFactor, weeklyWeightChangeKg: current.weeklyWeightChangeKg, goalMode: action.goalMode ?? current.goalMode, goalIntensity: action.goalIntensity ?? current.goalIntensity, targetDate: action.targetDate ?? current.targetDate, onboardingComplete: true, preferredHeightUnit: current.preferredHeightUnit, preferredWeightUnit: current.preferredWeightUnit, timeZone: current.timeZone, adaptiveTdee: current.adaptiveTdee, adaptiveTdeeUpdatedAt: current.adaptiveTdeeUpdatedAt, dietStyle: current.dietStyle, preferredCuisine: current.preferredCuisine, mealsPerDay: current.mealsPerDay, excludedFoods: current.excludedFoods };
          const updatedProfile = { ...current, ...input, weeklyWeightChangeKg: weeklyChangeForGoal(input), updatedAt: timestamp };
          next = withGoalHistory(setProfile(next, updatedProfile), updatedProfile); appliedChanges += 1;
        } else if (action.type === 'create_plan_from_day' && action.name) {
          const built = buildPlanFromDay({ id: makeId('plan'), name: action.name, description: action.summary, entries: next.entries.filter((entry) => entry.date === actionDate), now: timestamp, makeItemId: () => makeId('plan_item') }); next = upsertPlan(next, built.plan); appliedChanges += 1;
        } else if (action.type === 'apply_plan' && action.targetId) {
          const plan = next.plans.find((item) => item.id === action.targetId); if (!plan) continue;
          const entries = instantiatePlan({ plan, date: actionDate, now: timestamp, makeEntryId: () => makeId('entry') });
          for (const entry of entries) { next = upsertEntry(next, entry); appliedChanges += 1; diaryDate = entry.date; }
        } else if (action.type === 'delete_plan' && action.targetId) { next = removePlan(next, action.targetId); appliedChanges += 1; }
        else if (action.type === 'navigate' && action.destination) destination = action.destination;
      }
      if (!appliedChanges && !destination) throw new Error('Nothing was applied. Your diary has not changed; please resend the command so the assistant can prepare a valid action.');
      const resultMessage = appliedChanges ? `Applied ${appliedChanges} change${appliedChanges === 1 ? '' : 's'} successfully.` : 'Opened the requested screen.';
      next = { ...next, assistantPlan: null, assistantMessages: [...assistantMessages, { id: makeId('message'), role: 'assistant', text: resultMessage, createdAt: now() }].slice(-80) as AssistantMessage[] };
      await commit(next, resultMessage);
      if (diaryDate) { setDate(diaryDate); changeTab('today'); }
      else if (destination) changeTab(destination);
      recordAiDiagnostic({ area: 'assistant', outcome: 'applied', actions: diagnosticActions(assistantPlan), appliedChanges });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'I could not apply that plan.';
      setAssistantMessages((current) => [...current, { id: makeId('message'), role: 'assistant', text: message, createdAt: now() }]);
      recordAiDiagnostic({ area: 'assistant', outcome: 'failed', actions: diagnosticActions(assistantPlan), error: message, errorCode: errorCode(error) });
    } finally { applyingAssistant.current = false; setAssistantBusy(false); }
  }

  async function saveProfileInput(input: ProfileInput) {
    const timestamp = now();
    const profile: UserProfile = { ...state.profile, ...input, id: state.profile?.id || makeId('profile'), createdAt: state.profile?.createdAt || timestamp, updatedAt: timestamp };
    const goal = recommendDailyGoal(profile, today(profile.timeZone));
    await commit(withGoalHistory(upsertGoal(setProfile(state, profile), goal), profile), `Targets updated to ${goal.calories} kcal and ${goal.protein}g protein`);
    if (input.timeZone !== state.profile?.timeZone) setDate(today(input.timeZone));
    await personalizeProgram(profile);
  }

  async function saveProfilePhoto(profilePhotoUri?: string) {
    if (!state.profile) return;
    const timestamp = now();
    const profile = { ...state.profile, profilePhotoUri: await retainImage(profilePhotoUri), updatedAt: timestamp };
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
    const goal = recommendDailyGoal(profile, today(profile.timeZone));
    await commit(withGoalHistory(upsertGoal(setProfile(base, profile), goal), profile), includeDemo ? 'Profile ready with 60 days of demo history' : 'Profile and targets ready');
    await personalizeProgram(profile);
  }

  async function personalizeProgram(profile: UserProfile) {
    try {
      const response = await getGoalRecommendation(profile);
      const program: NutritionProgram = { createdAt: now(), profileUpdatedAt: profile.updatedAt, ...response.review };
      await store.update((current) => current.profile?.updatedAt === profile.updatedAt ? ({ ...current, nutritionProgram: program }) : current);
      setStatus(response.review.aiGenerated ? 'Personalized food structure created with locked local targets.' : 'Safe local food structure created; AI personalization was unavailable.');
    } catch {
      setStatus('Profile saved. Local targets are active. For an AI meal structure, add a valid Groq key in You → AI & API key, then save your profile again.');
    }
  }

  async function loadDemo() {
    try { await store.update((current) => withDemoData(current, date, current.profile)); setStatus('Demo history loaded locally. Demo data is not marked complete for adaptive learning.'); }
    catch (error) { reportSaveFailure(error); }
  }

  async function importBackup(text: string) {
    try {
      previewPortableBackup(text);
      const before = store.get();
      const restored = await materializeBackupMedia(await prepareBackupRestore(text, before));
      await store.update((current) => { if (current !== before) throw new Error('Your diary changed during restore preparation. Try the import again.'); return restored; });
      setDate(today(restored.profile?.timeZone));
      setStatus('Portable backup restored successfully.');
    } catch (error) {
      Alert.alert('Backup not restored', error instanceof Error ? error.message : 'Choose a complete Weed Fitness backup.');
    }
  }

  async function undoBackupRestore() {
    try {
      const recovery = await loadPreRestoreRecovery();
      if (!recovery) return Alert.alert('No recovery copy', 'A recovery copy is made before you import a backup.');
      await store.update(recovery);
      setStatus('The diary from before the last restore has been recovered.');
    } catch (error) { reportSaveFailure(error); }
  }

  async function updateEntry(entry: FoodEntry) {
    const eatenAt = entry.eatenAt || '12:00';
    if (!validAssistantDate(entry.date) || !validAssistantTime(eatenAt) || !Number.isFinite(entry.portion.quantity) || entry.portion.quantity <= 0) throw new Error('Check the date, time and positive amount.');
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
      emoji: input.emoji, imageUri: await retainImage(input.imageUri), tags: ['recipe', 'custom-dish'], createdAt: timestamp, updatedAt: timestamp, source: { source: 'manual', confidence: 1 }
    };
    const recipe: Recipe = { id: recipeId, name: input.name, servings: input.servings, finalWeightGrams: calculation.finalGrams, ingredients: input.ingredients, foodId, sourceDescription: input.sourceDescription, reviewStatus: 'manual', sourceName: 'Personal cookbook', reviewedAt: timestamp, createdAt: timestamp, updatedAt: timestamp };
    await commit(upsertRecipe(upsertFood(state, food), recipe), `${food.name} saved as a reusable dish`);
    return food;
  }

  async function updateFood(food: FoodItem) {
    await commit(upsertFood(state, { ...food, imageUri: await retainImage(food.imageUri) }), `${food.name} updated for future logs. Past entries are unchanged.`);
  }

  async function updateRecipe(recipeId: string, input: RecipeInput) {
    const previousRecipe = state.recipes.find((recipe) => recipe.id === recipeId);
    if (!previousRecipe) throw new Error('recipe_not_found');
    const previousFood = state.foods.find((food) => food.id === previousRecipe.foodId);
    if (!previousFood) throw new Error('recipe_food_not_found');
    const calculation = calculateRecipe(input.ingredients, state.foods, input.finalWeightGrams);
    if (!calculation.finalGrams || !input.servings) throw new Error('invalid_recipe');
    const timestamp = now();
    const food: FoodItem = { ...previousFood, name: input.name, emoji: input.emoji, imageUri: await retainImage(input.imageUri), serving: { unit: 'serving', amount: 1, gramsPerUnit: calculation.finalGrams / input.servings }, nutrition: calculation.per100g, updatedAt: timestamp };
    const recipe: Recipe = { ...previousRecipe, name: input.name, servings: input.servings, finalWeightGrams: calculation.finalGrams, ingredients: input.ingredients, sourceDescription: input.sourceDescription, reviewStatus: 'manual', sourceName: 'Personal cookbook', reviewedAt: timestamp, updatedAt: timestamp };
    await commit(upsertRecipe(upsertFood(state, food), recipe), `${food.name} recipe updated`);
    return food;
  }

  function applyPlan(plan: MealPlan) {
    Alert.alert('Add this food plan?', `${plan.items.length} foods will be added to ${date}. Existing diary entries will remain.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Add plan', onPress: () => { void applyPlanConfirmed(plan).catch(() => undefined); } }
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
    confirmDelete('food entry', () => { void commit(removeEntry(state, id), 'Food entry deleted').catch(() => undefined); });
  }

  function deleteWeight(id: string) {
    confirmDelete('weight log', () => { void commit(removeWeight(state, id), 'Weight log deleted').catch(() => undefined); });
  }

  function deleteActivity(id: string) {
    confirmDelete('activity', () => { void commit(removeActivity(state, id), 'Activity deleted').catch(() => undefined); });
  }

  function deletePlan(id: string) {
    confirmDelete('food plan', () => { void commit(removePlan(state, id), 'Food plan deleted').catch(() => undefined); });
  }

  async function refreshIntegrationStatus() {
    const [audioResult, agentResult] = await Promise.allSettled([audioStatus(), agentStatus()]);
    setAudioConfigured(audioResult.status === 'fulfilled' ? audioResult.value.configured : false);
    setAppAgentEnabled(agentResult.status === 'fulfilled' ? agentResult.value.appAgent.enabled : false);
  }

  function changeDate(offset: number | 'today') {
    recordLocalDiagnostic('date_navigation', { offset });
    setDate(offset === 'today' ? today(state.profile?.timeZone) : shiftDate(date, offset));
  }

  function openLibrary(time?: string) {
    recordLocalDiagnostic('open_food_library', { time: time || null });
    if (time) setLibraryTime(time);
    changeTab('library');
  }

  function openQuickLog(time: string) {
    recordLocalDiagnostic('open_quick_log', { time });
    setQuickLogTime(time);
    setQuickLogVisible(true);
  }

  if (startupError) throw startupError;
  if (!hydrated || !lockReady) return <LaunchScreen />;
  if (pinEnabled && !unlocked) return <SafeAreaView style={styles.root}><StatusBar barStyle={isDarkTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.paper} /><AccountLockScreen onUnlock={unlockLocalPin} /></SafeAreaView>;
  if (!state.profile?.onboardingComplete) return <SafeAreaView style={styles.root}><StatusBar barStyle={isDarkTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.paper} /><OnboardingScreen date={date} onComplete={completeOnboarding} /></SafeAreaView>;

  let screen: React.ReactNode;
  if (activeTab === 'today') screen = <TodayScreen state={state} date={date} status={status} timeZone={state.profile?.timeZone} onDateChange={changeDate} onQuickAddAt={openQuickLog} onAddWeight={addWeight} onAddActivity={addActivity} onUpdateEntry={updateEntry} onDeleteEntry={deleteEntry} onDeleteEntryConfirmed={(id) => commit(removeEntry(state, id), 'Food entry deleted')} onDeleteWeight={deleteWeight} onDeleteActivity={deleteActivity} onToggleComplete={() => { void toggleFoodDayComplete().catch(() => undefined); }} />;
  else if (activeTab === 'plans') screen = <PlansScreen state={state} date={date} onEditProfile={() => changeTab('profile')} onCreate={createPlan} onApply={applyPlan} onDelete={deletePlan} />;
  else if (activeTab === 'trends') screen = <TrendsScreen state={state} endDate={date} />;
  else if (activeTab === 'assistant') screen = <AssistantScreen state={state} selectedDate={date} messages={assistantMessages} plan={assistantPlan} busy={assistantBusy} onCommand={askAssistant} onTranscribe={transcribeFood} onConfirm={executeAssistantPlan} onDiscard={() => setAssistantPlan(null)} />;
  else if (activeTab === 'library') screen = <LibraryScreen state={state} date={date} initialTime={libraryTime} timeZone={state.profile?.timeZone} onSearch={searchFoods} onBarcode={barcodeFood} onResolve={resolveFoods} onTranscribe={transcribeFood} onAdd={addFoodEntry} onCreateCustom={createCustomFood} onCreateRecipe={createRecipe} onUpdateFood={updateFood} onUpdateRecipe={updateRecipe} />;
  else screen = <ProfileScreen state={state} date={date} status={status} healthConnect={healthConnect} audioConfigured={audioConfigured} appAgentEnabled={appAgentEnabled} initialPanel={returnToAppearance ? 'appearance' : undefined} activeTheme={pendingTheme} onThemeChange={changeTheme} onSave={saveProfileInput} onSavePhoto={saveProfilePhoto} pinEnabled={pinEnabled} onSetLocalPin={setLocalPin} onLoadDemo={loadDemo} onExport={() => exportBackupWithMedia(store.get())} onUndoRestore={undoBackupRestore} onBeforeRestart={() => store.update((current) => current)} onExportDiagnostics={exportAiDiagnostics} onImport={importBackup} onConnectHealth={() => void refreshHealthConnect(true)} onOpenHealthSettings={() => void openHealthConnectSettings()} onRefreshIntegrations={() => { void refreshIntegrationStatus(); void refreshHealthConnect(false); }} />;

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

const styles = themedStyles(() => ({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { flex: 1 },
  atmosphereOne: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: atmosphere.one, opacity: 0.38, top: -150, right: -90 },
  atmosphereTwo: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: atmosphere.two, opacity: 0.34, bottom: 100, left: -150 }
}));
