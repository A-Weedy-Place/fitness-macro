import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppState } from '../types';
import { BarChart, ConsistencyGrid, DonutChart, LineChart } from '../components/charts';
import { Card, Chip, ChipRow, MetricTile, Page, ScreenHeader, SectionTitle } from '../components/ui';
import { buildDailySeries, buildWeightSeries, calculateInsights, macroCalorieSplit, mealCalorieBreakdown } from '../logic/analytics';
import { colors } from '../theme';

type Range = '7d' | '30d' | '1y' | 'all';

function dateDistance(from: string, to: string) {
  return Math.max(1, Math.floor((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000) + 1);
}

export function TrendsScreen({ state, endDate }: { state: AppState; endDate: string }) {
  const [range, setRange] = useState<Range>('30d');
  const earliest = [...state.entries.map((item) => item.date), ...state.weights.map((item) => item.date), ...state.activities.map((item) => item.date)].sort()[0];
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '1y' ? 365 : earliest ? dateDistance(earliest, endDate) : 30;
  const series = useMemo(() => buildDailySeries({ endDate, days, entries: state.entries, foods: state.foods, activities: state.activities, goals: state.goals, profile: state.profile }), [state, endDate, days]);
  const insights = useMemo(() => calculateInsights(series, state.weights, endDate), [series, state.weights, endDate]);
  const weights = useMemo(() => buildWeightSeries(state.weights, endDate, days), [state.weights, endDate, days]);
  const macros = useMemo(() => macroCalorieSplit(series.filter((point) => point.logged)), [series]);
  const breakdown = useMemo(() => mealCalorieBreakdown(state.entries.filter((entry) => entry.date >= series[0]?.date && entry.date <= endDate), state.foods), [state.entries, state.foods, series, endDate]);
  const targetWeight = state.profile?.targetWeightKg;
  const averageBurned = series.length ? series.reduce((sum, point) => sum + point.activityCalories, 0) / series.length : 0;

  return <Page>
    <ScreenHeader eyebrow="Your progress" title="Trends" subtitle="A simple view of the records you have logged." />
    <ChipRow>{([['7d', '1 week'], ['30d', '1 month'], ['1y', '1 year'], ['all', 'All time']] as const).map(([value, label]) => <Chip key={value} label={label} selected={range === value} onPress={() => setRange(value)} />)}</ChipRow>
    <View style={styles.metrics}>
      <MetricTile value={`${insights.streak}`} label="current logging streak" accent="coral" />
      <MetricTile value={`${insights.calorieAdherencePercent.toFixed(0)}%`} label="logged days near calories" accent="pine" />
      <MetricTile value={`${insights.proteinHitPercent.toFixed(0)}%`} label="logged days near protein" accent="gold" />
      <MetricTile value={`${averageBurned.toFixed(0)}`} label="average daily activity kcal" accent="sky" />
    </View>

    <Card>
      <SectionTitle title="Calorie intake" detail={`${insights.averageCalories.toFixed(0)} kcal logged-day average`} />
      <BarChart points={series.map((point) => ({ label: point.label, value: point.calories, target: point.goalCalories }))} />
      <View style={styles.legend}><View style={[styles.dot, { backgroundColor: colors.pine }]} /><Text style={styles.legendText}>eaten</Text><View style={[styles.dot, { backgroundColor: colors.gold }]} /><Text style={styles.legendText}>target</Text></View>
    </Card>

    <Card>
      <SectionTitle title="Weight check-ins" detail={insights.weightChangeKg === null ? 'More weigh-ins needed' : `${insights.weightChangeKg > 0 ? '+' : ''}${insights.weightChangeKg.toFixed(1)} kg in range`} />
      <LineChart points={weights} target={targetWeight} />
      <Text style={styles.chartNote}>Only days with a weigh-in create scale points. The dashed line is your recent trend; the marker is your target.</Text>
    </Card>

    <Card><SectionTitle title="Macro energy split" detail={`${insights.averageProtein.toFixed(0)}g average protein`} /><DonutChart segments={macros} centerLabel={`${insights.averageCalories.toFixed(0)}`} /></Card>
    <Card><SectionTitle title="Logging consistency" detail={`${insights.loggedDays}/${days} days logged`} /><ConsistencyGrid points={series} /><Text style={styles.chartNote}>Darker days were within 10% of target. Lighter days contain at least one food entry.</Text></Card>
    <Card>
      <SectionTitle title="When calories are eaten" detail="categories inferred from logging time" />
      {breakdown.length ? breakdown.map((item) => { const total = breakdown.reduce((sum, candidate) => sum + candidate.value, 0); const percent = total ? item.value / total * 100 : 0; return <View key={item.label} style={styles.mealRow}><Text style={styles.mealLabel}>{item.label}</Text><View style={styles.mealTrack}><View style={[styles.mealFill, { width: `${percent}%` }]} /></View><Text style={styles.mealValue}>{percent.toFixed(0)}%</Text></View>; }) : <Text style={styles.chartNote}>Log food to see breakfast, lunch, dinner, and snack percentages.</Text>}
    </Card>
  </Page>;
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginBottom: 14 },
  legend: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 7 },
  legendText: { color: colors.muted, fontSize: 10 },
  chartNote: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 8 },
  mealRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 7 },
  mealLabel: { width: 68, color: colors.muted, fontSize: 11, textTransform: 'capitalize' },
  mealTrack: { flex: 1, height: 10, backgroundColor: colors.paperDeep, borderRadius: 5, overflow: 'hidden' },
  mealFill: { height: 10, backgroundColor: colors.coral, borderRadius: 5 },
  mealValue: { width: 48, textAlign: 'right', color: colors.ink, fontWeight: '800', fontSize: 11 }
});
