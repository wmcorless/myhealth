import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import MetricCard from '../components/MetricCard';
import DeviceStatusBadge from '../components/DeviceStatusBadge';
import { DeviceStatus } from '../types/health';

const devices: DeviceStatus[] = [
  { id: 'samsung_health', name: 'Samsung Health', connected: false },
  { id: 'ifit', name: 'iFit Treadmill', connected: false },
];

export default function DashboardScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Today</Text>

        <View style={styles.row}>
          <MetricCard label="Heart Rate" value="—" unit="bpm" color="#E53935" />
          <MetricCard label="Steps" value="—" unit="steps" color="#1E88E5" />
        </View>
        <View style={styles.row}>
          <MetricCard label="Distance" value="—" unit="km" color="#43A047" />
          <MetricCard label="Calories" value="—" unit="kcal" color="#FB8C00" />
        </View>
        <View style={styles.row}>
          <MetricCard label="Active Time" value="—" unit="min" color="#8E24AA" />
          <MetricCard label="Resting HR" value="—" unit="bpm" color="#E53935" />
        </View>

        <Text style={styles.sectionTitle}>Devices</Text>
        {devices.map((d) => (
          <DeviceStatusBadge key={d.id} device={d} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6FA' },
  scroll: { flex: 1 },
  content: { padding: 16 },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
});
