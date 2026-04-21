import {
  initialize,
  requestPermission,
  readRecords,
  getSdkStatus,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { Platform } from 'react-native';
import { DailySummary, HeartRateSample, WorkoutSession } from '../types/health';

export async function isHealthConnectAvailable(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const status = await getSdkStatus();
    return status === SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

export async function initHealthConnect(): Promise<boolean> {
  if (!(await isHealthConnectAvailable())) return false;
  return initialize();
}

export async function requestHealthConnectPermissions(): Promise<boolean> {
  try {
    const granted = await requestPermission([
      { accessType: 'read', recordType: 'HeartRate' },
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'Distance' },
      { accessType: 'read', recordType: 'ExerciseSession' },
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
      { accessType: 'read', recordType: 'RestingHeartRate' },
    ]);
    return granted.length > 0;
  } catch {
    return false;
  }
}

export async function fetchTodayHeartRate(): Promise<HeartRateSample[]> {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { records } = await readRecords('HeartRate', {
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: new Date().toISOString(),
      },
    });
    return (records as any[]).flatMap((r) =>
      (r.samples ?? []).map((s: any) => ({
        timestamp: new Date(s.time),
        bpm: s.beatsPerMinute,
        source: 'samsung' as const,
      }))
    );
  } catch {
    return [];
  }
}

export async function fetchTodaySummary(): Promise<Partial<DailySummary>> {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const filter = {
      timeRangeFilter: {
        operator: 'between' as const,
        startTime: start.toISOString(),
        endTime: new Date().toISOString(),
      },
    };

    const [stepsResult, distanceResult, caloriesResult, restingHRResult, exerciseResult] =
      await Promise.all([
        readRecords('Steps', filter),
        readRecords('Distance', filter),
        readRecords('ActiveCaloriesBurned', filter),
        readRecords('RestingHeartRate', filter),
        readRecords('ExerciseSession', filter),
      ]);

    const steps = (stepsResult.records as any[]).reduce((s, r) => s + r.count, 0);
    const distanceMeters = (distanceResult.records as any[]).reduce(
      (s, r) => s + (r.distance?.inMeters ?? 0),
      0
    );
    const calories = (caloriesResult.records as any[]).reduce(
      (s, r) => s + (r.energy?.inKilocalories ?? 0),
      0
    );
    const restingHR = (restingHRResult.records as any[]).at(-1)?.beatsPerMinute;

    const workouts: WorkoutSession[] = (exerciseResult.records as any[]).map((r) => ({
      id: r.metadata?.id ?? String(Math.random()),
      startTime: new Date(r.startTime),
      endTime: new Date(r.endTime),
      type: 'other' as const,
      source: 'samsung' as const,
    }));

    return { date: start, steps, totalDistanceMeters: distanceMeters, caloriesBurned: calories, restingHeartRate: restingHR, workouts };
  } catch {
    return {};
  }
}
