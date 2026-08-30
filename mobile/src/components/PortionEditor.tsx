import React from 'react';
import { Pressable, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { FoodItem } from '../types';
import { gramsForQuantity, unitOptions, unitUsesEstimate } from '../logic/portions';
import { Field } from './ui';
import { colors } from '../theme';

export function PortionEditor({ food, quantity, unit, onQuantityChange, onUnitChange, label = 'Quantity', style }: {
  food: FoodItem; quantity: string; unit: string; onQuantityChange: (value: string) => void; onUnitChange: (value: string) => void; label?: string; style?: StyleProp<ViewStyle>;
}) {
  const grams = gramsForQuantity(food, Number(quantity) || 0, unit);
  return <View style={style}>
    <Field label={`${label} (${unit})`} value={quantity} onChangeText={onQuantityChange} keyboardType="decimal-pad" />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.units} keyboardShouldPersistTaps="handled">
      {unitOptions(food).map((candidate) => <Pressable key={candidate} onPress={() => onUnitChange(candidate)} style={[styles.unit, candidate === unit && styles.unitSelected]}><Text style={[styles.unitText, candidate === unit && styles.unitTextSelected]}>{candidate}</Text></Pressable>)}
    </ScrollView>
    <Text style={styles.helper}>{grams.toFixed(grams < 10 ? 1 : 0)} g equivalent{unitUsesEstimate(food, unit) ? ' · approximate conversion' : ''}</Text>
  </View>;
}

const styles = StyleSheet.create({
  units: { gap: 5, paddingBottom: 5 },
  unit: { minWidth: 39, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center' },
  unitSelected: { backgroundColor: colors.pine, borderColor: colors.pine },
  unitText: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  unitTextSelected: { color: colors.white },
  helper: { color: colors.faint, fontSize: 9, marginTop: 1, marginBottom: 8 }
});

