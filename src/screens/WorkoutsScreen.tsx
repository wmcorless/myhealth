import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useHealth } from '../context/HealthContext';
import { getWorkouts, getTreadmillSessions, TreadmillSessionRecord } from '../services/database';
import { WorkoutSession } from '../types/health';

const WORKOUT_ICONS: Record<WorkoutSession['type'], string> = {
  treadmill: '🏃',
  walk: '🚶',
  run: '🏃',
  other: '💪',
};

type Tab = 'workouts' | 'treadmill';

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

function pad(n: number) { return String(Math.floor(n)).padStart(2, '0'); }
function formatTime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export default function WorkoutsScreen() {
  const { summary, loading, refresh } = useHealth();
  const [tab, setTab] = useState<Tab>('workouts');
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [treadmillSessions, setTreadmillSessions] = useState<TreadmillSessionRecord[]>([]);
  const [dbLoading, setDbLoading] = useState(false);

  const loadFromDb = useCallback(async () => {
    setDbLoading(true);
    try {
      const [ws, ts] = await Promise.all([getWorkouts(30), getTreadmillSessions(30)]);
      setWorkouts(ws);
      setTreadmillSessions(ts);
    } finally {
      setDbLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFromDb();
    }, [loadFromDb])
  );

  // Merge today's live workouts with stored ones
  const allWorkouts = React.useMemo(() => {
    const stored = new Set(workouts.map((w) => w.id));
    const todayNew = (summary?.workouts ?? []).filter((w) => !stored.has(w.id));
    return [...todayNew, ...workouts];
  }, [workouts, summary?.workouts]);

  const isLoading = loading || dbLoading;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Tab bar */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'workouts' && styles.tabActive]}
          onPress={() => setTab('workouts')}
        >
          <Text style={[styles.tabText, tab === 'workouts' && styles.tabTextActive]}>
            Workouts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'treadmill' && styles.tabActive]}
          onPress={() => setTab('treadmill')}
        >
          <Text style={[styles.tabText, tab === 'treadmill' && styles.tabTextActive]}>
            Treadmill
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'workouts' ? (
        <FlatList
          data={allWorkouts}
          keyExtractor={(w) => w.id}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={async () => { await refresh(); await loadFromDb(); }}
            />
          }
          contentContainerStyle={styles.list}
          ListHeaderComponent={<Text style={styles.heading}>Last 30 Days</Text>}
          ListEmptyComponent={
            isLoading
              ? <ActivityIndicator color="#E53935" style={{ marginTop: 40 }} />
              : <Text style={styles.empty}>No workouts recorded yet.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.icon}>{WORKOUT_ICONS[item.type]}</Text>
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
              <Text style={styles.source}>{item.source}</Text>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={treadmillSessions}
          keyExtractor={(s) => String(s.id)}
          refreshControl={
            <RefreshControl refreshing={dbLoading} onRefresh={loadFromDb} />
          }
          contentContainerStyle={styles.list}
          ListHeaderComponent={<Text style={styles.heading}>NordicTrack Sessions</Text>}
          ListEmptyComponent={
            <Text style={styles.empty}>
              No treadmill sessions saved yet.{'\n'}Connect to your NordicTrack and start a workout.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.icon}>🏃</Text>
              <View style={styles.info}>
                <Text style={styles.type}>Treadmill</Text>
                <Text style={styles.time}>
                  {formatDate(item.startTime)}
                  {' · '}
                  {item.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {item.elapsedSeconds ? ` · ${formatTime(item.elapsedSeconds)}` : ''}
                </Text>
              </View>
              <View style={styles.stats}>
                {item.distanceMeters !== undefined && (
                  <Text style={styles.stat}>{(item.distanceMeters / 1000).toFixed(2)} km</Text>
                )}
                {item.avgSpeedKph !== undefined && (
                  <Text style={styles.stat}>{item.avgSpeedKph.toFixed(1)} km/h avg</Text>
                )}
                {item.avgHeartRate !== undefined && (
                  <Text style={[styles.stat, { color: '#E53935' }]}>♥ {item.avgHeartRate} bpm</Text>
                )}
                {item.calories !== undefined && (
                  <Text style={styles.stat}>{item.calories} kcal</Text>
                )}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6FA' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#E53935' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#aaa' },
  tabTextActive: { color: '#E53935' },
  list: { padding: 16 },
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
  stats: { alignItems: 'flex-end', marginRight: 8 },
  stat: { fontSize: 13, color: '#555', marginBottom: 2 },
  source: { fontSize: 10, color: '#ccc', textTransform: 'uppercase', position: 'absolute', right: 12, top: 8 },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 40, lineHeight: 22 },
});
