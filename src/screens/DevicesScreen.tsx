import React, { useState, useEffect, useRef } from 'react';
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
  AppState,
} from 'react-native';
import DeviceStatusBadge from '../components/DeviceStatusBadge';
import { useHealth } from '../context/HealthContext';
import { openHealthConnectInstallPage, openHealthConnectSettings } from '../services/healthConnectService';

export default function DevicesScreen() {
  const { devices, connectSamsungHealth, refreshDeviceStatus, refresh } = useHealth();
  const [connecting, setConnecting] = useState(false);
  const appState = useRef(AppState.currentState);
  const waitingForReturn = useRef(false);

  const samsungConnected = devices.find((d) => d.id === 'samsung_health')?.connected ?? false;
  const isIOS = Platform.OS === 'ios';

  // When user returns from Health Connect, re-check permissions and refresh data.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      if (next === 'active' && appState.current !== 'active' && waitingForReturn.current) {
        waitingForReturn.current = false;
        await refreshDeviceStatus();
        refresh();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [refreshDeviceStatus, refresh]);

  async function handleConnect() {
    setConnecting(true);
    const ok = await connectSamsungHealth();
    setConnecting(false);
    if (!ok) {
      if (isIOS) {
        Alert.alert(
          'Apple Health Unavailable',
          'Apple Health sync is not available in this build yet.',
          [{ text: 'OK' }],
        );
      } else {
        Alert.alert(
          'Could Not Connect Health Connect',
          'Open Health Connect and grant MyHealth permissions. If Health Connect is missing or outdated, update it from the Play Store. Also use an EAS/dev build (not Expo Go).',
          [
            { text: 'Open Health Connect', onPress: () => openHealthConnectSettings().catch(() => {}) },
            { text: 'Open Play Store', onPress: () => openHealthConnectInstallPage().catch(() => {}) },
            { text: 'OK' },
          ],
        );
      }
    } else {
      // User is now in Health Connect — detect when they return.
      waitingForReturn.current = true;
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

        <Text style={styles.sectionTitle}>
          {isIOS ? 'Apple Health' : 'Samsung Health'}
        </Text>
        <Text style={styles.description}>
          {isIOS
            ? 'Grant access to Apple HealthKit to sync heart rate, steps, distance, and workouts.'
            : 'Grant access to Android Health Connect to sync steps, heart rate, calories, and blood glucose from your Samsung devices.'}
        </Text>

        {samsungConnected && (
          <View style={styles.connectedRow}>
            <View style={styles.connectedDot} />
            <Text style={styles.connectedText}>{isIOS ? 'Apple Health Connected' : 'Samsung Health Connected'}</Text>
          </View>
        )}

        <TouchableOpacity
          style={samsungConnected ? styles.buttonSecondary : styles.button}
          onPress={handleConnect}
          disabled={connecting}
        >
          {connecting ? (
            <ActivityIndicator color={samsungConnected ? '#666' : '#fff'} />
          ) : (
            <Text style={samsungConnected ? styles.buttonSecondaryText : styles.buttonText}>
              {samsungConnected ? 'Re-grant Permissions' : isIOS ? 'Connect Apple Health' : 'Connect Samsung Health'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>No data showing?</Text>
          <Text style={styles.infoText}>
            {isIOS
              ? `1. Tap Connect Apple Health above\n2. Grant requested Health permissions\n3. Confirm MyHealth is enabled in iOS Settings → Health → Data Access & Devices\n4. Return to the Dashboard — data loads automatically`
              : `1. Tap Connect Samsung Health above — a Health Connect dialog will appear\n2. Grant all requested permissions\n3. Also enable Blood Glucose in Samsung Health → ☰ → Settings → Health Connect\n4. Return to the Dashboard — data loads automatically`}
          </Text>
        </View>

        {!isIOS && (
          <>
            <View style={styles.separator} />

            <Text style={styles.sectionTitle}>Dexcom G7 (Blood Glucose)</Text>
            <Text style={styles.description}>
              Your Dexcom G7 readings flow in automatically — no separate login needed.
            </Text>
            <View style={[styles.infoBox, { backgroundColor: '#F3F9F3' }]}>
              <Text style={[styles.infoTitle, { color: '#388E3C' }]}>How it works</Text>
              <Text style={styles.infoText}>
                Dexcom app → Samsung Health → Health Connect → MyHealth{'\n\n'}
                To enable: Samsung Health → ☰ → Settings → Connected services → Health Connect → enable <Text style={{ fontWeight: '700' }}>Blood Glucose</Text>
              </Text>
            </View>
          </>
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


