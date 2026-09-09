import { themedStyles } from '../theme';
import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { colors } from '../theme';

export function VoiceRecorder({ onRecorded, disabled = false }: { onRecorded: (uri: string) => Promise<void>; disabled?: boolean }) {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'cache', isMeteringEnabled: true, android: { ...RecordingPresets.HIGH_QUALITY.android, audioSource: 'voice_recognition' } });
  const recorderState = useAudioRecorderState(recorder, 120);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [levels, setLevels] = useState([0.2, 0.35, 0.5, 0.35, 0.2]);

  useEffect(() => {
    if (!recorderState.isRecording) { setLevels([0.2, 0.35, 0.5, 0.35, 0.2]); return; }
    const db = typeof recorderState.metering === 'number' ? recorderState.metering : -80;
    const level = Math.min(1, Math.max(0.08, (db + 55) / 45));
    setLevels((current) => [current[1], current[2], level, current[2], current[1]]);
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
    {recording ? <><View style={styles.wave}>{levels.map((level, index) => <View key={index} style={[styles.waveBar, { height: 4 + level * 18 }]} />)}</View><Text style={styles.timer}>{seconds}s</Text></> : null}
    {error ? <Text style={styles.error} numberOfLines={2}>{error}</Text> : null}
  </View>;
}

const styles = themedStyles(() => ({
  wrap: { alignItems: 'center', justifyContent: 'flex-start', gap: 3, minWidth: 43 },
  button: { width: 43, height: 43, borderRadius: 15, backgroundColor: colors.pine, alignItems: 'center', justifyContent: 'center' },
  recording: { backgroundColor: colors.coral },
  disabled: { opacity: 0.45 },
  timer: { color: colors.coral, fontSize: 8, fontWeight: '900' },
  wave: { height: 22, flexDirection: 'row', alignItems: 'center', gap: 2 },
  waveBar: { width: 2, borderRadius: 2, backgroundColor: colors.pine },
  error: { position: 'absolute', top: 47, width: 150, color: colors.danger, fontSize: 8, lineHeight: 11, textAlign: 'center' }
}));
