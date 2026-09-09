import { themedStyles } from '../theme';
import React, { useEffect, useMemo, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { AppState, ProfileInput } from '../types';
import { Button, Card, Chip, ChipRow, Field, Page, ScreenHeader, SectionTitle } from '../components/ui';
import { CalendarPicker } from '../components/CalendarPicker';
import { buildDailySeries, latestWeightByDate } from '../logic/analytics';
import { weeklyChangeForGoal } from '../logic/goals';
import { cmToFeetInches, feetInchesToCm, kgToLb, lbToKg } from '../logic/units';
import { activeTheme as loadedTheme, AppThemeName, colors, themeOptions } from '../theme';
import { HealthConnectStatus } from '../services/healthConnect';
import { deviceTimeZone, isSupportedTimeZone } from '../utils/dates';
import { recommendDailyGoal } from '../logic/tdee';
import { AppUpdatePanel } from '../components/AppUpdatePanel';
import { recordTestTelemetry } from '../logic/testTelemetry';
import { telemetryQueueStatus } from '../logic/testTelemetry';
import { previewPortableBackup } from '../logic/backup';
import { pickPortableBackupFile, savePortableBackupFile } from '../services/portableMedia';

type Panel = 'profile' | 'goals' | 'statistics' | 'time' | 'appearance' | 'connections' | 'updates' | 'data' | 'security' | null;

export function ProfileScreen({ state, date, status, healthConnect, audioConfigured, appAgentEnabled, initialPanel, activeTheme = loadedTheme, onThemeChange, onSave, onSavePhoto, pinEnabled, onSetLocalPin, onLoadDemo, onExport, onExportDiagnostics, testingTelemetryEnabled, onClearTestTelemetry, onUndoRestore, onImport, onConnectHealth, onOpenHealthSettings, onRefreshIntegrations, onBeforeRestart }: {
  state: AppState; date: string; status: string; healthConnect: HealthConnectStatus | null; audioConfigured: boolean | null; appAgentEnabled: boolean | null;
  initialPanel?: Panel; activeTheme?: AppThemeName; onThemeChange: (theme: AppThemeName) => void; onSave: (profile: ProfileInput) => void; onSavePhoto: (uri?: string) => Promise<void>;
  pinEnabled: boolean; onSetLocalPin: (pin: string | null) => Promise<void>; onLoadDemo: () => void; onExport: () => Promise<string>; onUndoRestore: () => Promise<void>; onExportDiagnostics: () => Promise<string>; testingTelemetryEnabled: boolean; onClearTestTelemetry: () => Promise<void>; onImport: (text: string) => void;
  onConnectHealth: () => void; onOpenHealthSettings: () => void; onRefreshIntegrations: () => void; onBeforeRestart?: () => Promise<void>;
}) {
  const profile = state.profile;
  const initialHeight = profile?.heightCm || 175;
  const initialImperialHeight = cmToFeetInches(initialHeight);
  const [panel, setPanel] = useState<Panel>(initialPanel || null);
  const [name, setName] = useState(profile?.displayName || '');
  const [sex, setSex] = useState<ProfileInput['sex']>(profile?.sex || 'male');
  const [age, setAge] = useState(String(profile?.ageYears || 30));
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>(profile?.preferredHeightUnit || 'cm');
  const [height, setHeight] = useState(String(initialHeight));
  const [feet, setFeet] = useState(String(initialImperialHeight.feet));
  const [inches, setInches] = useState(String(initialImperialHeight.inches));
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>(profile?.preferredWeightUnit || 'kg');
  const [weight, setWeight] = useState(String(profile?.preferredWeightUnit === 'lb' ? kgToLb(profile.bodyWeightKg).toFixed(1) : profile?.bodyWeightKg || 75));
  const [target, setTarget] = useState(String(profile?.preferredWeightUnit === 'lb' && profile.targetWeightKg ? kgToLb(profile.targetWeightKg).toFixed(1) : profile?.targetWeightKg || 70));
  const [factor, setFactor] = useState(String(profile?.activityFactor || 1.4));
  const [mode, setMode] = useState<'lose' | 'maintain' | 'gain'>(profile?.goalMode === 'lose' || profile?.goalMode === 'gain' ? profile.goalMode : 'maintain');
  const [intensity, setIntensity] = useState<'gentle' | 'moderate' | 'aggressive'>(profile?.goalIntensity || 'moderate');
  const [targetDate, setTargetDate] = useState(profile?.targetDate || date);
  const [timeZone, setTimeZone] = useState(profile?.timeZone || 'device');
  const [backupText, setBackupText] = useState('');
  const [readingBackup, setReadingBackup] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [showGoalMethod, setShowGoalMethod] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  useEffect(() => {
    if (!profile) return;
    const imperial = cmToFeetInches(profile.heightCm);
    const preferredHeight = profile.preferredHeightUnit || 'cm';
    const preferredWeight = profile.preferredWeightUnit || 'kg';
    setName(profile.displayName || ''); setSex(profile.sex); setAge(String(profile.ageYears)); setHeightUnit(preferredHeight); setHeight(String(profile.heightCm)); setFeet(String(imperial.feet)); setInches(String(imperial.inches)); setWeightUnit(preferredWeight); setWeight(String(preferredWeight === 'lb' ? kgToLb(profile.bodyWeightKg).toFixed(1) : profile.bodyWeightKg)); setTarget(String(preferredWeight === 'lb' && profile.targetWeightKg ? kgToLb(profile.targetWeightKg).toFixed(1) : profile.targetWeightKg || '')); setFactor(String(profile.activityFactor)); setMode(profile.goalMode === 'lose' || profile.goalMode === 'gain' ? profile.goalMode : 'maintain'); setIntensity(profile.goalIntensity || 'moderate'); setTargetDate(profile.targetDate || date); setTimeZone(profile.timeZone || 'device');
  }, [profile?.updatedAt, date]);

  useEffect(() => {
    if (initialPanel) setPanel(initialPanel);
  }, [initialPanel]);

  useEffect(() => {
    recordTestTelemetry('profile_panel_viewed', { panel: panel || 'account_home' });
  }, [panel]);

  const year = useMemo(() => {
    const series = buildDailySeries({ endDate: date, days: 365, entries: state.entries, foods: state.foods, activities: state.activities, goals: state.goals, goalHistory: state.goalHistory, profile });
    const logged = series.filter((day) => day.logged);
    const startDate = series[0]?.date || date;
    const weights = latestWeightByDate(state.weights).filter((item) => item.date >= startDate && item.date <= date);
    const firstWeight = weights[0]?.weightKg;
    const currentWeight = weights[weights.length - 1]?.weightKg ?? profile?.bodyWeightKg;
    const targetWeight = profile?.targetWeightKg;
    const startingDistance = firstWeight != null && targetWeight != null ? Math.abs(firstWeight - targetWeight) : 0;
    const remainingDistance = currentWeight != null && targetWeight != null ? Math.abs(currentWeight - targetWeight) : 0;
    const goalProgress = profile?.goalMode === 'maintain' ? null : startingDistance > 0 ? Math.max(0, Math.min(100, ((startingDistance - remainingDistance) / startingDistance) * 100)) : null;
    return { loggedDays: logged.length, currentWeight, goalProgress, weightChange: firstWeight != null && currentWeight != null && weights.length > 1 ? currentWeight - firstWeight : null };
  }, [date, state.entries, state.foods, state.activities, state.goals, state.weights, profile]);

  const input = useMemo<ProfileInput | null>(() => {
    const heightCm = heightUnit === 'cm' ? Number(height) : feetInchesToCm(Number(feet), Number(inches));
    const bodyWeightKg = weightUnit === 'kg' ? Number(weight) : lbToKg(Number(weight));
    const targetWeightKg = mode === 'maintain' ? bodyWeightKg : weightUnit === 'kg' ? Number(target) : lbToKg(Number(target));
    const base = { displayName: name.trim() || undefined, profilePhotoUri: profile?.profilePhotoUri, sex, ageYears: Number(age), heightCm, bodyWeightKg, targetWeightKg, activityFactor: Number(factor), goalMode: mode, goalIntensity: intensity, targetDate, onboardingComplete: true, preferredHeightUnit: heightUnit, preferredWeightUnit: weightUnit, timeZone, adaptiveTdee: profile?.adaptiveTdee, adaptiveTdeeUpdatedAt: profile?.adaptiveTdeeUpdatedAt, dietStyle: profile?.dietStyle, preferredCuisine: profile?.preferredCuisine, mealsPerDay: profile?.mealsPerDay, excludedFoods: profile?.excludedFoods };
    if (![base.ageYears, base.heightCm, base.bodyWeightKg, base.targetWeightKg, base.activityFactor].every(Number.isFinite)) return null;
    return { ...base, weeklyWeightChangeKg: weeklyChangeForGoal(base) };
  }, [name, sex, age, heightUnit, height, feet, inches, weightUnit, weight, target, factor, mode, intensity, targetDate, timeZone, profile?.profilePhotoUri, profile?.adaptiveTdee, profile?.adaptiveTdeeUpdatedAt, profile?.dietStyle, profile?.preferredCuisine, profile?.mealsPerDay, profile?.excludedFoods]);

  function switchHeight(next: 'cm' | 'ft') {
    if (next === heightUnit) return;
    if (next === 'ft') { const value = cmToFeetInches(Number(height)); setFeet(String(value.feet)); setInches(String(value.inches)); } else setHeight(String(Math.round(feetInchesToCm(Number(feet), Number(inches)))));
    setHeightUnit(next);
  }

  function switchWeight(next: 'kg' | 'lb') {
    if (next === weightUnit) return;
    if (next === 'lb') { setWeight(String(kgToLb(Number(weight)).toFixed(1))); setTarget(String(kgToLb(Number(target)).toFixed(1))); } else { setWeight(String(lbToKg(Number(weight)).toFixed(1))); setTarget(String(lbToKg(Number(target)).toFixed(1))); }
    setWeightUnit(next);
  }

  function save() {
    if (!input || input.ageYears < 13 || input.ageYears > 120 || input.heightCm < 80 || input.heightCm > 260 || input.bodyWeightKg < 25 || input.bodyWeightKg > 500 || input.activityFactor < 1.1 || input.activityFactor > 2.5) return Alert.alert('Check your profile', 'One or more values are invalid.');
    if (!isSupportedTimeZone(timeZone)) return Alert.alert('Check time zone', 'Use a valid IANA time zone, such as Asia/Karachi, or choose Device time.');
    onSave(input); setPanel(null);
  }

  function saveTimeZone() {
    if (!profile) return;
    if (!isSupportedTimeZone(timeZone)) return Alert.alert('Check time zone', 'Use a valid IANA time zone, such as Asia/Karachi, or choose Device time.');
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = profile;
    onSave({ ...input, timeZone }); setPanel(null);
  }

  async function choosePhoto() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return Alert.alert('Photo permission needed', 'Allow photo access to choose a profile picture.');
      const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
      if (!result.canceled && result.assets[0]?.uri) await onSavePhoto(result.assets[0].uri);
    } catch {
      Alert.alert('Could not choose a photo', 'Try again after checking the app photo permission.');
    }
  }

  async function exportBackup() {
    try { const text = await onExport(); if (await savePortableBackupFile(text, date)) Alert.alert('Backup saved', 'The JSON file includes your diary and available custom photos. Keep it somewhere safe.'); }
    catch (error) { Alert.alert('Backup not saved', error instanceof Error ? error.message : 'Please try again.'); }
  }
  function confirmImport(text = backupText) {
    try {
      const preview = previewPortableBackup(text);
      Alert.alert('Restore this backup?', `${preview.counts.entries} diary entries · ${preview.counts.foods} foods · ${preview.counts.recipes} recipes.\nA recovery copy of the current diary will be kept.\n${preview.warnings.join('\n')}`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Restore', style: 'destructive', onPress: () => onImport(text) }]);
    } catch (error) { Alert.alert('Invalid backup', error instanceof Error ? error.message : 'Choose a Weed Fitness backup.'); }
  }
  async function chooseBackup() {
    if (readingBackup) return;
    setReadingBackup(true);
    try {
      const file = await pickPortableBackupFile();
      if (file) confirmImport(await file.read());
    } catch (error) { Alert.alert('Cannot open backup', String(error)); }
    finally { setReadingBackup(false); }
  }
  async function showTelemetryStatus() {
    const status = await telemetryQueueStatus();
    Alert.alert('Private test uploads', `${status.queued} queued · ${status.dropped} dropped\nLast upload: ${status.lastUploadAt || 'not yet'}\n${status.lastError || 'No pending upload error'}`);
  }
  async function exportDiagnostics() { const text = await onExportDiagnostics(); await Share.share({ title: `Weed Fitness AI diagnostics ${date}`, message: text }); }
  async function clearTestTelemetry() {
    try {
      await onClearTestTelemetry();
      Alert.alert('Test data cleared', 'This phone\'s remote test telemetry and unsent queue were deleted. New testing activity will begin collecting again automatically.');
    } catch {
      Alert.alert('Could not clear test data', 'Keep this phone online and try again.');
    }
  }
  async function savePin() {
    if (!/^\d{4,8}$/.test(pin)) return Alert.alert('Choose a PIN', 'Use 4 to 8 digits.');
    if (pin !== confirmPin) return Alert.alert('PINs do not match', 'Enter the same PIN twice.');
    await onSetLocalPin(pin); setPin(''); setConfirmPin(''); setPanel(null);
  }

  function displayWeight(value?: number) { if (value == null) return 'No check-in'; return profile?.preferredWeightUnit === 'lb' ? `${kgToLb(value).toFixed(1)} lb` : `${value.toFixed(1)} kg`; }
  const goalLabel = profile?.goalMode === 'lose' ? 'Lose weight' : profile?.goalMode === 'gain' ? 'Build weight / muscle' : 'Maintain weight';
  const healthLabel = healthConnect?.permissionGranted ? 'Connected' : healthConnect?.developmentBuildRequired ? 'Needs APK build' : healthConnect?.available ? 'Ready to connect' : 'Checking phone';
  const voiceLabel = audioConfigured ? 'Ready' : audioConfigured === false ? 'Service needs attention' : 'Checking';
  const voiceDetail = audioConfigured ? 'Groq Whisper transcription and the food agent run through the private HTTPS service. No PC connection or API-key entry is required.' : audioConfigured === false ? 'The private AI service did not report as ready. Tap Refresh services after confirming this is the newest APK and the phone has internet.' : 'Checking the private AI service. Tap Refresh services if this does not update in a moment.';
  const foodAgentLabel = appAgentEnabled ? 'Ready' : appAgentEnabled === false ? 'Service needs attention' : 'Checking';
  const currentGoal = profile ? recommendDailyGoal(profile, date) : undefined;
  const program = state.nutritionProgram;
  const avatar = <Pressable onPress={() => void choosePhoto()} accessibilityRole="button" accessibilityLabel="Change profile photo" style={styles.avatarButton}>
    {profile?.profilePhotoUri ? <Image source={{ uri: profile.profilePhotoUri }} style={styles.avatarImage} /> : <View style={styles.avatarFallback}><Ionicons name="person" size={28} color={colors.white} /></View>}
    <View style={styles.camera}><Ionicons name="camera" size={12} color={colors.white} /></View>
  </Pressable>;

  return <Page>
    <ScreenHeader eyebrow="Account" title={profile?.displayName || 'You'} subtitle="Profile, preferences, services, and your local data." action={avatar} />
    {panel ? <Pressable style={styles.back} onPress={() => setPanel(null)}><Ionicons name="chevron-back" size={18} color={colors.pine} /><Text style={styles.backText}>Account</Text></Pressable> : null}

    {panel === null ? <>
      <SectionTitle title="At a glance" detail="your recorded progress" />
      <View style={styles.metricGrid}><Metric icon="calendar-outline" label="Logged days" value={String(year.loggedDays)} /><Metric icon="scale-outline" label="Weight change" value={year.weightChange == null ? '—' : `${year.weightChange > 0 ? '+' : ''}${profile?.preferredWeightUnit === 'lb' ? kgToLb(year.weightChange).toFixed(1) : year.weightChange.toFixed(1)} ${profile?.preferredWeightUnit === 'lb' ? 'lb' : 'kg'}`} /><Metric icon="flag-outline" label="Goal progress" value={year.goalProgress == null ? 'Steady' : `${year.goalProgress.toFixed(0)}%`} /></View>
      <SettingsGroup title="Account"><SettingsRow icon="person-outline" title="Profile & measurements" detail="Name, body details, units, and goal pace" onPress={() => setPanel('profile')} /><SettingsRow icon="flag-outline" title="Goals & daily plan" detail="Your target, adaptive check-ins, and how it works" onPress={() => setPanel('goals')} /><SettingsRow icon="stats-chart-outline" title="Progress & statistics" detail="A compact account summary of your own data" onPress={() => setPanel('statistics')} last /></SettingsGroup>
      <SettingsGroup title="Preferences"><SettingsRow icon="time-outline" title="Date & time" detail={timeZone === 'device' ? `Device time · ${deviceTimeZone()}` : timeZone} onPress={() => setPanel('time')} /><SettingsRow icon="color-palette-outline" title="Appearance & display" detail={themeOptions.find((item) => item.key === activeTheme)?.label || 'Theme'} onPress={() => setPanel('appearance')} /><SettingsRow icon="shield-checkmark-outline" title="Local app lock" detail={pinEnabled ? 'PIN enabled' : 'No PIN set'} onPress={() => setPanel('security')} last /></SettingsGroup>
      <SettingsGroup title="Services"><SettingsRow icon="link-outline" title="Connections" detail={`Voice: ${voiceLabel} · Health: ${healthLabel}`} onPress={() => setPanel('connections')} last /></SettingsGroup>
      <SettingsGroup title="App"><SettingsRow icon="download-outline" title="Updates" detail="Version, channel, and update status" onPress={() => setPanel('updates')} last /></SettingsGroup>
      <SettingsGroup title="Your data"><SettingsRow icon="archive-outline" title="Backup & restore" detail="Your diary stays on this device" onPress={() => setPanel('data')} last /></SettingsGroup>
      <Text style={styles.footer}>PRIVATE PREVIEW · DATA SAVED LOCALLY FIRST</Text>
    </> : null}

    {panel === 'profile' ? <>
      <SectionTitle title="Profile & measurements" detail="used to calculate targets" />
      <Card><Field label="Name" value={name} onChangeText={setName} /><Text style={styles.label}>SEX USED BY BMR EQUATION</Text><ChipRow>{(['male', 'female', 'other'] as const).map((value) => <Chip key={value} label={value} selected={sex === value} onPress={() => setSex(value)} />)}</ChipRow><Field label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" />
        <Text style={styles.label}>HEIGHT UNIT</Text><ChipRow><Chip label="Centimeters" selected={heightUnit === 'cm'} onPress={() => switchHeight('cm')} /><Chip label="Feet & inches" selected={heightUnit === 'ft'} onPress={() => switchHeight('ft')} /></ChipRow>{heightUnit === 'cm' ? <Field label="Height (cm)" value={height} onChangeText={setHeight} keyboardType="decimal-pad" /> : <View style={styles.columns}><Field label="Feet" value={feet} onChangeText={setFeet} keyboardType="number-pad" style={styles.half} /><Field label="Inches" value={inches} onChangeText={setInches} keyboardType="decimal-pad" style={styles.half} /></View>}
        <Text style={styles.label}>WEIGHT UNIT</Text><ChipRow><Chip label="Kilograms" selected={weightUnit === 'kg'} onPress={() => switchWeight('kg')} /><Chip label="Pounds" selected={weightUnit === 'lb'} onPress={() => switchWeight('lb')} /></ChipRow><Field label={`Current weight (${weightUnit})`} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
      </Card>
      <Card><SectionTitle title="Goal preferences" detail="updates your plan" /><ChipRow><Chip label="Lose weight" selected={mode === 'lose'} onPress={() => setMode('lose')} /><Chip label="Maintain weight" selected={mode === 'maintain'} onPress={() => setMode('maintain')} /><Chip label="Build weight / muscle" selected={mode === 'gain'} onPress={() => setMode('gain')} /></ChipRow>{mode !== 'maintain' ? <Field label={`Target weight (${weightUnit})`} value={target} onChangeText={setTarget} keyboardType="decimal-pad" /> : null}<CalendarPicker label="TARGET DATE" value={targetDate} minDate={date} onChange={setTargetDate} /><Text style={styles.label}>PACE</Text><ChipRow>{(['gentle', 'moderate', 'aggressive'] as const).map((value) => <Chip key={value} label={value} selected={intensity === value} onPress={() => setIntensity(value)} />)}</ChipRow><Field label="Typical activity factor" value={factor} onChangeText={setFactor} keyboardType="decimal-pad" /><Button label="Save profile and goals" onPress={save} /></Card>
    </> : null}

    {panel === 'goals' ? <><SectionTitle title="Goals & daily plan" detail="your own settings" /><Card dark><Text style={styles.goalKicker}>{goalLabel.toUpperCase()}</Text><Text style={styles.goalHero}>{displayWeight(profile?.bodyWeightKg)} → {displayWeight(profile?.targetWeightKg)}</Text><Text style={styles.goalDetail}>{profile?.targetDate ? `Target ${profile.targetDate}` : 'No target date'} · {profile?.weeklyWeightChangeKg || 0} kg/week</Text></Card><View style={styles.metricGrid}><Metric icon="flame-outline" label="Daily calories" value={currentGoal ? String(currentGoal.calories) : '—'} /><Metric icon="barbell-outline" label="Protein" value={currentGoal ? `${currentGoal.protein} g` : '—'} /><Metric icon="pulse-outline" label="Maintenance" value={profile?.adaptiveTdee ? `${profile.adaptiveTdee} kcal` : 'Starting estimate'} /></View><Card><Text style={styles.rowTitle}>Adaptive plan</Text><Text style={styles.systemDetail}>{profile?.adaptiveTdee ? `Active: maintenance was last checked on ${profile.adaptiveTdeeUpdatedAt?.slice(0, 10) || 'a previous date'}.` : 'Collecting complete food days and weigh-ins. Mark finished days complete in Today.'}</Text><Pressable onPress={() => setShowGoalMethod(!showGoalMethod)} style={styles.explainToggle}><Text style={styles.explainToggleText}>{showGoalMethod ? 'Hide plan details' : 'How your plan works'}</Text><Ionicons name={showGoalMethod ? 'chevron-up' : 'chevron-down'} size={16} color={colors.pine} /></Pressable>{showGoalMethod ? <><Text style={styles.systemDetail}>After at least 14 consecutive past days marked food-complete and at least four weigh-ins across the period, the app estimates maintenance from your recorded intake and weight trend. It checks no more than weekly and changes maintenance by at most 100 kcal/day. Missing logs never lower your target.</Text>{program ? <><Text style={styles.rowTitle}>Flexible meal structure</Text><Text style={styles.systemDetail}>{program.summary}</Text>{program.meals.map((meal) => <View key={`${meal.time}_${meal.label}`} style={styles.meal}><Text style={styles.mealTitle}>{meal.time} · {meal.label}</Text><Text style={styles.mealDetail}>{meal.targetCalories} kcal · {meal.targetProtein}g protein · {meal.foods.join(', ')}</Text></View>)}<Text style={styles.sourceText}>{program.sources.map((source) => source.title).join(' · ')}</Text></> : null}</> : null}<Button label="Edit goals and profile" tone="secondary" onPress={() => setPanel('profile')} /></Card></> : null}

    {panel === 'statistics' ? <><SectionTitle title="Progress & statistics" detail="account summary" /><View style={styles.metricGrid}><Metric icon="calendar-outline" label="Logged days" value={String(year.loggedDays)} /><Metric icon="scale-outline" label="Current weight" value={displayWeight(year.currentWeight)} /><Metric icon="trending-up-outline" label="Weight change" value={year.weightChange == null ? '—' : `${year.weightChange > 0 ? '+' : ''}${year.weightChange.toFixed(1)} kg`} /></View><Card><Text style={styles.rowTitle}>More detail lives in Trends</Text><Text style={styles.systemDetail}>The Trends tab is kept separate so account settings never jump into the main navigation. It contains your day-by-day food, weight, and activity charts.</Text></Card></> : null}

    {panel === 'time' ? <><SectionTitle title="Date & time" detail="used for new diary items" /><Card><Text style={styles.explainer}>Device time is the normal choice. It fixes the old UTC date shift and works wherever the phone travels.</Text><ChipRow><Chip label={`Device (${deviceTimeZone()})`} selected={timeZone === 'device'} onPress={() => setTimeZone('device')} /><Chip label="Pakistan · UTC+5" selected={timeZone === 'Asia/Karachi'} onPress={() => setTimeZone('Asia/Karachi')} /></ChipRow><Field label="Other IANA time zone (optional)" value={timeZone === 'device' || timeZone === 'Asia/Karachi' ? '' : timeZone} onChangeText={(value) => setTimeZone(value.trim() || 'device')} placeholder="Example: Europe/London" autoCapitalize="none" /><Button label="Save date & time" onPress={saveTimeZone} /></Card></> : null}

    {panel === 'appearance' ? <><SectionTitle title="Appearance & display" detail="stored on this phone" /><Card><Text style={styles.explainer}>Choose a palette for the entire interface.</Text><ChipRow>{themeOptions.map((theme) => <Chip key={theme.key} label={theme.label} selected={activeTheme === theme.key} onPress={() => onThemeChange(theme.key)} />)}</ChipRow><Text style={styles.systemDetail}>{themeOptions.find((theme) => theme.key === activeTheme)?.detail} Applying a palette briefly reloads the static color layer, then returns here.</Text></Card><Card><Text style={styles.rowTitle}>Screen brightness</Text><Text style={styles.systemDetail}>Weed Fitness follows your phone’s brightness and dark-mode settings. The app does not change device brightness automatically.</Text></Card></> : null}

    {panel === 'connections' ? <><SectionTitle title="Connections" detail="services used by this phone" /><Card><ConnectionStatus icon="mic-outline" title="Voice assistant" detail={voiceDetail} state={voiceLabel} /><ConnectionStatus icon="sparkles-outline" title="Food agent" detail="The agent can prepare, save, edit, or delete food and weight actions after your confirmation. Your diary remains on this phone." state={foodAgentLabel} /><ConnectionStatus icon="heart-outline" title="Health Connect" detail={healthConnect?.message || 'Share workouts, active calories, distance, and weight from Health Connect. Tracker source labels are kept on imported workouts.'} state={healthLabel} /><View style={styles.actions}><Button label={healthConnect?.permissionGranted ? 'Update access' : 'Connect Health'} compact tone="secondary" onPress={onConnectHealth} />{healthConnect?.permissionGranted ? <Button label="Health settings" compact tone="ghost" onPress={onOpenHealthSettings} /> : null}<Button label="Refresh services" compact tone="ghost" onPress={onRefreshIntegrations} /></View><ConnectionStatus icon="walk-outline" title="Strava" detail="If Strava shares an activity with Health Connect, it is imported here automatically with a Strava source label. No separate Strava API or subscription is used." state="Via Health Connect" /></Card></> : null}

    {panel === 'updates' ? <><SectionTitle title="App updates" detail="production channel" /><AppUpdatePanel beforeRestart={onBeforeRestart} /></> : null}

    {panel === 'security' ? <><SectionTitle title="Local app lock" detail="optional device-only protection" /><Card><Text style={styles.explainer}>A PIN protects the app after it is sent to the background. The PIN is stored in your phone’s encrypted storage, not in a cloud account.</Text>{pinEnabled ? <><Text style={styles.ready}>A local PIN is enabled.</Text><Button label="Remove local PIN" tone="danger" onPress={() => Alert.alert('Remove local PIN?', 'Anyone with this phone will be able to open Weed Fitness.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove PIN', style: 'destructive', onPress: () => void onSetLocalPin(null).then(() => setPanel(null)) }])} /></> : <><Field label="Choose 4–8 digit PIN" value={pin} onChangeText={(value) => setPin(value.replace(/\D/g, ''))} keyboardType="number-pad" secureTextEntry maxLength={8} /><Field label="Confirm PIN" value={confirmPin} onChangeText={(value) => setConfirmPin(value.replace(/\D/g, ''))} keyboardType="number-pad" secureTextEntry maxLength={8} /><Button label="Enable local PIN" onPress={() => void savePin()} /></>}</Card></> : null}

    {panel === 'data' ? <>
      <SectionTitle title="Backup & restore" detail="you control the data" />
      <Card>
        <Text style={styles.explainer}>A portable JSON backup includes your profile, recipes, foods, diary, weights, activities, and targets. It never includes credentials or raw audio.</Text>
        <Button label="Save portable backup file" onPress={() => void exportBackup()} />
        <View style={styles.smallGap} />
        <Button label={readingBackup ? 'Checking backup…' : 'Choose backup file'} tone="secondary" disabled={readingBackup} onPress={chooseBackup} />
        <Button label="Recover diary from before last restore" tone="ghost" onPress={() => Alert.alert('Recover previous diary?', 'This replaces current changes with the saved pre-restore copy.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Recover', onPress: () => { void onUndoRestore(); } }])} />
        <Button label={showRestore ? 'Hide restore box' : 'Restore backup'} tone="secondary" onPress={() => setShowRestore(!showRestore)} />
        {showRestore ? <>
          <Field label="Paste complete backup JSON" value={backupText} onChangeText={setBackupText} multiline autoCapitalize="none" />
          <Button label="Review and restore pasted backup" tone="danger" onPress={() => confirmImport()} />
        </> : null}
        {testingTelemetryEnabled ? <>
        <Button label="Test upload status" tone="secondary" onPress={showTelemetryStatus} />
          <View style={styles.divider} />
          <Text style={styles.rowTitle}>Private test telemetry is active</Text>
          <Text style={styles.systemDetail}>This preview build automatically sends app interactions, AI commands and replies, action outcomes, errors, and your test diary snapshot to the owner’s private debugging database. It never sends API keys or raw audio. This is only for your pre-product testing and will be removed before public release.</Text>
          <Button label="Clear this phone's cloud test data" tone="secondary" onPress={() => Alert.alert('Clear cloud test data?', 'This removes the remote telemetry for this test phone. New activity will begin collecting again automatically.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: () => void clearTestTelemetry() }])} />
        </> : null}
        <View style={styles.divider} />
        <Text style={styles.rowTitle}>Manual AI diagnostics</Text>
        <Text style={styles.systemDetail}>The last 120 local AI events can still be shared as JSON if you want to inspect them yourself.</Text>
        <Button label="Share AI diagnostics" tone="secondary" onPress={() => void exportDiagnostics()} />
        <View style={styles.divider} />
        <Text style={styles.rowTitle}>Stored locally on this phone</Text>
        <Text style={styles.systemDetail}>{status}</Text>
        <View style={styles.smallGap} />
        <Button label="Load demo history" tone="ghost" onPress={() => Alert.alert('Load demo history?', 'This refreshes 60 days of demonstration records.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Load', onPress: onLoadDemo }])} />
      </Card>
    </> : null}
  </Page>;
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) { return <><SectionTitle title={title} /><Card style={styles.settingsCard}>{children}</Card></>; }
function SettingsRow({ icon, title, detail, onPress, last = false }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; detail: string; onPress: () => void; last?: boolean }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.settingsRow, !last && styles.settingsRowBorder, pressed && styles.pressed]}><View style={styles.rowIcon}><Ionicons name={icon} size={18} color={colors.pine} /></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowDetail} numberOfLines={2}>{detail}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.faint} /></Pressable>; }
function ConnectionStatus({ icon, title, detail, state }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; detail: string; state: string }) { return <View style={styles.connection}><View style={styles.rowIcon}><Ionicons name={icon} size={18} color={colors.pine} /></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{title} <Text style={styles.connectionState}>· {state}</Text></Text><Text style={styles.rowDetail}>{detail}</Text></View></View>; }
function Metric({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) { return <Card style={styles.metric}><Ionicons name={icon} size={17} color={colors.coral} /><Text style={styles.metricValue} numberOfLines={1}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></Card>; }

const styles = themedStyles(() => ({
  avatarButton: { width: 56, height: 56, borderRadius: 28, position: 'relative' }, avatarImage: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.paperDeep }, avatarFallback: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.pine, alignItems: 'center', justifyContent: 'center' }, camera: { width: 21, height: 21, borderRadius: 11, backgroundColor: colors.coral, borderWidth: 2, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center', position: 'absolute', right: -2, bottom: -1 },
  back: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 1, marginBottom: 8, paddingVertical: 4 }, backText: { color: colors.pine, fontSize: 12, fontWeight: '900' }, identity: { flexDirection: 'row', alignItems: 'center', gap: 12 }, identityCopy: { flex: 1 }, identityName: { color: colors.ink, fontFamily: 'serif', fontSize: 24, fontWeight: '900' }, identityMeta: { color: colors.pine, fontSize: 12, fontWeight: '800', marginTop: 4 }, identitySub: { color: colors.muted, fontSize: 10, marginTop: 5 },
  goalKicker: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 }, goalHero: { color: colors.ink, fontFamily: 'serif', fontSize: 25, fontWeight: '900', marginTop: 5 }, goalDetail: { color: colors.muted, fontSize: 10, marginTop: 5 }, explainToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.paper, borderRadius: 12, padding: 11, marginBottom: 10 }, explainToggleText: { color: colors.pine, fontSize: 10, fontWeight: '900' },
  metricGrid: { flexDirection: 'row', gap: 8, marginBottom: 5 }, metric: { flex: 1, minHeight: 98, padding: 11, marginBottom: 0 }, metricValue: { color: colors.ink, fontSize: 16, fontWeight: '900', marginTop: 9 }, metricLabel: { color: colors.muted, fontSize: 9, lineHeight: 12, marginTop: 3 },
  settingsCard: { paddingVertical: 0, overflow: 'hidden' }, settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 67, paddingHorizontal: 13, paddingVertical: 9 }, settingsRowBorder: { borderBottomWidth: 1, borderColor: colors.line }, pressed: { opacity: 0.62 }, rowIcon: { width: 33, height: 33, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pineSoft }, rowCopy: { flex: 1 }, rowTitle: { color: colors.ink, fontSize: 12, fontWeight: '900' }, rowDetail: { color: colors.muted, fontSize: 9.5, lineHeight: 14, marginTop: 2 }, footer: { color: colors.faint, fontSize: 9, letterSpacing: 1.2, fontWeight: '800', textAlign: 'center', marginTop: 7 },
  label: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 7 }, columns: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }, half: { width: '48.5%' }, explainer: { color: colors.muted, fontSize: 11, lineHeight: 17, marginBottom: 12 }, systemDetail: { color: colors.muted, fontSize: 10.5, lineHeight: 16, marginTop: 4, marginBottom: 10 }, ready: { color: colors.pine, fontSize: 11, fontWeight: '800', marginBottom: 12 },
  connection: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10 }, connectionState: { color: colors.pine, fontSize: 10, fontWeight: '800' }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2, marginBottom: 4 }, divider: { height: 1, backgroundColor: colors.line, marginVertical: 14 }, smallGap: { height: 8 }, meal: { borderTopWidth: 1, borderColor: colors.line, paddingVertical: 8 }, mealTitle: { color: colors.ink, fontSize: 10, fontWeight: '900' }, mealDetail: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 2 }, sourceText: { color: colors.faint, fontSize: 8, lineHeight: 12, marginTop: 10 }
}));
