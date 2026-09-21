import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { colors, themedStyles } from '../theme';
import { hasGroqKey, saveGroqKey, removeGroqKey, checkSavedGroqKey } from '../services/groqKey';
import { AiError } from '../services/ai/groqTransport';
import { useAndroidBack } from '../hooks/useAndroidBack';

export function ApiKeySettings({ onChanged }: { onChanged: () => void }) {
  const [draft, setDraft] = useState(''); const [visible, setVisible] = useState(false);
  const [saved, setSaved] = useState<boolean | null>(null); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  const inFlight = useRef(false); const mounted = useRef(true);
  useAndroidBack(() => busy, 20);
  useEffect(() => {
    mounted.current = true;
    void hasGroqKey().then((value) => { if (mounted.current) setSaved(value); }).catch(() => { if (mounted.current) setNotice('Secure key storage is unavailable. Unlock the phone and try again.'); });
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') { setDraft(''); setVisible(false); } });
    return () => { mounted.current = false; subscription.remove(); };
  }, []);
  async function run(action: 'save' | 'check' | 'remove') {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setNotice('');
    try {
      if (action === 'save') await saveGroqKey(draft);
      else if (action === 'remove') await removeGroqKey();
      else await checkSavedGroqKey();
      const exists = await hasGroqKey();
      if (mounted.current) { setSaved(exists); setDraft(''); setVisible(false); setNotice(action === 'remove' ? 'Key removed. AI is off; manual logging still works.' : action === 'save' ? 'Key checked and saved securely on this phone.' : 'Groq accepted your saved key.'); }
      onChanged();
    } catch (error) { if (mounted.current) setNotice(error instanceof AiError ? error.message : 'The key could not be updated. Please try again.'); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || disabled }} disabled={busy || disabled} onPress={action} style={({ pressed }) => [styles.button, (pressed || busy || disabled) && styles.dim]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
  return <View style={styles.card}>
    <Text style={styles.heading}>Your Groq API key</Text>
    <Text style={styles.body}>{saved === null ? 'Checking this phone…' : saved ? 'A key is saved on this phone. Its value is never shown again.' : 'No key saved. AI is optional; your diary works without it.'}</Text>
    <Text style={styles.label}>{saved ? 'Replace API key' : 'API key'}</Text>
    <TextInput value={draft} onChangeText={setDraft} editable={!busy} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete="off" importantForAutofill="no" maxLength={244} accessibilityLabel="Groq API key" accessibilityHint="Paste your own key. It is stored securely only on this phone." placeholder="Paste your Groq key" placeholderTextColor={colors.muted} style={styles.input} />
    {button(visible ? 'Hide typed key' : 'Show typed key', () => setVisible(!visible), !draft)}
    {button(busy ? 'Working…' : 'Save & check', () => void run('save'), !draft.trim())}
    {saved ? <View style={styles.actions}>{button('Check saved key', () => void run('check'))}{button('Remove key', () => Alert.alert('Remove your key?', 'AI and transcription will stop until you add a key. Your diary will not be deleted. This removes the local copy, not the key in your Groq account.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => void run('remove') }]))}</View> : null}
    {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
    {button('Get a key from Groq', () => { void Linking.openURL('https://console.groq.com/keys').catch(() => setNotice('Open console.groq.com/keys in your browser.')); })}
    <Text style={styles.body}>Text and relevant diary context go directly to Groq when you use AI; recordings go directly to Groq for transcription. No shared relay or developer key is used.</Text>
    <Text style={styles.body}>GPT-OSS 120B handles reasoning; Whisper Large V3 Turbo handles speech. Save & check only reads the model list, without generating tokens.</Text>
    <Text style={styles.body}>Use a Groq Free account to avoid paid API usage. Limits and billing follow your own account; this app cannot make a paid key free. Your key is excluded from diary backups and diagnostic exports.</Text>
  </View>;
}
const styles = themedStyles(() => ({
  card: { backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: 20, padding: 16, gap: 12, marginBottom: 16 },
  heading: { color: colors.ink, fontSize: 20, fontWeight: '800' }, body: { color: colors.ink, fontSize: 14, lineHeight: 21 }, label: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  input: { color: colors.ink, backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 48, fontSize: 16 },
  button: { backgroundColor: colors.pineSoft, borderRadius: 12, padding: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: colors.actionText, fontSize: 14, fontWeight: '700', textAlign: 'center' }, dim: { opacity: 0.55 },
  actions: { gap: 8 }, notice: { color: colors.ink, fontSize: 14, lineHeight: 21, fontWeight: '600' }
}));
