import express from 'express';
import {
  ActivitySchema,
  AppCommandSchema,
  CustomFoodSchema,
  DailyGoalSchema,
  FoodEntrySchema,
  FoodItem,
  MealPlanSchema,
  ProfileSchema,
  ResolveResponse,
  ResolveSchema,
  SearchResponse,
  WeightSchema
} from './contracts.js';
import {
  createActivity,
  createCustomFood,
  createFoodEntry,
  createWeightLog,
  deleteResource,
  db,
  saveFoodItems,
  saveImportedActivities,
  saveMealPlan,
  saveProfile,
  setDailyGoal
} from './storage/repository.js';
import { fetchOpenFoodFactsByBarcode, fetchOpenFoodFactsByQuery } from './providers/openFoodFacts.js';
import { fetchUsdaByQuery } from './providers/usda.js';
import { localUsdaIndexStatus, searchLocalUsdaFoods } from './providers/localUsdaIndex.js';
import { estimateTdee, mifflinStJeor, recommendDailyGoal } from './logic/tdee.js';
import { transcribeAudio, transcriberStatus } from './providers/localTranscriber.js';
import { completeStravaAuthorization, createStravaAuthorizationUrl, fetchStravaActivities, stravaStatus } from './integrations/strava.js';
import { codexGoalAdvisorStatus, reviewGoalWithCodex } from './providers/codexGoalAdvisor.js';
import { appAgentStatus, planAppCommand } from './providers/appAgent.js';
import { foodAgentStatus, resolveFoodWithAgent } from './providers/foodAgent.js';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,x-agent-token');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (_req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const PORT = Number(process.env.AGENT_PORT || 8787);
const HOST = process.env.AGENT_HOST || '0.0.0.0';
const PAIRING_TOKEN = process.env.AGENT_PAIRING_TOKEN || 'dev-local-token';

function auth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.header('x-agent-token') || req.query.token;
  if (!token || token !== PAIRING_TOKEN) {
    res.status(401).json({ error: 'missing_or_invalid_token' });
    return;
  }
  next();
}

function foodSearchResponse(query: string, items: FoodItem[], fromCache: boolean): SearchResponse {
  return { query, items, fromCache, cachedCount: items.length };
}

function transcriptSegments(transcript: string): string[] {
  return transcript.toLowerCase().split(/[,\n.]/).map((value) => value.trim()).filter(Boolean);
}

