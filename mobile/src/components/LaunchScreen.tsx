import { themedStyles } from '../theme';
import React from 'react';
import { Image, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, isDarkTheme } from '../theme';

/** A short React launch screen used while local diary and lock state hydrate. */
export function LaunchScreen() {
  return <SafeAreaView style={styles.root}><StatusBar barStyle={isDarkTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.paper} /><View style={styles.logoShell}><Image source={require('../../assets/weed-fitness-icon.png')} style={styles.logo} /></View><Text style={styles.title}>Weed Fitness</Text><Text style={styles.subtitle}>Preparing your private diary</Text><View style={styles.progressTrack}><View style={styles.progressMark} /></View></SafeAreaView>;
}

const styles = themedStyles(() => ({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, paddingBottom: 44 },
  logoShell: { width: 104, height: 104, borderRadius: 31, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', marginBottom: 22, shadowColor: colors.ink, shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  logo: { width: 82, height: 82, borderRadius: 23 },
  title: { color: colors.ink, fontFamily: 'serif', fontSize: 28, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 11, marginTop: 7 },
  progressTrack: { width: 92, height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: colors.paperDeep, marginTop: 20 },
  progressMark: { width: 38, height: 4, borderRadius: 2, backgroundColor: colors.coral }
}));
