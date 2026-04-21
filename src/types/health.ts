export interface HeartRateSample {
  timestamp: Date;
  bpm: number;
  source: 'samsung' | 'manual';
}

export interface WorkoutSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  type: 'treadmill' | 'walk' | 'run' | 'other';
  distanceMeters?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  calories?: number;
  source: 'samsung' | 'manual';
}

export interface DailySummary {
  date: Date;
  steps?: number;
  totalDistanceMeters?: number;
  activeMinutes?: number;
  avgHeartRate?: number;
  restingHeartRate?: number;
  caloriesBurned?: number;
  workouts: WorkoutSession[];
  latestBloodGlucose?: BloodGlucoseSample;
}

export interface DeviceStatus {
  id: 'samsung_health' | 'nordictrack';
  name: string;
  connected: boolean;
  lastSync?: Date;
}

export type GlucoseTrend =
  | 'rising_fast' | 'rising' | 'rising_slow'
  | 'steady'
  | 'falling_slow' | 'falling' | 'falling_fast';

export interface BloodGlucoseSample {
  timestamp: Date;
  mgPerDl: number;
  relationToMeal?: 'fasting' | 'before_meal' | 'after_meal' | 'general';
  trend?: GlucoseTrend;
  source: 'samsung' | 'dexcom' | 'manual';
}

export interface TreadmillData {
  speedKph: number;
  inclinePercent: number;
  distanceMeters: number;
  heartRate?: number;
  calories?: number;
  elapsedSeconds: number;
}
