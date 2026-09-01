import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { FoodEntry, FoodItem } from '../types';
import { nutritionForEntry } from '../logic/nutrition';
import { foodEmoji } from '../logic/foodVisual';
import { colors } from '../theme';

export function MealEntryRow({ entry, food, onDelete, onPress }: { entry: FoodEntry; food?: FoodItem; onDelete?: () => void; onPress?: () => void }) {
  const value = food ? nutritionForEntry(entry, food) : null;
  return <Pressable onPress={onPress} style={styles.row}>
    {food?.imageUri ? <Image source={{ uri: food.imageUri }} style={styles.photo} /> : <Text style={styles.emoji}>{food ? foodEmoji(food) : '🍽️'}</Text>}<View style={styles.copy}><Text style={styles.name} numberOfLines={2}>{food?.name || 'Missing food'}</Text><Text style={styles.meta} numberOfLines={1}>{value ? `${value.calories.toFixed(0)} kcal · ${value.protein.toFixed(0)}P · ${value.fat.toFixed(0)}F · ${value.carbs.toFixed(0)}C` : 'Nutrition unavailable'} · {entry.portion.quantity} {entry.portion.unit}</Text></View>
    {onDelete ? <Pressable hitSlop={10} onPress={(event) => { event.stopPropagation(); onDelete(); }} style={styles.remove}><Text style={styles.removeText}>×</Text></Pressable> : null}
  </Pressable>;
}

const styles = StyleSheet.create({ row: { minHeight: 70, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, borderWidth: 1, borderColor: colors.line }, emoji: { fontSize: 29, width: 42 }, photo: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.paperDeep, marginRight: 4 }, copy: { flex: 1, flexShrink: 1 }, name: { color: colors.ink, fontSize: 13, lineHeight: 17, fontWeight: '800' }, meta: { color: colors.muted, fontSize: 9, marginTop: 5 }, remove: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.paperDeep, alignItems: 'center', justifyContent: 'center', marginLeft: 6 }, removeText: { color: colors.muted, fontSize: 18, lineHeight: 19 } });
