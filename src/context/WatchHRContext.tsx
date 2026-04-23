import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
} from 'react';
import { Platform } from 'react-native';
import { Device } from 'react-native-ble-plx';
import {
  waitForBleReady,
  scanForHrSensors,
  connectAndStream,
} from '../services/watchHrService';

export type WatchHRStatus =
  | 'idle'
  | 'bt_off'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'disconnected';

interface WatchHRState {
  status: WatchHRStatus;
  foundDevices: Device[];
  connectedDevice: Device | null;
  liveHR: number | null;
  error: string | null;
}

type Action =
  | { type: 'SCAN_START' }
  | { type: 'SCAN_FOUND'; device: Device }
  | { type: 'BT_OFF' }
  | { type: 'CONNECTING'; device: Device }
  | { type: 'CONNECTED'; device: Device }
  | { type: 'HR'; bpm: number }
  | { type: 'DISCONNECTED' }
  | { type: 'IDLE' }
  | { type: 'ERROR'; error: string };

function reducer(state: WatchHRState, action: Action): WatchHRState {
  switch (action.type) {
    case 'SCAN_START':
      return { ...state, status: 'scanning', foundDevices: [], error: null };
    case 'SCAN_FOUND':
      return {
        ...state,
        foundDevices: [...state.foundDevices, action.device],
      };
    case 'BT_OFF':
      return { ...state, status: 'bt_off', error: 'Bluetooth is off or unavailable.' };
    case 'CONNECTING':
      return { ...state, status: 'connecting', connectedDevice: action.device };
    case 'CONNECTED':
      return { ...state, status: 'connected', connectedDevice: action.device, error: null };
    case 'HR':
      return { ...state, liveHR: action.bpm };
    case 'DISCONNECTED':
      return {
        ...state,
        status: 'disconnected',
        liveHR: null,
        connectedDevice: null,
      };
    case 'IDLE':
      return { ...state, status: 'idle', foundDevices: [] };
    case 'ERROR':
      return { ...state, status: 'idle', error: action.error };
  }
}

interface WatchHRContextValue extends WatchHRState {
  startScan: () => Promise<void>;
  stopScan: () => void;
  connectDevice: (device: Device) => Promise<void>;
  disconnect: () => void;
}

const WatchHRContext = createContext<WatchHRContextValue | null>(null);

export function WatchHRProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    status: 'idle',
    foundDevices: [],
    connectedDevice: null,
    liveHR: null,
    error: null,
  });

  const stopScanRef = useRef<(() => void) | null>(null);
  const cleanupConnectionRef = useRef<(() => void) | null>(null);

  const stopScan = useCallback(() => {
    stopScanRef.current?.();
    stopScanRef.current = null;
    dispatch({ type: 'IDLE' });
  }, []);

  const disconnect = useCallback(() => {
    cleanupConnectionRef.current?.();
    cleanupConnectionRef.current = null;
    dispatch({ type: 'DISCONNECTED' });
  }, []);

  const startScan = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    dispatch({ type: 'SCAN_START' });

    const ready = await waitForBleReady(6000);
    if (!ready) {
      dispatch({ type: 'BT_OFF' });
      return;
    }

    const stopFn = scanForHrSensors((device) => {
      dispatch({ type: 'SCAN_FOUND', device });
    });
    stopScanRef.current = stopFn;

    // Auto-stop scan after 15 s to save battery
    setTimeout(() => {
      if (stopScanRef.current === stopFn) {
        stopFn();
        stopScanRef.current = null;
        // Only switch to idle if we're still scanning (not connected)
        dispatch({ type: 'IDLE' });
      }
    }, 15_000);
  }, []);

  const connectDevice = useCallback(async (device: Device) => {
    // Stop any active scan first
    stopScanRef.current?.();
    stopScanRef.current = null;

    dispatch({ type: 'CONNECTING', device });

    try {
      const cleanup = await connectAndStream(
        device.id,
        (bpm) => dispatch({ type: 'HR', bpm }),
        () => dispatch({ type: 'DISCONNECTED' })
      );
      cleanupConnectionRef.current = cleanup;
      dispatch({ type: 'CONNECTED', device });
    } catch (e: any) {
      dispatch({ type: 'ERROR', error: e?.message ?? 'Failed to connect' });
    }
  }, []);

  return (
    <WatchHRContext.Provider
      value={{ ...state, startScan, stopScan, connectDevice, disconnect }}
    >
      {children}
    </WatchHRContext.Provider>
  );
}

export function useWatchHR() {
  const ctx = useContext(WatchHRContext);
  if (!ctx) throw new Error('useWatchHR must be used inside WatchHRProvider');
  return ctx;
}
