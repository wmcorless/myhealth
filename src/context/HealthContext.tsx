import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import { BloodGlucoseSample, DailySummary, DeviceStatus, HeartRateSample } from '../types/health';
import { getTodaySummary, getTodayHeartRate, getTodayBloodGlucose } from '../services/healthAggregator';
import { isHealthConnectAvailable, hasHealthConnectPermissions, initHealthConnect, requestHealthConnectPermissions, openHealthConnectSettings } from '../services/healthConnectService';
import { initDatabase, saveDailySummary, saveHeartRateSamples, saveBloodGlucoseSamples, saveWorkouts } from '../services/database';
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
  refreshDeviceStatus: () => Promise<void>;
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
    ],
    error: null,
  });

  const refreshDeviceStatus = useCallback(async () => {
    const samsungOk = await (
      Platform.OS === 'android' ? hasHealthConnectPermissions() : Promise.resolve(false)
    ).catch(() => false);
    dispatch({
      type: 'DEVICES',
      devices: [
        {
          id: 'samsung_health',
          name: Platform.OS === 'ios' ? 'Apple Health' : 'Samsung Health',
          connected: samsungOk,
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

      // Persist to local database (fire and forget)
      saveDailySummary(summary).catch(() => {});
      if (heartRateSamples.length) saveHeartRateSamples(heartRateSamples).catch(() => {});
      if (bloodGlucoseSamples.length) saveBloodGlucoseSamples(bloodGlucoseSamples).catch(() => {});
      if (summary.workouts.length) saveWorkouts(summary.workouts).catch(() => {});
    } catch (e: any) {
      dispatch({ type: 'ERROR', error: e?.message ?? 'Failed to load health data' });
    }
  }, []);

  const connectSamsungHealth = useCallback(async () => {
    try {
      const available = await isHealthConnectAvailable();
      if (!available) return false;
      await initHealthConnect();
      // requestPermission() shows the native HC dialog AND registers the app
      // so it appears in HC's App permissions list.
      const granted = await requestHealthConnectPermissions();
      await refreshDeviceStatus();
      if (granted) refresh();
      return true;
    } catch {
      await openHealthConnectSettings().catch(() => {});
      return true;
    }
  }, [refresh, refreshDeviceStatus]);

  useEffect(() => {
    initDatabase()
      .then(() => refreshDeviceStatus())
      .then(() => refresh())
      .catch(() => {});
  }, []);

  return (
    <HealthContext.Provider value={{ ...state, refresh, refreshDeviceStatus, connectSamsungHealth }}>
      {children}
    </HealthContext.Provider>
  );
}

export function useHealth() {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error('useHealth must be used inside HealthProvider');
  return ctx;
}
