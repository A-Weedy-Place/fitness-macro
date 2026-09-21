import { foodQueryTerms } from '../../logic/assistantExecution';
import { validAssistantDate } from '../../logic/assistantActions';
type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(record).filter((item): item is JsonRecord => Boolean(item)) : [];
}

function terms(value: string): string[] {
  return foodQueryTerms(value);
}

function searchable(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value).toLowerCase();
  if (Array.isArray(value)) return value.map(searchable).join(' ');
  const item = record(value);
  return item ? Object.values(item).map(searchable).join(' ') : '';
}

function ranked(items: JsonRecord[], queryTerms: string[], limit: number): JsonRecord[] {
  if (!queryTerms.length) return items.slice(-Math.min(limit, 6));
  return items
    .map((item, index) => ({ item, score: queryTerms.reduce((sum, term) => sum + (searchable(item).includes(term) ? 1 : 0), 0), index }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.index - a.index)
    .slice(0, limit)
    .map(({ item }) => item);
}

function trimToBudget(context: JsonRecord, maxChars: number): JsonRecord {
  const order = ['entries', 'userFoods', 'recipes', 'activities', 'weights', 'plans', 'goals'];
  while (JSON.stringify(context).length > maxChars) {
    const key = order.find((candidate) => Array.isArray(context[candidate]) && (context[candidate] as unknown[]).length > 1);
    if (!key) break;
    (context[key] as unknown[]).pop();
  }
  return context;
}

export function compactAppContext(command: string, input: unknown): JsonRecord {
  const source = record(input) || {};
  // History is inert conversation data, not privileged model instructions.
  let remaining = 3_000;
  const history = records(source.history).filter((item) => (item.role === 'user' || item.role === 'assistant') && typeof item.text === 'string').slice(-6).reverse()
    .map((item) => { const text = String(item.text).slice(0, Math.min(900, remaining)); remaining -= text.length; return { role: item.role, text }; }).filter((item) => item.text).reverse();
  const queryTerms = terms(`${command} ${history.slice(-2).map((item) => item.text).join(' ')}`);
  const currentDate = validAssistantDate(source.currentDate) ? source.currentDate : new Date().toISOString().slice(0, 10);
  const selectedDiaryDate = validAssistantDate(source.selectedDiaryDate) ? source.selectedDiaryDate : currentDate;
  const allEntries = records(source.entries);
  const todayEntries = allEntries.filter((entry) => entry.date === currentDate || entry.date === selectedDiaryDate).slice(-24).reverse();
  const matchedEntries = ranked(allEntries, queryTerms, 12);
  // Relevant named entries come first so character-budget trimming cannot remove
  // the very item being edited before unrelated entries from the current day.
  const entries = [...new Map([...matchedEntries, ...todayEntries].map((entry) => [entry.id, entry])).values()];
  const recipes = ranked(records(source.recipes), queryTerms, 12);
  const userFoods = ranked(records(source.userFoods), queryTerms, 20);
  const context: JsonRecord = {
    currentDate,
    selectedDiaryDate,
    currentTime: source.currentTime,
    history,
    profile: source.profile,
    goals: records(source.goals).slice(-2),
    entries,
    weights: records(source.weights).slice(-8),
    activities: records(source.activities).slice(-8),
    recipes,
    plans: ranked(records(source.plans), queryTerms, 8),
    userFoods,
    capabilities: source.capabilities,
    retrieval: {
      strategy: 'local_lexical_top_matches',
      supplied: { entries: todayEntries.length + matchedEntries.length, recipes: recipes.length, userFoods: userFoods.length },
      totalAvailable: { entries: allEntries.length, recipes: records(source.recipes).length, userFoods: records(source.userFoods).length }
    }
  };
  return trimToBudget(context, 6_000);
}
