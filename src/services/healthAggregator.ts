import { Platform } from 'react-native';
import { DailySummary, HeartRateSample } from '../types/health';
import * as HealthConnect from './healthConnectService';
import * as HealthKit from './healthKitService';
import { fetchiFitWorkouts, fetchiFitHeartRateForWorkout, isiFitConnected } from './iFitService';

export async function initNativeHealth(): Promise<void> {
  if (Platform.OS === 'android') {
    const ok = await HealthConnect.initHealthConnect();
    if (ok) await HealthConnect.requestHealthConnectPermissions();
  } else if (Platform.OS === 'ios') {
    await HealthKit.initHealthKit();
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

  const [nativeSummary, iFitWorkouts] = await Promise.allSettled([
    Platform.OS === 'android'
      ? HealthConnect.fetchTodaySummary()
      : HealthKit.fetchTodaySummary(),
    isiFitConnected().then((c) => (c ? fetchiFitWorkouts(5) : [])),
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
      const hrSamples = await fetchiFitHeartRateForWorkout(todayWorkouts[0].id).catch(
        () => []
      );
      if (hrSamples.length > 0) {
        const avg = Math.round(
          hrSamples.reduce((s, h) => s + h.bpm, 0) / hrSamples.length
        );
        if (!base.avgHeartRate) base.avgHeartRate = avg;
      }
    }
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
