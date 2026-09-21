import React, { useEffect, useState } from 'react';
import { Alert, Share, Switch, Text, View } from 'react-native';
import { Button } from './ui';
import { colors, themedStyles } from '../theme';
import { initializeLocalDiagnostics, localDiagnosticsEnabled, setLocalDiagnosticsEnabled, clearLocalDiagnostics, exportLocalDiagnostics } from '../logic/localDiagnostics';

export function LocalDiagnosticsPanel() {
  const [enabled, setEnabled] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => { let mounted = true; void initializeLocalDiagnostics().then(() => { if (mounted) setEnabled(localDiagnosticsEnabled()); }); return () => { mounted = false; }; }, []);
  async function toggle(value: boolean) {
    setBusy(true);
    try { await setLocalDiagnosticsEnabled(value); setEnabled(value); }
    catch { Alert.alert('Setting not saved', 'Your phone could not save this setting. Please try again.'); }
    finally { setBusy(false); }
  }
  return <View style={styles.root}>
    <View style={styles.row}><Text style={styles.title}>Local testing history</Text><Switch accessibilityLabel="Record diagnostic history on this phone" value={enabled} disabled={busy} onValueChange={(value) => void toggle(value)} /></View>
    <Text style={styles.text}>Optional, bounded interaction history stored only on this phone. No automatic uploads. Keys and raw audio are excluded. Sharing may include food logs and AI conversations, so share only with someone you trust.</Text>
    <Button label="Share local history" tone="secondary" onPress={() => { void exportLocalDiagnostics().then((message) => Share.share({ title: 'Weed Fitness local diagnostics', message })).catch(() => Alert.alert('Cannot share history', 'Please try again.')); }} />
    <Button label="Clear local history" tone="ghost" onPress={() => Alert.alert('Clear local testing history?', 'Your diary and saved API key will not be deleted.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: () => { void clearLocalDiagnostics().then(() => Alert.alert('History cleared')).catch(() => Alert.alert('Could not clear history')); } }])} />
  </View>;
}
const styles = themedStyles(() => ({ root: { gap: 12 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, title: { flex: 1, fontSize: 16, color: colors.ink, fontWeight: '700' }, text: { color: colors.ink, fontSize: 14, lineHeight: 21 } }));
