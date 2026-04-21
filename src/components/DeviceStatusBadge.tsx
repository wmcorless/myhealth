import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DeviceStatus } from '../types/health';

interface Props {
  device: DeviceStatus;
}

export default function DeviceStatusBadge({ device }: Props) {
  return (
    <View style={styles.badge}>
      <View style={[styles.dot, { backgroundColor: device.connected ? '#4CAF50' : '#ccc' }]} />
      <Text style={styles.name}>{device.name}</Text>
      <Text style={styles.status}>{device.connected ? 'Connected' : 'Disconnected'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
  },
  status: {
    fontSize: 13,
    color: '#888',
  },
});
