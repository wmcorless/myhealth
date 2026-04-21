import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import DeviceStatusBadge from '../components/DeviceStatusBadge';
import { useHealth } from '../context/HealthContext';
import { useTreadmill } from '../context/TreadmillContext';

export default function DevicesScreen() {
  const { devices, connectSamsungHealth } = useHealth();
  const { connectionState, startScan } = useTreadmill();
  const [connectingSamsung, setConnectingSamsung] = useState(false);

  const treadmillConnected = connectionState === 'connected';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Devices</Text>
        <Text style={styles.sub}>Manage your connected health sources.</Text>

        {devices.map((d) => (
          <DeviceStatusBadge key={d.id} device={d} />
        ))}

        <View style={styles.separator} />

        {/* NordicTrack BLE section */}
        <Text style={styles.sectionTitle}>NordicTrack Treadmill</Text>
        <Text style={styles.description}>
          Connect directly to your NordicTrack over Bluetooth for live speed, incline,
          distance, and heart rate during your workout. No account required.
        </Text>

        {treadmillConnected ? (
          <TouchableOpacity style={styles.buttonSecondary} disabled>
            <Text style={styles.buttonSecondaryText}>✓ NordicTrack Connected</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.button} onPress={startScan}>
            <Text style={styles.buttonText}>Connect NordicTrack</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.hint}>
          Make sure your treadmill is powered on, then tap Connect. Use the Treadmill tab to see live stats.
        </Text>

        <View style={styles.separator} />

        {/* Samsung / Apple Health section */}
        <Text style={styles.sectionTitle}>
          {Platform.OS === 'ios' ? 'Apple Health' : 'Samsung Health'}
        </Text>
        <Text style={styles.description}>
          {Platform.OS === 'ios'
            ? 'Grant access to Apple HealthKit to sync heart rate, steps, distance, and workouts.'
            : 'Grant access to Android Health Connect to sync data from your Samsung watch and Galaxy devices.'}
        </Text>
        {devices.find((d) => d.id === 'samsung_health')?.connected ? (
          <TouchableOpacity style={styles.buttonSecondary} disabled>
            <Text style={styles.buttonSecondaryText}>
              ✓ {Platform.OS === 'ios' ? 'Apple Health' : 'Samsung Health'} Connected
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.button}
            onPress={async () => {
              setConnectingSamsung(true);
              const ok = await connectSamsungHealth();
              setConnectingSamsung(false);
              if (!ok)
                Alert.alert(
                  'Not available',
                  'Health Connect is not available on this device. Make sure the Health Connect app is installed from Google Play.',
                );
            }}
            disabled={connectingSamsung}
          >
            {connectingSamsung ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                Connect {Platform.OS === 'ios' ? 'Apple Health' : 'Samsung Health'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6FA' },
  content: { padding: 16, paddingBottom: 40 },
  heading: { fontSize: 28, fontWeight: '700', color: '#111', marginBottom: 4 },
  sub: { fontSize: 14, color: '#888', marginBottom: 20 },
  separator: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 6 },
  description: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 14 },
  hint: { fontSize: 12, color: '#aaa', lineHeight: 18, marginTop: 10 },
  button: {
    backgroundColor: '#E53935',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  buttonSecondary: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  buttonSecondaryText: { color: '#666', fontWeight: '600', fontSize: 16 },
});
