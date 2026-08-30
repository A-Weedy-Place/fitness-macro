import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function iso(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function CalendarPicker({ label, value, onChange, minDate }: { label: string; value: string; onChange: (date: string) => void; minDate?: string }) {
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date();
  const [visible, setVisible] = useState(false);
  const [month, setMonth] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1));
  const cells = useMemo(() => {
    const leading = month.getDay();
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array.from({ length: leading }, () => 0), ...Array.from({ length: count }, (_, index) => index + 1)];
  }, [month]);
  function shift(offset: number) { setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1)); }
  return <>
    <Text style={styles.label}>{label}</Text>
    <Pressable style={styles.field} onPress={() => setVisible(true)}><Text style={styles.value}>{value}</Text><Text style={styles.icon}>CAL</Text></Pressable>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <Pressable style={styles.backdrop} onPress={() => setVisible(false)}><Pressable style={styles.calendar} onPress={() => undefined}>
        <View style={styles.header}><Pressable onPress={() => shift(-1)}><Text style={styles.arrow}>‹</Text></Pressable><Text style={styles.month}>{months[month.getMonth()]} {month.getFullYear()}</Text><Pressable onPress={() => shift(1)}><Text style={styles.arrow}>›</Text></Pressable></View>
        <View style={styles.grid}>{weekdays.map((day, index) => <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>)}{cells.map((day, index) => {
          if (!day) return <View key={`blank-${index}`} style={styles.day} />;
          const date = iso(month.getFullYear(), month.getMonth(), day);
          const disabled = Boolean(minDate && date < minDate);
          return <Pressable key={date} disabled={disabled} style={[styles.day, date === value && styles.selected]} onPress={() => { onChange(date); setVisible(false); }}><Text style={[styles.dayText, date === value && styles.selectedText, disabled && styles.disabled]}>{day}</Text></Pressable>;
        })}</View>
      </Pressable></Pressable>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  label: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 6 },
  field: { minHeight: 47, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: 13, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  value: { color: colors.ink, fontWeight: '800' }, icon: { color: colors.coral, fontSize: 9, fontWeight: '900' },
  backdrop: { flex: 1, backgroundColor: 'rgba(13,24,21,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  calendar: { width: '100%', maxWidth: 380, backgroundColor: colors.card, borderRadius: 24, padding: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, month: { color: colors.ink, fontFamily: 'serif', fontSize: 21, fontWeight: '900' }, arrow: { color: colors.coral, fontSize: 32, paddingHorizontal: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' }, weekday: { width: '14.285%', textAlign: 'center', color: colors.faint, fontSize: 10, fontWeight: '900', paddingVertical: 8 },
  day: { width: '14.285%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999 }, dayText: { color: colors.ink, fontWeight: '700' }, selected: { backgroundColor: colors.pine }, selectedText: { color: colors.white }, disabled: { color: colors.line }
});
