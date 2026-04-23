import React from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePreferences, Preferences } from '../context/PreferencesContext';

interface OptionRowProps<T extends string> {
  label: string;
  description?: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

function OptionRow<T extends string>({
  label,
  description,
  options,
  value,
  onChange,
}: OptionRowProps<T>) {
  return (
    <View style={styles.row}>
      <View style={styles.rowMeta}>
        <Text style={styles.rowLabel}>{label}</Text>
        {description ? <Text style={styles.rowDesc}>{description}</Text> : null}
      </View>
      <View style={styles.optionGroup}>
        {options.map((o) => (
          <TouchableOpacity
            key={o.value}
            style={[styles.optionBtn, value === o.value && styles.optionBtnActive]}
            onPress={() => onChange(o.value)}
            activeOpacity={0.75}
          >
            <Text style={[styles.optionText, value === o.value && styles.optionTextActive]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function PreferencesScreen() {
  const { preferences, setPreference } = usePreferences();
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionHeader}>Units</Text>

        <OptionRow<Preferences['distanceUnit']>
          label="Distance"
          description="How distances are displayed"
          options={[
            { value: 'miles', label: 'Miles' },
            { value: 'km', label: 'Km' },
          ]}
          value={preferences.distanceUnit}
          onChange={(v) => setPreference('distanceUnit', v)}
        />

        <OptionRow<Preferences['weightUnit']>
          label="Weight"
          description="Body weight and load measurements"
          options={[
            { value: 'lbs', label: 'lbs' },
            { value: 'kg', label: 'kg' },
          ]}
          value={preferences.weightUnit}
          onChange={(v) => setPreference('weightUnit', v)}
        />

        <OptionRow<Preferences['glucoseUnit']>
          label="Blood Glucose"
          description="Blood sugar readings"
          options={[
            { value: 'mgdl', label: 'mg/dL' },
            { value: 'mmoll', label: 'mmol/L' },
          ]}
          value={preferences.glucoseUnit}
          onChange={(v) => setPreference('glucoseUnit', v)}
        />

        <OptionRow<Preferences['temperatureUnit']>
          label="Temperature"
          description="Weather and body temperature"
          options={[
            { value: 'f', label: '°F' },
            { value: 'c', label: '°C' },
          ]}
          value={preferences.temperatureUnit}
          onChange={(v) => setPreference('temperatureUnit', v)}
        />

        <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Equipment &amp; Devices</Text>

        <TouchableOpacity style={styles.navRow} onPress={() => navigation.navigate('Devices')} activeOpacity={0.75}>
          <View style={styles.navRowLeft}>
            <Text style={styles.navIcon}>📱</Text>
            <View>
              <Text style={styles.navRowLabel}>Devices</Text>
              <Text style={styles.navRowDesc}>Health Connect, Apple Health</Text>
            </View>
          </View>
          <Text style={styles.navChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navRow} onPress={() => navigation.navigate('Treadmill')} activeOpacity={0.75}>
          <View style={styles.navRowLeft}>
            <Text style={styles.navIcon}>🏃</Text>
            <View>
              <Text style={styles.navRowLabel}>Treadmill</Text>
              <Text style={styles.navRowDesc}>Bluetooth FTMS workout tracking</Text>
            </View>
          </View>
          <Text style={styles.navChevron}>›</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6FA' },
  content: { padding: 16 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  row: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  rowMeta: { flex: 1, marginRight: 12 },
  rowLabel: { fontSize: 16, fontWeight: '600', color: '#111' },
  rowDesc: { fontSize: 12, color: '#888', marginTop: 2 },
  optionGroup: { flexDirection: 'row', gap: 6 },
  optionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#ddd',
    backgroundColor: '#F5F6FA',
  },
  optionBtnActive: {
    backgroundColor: '#E53935',
    borderColor: '#E53935',
  },
  optionText: { fontSize: 14, fontWeight: '500', color: '#555' },
  optionTextActive: { color: '#fff', fontWeight: '700' },
  navRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  navRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  navIcon: { fontSize: 22, marginRight: 12 },
  navRowLabel: { fontSize: 16, fontWeight: '600', color: '#111' },
  navRowDesc: { fontSize: 12, color: '#888', marginTop: 2 },
  navChevron: { fontSize: 22, color: '#ccc', fontWeight: '300' },
});
