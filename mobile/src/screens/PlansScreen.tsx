import { themedStyles } from '../theme';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { AppState, MealPlan } from '../types';
import { Button, Card, EmptyState, Field, MetricTile, Page, ScreenHeader, SectionTitle } from '../components/ui';
import { sumNutrition } from '../logic/nutrition';
import { goalForDate } from '../logic/analytics';
import { estimateTdee, mifflinStJeor } from '../logic/tdee';
import { goalLabel } from '../logic/goals';
import { colors } from '../theme';

export function PlansScreen({ state, date, onEditProfile, onCreate, onApply, onDelete }: {
  state: AppState;
  date: string;
  onEditProfile: () => void;
  onCreate: (name: string, description?: string) => void;
  onApply: (plan: MealPlan) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const dayEntries = state.entries.filter((entry) => entry.date === date);
  const profile = state.profile;
  const goal = goalForDate(state.goals, profile, date, state.goalHistory);
  const tdee = profile ? profile.adaptiveTdee || estimateTdee(mifflinStJeor(profile), profile.activityFactor) : 0;

  function create() {
    if (!name.trim()) return Alert.alert('Name your template', 'Use a short name such as Training day.');
    if (!dayEntries.length) return Alert.alert('Nothing to save', 'Log food for the selected day first.');
    onCreate(name.trim());
    setName('');
  }

  return <Page>
    <ScreenHeader eyebrow="Goals" title="Daily target" subtitle={date} />
    <Card>
      <Text style={styles.direction}>{goalLabel(profile)}</Text>
      <Text style={styles.weight}>{profile?.bodyWeightKg.toFixed(1)} kg → {profile?.targetWeightKg?.toFixed(1) || profile?.bodyWeightKg.toFixed(1)} kg</Text>
      <Button label="Edit goal" compact tone="secondary" onPress={onEditProfile} />
    </Card>
    <View style={styles.metrics}>
      <MetricTile value={`${goal?.calories || '—'}`} label="calories" />
      <MetricTile value={`${goal?.protein || '—'}g`} label="protein" />
      <MetricTile value={`${tdee || '—'}`} label="maintenance" />
      <MetricTile value={`${goal ? Math.abs(goal.calories - tdee) : '—'}`} label="adjustment" />
    </View>

    <SectionTitle title="Repeat a logged day" detail={`${state.plans.length} saved`} />
    <Card>
      <Text style={styles.explainer}>This is a manual shortcut, not AI. Save the foods logged on {date}, then copy them to another selected day later. It never changes your calorie target.</Text>
      <Field label="Saved day name" value={name} onChangeText={setName} placeholder="Training day" />
      <Button label="Save foods from this day" onPress={create} disabled={!dayEntries.length} />
    </Card>
    {state.plans.length ? state.plans.map((plan) => {
      const entries = plan.items.map((item) => ({ ...item, id: item.id, date, enteredAt: plan.updatedAt, source: { source: 'manual' as const } }));
      const totals = sumNutrition(entries, state.foods);
      return <Card key={plan.id}><Text style={styles.planName}>{plan.name}</Text><Text style={styles.planMeta}>{plan.items.length} foods · {totals.calories.toFixed(0)} kcal</Text><View style={styles.actions}><View style={styles.apply}><Button label="Use on selected day" onPress={() => onApply(plan)} /></View><Button label="Delete" compact tone="danger" onPress={() => onDelete(plan.id)} /></View></Card>;
    }) : <Card><EmptyState title="No templates yet" detail="Save a day you want to repeat." /></Card>}
  </Page>;
}

const styles = themedStyles(() => ({
  direction: { color: colors.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  weight: { color: colors.ink, fontSize: 25, fontWeight: '900', marginTop: 5, marginBottom: 13 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  planName: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  planMeta: { color: colors.muted, fontSize: 10, marginTop: 4 },
  explainer: { color: colors.muted, fontSize: 10.5, lineHeight: 16, marginBottom: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 13 },
  apply: { flex: 1 }
}));
