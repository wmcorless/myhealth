import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import DeviceStatusBadge from '../components/DeviceStatusBadge';
import { DeviceStatus } from '../types/health';

const devices: DeviceStatus[] = [
  { id: 'samsung_health', name: 'Samsung Health', connected: false },
  { id: 'ifit', name: 'iFit Treadmill', connected: false },
];

export default function DevicesScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.heading}>Devices</Text>
        <Text style={styles.sub}>Connect your health devices to sync data.</Text>

        {devices.map((d) => (
          <DeviceStatusBadge key={d.id} device={d} />
        ))}

        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Add Device</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6FA' },
  content: { flex: 1, padding: 16 },
  heading: { fontSize: 28, fontWeight: '700', color: '#111', marginBottom: 4 },
  sub: { fontSize: 14, color: '#888', marginBottom: 20 },
  button: {
    marginTop: 16,
    backgroundColor: '#E53935',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
