import * as SecureStore from 'expo-secure-store';
import { IFIT_API_BASE, IFIT_TOKEN_URL } from '../config/env';
import { WorkoutSession, HeartRateSample } from '../types/health';

// iFit uses the same client credentials their mobile app uses
const IFIT_CLIENT_ID = 'my-fitness-pal';
const IFIT_CLIENT_SECRET = 'OAuthSecret';

const KEY_ACCESS = 'ifit_access_token';
const KEY_REFRESH = 'ifit_refresh_token';
const KEY_EXPIRY = 'ifit_token_expiry';

export async function loginWithiFit(email: string, password: string): Promise<boolean> {
  const resp = await fetch(IFIT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      username: email,
      password,
      client_id: IFIT_CLIENT_ID,
      client_secret: IFIT_CLIENT_SECRET,
    }).toString(),
  });

  if (!resp.ok) return false;
  await storeTokens(await resp.json());
  return true;
}

export async function logoutFromiFit(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_ACCESS);
  await SecureStore.deleteItemAsync(KEY_REFRESH);
  await SecureStore.deleteItemAsync(KEY_EXPIRY);
}

export async function isiFitConnected(): Promise<boolean> {
  const token = await getStoredToken();
  return token !== null;
}

export async function getStoredToken(): Promise<string | null> {
  const expiry = await SecureStore.getItemAsync(KEY_EXPIRY);
  if (expiry && Date.now() < Number(expiry)) {
    return SecureStore.getItemAsync(KEY_ACCESS);
  }
  return refreshAccessToken();
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(KEY_REFRESH);
  if (!refreshToken) return null;

  const resp = await fetch(IFIT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: IFIT_CLIENT_ID,
      client_secret: IFIT_CLIENT_SECRET,
    }).toString(),
  });

  if (!resp.ok) {
    await logoutFromiFit();
    return null;
  }
  const data = await resp.json();
  await storeTokens(data);
  return data.access_token;
}

async function storeTokens(data: {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}) {
  await SecureStore.setItemAsync(KEY_ACCESS, data.access_token);
  if (data.refresh_token) {
    await SecureStore.setItemAsync(KEY_REFRESH, data.refresh_token);
  }
  await SecureStore.setItemAsync(
    KEY_EXPIRY,
    String(Date.now() + data.expires_in * 1000 - 60_000)
  );
}

async function iFitGet<T>(path: string): Promise<T> {
  const token = await getStoredToken();
  if (!token) throw new Error('Not authenticated with iFit');

  const resp = await fetch(`${IFIT_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`iFit API error: ${resp.status}`);
  return resp.json();
}

export async function fetchiFitWorkouts(limit = 20): Promise<WorkoutSession[]> {
  const data = await iFitGet<{ items: any[] }>(`/workouts?limit=${limit}`);
  return (data.items ?? []).map((w) => ({
    id: w.id,
    startTime: new Date(w.created_at),
    endTime: w.completed_at ? new Date(w.completed_at) : undefined,
    type: w.workout_type?.toLowerCase().includes('treadmill') ? 'treadmill' : 'other',
    distanceMeters: w.distance_meters,
    avgHeartRate: w.avg_heart_rate,
    maxHeartRate: w.max_heart_rate,
    calories: w.calories,
    source: 'ifit' as const,
  }));
}

export async function fetchiFitHeartRateForWorkout(
  workoutId: string
): Promise<HeartRateSample[]> {
  const data = await iFitGet<{ items: any[] }>(`/workouts/${workoutId}/heart_rate`);
  return (data.items ?? []).map((s) => ({
    timestamp: new Date(s.timestamp),
    bpm: s.heart_rate,
    source: 'ifit' as const,
  }));
}
