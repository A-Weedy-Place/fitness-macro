import { themedStyles } from '../theme';
import React, { useState } from 'react';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { Button, Card } from './ui';
import { version as codeVersion } from '../../package.json';

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'The update service could not be reached. Check your connection and try again.';
}

export function AppUpdatePanel({ beforeRestart }: { beforeRestart?: () => Promise<void> }) {
  const updateState = Updates.useUpdates();
  const [message, setMessage] = useState('Automatic update checks run when Weed Fitness starts.');
  const [working, setWorking] = useState(false);

  const version = Application.nativeApplicationVersion || 'development';
  const build = Application.nativeBuildVersion;
  const channel = Updates.channel || (__DEV__ ? 'development' : 'not configured');
  const canCheck = Updates.isEnabled && !__DEV__;
  const busy = working || updateState.isChecking || updateState.isDownloading || updateState.isRestarting;
  const progress = updateState.downloadProgress == null ? null : Math.round(updateState.downloadProgress * 100);

  let status = message;
  if (!canCheck) status = 'Update checks are available in installed preview and production builds, not Expo Go.';
  if (updateState.isChecking) status = `Checking the ${channel} channel for a compatible update…`;
  if (updateState.isDownloading) status = `Downloading the update${progress == null ? '…' : ` · ${progress}%`}`;
  if (updateState.checkError) status = errorMessage(updateState.checkError);
  if (updateState.downloadError) status = errorMessage(updateState.downloadError);
  if (updateState.isUpdatePending) status = 'A new update is downloaded and ready to install.';

  async function checkNow() {
    if (!canCheck) {
      setMessage('Install the release APK to test updates. Expo Go and development mode cannot use this updater.');
      return;
    }

    setWorking(true);
    setMessage('Checking for updates…');
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setMessage('You already have the newest compatible update.');
        return;
      }

      setMessage('Update found. Downloading…');
      const fetched = await Updates.fetchUpdateAsync();
      if (!fetched.isNew) {
        setMessage('The newest compatible update is already installed.');
        return;
      }

      setMessage('Update downloaded and ready.');
      Alert.alert(
        'Update ready',
        'Restart Weed Fitness now to apply it? Your local diary stays on this phone.',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Restart now', onPress: () => void applyUpdate() }
        ]
      );
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setWorking(false);
    }
  }

  async function applyUpdate() {
    try {
      setWorking(true);
      setMessage('Waiting for pending changes to finish saving…');
      await beforeRestart?.();
      setMessage('Restarting into the new update…');
      await Updates.reloadAsync();
    } catch (error) {
      setWorking(false);
      Alert.alert('Could not restart', errorMessage(error));
    }
  }

  return (
    <Card>
      <View style={styles.versionRow}>
        <View style={styles.versionCopy}>
          <Text style={styles.version}>Weed Fitness v{codeVersion}</Text>
          <Text style={styles.meta}>APK {version}{build ? ` (${build})` : ''} · runtime {Updates.runtimeVersion || 'development'}</Text>
          <Text style={styles.meta}>CHANNEL · {channel.toUpperCase()}</Text>
        </View>
        <View style={[styles.statusDot, updateState.isUpdatePending && styles.statusDotReady]} />
      </View>
      <Text style={styles.detail}>{status}</Text>
      {updateState.lastCheckForUpdateTimeSinceRestart ? (
        <Text style={styles.checked}>Last checked {updateState.lastCheckForUpdateTimeSinceRestart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
      ) : null}
      <Button
        label={updateState.isRestarting
          ? 'Restarting…'
          : updateState.isUpdatePending
            ? 'Restart and apply update'
            : updateState.isDownloading
              ? `Downloading${progress == null ? '…' : ` · ${progress}%`}`
              : updateState.isChecking || working
                ? 'Checking…'
                : 'Check for updates'}
        tone={updateState.isUpdatePending ? 'primary' : 'secondary'}
        disabled={busy}
        onPress={() => updateState.isUpdatePending ? void applyUpdate() : void checkNow()}
      />
      <Text style={styles.note}>Only updates compatible with this installed build can be applied. Native changes arrive in a new APK release.</Text>
    </Card>
  );
}

const styles = themedStyles(() => ({
  versionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  versionCopy: { flex: 1 },
  version: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  meta: { color: colors.actionText, fontSize: 8.5, fontWeight: '900', letterSpacing: 1.2, marginTop: 4 },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.faint },
  statusDotReady: { backgroundColor: colors.coral },
  detail: { color: colors.muted, fontSize: 11, lineHeight: 17, marginBottom: 5 },
  checked: { color: colors.faint, fontSize: 9, marginBottom: 12 },
  note: { color: colors.faint, fontSize: 9, lineHeight: 14, marginTop: 10 }
}));
