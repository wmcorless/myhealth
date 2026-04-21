import { Platform } from 'react-native';
import AppleHealthKit, {
  HealthKitPermissions,
  HealthValue,
} from 'react-native-health';
import { DailySummary, HeartRateSample } from '../types/health';

const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.StepCount,
      AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
      AppleHealthKit.Constants.Permissions.RestingHeartRate,
      AppleHealthKit.Constants.Permissions.Workout,
    ],
    write: [],
  },
};

export function initHealthKit(): Promise<void> {
  if (Platform.OS !== 'ios') return Promise.resolve();
  return new Promise((resolve, reject) => {
    AppleHealthKit.initHealthKit(PERMISSIONS, (err) => {
      if (err) reject(new Error(err));
      else resolve();
    });
  });
}

export function fetchTodayHeartRate(): Promise<HeartRateSample[]> {
  return new Promise((resolve, reject) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    AppleHealthKit.getHeartRateSamples(
      { startDate: start.toISOString(), endDate: new Date().toISOString() },
      (err, results) => {
        if (err) return reject(new Error(String(err)));
        resolve(
          results.map((r: HealthValue) => ({
            timestamp: new Date(r.startDate),
            bpm: r.value,
            source: 'samsung' as const, // HealthKit aggregates all sources
          }))
        );
      }
    );
  });
}

export function fetchTodaySummary(): Promise<Partial<DailySummary>> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const options = { startDate: start.toISOString(), endDate: new Date().toISOString() };

  return new Promise((resolve) => {
    Promise.all([
      new Promise<number>((res) =>
        AppleHealthKit.getStepCount(options, (e, r) => res(e ? 0 : r.value))
      ),
      new Promise<number>((res) =>
        AppleHealthKit.getDistanceWalkingRunning(options, (e, r) => res(e ? 0 : r.value))
      ),
      new Promise<number>((res) =>
        AppleHealthKit.getActiveEnergyBurned(options, (e, r) =>
          res(e ? 0 : (r as any[]).reduce((s, v) => s + v.value, 0))
        )
      ),
      new Promise<number | undefined>((res) =>
        AppleHealthKit.getRestingHeartRate(options, (e, r) =>
          res(e ? undefined : (r as any).value)
        )
      ),
    ]).then(([steps, distanceKm, calories, restingHR]) => {
      resolve({
        date: start,
        steps,
        totalDistanceMeters: distanceKm * 1000,
        caloriesBurned: calories,
        restingHeartRate: restingHR,
        workouts: [],
      });
    });
  });
}
