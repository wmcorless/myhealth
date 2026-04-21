import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useHealth } from '../context/HealthContext';

const POLL_INTERVAL_MS = 30_000;

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function bpmColor(bpm: number): string {
  if (bpm > 150) return '#E53935';
  if (bpm > 100) return '#FB8C00';
  return '#43A047';
}

function secondsAgo(date: Date): string {
  const secs = Math.round((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ago`;
}

export default function HeartRateScreen() {
  const { heartRateSamples, summary, loading, refresh } = useHealth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
      intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }, [refresh])
  );

  const reversed = [...heartRateSamples].reverse();
  const latest = reversed[0];
  const avg = summary?.avgHeartRate;
  const resting = summary?.restingHeartRate;
  const max = heartRateSamples.length
    ? Math.max(...heartRateSamples.map((s) => s.bpm))
    : undefined;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Live reading */}
      {latest && (
        <View style={styles.liveCard}>
          <Text style={styles.liveLabel}>Current Heart Rate</Text>
          <Text style={[styles.liveBpm, { color: bpmColor(latest.bpm) }]}>
            {latest.bpm}
            <Text style={styles.liveBpmUnit}> bpm</Text>
          </Text>
          <Text style={styles.liveTime}>
            {secondsAgo(latest.timestamp)} · {latest.source.toUpperCase()}
          </Text>
          <View style={styles.pulsingDot}>
            <View style={[styles.dot, { backgroundColor: bpmColor(latest.bpm) }]} />
          </View>
        </View>
      )}

      {/* Stats row */}
      <View style={styles.header}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Avg</Text>
          <Text style={[styles.statValue, { color: '#FB8C00' }]}>{avg ?? '—'}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Max</Text>
          <Text style={[styles.statValue, { color: '#E53935' }]}>{max ?? '—'}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Resting</Text>
          <Text style={[styles.statValue, { color: '#43A047' }]}>{resting ?? '—'}</Text>
        </View>
      </View>

      {loading && !heartRateSamples.length ? (
        <ActivityIndicator color="#E53935" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={reversed}
          keyExtractor={(_, i) => String(i)}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            heartRateSamples.length > 0 ? (
              <Text style={styles.sectionTitle}>Today's Readings</Text>
            ) : null
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              No heart rate data yet. Make sure Samsung Health is connected and your watch is on.
              {'\n\n'}Updates every 30 seconds automatically.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={[styles.rowDot, { backgroundColor: bpmColor(item.bpm) }]} />
              <Text style={styles.time}>{formatTime(item.timestamp)}</Text>
              <Text style={[styles.bpm, { color: bpmColor(item.bpm) }]}>
                {item.bpm} <Text style={styles.bpmUnit}>bpm</Text>
              </Text>
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
  liveCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  liveLabel: { fontSize: 12, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  liveBpm: { fontSize: 72, fontWeight: '700', lineHeight: 80 },
  liveBpmUnit: { fontSize: 20, fontWeight: '400', color: '#aaa' },
  liveTime: { fontSize: 13, color: '#aaa', marginTop: 6 },
  pulsingDot: { marginTop: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  header: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statBox: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 11, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 24, fontWeight: '700', marginTop: 2 },
  sectionTitle: { fontSize: 13, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  list: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  rowDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  time: { flex: 1, fontSize: 14, color: '#555' },
  bpm: { fontSize: 18, fontWeight: '700' },
  bpmUnit: { fontSize: 12, fontWeight: '400', color: '#aaa' },
  source: { fontSize: 11, color: '#bbb', marginLeft: 10, textTransform: 'uppercase' },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 40, lineHeight: 22 },
});
