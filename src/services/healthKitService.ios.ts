// iOS HealthKit — stubbed until native build is confirmed stable.
// Re-enable by installing react-native-health and replacing this file.
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
