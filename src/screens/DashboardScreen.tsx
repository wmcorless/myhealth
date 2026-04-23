import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MetricCard from '../components/MetricCard';
import DeviceStatusBadge from '../components/DeviceStatusBadge';
import Logo from '../components/Logo';
import { useHealth } from '../context/HealthContext';
import { usePreferences } from '../context/PreferencesContext';
import { useWatchHR } from '../context/WatchHRContext';

const POLL_INTERVAL_MS = 60_000;

function fmt(val: number | undefined, decimals = 0): string {
  if (val === undefined || val === 0) return '—';
  return val.toFixed(decimals);
}

export default function DashboardScreen() {
  const { summary, devices, loading, refresh } = useHealth();
  const { preferences } = usePreferences();
  const { liveHR, status: watchStatus } = useWatchHR();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }, [refresh])
  );

  const distanceValue = summary?.totalDistanceMeters
    ? preferences.distanceUnit === 'miles'
      ? summary.totalDistanceMeters / 1609.344
      : summary.totalDistanceMeters / 1000
    : undefined;
  const distanceUnit = preferences.distanceUnit === 'miles' ? 'mi' : 'km';

  const glucoseValue = summary?.latestBloodGlucose
    ? preferences.glucoseUnit === 'mmoll'
      ? summary.latestBloodGlucose.mgPerDl / 18.016
      : summary.latestBloodGlucose.mgPerDl
    : undefined;
  const glucoseUnit = preferences.glucoseUnit === 'mmoll' ? 'mmol/L' : 'mg/dL';

  const latestHR = liveHR ?? summary?.avgHeartRate;
  const isLiveHR = watchStatus === 'connected' && liveHR != null;

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
          <MetricCard label={isLiveHR ? 'Heart Rate 🔴' : 'Heart Rate'} value={fmt(latestHR)} unit="bpm" color="#E53935" />
          <MetricCard label="Steps" value={fmt(summary?.steps)} unit="steps" color="#1E88E5" />
        </View>
        <View style={styles.row}>
          <MetricCard label="Distance" value={fmt(distanceValue, 2)} unit={distanceUnit} color="#43A047" />
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
        <View style={styles.row}>
          <MetricCard
            label="Blood Glucose"
            value={glucoseValue !== undefined ? fmt(glucoseValue, preferences.glucoseUnit === 'mmoll' ? 1 : 0) : '—'}
            unit={glucoseUnit}
            color="#00ACC1"
          />
          <MetricCard label="" value="" color="transparent" />
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
