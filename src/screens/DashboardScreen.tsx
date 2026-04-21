import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import MetricCard from '../components/MetricCard';
import DeviceStatusBadge from '../components/DeviceStatusBadge';
import Logo from '../components/Logo';
import { useHealth } from '../context/HealthContext';

function fmt(val: number | undefined, decimals = 0): string {
  if (val === undefined || val === 0) return '—';
  return val.toFixed(decimals);
}

export default function DashboardScreen() {
  const { summary, devices, loading, refresh } = useHealth();

  const distanceKm = summary?.totalDistanceMeters
    ? summary.totalDistanceMeters / 1000
    : undefined;

  const latestHR = summary?.avgHeartRate;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        <Logo size={56} />
        <Text style={styles.heading}>Today</Text>

        {loading && !summary && (
          <ActivityIndicator color="#E53935" style={{ marginVertical: 24 }} />
        )}

        <View style={styles.row}>
          <MetricCard label="Heart Rate" value={fmt(latestHR)} unit="bpm" color="#E53935" />
          <MetricCard label="Steps" value={fmt(summary?.steps)} unit="steps" color="#1E88E5" />
        </View>
        <View style={styles.row}>
          <MetricCard label="Distance" value={fmt(distanceKm, 2)} unit="km" color="#43A047" />
          <MetricCard label="Calories" value={fmt(summary?.caloriesBurned)} unit="kcal" color="#FB8C00" />
        </View>
        <View style={styles.row}>
          <MetricCard
            label="Workouts"
            value={summary?.workouts.length ?? '—'}
            color="#8E24AA"
          />
          <MetricCard
            label="Resting HR"
            value={fmt(summary?.restingHeartRate)}
            unit="bpm"
            color="#E53935"
          />
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
  heading: { fontSize: 28, fontWeight: '700', color: '#111', marginBottom: 12, marginTop: 8 },
  row: { flexDirection: 'row', marginBottom: 4 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
});
