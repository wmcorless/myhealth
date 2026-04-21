import * as SQLite from 'expo-sqlite';
import { WorkoutSession, HeartRateSample, BloodGlucoseSample, DailySummary } from '../types/health';

let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) db = await SQLite.openDatabaseAsync('myhealth.db');
  return db;
}

export async function initDatabase(): Promise<void> {
  const d = await getDb();
  await d.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS workout_sessions (
      id TEXT PRIMARY KEY,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      type TEXT NOT NULL DEFAULT 'other',
      distance_meters REAL,
      avg_heart_rate INTEGER,
      max_heart_rate INTEGER,
      calories REAL,
      source TEXT NOT NULL DEFAULT 'manual'
    );

    CREATE TABLE IF NOT EXISTS heart_rate_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      bpm INTEGER NOT NULL,
      source TEXT NOT NULL,
      date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blood_glucose_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      mg_per_dl INTEGER NOT NULL,
      relation_to_meal TEXT,
      source TEXT NOT NULL,
      date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_summaries (
      date TEXT PRIMARY KEY,
      steps INTEGER,
      total_distance_meters REAL,
      calories_burned REAL,
      avg_heart_rate INTEGER,
      resting_heart_rate INTEGER,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS treadmill_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      max_speed_kph REAL,
      avg_speed_kph REAL,
      max_incline_percent REAL,
      distance_meters REAL,
      calories INTEGER,
      max_heart_rate INTEGER,
      avg_heart_rate INTEGER,
      elapsed_seconds INTEGER
    );
  `);
}

// ─── Workout Sessions ────────────────────────────────────────────────────────

export async function saveWorkouts(workouts: WorkoutSession[]): Promise<void> {
  if (!workouts.length) return;
  const d = await getDb();
  await d.withTransactionAsync(async () => {
    for (const w of workouts) {
      await d.runAsync(
        `INSERT OR REPLACE INTO workout_sessions
          (id, start_time, end_time, type, distance_meters, avg_heart_rate, max_heart_rate, calories, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          w.id,
          w.startTime.getTime(),
          w.endTime?.getTime() ?? null,
          w.type,
          w.distanceMeters ?? null,
          w.avgHeartRate ?? null,
          w.maxHeartRate ?? null,
          w.calories ?? null,
          w.source,
        ],
      );
    }
  });
}

export async function getWorkouts(limitDays = 30): Promise<WorkoutSession[]> {
  const d = await getDb();
  const cutoff = Date.now() - limitDays * 24 * 60 * 60 * 1000;
  const rows = await d.getAllAsync<any>(
    'SELECT * FROM workout_sessions WHERE start_time >= ? ORDER BY start_time DESC',
    [cutoff],
  );
  return rows.map(rowToWorkout);
}

export async function getWorkoutsForDate(date: Date): Promise<WorkoutSession[]> {
  const d = await getDb();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  const rows = await d.getAllAsync<any>(
    'SELECT * FROM workout_sessions WHERE start_time >= ? AND start_time <= ? ORDER BY start_time DESC',
    [start.getTime(), end.getTime()],
  );
  return rows.map(rowToWorkout);
}

function rowToWorkout(r: any): WorkoutSession {
  return {
    id: r.id,
    startTime: new Date(r.start_time),
    endTime: r.end_time ? new Date(r.end_time) : undefined,
    type: r.type,
    distanceMeters: r.distance_meters ?? undefined,
    avgHeartRate: r.avg_heart_rate ?? undefined,
    maxHeartRate: r.max_heart_rate ?? undefined,
    calories: r.calories ?? undefined,
    source: r.source,
  };
}

// ─── Treadmill Sessions ──────────────────────────────────────────────────────

export interface TreadmillSessionRecord {
  id: number;
  startTime: Date;
  endTime: Date;
  maxSpeedKph?: number;
  avgSpeedKph?: number;
  maxInclinePercent?: number;
  distanceMeters?: number;
  calories?: number;
  maxHeartRate?: number;
  avgHeartRate?: number;
  elapsedSeconds?: number;
}

