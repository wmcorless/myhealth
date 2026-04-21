import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import {
  IFIT_CLIENT_ID,
  IFIT_CLIENT_SECRET,
  IFIT_REDIRECT_URI,
  IFIT_API_BASE,
  IFIT_AUTH_URL,
  IFIT_TOKEN_URL,
} from '../config/env';
import { WorkoutSession, HeartRateSample } from '../types/health';

const STORAGE_KEY_ACCESS = 'ifit_access_token';
const STORAGE_KEY_REFRESH = 'ifit_refresh_token';
const STORAGE_KEY_EXPIRY = 'ifit_token_expiry';

export async function getStoredToken(): Promise<string | null> {
  const expiry = await SecureStore.getItemAsync(STORAGE_KEY_EXPIRY);
  if (expiry && Date.now() < Number(expiry)) {
    return SecureStore.getItemAsync(STORAGE_KEY_ACCESS);
  }
  return refreshAccessToken();
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(STORAGE_KEY_REFRESH);
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

  if (!resp.ok) return null;
  const data = await resp.json();
  await storeTokens(data);
  return data.access_token;
}

async function storeTokens(data: {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}) {
  await SecureStore.setItemAsync(STORAGE_KEY_ACCESS, data.access_token);
  if (data.refresh_token) {
    await SecureStore.setItemAsync(STORAGE_KEY_REFRESH, data.refresh_token);
  }
  await SecureStore.setItemAsync(
    STORAGE_KEY_EXPIRY,
    String(Date.now() + data.expires_in * 1000 - 60_000)
  );
}

export async function loginWithiFit(): Promise<boolean> {
  const codeVerifier = await generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const authRequest = new AuthSession.AuthRequest({
    clientId: IFIT_CLIENT_ID,
    redirectUri: IFIT_REDIRECT_URI,
    scopes: ['workouts', 'profile'],
    extraParams: {
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    },
    usePKCE: false, // manual PKCE above
  });

  const result = await authRequest.promptAsync({
    authorizationEndpoint: IFIT_AUTH_URL,
  });

  if (result.type !== 'success') return false;

  const { code } = result.params;
  const tokenResp = await fetch(IFIT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: IFIT_REDIRECT_URI,
      client_id: IFIT_CLIENT_ID,
      client_secret: IFIT_CLIENT_SECRET,
      code_verifier: codeVerifier,
    }).toString(),
  });

  if (!tokenResp.ok) return false;
  await storeTokens(await tokenResp.json());
  return true;
}

export async function logoutFromiFit(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEY_ACCESS);
  await SecureStore.deleteItemAsync(STORAGE_KEY_REFRESH);
  await SecureStore.deleteItemAsync(STORAGE_KEY_EXPIRY);
}

export async function isiFitConnected(): Promise<boolean> {
  const token = await getStoredToken();
  return token !== null;
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

// PKCE helpers
async function generateCodeVerifier(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return base64UrlEncode(bytes);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );
  return digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
