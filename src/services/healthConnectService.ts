import {
  initialize,
  requestPermission,
  readRecords,
  getSdkStatus,
  getGrantedPermissions,
  openHealthConnectSettings as openHealthConnectNativeSettings,
  openHealthConnectDataManagement,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { Linking, Platform } from 'react-native';
import { BloodGlucoseSample, DailySummary, HeartRateSample, WorkoutSession } from '../types/health';

const HC_PACKAGE = 'com.google.android.apps.healthdata';

export async function isHealthConnectAvailable(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const status = await getSdkStatus(HC_PACKAGE);
    return status === SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

export async function hasHealthConnectPermissions(): Promise<boolean> {
  try {
    const ready = await initHealthConnect();
    if (!ready) return false;
    const granted = await getGrantedPermissions();
    return granted.some((p) => p.recordType === 'Steps' || p.recordType === 'HeartRate');
  } catch {
    return false;
  }
}

export async function initHealthConnect(): Promise<boolean> {
  try {
    const status = await getSdkStatus(HC_PACKAGE);
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return false;
    return initialize(HC_PACKAGE);
  } catch {
    return false;
  }
}

const HC_PERMISSIONS = [
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'RestingHeartRate' },
  { accessType: 'read', recordType: 'BloodGlucose' },
] as const;

/**
 * Requests Health Connect permissions via the native dialog.
 * Returns true if at least one permission was granted.
 * Falls back to Linking if the native dialog cannot be launched.
 */
export async function requestHealthConnectPermissions(): Promise<boolean> {
  const ready = await initHealthConnect();
  if (!ready) {
    await openHealthConnectSettings();
    return false;
  }
  try {
    const granted = await requestPermission([...HC_PERMISSIONS]);
    return granted.length > 0;
  } catch {
    // Native dialog failed — open Health Connect manually as fallback
    await openHealthConnectSettings();
    return false;
  }
}

/** Opens Health Connect settings for manual permission management. */
export async function openHealthConnectSettings(): Promise<void> {
  try {
    openHealthConnectDataManagement(HC_PACKAGE);
    return;
  } catch {
    // fallback below
  }
  try {
    openHealthConnectNativeSettings();
    return;
  } catch {
    // fallback below
  }
  await Linking.openURL(`market://details?id=${HC_PACKAGE}`).catch(() =>
    Linking.openURL(`https://play.google.com/store/apps/details?id=${HC_PACKAGE}`)
  );
}

export async function fetchTodayHeartRate(): Promise<HeartRateSample[]> {
  try {
    const ready = await initHealthConnect();
    if (!ready) return [];
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
    const ready = await initHealthConnect();
    if (!ready) return {};
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const filter = {
      timeRangeFilter: {
        operator: 'between' as const,
        startTime: start.toISOString(),
        endTime: new Date().toISOString(),
      },
    };

    const [stepsRes, distRes, calRes, restHRRes, exRes] = await Promise.all([
      readRecords('Steps', filter),
      readRecords('Distance', filter),
      readRecords('ActiveCaloriesBurned', filter),
      readRecords('RestingHeartRate', filter),
      readRecords('ExerciseSession', filter),
    ]);

    const steps = (stepsRes.records as any[]).reduce((s, r) => s + r.count, 0);
    const distanceMeters = (distRes.records as any[]).reduce((s, r) => s + (r.distance?.inMeters ?? 0), 0);
    const calories = (calRes.records as any[]).reduce((s, r) => s + (r.energy?.inKilocalories ?? 0), 0);
    const restingHR = (restHRRes.records as any[]).at(-1)?.beatsPerMinute;
    const workouts: WorkoutSession[] = (exRes.records as any[]).map((r) => ({
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

const MEAL_MAP: Record<number, BloodGlucoseSample['relationToMeal']> = {
  1: 'fasting',
  2: 'before_meal',
  3: 'after_meal',
  4: 'general',
};

export async function fetchTodayBloodGlucose(): Promise<BloodGlucoseSample[]> {
  try {
    const ready = await initHealthConnect();
    if (!ready) return [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { records } = await readRecords('BloodGlucose', {
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: new Date().toISOString(),
      },
    });
    return (records as any[]).map((r) => {
      const mgPerDl =
        r.level?.inMilligramsPerDeciliter ??
        (r.level?.inMillimolesPerLiter !== undefined ? r.level.inMillimolesPerLiter * 18.016 : 0);
      return {
        timestamp: new Date(r.time),
        mgPerDl: Math.round(mgPerDl),
        relationToMeal: MEAL_MAP[r.relationToMeal] ?? 'general',
        source: 'samsung' as const,
      };
    });
  } catch {
    return [];
  }
}
