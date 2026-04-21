import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface State { error: Error | null }

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => this.setState({ error: null })}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#F5F6FA' },
  title: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 12 },
  message: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  button: { backgroundColor: '#E53935', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
