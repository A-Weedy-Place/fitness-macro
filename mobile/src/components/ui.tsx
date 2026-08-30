import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle
} from 'react-native';
import { colors, radii, shadows } from '../theme';

export type TabKey = 'today' | 'plans' | 'trends' | 'assistant' | 'library' | 'profile';

export function Page({ children }: { children: React.ReactNode }) {
  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>;
}

export function ScreenHeader({ title, subtitle, action }: { eyebrow: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.title} maxFontSizeMultiplier={1.12}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1} maxFontSizeMultiplier={1.15}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function Card({ children, style, dark = false }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; dark?: boolean }) {
  return <View style={[styles.card, dark && styles.cardDark, style]}>{children}</View>;
}

export function SectionTitle({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.12}>{title}</Text>
      {detail ? <Text style={styles.sectionDetail} maxFontSizeMultiplier={1.12}>{detail}</Text> : null}
    </View>
  );
}

export function Button({
  label,
  onPress,
  tone = 'primary',
  compact = false,
  disabled = false
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'ghost' | 'danger';
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles[`button_${tone}`], compact && styles.buttonCompact, (pressed || disabled) && styles.buttonPressed]}
    >
      <Text style={[styles.buttonLabel, styles[`buttonLabel_${tone}`]]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.15}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  return (
    <View style={style}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput placeholderTextColor={colors.faint} {...props} style={[styles.input, props.multiline && styles.inputMultiline]} />
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]} maxFontSizeMultiplier={1.12}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function MetricTile({ value, label, accent = 'pine' }: { value: string; label: string; accent?: 'pine' | 'coral' | 'gold' | 'sky' }) {
  return (
    <View style={[styles.metric, { borderTopColor: colors[accent] }]}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyMark} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDetail}>{detail}</Text>
    </View>
  );
}

export function DateSwitcher({ date, isToday, onPrevious, onNext, onToday }: { date: string; isToday: boolean; onPrevious: () => void; onNext: () => void; onToday: () => void }) {
  return (
    <View style={styles.dateSwitcher}>
      <Pressable onPress={onPrevious} style={styles.dateControl}><Text style={styles.dateArrow}>‹</Text></Pressable>
      <Pressable onPress={onToday} style={styles.dateCenter}>
        <Text style={styles.dateMain}>{isToday ? 'Today' : date}</Text>
        <Text style={styles.dateSub}>{isToday ? date : 'Tap to return to today'}</Text>
      </Pressable>
      <Pressable onPress={onNext} style={styles.dateControl}><Text style={styles.dateArrow}>›</Text></Pressable>
    </View>
  );
}

const tabs: Array<{ key: TabKey; label: string; mark: string }> = [
  { key: 'today', label: 'Today', mark: 'D' },
  { key: 'plans', label: 'Goals', mark: 'G' },
  { key: 'assistant', label: 'AI', mark: 'AI' },
  { key: 'trends', label: 'Trends', mark: 'T' },
  { key: 'library', label: 'Food', mark: 'F' },
  { key: 'profile', label: 'You', mark: 'Y' }
];

export function BottomTabs({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <View style={styles.tabs}>
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={styles.tab}>
            <View style={[styles.tabMark, tab.key === 'assistant' && styles.tabMarkAssistant, selected && styles.tabMarkSelected, selected && tab.key === 'assistant' && styles.tabMarkAssistantSelected]}><Text style={[styles.tabMarkText, selected && styles.tabMarkTextSelected]}>{tab.mark}</Text></View>
            <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 15, paddingTop: 10, paddingBottom: 108 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  headerCopy: { flex: 1, paddingRight: 12 },
  eyebrow: { color: colors.coral, fontWeight: '900', letterSpacing: 1.8, fontSize: 10, textTransform: 'uppercase' },
  title: { color: colors.ink, fontWeight: '900', fontSize: 24, lineHeight: 29, letterSpacing: -0.5, flexShrink: 1 },
  subtitle: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 2, maxWidth: 330, flexShrink: 1 },
  card: { backgroundColor: colors.card, borderRadius: 21, padding: 14, borderWidth: 1, borderColor: colors.line, marginBottom: 11, ...shadows.card },
  cardDark: { backgroundColor: colors.pine, borderColor: colors.pine },
  sectionTitleRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 5, marginBottom: 9, marginTop: 4 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', flexShrink: 1 },
  sectionDetail: { color: colors.muted, fontSize: 9, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  button: { minHeight: 42, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 1 },
  buttonCompact: { minHeight: 38, paddingVertical: 8, paddingHorizontal: 13 },
  button_primary: { backgroundColor: colors.coral },
  button_secondary: { backgroundColor: colors.pineSoft, borderWidth: 1, borderColor: '#B7CDC1' },
  button_ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  button_danger: { backgroundColor: colors.coralSoft },
  buttonPressed: { opacity: 0.55 },
  buttonLabel: { fontWeight: '900', fontSize: 11, textAlign: 'center', flexShrink: 1 },
  buttonLabel_primary: { color: colors.white },
  buttonLabel_secondary: { color: colors.pine },
  buttonLabel_ghost: { color: colors.ink },
  buttonLabel_danger: { color: colors.danger },
  fieldLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
  input: { color: colors.ink, backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: 14, minHeight: 43, paddingHorizontal: 11, paddingVertical: 9, fontSize: 12, marginBottom: 8 },
  inputMultiline: { minHeight: 82, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 11 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, maxWidth: '100%' },
  chipSelected: { backgroundColor: colors.pine, borderColor: colors.pine },
  chipLabel: { color: colors.muted, fontWeight: '800', fontSize: 10, textTransform: 'capitalize', flexShrink: 1 },
  chipLabelSelected: { color: colors.white },
  metric: { width: '48%', minHeight: 94, backgroundColor: colors.card, borderRadius: radii.medium, padding: 13, borderTopWidth: 4, borderWidth: 1, borderColor: colors.line },
  metricValue: { color: colors.ink, fontSize: 21, fontWeight: '900', flexShrink: 1 },
  metricLabel: { color: colors.muted, fontSize: 11, lineHeight: 15, marginTop: 5 },
  empty: { alignItems: 'center', paddingVertical: 25, paddingHorizontal: 20 },
  emptyMark: { width: 28, height: 5, borderRadius: 3, backgroundColor: colors.gold, marginBottom: 12 },
  emptyTitle: { color: colors.ink, fontFamily: 'serif', fontSize: 19, fontWeight: '900' },
  emptyDetail: { color: colors.muted, textAlign: 'center', lineHeight: 19, marginTop: 5 },
  dateSwitcher: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 5, marginBottom: 14 },
  dateControl: { width: 44, alignItems: 'center', justifyContent: 'center' },
  dateArrow: { color: colors.ink, fontSize: 30, lineHeight: 34 },
  dateCenter: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  dateMain: { color: colors.ink, fontWeight: '900', fontSize: 14 },
  dateSub: { color: colors.muted, fontSize: 9, marginTop: 2 },
  tabs: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.line, minHeight: 72, flexDirection: 'row', paddingHorizontal: 7, paddingTop: 7, paddingBottom: 9 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabMark: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.paperDeep, alignItems: 'center', justifyContent: 'center' },
  tabMarkSelected: { backgroundColor: colors.ink },
  tabMarkAssistant: { width: 34, height: 34, borderRadius: 17, marginTop: -7, backgroundColor: colors.pineSoft },
  tabMarkAssistantSelected: { backgroundColor: colors.coral },
  tabMarkText: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  tabMarkTextSelected: { color: colors.white },
  tabLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', marginTop: 3 },
  tabLabelSelected: { color: colors.ink }
});
