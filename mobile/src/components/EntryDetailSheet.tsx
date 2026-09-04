import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FoodEntry, FoodItem } from '../types';
import { nutritionForEntry } from '../logic/nutrition';
import { mealForTime } from '../logic/time';
import { PortionEditor } from './PortionEditor';
import { CalendarPicker } from './CalendarPicker';
import { Button, Field } from './ui';
import { colors } from '../theme';
import { recordTestTelemetry } from '../logic/testTelemetry';

function validTime(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]); const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function shiftTime(value: string, minutes: number) {
  const [hour, minute] = value.split(':').map(Number);
  const total = ((hour * 60 + minute + minutes) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Manual editor for an individual diary item. Food references remain reusable;
 * changing a logged amount, note, date, or time never mutates that recipe. */
export function EntryDetailSheet({ entry, food, onClose, onSave, onDelete }: {
  entry: FoodEntry | null;
  food?: FoodItem;
  onClose: () => void;
  onSave: (entry: FoodEntry) => void;
  onDelete: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState(''); const [time, setTime] = useState(''); const [quantity, setQuantity] = useState(''); const [unit, setUnit] = useState('serving'); const [note, setNote] = useState('');
  useEffect(() => {
    if (!entry) return;
    setDate(entry.date); setTime(entry.eatenAt || '12:00'); setQuantity(String(entry.portion.quantity)); setUnit(entry.portion.unit); setNote(entry.note || '');
    recordTestTelemetry('diary_item_editor_opened', { entryId: entry.id, foodId: entry.foodId, date: entry.date, time: entry.eatenAt || null });
  }, [entry?.id]);
  const preview = useMemo(() => entry && food ? nutritionForEntry({ ...entry, portion: { ...entry.portion, quantity: Number(quantity) || 0, unit } }, food) : null, [entry, food, quantity, unit]);
  if (!entry || !food) return null;

  function save() {
    const sourceEntry = entry;
    if (!sourceEntry) return;
    const normalizedTime = validTime(time);
    const value = Number(quantity);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Alert.alert('Check date', 'Choose a calendar date for this diary item.');
    if (!normalizedTime) return Alert.alert('Check time', 'Use a valid 24-hour time, for example 15:30.');
    if (!Number.isFinite(value) || value <= 0) return Alert.alert('Check amount', 'Enter an amount greater than zero.');
    onSave({ ...sourceEntry, date, eatenAt: normalizedTime, mealType: mealForTime(normalizedTime), portion: { ...sourceEntry.portion, quantity: value, unit }, note: note.trim() || undefined });
    onClose();
  }

  const footerPadding = Math.max(14, insets.bottom + 10);
  return <Modal visible animationType="slide" navigationBarTranslucent={false} statusBarTranslucent={false} onRequestClose={onClose}><SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.root}>
    <View style={styles.top}><Pressable style={styles.close} onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable><Text style={styles.topTitle}>Edit diary item</Text><View style={styles.topSpacer} /></View>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 136 + footerPadding }]} keyboardShouldPersistTaps="handled">
      <Text style={styles.name}>{food.name}</Text><Text style={styles.subhead}>This changes only this logged item, not your saved food or recipe.</Text>
      {preview ? <View style={styles.macros}><Text style={styles.macro}>{preview.calories.toFixed(0)} kcal</Text><Text style={styles.macroDetail}>{preview.protein.toFixed(1)}P · {preview.fat.toFixed(1)}F · {preview.carbs.toFixed(1)}C</Text></View> : null}
      <View style={styles.divider} />
      <CalendarPicker label="LOG DATE" value={date} onChange={setDate} />
      <Field label="Time (24-hour)" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" placeholder="15:30" />
      <View style={styles.timeTools}><Button label="− 15 min" compact tone="ghost" onPress={() => setTime((value) => shiftTime(validTime(value) || '12:00', -15))} /><Button label="+ 15 min" compact tone="ghost" onPress={() => setTime((value) => shiftTime(validTime(value) || '12:00', 15))} /></View>
      <PortionEditor food={food} quantity={quantity} unit={unit} onQuantityChange={setQuantity} onUnitChange={setUnit} label="Amount" />
      <Field label="Note (optional)" value={note} onChangeText={setNote} multiline placeholder="Extra oil, restaurant portion, etc." />
      <Text style={styles.helper}>Tap Save to move this item to another day or time. Food and recipe values stay reusable and unchanged.</Text>
    </ScrollView>
    <View style={[styles.footer, { paddingBottom: footerPadding }]}><Button label="Save changes" onPress={save} /><View style={styles.gap} /><Button label="Delete this item" tone="danger" onPress={() => Alert.alert('Delete diary item?', `Remove ${food.name} from ${entry.date}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { onDelete(entry.id); onClose(); } }])} /></View>
  </SafeAreaView></Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.card }, top: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderColor: colors.line }, close: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.paperDeep, alignItems: 'center', justifyContent: 'center' }, closeText: { color: colors.ink, fontSize: 25, lineHeight: 27 }, topTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' }, topSpacer: { width: 38 }, content: { padding: 20, paddingBottom: 150 }, name: { color: colors.ink, fontSize: 23, fontWeight: '900', textAlign: 'center' }, subhead: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 5 }, macros: { alignItems: 'center', marginTop: 16, backgroundColor: colors.paper, borderRadius: 14, paddingVertical: 10 }, macro: { color: colors.pine, fontSize: 20, fontWeight: '900' }, macroDetail: { color: colors.muted, fontSize: 10, marginTop: 2 }, divider: { height: 1, backgroundColor: colors.line, marginVertical: 20 }, timeTools: { flexDirection: 'row', gap: 7, marginTop: -2, marginBottom: 8 }, helper: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 5 }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.line, padding: 14 }, gap: { height: 8 }
});
