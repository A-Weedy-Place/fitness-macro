import fs from 'node:fs';
import path from 'node:path';
import { FoodItem } from '../contracts.js';

let loadedPath = '';
let foods: FoodItem[] = [];

function load(): FoodItem[] {
  const indexPath = path.resolve(process.env.USDA_LOCAL_INDEX || path.resolve(process.cwd(), 'data/usda-sr-index.json'));
  if (loadedPath === indexPath) return foods;
  loadedPath = indexPath;
  try { foods = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as FoodItem[]; }
  catch { foods = []; }
  return foods;
}

function tokens(value: string) {
  const ignored = new Set(['a', 'an', 'the', 'of', 'and', 'with', 'one', 'two', 'three', 'cup', 'cups', 'gram', 'grams', 'kg', 'ml', 'plate', 'bowl', 'serving']);
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((token) => token.length > 1 && !ignored.has(token));
}

export function searchLocalUsdaFoods(query: string, limit = 12): FoodItem[] {
  const queryTokens = tokens(query);
  if (!queryTokens.length) return [];
  return load().map((food) => {
    const name = food.name.toLowerCase();
    const matched = queryTokens.filter((token) => name.includes(token)).length;
    const exact = name === query.toLowerCase().trim() ? 1000 : name.startsWith(query.toLowerCase().trim()) ? 500 : 0;
    const genericBonus = /, raw|, cooked|, whole|^milk|^egg|^rice|^chicken|^onion|^tomato/.test(name) ? 20 : 0;
    return { food, score: exact + matched * 100 + genericBonus - name.length / 100 };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map((item) => item.food);
}

export function localUsdaIndexStatus() {
  return { configured: load().length > 0, count: load().length };
}

