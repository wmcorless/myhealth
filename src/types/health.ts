export interface HeartRateSample {
  timestamp: Date;
  bpm: number;
  source: 'samsung' | 'ifit' | 'manual';
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
  source: 'samsung' | 'ifit' | 'manual';
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
}

export interface DeviceStatus {
  id: 'samsung_health' | 'ifit';
  name: string;
  connected: boolean;
  lastSync?: Date;
}
