import * as SecureStore from 'expo-secure-store';
import { WorkoutSession, HeartRateSample } from '../types/health';

const IFIT_API_BASE = 'https://api.ifit.com/v1';

// Known iFit OAuth endpoints to try in order
const TOKEN_URLS = [
  'https://www.ifit.com/api/v1/oauth/token',
  'https://www.ifit.com/api/v1/oauth2/token',
  'https://api.ifit.com/v1/oauth/token',
];

// iFit mobile app client credentials (from community reverse engineering)
const IFIT_CLIENT_ID = 'ig-public-key';
const IFIT_CLIENT_SECRET = 'igPublicSecret';

const KEY_ACCESS = 'ifit_access_token';
const KEY_REFRESH = 'ifit_refresh_token';
const KEY_EXPIRY = 'ifit_token_expiry';
const KEY_TOKEN_URL = 'ifit_working_token_url';

export interface LoginResult {
  success: boolean;
  error?: string;
}

export async function loginWithiFit(email: string, password: string): Promise<LoginResult> {
  // Try each endpoint until one works
  for (const url of TOKEN_URLS) {
    const resp = await fetch(url, {
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

    let body: any = {};
    try { body = await resp.json(); } catch {}

    if (resp.ok && body.access_token) {
      await storeTokens(body);
      await SecureStore.setItemAsync(KEY_TOKEN_URL, url);
      return { success: true };
    }

    // If it's a 401/400 with an error body, that endpoint is reachable — wrong creds
    if (resp.status === 400 || resp.status === 401) {
      const errorDetail = body.error_description ?? body.error ?? body.message ?? `HTTP ${resp.status}`;
      return { success: false, error: `Auth failed (${url}): ${errorDetail}` };
    }
    // 404/5xx — try next URL
  }

  return { success: false, error: 'Could not reach any iFit API endpoint. Check your internet connection.' };
}

export async function logoutFromiFit(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_ACCESS);
  await SecureStore.deleteItemAsync(KEY_REFRESH);
  await SecureStore.deleteItemAsync(KEY_EXPIRY);
  await SecureStore.deleteItemAsync(KEY_TOKEN_URL);
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
  const [refreshToken, tokenUrl] = await Promise.all([
    SecureStore.getItemAsync(KEY_REFRESH),
    SecureStore.getItemAsync(KEY_TOKEN_URL),
  ]);
  if (!refreshToken || !tokenUrl) return null;

  const resp = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: IFIT_CLIENT_ID,
      client_secret: IFIT_CLIENT_SECRET,
    }).toString(),
  });

  if (!resp.ok) { await logoutFromiFit(); return null; }
  const data = await resp.json();
  await storeTokens(data);
  return data.access_token;
}

async function storeTokens(data: { access_token: string; refresh_token?: string; expires_in: number }) {
  await SecureStore.setItemAsync(KEY_ACCESS, data.access_token);
  if (data.refresh_token) await SecureStore.setItemAsync(KEY_REFRESH, data.refresh_token);
  await SecureStore.setItemAsync(KEY_EXPIRY, String(Date.now() + data.expires_in * 1000 - 60_000));
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

export async function fetchiFitHeartRateForWorkout(workoutId: string): Promise<HeartRateSample[]> {
  const data = await iFitGet<{ items: any[] }>(`/workouts/${workoutId}/heart_rate`);
  return (data.items ?? []).map((s) => ({
    timestamp: new Date(s.timestamp),
    bpm: s.heart_rate,
    source: 'ifit' as const,
  }));
}
