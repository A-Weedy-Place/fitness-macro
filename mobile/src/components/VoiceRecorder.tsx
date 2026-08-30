import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { Button } from './ui';
import { colors } from '../theme';

export function VoiceRecorder({ onRecorded }: { onRecorded: (uri: string) => Promise<void> }) {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'cache', isMeteringEnabled: true, android: { ...RecordingPresets.HIGH_QUALITY.android, audioSource: 'voice_recognition' } });
  const recorderState = useAudioRecorderState(recorder, 80);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [levels, setLevels] = useState<number[]>(Array(22).fill(0));

  useEffect(() => {
    if (!recorderState.isRecording) { setLevels(Array(22).fill(0)); return; }
    const db = typeof recorderState.metering === 'number' ? recorderState.metering : -90;
    const level = db < -48 ? 0 : Math.min(1, Math.max(0, (db + 48) / 42));
    setLevels((current) => [...current.slice(1), level]);
  }, [recorderState.isRecording, recorderState.metering]);

  async function start() {
    setError('');
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) return Alert.alert('Microphone permission needed', 'Allow microphone access to dictate a food entry.');
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not start the microphone.'); }
  }

  async function stop() {
    await recorder.stop();
    const uri = recorder.uri || recorderState.url;
    await setAudioModeAsync({ allowsRecording: false });
    if (!uri) return Alert.alert('Recording failed', 'No audio file was created.');
    setProcessing(true);
    try {
      await onRecorded(uri);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Speech could not be processed.');
    } finally {
      setProcessing(false);
    }
  }

  const seconds = Math.max(0, Math.round(recorderState.durationMillis / 1000));
  return (
    <View style={styles.container}>
      <View style={styles.visual}>{processing ? <ActivityIndicator color={colors.coral} size="small" /> : levels.map((level, index) => <View key={index} style={[styles.bar, { height: level === 0 ? 2 : 3 + level * 31 }]} />)}</View>
      <Text style={styles.status}>{processing ? 'Processing speech and matching foods on your PC...' : recorderState.isRecording ? `Listening · ${seconds}s · speak normally` : 'Tap record, describe your food, then confirm the transcript.'}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={processing ? 'Processing...' : recorderState.isRecording ? 'Stop and transcribe' : 'Record food'} onPress={() => void (recorderState.isRecording ? stop() : start())} disabled={processing} tone={recorderState.isRecording ? 'danger' : 'secondary'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.paper, borderRadius: 17, padding: 13, marginBottom: 11 },
  visual: { height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  bar: { width: 3, height: 2, borderRadius: 2, backgroundColor: colors.coral },
  status: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginBottom: 8 },
  error: { color: colors.danger, backgroundColor: colors.coralSoft, borderRadius: 10, padding: 8, fontSize: 9, lineHeight: 14, marginBottom: 8 }
});
