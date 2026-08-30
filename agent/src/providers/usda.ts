import { FoodItem } from '../contracts.js';

function mapUsdaToFood(name: string, value: Record<string, any>): FoodItem {
  const nutrients = value.foodNutrients || [];
  const nutrientValue = (nameCode: string): number =>
    nutrients
      .filter((n: any) => String(n.nutrientNumber || n.nutrient?.number || '') === nameCode)
      .map((n: any) => Number(n.value ?? n.amount ?? 0))
      .reduce((a: number, b: number) => a + b, 0);
  return {
    id: `usda_${value.fdcId}`,
    name,
    brand: value.brandOwner,
    barcode: value.gtinUpc,
    serving: {
      unit: 'g',
      amount: 100,
      gramsPerUnit: 1
    },
    nutrition: {
      calories: nutrientValue('208'),
      protein: nutrientValue('203'),
      carbs: nutrientValue('205'),
      fat: nutrientValue('204'),
      fiber: nutrientValue('291'),
      sodiumMg: nutrientValue('307')
    },
    tags: (value.foodCategory || '').toLowerCase().split(';').map((x: string) => x.trim()).filter(Boolean),
    source: {
      source: 'usda',
      rawId: String(value.fdcId),
      fetchedAt: new Date().toISOString(),
      confidence: 0.78
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

async function searchUsdaFoods(query: string, apiKey: string): Promise<FoodItem[]> {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ query, pageSize: 12 })
  });
  if (!res.ok) return [];
  const payload = await res.json();
  const foods = Array.isArray(payload.foods) ? payload.foods : [];
  const dataTypePriority = (value: any) => {
    const type = String(value.dataType || '').toLowerCase();
    return type.includes('foundation') ? 0 : type.includes('sr legacy') ? 1 : type.includes('survey') ? 2 : 3;
  };
  return foods
    .sort((a: any, b: any) => dataTypePriority(a) - dataTypePriority(b))
    .map((f: any) => mapUsdaToFood(f.description || 'Unknown food', f));
}

export async function fetchUsdaByQuery(query: string): Promise<FoodItem[]> {
  // USDA explicitly permits DEMO_KEY for exploration (30 requests/hour, 50/day).
  // A private data.gov key raises this to the normal limit and never reaches the phone.
  const key = process.env.USDA_API_KEY || 'DEMO_KEY';
  try {
    return await searchUsdaFoods(query, key);
  } catch (_err) {
    return [];
  }
}
