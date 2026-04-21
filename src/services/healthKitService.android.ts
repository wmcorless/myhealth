// Android stub — Samsung Health is handled by healthConnectService.ts
import { DailySummary, HeartRateSample } from '../types/health';

export function initHealthKit(): Promise<void> {
  return Promise.resolve();
}

export function fetchTodayHeartRate(): Promise<HeartRateSample[]> {
  return Promise.resolve([]);
}

export function fetchTodaySummary(): Promise<Partial<DailySummary>> {
  return Promise.resolve({});
}
