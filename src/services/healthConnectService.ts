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
    const todayFilter = {
      timeRangeFilter: {
        operator: 'between' as const,
        startTime: start.toISOString(),
        endTime: new Date().toISOString(),
      },
    };

    // Resting HR: Samsung Health writes it infrequently — look back 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const restHRFilter = {
      timeRangeFilter: {
        operator: 'between' as const,
        startTime: sevenDaysAgo.toISOString(),
        endTime: new Date().toISOString(),
      },
    };

    const [stepsRes, distRes, activeCalRes, restHRRes, exRes] = await Promise.all([
      readRecords('Steps', todayFilter),
      readRecords('Distance', todayFilter),
      readRecords('ActiveCaloriesBurned', todayFilter),
      readRecords('RestingHeartRate', restHRFilter),
      readRecords('ExerciseSession', todayFilter),
    ]);

    // Prefer Samsung Health as authoritative source; dedup overlapping intervals
    const steps = Math.round(fromSamsung(stepsRes.records as any[], (r) => r.count));
    const distFromRecords = fromSamsung(distRes.records as any[], (r) => r.distance?.inMeters ?? 0);

    // Samsung Health does not write Distance records for all walking — only tracked workouts.
    // Fallback: estimate from steps using average stride length (0.762 m/step).
    const distFromSteps = steps > 200 ? steps * 0.762 : 0;
    const distanceMeters = distFromRecords >= distFromSteps * 0.5 ? distFromRecords : distFromSteps;

    // Active calories only (TotalCaloriesBurned includes BMR ~2000 kcal — too high).
    // Samsung Health may not write ActiveCaloriesBurned for passive walking —
    // fall back to ExerciseSession energy, then step-based estimate (0.05 kcal/step).
    const activeCalories = fromSamsung(activeCalRes.records as any[], (r) => r.energy?.inKilocalories ?? 0);
    const exerciseCalories = fromSamsung(exRes.records as any[], (r) => r.energy?.inKilocalories ?? 0);
    const stepCalEstimate = steps > 200 ? Math.round(steps * 0.05) : 0;
    const calories = activeCalories > 0 ? activeCalories
      : exerciseCalories > 0 ? exerciseCalories
      : stepCalEstimate;

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

const SAMSUNG_PKGS = new Set([
  'com.sec.android.app.shealth',
  'com.samsung.android.wear.shealth',
]);

/**
 * dataOrigin can be a plain string or { packageName: string } depending on
 * the react-native-health-connect version. Handle both.
 */
function getDataOrigin(r: any): string {
  const o = r.metadata?.dataOrigin;
  if (typeof o === 'string') return o;
  if (o && typeof o === 'object') return (o.packageName as string) ?? 'unknown';
  return 'unknown';
}

/**
 * Sum values across non-overlapping time intervals.
 * Sorted by startTime ASC, then duration DESC so daily aggregates beat sub-intervals.
 */
function sumNoOverlap(records: any[], getValue: (r: any) => number): number {
  if (!records.length) return 0;
  const ivs = records
    .map((r) => ({
      start: new Date(r.startTime).getTime(),
      end: new Date(r.endTime).getTime(),
      value: getValue(r),
    }))
    .filter((iv) => iv.end > iv.start)
    .sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  let total = 0;
  let covered = 0;
  for (const iv of ivs) {
    if (iv.start >= covered) { total += iv.value; covered = iv.end; }
  }
  return total;
}

/**
 * Prefer Samsung Health records. If none found, fall back to all records.
 * Within the chosen set, deduplicate overlapping intervals before summing.
 * This prevents Google Health daily-aggregate records from shadowing Samsung's
 * more granular (and more accurate) interval records.
 */
function fromSamsung(records: any[], getValue: (r: any) => number): number {
  const samsung = records.filter((r) => SAMSUNG_PKGS.has(getDataOrigin(r)));
  return sumNoOverlap(samsung.length > 0 ? samsung : records, getValue);
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
