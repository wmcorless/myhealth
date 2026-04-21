import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

export default function HeartRateScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.heading}>Heart Rate</Text>
        <Text style={styles.placeholder}>
          Live and historical heart rate data from your Samsung watch and iFit treadmill will be shown here.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6FA' },
  content: { flex: 1, padding: 16 },
  heading: { fontSize: 28, fontWeight: '700', color: '#111', marginBottom: 12 },
  placeholder: { fontSize: 15, color: '#888', lineHeight: 22 },
});
