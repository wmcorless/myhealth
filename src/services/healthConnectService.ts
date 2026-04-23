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

    // Deduplicate across sources: group by app, sum non-overlapping intervals, take max
    const steps = bestValueFromSources(stepsRes.records as any[], (r) => r.count);
    const distanceMeters = bestValueFromSources(distRes.records as any[], (r) => r.distance?.inMeters ?? 0);

    // Active calories only (TotalCaloriesBurned includes BMR ~2000 kcal — too high)
    const activeCalories = bestValueFromSources(activeCalRes.records as any[], (r) => r.energy?.inKilocalories ?? 0);
    // Fallback: sum energy from exercise sessions if ActiveCaloriesBurned is empty
    const exerciseCalories = (exRes.records as any[]).reduce((s, r) => s + (r.energy?.inKilocalories ?? 0), 0);
    const calories = activeCalories > 0 ? activeCalories : exerciseCalories;

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

/**
 * Sum values from non-overlapping time intervals (single source).
 * Records are sorted by startTime ASC, then interval length DESC so that
 * a daily aggregate is preferred over shorter segments with the same start.
 */
function sumNoOverlap(records: any[], getValue: (r: any) => number): number {
  if (!records.length) return 0;
  const intervals = records
    .map((r) => ({
      start: new Date(r.startTime).getTime(),
      end: new Date(r.endTime).getTime(),
      value: getValue(r),
    }))
    .sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  let total = 0;
  let coveredUntil = 0;
  for (const iv of intervals) {
    if (iv.start >= coveredUntil) {
      total += iv.value;
      coveredUntil = iv.end;
    }
    // Overlapping records from the same source are skipped
  }
  return total;
}

/**
 * When multiple apps (e.g. Samsung Health + Google Health) each write the same
 * metric to Health Connect, summing all records double-counts the same activity.
 * Fix: group by data origin, sum non-overlapping intervals within each source,
 * then return the maximum across sources (the authoritative source wins).
 */
function bestValueFromSources(records: any[], getValue: (r: any) => number): number {
  if (!records.length) return 0;
  const byOrigin: Record<string, any[]> = {};
  for (const r of records as any[]) {
    const origin = (r.metadata?.dataOrigin as string) ?? 'unknown';
    if (!byOrigin[origin]) byOrigin[origin] = [];
    byOrigin[origin].push(r);
  }
  let best = 0;
  for (const recs of Object.values(byOrigin)) {
    const total = sumNoOverlap(recs, getValue);
    if (total > best) best = total;
  }
  return best;
}

: Record<number, BloodGlucoseSample['relationToMeal']> = {
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
