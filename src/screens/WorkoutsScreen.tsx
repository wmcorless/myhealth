import React from 'react';
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

export default function WorkoutsScreen() {
  const { summary, loading, refresh } = useHealth();
  const workouts = summary?.workouts ?? [];

  return (
    <SafeAreaView style={styles.safe}>
      {loading && !workouts.length ? (
        <ActivityIndicator color="#E53935" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={workouts}
          keyExtractor={(w) => w.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<Text style={styles.heading}>Today's Workouts</Text>}
          ListEmptyComponent={
            <Text style={styles.empty}>No workouts recorded today.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.icon}>{WORKOUT_ICONS[item.type]}</Text>
              <View style={styles.info}>
                <Text style={styles.type}>{item.type.charAt(0).toUpperCase() + item.type.slice(1)}</Text>
                <Text style={styles.time}>
                  {item.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' · '}
                  {formatDuration(item.startTime, item.endTime)}
                </Text>
              </View>
              <View style={styles.stats}>
                {item.distanceMeters !== undefined && (
                  <Text style={styles.stat}>
                    {(item.distanceMeters / 1000).toFixed(2)} km
                  </Text>
                )}
                {item.avgHeartRate !== undefined && (
                  <Text style={[styles.stat, { color: '#E53935' }]}>
                    ♥ {item.avgHeartRate} bpm
                  </Text>
                )}
                {item.calories !== undefined && (
                  <Text style={styles.stat}>{item.calories} kcal</Text>
                )}
              </View>
              <Text style={styles.source}>{item.source}</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6FA' },
  list: { padding: 16 },
  heading: { fontSize: 28, fontWeight: '700', color: '#111', marginBottom: 16 },
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
  stats: { alignItems: 'flex-end', marginRight: 8 },
  stat: { fontSize: 13, color: '#555', marginBottom: 2 },
  source: {
    fontSize: 10,
    color: '#ccc',
    textTransform: 'uppercase',
    position: 'absolute',
    right: 12,
    top: 8,
  },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 40 },
});
