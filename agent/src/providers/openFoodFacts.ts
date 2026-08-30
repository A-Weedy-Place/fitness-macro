import { FoodItem } from '../contracts.js';

type OffProduct = {
  _id?: string;
  code?: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number;
  nutriments?: Record<string, number>;
};

function mapProduct(product: OffProduct, fallbackId: string): FoodItem | null {
  if (!product.product_name) return null;
  const nutriments = product.nutriments || {};
  const servingGrams = Number(product.serving_quantity || 0);
  const hasServing = Number.isFinite(servingGrams) && servingGrams > 0;
  const now = new Date().toISOString();
  const barcode = product.code || fallbackId;

  return {
    id: `off_${product._id || barcode}`,
    name: product.product_name,
    brand: product.brands,
    barcode,
    serving: hasServing
      ? { unit: 'serving', amount: 1, gramsPerUnit: servingGrams }
      : { unit: 'g', amount: 100, gramsPerUnit: 1 },
    nutrition: {
      calories: Number(nutriments['energy-kcal_100g'] || 0),
      protein: Number(nutriments.proteins_100g || 0),
      carbs: Number(nutriments.carbohydrates_100g || 0),
      fat: Number(nutriments.fat_100g || 0),
      fiber: nutriments.fiber_100g,
      sugar: nutriments.sugars_100g,
      sodiumMg: nutriments.sodium_100g == null ? undefined : Number(nutriments.sodium_100g) * 1000
    },
    source: {
      source: 'openfoodfacts',
      rawId: barcode,
      fetchedAt: now,
      confidence: 0.85
    },
    createdAt: now,
    updatedAt: now
  };
}

export async function fetchOpenFoodFactsByBarcode(barcode: string): Promise<FoodItem | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json', 'User-Agent': 'fitness-macro-agent/0.2' }
    });
    if (!response.ok) return null;
    const payload = await response.json() as { product?: OffProduct };
    return payload.product ? mapProduct(payload.product, barcode) : null;
  } catch {
    return null;
  }
}

export async function fetchOpenFoodFactsByQuery(query: string, limit = 5): Promise<FoodItem[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(limit)
  });
  try {
    const response = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`, {
      headers: { accept: 'application/json', 'User-Agent': 'fitness-macro-agent/0.2' }
    });
    if (!response.ok) return [];
    const payload = await response.json() as { products?: OffProduct[] };
    return (payload.products || [])
      .map((product, index) => mapProduct(product, `${query}_${index}`))
      .filter((item): item is FoodItem => item !== null);
  } catch {
    return [];
  }
}
