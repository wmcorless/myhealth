import { Platform } from 'react-native';
import { BloodGlucoseSample, DailySummary, HeartRateSample } from '../types/health';
import * as HealthConnect from './healthConnectService';
import * as HealthKit from './healthKitService';

export async function initNativeHealth(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      const ok = await HealthConnect.initHealthConnect();
      if (ok) await HealthConnect.requestHealthConnectPermissions();
    } else if (Platform.OS === 'ios') {
      await HealthKit.initHealthKit();
    }
  } catch {
    // Health Connect unavailable — app continues without native health data
  }
}

export async function getTodaySummary(): Promise<DailySummary> {
  const base: DailySummary = {
    date: new Date(),
    steps: 0,
    totalDistanceMeters: 0,
    caloriesBurned: 0,
    workouts: [],
  };

  const [nativeSummary, glucoseSamples] = await Promise.allSettled([
    Platform.OS === 'android'
      ? HealthConnect.fetchTodaySummary()
      : HealthKit.fetchTodaySummary(),
    Platform.OS === 'android'
      ? HealthConnect.fetchTodayBloodGlucose()
      : Promise.resolve([] as BloodGlucoseSample[]),
  ]);

  if (nativeSummary.status === 'fulfilled') {
    Object.assign(base, nativeSummary.value);
  }
  if (glucoseSamples.status === 'fulfilled' && glucoseSamples.value.length > 0) {
    const sorted = [...glucoseSamples.value].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
    base.latestBloodGlucose = sorted[0];
  }

  return base;
}

export async function getTodayHeartRate(): Promise<HeartRateSample[]> {
  try {
    return Platform.OS === 'android'
      ? await HealthConnect.fetchTodayHeartRate()
      : await HealthKit.fetchTodayHeartRate();
  } catch {
    return [];
  }
}


export async function getTodayBloodGlucose(): Promise<BloodGlucoseSample[]> {
  if (Platform.OS !== 'android') return [];
  return HealthConnect.fetchTodayBloodGlucose();
}
