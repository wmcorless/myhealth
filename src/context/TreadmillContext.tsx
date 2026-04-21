import React, { createContext, useContext, useCallback, useReducer } from 'react';
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
      await connectToTreadmill(
        deviceId,
        (data) => dispatch({ type: 'DATA', data }),
        () => dispatch({ type: 'DISCONNECTED' }),
      );
      dispatch({ type: 'CONNECTED' });
    } catch (e: any) {
      dispatch({ type: 'ERROR', message: e?.message ?? 'Could not connect to treadmill' });
    }
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectTreadmill();
    dispatch({ type: 'DISCONNECTED' });
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
