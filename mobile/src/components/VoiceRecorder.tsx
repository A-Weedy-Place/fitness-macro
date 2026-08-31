import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { colors } from '../theme';

export function VoiceRecorder({ onRecorded, disabled = false }: { onRecorded: (uri: string) => Promise<void>; disabled?: boolean }) {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'cache', android: { ...RecordingPresets.HIGH_QUALITY.android, audioSource: 'voice_recognition' } });
  const recorderState = useAudioRecorderState(recorder, 120);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

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
    setError('');
    setProcessing(true);
    try {
      await recorder.stop();
      const uri = recorder.uri || recorderState.url;
      await setAudioModeAsync({ allowsRecording: false });
      if (!uri) throw new Error('No audio file was created.');
      await onRecorded(uri);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Speech could not be processed.');
    } finally {
      setProcessing(false);
    }
  }

  const seconds = Math.max(0, Math.round(recorderState.durationMillis / 1000));
  const recording = recorderState.isRecording;
  return <View style={styles.wrap}>
    <Pressable accessibilityRole="button" accessibilityLabel={recording ? 'Stop recording and transcribe' : 'Record and transcribe'} disabled={disabled || processing} onPress={() => void (recording ? stop() : start())} style={[styles.button, recording && styles.recording, (disabled || processing) && styles.disabled]}>
      {processing ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name={recording ? 'stop' : 'mic'} size={18} color={colors.white} />}
    </Pressable>
    {recording ? <Text style={styles.timer}>{seconds}s</Text> : null}
    {error ? <Text style={styles.error} numberOfLines={2}>{error}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'flex-start', gap: 3 },
  button: { width: 43, height: 43, borderRadius: 15, backgroundColor: colors.pine, alignItems: 'center', justifyContent: 'center' },
  recording: { backgroundColor: colors.coral },
  disabled: { opacity: 0.45 },
  timer: { color: colors.coral, fontSize: 8, fontWeight: '900' },
  error: { position: 'absolute', top: 47, width: 150, color: colors.danger, fontSize: 8, lineHeight: 11, textAlign: 'center' }
});
