// Android Health Connect — stubbed until native build is confirmed stable.
// Re-enable by installing react-native-health-connect and replacing this file.
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
