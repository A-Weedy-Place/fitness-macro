import React, { useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { FoodItem, Recipe, RecipeIngredient, RecipeInput } from '../types';
import { calculateRecipe } from '../logic/recipes';
import { foodEmoji } from '../logic/foodVisual';
import { Button, Card, Field, SectionTitle } from './ui';
import { PortionEditor } from './PortionEditor';
import { colors } from '../theme';

type ResolveResult = { foods: FoodItem[]; quantities: Record<string, number>; notes: string[] };

export function RecipeBuilder({ foods, recipe, recipeFood, onSearch, onResolve, onSave, onClose }: { foods: FoodItem[]; recipe?: Recipe; recipeFood?: FoodItem; onSearch: (text: string) => Promise<FoodItem[]>; onResolve: (text: string) => Promise<ResolveResult>; onSave: (input: RecipeInput) => Promise<FoodItem>; onClose: () => void }) {
  const [name, setName] = useState(recipe?.name || ''); const [servings, setServings] = useState(String(recipe?.servings || 4)); const [finalWeight, setFinalWeight] = useState(recipe?.finalWeightGrams ? String(recipe.finalWeightGrams) : ''); const [description, setDescription] = useState(recipe?.sourceDescription || '');
  const [emoji, setEmoji] = useState(recipeFood?.emoji || ''); const [imageUri, setImageUri] = useState<string | undefined>(recipeFood?.imageUri); const [ingredientSearch, setIngredientSearch] = useState(''); const [suggestions, setSuggestions] = useState<FoodItem[]>(foods.slice(0, 8)); const [ingredients, setIngredients] = useState<RecipeIngredient[]>(recipe?.ingredients || []); const [busy, setBusy] = useState(false);
  const calculation = useMemo(() => calculateRecipe(ingredients, foods, Number(finalWeight) || undefined), [ingredients, foods, finalWeight]);

  function add(food: FoodItem, quantity?: number) { setIngredients((current) => current.some((item) => item.foodId === food.id) ? current : [...current, { foodId: food.id, quantity: quantity || food.serving.amount, unit: food.serving.unit }]); }
  async function findIngredients() { if (!ingredientSearch.trim()) return; setBusy(true); try { setSuggestions(await onSearch(ingredientSearch.trim())); } catch (error) { Alert.alert('Ingredient search unavailable', error instanceof Error ? error.message : 'The food catalogue could not be reached.'); } finally { setBusy(false); } }
  async function aiDraft() {
    if (!description.trim()) return Alert.alert('Describe the dish', 'Name the dish or include any ingredients and quantities you know.');
    setBusy(true);
    try {
      const resolved = await onResolve(`RECIPE INGREDIENT DRAFT. Return separate editable ingredients for this dish, not the finished dish: ${description.trim()}`);
      setIngredients(resolved.foods.map((food) => ({ foodId: food.id, quantity: resolved.quantities[food.id] || food.serving.amount, unit: food.serving.unit })));
      if (!name.trim()) setName(description.trim().split(/[,.]/)[0].slice(0, 60));
    } catch (error) { Alert.alert('AI draft unavailable', error instanceof Error ? error.message : 'Add ingredients manually instead.'); } finally { setBusy(false); }
  }
  async function pickImage() { const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!permission.granted) return Alert.alert('Photo permission needed', 'Allow gallery access to use a recipe photo.'); const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.72 }); if (!result.canceled) setImageUri(result.assets[0]?.uri); }
  async function save() { const count = Number(servings); if (!name.trim() || !Number.isFinite(count) || count <= 0 || !ingredients.length || calculation.finalGrams <= 0) return Alert.alert('Recipe incomplete', 'Add a name, serving count, and at least one valid ingredient.'); setBusy(true); try { await onSave({ name: name.trim(), servings: count, finalWeightGrams: Number(finalWeight) || undefined, ingredients, sourceDescription: description.trim() || undefined, emoji: emoji.trim() || undefined, imageUri }); onClose(); } finally { setBusy(false); } }

  return <Card>
    <SectionTitle title={recipe ? 'Edit recipe' : 'Build a dish'} detail="ingredient-backed nutrition" />
    <View style={styles.visual}>{imageUri ? <Image source={{ uri: imageUri }} style={styles.photo} /> : <Text style={styles.visualEmoji}>{emoji || foodEmoji(recipeFood || { name, source: { source: 'manual' } } as FoodItem)}</Text>}<View style={styles.visualActions}><Button label="Choose photo" compact tone="secondary" onPress={() => void pickImage()} />{imageUri ? <Button label="Remove photo" compact tone="ghost" onPress={() => setImageUri(undefined)} /> : null}</View></View>
    <Field label="Dish name" value={name} onChangeText={setName} placeholder="Home chicken korma" />
    <Field label="Emoji (optional)" value={emoji} onChangeText={setEmoji} placeholder="🍛" maxLength={8} />
    <Field label="Describe dish for AI ingredient draft" value={description} onChangeText={setDescription} multiline placeholder="Chicken korma for four people, normal home recipe" />
    <Button label={busy ? 'Working...' : 'Draft separate ingredients with AI'} disabled={busy} tone="secondary" onPress={() => void aiDraft()} />
    <Text style={styles.or}>OR SEARCH THE FOOD INGREDIENT CATALOGUE</Text>
    <Field label="Ingredient" value={ingredientSearch} onChangeText={setIngredientSearch} placeholder="Milk, chicken, onion, atta..." onSubmitEditing={() => void findIngredients()} />
    <Button label={busy ? 'Searching...' : 'Search ingredients'} compact tone="ghost" disabled={busy} onPress={() => void findIngredients()} />
    <View style={styles.suggestions}>{suggestions.slice(0, 12).map((food) => <Pressable key={food.id} style={styles.suggestion} onPress={() => add(food)}><Text style={styles.suggestionEmoji}>{foodEmoji(food)}</Text><Text style={styles.suggestionText} numberOfLines={2}>{food.name}</Text></Pressable>)}</View>
    <SectionTitle title="Ingredients" detail={`${ingredients.length} editable`} />
    {ingredients.map((item, index) => { const food = foods.find((candidate) => candidate.id === item.foodId); if (!food) return null; return <View key={`${item.foodId}-${index}`} style={styles.row}><View style={styles.ingredientTitle}><Text style={styles.emoji}>{foodEmoji(food)}</Text><Text style={styles.name} numberOfLines={2}>{food.name}</Text><Pressable style={styles.remove} onPress={() => setIngredients((current) => current.filter((_, candidateIndex) => candidateIndex !== index))}><Text style={styles.removeText}>Remove</Text></Pressable></View><PortionEditor food={food} quantity={String(item.quantity)} unit={item.unit} onQuantityChange={(value) => setIngredients((current) => current.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, quantity: Number(value) || 0 } : candidate))} onUnitChange={(unit) => setIngredients((current) => current.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, unit } : candidate))} /></View>; })}
    <View style={styles.columns}><Field label="Servings" value={servings} onChangeText={setServings} keyboardType="decimal-pad" style={styles.half} /><Field label="Cooked weight (g)" value={finalWeight} onChangeText={setFinalWeight} keyboardType="decimal-pad" placeholder={`${calculation.grams.toFixed(0)} raw`} style={styles.half} /></View>
    <View style={styles.summary}><Text style={styles.summaryValue}>{calculation.calories.toFixed(0)} kcal batch</Text><Text style={styles.summaryText}>{(calculation.calories / Math.max(Number(servings) || 1, 1)).toFixed(0)} kcal per serving · {calculation.finalGrams.toFixed(0)} g final weight</Text></View>
    <Button label={busy ? 'Saving...' : recipe ? 'Save recipe changes' : 'Save dish to your library'} disabled={busy} onPress={() => void save()} /><View style={styles.gap} /><Button label="Cancel" tone="ghost" onPress={onClose} />
  </Card>;
}

