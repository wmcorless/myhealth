import { DailySummary, HeartRateSample } from '../types/health';

export async function isHealthConnectAvailable(): Promise<boolean> {
  return false;
}

export async function initHealthConnect(): Promise<boolean> {
  return false;
}

export async function requestHealthConnectPermissions(): Promise<boolean> {
  return false;
}

export async function fetchTodayHeartRate(): Promise<HeartRateSample[]> {
  return [];
}

export async function fetchTodaySummary(): Promise<Partial<DailySummary>> {
  return {};
}
