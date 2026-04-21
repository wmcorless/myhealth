import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useHealth } from '../context/HealthContext';
import { WorkoutSession } from '../types/health';

const WORKOUT_ICONS: Record<WorkoutSession['type'], string> = {
  treadmill: '🏃',
  walk: '🚶',
  run: '🏃',
  other: '💪',
};

function formatDuration(start: Date, end?: Date): string {
  if (!end) return 'In progress';
  const mins = Math.round((end.getTime() - start.getTime()) / 60_000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatDate(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function WorkoutsScreen() {
  const { summary, loading, refresh } = useHealth();

  const workouts = summary?.workouts ?? [];

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={workouts}
        keyExtractor={(w) => w.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} />
        }
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Text style={styles.heading}>Workouts</Text>}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator color="#E53935" style={{ marginTop: 40 }} />
            : <Text style={styles.empty}>No workouts recorded yet.{'\n'}Data syncs from Samsung Health.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.icon}>{WORKOUT_ICONS[item.type] ?? '💪'}</Text>
            <View style={styles.info}>
              <Text style={styles.type}>
                {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
              </Text>
              <Text style={styles.time}>
                {formatDate(item.startTime)}
                {' · '}
                {item.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {' · '}
                {formatDuration(item.startTime, item.endTime)}
              </Text>
            </View>
            <View style={styles.stats}>
              {item.distanceMeters !== undefined && (
                <Text style={styles.stat}>{(item.distanceMeters / 1000).toFixed(2)} km</Text>
              )}
              {item.avgHeartRate !== undefined && (
                <Text style={[styles.stat, { color: '#E53935' }]}>♥ {item.avgHeartRate} bpm</Text>
              )}
              {item.calories !== undefined && (
                <Text style={styles.stat}>{Math.round(item.calories)} kcal</Text>
              )}
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6FA' },
  list: { padding: 16, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  icon: { fontSize: 28, marginRight: 12 },
  info: { flex: 1 },
  type: { fontSize: 16, fontWeight: '600', color: '#222' },
  time: { fontSize: 13, color: '#888', marginTop: 2 },
  stats: { alignItems: 'flex-end' },
  stat: { fontSize: 13, color: '#555', marginBottom: 2 },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 40, lineHeight: 22 },
});


