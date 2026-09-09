import { themedStyles } from '../theme';
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { BodyMetricLog } from '../types';
import { kgToLb } from '../logic/units';
import { colors } from '../theme';

export function WeightRow({ item, unit = 'kg', onDelete }: { item: BodyMetricLog; unit?: 'kg' | 'lb'; onDelete?: () => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}><Text style={styles.main}>{item.date}</Text><Text style={styles.value}>{(unit === 'lb' ? kgToLb(item.weightKg) : item.weightKg).toFixed(1)} {unit}</Text></View>
      {onDelete ? <Pressable onPress={onDelete} hitSlop={10} style={styles.remove}><Text style={styles.delete}>Remove</Text></Pressable> : null}
    </View>
  );
}

const styles = themedStyles(() => ({
  row: {
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  main: {
    fontWeight: '600',
    color: colors.ink
  },
  value: {
    color: colors.pine,
    fontWeight: '800'
  },
  copy: { flex: 1 },
  remove: { backgroundColor: colors.coralSoft, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 6 },
  delete: { color: colors.danger, fontSize: 9, fontWeight: '900' }
}));
