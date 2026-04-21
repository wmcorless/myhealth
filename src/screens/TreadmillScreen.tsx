import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  ScrollView,
} from 'react-native';
import { useTreadmill } from '../context/TreadmillContext';

function pad(n: number) {
  return String(Math.floor(n)).padStart(2, '0');
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function MetricTile({ label, value, unit, large }: { label: string; value: string; unit?: string; large?: boolean }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, large && styles.tileValueLarge]}>{value}</Text>
      {unit && <Text style={styles.tileUnit}>{unit}</Text>}
    </View>
  );
}

export default function TreadmillScreen() {
  const { connectionState, foundDevices, data, errorMessage, startScan, connect, disconnect, stopScan } = useTreadmill();

  if (connectionState === 'connected' && data) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.heading}>Live Workout</Text>
          <View style={styles.statusRow}>
            <View style={styles.dot} />
            <Text style={styles.statusText}>NordicTrack Connected</Text>
          </View>

          <MetricTile
            label="Speed"
            value={data.speedKph.toFixed(1)}
            unit="km/h"
            large
          />

          <View style={styles.row}>
            <MetricTile label="Incline" value={data.inclinePercent.toFixed(1)} unit="%" />
            <MetricTile label="Distance" value={(data.distanceMeters / 1000).toFixed(2)} unit="km" />
          </View>
          <View style={styles.row}>
            <MetricTile
              label="Heart Rate"
              value={data.heartRate !== undefined ? String(data.heartRate) : '—'}
              unit="bpm"
            />
            <MetricTile
              label="Calories"
              value={data.calories !== undefined ? String(data.calories) : '—'}
              unit="kcal"
            />
          </View>
          <MetricTile label="Elapsed" value={formatTime(data.elapsedSeconds)} />

          <TouchableOpacity style={styles.buttonSecondary} onPress={disconnect}>
            <Text style={styles.buttonSecondaryText}>Disconnect</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (connectionState === 'connected') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#E53935" />
          <Text style={styles.statusText}>Waiting for treadmill data…</Text>
          <Text style={styles.hint}>Start a workout on the treadmill to see live stats.</Text>
          <TouchableOpacity style={[styles.button, { marginTop: 24 }]} onPress={disconnect}>
            <Text style={styles.buttonText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (connectionState === 'connecting') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#E53935" />
          <Text style={styles.statusText}>Connecting…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (connectionState === 'scanning') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <Text style={styles.heading}>Find Treadmill</Text>
          <View style={styles.scanRow}>
            <ActivityIndicator color="#E53935" />
            <Text style={styles.scanText}>Scanning for NordicTrack…</Text>
          </View>
          <Text style={styles.hint}>Make sure the treadmill is powered on.</Text>

          {foundDevices.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Found Devices</Text>
              <FlatList
                data={foundDevices}
                keyExtractor={(d) => d.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.deviceRow} onPress={() => connect(item.id)}>
                    <Text style={styles.deviceName}>{item.name}</Text>
                    <Text style={styles.deviceConnect}>Connect →</Text>
                  </TouchableOpacity>
                )}
              />
            </>
          )}

          <TouchableOpacity style={styles.buttonSecondary} onPress={stopScan}>
            <Text style={styles.buttonSecondaryText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.centered}>
        <Text style={styles.heading}>Treadmill</Text>
        <Text style={styles.hint}>
          Connect to your NordicTrack over Bluetooth to see live speed, incline, distance, and heart rate during your workout.
        </Text>

        {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

        <TouchableOpacity style={styles.button} onPress={startScan}>
          <Text style={styles.buttonText}>Scan for NordicTrack</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6FA' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 28, fontWeight: '700', color: '#111', marginBottom: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#43A047', marginRight: 8 },
  statusText: { fontSize: 16, color: '#43A047', fontWeight: '600', marginTop: 12 },
  scanRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  scanText: { fontSize: 15, color: '#555' },
  hint: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20, marginTop: 8, marginBottom: 20 },
  error: { color: '#E53935', fontSize: 14, marginBottom: 16, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginTop: 16, marginBottom: 8 },
  deviceRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceName: { fontSize: 15, color: '#111', fontWeight: '500' },
  deviceConnect: { fontSize: 14, color: '#E53935', fontWeight: '600' },
  row: { flexDirection: 'row', marginBottom: 4 },
  tile: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    margin: 4,
    alignItems: 'center',
  },
  tileLabel: { fontSize: 12, color: '#888', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  tileValue: { fontSize: 32, fontWeight: '700', color: '#111' },
  tileValueLarge: { fontSize: 56 },
  tileUnit: { fontSize: 14, color: '#888', marginTop: 2 },
  button: {
    backgroundColor: '#E53935',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 8,
    width: '100%',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  buttonSecondary: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    marginTop: 16,
  },
  buttonSecondaryText: { color: '#666', fontWeight: '600', fontSize: 16 },
});
