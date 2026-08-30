import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DailyGoal } from '../types';

function Macro({ label, value, target }: { label: string; value: number; target?: number }) {
  const ratio = target ? Math.min(value / target, 1) : 0;
  return (
    <View style={styles.macro}>
      <Text style={styles.macroValue}>{value.toFixed(0)}g</Text>
      <Text style={styles.macroLabel}>{label}{target ? ` / ${target}g` : ''}</Text>
      <View style={styles.track}><View style={[styles.fill, { width: `${ratio * 100}%` }]} /></View>
    </View>
  );
}

export function DailySummaryCard({
  calories,
  protein,
  carbs,
  fat,
  activityCalories,
  goal
}: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  activityCalories: number;
  goal?: DailyGoal;
}) {
  const remaining = goal ? goal.calories - calories : null;
  const net = calories - activityCalories;
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>DAILY ENERGY</Text>
      <View style={styles.energyRow}>
        <Text style={styles.calories}>{calories.toFixed(0)}</Text>
        <View>
          <Text style={styles.kcal}>kcal eaten</Text>
          <Text style={styles.remaining}>{remaining === null ? 'Set up your target' : `${Math.abs(remaining).toFixed(0)} ${remaining >= 0 ? 'remaining' : 'over'}`}</Text>
        </View>
      </View>
      <View style={styles.macros}>
        <Macro label="Protein" value={protein} target={goal?.protein} />
        <Macro label="Carbs" value={carbs} target={goal?.carbs} />
        <Macro label="Fat" value={fat} target={goal?.fat} />
      </View>
      <View style={styles.energyLedger}><View><Text style={styles.ledgerValue}>{calories.toFixed(0)}</Text><Text style={styles.ledgerLabel}>eaten</Text></View><Text style={styles.operator}>−</Text><View><Text style={styles.ledgerValue}>{activityCalories.toFixed(0)}</Text><Text style={styles.ledgerLabel}>activity</Text></View><Text style={styles.operator}>=</Text><View><Text style={styles.ledgerValue}>{net.toFixed(0)}</Text><Text style={styles.ledgerLabel}>net energy</Text></View></View>
      <Text style={styles.activity}>Activity stays visible and is never silently added back to your food target.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#173F3B', borderRadius: 24, padding: 20, marginVertical: 16 },
  eyebrow: { color: '#A6D9C9', fontSize: 11, letterSpacing: 1.8, fontWeight: '800' },
  energyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 8 },
  calories: { color: '#FFF8E9', fontSize: 52, lineHeight: 58, fontWeight: '900' },
  kcal: { color: '#FFF8E9', fontWeight: '700', marginBottom: 4 },
  remaining: { color: '#A6D9C9', marginBottom: 8 },
  macros: { flexDirection: 'row', gap: 12, marginTop: 18 },
  macro: { flex: 1 },
  macroValue: { color: '#FFF8E9', fontWeight: '800' },
  macroLabel: { color: '#A6D9C9', fontSize: 10, marginTop: 2 },
  track: { height: 4, backgroundColor: '#315A55', borderRadius: 4, marginTop: 7, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: '#F29B72', borderRadius: 4 },
  activity: { color: '#A6D9C9', fontSize: 11, marginTop: 16 }
  ,energyLedger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#315A55', paddingTop: 14, marginTop: 16 },
  ledgerValue: { color: '#FFF8E9', fontWeight: '900', fontSize: 16, textAlign: 'center' },
  ledgerLabel: { color: '#A6D9C9', fontSize: 9, textAlign: 'center', marginTop: 2 },
  operator: { color: '#6F9287', fontSize: 18, fontWeight: '900' }
});
