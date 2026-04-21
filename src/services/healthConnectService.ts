import { Platform, NativeModules } from 'react-native';
import { DailySummary, HeartRateSample, WorkoutSession } from '../types/health';

// Lazy-load the native module — never import at top level to avoid startup crash
function getHealthConnect() {
  try {
    // Only attempt to load if the native module is registered
    if (!NativeModules.HealthConnect) return null;
    return require('react-native-health-connect');
  } catch {
    return null;
  }
}

export async function isHealthConnectAvailable(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const hc = getHealthConnect();
    if (!hc) return false;
    const { getSdkStatus, SdkAvailabilityStatus } = hc;
    const status = await getSdkStatus();
    return status === SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

export async function initHealthConnect(): Promise<boolean> {
  try {
    const hc = getHealthConnect();
    if (!hc) return false;
    const available = await isHealthConnectAvailable();
    if (!available) return false;
    return hc.initialize();
  } catch {
    return false;
  }
}

export async function requestHealthConnectPermissions(): Promise<boolean> {
  try {
    const hc = getHealthConnect();
    if (!hc) return false;
    const granted = await hc.requestPermission([
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
    const hc = getHealthConnect();
    if (!hc) return [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { records } = await hc.readRecords('HeartRate', {
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
    const hc = getHealthConnect();
    if (!hc) return {};
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
        hc.readRecords('Steps', filter),
        hc.readRecords('Distance', filter),
        hc.readRecords('ActiveCaloriesBurned', filter),
        hc.readRecords('RestingHeartRate', filter),
        hc.readRecords('ExerciseSession', filter),
      ]);

    const steps = (stepsResult.records as any[]).reduce((s: number, r: any) => s + r.count, 0);
    const distanceMeters = (distanceResult.records as any[]).reduce(
      (s: number, r: any) => s + (r.distance?.inMeters ?? 0), 0
    );
    const calories = (caloriesResult.records as any[]).reduce(
      (s: number, r: any) => s + (r.energy?.inKilocalories ?? 0), 0
    );
    const restingHR = (restingHRResult.records as any[]).at(-1)?.beatsPerMinute;
    const workouts: WorkoutSession[] = (exerciseResult.records as any[]).map((r: any) => ({
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