function uniqueFoods(items: FoodItem[]): FoodItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.barcode || `${item.name.toLowerCase()}|${item.brand?.toLowerCase() || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function findRemoteFoods(query: string, limit = 6): Promise<FoodItem[]> {
  const local = searchLocalUsdaFoods(query, limit);
  if (local.length >= limit) return local;
  const [off, usda] = await Promise.all([
    fetchOpenFoodFactsByQuery(query, limit),
    fetchUsdaByQuery(query)
  ]);
  return uniqueFoods([...local, ...usda, ...off]).slice(0, limit);
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'fitness-macro-agent', time: new Date().toISOString() });
});

app.get('/oauth/strava/callback', async (req, res) => {
  const code = String(req.query.code || '');
  const state = String(req.query.state || '');
  const scope = typeof req.query.scope === 'string' ? req.query.scope : undefined;
  try {
    await completeStravaAuthorization(code, state, scope);
    res.type('html').send('<!doctype html><html><body style="font-family:sans-serif;padding:40px"><h1>Strava connected</h1><p>Return to FitnessMacro and tap Sync Strava.</p></body></html>');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'authorization_failed';
    res.status(400).type('html').send(`<!doctype html><html><body style="font-family:sans-serif;padding:40px"><h1>Connection failed</h1><p>${message.replace(/[^a-zA-Z0-9_-]/g, '')}</p></body></html>`);
  }
});

app.use('/v1', auth);

app.get('/v1/version', (_req, res) => {
  res.json({ version: '0.4.0', schema: 5 });
});

app.get('/v1/audio/status', (_req, res) => {
  res.json({ ...transcriberStatus(), retention: 'memory_only' });
});

app.get('/v1/agent/status', (_req, res) => {
  const appAgent = appAgentStatus();
  const foodAgent = foodAgentStatus();
  res.json({ appAgent, foodAgent, codexAppAgent: appAgent, codexFoodResolver: foodAgent, codexGoalAdvisor: codexGoalAdvisorStatus(), localIngredientIndex: localUsdaIndexStatus() });
});

app.post('/v1/assistant/plan', async (req, res) => {
  const parsed = AppCommandSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', issues: parsed.error.issues });
  try {
    res.json(await planAppCommand(parsed.data.command, parsed.data.context));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'assistant_planning_failed';
    res.status(message === 'codex_app_agent_busy' ? 409 : message === 'codex_app_agent_disabled' ? 503 : 502).json({ error: message });
  }
});

app.get('/v1/integrations/strava/status', (_req, res) => {
  res.json(stravaStatus());
});

app.get('/v1/integrations/strava/authorize-url', (_req, res) => {
  try {
    res.json({ url: createStravaAuthorizationUrl() });
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : 'strava_not_configured' });
  }
});

app.post('/v1/integrations/strava/sync', async (req, res) => {
  const after = typeof req.body?.after === 'string' ? req.body.after : new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(after)) return res.status(400).json({ error: 'invalid_after_date' });
  try {
    const weightKg = db.getProfile()?.bodyWeightKg || db.listWeights().at(-1)?.weightKg || 75;
    const activities = await fetchStravaActivities(after, weightKg);
    await saveImportedActivities(activities);
    res.json({ imported: activities.length, activities });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'strava_sync_failed';
    res.status(message === 'strava_not_connected' ? 409 : 502).json({ error: message });
  }
});

app.post('/v1/audio/transcribe', express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '25mb' }), async (req, res) => {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'missing_audio' });
  const mimeType = req.header('content-type') || 'application/octet-stream';
  const filename = String(req.header('x-audio-filename') || 'recording.m4a').replace(/[^a-zA-Z0-9._-]/g, '_');
  try {
    const result = await transcribeAudio({ audio: req.body, mimeType, filename });
    res.json({ ...result, retained: false });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'transcription_failed';
    res.status(code === 'transcriber_not_configured' ? 503 : 502).json({ error: code });
  }
});

app.get('/v1/foods/search', async (req, res) => {
  const query = String(req.query.q || '').trim();
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
  if (!query) return res.status(400).json({ error: 'missing_query' });

  const cached = db.searchFoodByName(query, limit);
  const indexed = searchLocalUsdaFoods(query, limit);
  const immediate = uniqueFoods([...indexed, ...cached]).slice(0, limit);
  if (immediate.length >= Math.min(3, limit)) return res.json(foodSearchResponse(query, immediate, true));

  const remote = await findRemoteFoods(query, limit);
  const merged = uniqueFoods([...indexed, ...cached, ...remote]).slice(0, limit);
  await saveFoodItems(remote);
  res.json(foodSearchResponse(query, merged, false));
});

app.get('/v1/foods/barcode/:code', async (req, res) => {
  const barcode = String(req.params.code || '').trim();
  if (!barcode) return res.status(400).json({ error: 'missing_barcode' });
  const local = db.getSnapshot().foodItems.find((item) => item.barcode === barcode);
  if (local) return res.json({ barcode, item: local, source: 'local' });
  const food = await fetchOpenFoodFactsByBarcode(barcode);
  if (!food) return res.status(404).json({ error: 'not_found', barcode });
  await saveFoodItems([food]);
  res.json({ barcode, item: food, source: 'openfoodfacts' });
});

app.post('/v1/foods/custom', async (req, res) => {
  const parsed = CustomFoodSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', issues: parsed.error.issues });
  const item = await createCustomFood(parsed.data);
  res.status(201).json({ item });
});

async function handleAgentCommand(req: express.Request, res: express.Response) {
  const parsed = ResolveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', issues: parsed.error.issues });
  try {
    const agentResult = await resolveFoodWithAgent(parsed.data.transcript, parsed.data.defaultDate, parsed.data.defaultTime, parsed.data.context);
    if (agentResult) {
      await saveFoodItems(agentResult.candidates);
      return res.json({ ...agentResult, notes: [`Resolved by the ${foodAgentStatus().provider} food agent.`, ...agentResult.notes] });
    }
  } catch (error) {
    console.warn(`[agent] AI food resolver fallback: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
  const segments = transcriptSegments(parsed.data.transcript).slice(0, 5);
  const matches = await Promise.all(segments.map((segment) => findRemoteFoods(segment, 1)));
  const candidates = uniqueFoods(matches.flat());
  await saveFoodItems(candidates);
  const response: ResolveResponse = {
    transcript: parsed.data.transcript,
    candidates,
    suggestions: candidates.map((food) => ({ foodId: food.id, quantity: food.serving.amount, unit: food.serving.unit, confidence: food.source.confidence || 0.55 })),
    notes: [
      `Parsed ${segments.length} candidate segment(s).`,
      'Confirm quantities and low-confidence foods before logging.'
    ],
    plan: {
      intent: candidates.length ? 'log_foods' : 'clarify',
      title: candidates.length ? 'Log resolved foods' : 'I need one detail',
      summary: candidates.length ? `Log ${candidates.length} resolved food${candidates.length === 1 ? '' : 's'}.` : 'No reliable food could be identified.',
      requiresConfirmation: true,
      clarification: candidates.length ? undefined : 'Which food or dish did you eat?',
      items: candidates.map((food) => ({ foodId: food.id, quantity: food.serving.amount, unit: food.serving.unit, confidence: food.source.confidence || 0.55 })),
      log: { date: parsed.data.defaultDate, eatenAt: parsed.data.defaultTime || '12:00', quantity: 1 }
    }
  };
  res.json(response);
}

