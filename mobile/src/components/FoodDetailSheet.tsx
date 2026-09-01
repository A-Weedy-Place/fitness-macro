import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FoodItem, Recipe } from '../types';
import { foodEmoji } from '../logic/foodVisual';
import { gramsForQuantity, servingQuantityForDisplay } from '../logic/portions';
import { PortionEditor } from './PortionEditor';
import { Button, SectionTitle } from './ui';
import { colors } from '../theme';

function nutrition(food: FoodItem, grams: number) {
  const scale = grams / 100;
  return { calories: food.nutrition.calories * scale, protein: food.nutrition.protein * scale, fat: food.nutrition.fat * scale, carbs: food.nutrition.carbs * scale };
}

export function FoodDetailSheet({ food, foods, recipes, onClose, onAdd }: { food: FoodItem | null; foods: FoodItem[]; recipes: Recipe[]; onClose: () => void; onAdd?: (food: FoodItem, servingQuantity: number) => void }) {
  const [quantity, setQuantity] = useState('1'); const [unit, setUnit] = useState('serving');
  useEffect(() => { if (!food) return; setQuantity(String(food.serving.amount)); setUnit(food.serving.unit); }, [food?.id]);
  const grams = food ? gramsForQuantity(food, Number(quantity) || 0, unit) : 0;
  const total = food ? nutrition(food, grams) : { calories: 0, protein: 0, fat: 0, carbs: 0 };
  const recipe = food ? recipes.find((item) => item.foodId === food.id) : undefined;
  const ingredientRows = useMemo(() => recipe ? recipe.ingredients.map((item) => { const ingredient = foods.find((candidate) => candidate.id === item.foodId); if (!ingredient) return null; const ingredientGrams = gramsForQuantity(ingredient, item.quantity, item.unit); return { item, ingredient, grams: ingredientGrams, macros: nutrition(ingredient, ingredientGrams) }; }).filter(Boolean) as Array<{ item: Recipe['ingredients'][number]; ingredient: FoodItem; grams: number; macros: ReturnType<typeof nutrition> }> : [], [recipe, foods]);
  if (!food) return null;
  return <Modal visible animationType="slide" onRequestClose={onClose}><SafeAreaView style={styles.root}>
    <View style={styles.top}><Pressable style={styles.close} onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable><Text style={styles.topTitle}>{recipe ? 'Dish details' : 'Food details'}</Text><View style={styles.topSpacer} /></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.heroEmoji}>{foodEmoji(food)}</Text><Text style={styles.name}>{food.name}</Text>{food.brand ? <Text style={styles.brand}>{food.brand}</Text> : null}
      <View style={styles.macros}><Macro value={total.calories.toFixed(0)} label="Calories" color={colors.pine} large /><Macro value={total.protein.toFixed(1)} label="Protein" color={colors.pine} /><Macro value={total.fat.toFixed(1)} label="Fat" color={colors.pine} /><Macro value={total.carbs.toFixed(1)} label="Carbs" color={colors.pine} /></View>
      <View style={styles.divider} />
      <PortionEditor food={food} quantity={quantity} unit={unit} onQuantityChange={setQuantity} onUnitChange={setUnit} label="Amount" />
      {recipe ? <View style={styles.ingredients}><SectionTitle title="Ingredients" detail={`${ingredientRows.length} in full batch`} />{ingredientRows.map(({ item, ingredient, grams: itemGrams, macros }) => <View key={item.foodId} style={styles.ingredient}><Text style={styles.ingredientEmoji}>{foodEmoji(ingredient)}</Text><View style={styles.ingredientCopy}><Text style={styles.ingredientName} numberOfLines={2}>{ingredient.name}</Text><Text style={styles.ingredientAmount}>{item.quantity} {item.unit} · {itemGrams.toFixed(0)} g</Text><Text style={styles.ingredientMacros}>{macros.calories.toFixed(0)} kcal · {macros.protein.toFixed(1)}P · {macros.fat.toFixed(1)}F · {macros.carbs.toFixed(1)}C</Text></View></View>)}</View> : null}
      <Text style={styles.source}>{food.source.source.toUpperCase()} · values normalized per 100 g</Text>
    </ScrollView>
    {onAdd ? <View style={styles.footer}><Button label={`Log now · ${total.calories.toFixed(0)} kcal`} onPress={() => { onAdd(food, servingQuantityForDisplay(food, Number(quantity) || 0, unit)); onClose(); }} /></View> : null}
  </SafeAreaView></Modal>;
}

function Macro({ value, label, color, large = false }: { value: string; label: string; color: string; large?: boolean }) { return <View style={styles.macro}><View style={[styles.macroLine, { backgroundColor: color }]} /><Text style={[styles.macroValue, large && styles.macroValueLarge]}>{value}</Text><Text style={styles.macroLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.card }, top: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderColor: colors.line }, close: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.paperDeep, alignItems: 'center', justifyContent: 'center' }, closeText: { color: colors.ink, fontSize: 25, lineHeight: 27 }, topTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' }, topSpacer: { width: 38 }, content: { padding: 20, paddingBottom: 120 }, heroEmoji: { fontSize: 50, textAlign: 'center' }, name: { color: colors.ink, fontSize: 25, lineHeight: 30, fontWeight: '900', textAlign: 'center', marginTop: 8 }, brand: { color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: 4 }, macros: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 26 }, macro: { width: '23%' }, macroLine: { height: 4, borderRadius: 2, marginBottom: 9 }, macroValue: { color: colors.ink, fontSize: 18, fontWeight: '900' }, macroValueLarge: { fontSize: 25 }, macroLabel: { color: colors.muted, fontSize: 9, marginTop: 2 }, divider: { height: 1, backgroundColor: colors.line, marginVertical: 22 }, ingredients: { marginTop: 20 }, ingredient: { flexDirection: 'row', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.line }, ingredientEmoji: { fontSize: 25 }, ingredientCopy: { flex: 1 }, ingredientName: { color: colors.ink, fontSize: 13, fontWeight: '800' }, ingredientAmount: { color: colors.muted, fontSize: 9, marginTop: 3 }, ingredientMacros: { color: colors.ink, fontSize: 10, fontWeight: '700', marginTop: 4 }, source: { color: colors.faint, fontSize: 8, textAlign: 'center', marginTop: 24 }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.line, padding: 14 }
});
