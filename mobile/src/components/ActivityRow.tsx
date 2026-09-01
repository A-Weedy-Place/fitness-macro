import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ActivityEntry } from '../types';
import { colors } from '../theme';

export function ActivityRow({ item, onDelete }: { item: ActivityEntry; onDelete?: () => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.meta}>{item.durationMinutes} min · {item.source === 'strava' ? 'Strava' : 'automatic MET estimate'}</Text>
      </View>
      <Text style={styles.energy}>{item.caloriesEstimated.toFixed(0)} kcal</Text>
      {onDelete ? <Pressable onPress={onDelete} hitSlop={10} style={styles.remove}><Text style={styles.delete}>Remove</Text></Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  copy: { flex: 1 },
  name: { color: colors.ink, fontWeight: '700' },
  meta: { color: colors.muted, marginTop: 3 },
  energy: { color: colors.pine, fontWeight: '800' },
  remove: { marginLeft: 9, backgroundColor: colors.coralSoft, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 6 },
  delete: { color: colors.danger, fontSize: 9, fontWeight: '900' }
});
