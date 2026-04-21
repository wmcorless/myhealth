import { Platform } from 'react-native';
import { BloodGlucoseSample, DailySummary, HeartRateSample } from '../types/health';
import * as HealthConnect from './healthConnectService';
import * as HealthKit from './healthKitService';
import { fetchiFitWorkouts, fetchiFitHeartRateForWorkout, isiFitConnected } from './iFitService';

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

  const [nativeSummary, iFitWorkouts, glucoseSamples] = await Promise.allSettled([
    Platform.OS === 'android'
      ? HealthConnect.fetchTodaySummary()
      : HealthKit.fetchTodaySummary(),
    isiFitConnected().then((c) => (c ? fetchiFitWorkouts(5) : [])),
    Platform.OS === 'android'
      ? HealthConnect.fetchTodayBloodGlucose()
      : Promise.resolve([] as BloodGlucoseSample[]),
  ]);

  if (nativeSummary.status === 'fulfilled') {
    Object.assign(base, nativeSummary.value);
  }
  if (iFitWorkouts.status === 'fulfilled') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayWorkouts = iFitWorkouts.value.filter((w) => w.startTime >= today);
    base.workouts = [...base.workouts, ...todayWorkouts];

    if (todayWorkouts.length > 0) {
      const hrSamples = await fetchiFitHeartRateForWorkout(todayWorkouts[0].id).catch(() => []);
      if (hrSamples.length > 0) {
        const avg = Math.round(hrSamples.reduce((s, h) => s + h.bpm, 0) / hrSamples.length);
        if (!base.avgHeartRate) base.avgHeartRate = avg;
      }
    }
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
  const results = await Promise.allSettled([
    Platform.OS === 'android'
      ? HealthConnect.fetchTodayHeartRate()
      : HealthKit.fetchTodayHeartRate(),
    isiFitConnected()
      .then((c) =>
        c
          ? fetchiFitWorkouts(1).then((ws) =>
              ws[0] ? fetchiFitHeartRateForWorkout(ws[0].id) : []
            )
          : []
      ),
  ]);

  return results
    .filter((r): r is PromiseFulfilledResult<HeartRateSample[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

export async function getTodayBloodGlucose(): Promise<BloodGlucoseSample[]> {
  if (Platform.OS !== 'android') return [];
  return HealthConnect.fetchTodayBloodGlucose();
}
