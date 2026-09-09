import { themedStyles } from '../theme';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FoodEntry, FoodItem } from '../types';
import { MealEntryRow } from './MealEntryRow';
import { colors } from '../theme';

const fallback: Record<string, string> = { breakfast: '08:00', lunch: '13:00', dinner: '19:00', snack: '16:00', other: '12:00' };

export function DayTimeline({ entries, foods, onAddAt, onDelete, onOpenEntry }: { entries: FoodEntry[]; foods: FoodItem[]; onAddAt: (time: string) => void; onDelete: (id: string) => void; onOpenEntry?: (entry: FoodEntry) => void }) {
  const groups = [...new Set(entries.map((entry) => entry.eatenAt || fallback[entry.mealType]))].sort();
  if (!groups.length) return <View style={styles.empty}><Text style={styles.emptyTitle}>Nothing logged yet</Text><Text style={styles.emptyDetail}>Use Log food now. Time is added automatically.</Text></View>;
  return <View style={styles.timeline}>{groups.map((time) => { const group = entries.filter((entry) => (entry.eatenAt || fallback[entry.mealType]) === time); return <View key={time} style={styles.group}><View style={styles.timeRail}><Pressable onPress={() => onAddAt(time)} style={styles.timePill}><Text style={styles.timeText}>{formatTime(time)}</Text></Pressable><View style={styles.rail} /></View><View style={styles.foods}>{group.map((entry) => { const food = foods.find((item) => item.id === entry.foodId); return <MealEntryRow key={entry.id} entry={entry} food={food} onPress={food && onOpenEntry ? () => onOpenEntry(entry) : undefined} onDelete={() => onDelete(entry.id)} />; })}</View></View>; })}</View>;
}

function formatTime(time: string) { const hour = Number(time.slice(0, 2)); const minute = time.slice(3); const suffix = hour >= 12 ? 'PM' : 'AM'; const display = hour % 12 || 12; return `${display}:${minute} ${suffix}`; }

const styles = themedStyles(() => ({ timeline: { paddingTop: 3 }, group: { flexDirection: 'row' }, timeRail: { width: 69, alignItems: 'center' }, timePill: { backgroundColor: colors.paperDeep, borderRadius: 16, paddingHorizontal: 9, paddingVertical: 6, zIndex: 2 }, timeText: { color: colors.ink, fontSize: 9, fontWeight: '800' }, rail: { width: 1, backgroundColor: colors.line, flex: 1, minHeight: 48 }, foods: { flex: 1, paddingLeft: 7, paddingBottom: 7 }, empty: { alignItems: 'center', paddingVertical: 30 }, emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' }, emptyDetail: { color: colors.muted, fontSize: 10, marginTop: 5 } }));
