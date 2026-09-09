import { themedStyles } from '../theme';
import { useAndroidBack } from '../hooks/useAndroidBack';
import React, { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppState, FoodEntry } from '../types';
import { ActivityRow } from '../components/ActivityRow';
import { WeightRow } from '../components/WeightRow';
import { DayTimeline } from '../components/DayTimeline';
import { EntryDetailSheet } from '../components/EntryDetailSheet';
import { Button, Card, Chip, ChipRow, EmptyState, Field, Page, SectionTitle } from '../components/ui';
import { goalForDate } from '../logic/analytics';
import { sumNutrition } from '../logic/nutrition';
import { currentTime } from '../logic/time';
import { colors } from '../theme';
import { dateDistance, shiftDate, startOfWeekMonday, today } from '../utils/dates';
import { lbToKg } from '../logic/units';

const activityTypes = ['Walk', 'Run', 'Strength training', 'Cycling', 'Cricket / football', 'Swimming', 'Yoga', 'Other'];

export function TodayScreen({ state, date, status, timeZone, onDateChange, onQuickAddAt, onAddWeight, onAddActivity, onUpdateEntry, onDeleteEntry, onDeleteEntryConfirmed, onDeleteWeight, onDeleteActivity, onToggleComplete }: { state: AppState; date: string; status: string; timeZone?: string; onDateChange: (offset: number | 'today') => void; onQuickAddAt: (time: string) => void; onAddWeight: (weightKg: number) => Promise<void>; onAddActivity: (name: string, minutes: number) => Promise<void>; onUpdateEntry: (entry: FoodEntry) => Promise<void>; onDeleteEntry: (id: string) => void; onDeleteEntryConfirmed: (id: string) => Promise<void>; onDeleteWeight: (id: string) => void; onDeleteActivity: (id: string) => void; onToggleComplete: () => void }) {
  const [toolsOpen, setToolsOpen] = useState(false); const [weight, setWeight] = useState(''); const [activityName, setActivityName] = useState('Walk'); const [minutes, setMinutes] = useState('30'); const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const weightSaving = useRef(false); const activitySaving = useRef(false);
  useAndroidBack(() => {
    if (weightSaving.current || activitySaving.current) return true;
    if (toolsOpen) { setToolsOpen(false); return true; }
    return false;
  });
  const entries = state.entries.filter((entry) => entry.date === date); const activities = state.activities.filter((item) => item.date === date); const weights = state.weights.filter((item) => item.date === date); const totals = sumNutrition(entries, state.foods); const goal = goalForDate(state.goals, state.profile, date, state.goalHistory); const activityEnergy = activities.reduce((sum, item) => item.caloriesEstimated + sum, 0); const weekStart = startOfWeekMonday(date); const days = Array.from({ length: 7 }, (_, index) => shiftDate(weekStart, index));
  async function submitWeight() {
    if (weightSaving.current) return;
    const submitted = weight; const value = Number(submitted); const kilograms = state.profile?.preferredWeightUnit === 'lb' ? lbToKg(value) : value;
    if (!Number.isFinite(kilograms) || kilograms < 20 || kilograms > 500) return Alert.alert('Check weight', 'Enter a weight between 20 and 500 kg, or its equivalent in pounds.');
    weightSaving.current = true;
    try { await onAddWeight(kilograms); setWeight((current) => current === submitted ? '' : current); }
    catch (error) { Alert.alert('Weight not saved', error instanceof Error ? error.message : 'Your entered weight was kept. Please try again.'); }
    finally { weightSaving.current = false; }
  }
  async function submitActivity() {
    if (activitySaving.current) return;
    const duration = Number(minutes);
    if (!activityName.trim() || !Number.isFinite(duration) || duration < 1 || duration > 1440) return Alert.alert('Check activity', 'Enter an activity and a duration from 1 to 1,440 minutes.');
    activitySaving.current = true;
    try { await onAddActivity(activityName.trim(), duration); }
    catch (error) { Alert.alert('Activity not saved', error instanceof Error ? error.message : 'Your activity details were kept. Please try again.'); }
    finally { activitySaving.current = false; }
  }
  return <Page>
    <View style={styles.header}><Pressable style={styles.nav} onPress={() => onDateChange(-7)}><Text style={styles.navText}>‹</Text></Pressable><View style={styles.headerCenter}><Text style={styles.title}>{date === today(timeZone) ? 'Today' : readableDate(date)}</Text><Pressable onPress={() => onDateChange('today')}><Text style={styles.todayLink}>Week of {readableDate(weekStart)}</Text></Pressable></View><Pressable style={styles.nav} onPress={() => onDateChange(7)}><Text style={styles.navText}>›</Text></Pressable></View>
    <View style={styles.week}>{days.map((item, index) => { const selected = item === date; return <Pressable key={item} onPress={() => onDateChange(dateDistance(date, item))} style={[styles.day, selected && styles.daySelected]}><Text style={[styles.dayName, selected && styles.dayTextSelected]}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</Text><Text style={[styles.dayNumber, selected && styles.dayTextSelected]}>{Number(item.slice(8))}</Text></Pressable>; })}</View>
    <Card style={styles.targetCard}><View style={styles.targetGrid}><Target label="Calories" value={totals.calories} goal={goal?.calories} color={colors.actionText} /><Target label="Protein" value={totals.protein} goal={goal?.protein} color={colors.actionText} suffix="g" /><Target label="Fat" value={totals.fat} goal={goal?.fat} color={colors.actionText} suffix="g" /><Target label="Carbs" value={totals.carbs} goal={goal?.carbs} color={colors.actionText} suffix="g" /></View></Card>
    <Button label={`＋ Log food now · ${formatTime(currentTime(timeZone))}`} onPress={() => onQuickAddAt(currentTime(timeZone))} />
    <View style={styles.space} /><SectionTitle title="Food log" detail={`${entries.length} item${entries.length === 1 ? '' : 's'} · tap to edit`} /><DayTimeline entries={entries} foods={state.foods} onAddAt={onQuickAddAt} onDelete={onDeleteEntry} onOpenEntry={setEditingEntry} />
    <Button compact tone="secondary" disabled={date > today(timeZone)} label={state.completedFoodDays?.includes(date) ? '✓ Food day complete · reopen' : 'Mark food day complete'} onPress={onToggleComplete} />
    <Text style={styles.status}>Confirm after logging everything you ate. Only completed past days help adjust your plan.</Text>
    <Pressable style={styles.toolsToggle} onPress={() => setToolsOpen(!toolsOpen)}><Text style={styles.toolsText}>{toolsOpen ? 'Hide body & activity' : 'Body & activity'}</Text><Text style={styles.toolsArrow}>{toolsOpen ? '−' : '+'}</Text></Pressable>
    {toolsOpen ? <><Card><SectionTitle title="Weight" detail="optional" /><View style={styles.inline}><Field label={`Weight (${state.profile?.preferredWeightUnit || 'kg'})`} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" style={styles.flex} /><Button label="Log" onPress={submitWeight} /></View>{weights.map((item) => <WeightRow key={item.id} item={item} unit={state.profile?.preferredWeightUnit} onDelete={() => onDeleteWeight(item.id)} />)}</Card><Card><SectionTitle title="Activity" detail={`${activityEnergy.toFixed(0)} kcal estimated`} /><ChipRow>{activityTypes.map((type) => <Chip key={type} label={type} selected={activityName === type} onPress={() => setActivityName(type)} />)}</ChipRow><Field label="Activity" value={activityName} onChangeText={setActivityName} placeholder="Choose above or type your own" /><View style={styles.inline}><Field label="Minutes" value={minutes} onChangeText={setMinutes} keyboardType="decimal-pad" style={styles.flex} /><Button label="Add" onPress={submitActivity} /></View>{activities.length ? activities.map((item) => <ActivityRow key={item.id} item={item} onDelete={() => onDeleteActivity(item.id)} />) : <EmptyState title="No activity" detail="Choose a type, add minutes, or connect Health Connect in your profile." />}</Card><Text style={styles.status}>{status}</Text></> : null}
    <EntryDetailSheet entry={editingEntry} food={editingEntry ? state.foods.find((item) => item.id === editingEntry.foodId) : undefined} onClose={() => setEditingEntry(null)} onSave={onUpdateEntry} onDelete={onDeleteEntryConfirmed} />
  </Page>;
}

function Target({ label, value, goal, color, suffix = '' }: { label: string; value: number; goal?: number; color: string; suffix?: string }) { const ratio = goal ? Math.min(1, value / goal) : 0; return <View style={styles.target}><Text style={styles.targetValue}>{value.toFixed(0)}{suffix} <Text style={styles.targetGoal}>/ {goal?.toFixed(0) || '—'}{suffix}</Text></Text><Text style={styles.targetLabel}>{label}</Text><View style={styles.track}><View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} /></View></View>; }
function readableDate(date: string) { return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
function formatTime(time: string) { const hour = Number(time.slice(0, 2)); return `${hour % 12 || 12}:${time.slice(3)} ${hour >= 12 ? 'PM' : 'AM'}`; }
const styles = themedStyles(() => ({ header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }, nav: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card }, navText: { color: colors.ink, fontSize: 29, lineHeight: 30 }, headerCenter: { alignItems: 'center' }, title: { color: colors.ink, fontSize: 24, fontWeight: '900' }, todayLink: { color: colors.muted, fontSize: 9, marginTop: 2 }, week: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }, day: { width: 40, height: 57, borderRadius: 20, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card }, daySelected: { backgroundColor: colors.ink, borderColor: colors.ink }, dayName: { color: colors.muted, fontSize: 9, fontWeight: '800' }, dayNumber: { color: colors.ink, fontSize: 15, fontWeight: '900', marginTop: 3 }, dayTextSelected: { color: colors.onStrong }, targetCard: { padding: 12 }, targetGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 }, target: { width: '48%' }, targetValue: { color: colors.ink, fontSize: 12, fontWeight: '900' }, targetGoal: { color: colors.muted, fontWeight: '700' }, targetLabel: { color: colors.muted, fontSize: 8, marginTop: 1 }, track: { height: 4, borderRadius: 2, backgroundColor: colors.paperDeep, marginTop: 6, overflow: 'hidden' }, fill: { height: '100%', borderRadius: 2 }, space: { height: 15 }, toolsToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 15, padding: 13, marginTop: 12, marginBottom: 10 }, toolsText: { color: colors.ink, fontSize: 11, fontWeight: '800' }, toolsArrow: { color: colors.muted, fontSize: 19 }, inline: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 }, flex: { flex: 1 }, status: { color: colors.faint, fontSize: 9, textAlign: 'center', marginTop: 7 } }));
