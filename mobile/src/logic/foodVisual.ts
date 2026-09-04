import { FoodItem } from '../types';

/** Native Unicode food symbols keep the APK small and are rendered by the
 * phone's maintained color-emoji font. The picker exposes the full practical
 * catalogue while the rules choose a useful default for named foods. */
export const FOOD_EMOJI_CHOICES = [
  '🍽️', '🍛', '🍚', '🍙', '🍘', '🥘', '🍲', '🥣', '🫕', '🫓', '🥖', '🍞', '🥐', '🥯', '🥞', '🧇',
  '🥚', '🍳', '🍗', '🍖', '🥩', '🥓', '🍔', '🌭', '🥪', '🌮', '🌯', '🥙', '🧆', '🍢', '🥟',
  '🐟', '🍣', '🍤', '🦐', '🦀', '🦞', '🦑', '🥛', '🧀', '🧈', '🫗', '☕', '🫖', '🧋', '🥤',
  '🧃', '🍵', '💧', '🍝', '🍜', '🍕', '🥗', '🥫', '🫘', '🥜', '🌰', '🌾', '🥔', '🍠', '🧅',
  '🧄', '🍅', '🌶️', '🫑', '🥕', '🥒', '🥬', '🥦', '🍆', '🌽', '🫛', '🍄', '🫚', '🫜', '🥑',
  '🍎', '🍏', '🍌', '🥭', '🍊', '🍋', '🍋‍🟩', '🍇', '🍓', '🫐', '🍒', '🍑', '🍐', '🍍', '🥝',
  '🍉', '🥥', '🫒', '🌴', '🍯', '🍪', '🍩', '🍰', '🧁', '🥧', '🍮', '🍨', '🍦', '🍫', '🍬', '🍡'
] as const;

export function foodEmoji(food: Pick<FoodItem, 'name' | 'tags' | 'emoji'>): string {
  if (food.emoji?.trim()) return food.emoji.trim();
  const value = `${food.name} ${(food.tags || []).join(' ')}`.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/cold.*coffee|iced.*coffee|frapp|boba|bubble tea/, '🧋'],
    [/cola|coke|pepsi|soda|soft drink|fizzy/, '🥤'], [/juice|squash|sharbat/, '🧃'], [/water/, '💧'],
    [/green tea|kahwa|qahwa/, '🍵'], [/tea|chai|coffee|espresso|latte|cappuccino/, '☕'],
    [/lassi|milkshake|smoothie|shake/, '🥛'], [/milk|doodh|dairy/, '🥛'],
    [/fried egg|omelette|omelet|scrambl/, '🍳'], [/egg/, '🥚'],
    [/biryani|pulao|pilaf|fried rice|khichdi|khichri|rice/, '🍛'],
    [/haleem|nihari|karahi|korma|qorma|curry|salan|stew|handi/, '🍲'],
    [/samosa|dumpling|momo/, '🥟'], [/pakora|pakoda|falafel|fritter/, '🧆'], [/kebab|kabob|tikka|seekh|shami|boti/, '🍢'],
    [/chicken|poultry|murgh/, '🍗'], [/beef|steak/, '🥩'], [/mutton|goat|lamb|meat|gosht/, '🍖'],
    [/bacon/, '🥓'], [/burger/, '🍔'], [/hot dog|sausage/, '🌭'], [/sandwich|toastie/, '🥪'],
    [/fish|tuna|salmon|rohu|pomfret|seafood/, '🐟'], [/prawn|shrimp/, '🍤'], [/crab/, '🦀'], [/lobster/, '🦞'], [/squid/, '🦑'],
    [/sushi/, '🍣'],
    [/daal|dal|dhal|lentil|chana|chickpea|rajma|lobia|mash|urad|bean|legume|soup/, '🥣'],
    [/roti|chapati|naan|paratha|kulcha|puri|poori|flatbread/, '🫓'], [/bread|bun|loaf/, '🍞'],
    [/pancake|cheela|chilla/, '🥞'], [/waffle/, '🧇'], [/croissant/, '🥐'], [/bagel/, '🥯'],
    [/pasta|spaghetti|macaroni|lasagna/, '🍝'], [/noodle|ramen|chow mein/, '🍜'], [/pizza/, '🍕'],
    [/taco/, '🌮'], [/burrito|wrap|shawarma/, '🌯'], [/pita|gyro/, '🥙'],
    [/salad|raita|coleslaw/, '🥗'], [/yogurt|curd|dahi/, '🥣'], [/cheese|paneer/, '🧀'],
    [/butter|ghee/, '🧈'], [/oil|mayonnaise|fat|dressing/, '🫗'], [/atta|flour|oat|grain|wheat|semolina|suji/, '🌾'],
    [/sweet potato|shakarkandi/, '🍠'], [/potato|aloo/, '🥔'], [/tomato/, '🍅'], [/garlic|lehsan/, '🧄'], [/onion|pyaaz/, '🧅'],
    [/bell pepper|capsicum|shimla mirch/, '🫑'], [/chilli|chili|pepper|mirch/, '🌶️'], [/carrot|gajar/, '🥕'], [/cucumber|kheera|pickle|achar/, '🥒'],
    [/broccoli|cauliflower|gobi/, '🥦'], [/eggplant|aubergine|baingan/, '🍆'], [/corn|makai/, '🌽'], [/peas|matar/, '🫛'], [/mushroom/, '🍄'],
    [/ginger|adrak/, '🫚'], [/spinach|palak|leaf|herb|vegetable|okra|bhindi|saag|cabbage|lettuce/, '🥬'], [/avocado/, '🥑'],
    [/banana|kela/, '🍌'], [/mango|aam/, '🥭'], [/green apple/, '🍏'], [/apple|seb/, '🍎'], [/lime/, '🍋‍🟩'], [/lemon/, '🍋'], [/orange|kinnow|citrus/, '🍊'],
    [/grape/, '🍇'], [/strawberry/, '🍓'], [/blueberry/, '🫐'], [/cherry/, '🍒'], [/peach/, '🍑'], [/pear/, '🍐'], [/pineapple/, '🍍'], [/kiwi/, '🥝'],
    [/watermelon|melon/, '🍉'], [/coconut/, '🥥'], [/olive/, '🫒'], [/date|khajoor|raisin|dried fruit/, '🌴'], [/almond|cashew|pistachio|walnut|nut|peanut/, '🥜'],
    [/jalebi|donut|doughnut/, '🍩'], [/gulab jamun|ladoo|laddu|barfi|mithai|candy/, '🍡'], [/kheer|custard|pudding|firni|pheer/, '🍮'],
    [/ice cream|gelato|kulfi/, '🍨'], [/cake/, '🍰'], [/cupcake/, '🧁'], [/pie|tart/, '🥧'], [/cookie|biscuit/, '🍪'], [/chocolate/, '🍫'],
    [/sugar|honey|syrup|sweet|dessert|halwa/, '🍯'], [/recipe|dish|meal/, '🍽️'], [/fruit/, '🍓']
  ];
  return rules.find(([pattern]) => pattern.test(value))?.[1] || '🍽️';
}
