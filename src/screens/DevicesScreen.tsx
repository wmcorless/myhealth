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
  const { devices, connectiFit, disconnectiFit } = useHealth();
  const [connecting, setConnecting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
              <TextInput
                style={styles.input}
                placeholder="iFit password"
                placeholderTextColor="#aaa"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
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
              ? 'Health data syncs automatically via Apple HealthKit. Grant permissions when prompted on first launch.'
              : 'Health data from your Samsung watch syncs via Android Health Connect. Grant permissions when prompted on first launch.'}
          </Text>
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
