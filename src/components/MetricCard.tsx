import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface Props {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  onPress?: () => void;
}

export default function MetricCard({ label, value, unit, color = '#E53935', onPress }: Props) {
  const content = (
    <View style={[styles.card, !!onPress && styles.cardTappable]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color }]}>{value}</Text>
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>
      {onPress && <Text style={styles.chevron}>›</Text>}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={styles.wrapper} onPress={onPress} activeOpacity={0.75}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={styles.wrapper}>{content}</View>;
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    margin: 6,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardTappable: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  label: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
  },
  unit: {
    fontSize: 13,
    color: '#aaa',
    marginLeft: 4,
    marginBottom: 4,
  },
  chevron: {
    position: 'absolute',
    top: 12,
    right: 12,
    fontSize: 18,
    color: '#ccc',
  },
});
