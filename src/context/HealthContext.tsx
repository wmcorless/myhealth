import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import { DailySummary, DeviceStatus, HeartRateSample } from '../types/health';
import { initNativeHealth, getTodaySummary, getTodayHeartRate } from '../services/healthAggregator';
import { isiFitConnected, loginWithiFit, logoutFromiFit } from '../services/iFitService';
import { Platform } from 'react-native';
import { isHealthConnectAvailable } from '../services/healthConnectService';

interface HealthState {
  loading: boolean;
  summary: DailySummary | null;
  heartRateSamples: HeartRateSample[];
  devices: DeviceStatus[];
  error: string | null;
}

type Action =
  | { type: 'LOADING' }
  | { type: 'LOADED'; summary: DailySummary; heartRateSamples: HeartRateSample[] }
  | { type: 'DEVICES'; devices: DeviceStatus[] }
  | { type: 'ERROR'; error: string };

function reducer(state: HealthState, action: Action): HealthState {
  switch (action.type) {
    case 'LOADING':
      return { ...state, loading: true, error: null };
    case 'LOADED':
      return {
        ...state,
        loading: false,
        summary: action.summary,
        heartRateSamples: action.heartRateSamples,
      };
    case 'DEVICES':
      return { ...state, devices: action.devices };
    case 'ERROR':
      return { ...state, loading: false, error: action.error };
  }
}

interface HealthContextValue extends HealthState {
  refresh: () => Promise<void>;
  connectiFit: (email: string, password: string) => Promise<boolean>;
  disconnectiFit: () => Promise<void>;
}

const HealthContext = createContext<HealthContextValue | null>(null);

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    loading: false,
    summary: null,
    heartRateSamples: [],
    devices: [
      { id: 'samsung_health', name: 'Samsung Health', connected: false },
      { id: 'ifit', name: 'iFit Treadmill', connected: false },
    ],
    error: null,
  });

  const refreshDeviceStatus = useCallback(async () => {
    const [iFitOk, nativeAvailable] = await Promise.all([
      isiFitConnected(),
      Platform.OS === 'android' ? isHealthConnectAvailable() : Promise.resolve(true),
    ]);
    dispatch({
      type: 'DEVICES',
      devices: [
        {
          id: 'samsung_health',
          name: Platform.OS === 'ios' ? 'Apple Health' : 'Samsung Health',
          connected: nativeAvailable,
          lastSync: nativeAvailable ? new Date() : undefined,
        },
        {
          id: 'ifit',
          name: 'iFit Treadmill',
          connected: iFitOk,
          lastSync: iFitOk ? new Date() : undefined,
        },
      ],
    });
  }, []);

  const refresh = useCallback(async () => {
    dispatch({ type: 'LOADING' });
    try {
      const [summary, heartRateSamples] = await Promise.all([
        getTodaySummary(),
        getTodayHeartRate(),
      ]);
      dispatch({ type: 'LOADED', summary, heartRateSamples });
    } catch (e: any) {
      dispatch({ type: 'ERROR', error: e?.message ?? 'Failed to load health data' });
    }
  }, []);

  const connectiFit = useCallback(async (email: string, password: string) => {
    const ok = await loginWithiFit(email, password);
    await refreshDeviceStatus();
    if (ok) refresh();
    return ok;
  }, [refresh, refreshDeviceStatus]);

  const disconnectiFit = useCallback(async () => {
    await logoutFromiFit();
    await refreshDeviceStatus();
  }, [refreshDeviceStatus]);

  useEffect(() => {
    initNativeHealth()
      .then(() => refreshDeviceStatus())
      .then(() => refresh())
      .catch(() => {});
  }, []);

  return (
    <HealthContext.Provider
      value={{ ...state, refresh, connectiFit, disconnectiFit }}
    >
      {children}
    </HealthContext.Provider>
  );
}

export function useHealth() {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error('useHealth must be used inside HealthProvider');
  return ctx;
}
