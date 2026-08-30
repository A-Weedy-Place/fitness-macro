import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ActivityEntry } from '../types';

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
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E8DFC9' },
  copy: { flex: 1 },
  name: { color: '#17211F', fontWeight: '700' },
  meta: { color: '#6D746F', marginTop: 3 },
  energy: { color: '#176B61', fontWeight: '800' },
  remove: { marginLeft: 9, backgroundColor: '#F5DED4', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 6 },
  delete: { color: '#A83F32', fontSize: 9, fontWeight: '900' }
});
