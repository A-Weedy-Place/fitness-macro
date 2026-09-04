import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';

interface Props {
  children: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

/** Last-resort release guard. A bad row or screen should produce a readable,
 * recoverable report instead of making Android repeatedly terminate the app. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    try {
      this.props.onError?.(error, info);
    } catch {
      // Diagnostics are optional; the recovery screen must always win.
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    const detail = this.state.error.message || this.state.error.name || 'Unknown startup error';
    return (
      <View style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor="#F7F1E7" />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.mark} />
          <Text style={styles.title}>Weed Fitness stayed open</Text>
          <Text style={styles.body}>A screen could not load, but your diary has not been deleted. Take a screenshot of the code below so the test build can be corrected.</Text>
          <Text style={styles.codeLabel}>WF means Weed Fitness. RENDER means a screen failed to draw.</Text>
          <View style={styles.codeBox}><Text selectable style={styles.code}>WF-RENDER · {detail.slice(0, 500)}</Text></View>
          <Pressable style={styles.button} onPress={() => this.setState({ error: null })}><Text style={styles.buttonText}>Try opening again</Text></Pressable>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F1E7' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  mark: { width: 34, height: 6, borderRadius: 3, backgroundColor: '#E66B50', marginBottom: 18 },
  title: { color: '#1D2C25', fontSize: 25, lineHeight: 31, fontWeight: '900', marginBottom: 10 },
  body: { color: '#6F746A', fontSize: 14, lineHeight: 21, marginBottom: 18 },
  codeLabel: { color: '#6F746A', fontSize: 10, lineHeight: 15, marginBottom: 7 },
  codeBox: { borderWidth: 1, borderColor: '#DED3C2', backgroundColor: '#FFFDF8', borderRadius: 14, padding: 13, marginBottom: 18 },
  code: { color: '#1D2C25', fontSize: 11, lineHeight: 17 },
  button: { minHeight: 46, borderRadius: 14, backgroundColor: '#173F2D', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' }
});
