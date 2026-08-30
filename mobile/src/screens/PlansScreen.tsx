import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { AppState, MealPlan } from '../types';
import { GoalReviewResponse } from '../services/agentClient';
import { Button, Card, EmptyState, Field, MetricTile, Page, ScreenHeader, SectionTitle } from '../components/ui';
import { sumNutrition } from '../logic/nutrition';
import { goalForDate } from '../logic/analytics';
import { estimateTdee, mifflinStJeor } from '../logic/tdee';
import { goalLabel } from '../logic/goals';
import { colors } from '../theme';
import { buildDailySeries } from '../logic/analytics';
import { estimateAdaptiveExpenditure } from '../logic/expenditure';

export function PlansScreen({ state, date, review, onReview, onApplyAdaptive, onEditProfile, onCreate, onApply, onDelete }: {
  state: AppState;
  date: string;
  review: GoalReviewResponse | null;
  onReview: () => void;
  onApplyAdaptive: (value: number) => void;
  onEditProfile: () => void;
  onCreate: (name: string, description?: string) => void;
  onApply: (plan: MealPlan) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const dayEntries = state.entries.filter((entry) => entry.date === date);
  const profile = state.profile;
  const goal = goalForDate(state.goals, profile, date);
  const baselineTdee = profile ? estimateTdee(mifflinStJeor(profile), profile.activityFactor) : 0;
  const tdee = profile?.adaptiveTdee || baselineTdee;
  const expenditureSeries = buildDailySeries({ endDate: date, days: 28, entries: state.entries, foods: state.foods, activities: state.activities, goals: state.goals, profile: state.profile });
  const adaptive = estimateAdaptiveExpenditure(expenditureSeries, state.weights, baselineTdee || 1);
  const weekly = profile?.weeklyWeightChangeKg || 0;
  const program = review?.review || state.nutritionProgram;

  function create() {
    if (!name.trim()) return Alert.alert('Name your template', 'Use a short name such as Training Day or Easy Cut Day.');
    if (!dayEntries.length) return Alert.alert('Nothing to save', 'Log food for the selected day first, then save it as a template.');
    onCreate(name.trim(), description.trim() || undefined);
    setName(''); setDescription('');
  }

  return <Page>
    <ScreenHeader eyebrow="Your direction" title="Goal plan" subtitle="A transparent body goal first, reusable food templates second. AI can explain the plan but cannot bypass the safety limits." />
    <Card dark>
      <Text style={styles.heroKicker}>{goalLabel(profile).toUpperCase()}</Text>
      <Text style={styles.heroTitle}>{profile?.bodyWeightKg.toFixed(1)} kg → {profile?.targetWeightKg?.toFixed(1) || profile?.bodyWeightKg.toFixed(1)} kg</Text>
      <Text style={styles.heroDetail}>{profile?.targetDate ? `Target date ${profile.targetDate}` : 'No deadline'} · {profile?.goalIntensity || 'moderate'} pace · {weekly > 0 ? '+' : ''}{weekly.toFixed(2)} kg/week</Text>
      <View style={styles.heroActions}><Button label="Edit goal" compact tone="secondary" onPress={onEditProfile} /><Button label="Refresh personalized plan" compact onPress={onReview} /></View>
    </Card>

    <View style={styles.metrics}>
      <MetricTile value={`${goal?.calories || '—'}`} label="daily calories" accent="coral" />
      <MetricTile value={`${goal?.protein || '—'}g`} label="daily protein" accent="pine" />
      <MetricTile value={`${tdee || '—'}`} label="maintenance estimate" accent="gold" />
      <MetricTile value={`${Math.abs((goal?.calories || tdee) - tdee)}`} label="daily adjustment" accent="sky" />
    </View>

    <Card>
      <SectionTitle title="Plan reasoning" detail="calculated locally" />
      <View style={styles.formula}><Text style={styles.formulaValue}>{tdee}</Text><Text style={styles.formulaLabel}>maintenance</Text><Text style={styles.formulaOperator}>{(goal?.calories || tdee) < tdee ? '−' : '+'}</Text><Text style={styles.formulaValue}>{Math.abs((goal?.calories || tdee) - tdee)}</Text><Text style={styles.formulaLabel}>adjustment</Text><Text style={styles.formulaOperator}>=</Text><Text style={styles.formulaValue}>{goal?.calories || '—'}</Text><Text style={styles.formulaLabel}>daily target</Text></View>
      <Text style={styles.reviewSummary}>{program?.summary || 'Your target uses Mifflin-St Jeor, your selected activity level, and a bounded weekly rate. Refresh the plan for a culturally relevant sample day.'}</Text>
      {program?.actions.map((action) => <Text key={action} style={styles.reviewItem}>• {action}</Text>)}
      {program?.cautions.map((caution) => <Text key={caution} style={styles.caution}>Check: {caution}</Text>)}
    </Card>

    {program?.meals?.length ? <Card>
      <SectionTitle title="Flexible example day" detail={program.aiGenerated ? 'Groq-personalized · targets locked locally' : 'local fallback'} />
      <Text style={styles.reviewSummary}>These are suggestions, not mandatory foods. The meal targets add back to your daily calorie and protein goals.</Text>
      {program.meals.map((meal) => <View key={`${meal.time}_${meal.label}`} style={styles.mealRow}><View style={styles.mealHeading}><Text style={styles.mealName}>{meal.time} · {meal.label}</Text><Text style={styles.mealTarget}>{meal.targetCalories} kcal · {meal.targetProtein}g protein</Text></View>{meal.foods.map((food) => <Text key={food} style={styles.item}>• {food}</Text>)}</View>)}
      <Text style={styles.sourceHeading}>GUIDANCE SOURCES</Text>
      {program.sources.map((source) => <Text key={source.url} style={styles.source}>• {source.title}</Text>)}
    </Card> : null}

    <Card>
      <SectionTitle title="Trend-based expenditure" detail={adaptive.status === 'updating' ? `${(adaptive.confidence * 100).toFixed(0)}% confidence` : 'collecting data'} />
      <Text style={styles.reviewSummary}>{adaptive.status === 'updating' ? `Your last ${adaptive.weightSpanDays} days of weight direction and ${adaptive.loggedDays} logged days suggest about ${adaptive.estimate} kcal/day expenditure. This is more useful for future target updates than adding individual exercise calories.` : `Log food on at least 7 days and weigh in across at least 7 days. Until then, the ${baselineTdee} kcal profile estimate remains active.`}</Text>
      {adaptive.status === 'updating' && adaptive.estimate !== profile?.adaptiveTdee ? <Button label={`Use ${adaptive.estimate} kcal expenditure`} tone="secondary" onPress={() => onApplyAdaptive(adaptive.estimate)} /> : null}
      {profile?.adaptiveTdee ? <Text style={styles.caution}>Current adaptive expenditure: {profile.adaptiveTdee} kcal, last accepted {profile.adaptiveTdeeUpdatedAt?.slice(0, 10) || 'previously'}.</Text> : null}
    </Card>

    <SectionTitle title="Repeat a logged day" detail="optional shortcut" />
    <Card>
      <Text style={styles.templateIntro}>If you often eat a similar full day, save its foods and times once, then add that day again later. This is separate from reusable recipes in the Food tab. {dayEntries.length} foods are currently available.</Text>
      <Field label="Template name" value={name} onChangeText={setName} placeholder="Training day, office day..." />
      <Field label="Notes" value={description} onChangeText={setDescription} placeholder="When this menu works best" multiline />
      <Button label="Save selected day as template" onPress={create} disabled={!dayEntries.length} />
    </Card>

    {state.plans.length ? state.plans.map((plan) => {
      const entries = plan.items.map((item) => ({ ...item, id: item.id, date, enteredAt: plan.updatedAt, source: { source: 'manual' as const } }));
      const totals = sumNutrition(entries, state.foods);
      return <Card key={plan.id}>
        <Text style={styles.planName}>{plan.name}</Text>
        {plan.description ? <Text style={styles.planDescription}>{plan.description}</Text> : null}
        <View style={styles.planMetrics}><View><Text style={styles.metricValue}>{totals.calories.toFixed(0)}</Text><Text style={styles.metricLabel}>kcal</Text></View><View><Text style={styles.metricValue}>{totals.protein.toFixed(0)}g</Text><Text style={styles.metricLabel}>protein</Text></View><View><Text style={styles.metricValue}>{plan.items.length}</Text><Text style={styles.metricLabel}>foods</Text></View></View>
        <View style={styles.items}>{plan.items.slice(0, 5).map((item) => <Text key={item.id} style={styles.item}>• {item.eatenAt || '—'} · {state.foods.find((food) => food.id === item.foodId)?.name || 'Missing food'}</Text>)}</View>
        <View style={styles.actions}><View style={styles.action}><Button label="Use on selected day" onPress={() => onApply(plan)} /></View><Button label="Delete" compact tone="danger" onPress={() => onDelete(plan.id)} /></View>
      </Card>;
    }) : <Card><EmptyState title="No food templates saved" detail="This is optional. Log a complete day you like, then save it above." /></Card>}
  </Page>;
}

const styles = StyleSheet.create({
  heroKicker: { color: '#A6D9C9', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  heroTitle: { color: colors.card, fontFamily: 'serif', fontSize: 28, fontWeight: '900', marginTop: 6 },
  heroDetail: { color: '#BDD0C6', lineHeight: 19, marginTop: 7 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginBottom: 14 },
  reviewSummary: { color: colors.muted, lineHeight: 19, marginBottom: 10 },
  reviewItem: { color: colors.ink, lineHeight: 20, fontWeight: '700', marginVertical: 2 },
  caution: { color: colors.coral, fontSize: 11, lineHeight: 17, marginTop: 7 },
  formula: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 5, backgroundColor: colors.paper, borderRadius: 14, padding: 12, marginBottom: 12 },
  formulaValue: { color: colors.pine, fontSize: 19, fontWeight: '900' },
  formulaLabel: { color: colors.muted, fontSize: 9, marginRight: 4 },
  formulaOperator: { color: colors.coral, fontSize: 17, fontWeight: '900' },
  templateIntro: { color: colors.muted, lineHeight: 18, marginBottom: 13 },
  planName: { color: colors.ink, fontFamily: 'serif', fontSize: 24, fontWeight: '900' },
  planDescription: { color: colors.muted, marginTop: 4 },
  planMetrics: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.paper, borderRadius: 15, padding: 13, marginTop: 14 },
  metricValue: { color: colors.pine, fontWeight: '900', fontSize: 20 },
  metricLabel: { color: colors.muted, fontSize: 10 },
  items: { borderTopWidth: 1, borderColor: colors.line, marginTop: 13, paddingTop: 10, gap: 5 },
  item: { color: colors.muted, fontSize: 12 },
  mealRow: { borderTopWidth: 1, borderColor: colors.line, paddingVertical: 11 },
  mealHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  mealName: { color: colors.ink, fontWeight: '900', flex: 1 },
  mealTarget: { color: colors.pine, fontSize: 10, fontWeight: '800' },
  sourceHeading: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginTop: 12 },
  source: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14 },
  action: { flex: 1 }
});
