import {
  initialize,
  requestPermission,
  readRecords,
  getSdkStatus,
  getGrantedPermissions,
  openHealthConnectSettings as openHealthConnectNativeSettings,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { Linking, Platform } from 'react-native';
import { BloodGlucoseSample, DailySummary, HeartRateSample, WorkoutSession } from '../types/health';

const HC_PACKAGE = 'com.google.android.apps.healthdata';

export async function isHealthConnectAvailable(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const status = await getSdkStatus();
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
    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return false;
    return initialize();
  } catch {
    return false;
  }
}

const HC_CORE_PERMISSIONS = [
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'Steps' },
 ] as const;

const HC_OPTIONAL_PERMISSIONS = [
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
  { accessType: 'read', recordType: 'RestingHeartRate' },
  { accessType: 'read', recordType: 'BloodGlucose' },
] as const;

/**
 * Requests Health Connect permissions via the native dialog.
 * All permissions are requested in a single dialog to avoid showing
 * two separate HC prompts.
 * Returns true if at least one core permission was granted.
 * Falls back to false if the native dialog cannot be launched.
 */
export async function requestHealthConnectPermissions(): Promise<boolean> {
  const ready = await initHealthConnect();
  if (!ready) return false;
  try {
    const alreadyGranted = await getGrantedPermissions();
    const hasCore = alreadyGranted.some((p) => p.recordType === 'HeartRate' || p.recordType === 'Steps');
    if (hasCore) return true;
    // Request all permissions in one dialog
    const allPermissions = [...HC_CORE_PERMISSIONS, ...HC_OPTIONAL_PERMISSIONS];
    const granted = await requestPermission([...allPermissions]);
    return granted.some((p) => p.recordType === 'HeartRate' || p.recordType === 'Steps');
  } catch {
    return false;
  }
}

/** Opens Health Connect settings for manual permission management. */
export async function openHealthConnectSettings(): Promise<void> {
  try {
    openHealthConnectNativeSettings();
    return;
  } catch {
    // fallback below
  }
}

export async function openHealthConnectInstallPage(): Promise<void> {
  await Linking.openURL(`market://details?id=${HC_PACKAGE}&url=healthconnect%3A%2F%2Fonboarding`).catch(() =>
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

    const [stepsRes, distRes, activeCalRes, totalCalRes, restHRRes, exRes] = await Promise.all([
      readRecords('Steps', filter),
      readRecords('Distance', filter),
      readRecords('ActiveCaloriesBurned', filter),
      readRecords('TotalCaloriesBurned', filter),
      readRecords('RestingHeartRate', filter),
      readRecords('ExerciseSession', filter),
    ]);

    const steps = (stepsRes.records as any[]).reduce((s, r) => s + r.count, 0);
    const distanceMeters = (distRes.records as any[]).reduce((s, r) => s + (r.distance?.inMeters ?? 0), 0);
    const activeCalories = (activeCalRes.records as any[]).reduce((s, r) => s + (r.energy?.inKilocalories ?? 0), 0);
    const totalCalories = (totalCalRes.records as any[]).reduce((s, r) => s + (r.energy?.inKilocalories ?? 0), 0);
    // Samsung Health syncs to TotalCaloriesBurned; fall back to active if total is empty
    const calories = totalCalories > 0 ? totalCalories : activeCalories;
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
