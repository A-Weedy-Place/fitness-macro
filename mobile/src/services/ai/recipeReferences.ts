import { publicFetch } from './groqTransport';
import { foodQueryTerms } from '../../logic/assistantExecution';

export interface RecipeReference {
  dishName: string;
  title: string;
  url: string;
  license: string;
  attribution: string;
  ingredients: string[];
  /** A recipe source is not a laboratory nutrition measurement. */
  nutritionVerified: false;
}
const API = 'https://en.wikibooks.org/w/api.php';
const LICENSE = 'CC BY-SA 4.0';
const cache = new Map<string, { expiresAt: number; result: RecipeReference | null }>();
const plain = (text: string) => text.replace(/<!--[^]*?-->/g, '').replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, '$1').replace(/\{\{[^]*?\}\}/g, '').replace(/<[^>]+>/g, '').replace(/'{2,}/g, '').replace(/&nbsp;/g, ' ').trim();

export function referenceTitleMatches(query: string, title: string): boolean {
  const words = query.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter((word) => foodQueryTerms(word).length);
  const titleWords = new Set(foodQueryTerms(title.replace(/^Cookbook:/i, '')));
  return words.length > 0 && words.every((word) => foodQueryTerms(word).some((alias) => titleWords.has(alias)));
}
export function extractReferenceIngredients(wikitext: string): string[] {
  const section = wikitext.match(/^={2,6}\s*ingredients?\s*={2,6}\s*\r?\n([^]*?)(?=^={2,6}[^=]|$(?![^]))/im)?.[1];
  if (!section) return [];
  return section.split(/\r?\n/).filter((line) => /^\s*[*#]/.test(line)).map((line) => plain(line.replace(/^\s*[*#]+\s*/, ''))).filter(Boolean).slice(0, 16).map((line) => line.slice(0, 180));
}
async function wikiQuery(parameters: Record<string, string>): Promise<Record<string, any>> {
  const url = new URL(API);
  Object.entries({ action: 'query', format: 'json', formatversion: '2', ...parameters }).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await publicFetch(url, 5000);
  if (!response.ok) throw new Error('reference_unavailable');
  const body = await response.text();
  if (body.length > 300_000) throw new Error('reference_too_large');
  const result = JSON.parse(body);
  if (!result || typeof result !== 'object' || result.error) throw new Error('reference_unavailable');
  return result;
}

/** Free, bounded lookup. No scraped search engine, API key, paid tier, or macros. */
export async function lookupRecipeReference(dishName: string): Promise<RecipeReference | null> {
  const query = dishName.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().slice(0, 100);
  if (!query) return null;
  const cached = cache.get(query.toLowerCase());
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  let result: RecipeReference | null = null;
  try {
    const search = await wikiQuery({ list: 'search', srsearch: query, srnamespace: '102', srlimit: '3', srprop: '' });
    const hit = search.query?.search?.find((item: { title?: string; pageid?: number }) => typeof item.title === 'string' && item.title.startsWith('Cookbook:') && referenceTitleMatches(query, item.title));
    if (hit && Number.isInteger(hit.pageid)) {
      const details = await wikiQuery({ pageids: String(hit.pageid), prop: 'revisions', rvprop: 'ids|content', rvslots: 'main' });
      const page = details.query?.pages?.find((item: { pageid?: number }) => item.pageid === hit.pageid);
      const revision = page?.revisions?.[0];
      const ingredients = typeof revision?.slots?.main?.content === 'string' ? extractReferenceIngredients(revision.slots.main.content) : [];
      if (ingredients.length >= 2 && Number.isInteger(revision.revid) && page.title === hit.title) {
        result = { dishName, title: hit.title, url: `https://en.wikibooks.org/w/index.php?title=${encodeURIComponent(hit.title)}&oldid=${revision.revid}`, license: LICENSE, attribution: `Adapted from ${hit.title}, Wikibooks contributors (${LICENSE}; https://creativecommons.org/licenses/by-sa/4.0/). Ingredients/portions may be changed; nutrition remains an estimate.`, ingredients, nutritionVerified: false };
      }
    }
  } catch { /* Absence of a source must never be labelled research success. */ }
  if (cache.size >= 50) cache.delete(cache.keys().next().value!);
  cache.set(query.toLowerCase(), { expiresAt: Date.now() + (result ? 60 * 60_000 : 5 * 60_000), result });
  return result;
}
