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
  const status = await getSdkStatus();
  return status === SdkAvailabilityStatus.SDK_AVAILABLE;
}

export async function initHealthConnect(): Promise<boolean> {
  if (!(await isHealthConnectAvailable())) return false;
  return initialize();
}

export async function requestHealthConnectPermissions(): Promise<boolean> {
  const granted = await requestPermission([
    { accessType: 'read', recordType: 'HeartRate' },
    { accessType: 'read', recordType: 'Steps' },
    { accessType: 'read', recordType: 'Distance' },
    { accessType: 'read', recordType: 'ExerciseSession' },
    { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
    { accessType: 'read', recordType: 'RestingHeartRate' },
  ]);
  return granted.length > 0;
}

export async function fetchTodayHeartRate(): Promise<HeartRateSample[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const { records } = await readRecords('HeartRate', {
    timeRangeFilter: {
      operator: 'between',
      startTime: start.toISOString(),
      endTime: new Date().toISOString(),
    },
  });

  return records.flatMap((r: any) =>
    r.samples.map((s: any) => ({
      timestamp: new Date(s.time),
      bpm: s.beatsPerMinute,
      source: 'samsung' as const,
    }))
  );
}

export async function fetchTodaySummary(): Promise<Partial<DailySummary>> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  const filter = {
    timeRangeFilter: {
      operator: 'between' as const,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
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

  const steps = (stepsResult.records as any[]).reduce((sum, r) => sum + r.count, 0);
  const distanceMeters = (distanceResult.records as any[]).reduce(
    (sum, r) => sum + r.distance.inMeters,
    0
  );
  const calories = (caloriesResult.records as any[]).reduce(
    (sum, r) => sum + r.energy.inKilocalories,
    0
  );
  const restingHR =
    (restingHRResult.records as any[]).at(-1)?.beatsPerMinute ?? undefined;

  const workouts: WorkoutSession[] = (exerciseResult.records as any[]).map((r) => ({
    id: r.metadata?.id ?? String(Math.random()),
    startTime: new Date(r.startTime),
    endTime: new Date(r.endTime),
    type: 'other' as const,
    source: 'samsung' as const,
  }));

  return {
    date: start,
    steps,
    totalDistanceMeters: distanceMeters,
    caloriesBurned: calories,
    restingHeartRate: restingHR,
    workouts,
  };
}
