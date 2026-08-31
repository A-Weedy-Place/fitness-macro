import React, { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Field } from '../components/ui';
import { colors } from '../theme';

export function AccountLockScreen({ onUnlock }: { onUnlock: (pin: string) => Promise<boolean> }) {
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function unlock() {
    if (!/^\d{4,8}$/.test(pin)) {
      setMessage('Enter the 4 to 8 digit PIN you chose in Settings.');
      return;
    }
    setBusy(true);
    try {
      if (await onUnlock(pin)) return;
      setMessage('That PIN does not match. Please try again.');
    } catch {
      setMessage('The local lock could not be checked. Try opening the app again.');
    } finally {
      setBusy(false);
    }
  }

  return <View style={styles.page}>
    <View style={styles.mark}><Ionicons name="shield-checkmark-outline" size={32} color={colors.white} /></View>
    <Text style={styles.title}>FitnessMacro is locked</Text>
    <Text style={styles.detail}>This is a private, device-only PIN. It is not an online account and does not require a subscription.</Text>
    <View style={styles.form}>
      <Field label="Local PIN" value={pin} onChangeText={(value) => { setPin(value.replace(/\D/g, '')); setMessage(''); }} keyboardType="number-pad" secureTextEntry maxLength={8} autoFocus />
      {message ? <Text style={styles.error}>{message}</Text> : null}
      <Button label={busy ? 'Checking…' : 'Unlock'} onPress={() => void unlock()} disabled={busy} />
    </View>
    <Text style={styles.hint}>To remove the PIN, unlock the app, then go to You → Local app lock.</Text>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  mark: { width: 66, height: 66, borderRadius: 33, backgroundColor: colors.pine, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { color: colors.ink, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  detail: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8, maxWidth: 310 },
  form: { width: '100%', maxWidth: 360, marginTop: 26 },
  error: { color: colors.danger, fontSize: 11, lineHeight: 16, marginBottom: 8 },
  hint: { color: colors.faint, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 18, maxWidth: 310 }
});
