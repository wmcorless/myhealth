import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DistanceUnit = 'miles' | 'km';
export type WeightUnit = 'lbs' | 'kg';
export type GlucoseUnit = 'mgdl' | 'mmoll';
export type TemperatureUnit = 'f' | 'c';

export interface Preferences {
  distanceUnit: DistanceUnit;
  weightUnit: WeightUnit;
  glucoseUnit: GlucoseUnit;
  temperatureUnit: TemperatureUnit;
}

const DEFAULTS: Preferences = {
  distanceUnit: 'miles',
  weightUnit: 'lbs',
  glucoseUnit: 'mgdl',
  temperatureUnit: 'f',
};

const STORAGE_KEY = '@myhealth_preferences';

interface PreferencesContextValue {
  preferences: Preferences;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setPreferences({ ...DEFAULTS, ...JSON.parse(raw) });
      })
      .catch(() => {});
  }, []);

  const setPreference = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return (
    <PreferencesContext.Provider value={{ preferences, setPreference }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider');
  return ctx;
}
