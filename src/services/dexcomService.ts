import * as SecureStore from 'expo-secure-store';
import { BloodGlucoseSample, GlucoseTrend } from '../types/health';

const SHARE_BASE = 'https://share2.dexcom.com/ShareWebServices/Services';
const APP_ID = 'd89443d2-327c-4a6f-89e5-496bbb0317db';

const KEY_SESSION = 'dexcom_session_id';
const KEY_USERNAME = 'dexcom_username';
const KEY_PASSWORD = 'dexcom_password';
const KEY_EXPIRY = 'dexcom_session_expiry';

// Dexcom Share API trend string → our type
const TREND_MAP: Record<string, GlucoseTrend> = {
  DoubleUp: 'rising_fast',
  SingleUp: 'rising',
  FortyFiveUp: 'rising_slow',
  Flat: 'steady',
  FortyFiveDown: 'falling_slow',
  SingleDown: 'falling',
  DoubleDown: 'falling_fast',
};

export interface DexcomLoginResult {
  success: boolean;
  error?: string;
}

async function createSession(username: string, password: string): Promise<string> {
  const resp = await fetch(`${SHARE_BASE}/General/LoginPublisherAccountByName`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ accountName: username, password, applicationId: APP_ID }),
  });
  if (!resp.ok) {
    let msg = `Login failed (HTTP ${resp.status})`;
    try { const b = await resp.json(); msg = b?.Message ?? b?.Code ?? msg; } catch {}
    throw new Error(msg);
  }
  const sessionId: string = await resp.json();
  if (!sessionId || sessionId === '00000000-0000-0000-0000-000000000000') {
    throw new Error('Invalid Dexcom credentials');
  }
  return sessionId;
}

export async function loginToDexcom(username: string, password: string): Promise<DexcomLoginResult> {
  try {
    const sessionId = await createSession(username, password);
    await Promise.all([
      SecureStore.setItemAsync(KEY_SESSION, sessionId),
      SecureStore.setItemAsync(KEY_USERNAME, username),
      SecureStore.setItemAsync(KEY_PASSWORD, password),
      SecureStore.setItemAsync(KEY_EXPIRY, String(Date.now() + 6 * 60 * 60 * 1000)),
    ]);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Dexcom login failed' };
  }
}

export async function logoutFromDexcom(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_SESSION),
    SecureStore.deleteItemAsync(KEY_USERNAME),
    SecureStore.deleteItemAsync(KEY_PASSWORD),
    SecureStore.deleteItemAsync(KEY_EXPIRY),
  ]);
}

export async function isDexcomConnected(): Promise<boolean> {
  const username = await SecureStore.getItemAsync(KEY_USERNAME);
  return username !== null;
}

async function getSession(): Promise<string | null> {
  const [sessionId, expiry] = await Promise.all([
    SecureStore.getItemAsync(KEY_SESSION),
    SecureStore.getItemAsync(KEY_EXPIRY),
  ]);
  if (sessionId && expiry && Date.now() < Number(expiry)) return sessionId;

  // Session expired — refresh using stored credentials
  const [username, password] = await Promise.all([
    SecureStore.getItemAsync(KEY_USERNAME),
    SecureStore.getItemAsync(KEY_PASSWORD),
  ]);
  if (!username || !password) return null;

  try {
    const newSession = await createSession(username, password);
    await Promise.all([
      SecureStore.setItemAsync(KEY_SESSION, newSession),
      SecureStore.setItemAsync(KEY_EXPIRY, String(Date.now() + 6 * 60 * 60 * 1000)),
    ]);
    return newSession;
  } catch {
    return null;
  }
}

export async function fetchDexcomGlucose(maxCount = 288): Promise<BloodGlucoseSample[]> {
  const sessionId = await getSession();
  if (!sessionId) return [];

  const url = `${SHARE_BASE}/Publisher/ReadPublisherLatestGlucoseValues` +
    `?sessionId=${sessionId}&minutes=1440&maxCount=${maxCount}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({}),
  });

  if (resp.status === 500) {
    // Session likely expired mid-use — clear it so next call re-auths
    await SecureStore.deleteItemAsync(KEY_SESSION);
    await SecureStore.deleteItemAsync(KEY_EXPIRY);
    return [];
  }
  if (!resp.ok) throw new Error(`Dexcom read failed (HTTP ${resp.status})`);

  const readings: any[] = await resp.json();
  return readings.map((r) => {
    const msMatch = r.WT?.match(/\d+/);
    return {
      timestamp: msMatch ? new Date(Number(msMatch[0])) : new Date(),
      mgPerDl: r.Value,
      trend: TREND_MAP[r.Trend],
      source: 'dexcom' as const,
    };
  });
}
