type JsonRecord = Record<string, unknown>;

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'at', 'ate', 'for', 'from', 'had', 'i', 'in', 'it', 'log', 'me', 'my',
  'of', 'on', 'one', 'please', 'some', 'the', 'this', 'to', 'today', 'two', 'was', 'with'
]);

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(record).filter((item): item is JsonRecord => Boolean(item)) : [];
}

function terms(value: string): string[] {
  return [...new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((term) => term.length > 1 && !STOP_WORDS.has(term)))];
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
    .map((item, index) => {
      const text = searchable(item);
      const score = queryTerms.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0);
      return { item, score, index };
    })
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
  const queryTerms = terms(command);
  const currentDate = typeof source.currentDate === 'string' ? source.currentDate : new Date().toISOString().slice(0, 10);
  const allEntries = records(source.entries);
  const todayEntries = allEntries.filter((entry) => entry.date === currentDate).slice(-24);
  const matchedEntries = ranked(allEntries.filter((entry) => entry.date !== currentDate), queryTerms, 8);
  const context: JsonRecord = {
    currentDate,
    currentTime: source.currentTime,
    profile: source.profile,
    goals: records(source.goals).slice(-2),
    entries: [...todayEntries, ...matchedEntries],
    weights: records(source.weights).slice(-8),
    activities: records(source.activities).slice(-8),
    recipes: ranked(records(source.recipes), queryTerms, 12),
    plans: ranked(records(source.plans), queryTerms, 8),
    userFoods: ranked(records(source.userFoods), queryTerms, 20),
    capabilities: source.capabilities,
    retrieval: {
      strategy: 'local_lexical_top_matches',
      supplied: {
        entries: todayEntries.length + matchedEntries.length,
        recipes: ranked(records(source.recipes), queryTerms, 12).length,
        userFoods: ranked(records(source.userFoods), queryTerms, 20).length
      },
      totalAvailable: {
        entries: allEntries.length,
        recipes: records(source.recipes).length,
        userFoods: records(source.userFoods).length
      }
    }
  };
  const maxChars = Math.min(Math.max(Number(process.env.GROQ_MAX_CONTEXT_CHARS || 10_000), 4_000), 20_000);
  return trimToBudget(context, maxChars);
}
