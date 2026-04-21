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

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function bpmColor(bpm: number): string {
  if (bpm > 150) return '#E53935';
  if (bpm > 100) return '#FB8C00';
  return '#43A047';
}

export default function HeartRateScreen() {
  const { heartRateSamples, summary, loading, refresh } = useHealth();

  const avg = summary?.avgHeartRate;
  const resting = summary?.restingHeartRate;
  const max = heartRateSamples.length
    ? Math.max(...heartRateSamples.map((s) => s.bpm))
    : undefined;

  const reversed = [...heartRateSamples].reverse();

  return (
    <SafeAreaView style={styles.safe}>
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
          ListEmptyComponent={
            <Text style={styles.empty}>
              No heart rate data yet today. Pull to refresh or check device connections.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={[styles.dot, { backgroundColor: bpmColor(item.bpm) }]} />
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
  header: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statBox: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 11, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 26, fontWeight: '700', marginTop: 2 },
  list: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  time: { flex: 1, fontSize: 14, color: '#555' },
  bpm: { fontSize: 18, fontWeight: '700' },
  bpmUnit: { fontSize: 12, fontWeight: '400', color: '#aaa' },
  source: { fontSize: 11, color: '#bbb', marginLeft: 10, textTransform: 'uppercase' },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 40, lineHeight: 22 },
});
