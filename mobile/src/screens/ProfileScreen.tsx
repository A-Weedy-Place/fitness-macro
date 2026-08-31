import React, { useEffect, useMemo, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { AppState, ProfileInput } from '../types';
import { Button, Card, Chip, ChipRow, Field, Page, ScreenHeader, SectionTitle, TabKey } from '../components/ui';
import { CalendarPicker } from '../components/CalendarPicker';
import { buildDailySeries, latestWeightByDate } from '../logic/analytics';
import { weeklyChangeForGoal } from '../logic/goals';
import { cmToFeetInches, feetInchesToCm, kgToLb, lbToKg } from '../logic/units';
import { activeTheme as loadedTheme, AppThemeName, colors, themeOptions } from '../theme';
import { AgentConnection, StravaStatus } from '../services/agentClient';
import { HealthConnectStatus } from '../services/healthConnect';

type Panel = 'profile' | 'appearance' | 'connections' | 'data' | 'security' | null;

export function ProfileScreen({ state, date, status, strava, healthConnect, audioConfigured, appAgentEnabled, agentConnection, onSaveAgentConnection, activeTheme = loadedTheme, onThemeChange, onSave, onSavePhoto, onOpenTab, pinEnabled, onSetLocalPin, onSync, onLoadDemo, onExport, onImport, onConnectStrava, onSyncStrava, onConnectHealth, onOpenHealthSettings, onRefreshIntegrations }: {
  state: AppState; date: string; status: string; strava: StravaStatus | null; healthConnect: HealthConnectStatus | null; audioConfigured: boolean | null; appAgentEnabled: boolean | null;
  agentConnection: AgentConnection; onSaveAgentConnection: (input: { baseUrl: string; pairingToken: string }) => Promise<void>;
  activeTheme?: AppThemeName; onThemeChange: (theme: AppThemeName) => void; onSave: (profile: ProfileInput) => void; onSavePhoto: (uri?: string) => Promise<void>; onOpenTab: (tab: TabKey) => void;
  pinEnabled: boolean; onSetLocalPin: (pin: string | null) => Promise<void>; onSync: () => void; onLoadDemo: () => void; onExport: () => string; onImport: (text: string) => void;
  onConnectStrava: () => void; onSyncStrava: () => void; onConnectHealth: () => void; onOpenHealthSettings: () => void; onRefreshIntegrations: () => void;
}) {
  const profile = state.profile;
  const initialHeight = profile?.heightCm || 175;
  const initialImperialHeight = cmToFeetInches(initialHeight);
  const [panel, setPanel] = useState<Panel>(null);
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
  const [backupText, setBackupText] = useState('');
  const [showRestore, setShowRestore] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [agentUrl, setAgentUrl] = useState(agentConnection.baseUrl);
  const [agentToken, setAgentToken] = useState('');

  useEffect(() => {
    if (!profile) return;
    const imperial = cmToFeetInches(profile.heightCm);
    const preferredHeight = profile.preferredHeightUnit || 'cm';
    const preferredWeight = profile.preferredWeightUnit || 'kg';
    setName(profile.displayName || ''); setSex(profile.sex); setAge(String(profile.ageYears)); setHeightUnit(preferredHeight); setHeight(String(profile.heightCm)); setFeet(String(imperial.feet)); setInches(String(imperial.inches)); setWeightUnit(preferredWeight); setWeight(String(preferredWeight === 'lb' ? kgToLb(profile.bodyWeightKg).toFixed(1) : profile.bodyWeightKg)); setTarget(String(preferredWeight === 'lb' && profile.targetWeightKg ? kgToLb(profile.targetWeightKg).toFixed(1) : profile.targetWeightKg || '')); setFactor(String(profile.activityFactor)); setMode(profile.goalMode === 'lose' || profile.goalMode === 'gain' ? profile.goalMode : 'maintain'); setIntensity(profile.goalIntensity || 'moderate'); setTargetDate(profile.targetDate || date);
  }, [profile?.updatedAt, date]);

  useEffect(() => { setAgentUrl(agentConnection.baseUrl); }, [agentConnection.baseUrl]);

  const year = useMemo(() => {
    const series = buildDailySeries({ endDate: date, days: 365, entries: state.entries, foods: state.foods, activities: state.activities, goals: state.goals, profile });
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
    const base = { displayName: name.trim() || undefined, profilePhotoUri: profile?.profilePhotoUri, sex, ageYears: Number(age), heightCm, bodyWeightKg, targetWeightKg, activityFactor: Number(factor), goalMode: mode, goalIntensity: intensity, targetDate, onboardingComplete: true, preferredHeightUnit: heightUnit, preferredWeightUnit: weightUnit, adaptiveTdee: profile?.adaptiveTdee, adaptiveTdeeUpdatedAt: profile?.adaptiveTdeeUpdatedAt, dietStyle: profile?.dietStyle, preferredCuisine: profile?.preferredCuisine, mealsPerDay: profile?.mealsPerDay, excludedFoods: profile?.excludedFoods };
    if (![base.ageYears, base.heightCm, base.bodyWeightKg, base.targetWeightKg, base.activityFactor].every(Number.isFinite)) return null;
    return { ...base, weeklyWeightChangeKg: weeklyChangeForGoal(base) };
  }, [name, sex, age, heightUnit, height, feet, inches, weightUnit, weight, target, factor, mode, intensity, targetDate, profile?.profilePhotoUri, profile?.adaptiveTdee, profile?.adaptiveTdeeUpdatedAt, profile?.dietStyle, profile?.preferredCuisine, profile?.mealsPerDay, profile?.excludedFoods]);

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
    onSave(input); setPanel(null);
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

  async function exportBackup() { const text = onExport(); setBackupText(text); await Share.share({ title: `FitnessMacro backup ${date}`, message: text }); }
  async function savePin() {
    if (!/^\d{4,8}$/.test(pin)) return Alert.alert('Choose a PIN', 'Use 4 to 8 digits.');
    if (pin !== confirmPin) return Alert.alert('PINs do not match', 'Enter the same PIN twice.');
    await onSetLocalPin(pin); setPin(''); setConfirmPin(''); setPanel(null);
  }

  async function saveAgentLink() {
    try {
      await onSaveAgentConnection({ baseUrl: agentUrl, pairingToken: agentToken });
      setAgentToken('');
      Alert.alert('PC agent linked', 'The phone can now use this PC for voice transcription and food actions while both devices are on the same trusted network.');
    } catch (error) {
      Alert.alert('Could not save PC agent link', error instanceof Error ? error.message : 'Check the address and pairing token, then try again.');
    }
  }

  function displayWeight(value?: number) { if (value == null) return 'No check-in'; return profile?.preferredWeightUnit === 'lb' ? `${kgToLb(value).toFixed(1)} lb` : `${value.toFixed(1)} kg`; }
  const goalLabel = profile?.goalMode === 'lose' ? 'Lose weight' : profile?.goalMode === 'gain' ? 'Build weight / muscle' : 'Maintain weight';
  const healthLabel = healthConnect?.permissionGranted ? 'Connected' : healthConnect?.developmentBuildRequired ? 'Needs APK build' : healthConnect?.available ? 'Ready to connect' : 'Checking phone';
  const voiceLabel = audioConfigured ? 'Ready via PC agent' : audioConfigured === false ? 'Needs Groq key' : 'Checking';
  const avatar = <Pressable onPress={() => void choosePhoto()} accessibilityRole="button" accessibilityLabel="Change profile photo" style={styles.avatarButton}>
    {profile?.profilePhotoUri ? <Image source={{ uri: profile.profilePhotoUri }} style={styles.avatarImage} /> : <View style={styles.avatarFallback}><Ionicons name="person" size={28} color={colors.white} /></View>}
    <View style={styles.camera}><Ionicons name="camera" size={12} color={colors.white} /></View>
  </Pressable>;

  return <Page>
    <ScreenHeader eyebrow="Account" title={profile?.displayName || 'You'} subtitle="Profile, preferences, services, and your local data." action={avatar} />
    {panel ? <Pressable style={styles.back} onPress={() => setPanel(null)}><Ionicons name="chevron-back" size={18} color={colors.pine} /><Text style={styles.backText}>Account</Text></Pressable> : null}

    {panel === null ? <>
      <Card dark><View style={styles.identity}><View style={styles.identityCopy}><Text style={styles.identityName}>{profile?.displayName || 'Local profile'}</Text><Text style={styles.identityMeta}>{goalLabel} · {displayWeight(year.currentWeight)}</Text><Text style={styles.identitySub}>{profile?.targetWeightKg ? `Target ${displayWeight(profile.targetWeightKg)}` : 'Set a target in Profile & measurements'}</Text></View><Ionicons name="sparkles-outline" size={25} color={colors.goldSoft} /></View></Card>
      <SectionTitle title="At a glance" detail="your recorded progress" />
      <View style={styles.metricGrid}><Metric icon="calendar-outline" label="Logged days" value={String(year.loggedDays)} /><Metric icon="scale-outline" label="Weight change" value={year.weightChange == null ? '—' : `${year.weightChange > 0 ? '+' : ''}${profile?.preferredWeightUnit === 'lb' ? kgToLb(year.weightChange).toFixed(1) : year.weightChange.toFixed(1)} ${profile?.preferredWeightUnit === 'lb' ? 'lb' : 'kg'}`} /><Metric icon="flag-outline" label="Goal progress" value={year.goalProgress == null ? 'Steady' : `${year.goalProgress.toFixed(0)}%`} /></View>
      <SettingsGroup title="Account"><SettingsRow icon="person-outline" title="Profile & measurements" detail="Name, body details, units, and goal pace" onPress={() => setPanel('profile')} /><SettingsRow icon="flag-outline" title="Goals & daily plan" detail="See your targets and recommended plan" onPress={() => onOpenTab('plans')} /><SettingsRow icon="stats-chart-outline" title="Progress & statistics" detail="Weight, intake, and activity trends" onPress={() => onOpenTab('trends')} last /></SettingsGroup>
      <SettingsGroup title="Preferences"><SettingsRow icon="color-palette-outline" title="Appearance & display" detail={themeOptions.find((item) => item.key === activeTheme)?.label || 'Theme'} onPress={() => setPanel('appearance')} /><SettingsRow icon="shield-checkmark-outline" title="Local app lock" detail={pinEnabled ? 'PIN enabled' : 'No PIN set'} onPress={() => setPanel('security')} last /></SettingsGroup>
      <SettingsGroup title="Services"><SettingsRow icon="link-outline" title="Connections" detail={`Voice: ${voiceLabel} · Health: ${healthLabel}`} onPress={() => setPanel('connections')} last /></SettingsGroup>
      <SettingsGroup title="Your data"><SettingsRow icon="cloud-download-outline" title="Backup, restore & sync" detail={state.pendingOperations.length ? `${state.pendingOperations.length} change(s) waiting for the PC` : 'Local data is synchronized'} onPress={() => setPanel('data')} last /></SettingsGroup>
      <Text style={styles.footer}>LOCAL-FIRST · SCHEMA 6</Text>
    </> : null}

    {panel === 'profile' ? <>
      <SectionTitle title="Profile & measurements" detail="used to calculate targets" />
      <Card><Field label="Name" value={name} onChangeText={setName} /><Text style={styles.label}>SEX USED BY BMR EQUATION</Text><ChipRow>{(['male', 'female', 'other'] as const).map((value) => <Chip key={value} label={value} selected={sex === value} onPress={() => setSex(value)} />)}</ChipRow><Field label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" />
        <Text style={styles.label}>HEIGHT UNIT</Text><ChipRow><Chip label="Centimeters" selected={heightUnit === 'cm'} onPress={() => switchHeight('cm')} /><Chip label="Feet & inches" selected={heightUnit === 'ft'} onPress={() => switchHeight('ft')} /></ChipRow>{heightUnit === 'cm' ? <Field label="Height (cm)" value={height} onChangeText={setHeight} keyboardType="decimal-pad" /> : <View style={styles.columns}><Field label="Feet" value={feet} onChangeText={setFeet} keyboardType="number-pad" style={styles.half} /><Field label="Inches" value={inches} onChangeText={setInches} keyboardType="decimal-pad" style={styles.half} /></View>}
        <Text style={styles.label}>WEIGHT UNIT</Text><ChipRow><Chip label="Kilograms" selected={weightUnit === 'kg'} onPress={() => switchWeight('kg')} /><Chip label="Pounds" selected={weightUnit === 'lb'} onPress={() => switchWeight('lb')} /></ChipRow><Field label={`Current weight (${weightUnit})`} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
      </Card>
      <Card><SectionTitle title="Goal preferences" detail="updates your plan" /><ChipRow><Chip label="Lose weight" selected={mode === 'lose'} onPress={() => setMode('lose')} /><Chip label="Maintain weight" selected={mode === 'maintain'} onPress={() => setMode('maintain')} /><Chip label="Build weight / muscle" selected={mode === 'gain'} onPress={() => setMode('gain')} /></ChipRow>{mode !== 'maintain' ? <Field label={`Target weight (${weightUnit})`} value={target} onChangeText={setTarget} keyboardType="decimal-pad" /> : null}<CalendarPicker label="TARGET DATE" value={targetDate} minDate={date} onChange={setTargetDate} /><Text style={styles.label}>PACE</Text><ChipRow>{(['gentle', 'moderate', 'aggressive'] as const).map((value) => <Chip key={value} label={value} selected={intensity === value} onPress={() => setIntensity(value)} />)}</ChipRow><Field label="Typical activity factor" value={factor} onChangeText={setFactor} keyboardType="decimal-pad" /><Button label="Save profile and goals" onPress={save} /></Card>
    </> : null}

    {panel === 'appearance' ? <><SectionTitle title="Appearance & display" detail="stored on this phone" /><Card><Text style={styles.explainer}>Choose a palette for the entire interface.</Text><ChipRow>{themeOptions.map((theme) => <Chip key={theme.key} label={theme.label} selected={activeTheme === theme.key} onPress={() => onThemeChange(theme.key)} />)}</ChipRow><Text style={styles.systemDetail}>{themeOptions.find((theme) => theme.key === activeTheme)?.detail} Changing a theme reloads the app once so every screen updates together.</Text></Card><Card><Text style={styles.rowTitle}>Screen brightness</Text><Text style={styles.systemDetail}>FitnessMacro follows your phone’s brightness and dark-mode settings. The app does not change device brightness automatically.</Text></Card></> : null}

    {panel === 'connections' ? <><SectionTitle title="Connections" detail="only enable what you use" /><Card><Text style={styles.rowTitle}>PC agent link</Text><Text style={styles.systemDetail}>Use this phone’s current PC Wi-Fi address. It is saved on the phone, so changing networks never requires rebuilding the APK.</Text><Field label="PC agent address" value={agentUrl} onChangeText={setAgentUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="http://192.168.18.113:8787" /><Field label={agentConnection.hasSavedPairingToken ? 'Pairing token (leave blank to keep saved token)' : 'Pairing token from agent/.env'} value={agentToken} onChangeText={setAgentToken} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder={agentConnection.hasSavedPairingToken ? 'Stored securely on this phone' : 'Enter pairing token'} /><Button label="Save PC agent link" compact tone="secondary" onPress={() => void saveAgentLink()} /></Card><Card><ConnectionStatus icon="mic-outline" title="Voice assistant" detail={audioConfigured ? 'Groq Whisper transcription and Groq planner are ready through your PC agent.' : 'Add the free Groq key to agent/.env and keep the PC agent running.'} state={voiceLabel} /><ConnectionStatus icon="heart-outline" title="Health Connect" detail={healthConnect?.message || 'Health Connect can share daily weight and exercise calories after you allow it.'} state={healthLabel} /><View style={styles.actions}>{healthConnect?.permissionGranted ? <Button label="Health settings" compact tone="secondary" onPress={onOpenHealthSettings} /> : <Button label="Connect Health" compact tone="secondary" onPress={onConnectHealth} />}<Button label="Refresh" compact tone="ghost" onPress={onRefreshIntegrations} /></View><ConnectionStatus icon="walk-outline" title="Strava" detail={strava?.connected ? 'Connected as an optional activity-data fallback.' : strava?.configured ? 'Optional fallback when Health Connect is not used.' : 'Not configured. Health Connect is preferred on Android.'} state={strava?.connected ? 'Connected' : strava?.configured ? 'Ready to connect' : 'Not configured'} />{strava?.connected ? <Button label="Sync Strava API" compact tone="ghost" onPress={onSyncStrava} /> : strava?.configured ? <Button label="Connect Strava fallback" compact tone="ghost" onPress={onConnectStrava} /> : null}<ConnectionStatus icon="sparkles-outline" title="Food agent" detail="The agent can prepare, save, edit, or delete food and weight actions after your confirmation." state={appAgentEnabled ? 'Ready' : 'PC agent unavailable'} /></Card></> : null}

    {panel === 'security' ? <><SectionTitle title="Local app lock" detail="optional device-only protection" /><Card><Text style={styles.explainer}>A PIN protects the app after it is sent to the background. The PIN is stored in your phone’s encrypted storage, not in a cloud account.</Text>{pinEnabled ? <><Text style={styles.ready}>A local PIN is enabled.</Text><Button label="Remove local PIN" tone="danger" onPress={() => Alert.alert('Remove local PIN?', 'Anyone with this phone will be able to open FitnessMacro.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove PIN', style: 'destructive', onPress: () => void onSetLocalPin(null).then(() => setPanel(null)) }])} /></> : <><Field label="Choose 4–8 digit PIN" value={pin} onChangeText={(value) => setPin(value.replace(/\D/g, ''))} keyboardType="number-pad" secureTextEntry maxLength={8} /><Field label="Confirm PIN" value={confirmPin} onChangeText={(value) => setConfirmPin(value.replace(/\D/g, ''))} keyboardType="number-pad" secureTextEntry maxLength={8} /><Button label="Enable local PIN" onPress={() => void savePin()} /></>}</Card></> : null}

    {panel === 'data' ? <><SectionTitle title="Backup, restore & sync" detail="you control the data" /><Card><Text style={styles.explainer}>A portable JSON backup includes your profile, recipes, foods, diary, weights, activities, and targets. It never includes credentials or raw audio.</Text><Button label="Share portable backup" onPress={() => void exportBackup()} /><View style={styles.smallGap} /><Button label={showRestore ? 'Hide restore box' : 'Restore backup'} tone="secondary" onPress={() => setShowRestore(!showRestore)} />{showRestore ? <><Field label="Paste complete backup JSON" value={backupText} onChangeText={setBackupText} multiline autoCapitalize="none" /><Button label="Import and replace local data" tone="danger" onPress={() => Alert.alert('Replace local data?', 'The pasted backup will become the active local account.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Import', style: 'destructive', onPress: () => onImport(backupText) }])} /></> : null}<View style={styles.divider} /><Text style={styles.rowTitle}>{state.pendingOperations.length ? `${state.pendingOperations.length} change(s) waiting for the PC` : 'Local changes synchronized'}</Text><Text style={styles.systemDetail}>{status}</Text><Button label="Sync everything with PC" tone="secondary" onPress={onSync} /><View style={styles.smallGap} /><Button label="Load demo history" tone="ghost" onPress={() => Alert.alert('Load demo history?', 'This refreshes 60 days of demonstration records.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Load', onPress: onLoadDemo }])} /></Card></> : null}
  </Page>;
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) { return <><SectionTitle title={title} /><Card style={styles.settingsCard}>{children}</Card></>; }
function SettingsRow({ icon, title, detail, onPress, last = false }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; detail: string; onPress: () => void; last?: boolean }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.settingsRow, !last && styles.settingsRowBorder, pressed && styles.pressed]}><View style={styles.rowIcon}><Ionicons name={icon} size={18} color={colors.pine} /></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowDetail} numberOfLines={2}>{detail}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.faint} /></Pressable>; }
function ConnectionStatus({ icon, title, detail, state }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; detail: string; state: string }) { return <View style={styles.connection}><View style={styles.rowIcon}><Ionicons name={icon} size={18} color={colors.pine} /></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{title} <Text style={styles.connectionState}>· {state}</Text></Text><Text style={styles.rowDetail}>{detail}</Text></View></View>; }
function Metric({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) { return <Card style={styles.metric}><Ionicons name={icon} size={17} color={colors.coral} /><Text style={styles.metricValue} numberOfLines={1}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></Card>; }

const styles = StyleSheet.create({
  avatarButton: { width: 56, height: 56, borderRadius: 28, position: 'relative' }, avatarImage: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.paperDeep }, avatarFallback: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.pine, alignItems: 'center', justifyContent: 'center' }, camera: { width: 21, height: 21, borderRadius: 11, backgroundColor: colors.coral, borderWidth: 2, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center', position: 'absolute', right: -2, bottom: -1 },
  back: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 1, marginBottom: 8, paddingVertical: 4 }, backText: { color: colors.pine, fontSize: 12, fontWeight: '900' }, identity: { flexDirection: 'row', alignItems: 'center', gap: 12 }, identityCopy: { flex: 1 }, identityName: { color: colors.white, fontFamily: 'serif', fontSize: 24, fontWeight: '900' }, identityMeta: { color: colors.goldSoft, fontSize: 12, fontWeight: '800', marginTop: 4 }, identitySub: { color: colors.faint, fontSize: 10, marginTop: 5 },
  metricGrid: { flexDirection: 'row', gap: 8, marginBottom: 5 }, metric: { flex: 1, minHeight: 98, padding: 11, marginBottom: 0 }, metricValue: { color: colors.ink, fontSize: 16, fontWeight: '900', marginTop: 9 }, metricLabel: { color: colors.muted, fontSize: 9, lineHeight: 12, marginTop: 3 },
  settingsCard: { paddingVertical: 0, overflow: 'hidden' }, settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 67, paddingHorizontal: 13, paddingVertical: 9 }, settingsRowBorder: { borderBottomWidth: 1, borderColor: colors.line }, pressed: { opacity: 0.62 }, rowIcon: { width: 33, height: 33, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pineSoft }, rowCopy: { flex: 1 }, rowTitle: { color: colors.ink, fontSize: 12, fontWeight: '900' }, rowDetail: { color: colors.muted, fontSize: 9.5, lineHeight: 14, marginTop: 2 }, footer: { color: colors.faint, fontSize: 9, letterSpacing: 1.2, fontWeight: '800', textAlign: 'center', marginTop: 7 },
  label: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 7 }, columns: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }, half: { width: '48.5%' }, explainer: { color: colors.muted, fontSize: 11, lineHeight: 17, marginBottom: 12 }, systemDetail: { color: colors.muted, fontSize: 10.5, lineHeight: 16, marginTop: 4, marginBottom: 10 }, ready: { color: colors.pine, fontSize: 11, fontWeight: '800', marginBottom: 12 },
  connection: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10 }, connectionState: { color: colors.coral, fontSize: 10, fontWeight: '800' }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2, marginBottom: 4 }, divider: { height: 1, backgroundColor: colors.line, marginVertical: 14 }, smallGap: { height: 8 }
});
