import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
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

export function PlansScreen({ state, date, review, onReview, onEditProfile, onCreate, onApply, onDelete }: {
  state: AppState;
  date: string;
  review: GoalReviewResponse | null;
  onReview: () => void;
  onEditProfile: () => void;
  onCreate: (name: string, description?: string) => void;
  onApply: (plan: MealPlan) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showMethod, setShowMethod] = useState(false);
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
    <ScreenHeader eyebrow="Your direction" title="Goal plan" subtitle="Your daily target adapts from your real food and weigh-ins." />
    <Card dark>
      <Text style={styles.heroKicker}>{goalLabel(profile).toUpperCase()}</Text>
      <Text style={styles.heroTitle}>{profile?.bodyWeightKg.toFixed(1)} kg → {profile?.targetWeightKg?.toFixed(1) || profile?.bodyWeightKg.toFixed(1)} kg</Text>
      <Text style={styles.heroDetail}>{profile?.targetDate ? `Target ${profile.targetDate}` : 'No deadline'} · {profile?.goalIntensity || 'moderate'} pace · {weekly > 0 ? '+' : ''}{weekly.toFixed(2)} kg/week</Text>
      <View style={styles.heroActions}><Button label="Edit goal" compact tone="secondary" onPress={onEditProfile} /><Button label="Refresh personalized plan" compact onPress={onReview} /></View>
    </Card>

    <View style={styles.metrics}>
      <MetricTile value={`${goal?.calories || '—'}`} label="daily calories" accent="coral" />
      <MetricTile value={`${goal?.protein || '—'}g`} label="daily protein" accent="pine" />
      <MetricTile value={`${tdee || '—'}`} label="maintenance estimate" accent="gold" />
      <MetricTile value={`${Math.abs((goal?.calories || tdee) - tdee)}`} label="daily adjustment" accent="sky" />
    </View>

    <Card>
      <SectionTitle title="Today’s target" detail="calculated locally" />
      <Text style={styles.reviewSummary}>{program?.summary || 'Your target uses your starting measurements, selected pace, and safe limits.'}</Text>
      <Pressable style={styles.explainToggle} onPress={() => setShowMethod(!showMethod)}><Text style={styles.explainToggleText}>{showMethod ? 'Hide calculation details' : 'How this plan is calculated'}</Text><Text style={styles.explainArrow}>{showMethod ? '⌃' : '⌄'}</Text></Pressable>
      {showMethod ? <><View style={styles.formula}><Text style={styles.formulaValue}>{tdee}</Text><Text style={styles.formulaLabel}>maintenance</Text><Text style={styles.formulaOperator}>{(goal?.calories || tdee) < tdee ? '−' : '+'}</Text><Text style={styles.formulaValue}>{Math.abs((goal?.calories || tdee) - tdee)}</Text><Text style={styles.formulaLabel}>adjustment</Text><Text style={styles.formulaOperator}>=</Text><Text style={styles.formulaValue}>{goal?.calories || '—'}</Text><Text style={styles.formulaLabel}>daily target</Text></View>{program?.actions.map((action) => <Text key={action} style={styles.reviewItem}>• {action}</Text>)}{program?.cautions.map((caution) => <Text key={caution} style={styles.caution}>Check: {caution}</Text>)}</> : null}
    </Card>

    {program?.meals?.length ? <Card>
      <SectionTitle title="Flexible example day" detail={program.aiGenerated ? 'Groq-personalized · targets locked locally' : 'local fallback'} />
      <Text style={styles.reviewSummary}>A flexible example, not a rule. Swap foods manually or use it as inspiration.</Text>
      {program.meals.map((meal) => <View key={`${meal.time}_${meal.label}`} style={styles.mealRow}><View style={styles.mealHeading}><Text style={styles.mealName}>{meal.time} · {meal.label}</Text><Text style={styles.mealTarget}>{meal.targetCalories} kcal · {meal.targetProtein}g protein</Text></View>{meal.foods.map((food) => <Text key={food} style={styles.item}>• {food}</Text>)}</View>)}
      <Text style={styles.sourceHeading}>GUIDANCE SOURCES</Text>
      {program.sources.map((source) => <Text key={source.url} style={styles.source}>• {source.title}</Text>)}
    </Card> : null}

    <Card>
      <SectionTitle title="Adaptive check-in" detail={adaptive.status === 'updating' ? `${(adaptive.confidence * 100).toFixed(0)}% confidence` : 'collecting data'} />
      <Text style={styles.reviewSummary}>{adaptive.status === 'updating' ? `Based on ${adaptive.loggedDays} logged days and ${adaptive.weightSpanDays} days of weigh-ins, your next weekly check will use about ${adaptive.estimate} kcal/day as maintenance.` : `Log food on 10 days and weigh in across 14 days. Until then, the ${baselineTdee} kcal starting estimate remains active.`}</Text>
      <Text style={styles.caution}>{profile?.adaptiveTdee ? `Active maintenance: ${profile.adaptiveTdee} kcal/day. The app adjusts at most 100 kcal/day in a weekly check.` : 'Nothing changes automatically from missing data.'}</Text>
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
  explainToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.paper, borderRadius: 12, padding: 11, marginBottom: 11 },
  explainToggleText: { color: colors.pine, fontSize: 10, fontWeight: '900' }, explainArrow: { color: colors.pine, fontSize: 17, fontWeight: '900' },
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
