import { themedStyles } from '../theme';
import { dismissKeyboardFirst } from '../hooks/useAndroidBack';
import React, { useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FoodItem } from '../types';
import { Button, Field } from './ui';
import { colors } from '../theme';
import { foodEmoji, FOOD_EMOJI_CHOICES } from '../logic/foodVisual';
import { assistantIngredientIssue } from '../logic/assistantActions';

/** Edits an owner-created food without altering its diary history or source. */
export function FoodEditorSheet({ food, onClose, onSave }: { food: FoodItem | null; onClose: () => void; onSave: (food: FoodItem) => Promise<void> | void }) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(''); const [brand, setBrand] = useState(''); const [emoji, setEmoji] = useState(''); const [imageUri, setImageUri] = useState<string | undefined>();
  const [grams, setGrams] = useState(''); const [calories, setCalories] = useState(''); const [protein, setProtein] = useState(''); const [carbs, setCarbs] = useState(''); const [fat, setFat] = useState('');
  const [saving, setSaving] = useState(false); const saveInFlight = useRef(false);
  useEffect(() => {
    if (!food) return;
    setName(food.name); setBrand(food.brand || ''); setEmoji(food.emoji || ''); setImageUri(food.imageUri);
    setGrams(String(food.serving.gramsPerUnit)); setCalories(String(food.nutrition.calories)); setProtein(String(food.nutrition.protein)); setCarbs(String(food.nutrition.carbs)); setFat(String(food.nutrition.fat));
  }, [food?.id]);
  if (!food) return null;
  const currentFood = food;
  function closeEditor() {
    if (saveInFlight.current || dismissKeyboardFirst()) return;
    const dirty = name !== currentFood.name || brand !== (currentFood.brand || '') || emoji !== (currentFood.emoji || '') || imageUri !== currentFood.imageUri || Number(grams) !== currentFood.serving.gramsPerUnit || Number(calories) !== currentFood.nutrition.calories || Number(protein) !== currentFood.nutrition.protein || Number(carbs) !== currentFood.nutrition.carbs || Number(fat) !== currentFood.nutrition.fat;
    if (!dirty) return onClose();
    Alert.alert('Discard food edits?', 'Your saved food will stay unchanged.', [
      { text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: onClose }
    ]);
  }

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Photo permission needed', 'Allow gallery access to use a food photo.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.72 });
    if (!result.canceled) setImageUri(result.assets[0]?.uri);
  }
  async function save() {
    if (saveInFlight.current) return;
    const values = [Number(grams), Number(calories), Number(protein), Number(carbs), Number(fat)];
    const issue = assistantIngredientIssue({ name: name.trim(), quantity: 1, unit: 'serving', gramsPerUnit: values[0], caloriesPer100g: values[1], proteinPer100g: values[2], carbsPer100g: values[3], fatPer100g: values[4], confidence: 1 });
    if (issue) return Alert.alert('Check food details', issue);
    saveInFlight.current = true; setSaving(true);
    try {
      await onSave({ ...currentFood, name: name.trim(), brand: brand.trim() || undefined, emoji: emoji.trim() || undefined, imageUri, serving: { ...currentFood.serving, gramsPerUnit: values[0] }, nutrition: { ...currentFood.nutrition, calories: values[1], protein: values[2], carbs: values[3], fat: values[4] }, updatedAt: new Date().toISOString() });
      onClose();
    } catch (error) { Alert.alert('Food not saved', error instanceof Error ? error.message : 'Your draft was kept. Please try saving again.'); }
    finally { saveInFlight.current = false; setSaving(false); }
  }

  return <Modal visible animationType="slide" navigationBarTranslucent={false} statusBarTranslucent={false} onRequestClose={closeEditor}><SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.root}>
    <View style={styles.top}><Pressable style={styles.close} disabled={saving} onPress={closeEditor}><Text style={styles.closeText}>×</Text></Pressable><Text style={styles.title}>Edit food</Text><View style={styles.spacer} /></View>
    <ScrollView pointerEvents={saving ? 'none' : 'auto'} contentContainerStyle={[styles.content, { paddingBottom: Math.max(42, insets.bottom + 24) }]} showsVerticalScrollIndicator={false}>
      <View style={styles.visual}>{imageUri ? <Image source={{ uri: imageUri }} style={styles.photo} /> : <Text style={styles.emoji}>{foodEmoji({ ...food, emoji })}</Text>}<View style={styles.visualActions}><Button label="Choose photo" compact tone="secondary" onPress={() => void pickImage()} />{imageUri ? <Button label="Remove photo" compact tone="ghost" onPress={() => setImageUri(undefined)} /> : null}</View></View>
      <Field label="Food name" value={name} onChangeText={setName} /><Field label="Brand (optional)" value={brand} onChangeText={setBrand} />
      <Text style={styles.iconLabel}>CHOOSE A FOOD ICON</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconRail}>{FOOD_EMOJI_CHOICES.map((choice) => <Pressable key={choice} onPress={() => setEmoji(choice)} style={[styles.iconChoice, emoji === choice && styles.iconChoiceSelected]}><Text style={styles.iconText}>{choice}</Text></Pressable>)}</ScrollView>
      <Field label="Or enter an emoji" value={emoji} onChangeText={setEmoji} placeholder="🥛" maxLength={8} />
      <Text style={styles.helper}>Nutrition is stored per 100 g. Changes apply to future logs. Past diary nutrition stays unchanged; edit a diary entry to correct its amount.</Text>
      <Field label={`One ${food.serving.unit} weighs (g)`} value={grams} onChangeText={setGrams} keyboardType="decimal-pad" />
      <View style={styles.grid}><Field label="Calories / 100 g" value={calories} onChangeText={setCalories} keyboardType="decimal-pad" style={styles.half} /><Field label="Protein / 100 g" value={protein} onChangeText={setProtein} keyboardType="decimal-pad" style={styles.half} /><Field label="Fat / 100 g" value={fat} onChangeText={setFat} keyboardType="decimal-pad" style={styles.half} /><Field label="Carbs / 100 g" value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" style={styles.half} /></View>
      <Button label={saving ? 'Saving…' : 'Save food changes'} disabled={saving} onPress={() => void save()} />
    </ScrollView>
  </SafeAreaView></Modal>;
}

const styles = themedStyles(() => ({
  root: { flex: 1, backgroundColor: colors.card }, top: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderColor: colors.line }, close: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.paperDeep, alignItems: 'center', justifyContent: 'center' }, closeText: { color: colors.ink, fontSize: 25, lineHeight: 27 }, title: { color: colors.ink, fontSize: 15, fontWeight: '900' }, spacer: { width: 38 }, content: { padding: 20, paddingBottom: 42 }, visual: { alignItems: 'center', marginBottom: 14 }, photo: { width: 86, height: 86, borderRadius: 24, backgroundColor: colors.paperDeep }, emoji: { fontSize: 58, height: 78 }, visualActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 }, iconLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginBottom: 7 }, iconRail: { gap: 7, paddingBottom: 12 }, iconChoice: { width: 43, height: 43, borderRadius: 13, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, iconChoiceSelected: { borderColor: colors.pine, borderWidth: 2, backgroundColor: colors.pineSoft }, iconText: { fontSize: 24 }, helper: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 2, marginBottom: 11 }, grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }, half: { width: '48.5%' }
}));
