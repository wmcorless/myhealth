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
  Linking,
} from 'react-native';
import DeviceStatusBadge from '../components/DeviceStatusBadge';
import { useHealth } from '../context/HealthContext';
import { useTreadmill } from '../context/TreadmillContext';

export default function DevicesScreen() {
  const { devices, connectSamsungHealth } = useHealth();
  const { connectionState, startScan } = useTreadmill();
  const [connectingSamsung, setConnectingSamsung] = useState(false);

  const treadmillConnected = connectionState === 'connected';
  const samsungConnected = devices.find((d) => d.id === 'samsung_health')?.connected ?? false;

  async function handleConnectSamsung() {
    setConnectingSamsung(true);
    const ok = await connectSamsungHealth();
    setConnectingSamsung(false);
    if (!ok) {
      Alert.alert(
        'Permission needed',
        'Could not get Health Connect permissions. You can also grant them manually in the Health Connect app under App permissions → MyHealth.',
        [
          { text: 'Open Health Connect', onPress: () => Linking.openURL('healthconnect://') },
          { text: 'OK' },
        ],
      );
    }
  }

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

        {/* Always show status + always-tappable button */}
        {samsungConnected && (
          <View style={styles.connectedRow}>
            <View style={styles.connectedDot} />
            <Text style={styles.connectedText}>Samsung Health Connected</Text>
          </View>
        )}

        <TouchableOpacity
          style={samsungConnected ? styles.buttonSecondary : styles.button}
          onPress={handleConnectSamsung}
          disabled={connectingSamsung}
        >
          {connectingSamsung ? (
            <ActivityIndicator color={samsungConnected ? '#666' : '#fff'} />
          ) : (
            <Text style={samsungConnected ? styles.buttonSecondaryText : styles.buttonText}>
              {samsungConnected ? 'Re-grant Permissions' : 'Connect Samsung Health'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>No data showing?</Text>
          <Text style={styles.infoText}>
            1. Tap the button above to grant permissions{'\n'}
            2. Open Samsung Health → ☰ → Settings → Connected services → Health Connect{'\n'}
            3. Turn on Heart Rate, Steps, Distance, and Calories{'\n'}
            4. Pull down to refresh on the Dashboard
          </Text>
        </View>
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
  connectedRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  connectedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#43A047', marginRight: 8 },
  connectedText: { fontSize: 14, color: '#43A047', fontWeight: '600' },
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
    marginTop: 4,
  },
  buttonSecondaryText: { color: '#666', fontWeight: '600', fontSize: 16 },
  infoBox: {
    backgroundColor: '#EEF6FF',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#1E88E5', marginBottom: 6 },
  infoText: { fontSize: 13, color: '#444', lineHeight: 20 },
});
