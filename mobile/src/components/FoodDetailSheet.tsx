import { themedStyles } from '../theme';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FoodItem, Recipe } from '../types';
import { foodEmoji } from '../logic/foodVisual';
import { gramsForQuantity, servingQuantityForDisplay } from '../logic/portions';
import { PortionEditor } from './PortionEditor';
import { Button, SectionTitle } from './ui';
import { colors } from '../theme';
import { recordTestTelemetry } from '../logic/testTelemetry';
import { safeRecipeSourceUrl } from '../logic/manualInput';

function nutrition(food: FoodItem, grams: number) {
  const scale = grams / 100;
  return { calories: food.nutrition.calories * scale, protein: food.nutrition.protein * scale, fat: food.nutrition.fat * scale, carbs: food.nutrition.carbs * scale };
}

export function FoodDetailSheet({ food, foods, recipes, onClose, onAdd, onEditFood, onEditRecipe }: { food: FoodItem | null; foods: FoodItem[]; recipes: Recipe[]; onClose: () => void; onAdd?: (food: FoodItem, servingQuantity: number) => Promise<void>; onEditFood?: (food: FoodItem) => void; onEditRecipe?: (recipe: Recipe) => void }) {
  const insets = useSafeAreaInsets();
  const [quantity, setQuantity] = useState('1'); const [unit, setUnit] = useState('serving');
  const [saving, setSaving] = useState(false); const saveInFlight = useRef(false);
  useEffect(() => { if (!food) return; setQuantity(String(food.serving.amount)); setUnit(food.serving.unit); recordTestTelemetry('food_detail_opened', { foodId: food.id, hasRecipe: recipes.some((recipe) => recipe.foodId === food.id) }); }, [food?.id]);
  const grams = food ? gramsForQuantity(food, Number(quantity) || 0, unit) : 0;
  const total = food ? nutrition(food, grams) : { calories: 0, protein: 0, fat: 0, carbs: 0 };
  const recipe = food ? recipes.find((item) => item.foodId === food.id) : undefined;
  const sourceUrl = safeRecipeSourceUrl(recipe?.sourceUrl);
  async function addFood() {
    if (!food || !onAdd || saveInFlight.current) return;
    const value = Number(quantity);
    if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(grams) || grams <= 0 || grams > 1_000_000) return Alert.alert('Check amount', 'Enter a valid positive food amount.');
    saveInFlight.current = true; setSaving(true);
    try { await onAdd(food, servingQuantityForDisplay(food, value, unit)); onClose(); }
    catch (error) { Alert.alert('Food not logged', error instanceof Error ? error.message : 'Your amount was kept. Please try saving again.'); }
    finally { saveInFlight.current = false; setSaving(false); }
  }
  async function openSource() {
    if (!sourceUrl) return;
    try { await Linking.openURL(sourceUrl); }
    catch { Alert.alert('Source unavailable', 'The phone could not open this recipe reference.'); }
  }
  const ingredientRows = useMemo(() => recipe ? recipe.ingredients.map((item) => { const ingredient = foods.find((candidate) => candidate.id === item.foodId); if (!ingredient) return null; const ingredientGrams = gramsForQuantity(ingredient, item.quantity, item.unit); return { item, ingredient, grams: ingredientGrams, macros: nutrition(ingredient, ingredientGrams) }; }).filter(Boolean) as Array<{ item: Recipe['ingredients'][number]; ingredient: FoodItem; grams: number; macros: ReturnType<typeof nutrition> }> : [], [recipe, foods]);
  if (!food) return null;
  const footerPadding = Math.max(14, insets.bottom + 10);
  return <Modal visible animationType="slide" navigationBarTranslucent={false} statusBarTranslucent={false} onRequestClose={() => { if (!saveInFlight.current) onClose(); }}><SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.root}>
    <View style={styles.top}><Pressable style={styles.close} disabled={saving} onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable><Text style={styles.topTitle}>{recipe ? 'Dish details' : 'Food details'}</Text><View style={styles.topSpacer} /></View>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 126 + footerPadding }]} showsVerticalScrollIndicator={false}>
      {food.imageUri ? <Image source={{ uri: food.imageUri }} style={styles.heroPhoto} /> : <Text style={styles.heroEmoji}>{foodEmoji(food)}</Text>}<Text style={styles.name}>{food.name}</Text>{food.brand ? <Text style={styles.brand}>{food.brand}</Text> : null}
      <View style={styles.macros}><Macro value={total.calories.toFixed(0)} label="Calories" color={colors.actionText} large /><Macro value={total.protein.toFixed(1)} label="Protein" color={colors.actionText} /><Macro value={total.fat.toFixed(1)} label="Fat" color={colors.actionText} /><Macro value={total.carbs.toFixed(1)} label="Carbs" color={colors.actionText} /></View>
      <View style={styles.divider} />
      <PortionEditor food={food} quantity={quantity} unit={unit} onQuantityChange={setQuantity} onUnitChange={setUnit} label="Amount" />
      {recipe ? <View style={styles.ingredients}><SectionTitle title="Ingredients" detail={`${ingredientRows.length} in full batch`} />{ingredientRows.map(({ item, ingredient, grams: itemGrams, macros }) => <View key={item.foodId} style={styles.ingredient}><Text style={styles.ingredientEmoji}>{foodEmoji(ingredient)}</Text><View style={styles.ingredientCopy}><Text style={styles.ingredientName} numberOfLines={2}>{ingredient.name}</Text><Text style={styles.ingredientAmount}>{item.quantity} {item.unit} · {itemGrams.toFixed(0)} g</Text><Text style={styles.ingredientMacros}>{macros.calories.toFixed(0)} kcal · {macros.protein.toFixed(1)}P · {macros.fat.toFixed(1)}F · {macros.carbs.toFixed(1)}C</Text></View></View>)}</View> : null}
      <Text style={styles.source}>{food.source.source.toUpperCase()} · values normalized per 100 g</Text>
      {recipe ? <View style={styles.ingredients}>
        <Text style={styles.ingredientName}>Recipe source</Text>
        <Text style={styles.ingredientAmount}>{recipe.sourceName || (recipe.reviewStatus === 'manual' ? 'Your own recipe' : 'Ingredient-based estimate')}</Text>
        {sourceUrl ? <Pressable accessibilityRole="link" onPress={() => void openSource()}><Text style={[styles.ingredientMacros, { color: colors.actionText, textDecorationLine: 'underline' }]}>Open ingredient reference ↗</Text></Pressable> : null}
        {recipe.sourceLicense ? <Text style={styles.ingredientAmount}>License: {recipe.sourceLicense}</Text> : null}
        {recipe.reviewStatus === 'ai_estimated' ? <Text style={styles.ingredientAmount}>Nutrition is estimated. An ingredient reference is not nutrition verification.</Text> : null}
      </View> : null}
    </ScrollView>
    {onAdd || (recipe ? onEditRecipe : onEditFood) ? <View style={[styles.footer, { paddingBottom: footerPadding }]}>{recipe && onEditRecipe ? <Button label="Edit recipe" compact tone="secondary" disabled={saving} onPress={() => { onEditRecipe(recipe); onClose(); }} /> : !recipe && onEditFood ? <Button label="Edit food" compact tone="secondary" disabled={saving} onPress={() => { onEditFood(food); onClose(); }} /> : null}{onAdd ? <Button label={saving ? 'Saving…' : `Log now · ${total.calories.toFixed(0)} kcal`} disabled={saving} onPress={() => void addFood()} /> : null}</View> : null}
  </SafeAreaView></Modal>;
}

