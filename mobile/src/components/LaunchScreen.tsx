import React, { useEffect, useRef } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Animated, Easing, Image, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, isDarkTheme } from '../theme';

/** A short React launch screen used while local diary and lock state hydrate. */
export function LaunchScreen() {
  const rotation = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const spin = Animated.loop(Animated.timing(rotation, { toValue: 1, duration: 2_800, easing: Easing.linear, useNativeDriver: true }));
    const breathe = Animated.loop(Animated.sequence([Animated.timing(glow, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(glow, { toValue: 0.42, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true })]));
    spin.start(); breathe.start();
    return () => { spin.stop(); breathe.stop(); };
  }, [glow, rotation]);
  const turn = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return <SafeAreaView style={styles.root}><StatusBar barStyle={isDarkTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.paper} /><View style={styles.orbit}><Animated.View style={[styles.leaf, { opacity: glow, transform: [{ rotate: turn }] }]}><Ionicons name="leaf" size={42} color={colors.coral} /></Animated.View><View style={styles.logoShell}><Image source={require('../../assets/weed-fitness-icon.png')} style={styles.logo} /></View></View><Text style={styles.title}>Weed Fitness</Text><Text style={styles.subtitle}>Preparing your private diary</Text><View style={styles.dots}><Animated.View style={[styles.dot, { opacity: glow }]} /><View style={styles.dot} /><View style={[styles.dot, { opacity: glow }]} /></View></SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, paddingBottom: 44 }, orbit: { width: 142, height: 142, alignItems: 'center', justifyContent: 'center', marginBottom: 22 }, leaf: { position: 'absolute', width: 142, height: 142, alignItems: 'flex-end', justifyContent: 'center' }, logoShell: { width: 98, height: 98, borderRadius: 30, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', shadowColor: colors.ink, shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 }, logo: { width: 78, height: 78, borderRadius: 22 }, title: { color: colors.ink, fontFamily: 'serif', fontSize: 28, fontWeight: '900' }, subtitle: { color: colors.muted, fontSize: 11, marginTop: 7 }, dots: { flexDirection: 'row', gap: 7, marginTop: 18 }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.pine }
});
