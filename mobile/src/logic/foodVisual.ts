import { FoodItem } from '../types';

export function foodEmoji(food: Pick<FoodItem, 'name' | 'tags'>): string {
  const value = `${food.name} ${(food.tags || []).join(' ')}`.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/milk|doodh|dairy/, '🥛'], [/egg/, '🥚'], [/chicken|poultry/, '🍗'], [/beef|mutton|goat|meat/, '🥩'],
    [/fish|tuna|salmon|seafood/, '🐟'], [/rice|biryani|pulao/, '🍚'], [/roti|chapati|naan|bread|paratha/, '🫓'],
    [/daal|dal|lentil|chana|bean|legume|soup/, '🥣'], [/yogurt|curd/, '🥣'], [/cheese|paneer/, '🧀'],
    [/butter|ghee/, '🧈'], [/oil|mayonnaise|fat/, '🫗'], [/atta|flour|oat|grain|wheat|semolina/, '🌾'],
    [/potato/, '🥔'], [/tomato/, '🍅'], [/onion|garlic/, '🧅'], [/chilli|pepper/, '🌶️'], [/carrot/, '🥕'],
    [/spinach|leaf|herb|vegetable|okra|bhindi|cucumber|cauliflower|peas/, '🥬'], [/banana/, '🍌'], [/apple/, '🍎'],
    [/orange|citrus/, '🍊'], [/mango/, '🥭'], [/date|raisin|dried fruit/, '🌴'], [/almond|nut|peanut/, '🥜'],
    [/tea|chai|coffee/, '☕'], [/sugar|honey|sweet|dessert|cake/, '🍯'], [/pasta|noodle/, '🍝'],
    [/recipe|dish|curry|karahi|korma|stew/, '🍲'], [/fruit/, '🍓']
  ];
  return rules.find(([pattern]) => pattern.test(value))?.[1] || '🍽️';
}