app.post('/v1/foods/resolve', handleAgentCommand);
app.post('/v1/agent/command', handleAgentCommand);

app.post('/v1/weights', async (req, res) => {
  const parsed = WeightSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', issues: parsed.error.issues });
  const item = await createWeightLog(parsed.data);
  res.status(201).json({ item });
});

app.get('/v1/weights', (req, res) => {
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  res.json(db.listWeights(from, to));
});

app.delete('/v1/weights/:id', async (req, res) => {
  const deleted = await deleteResource('weight', req.params.id);
  res.status(deleted ? 204 : 404).send();
});

app.post('/v1/activities', async (req, res) => {
  const parsed = ActivitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', issues: parsed.error.issues });
  const item = await createActivity(parsed.data);
  res.status(201).json({ item });
});

app.get('/v1/activities', (req, res) => {
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  res.json(db.listActivities(from, to));
});

app.delete('/v1/activities/:id', async (req, res) => {
  const deleted = await deleteResource('activity', req.params.id);
  res.status(deleted ? 204 : 404).send();
});

app.post('/v1/entries', async (req, res) => {
  const parsed = FoodEntrySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', issues: parsed.error.issues });
  if (!db.getFoodById(parsed.data.foodId)) return res.status(409).json({ error: 'unknown_food' });
  const item = await createFoodEntry(parsed.data);
  res.status(201).json({ item });
});

app.get('/v1/entries', (req, res) => {
  const date = String(req.query.date || '').trim();
  if (date) return res.json(db.listEntries(date));
  const since = String(req.query.since || '').trim();
  if (since) {
    const ids = new Set(db.listSyncSince(since).filter((event) => event.resource === 'entry').map((event) => event.resourceId));
    return res.json(db.allEntries().filter((entry) => ids.has(entry.id)));
  }
  res.json(db.allEntries());
});

