import React, { createContext, useContext, useCallback, useReducer, useRef } from 'react';
import { TreadmillData } from '../types/health';
import {
  requestBlePermissions,
  isBleReady,
  scanForTreadmills,
  connectToTreadmill,
  disconnectTreadmill,
  ScanResult,
  ConnectionState,
} from '../services/treadmillBleService';
import { saveTreadmillSession } from '../services/database';

interface TreadmillState {
  connectionState: ConnectionState;
  foundDevices: ScanResult[];
  data: TreadmillData | null;
  errorMessage: string | null;
}

type Action =
  | { type: 'SCANNING' }
  | { type: 'DEVICE_FOUND'; device: ScanResult }
  | { type: 'CONNECTING' }
  | { type: 'CONNECTED' }
  | { type: 'DATA'; data: TreadmillData }
  | { type: 'DISCONNECTED' }
  | { type: 'ERROR'; message: string }
  | { type: 'IDLE' };

function reducer(state: TreadmillState, action: Action): TreadmillState {
  switch (action.type) {
    case 'SCANNING':
      return { ...state, connectionState: 'scanning', foundDevices: [], errorMessage: null };
    case 'DEVICE_FOUND':
      if (state.foundDevices.some((d) => d.id === action.device.id)) return state;
      return { ...state, foundDevices: [...state.foundDevices, action.device] };
    case 'CONNECTING':
      return { ...state, connectionState: 'connecting' };
    case 'CONNECTED':
      return { ...state, connectionState: 'connected', errorMessage: null };
    case 'DATA':
      return { ...state, data: action.data };
    case 'DISCONNECTED':
      return { ...state, connectionState: 'idle', data: null };
    case 'ERROR':
      return { ...state, connectionState: 'error', errorMessage: action.message };
    case 'IDLE':
      return { ...state, connectionState: 'idle', foundDevices: [], errorMessage: null };
  }
}

interface TreadmillContextValue extends TreadmillState {
  startScan: () => Promise<void>;
  connect: (deviceId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  stopScan: () => void;
}

const TreadmillContext = createContext<TreadmillContextValue | null>(null);

let stopScanFn: (() => void) | null = null;

export function TreadmillProvider({ children }: { children: React.ReactNode }) {
  const sessionStartRef = useRef<Date | null>(null);
  const dataSnapshotsRef = useRef<TreadmillData[]>([]);

  const [state, dispatch] = useReducer(reducer, {
    connectionState: 'idle',
    foundDevices: [],
    data: null,
    errorMessage: null,
  });

  const stopScan = useCallback(() => {
    stopScanFn?.();
    stopScanFn = null;
    dispatch({ type: 'IDLE' });
  }, []);

  const startScan = useCallback(async () => {
    const hasPerms = await requestBlePermissions();
    if (!hasPerms) {
      dispatch({ type: 'ERROR', message: 'Bluetooth permission denied. Enable it in Settings.' });
      return;
    }
    const ready = await isBleReady();
    if (!ready) {
      dispatch({ type: 'ERROR', message: 'Bluetooth is off. Turn it on and try again.' });
      return;
    }

    dispatch({ type: 'SCANNING' });
    stopScanFn = scanForTreadmills(
      (device) => dispatch({ type: 'DEVICE_FOUND', device }),
      (msg) => dispatch({ type: 'ERROR', message: msg }),
    );
  }, []);

  const connect = useCallback(async (deviceId: string) => {
    stopScanFn?.();
    stopScanFn = null;
    dispatch({ type: 'CONNECTING' });
    try {
      sessionStartRef.current = new Date();
      dataSnapshotsRef.current = [];
      await connectToTreadmill(
        deviceId,
        (data) => {
          dataSnapshotsRef.current.push(data);
          dispatch({ type: 'DATA', data });
        },
        () => dispatch({ type: 'DISCONNECTED' }),
      );
      dispatch({ type: 'CONNECTED' });
    } catch (e: any) {
      dispatch({ type: 'ERROR', message: e?.message ?? 'Could not connect to treadmill' });
    }
  }, []);

  const disconnect = useCallback(async () => {
    const snapshots = dataSnapshotsRef.current;
    const start = sessionStartRef.current;
    await disconnectTreadmill();
    dispatch({ type: 'DISCONNECTED' });

    if (start && snapshots.length > 0) {
      const last = snapshots[snapshots.length - 1];
      const speeds = snapshots.map((d) => d.speedKph).filter((s) => s > 0);
      const hrs = snapshots.map((d) => d.heartRate).filter((v): v is number => v !== undefined);
      saveTreadmillSession({
        startTime: start,
        endTime: new Date(),
        maxSpeedKph: speeds.length ? Math.max(...speeds) : undefined,
        avgSpeedKph: speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : undefined,
        maxInclinePercent: Math.max(...snapshots.map((d) => d.inclinePercent)),
        distanceMeters: last.distanceMeters,
        calories: last.calories,
        maxHeartRate: hrs.length ? Math.max(...hrs) : undefined,
        avgHeartRate: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : undefined,
        elapsedSeconds: last.elapsedSeconds,
      }).catch(() => {});
      dataSnapshotsRef.current = [];
      sessionStartRef.current = null;
    }
  }, []);

  return (
    <TreadmillContext.Provider value={{ ...state, startScan, connect, disconnect, stopScan }}>
      {children}
    </TreadmillContext.Provider>
  );
}

export function useTreadmill() {
  const ctx = useContext(TreadmillContext);
  if (!ctx) throw new Error('useTreadmill must be used inside TreadmillProvider');
  return ctx;
}