export async function saveTreadmillSession(session: Omit<TreadmillSessionRecord, 'id'>): Promise<void> {
  const d = await getDb();
  await d.runAsync(
    `INSERT INTO treadmill_sessions
      (start_time, end_time, max_speed_kph, avg_speed_kph, max_incline_percent,
       distance_meters, calories, max_heart_rate, avg_heart_rate, elapsed_seconds)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.startTime.getTime(),
      session.endTime.getTime(),
      session.maxSpeedKph ?? null,
      session.avgSpeedKph ?? null,
      session.maxInclinePercent ?? null,
      session.distanceMeters ?? null,
      session.calories ?? null,
      session.maxHeartRate ?? null,
      session.avgHeartRate ?? null,
      session.elapsedSeconds ?? null,
    ],
  );
}

export async function getTreadmillSessions(limitDays = 30): Promise<TreadmillSessionRecord[]> {
  const d = await getDb();
  const cutoff = Date.now() - limitDays * 24 * 60 * 60 * 1000;
  const rows = await d.getAllAsync<any>(
    'SELECT * FROM treadmill_sessions WHERE start_time >= ? ORDER BY start_time DESC',
    [cutoff],
  );
  return rows.map((r) => ({
    id: r.id,
    startTime: new Date(r.start_time),
    endTime: new Date(r.end_time),
    maxSpeedKph: r.max_speed_kph ?? undefined,
    avgSpeedKph: r.avg_speed_kph ?? undefined,
    maxInclinePercent: r.max_incline_percent ?? undefined,
    distanceMeters: r.distance_meters ?? undefined,
    calories: r.calories ?? undefined,
    maxHeartRate: r.max_heart_rate ?? undefined,
    avgHeartRate: r.avg_heart_rate ?? undefined,
    elapsedSeconds: r.elapsed_seconds ?? undefined,
  }));
}

// ─── Heart Rate ──────────────────────────────────────────────────────────────

export async function saveHeartRateSamples(samples: HeartRateSample[]): Promise<void> {
  if (!samples.length) return;
  const d = await getDb();
  const date = toDateStr(samples[0].timestamp);
  await d.runAsync('DELETE FROM heart_rate_samples WHERE date = ?', [date]);
  await d.withTransactionAsync(async () => {
    for (const s of samples) {
      await d.runAsync(
        'INSERT INTO heart_rate_samples (timestamp, bpm, source, date) VALUES (?, ?, ?, ?)',
        [s.timestamp.getTime(), s.bpm, s.source, toDateStr(s.timestamp)],
      );
    }
  });
}

export async function getHeartRateForDate(date: Date): Promise<HeartRateSample[]> {
  const d = await getDb();
  const rows = await d.getAllAsync<any>(
    'SELECT * FROM heart_rate_samples WHERE date = ? ORDER BY timestamp ASC',
    [toDateStr(date)],
  );
  return rows.map((r) => ({
    timestamp: new Date(r.timestamp),
    bpm: r.bpm,
    source: r.source,
  }));
}

// ─── Blood Glucose ───────────────────────────────────────────────────────────

export async function saveBloodGlucoseSamples(samples: BloodGlucoseSample[]): Promise<void> {
  if (!samples.length) return;
  const d = await getDb();
  const date = toDateStr(samples[0].timestamp);
  await d.runAsync('DELETE FROM blood_glucose_readings WHERE date = ?', [date]);
  await d.withTransactionAsync(async () => {
    for (const s of samples) {
      await d.runAsync(
        'INSERT INTO blood_glucose_readings (timestamp, mg_per_dl, relation_to_meal, source, date) VALUES (?, ?, ?, ?, ?)',
        [s.timestamp.getTime(), s.mgPerDl, s.relationToMeal ?? null, s.source, toDateStr(s.timestamp)],
      );
    }
  });
}

export async function getBloodGlucoseForDate(date: Date): Promise<BloodGlucoseSample[]> {
  const d = await getDb();
  const rows = await d.getAllAsync<any>(
    'SELECT * FROM blood_glucose_readings WHERE date = ? ORDER BY timestamp DESC',
    [toDateStr(date)],
  );
  return rows.map((r) => ({
    timestamp: new Date(r.timestamp),
    mgPerDl: r.mg_per_dl,
    relationToMeal: r.relation_to_meal ?? undefined,
    source: r.source,
  }));
}

// ─── Daily Summary ───────────────────────────────────────────────────────────

export async function saveDailySummary(summary: DailySummary): Promise<void> {
  const d = await getDb();
  await d.runAsync(
    `INSERT OR REPLACE INTO daily_summaries
      (date, steps, total_distance_meters, calories_burned, avg_heart_rate, resting_heart_rate, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      toDateStr(summary.date),
      summary.steps ?? null,
      summary.totalDistanceMeters ?? null,
      summary.caloriesBurned ?? null,
      summary.avgHeartRate ?? null,
      summary.restingHeartRate ?? null,
      Date.now(),
    ],
  );
}

export async function getDailySummaries(limitDays = 30): Promise<DailySummary[]> {
  const d = await getDb();
  const rows = await d.getAllAsync<any>(
    'SELECT * FROM daily_summaries ORDER BY date DESC LIMIT ?',
    [limitDays],
  );
  return rows.map((r) => ({
    date: new Date(r.date),
    steps: r.steps ?? undefined,
    totalDistanceMeters: r.total_distance_meters ?? undefined,
    caloriesBurned: r.calories_burned ?? undefined,
    avgHeartRate: r.avg_heart_rate ?? undefined,
    restingHeartRate: r.resting_heart_rate ?? undefined,
    workouts: [],
  }));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}
