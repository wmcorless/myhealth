import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import { BloodGlucoseSample, DailySummary, DeviceStatus, HeartRateSample } from '../types/health';
import { getTodaySummary, getTodayHeartRate, getTodayBloodGlucose } from '../services/healthAggregator';
import { isiFitConnected, loginWithiFit, logoutFromiFit, LoginResult } from '../services/iFitService';
import { isHealthConnectAvailable, initHealthConnect, requestHealthConnectPermissions } from '../services/healthConnectService';
import { Platform } from 'react-native';

interface HealthState {
  loading: boolean;
  summary: DailySummary | null;
  heartRateSamples: HeartRateSample[];
  bloodGlucoseSamples: BloodGlucoseSample[];
  devices: DeviceStatus[];
  error: string | null;
}

type Action =
  | { type: 'LOADING' }
  | { type: 'LOADED'; summary: DailySummary; heartRateSamples: HeartRateSample[]; bloodGlucoseSamples: BloodGlucoseSample[] }
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
        bloodGlucoseSamples: action.bloodGlucoseSamples,
      };
    case 'DEVICES':
      return { ...state, devices: action.devices };
    case 'ERROR':
      return { ...state, loading: false, error: action.error };
  }
}

interface HealthContextValue extends HealthState {
  refresh: () => Promise<void>;
  connectiFit: (email: string, password: string) => Promise<LoginResult>;
  disconnectiFit: () => Promise<void>;
  connectSamsungHealth: () => Promise<boolean>;
}

const HealthContext = createContext<HealthContextValue | null>(null);

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    loading: false,
    summary: null,
    heartRateSamples: [],
    bloodGlucoseSamples: [],
    devices: [
      { id: 'samsung_health', name: 'Samsung Health', connected: false },
      { id: 'ifit', name: 'iFit Treadmill', connected: false },
    ],
    error: null,
  });

  const refreshDeviceStatus = useCallback(async () => {
    const [iFitOk, samsungOk] = await Promise.allSettled([
      isiFitConnected(),
      Platform.OS === 'android' ? isHealthConnectAvailable() : Promise.resolve(false),
    ]);
    dispatch({
      type: 'DEVICES',
      devices: [
        {
          id: 'samsung_health',
          name: Platform.OS === 'ios' ? 'Apple Health' : 'Samsung Health',
          connected: samsungOk.status === 'fulfilled' && samsungOk.value,
        },
        {
          id: 'ifit',
          name: 'iFit Treadmill',
          connected: iFitOk.status === 'fulfilled' && iFitOk.value,
        },
      ],
    });
  }, []);

  const refresh = useCallback(async () => {
    dispatch({ type: 'LOADING' });
    try {
      const [summary, heartRateSamples, bloodGlucoseSamples] = await Promise.all([
        getTodaySummary(),
        getTodayHeartRate(),
        getTodayBloodGlucose(),
      ]);
      dispatch({ type: 'LOADED', summary, heartRateSamples, bloodGlucoseSamples });
    } catch (e: any) {
      dispatch({ type: 'ERROR', error: e?.message ?? 'Failed to load health data' });
    }
  }, []);

  const connectSamsungHealth = useCallback(async () => {
    try {
      const ok = await initHealthConnect();
      if (!ok) return false;
      const granted = await requestHealthConnectPermissions();
      await refreshDeviceStatus();
      if (granted) refresh();
      return granted;
    } catch {
      return false;
    }
  }, [refresh, refreshDeviceStatus]);

  const connectiFit = useCallback(async (email: string, password: string) => {
    const result = await loginWithiFit(email, password);
    await refreshDeviceStatus();
    if (result.success) refresh();
    return result;
  }, [refresh, refreshDeviceStatus]);

  const disconnectiFit = useCallback(async () => {
    await logoutFromiFit();
    await refreshDeviceStatus();
  }, [refreshDeviceStatus]);

  useEffect(() => {
    refreshDeviceStatus()
      .then(() => refresh())
      .catch(() => {});
  }, []);

  return (
    <HealthContext.Provider value={{ ...state, refresh, connectiFit, disconnectiFit, connectSamsungHealth }}>
      {children}
    </HealthContext.Provider>
  );
}

export function useHealth() {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error('useHealth must be used inside HealthProvider');
  return ctx;
}
