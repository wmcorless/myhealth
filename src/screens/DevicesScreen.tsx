import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import DeviceStatusBadge from '../components/DeviceStatusBadge';
import { useHealth } from '../context/HealthContext';

export default function DevicesScreen() {
  const { devices, connectiFit, disconnectiFit } = useHealth();
  const [connecting, setConnecting] = useState(false);

  const iFitDevice = devices.find((d) => d.id === 'ifit');

  async function handleiFitToggle() {
    if (iFitDevice?.connected) {
      Alert.alert('Disconnect iFit', 'Are you sure you want to disconnect iFit?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: disconnectiFit,
        },
      ]);
    } else {
      setConnecting(true);
      const ok = await connectiFit();
      setConnecting(false);
      if (!ok) {
        Alert.alert(
          'Connection failed',
          'Could not connect to iFit. Make sure your iFit credentials are configured in .env and try again.'
        );
      }
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.heading}>Devices</Text>
        <Text style={styles.sub}>Manage your connected health sources.</Text>

        {devices.map((d) => (
          <DeviceStatusBadge key={d.id} device={d} />
        ))}

        <View style={styles.separator} />

        <Text style={styles.sectionTitle}>iFit Treadmill</Text>
        <Text style={styles.description}>
          Connect your iFit account to sync treadmill workouts, distance, and heart rate
          automatically after each session.
        </Text>

        <TouchableOpacity
          style={[styles.button, iFitDevice?.connected && styles.buttonDanger]}
          onPress={handleiFitToggle}
          disabled={connecting}
        >
          {connecting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {iFitDevice?.connected ? 'Disconnect iFit' : 'Connect iFit Account'}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionTitle} style={{ marginTop: 24 }}>
          Samsung Health / Apple Health
        </Text>
        <Text style={styles.description}>
          Health data from your Samsung watch and Galaxy devices syncs automatically via
          Android Health Connect (Android) or Apple HealthKit (iOS). Grant permissions when
          prompted on first launch.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6FA' },
  content: { flex: 1, padding: 16 },
  heading: { fontSize: 28, fontWeight: '700', color: '#111', marginBottom: 4 },
  sub: { fontSize: 14, color: '#888', marginBottom: 20 },
  separator: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 6 },
  description: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 14 },
  button: {
    backgroundColor: '#E53935',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDanger: { backgroundColor: '#888' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
