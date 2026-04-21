import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import DeviceStatusBadge from '../components/DeviceStatusBadge';
import { useHealth } from '../context/HealthContext';

export default function DevicesScreen() {
  const { devices, connectiFit, disconnectiFit, connectSamsungHealth } = useHealth();
  const [connecting, setConnecting] = useState(false);
  const [connectingSamsung, setConnectingSamsung] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const iFitDevice = devices.find((d) => d.id === 'ifit');

  async function handleConnect() {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your iFit email and password.');
      return;
    }
    setConnecting(true);
    const result = await connectiFit(email.trim(), password);
    setConnecting(false);
    if (result.success) {
      setShowForm(false);
      setEmail('');
      setPassword('');
    } else {
      Alert.alert('Login failed', result.error ?? 'Could not sign in to iFit.');
    }
  }

  function handleDisconnect() {
    Alert.alert('Disconnect iFit', 'Remove your iFit account from this app?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: disconnectiFit },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.heading}>Devices</Text>
          <Text style={styles.sub}>Manage your connected health sources.</Text>

          {devices.map((d) => (
            <DeviceStatusBadge key={d.id} device={d} />
          ))}

          <View style={styles.separator} />

          {/* iFit section */}
          <Text style={styles.sectionTitle}>iFit Treadmill</Text>
          <Text style={styles.description}>
            Sign in with your iFit account to sync treadmill workouts, distance, and
            heart rate automatically after each session.
          </Text>

          {iFitDevice?.connected ? (
            <TouchableOpacity style={styles.buttonSecondary} onPress={handleDisconnect}>
              <Text style={styles.buttonSecondaryText}>Disconnect iFit</Text>
            </TouchableOpacity>
          ) : showForm ? (
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="iFit email"
                placeholderTextColor="#aaa"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="iFit password"
                  placeholderTextColor="#aaa"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((v) => !v)}
                >
                  <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.button}
                onPress={handleConnect}
                disabled={connecting}
              >
                {connecting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Sign In</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowForm(false)} style={styles.cancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.button} onPress={() => setShowForm(true)}>
              <Text style={styles.buttonText}>Connect iFit Account</Text>
            </TouchableOpacity>
          )}

          <View style={styles.separator} />

          {/* Samsung / Apple Health section */}
          <Text style={styles.sectionTitle}>
            {Platform.OS === 'ios' ? 'Apple Health' : 'Samsung Health'}
          </Text>
          <Text style={styles.description}>
            {Platform.OS === 'ios'
              ? 'Grant access to Apple HealthKit to sync heart rate, steps, distance, and workouts.'
              : 'Grant access to Android Health Connect to sync data from your Samsung watch and Galaxy devices.'}
          </Text>
          {devices.find((d) => d.id === 'samsung_health')?.connected ? (
            <TouchableOpacity style={styles.buttonSecondary} disabled>
              <Text style={styles.buttonSecondaryText}>✓ Samsung Health Connected</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.button}
              onPress={async () => {
                setConnectingSamsung(true);
                const ok = await connectSamsungHealth();
                setConnectingSamsung(false);
                if (!ok) Alert.alert('Not available', 'Health Connect is not available on this device. Make sure the Health Connect app is installed from Google Play.');
              }}
              disabled={connectingSamsung}
            >
              {connectingSamsung
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.buttonText}>Connect Samsung Health</Text>
              }
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6FA' },
  content: { padding: 16, paddingBottom: 40 },
  heading: { fontSize: 28, fontWeight: '700', color: '#111', marginBottom: 4 },
  sub: { fontSize: 14, color: '#888', marginBottom: 20 },
  separator: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 6 },
  description: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 14 },
  form: { gap: 10 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#111',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#111',
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  eyeText: { fontSize: 18 },
  button: {
    backgroundColor: '#E53935',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  buttonSecondary: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  buttonSecondaryText: { color: '#666', fontWeight: '600', fontSize: 16 },
  cancel: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { color: '#aaa', fontSize: 14 },
});
