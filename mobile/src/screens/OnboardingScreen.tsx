import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { ProfileInput } from '../types';
import { Button, Card, Chip, ChipRow, Field, MetricTile, Page, ScreenHeader, SectionTitle } from '../components/ui';
import { CalendarPicker } from '../components/CalendarPicker';
import { recommendDailyGoal, estimateTdee, mifflinStJeor } from '../logic/tdee';
import { weeklyChangeForGoal } from '../logic/goals';
import { cmToFeetInches, feetInchesToCm, kgToLb, lbToKg } from '../logic/units';
import { shiftDate } from '../utils/dates';
import { colors } from '../theme';

export function OnboardingScreen({ date, onComplete }: { date: string; onComplete: (profile: ProfileInput, includeDemo: boolean) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(''); const [sex, setSex] = useState<ProfileInput['sex']>('male'); const [age, setAge] = useState('30');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm'); const [height, setHeight] = useState('175'); const [feet, setFeet] = useState('5'); const [inches, setInches] = useState('9');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg'); const [weight, setWeight] = useState('75'); const [target, setTarget] = useState('70');
  const [activity, setActivity] = useState(1.4); const [mode, setMode] = useState<'lose' | 'maintain' | 'gain'>('lose'); const [intensity, setIntensity] = useState<'gentle' | 'moderate' | 'aggressive'>('moderate');
  const [targetDate, setTargetDate] = useState(shiftDate(date, 84));
  const [dietStyle, setDietStyle] = useState<NonNullable<ProfileInput['dietStyle']>>('omnivore'); const [cuisine, setCuisine] = useState<NonNullable<ProfileInput['preferredCuisine']>>('pakistani'); const [mealsPerDay, setMealsPerDay] = useState(3); const [excludedFoods, setExcludedFoods] = useState('');

  const preview = useMemo(() => {
    const heightCm = heightUnit === 'cm' ? Number(height) : feetInchesToCm(Number(feet), Number(inches));
    const bodyWeightKg = weightUnit === 'kg' ? Number(weight) : lbToKg(Number(weight));
    const targetWeightKg = mode === 'maintain' ? bodyWeightKg : weightUnit === 'kg' ? Number(target) : lbToKg(Number(target));
    const base = { displayName: name.trim() || undefined, sex, ageYears: Number(age), heightCm, bodyWeightKg, targetWeightKg, activityFactor: activity, goalMode: mode, goalIntensity: intensity, targetDate, onboardingComplete: true, preferredHeightUnit: heightUnit, preferredWeightUnit: weightUnit, timeZone: 'device', dietStyle, preferredCuisine: cuisine, mealsPerDay, excludedFoods: excludedFoods.trim() || undefined };
    const input: ProfileInput = { ...base, weeklyWeightChangeKg: weeklyChangeForGoal(base) };
    if (![input.ageYears, input.heightCm, input.bodyWeightKg, input.targetWeightKg].every(Number.isFinite)) return null;
    const profile = { ...input, id: 'preview', createdAt: '', updatedAt: '' }; const bmr = mifflinStJeor(profile);
    return { input, bmr, tdee: estimateTdee(bmr, activity), goal: recommendDailyGoal(profile, date) };
  }, [name, sex, age, heightUnit, height, feet, inches, weightUnit, weight, target, activity, mode, intensity, targetDate, dietStyle, cuisine, mealsPerDay, excludedFoods, date]);

  function switchHeight(next: 'cm' | 'ft') {
    if (next === heightUnit) return;
    if (next === 'ft') { const converted = cmToFeetInches(Number(height)); setFeet(String(converted.feet)); setInches(String(converted.inches)); }
    else setHeight(String(Math.round(feetInchesToCm(Number(feet), Number(inches)))));
    setHeightUnit(next);
  }
  function switchWeight(next: 'kg' | 'lb') {
    if (next === weightUnit) return;
    if (next === 'lb') { setWeight(String(kgToLb(Number(weight)).toFixed(1))); setTarget(String(kgToLb(Number(target)).toFixed(1))); }
    else { setWeight(String(lbToKg(Number(weight)).toFixed(1))); setTarget(String(lbToKg(Number(target)).toFixed(1))); }
    setWeightUnit(next);
  }
  function valid() { return Boolean(preview && preview.input.ageYears >= 13 && preview.input.ageYears <= 120 && preview.input.heightCm >= 80 && preview.input.heightCm <= 260 && preview.input.bodyWeightKg >= 25 && preview.input.bodyWeightKg <= 500 && preview.input.targetWeightKg && preview.input.targetWeightKg >= 25); }
  function finish(includeDemo: boolean) { if (!preview || !valid()) return Alert.alert('Check your details', 'Use realistic body measurements and a future target date.'); onComplete(preview.input, includeDemo); }

  return <Page>
    <View style={styles.progress}>{[0, 1, 2, 3].map((value) => <View key={value} style={[styles.progressBar, value <= step && styles.progressActive]} />)}</View>
    {step === 0 ? <><ScreenHeader eyebrow="Your private account" title="Let’s build your baseline" subtitle="This profile stays local first and can be exported whenever you want." /><Card dark><Text style={styles.hero}>No generic diet template.</Text><Text style={styles.heroCopy}>Your measurements, objective, deadline, and preferred pace create the starting calculation.</Text></Card><Card><Field label="Name" value={name} onChangeText={setName} placeholder="What should the app call you?" /><Text style={styles.label}>SEX USED BY BMR EQUATION</Text><ChipRow>{(['male', 'female', 'other'] as const).map((value) => <Chip key={value} label={value} selected={sex === value} onPress={() => setSex(value)} />)}</ChipRow><Field label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" /><Button label="Continue" onPress={() => setStep(1)} /></Card></> : null}
    {step === 1 ? <><ScreenHeader eyebrow="Step 2 of 4" title="Your body and routine" subtitle="Choose the units you naturally use. Storage and calculations remain standardized internally." /><Card>
      <Text style={styles.label}>HEIGHT UNIT</Text><ChipRow><Chip label="Centimeters" selected={heightUnit === 'cm'} onPress={() => switchHeight('cm')} /><Chip label="Feet & inches" selected={heightUnit === 'ft'} onPress={() => switchHeight('ft')} /></ChipRow>
      {heightUnit === 'cm' ? <Field label="Height (cm)" value={height} onChangeText={setHeight} keyboardType="decimal-pad" /> : <View style={styles.columns}><Field label="Feet" value={feet} onChangeText={setFeet} keyboardType="number-pad" style={styles.half} /><Field label="Inches" value={inches} onChangeText={setInches} keyboardType="decimal-pad" style={styles.half} /></View>}
      <Text style={styles.label}>WEIGHT UNIT</Text><ChipRow><Chip label="Kilograms" selected={weightUnit === 'kg'} onPress={() => switchWeight('kg')} /><Chip label="Pounds" selected={weightUnit === 'lb'} onPress={() => switchWeight('lb')} /></ChipRow><Field label={`Current weight (${weightUnit})`} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
      <Text style={styles.label}>TYPICAL ACTIVITY</Text><ChipRow>{[[1.2, 'Sedentary'], [1.4, 'Light'], [1.6, 'Active'], [1.8, 'Very active']].map(([value, label]) => <Chip key={String(value)} label={String(label)} selected={activity === value} onPress={() => setActivity(Number(value))} />)}</ChipRow><Text style={styles.help}>Activity is logged separately and does not automatically inflate your food allowance.</Text><View style={styles.actions}><Button label="Back" tone="ghost" onPress={() => setStep(0)} /><View style={styles.flex}><Button label="Continue" onPress={() => setStep(2)} /></View></View></Card></> : null}
    {step === 2 ? <><ScreenHeader eyebrow="Step 3 of 4" title="Your goals and food style" subtitle="The target is bounded locally. These preferences make the sample food plan useful to you." /><Card><Text style={styles.label}>PRIMARY GOAL</Text><ChipRow><Chip label="Lose weight" selected={mode === 'lose'} onPress={() => setMode('lose')} /><Chip label="Maintain weight" selected={mode === 'maintain'} onPress={() => setMode('maintain')} /><Chip label="Build weight / muscle" selected={mode === 'gain'} onPress={() => setMode('gain')} /></ChipRow>{mode !== 'maintain' ? <Field label={`Target weight (${weightUnit})`} value={target} onChangeText={setTarget} keyboardType="decimal-pad" /> : null}<CalendarPicker label="TARGET DATE" value={targetDate} minDate={date} onChange={setTargetDate} /><Text style={styles.label}>PACE</Text><ChipRow>{(['gentle', 'moderate', 'aggressive'] as const).map((value) => <Chip key={value} label={value} selected={intensity === value} onPress={() => setIntensity(value)} />)}</ChipRow><Text style={styles.label}>EATING STYLE</Text><ChipRow>{(['omnivore', 'vegetarian', 'vegan', 'pescatarian'] as const).map((value) => <Chip key={value} label={value} selected={dietStyle === value} onPress={() => setDietStyle(value)} />)}</ChipRow><Text style={styles.label}>FOOD FAMILIARITY</Text><ChipRow>{([['pakistani', 'Pakistani'], ['indian', 'Indian'], ['south_asian', 'South Asian'], ['southeast_asian', 'SE Asian'], ['mixed', 'Mixed']] as const).map(([value, label]) => <Chip key={value} label={label} selected={cuisine === value} onPress={() => setCuisine(value)} />)}</ChipRow><Text style={styles.label}>MEALS PER DAY</Text><ChipRow>{[2, 3, 4, 5].map((value) => <Chip key={value} label={String(value)} selected={mealsPerDay === value} onPress={() => setMealsPerDay(value)} />)}</ChipRow><Field label="Foods to avoid (optional)" value={excludedFoods} onChangeText={setExcludedFoods} placeholder="e.g. beef, peanuts, lactose" /><Text style={styles.help}>Allergy or medical needs need a qualified clinician; this is only a preference field. Aggressive remains bounded.</Text><View style={styles.actions}><Button label="Back" tone="ghost" onPress={() => setStep(1)} /><View style={styles.flex}><Button label="Review plan" onPress={() => setStep(3)} /></View></View></Card></> : null}
    {step === 3 && preview ? <><ScreenHeader eyebrow="Step 4 of 4" title="Your starting plan" subtitle="After you start, the private AI service creates a flexible meal structure without changing these locked targets." /><View style={styles.metrics}><MetricTile value={`${preview.goal.calories}`} label="daily calories" accent="coral" /><MetricTile value={`${preview.goal.protein}g`} label="daily protein" accent="pine" /><MetricTile value={`${preview.tdee}`} label="maintenance estimate" accent="gold" /><MetricTile value={`${preview.input.weeklyWeightChangeKg > 0 ? '+' : ''}${preview.input.weeklyWeightChangeKg}`} label="kg per week" accent="sky" /></View><Card><SectionTitle title="Ready to start" detail={targetDate} /><Text style={styles.help}>Demo mode fills graphs immediately with clearly marked history.</Text><Button label="Start with 60 days of demo data" onPress={() => finish(true)} /><View style={styles.gap} /><Button label="Start with an empty diary" tone="secondary" onPress={() => finish(false)} /><View style={styles.gap} /><Button label="Back" tone="ghost" onPress={() => setStep(2)} /></Card></> : null}
  </Page>;
}

const styles = StyleSheet.create({ progress: { flexDirection: 'row', gap: 6, marginBottom: 22 }, progressBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.line }, progressActive: { backgroundColor: colors.pine }, hero: { color: colors.ink, fontFamily: 'serif', fontWeight: '900', fontSize: 27 }, heroCopy: { color: colors.muted, lineHeight: 19, marginTop: 8 }, label: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 7 }, columns: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }, half: { width: '48.5%' }, help: { color: colors.muted, fontSize: 11, lineHeight: 17, marginBottom: 12 }, actions: { flexDirection: 'row', gap: 9 }, flex: { flex: 1 }, metrics: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginBottom: 14 }, gap: { height: 8 } });