app.delete('/v1/entries/:id', async (req, res) => {
  const deleted = await deleteResource('entry', req.params.id);
  res.status(deleted ? 204 : 404).send();
});

app.get('/v1/profile', (_req, res) => {
  const profile = db.getProfile();
  if (!profile) return res.status(404).json({ error: 'not_configured' });
  res.json({ profile });
});

app.put('/v1/profile', async (req, res) => {
  const parsed = ProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', issues: parsed.error.issues });
  const profile = await saveProfile(parsed.data);
  const date = new Date().toISOString().slice(0, 10);
  const recommendedGoal = await setDailyGoal(recommendDailyGoal(profile, date));
  const bmr = mifflinStJeor(profile);
  res.json({ profile, recommendedGoal, bmr, tdee: estimateTdee(bmr, profile.activityFactor) });
});

app.get('/v1/goals', (req, res) => {
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  res.json(db.listGoals(from, to));
});

app.put('/v1/goals/:date', async (req, res) => {
  const parsed = DailyGoalSchema.safeParse({ ...req.body, date: req.params.date });
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', issues: parsed.error.issues });
  res.json({ item: await setDailyGoal(parsed.data) });
});

app.post('/v1/goals/recommendation', async (req, res) => {
  const parsed = ProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', issues: parsed.error.issues });
  const timestamp = new Date().toISOString();
  const profile = { ...parsed.data, id: 'goal-preview', createdAt: timestamp, updatedAt: timestamp };
  const date = timestamp.slice(0, 10);
  const bmr = mifflinStJeor(profile);
  const tdee = profile.adaptiveTdee || estimateTdee(bmr, profile.activityFactor);
  const goal = recommendDailyGoal(profile, date);
  let review = {
    summary: `The ${goal.calories} kcal target starts from an estimated ${tdee} kcal maintenance level and a bounded ${profile.weeklyWeightChangeKg} kg weekly direction.`,
    actions: ['Log food consistently before making adjustments.', 'Review the rolling weight trend after at least two weeks.', 'Keep activity calories visible rather than automatically eating them back.'],
    cautions: ['Estimates are not medical advice; stop and seek qualified guidance if the plan causes concerning symptoms.'],
    aiGenerated: false
  };
  try {
    const ai = await reviewGoalWithCodex(profile, goal, tdee);
    if (ai) review = { ...ai, aiGenerated: true };
  } catch (error) {
    console.warn(`[agent] Codex goal advisor fallback: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
  res.json({ goal, bmr, tdee, review });
});

app.get('/v1/plans', (_req, res) => {
  res.json(db.listPlans());
});

app.post('/v1/plans', async (req, res) => {
  const parsed = MealPlanSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', issues: parsed.error.issues });
  const missingFood = parsed.data.items.find((item) => !db.getFoodById(item.foodId));
  if (missingFood) return res.status(409).json({ error: 'unknown_food', foodId: missingFood.foodId });
  res.status(201).json({ item: await saveMealPlan(parsed.data) });
});

app.delete('/v1/plans/:id', async (req, res) => {
  const deleted = await deleteResource('plan', req.params.id);
  res.status(deleted ? 204 : 404).send();
});

app.get('/v1/export', (_req, res) => {
  const filename = `fitness-export-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=\"${filename}\"`);
  res.send(JSON.stringify(db.getSnapshot(), null, 2));
});

app.get('/v1/health/seed', (_req, res) => {
  const snapshot = db.getSnapshot();
  res.json({
    foodItems: snapshot.foodItems.length,
    entries: snapshot.entries.length,
    weights: snapshot.weights.length,
    activities: snapshot.activities.length
  });
});

app.listen(PORT, HOST, () => {
  console.log(`[agent] listening on http://${HOST}:${PORT}`);
  if (PAIRING_TOKEN === 'dev-local-token') {
    console.warn('[agent] using development pairing token; set AGENT_PAIRING_TOKEN before LAN use');
  }
});
