import { FoodItem } from '../types';

const timestamp = '2026-01-01T00:00:00.000Z';

function food(id: string, name: string, unit: string, gramsPerUnit: number, calories: number, protein: number, carbs: number, fat: number, tags: string[] = []): FoodItem {
  return {
    id: `starter_${id}`,
    name,
    serving: { unit, amount: unit === 'g' ? 100 : 1, gramsPerUnit },
    nutrition: { calories, protein, carbs, fat },
    tags: ['starter', 'estimate', ...tags],
    createdAt: timestamp,
    updatedAt: timestamp,
    source: { source: 'local', confidence: 0.72 }
  };
}

export const STARTER_FOODS: FoodItem[] = [
  food('chapati_wholewheat', 'Chapati, whole wheat, thin', 'piece', 45, 297, 9.8, 55.8, 4.6, ['pakistani', 'roti']),
  food('roti_tandoori', 'Tandoori roti', 'piece', 75, 260, 8.7, 52, 2.2, ['pakistani', 'roti']),
  food('paratha_plain', 'Plain paratha', 'piece', 90, 326, 7.2, 45, 13, ['pakistani']),
  food('daal_cooked', 'Daal, cooked', 'bowl', 220, 116, 7.5, 18, 1.8, ['pakistani', 'lentils']),
  food('chicken_karahi', 'Chicken karahi', 'bowl', 250, 174, 18.5, 4.5, 9.2, ['pakistani', 'curry']),
  food('chicken_biryani', 'Chicken biryani', 'plate', 350, 176, 7.5, 24, 5.4, ['pakistani', 'rice']),
  food('basmati_rice', 'Basmati rice, cooked', 'g', 1, 130, 2.7, 28.2, 0.3, ['rice']),
  food('egg_boiled', 'Egg, boiled', 'piece', 50, 155, 12.6, 1.1, 10.6),
  food('yogurt_plain', 'Plain yogurt', 'bowl', 200, 61, 3.5, 4.7, 3.3),
  food('banana', 'Banana', 'piece', 118, 89, 1.1, 22.8, 0.3),
  food('milk_tea', 'Doodh patti / milk tea', 'cup', 250, 54, 1.6, 7.2, 2.1, ['pakistani', 'tea']),
  food('chicken_breast', 'Chicken breast, cooked', 'g', 1, 165, 31, 0, 3.6),

  // Dairy and everyday breakfast ingredients. Values are approximate per 100 g/ml.
  food('milk_whole', 'Milk, whole / full cream', 'cup', 244, 61, 3.2, 4.8, 3.3, ['milk', 'dairy', 'ingredient']),
  food('milk_low_fat', 'Milk, low fat 2%', 'cup', 244, 50, 3.3, 4.8, 2, ['milk', 'dairy', 'ingredient']),
  food('milk_skim', 'Milk, skim', 'cup', 245, 34, 3.4, 5, 0.1, ['milk', 'dairy', 'ingredient']),
  food('milk_buffalo', 'Buffalo milk', 'cup', 244, 97, 3.8, 5.2, 6.9, ['milk', 'dairy', 'pakistani']),
  food('yogurt_greek', 'Greek yogurt, plain', 'bowl', 200, 73, 10, 3.9, 2, ['dairy', 'ingredient']),
  food('paneer', 'Paneer', 'g', 1, 265, 18.3, 1.2, 20.8, ['dairy', 'pakistani', 'ingredient']),
  food('cheddar', 'Cheddar cheese', 'slice', 28, 403, 24.9, 1.3, 33.1, ['dairy', 'ingredient']),
  food('butter', 'Butter', 'tbsp', 14, 717, 0.9, 0.1, 81.1, ['fat', 'ingredient']),
  food('cream', 'Cream, full fat', 'tbsp', 15, 340, 2.1, 2.8, 36.1, ['dairy', 'ingredient']),

  // Grains, flours, breads, and pantry carbohydrates.
  food('atta', 'Whole wheat atta / flour', 'g', 1, 340, 13.2, 72, 2.5, ['flour', 'pakistani', 'ingredient']),
  food('maida', 'Maida / all-purpose flour', 'g', 1, 364, 10.3, 76.3, 1, ['flour', 'pakistani', 'ingredient']),
  food('besan', 'Besan / chickpea flour', 'g', 1, 387, 22.4, 57.8, 6.7, ['flour', 'pakistani', 'ingredient']),
  food('semolina', 'Sooji / semolina, dry', 'g', 1, 360, 12.7, 72.8, 1.1, ['grain', 'pakistani', 'ingredient']),
  food('oats', 'Oats, dry', 'g', 1, 379, 13.2, 67.7, 6.5, ['grain', 'breakfast', 'ingredient']),
  food('white_rice_dry', 'White rice, dry', 'g', 1, 365, 7.1, 80, 0.7, ['rice', 'ingredient']),
  food('brown_rice_cooked', 'Brown rice, cooked', 'g', 1, 123, 2.7, 25.6, 1, ['rice', 'ingredient']),
  food('white_bread', 'White bread', 'slice', 25, 266, 8.9, 49.4, 3.3, ['bread']),
  food('wholewheat_bread', 'Whole wheat bread', 'slice', 28, 252, 12.5, 43.1, 3.5, ['bread']),
  food('naan_plain', 'Plain naan', 'piece', 125, 286, 9, 50, 5, ['pakistani', 'bread']),
  food('pasta_cooked', 'Pasta, cooked', 'g', 1, 158, 5.8, 30.9, 0.9, ['grain', 'ingredient']),
  food('potato_boiled', 'Potato, boiled', 'g', 1, 87, 1.9, 20.1, 0.1, ['vegetable', 'ingredient']),
  food('sweet_potato', 'Sweet potato, cooked', 'g', 1, 90, 2, 20.7, 0.2, ['vegetable', 'ingredient']),

  // Cooking fats, sauces, and sweeteners.
  food('oil_generic', 'Cooking oil', 'tbsp', 14, 884, 0, 0, 100, ['oil', 'fat', 'ingredient']),
  food('olive_oil', 'Olive oil', 'tbsp', 14, 884, 0, 0, 100, ['oil', 'fat', 'ingredient']),
  food('ghee', 'Desi ghee', 'tbsp', 14, 900, 0, 0, 100, ['fat', 'pakistani', 'ingredient']),
  food('sugar', 'White sugar', 'tsp', 4, 387, 0, 100, 0, ['sweetener', 'ingredient']),
  food('honey', 'Honey', 'tbsp', 21, 304, 0.3, 82.4, 0, ['sweetener', 'ingredient']),
  food('ketchup', 'Tomato ketchup', 'tbsp', 17, 101, 1, 27.4, 0.1, ['sauce']),
  food('mayonnaise', 'Mayonnaise', 'tbsp', 14, 680, 1, 0.6, 75, ['sauce', 'fat']),

  // Vegetables and aromatics used by the recipe builder.
  food('onion', 'Onion, raw', 'g', 1, 40, 1.1, 9.3, 0.1, ['vegetable', 'ingredient']),
  food('tomato', 'Tomato, raw', 'g', 1, 18, 0.9, 3.9, 0.2, ['vegetable', 'ingredient']),
  food('garlic', 'Garlic, raw', 'clove', 3, 149, 6.4, 33.1, 0.5, ['aromatic', 'ingredient']),
  food('ginger', 'Ginger, raw', 'tbsp', 6, 80, 1.8, 17.8, 0.8, ['aromatic', 'ingredient']),
  food('green_chilli', 'Green chilli', 'piece', 15, 40, 2, 9.5, 0.2, ['vegetable', 'pakistani', 'ingredient']),
  food('spinach', 'Spinach, raw', 'g', 1, 23, 2.9, 3.6, 0.4, ['vegetable', 'ingredient']),
  food('carrot', 'Carrot, raw', 'g', 1, 41, 0.9, 9.6, 0.2, ['vegetable', 'ingredient']),
  food('cucumber', 'Cucumber, raw', 'g', 1, 15, 0.7, 3.6, 0.1, ['vegetable', 'ingredient']),
  food('cauliflower', 'Cauliflower, raw', 'g', 1, 25, 1.9, 5, 0.3, ['vegetable', 'ingredient']),
  food('peas', 'Green peas, cooked', 'g', 1, 84, 5.4, 15.6, 0.2, ['vegetable', 'ingredient']),
  food('okra', 'Bhindi / okra, cooked', 'g', 1, 33, 1.9, 7.5, 0.2, ['vegetable', 'pakistani', 'ingredient']),

  // Meat, fish, eggs, legumes, and other protein ingredients.
  food('egg_raw', 'Egg, whole, raw', 'piece', 50, 143, 12.6, 0.7, 9.5, ['egg', 'ingredient']),
  food('egg_white', 'Egg white', 'piece', 33, 52, 10.9, 0.7, 0.2, ['egg', 'ingredient']),
  food('chicken_raw', 'Chicken breast, raw', 'g', 1, 120, 22.5, 0, 2.6, ['meat', 'ingredient']),
  food('chicken_thigh', 'Chicken thigh, cooked', 'g', 1, 209, 26, 0, 10.9, ['meat', 'ingredient']),
  food('beef_cooked', 'Beef, lean, cooked', 'g', 1, 250, 26, 0, 15, ['meat', 'ingredient']),
  food('mutton_cooked', 'Mutton / goat, cooked', 'g', 1, 143, 27.1, 0, 3, ['meat', 'pakistani', 'ingredient']),
  food('fish_white', 'White fish, cooked', 'g', 1, 128, 26, 0, 2.7, ['fish', 'ingredient']),
  food('tuna_canned', 'Tuna, canned in water', 'g', 1, 116, 25.5, 0, 0.8, ['fish', 'ingredient']),
  food('masoor_dal_dry', 'Masoor dal / red lentils, dry', 'g', 1, 352, 24.6, 63.4, 1.1, ['lentils', 'pakistani', 'ingredient']),
  food('moong_dal_dry', 'Moong dal, dry', 'g', 1, 347, 23.9, 62.6, 1.2, ['lentils', 'pakistani', 'ingredient']),
  food('chana_dal_dry', 'Chana dal, dry', 'g', 1, 364, 20.8, 60.7, 5.6, ['lentils', 'pakistani', 'ingredient']),
  food('chickpeas_cooked', 'Chickpeas / chana, cooked', 'g', 1, 164, 8.9, 27.4, 2.6, ['legume', 'ingredient']),
  food('kidney_beans', 'Kidney beans / rajma, cooked', 'g', 1, 127, 8.7, 22.8, 0.5, ['legume', 'ingredient']),
  food('tofu', 'Tofu, firm', 'g', 1, 144, 17.3, 2.8, 8.7, ['protein', 'ingredient']),
  food('peanut_butter', 'Peanut butter', 'tbsp', 16, 588, 25.1, 20, 50.4, ['protein', 'fat']),

  // Common fruit and drinks.
  food('apple', 'Apple', 'piece', 182, 52, 0.3, 13.8, 0.2, ['fruit']),
  food('orange', 'Orange', 'piece', 131, 47, 0.9, 11.8, 0.1, ['fruit']),
  food('mango', 'Mango', 'piece', 200, 60, 0.8, 15, 0.4, ['fruit', 'pakistani']),
  food('dates', 'Dates', 'piece', 8, 282, 2.5, 75, 0.4, ['fruit']),
  food('almonds', 'Almonds', 'g', 1, 579, 21.2, 21.6, 49.9, ['nuts']),
  food('chai_black', 'Tea, black, without milk or sugar', 'cup', 240, 1, 0, 0.3, 0, ['tea']),
  food('coffee_black', 'Coffee, black', 'cup', 240, 1, 0.1, 0, 0, ['coffee']),

  // Frequently requested Pakistani, Indian, and nearby regional dishes. These are
  // deliberately labelled as starter estimates; recipes remain editable and are
  // never presented as a substitute for a package label or a saved personal dish.
  food('mash_daal', 'Mash ki daal / urad dal, cooked', 'bowl', 220, 124, 8.8, 19.7, 1.7, ['pakistani', 'daal', 'dal', 'lentils', 'urad', 'mash']),
  food('masoor_daal_cooked', 'Masoor daal / red lentils, cooked', 'bowl', 220, 116, 9, 20, 0.4, ['pakistani', 'daal', 'dal', 'lentils']),
  food('moong_daal_cooked', 'Moong daal, cooked', 'bowl', 220, 105, 7, 19, 0.4, ['pakistani', 'daal', 'dal', 'lentils']),
  food('chana_daal_cooked', 'Chana daal, cooked', 'bowl', 220, 130, 7.5, 22, 2, ['pakistani', 'daal', 'dal', 'lentils']),
  food('dal_chawal', 'Daal chawal / lentils with rice', 'plate', 400, 145, 5.5, 25, 3.2, ['pakistani', 'daal', 'dal', 'rice']),
  food('aloo_keema', 'Aloo keema / potato mince curry', 'plate', 350, 145, 12, 10, 7, ['pakistani', 'keema', 'mince', 'curry']),
  food('beef_keema', 'Beef keema / minced beef curry', 'bowl', 250, 210, 19, 4, 14, ['pakistani', 'keema', 'mince', 'curry']),
  food('chicken_curry', 'Chicken curry, home style', 'bowl', 250, 165, 18, 5, 8, ['pakistani', 'curry']),
  food('chicken_qorma', 'Chicken qorma / korma', 'bowl', 250, 190, 17, 7, 11, ['pakistani', 'curry']),
  food('chicken_handi', 'Chicken handi', 'bowl', 250, 180, 18, 6, 10, ['pakistani', 'curry']),
  food('chicken_pulao', 'Chicken pulao', 'plate', 350, 165, 7, 23, 5, ['pakistani', 'rice']),
  food('vegetable_pulao', 'Vegetable pulao', 'plate', 350, 145, 3.5, 26, 3.5, ['pakistani', 'rice', 'vegetable']),
  food('nihari', 'Beef nihari', 'bowl', 300, 190, 17, 6, 12, ['pakistani', 'beef', 'curry']),
  food('haleem', 'Haleem', 'bowl', 300, 150, 10, 17, 5, ['pakistani', 'lentils', 'meat']),
  food('chana_masala', 'Chana masala / chickpea curry', 'bowl', 250, 165, 8, 27, 3.5, ['pakistani', 'chana', 'chickpeas', 'curry']),
  food('rajma_curry', 'Rajma / kidney bean curry', 'bowl', 250, 130, 8, 23, 1, ['indian', 'beans', 'curry']),
  food('palak_paneer', 'Palak paneer / spinach paneer', 'bowl', 250, 135, 9, 6, 9, ['indian', 'paneer', 'vegetable']),
  food('aloo_gobi', 'Aloo gobi / potato cauliflower', 'bowl', 250, 105, 3, 15, 4.5, ['pakistani', 'indian', 'vegetable']),
  food('bhindi_masala', 'Bhindi masala / okra curry', 'bowl', 250, 90, 3, 10, 5, ['pakistani', 'vegetable', 'okra']),
  food('mixed_vegetable_curry', 'Mixed vegetable curry', 'bowl', 250, 95, 3, 13, 4.5, ['pakistani', 'vegetable', 'curry']),
  food('seekh_kebab', 'Seekh kebab', 'piece', 80, 230, 20, 3, 15, ['pakistani', 'kebab', 'meat']),
  food('shami_kebab', 'Shami kebab', 'piece', 70, 210, 15, 10, 12, ['pakistani', 'kebab', 'meat']),
  food('chicken_tikka', 'Chicken tikka', 'piece', 100, 180, 25, 2, 8, ['pakistani', 'chicken', 'grilled']),
  food('samosa', 'Samosa, potato', 'piece', 80, 280, 4, 31, 15, ['pakistani', 'snack']),
  food('pakora', 'Pakora / vegetable fritter', 'piece', 35, 260, 6, 27, 14, ['pakistani', 'snack']),
  food('raita', 'Raita / yogurt salad', 'bowl', 180, 70, 4, 6, 3, ['pakistani', 'yogurt']),
  food('lassi', 'Sweet lassi', 'glass', 300, 115, 3.5, 16, 4, ['pakistani', 'drink', 'yogurt']),
  food('kheer', 'Kheer / rice pudding', 'bowl', 180, 140, 3.5, 24, 4, ['pakistani', 'dessert']),
  food('dosa', 'Plain dosa', 'piece', 120, 168, 4, 30, 3.7, ['south indian', 'breakfast']),
  food('idli', 'Idli', 'piece', 40, 146, 4, 28, 0.7, ['south indian', 'breakfast']),
  food('sambar', 'Sambar / lentil vegetable stew', 'bowl', 220, 70, 3.5, 11, 2, ['south indian', 'daal', 'dal', 'vegetable']),
  food('upma', 'Upma / savory semolina', 'bowl', 220, 150, 4, 25, 4, ['south indian', 'breakfast']),
  food('fried_egg', 'Egg, fried', 'piece', 50, 196, 13.6, 0.8, 15, ['egg', 'breakfast']),
  food('omelette', 'Plain omelette', 'piece', 110, 154, 11, 2, 11, ['egg', 'breakfast'])
];