function Macro({ value, label, color, large = false }: { value: string; label: string; color: string; large?: boolean }) { return <View style={styles.macro}><View style={[styles.macroLine, { backgroundColor: color }]} /><Text style={[styles.macroValue, large && styles.macroValueLarge]}>{value}</Text><Text style={styles.macroLabel}>{label}</Text></View>; }

const styles = themedStyles(() => ({
  root: { flex: 1, backgroundColor: colors.card }, top: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderColor: colors.line }, close: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.paperDeep, alignItems: 'center', justifyContent: 'center' }, closeText: { color: colors.ink, fontSize: 25, lineHeight: 27 }, topTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' }, topSpacer: { width: 38 }, content: { padding: 20, paddingBottom: 150 }, heroEmoji: { fontSize: 50, textAlign: 'center' }, heroPhoto: { width: 90, height: 90, borderRadius: 26, alignSelf: 'center', backgroundColor: colors.paperDeep }, name: { color: colors.ink, fontSize: 25, lineHeight: 30, fontWeight: '900', textAlign: 'center', marginTop: 8 }, brand: { color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: 4 }, macros: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 26 }, macro: { width: '23%' }, macroLine: { height: 4, borderRadius: 2, marginBottom: 9 }, macroValue: { color: colors.ink, fontSize: 18, fontWeight: '900' }, macroValueLarge: { fontSize: 25 }, macroLabel: { color: colors.muted, fontSize: 9, marginTop: 2 }, divider: { height: 1, backgroundColor: colors.line, marginVertical: 22 }, ingredients: { marginTop: 20 }, ingredient: { flexDirection: 'row', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.line }, ingredientEmoji: { fontSize: 25 }, ingredientCopy: { flex: 1 }, ingredientName: { color: colors.ink, fontSize: 13, fontWeight: '800' }, ingredientAmount: { color: colors.muted, fontSize: 9, marginTop: 3 }, ingredientMacros: { color: colors.ink, fontSize: 10, fontWeight: '700', marginTop: 4 }, source: { color: colors.faint, fontSize: 8, textAlign: 'center', marginTop: 24 }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.line, padding: 14, gap: 8 }
}));