const styles = StyleSheet.create({
  or: { color: colors.faint, fontSize: 8, fontWeight: '900', letterSpacing: 1, textAlign: 'center', marginVertical: 13 }, suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9, marginBottom: 12 }, suggestion: { width: '48.5%', minHeight: 48, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.pineSoft, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 13 }, suggestionEmoji: { fontSize: 17, marginRight: 6 }, suggestionText: { color: colors.pine, fontSize: 9, lineHeight: 12, fontWeight: '800', flex: 1, flexShrink: 1 },
  visual: { alignItems: 'center', marginBottom: 7 }, photo: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.paperDeep }, visualEmoji: { fontSize: 48, height: 61 }, visualActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 5 }, row: { borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 8 }, ingredientTitle: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 }, emoji: { fontSize: 20 }, name: { color: colors.ink, fontWeight: '800', fontSize: 11, flex: 1, flexShrink: 1 }, remove: { backgroundColor: colors.coralSoft, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 6 }, removeText: { color: colors.danger, fontSize: 8, fontWeight: '900' },
  columns: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }, half: { width: '48.5%' }, summary: { backgroundColor: colors.paper, borderRadius: 13, padding: 10, marginBottom: 9 }, summaryValue: { color: colors.pine, fontSize: 16, fontWeight: '900' }, summaryText: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 3 }, gap: { height: 6 }
});
