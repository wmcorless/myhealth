import * as SecureStore from 'expo-secure-store';
import { WorkoutSession, HeartRateSample } from '../types/health';

const IFIT_API_BASE = 'https://api.ifit.com/v1';
const IFIT_TOKEN_URL = 'https://api.ifit.com/oauth/token';
const IFIT_LOGIN_URL = 'https://www.ifit.com/web-api/login';
const IFIT_SETTINGS_URL = 'https://www.ifit.com/settings/apps';

const KEY_ACCESS = 'ifit_access_token';
const KEY_REFRESH = 'ifit_refresh_token';
const KEY_EXPIRY = 'ifit_token_expiry';
const KEY_CLIENT_ID = 'ifit_client_id';
const KEY_CLIENT_SECRET = 'ifit_client_secret';

export interface LoginResult {
  success: boolean;
  error?: string;
}

export async function loginWithiFit(email: string, password: string): Promise<LoginResult> {
  try {
    // Step 1: Log in to iFit web to get a session cookie
    const loginResp = await fetch(IFIT_LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!loginResp.ok) {
      let msg = `Login failed (HTTP ${loginResp.status})`;
      try { const b = await loginResp.json(); msg = b.message ?? b.error ?? msg; } catch {}
      return { success: false, error: msg };
    }

    // Extract session cookie to authenticate the settings page request
    const cookie = loginResp.headers.get('set-cookie') ?? '';

    // Step 2: Fetch the settings page to extract dynamic client credentials
    const settingsResp = await fetch(IFIT_SETTINGS_URL, {
      headers: { Cookie: cookie, Accept: 'text/html' },
    });

    if (!settingsResp.ok) {
      return { success: false, error: `Could not load iFit settings page (HTTP ${settingsResp.status})` };
    }

    const html = await settingsResp.text();

    // Extract client_id and client_secret embedded in the page JS
    const clientIdMatch = html.match(/'clientId'\s*:\s*'([^']+)'/) ??
                          html.match(/"clientId"\s*:\s*"([^"]+)"/);
    const clientSecretMatch = html.match(/'clientSecret'\s*:\s*'([^']+)'/) ??
                              html.match(/"clientSecret"\s*:\s*"([^"]+)"/);

    if (!clientIdMatch || !clientSecretMatch) {
      return { success: false, error: 'Could not extract iFit API credentials from settings page. iFit may have changed their web interface.' };
    }

    const clientId = clientIdMatch[1];
    const clientSecret = clientSecretMatch[1];

    // Step 3: Exchange username/password for OAuth token using extracted credentials
    const tokenResp = await fetch(IFIT_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        username: email,
        password,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    let tokenBody: any = {};
    try { tokenBody = await tokenResp.json(); } catch {}

    if (!tokenResp.ok || !tokenBody.access_token) {
      const msg = tokenBody.error_description ?? tokenBody.error ?? tokenBody.message ?? `Token request failed (HTTP ${tokenResp.status})`;
      return { success: false, error: msg };
    }

    await Promise.all([
      storeTokens(tokenBody),
      SecureStore.setItemAsync(KEY_CLIENT_ID, clientId),
      SecureStore.setItemAsync(KEY_CLIENT_SECRET, clientSecret),
    ]);

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unexpected error during iFit login' };
  }
}

export async function logoutFromiFit(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_ACCESS),
    SecureStore.deleteItemAsync(KEY_REFRESH),
    SecureStore.deleteItemAsync(KEY_EXPIRY),
    SecureStore.deleteItemAsync(KEY_CLIENT_ID),
    SecureStore.deleteItemAsync(KEY_CLIENT_SECRET),
  ]);
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
  const [refreshToken, clientId, clientSecret] = await Promise.all([
    SecureStore.getItemAsync(KEY_REFRESH),
    SecureStore.getItemAsync(KEY_CLIENT_ID),
    SecureStore.getItemAsync(KEY_CLIENT_SECRET),
  ]);
  if (!refreshToken || !clientId || !clientSecret) return null;

  const resp = await fetch(IFIT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
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
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!resp.ok) throw new Error(`iFit API error: ${resp.status}`);
  return resp.json();
}

export async function fetchiFitWorkouts(limit = 20): Promise<WorkoutSession[]> {
  const data = await iFitGet<{ items?: any[]; results?: any[] }>(
    `/activity_logs/?platform=android&perPage=${limit}`
  );
  const items = data.items ?? data.results ?? [];
  return items.map((w: any) => ({
    id: w.id ?? String(Math.random()),
    startTime: new Date(w.created_at ?? w.startTime ?? Date.now()),
    endTime: w.completed_at ? new Date(w.completed_at) : undefined,
    type: (w.workout_type ?? w.type ?? '').toLowerCase().includes('treadmill') ? 'treadmill' : 'other',
    distanceMeters: w.distance_meters ?? w.distance,
    avgHeartRate: w.avg_heart_rate ?? w.averageHeartRate,
    maxHeartRate: w.max_heart_rate ?? w.maxHeartRate,
    calories: w.calories ?? w.caloriesBurned,
    source: 'ifit' as const,
  }));
}

export async function fetchiFitHeartRateForWorkout(workoutId: string): Promise<HeartRateSample[]> {
  try {
    const data = await iFitGet<{ items?: any[]; results?: any[] }>(
      `/activity_logs/${workoutId}/heart_rate`
    );
    const items = data.items ?? data.results ?? [];
    return items.map((s: any) => ({
      timestamp: new Date(s.timestamp ?? s.time ?? Date.now()),
      bpm: s.heart_rate ?? s.heartRate ?? s.bpm,
      source: 'ifit' as const,
    }));
  } catch {
    return [];
  }
}
