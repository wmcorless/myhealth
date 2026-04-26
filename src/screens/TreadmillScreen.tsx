import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  Linking,
  Clipboard,
  Alert,
} from 'react-native';
import { Device } from 'react-native-ble-plx';
import { useTreadmill } from '../context/TreadmillContext';
import { useWatchHR } from '../context/WatchHRContext';
import { usePreferences } from '../context/PreferencesContext';

const NORDICTRACK_APK_URL = 'https://github.com/wmcorless/myhealth/releases/tag/treadmill-bridge-latest';
const RESPONSE_CODE_URL = 'https://getresponsecode.com/';

function kphToDisplay(kph: number, useMiles: boolean): string {
  if (kph === 0) return '0.0';
  return useMiles ? (kph / 1.609344).toFixed(1) : kph.toFixed(1);
}

function metersToDisplay(meters: number, useMiles: boolean): string {
  if (meters === 0) return '0.00';
  return useMiles ? (meters / 1609.344).toFixed(2) : (meters / 1000).toFixed(2);
}

function formatElapsed(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TreadmillScreen() {
  const tm = useTreadmill();
  const watchHr = useWatchHR();
  const { preferences } = usePreferences();
  const useMiles = preferences.distanceUnit === 'miles';

  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [expandedModel, setExpandedModel] = useState<string | null>('x22i');

  // Start/stop local elapsed timer
  useEffect(() => {
    if (tm.status === 'recording') {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsed(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [tm.status]);

  // Collect watch HR samples while recording
  const watchHrSamplesRef = useRef<number[]>([]);
  useEffect(() => {
    if (tm.status === 'recording') {
      watchHrSamplesRef.current = [];
    }
  }, [tm.status]);
  useEffect(() => {
    if (tm.status === 'recording' && watchHr.liveHR) {
      watchHrSamplesRef.current.push(watchHr.liveHR);
    }
  }, [watchHr.liveHR, tm.status]);

  async function handleStopRecording() {
    await tm.stopRecording(watchHrSamplesRef.current);
    watchHrSamplesRef.current = [];
  }

  // Live HR: prefer watch, fall back to treadmill strap
  const displayHR = watchHr.liveHR ?? tm.liveData?.heartRate ?? 0;
  const speedUnit = useMiles ? 'mph' : 'km/h';
  const distUnit = useMiles ? 'mi' : 'km';

  // ── Idle / scan ────────────────────────────────────────────────────────────
  if (tm.status === 'idle' || tm.status === 'bt_off') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.center}>
          <Text style={styles.title}>Treadmill</Text>
          <Text style={styles.sub}>Connect to your treadmill via Bluetooth FTMS.</Text>
          {tm.status === 'bt_off' && (
            <Text style={styles.error}>Bluetooth is off — please enable it and try again.</Text>
          )}
          {tm.error && <Text style={styles.error}>{tm.error}</Text>}
          <TouchableOpacity style={styles.primaryBtn} onPress={tm.startScan}>
            <Text style={styles.primaryBtnText}>Scan for Treadmill</Text>
          </TouchableOpacity>
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Supported Treadmills</Text>

            {/* ── NordicTrack X22i ── */}
            <TouchableOpacity
              style={styles.modelHeader}
              onPress={() => setExpandedModel(expandedModel === 'x22i' ? null : 'x22i')}
            >
              <Text style={styles.modelName}>🏃  NordicTrack X22i</Text>
              <Text style={styles.modelChevron}>{expandedModel === 'x22i' ? '▼' : '▶'}</Text>
            </TouchableOpacity>

            {expandedModel === 'x22i' && (
              <View style={styles.modelContent}>
                <Text style={styles.infoText}>
                  Install <Text style={{ fontWeight: '700' }}>MyHealth Bridge</Text> on the treadmill
                  console once. It reads live speed, incline and heart rate from iFit and broadcasts
                  them to this phone over Bluetooth — no cables needed.
                </Text>

                {/* Step 1: Maintenance mode */}
                <Text style={styles.stepTitle}>Step 1 — Unlock maintenance mode</Text>
                <Text style={styles.infoText}>
                  1. On the treadmill, tap the menu and open <Text style={{ fontWeight: '600' }}>Maintenance</Text>{'\n'}
                  2. Tap the blank white area <Text style={{ fontWeight: '600' }}>10 times</Text>{'\n'}
                  3. Wait <Text style={{ fontWeight: '600' }}>7 seconds</Text>{'\n'}
                  4. Tap the blank white area <Text style={{ fontWeight: '600' }}>10 more times</Text>{'\n'}
                  5. A <Text style={{ fontWeight: '600' }}>challenge code</Text> appears on screen{'\n'}
                  6. On your phone, open the site below, enter the code, and get the response{'\n'}
                  7. Enter the response code on the treadmill to unlock
                </Text>
                <TouchableOpacity
                  style={styles.secondaryBtnSmall}
                  onPress={() => Linking.openURL(RESPONSE_CODE_URL).catch(() => {})}
                >
                  <Text style={styles.secondaryBtnSmallText}>🔑  Open getresponsecode.com →</Text>
                </TouchableOpacity>

                {/* Step 2: Download via browser */}
                <Text style={styles.stepTitle}>Step 2 — Download MyHealth Bridge</Text>
                <Text style={styles.infoText}>
                  After unlocking, open the <Text style={{ fontWeight: '600' }}>Browser</Text> in the
                  maintenance menu. Navigate to the URL below and download{' '}
                  <Text style={{ fontStyle: 'italic' }}>nordictrack.apk</Text>, then tap{' '}
                  <Text style={{ fontStyle: 'italic' }}>Install</Text>.
                </Text>
                <TouchableOpacity
                  style={styles.urlBox}
                  onPress={() => {
                    Clipboard.setString(NORDICTRACK_APK_URL);
                    Alert.alert('Copied', 'URL copied to clipboard');
                  }}
                >
                  <Text style={styles.urlText}>{NORDICTRACK_APK_URL}</Text>
                  <Text style={styles.urlHint}>Tap to copy — then type it in the treadmill browser</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryBtnSmall}
                  onPress={() => Linking.openURL(NORDICTRACK_APK_URL).catch(() => {})}
                >
                  <Text style={styles.secondaryBtnSmallText}>Open release page on this phone →</Text>
                </TouchableOpacity>

                {/* Step 3: Log permission */}
                <Text style={styles.stepTitle}>Step 3 — Grant log permission (one-time, from a PC)</Text>
                <Text style={styles.infoText}>
                  From a PC on the same WiFi network, run these two commands:
                </Text>
                <View style={styles.codeBlock}>
                  <Text style={styles.codeText}>adb connect &lt;treadmill-ip&gt;:5555</Text>
                  <Text style={styles.codeText}>
                    adb shell pm grant com.wmcorless.myhealth.bridge android.permission.READ_LOGS
                  </Text>
                </View>

                {/* Step 4: Start */}
                <Text style={styles.stepTitle}>Step 4 — Start broadcasting</Text>
                <Text style={[styles.infoText, { marginBottom: 4 }]}>
                  Open <Text style={{ fontWeight: '600' }}>MyHealth Bridge</Text> on the treadmill and
                  tap <Text style={{ fontWeight: '600' }}>Start Broadcasting</Text>. Then tap{' '}
                  <Text style={{ fontWeight: '600' }}>Scan for Treadmill</Text> above.
                </Text>
              </View>
            )}

            {/* ── Placeholder for future models ── */}
            <View style={[styles.modelHeader, { opacity: 0.4 }]}>
              <Text style={styles.modelName}>More treadmills coming soon…</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Scanning ───────────────────────────────────────────────────────────────
  if (tm.status === 'scanning') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.center}>
          <ActivityIndicator color="#E53935" size="large" style={{ marginBottom: 12 }} />
          <Text style={styles.title}>Scanning…</Text>
          <Text style={styles.sub}>Looking for Bluetooth FTMS treadmills nearby.</Text>

          {tm.foundDevices.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Found devices:</Text>
              {tm.foundDevices.map((d: Device) => (
                <TouchableOpacity
                  key={d.id}
                  style={styles.deviceRow}
                  onPress={() => tm.connectDevice(d)}
                >
                  <Text style={styles.deviceName}>{d.localName ?? d.name ?? d.id}</Text>
                  <Text style={styles.deviceConnect}>Connect</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          <TouchableOpacity style={styles.secondaryBtn} onPress={tm.stopScan}>
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Connecting ─────────────────────────────────────────────────────────────
  if (tm.status === 'connecting') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color="#E53935" size="large" style={{ marginBottom: 12 }} />
          <Text style={styles.title}>Connecting…</Text>
          <Text style={styles.sub}>{tm.connectedDevice?.localName ?? tm.connectedDevice?.name}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Connected / Recording ──────────────────────────────────────────────────
  const isRecording = tm.status === 'recording';
  const { liveData } = tm;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>
            {isRecording ? '🔴 Workout in Progress' : tm.connectedDevice?.localName ?? tm.connectedDevice?.name ?? 'Treadmill'}
          </Text>
          {isRecording && <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>}
        </View>

        {/* Live metrics */}
        <View style={styles.metricsGrid}>
          <MetricTile
            label={`Speed (${speedUnit})`}
            value={kphToDisplay(liveData?.speedKph ?? 0, useMiles)}
            color="#E53935"
            large
          />
          <MetricTile
            label="Incline (%)"
            value={(liveData?.inclinePercent ?? 0).toFixed(1)}
            color="#1E88E5"
            large
          />
          <MetricTile
            label={`Distance (${distUnit})`}
            value={metersToDisplay(liveData?.distanceMeters ?? 0, useMiles)}
            color="#43A047"
          />
          <MetricTile
            label="Calories"
            value={liveData?.calories?.toFixed(0) ?? '—'}
            color="#FB8C00"
          />
          <MetricTile
            label="Heart Rate"
            value={displayHR > 0 ? String(displayHR) : '—'}
            unit="bpm"
            color="#E53935"
            badge={watchHr.status === 'connected' ? '⌚ watch' : undefined}
          />
          <MetricTile
            label="Elapsed"
            value={formatElapsed(isRecording ? elapsed : (liveData?.elapsedSeconds ?? 0))}
            color="#8E24AA"
          />
        </View>

        {/* Watch HR status */}
        {Platform.OS === 'android' && watchHr.status !== 'connected' && (
          <View style={styles.watchHintBox}>
            <Text style={styles.watchHintText}>
              ⌚ For live watch heart rate, connect your Galaxy Watch on the Devices screen.
            </Text>
          </View>
        )}

        {/* Action buttons */}
        {!isRecording ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={tm.startRecording}>
            <Text style={styles.primaryBtnText}>Start Workout</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#555' }]} onPress={handleStopRecording}>
            <Text style={styles.primaryBtnText}>Stop Workout</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.secondaryBtn} onPress={tm.disconnect}>
          <Text style={styles.secondaryBtnText}>Disconnect</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricTile({
  label,
  value,
  unit,
  color,
  large,
  badge,
}: {
  label: string;
  value: string | number;
  unit?: string;
  color: string;
  large?: boolean;
  badge?: string;
}) {
  return (
    <View style={[styles.tile, large && styles.tileLarge]}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, { color }, large && styles.tileValueLarge]}>
        {value}
        {unit ? <Text style={styles.tileUnit}> {unit}</Text> : null}
      </Text>
      {badge && <Text style={styles.tileBadge}>{badge}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6FA' },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, paddingBottom: 40 },
  content: { padding: 16, paddingBottom: 40 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 8,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111' },
  timer: { fontSize: 28, fontWeight: '700', color: '#E53935', fontVariant: ['tabular-nums'] },
  sub: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 12 },
  error: { color: '#E53935', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 20, marginBottom: 8 },

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 16,
  },
  tile: {
    width: '50%',
    paddingHorizontal: 4,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
  },
  tileLarge: { elevation: 2 },
  tileLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  tileValue: { fontSize: 22, fontWeight: '700' },
  tileValueLarge: { fontSize: 28 },
  tileUnit: { fontSize: 13, fontWeight: '400', color: '#666' },
  tileBadge: { fontSize: 11, color: '#888', marginTop: 2 },

  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    width: '100%',
    elevation: 1,
  },
  deviceName: { fontSize: 15, fontWeight: '600', color: '#111', flex: 1 },
  deviceConnect: { fontSize: 14, color: '#E53935', fontWeight: '700' },

  primaryBtn: {
    backgroundColor: '#E53935',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 10,
  },
  secondaryBtnText: { color: '#666', fontWeight: '600', fontSize: 15 },

  watchHintBox: {
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  watchHintText: { fontSize: 13, color: '#555' },

  infoBox: {
    backgroundColor: '#EEF6FF',
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
    width: '100%',
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#1E88E5', marginBottom: 8 },
  infoText: { fontSize: 13, color: '#444', lineHeight: 20 },

  modelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  modelName: { fontSize: 14, fontWeight: '700', color: '#333', flex: 1 },
  modelChevron: { fontSize: 12, color: '#888', marginLeft: 8 },
  modelContent: { paddingTop: 8 },

  stepTitle: { fontSize: 13, fontWeight: '700', color: '#1E88E5', marginTop: 14, marginBottom: 4 },

  codeBlock: {
    backgroundColor: '#1E1E2E',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    marginBottom: 4,
  },
  codeText: {
    fontSize: 11,
    color: '#A8D8A8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 18,
  },
  urlBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  urlText: { fontSize: 12, color: '#1E88E5', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  urlHint: { fontSize: 11, color: '#aaa', marginTop: 2 },
  secondaryBtnSmall: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E88E5',
    marginTop: 4,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  secondaryBtnSmallText: { color: '#1E88E5', fontWeight: '600', fontSize: 13 },
});
