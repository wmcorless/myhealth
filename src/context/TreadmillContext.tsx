import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
} from 'react';
import { Platform } from 'react-native';
import { Device } from 'react-native-ble-plx';
import { TreadmillData } from '../types/health';
import { waitForBleReady } from '../services/bleManager';
import { scanForTreadmills, connectTreadmill } from '../services/treadmillBleService';
import { saveTreadmillSession } from '../services/database';

export type TreadmillStatus =
  | 'idle'
  | 'bt_off'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'recording';

interface TreadmillState {
  status: TreadmillStatus;
  foundDevices: Device[];
  connectedDevice: Device | null;
  liveData: TreadmillData | null;
  sessionStart: Date | null;
  error: string | null;
}

type Action =
  | { type: 'SCAN_START' }
  | { type: 'SCAN_FOUND'; device: Device }
  | { type: 'BT_OFF' }
  | { type: 'CONNECTING'; device: Device }
  | { type: 'CONNECTED'; device: Device }
  | { type: 'DATA'; data: TreadmillData }
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING' }
  | { type: 'DISCONNECTED' }
  | { type: 'IDLE' }
  | { type: 'ERROR'; error: string };

function reducer(state: TreadmillState, action: Action): TreadmillState {
  switch (action.type) {
    case 'SCAN_START':
      return { ...state, status: 'scanning', foundDevices: [], error: null };
    case 'SCAN_FOUND':
      return { ...state, foundDevices: [...state.foundDevices, action.device] };
    case 'BT_OFF':
      return { ...state, status: 'bt_off', error: 'Bluetooth is off or unavailable.' };
    case 'CONNECTING':
      return { ...state, status: 'connecting', connectedDevice: action.device };
    case 'CONNECTED':
      return { ...state, status: 'connected', connectedDevice: action.device, error: null };
    case 'DATA':
      return { ...state, liveData: action.data };
    case 'START_RECORDING':
      return { ...state, status: 'recording', sessionStart: new Date() };
    case 'STOP_RECORDING':
      return { ...state, status: 'connected', sessionStart: null };
    case 'DISCONNECTED':
      return {
        ...state,
        status: 'idle',
        connectedDevice: null,
        liveData: null,
        sessionStart: null,
      };
    case 'IDLE':
      return { ...state, status: 'idle', foundDevices: [] };
    case 'ERROR':
      return { ...state, status: 'idle', error: action.error };
  }
}

interface TreadmillContextValue extends TreadmillState {
  startScan: () => Promise<void>;
  stopScan: () => void;
  connectDevice: (device: Device) => Promise<void>;
  disconnect: () => void;
  startRecording: () => void;
  stopRecording: (watchHrSamples?: number[]) => Promise<void>;
}

const TreadmillContext = createContext<TreadmillContextValue | null>(null);

export function TreadmillProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    status: 'idle',
    foundDevices: [],
    connectedDevice: null,
    liveData: null,
    sessionStart: null,
    error: null,
  });

  // Refs for accumulated session stats (avoid re-render overhead)
  const stopScanRef = useRef<(() => void) | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const sessionStartRef = useRef<Date | null>(null);
  const peakSpeedRef = useRef(0);
  const peakInclineRef = useRef(0);
  const treadmillHrRef = useRef<number[]>([]);
  const lastDataRef = useRef<TreadmillData | null>(null);

  const stopScan = useCallback(() => {
    stopScanRef.current?.();
    stopScanRef.current = null;
    dispatch({ type: 'IDLE' });
  }, []);

  const disconnect = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
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

    const stopFn = scanForTreadmills((device) => {
      dispatch({ type: 'SCAN_FOUND', device });
    });
    stopScanRef.current = stopFn;

    // Auto-stop after 20 s
    setTimeout(() => {
      if (stopScanRef.current === stopFn) {
        stopFn();
        stopScanRef.current = null;
        dispatch({ type: 'IDLE' });
      }
    }, 20_000);
  }, []);

  const connectDevice = useCallback(async (device: Device) => {
    stopScanRef.current?.();
    stopScanRef.current = null;

    dispatch({ type: 'CONNECTING', device });

    try {
      const cleanup = await connectTreadmill(
        device.id,
        (data) => {
          lastDataRef.current = data;
          // Accumulate peak stats when recording
          if (sessionStartRef.current) {
            if (data.speedKph > peakSpeedRef.current) peakSpeedRef.current = data.speedKph;
            if (data.inclinePercent > peakInclineRef.current)
              peakInclineRef.current = data.inclinePercent;
            if (data.heartRate && data.heartRate > 0)
              treadmillHrRef.current.push(data.heartRate);
          }
          dispatch({ type: 'DATA', data });
        },
        () => dispatch({ type: 'DISCONNECTED' })
      );
      cleanupRef.current = cleanup;
      dispatch({ type: 'CONNECTED', device });
    } catch (e: any) {
      dispatch({ type: 'ERROR', error: e?.message ?? 'Failed to connect to treadmill' });
    }
  }, []);

  const startRecording = useCallback(() => {
    sessionStartRef.current = new Date();
    peakSpeedRef.current = 0;
    peakInclineRef.current = 0;
    treadmillHrRef.current = [];
    dispatch({ type: 'START_RECORDING' });
  }, []);

  /** Save and stop recording. Pass current watch HR samples for richer stats. */
  const stopRecording = useCallback(
    async (watchHrSamples: number[] = []) => {
      const start = sessionStartRef.current;
      if (!start) return;

      const end = new Date();
      const elapsedSecs = Math.round((end.getTime() - start.getTime()) / 1000);
      const finalData = lastDataRef.current;

      // Combine treadmill strap HR + watch HR for stats
      const allHr = [...treadmillHrRef.current, ...watchHrSamples].filter((v) => v > 0);
      const avgHR = allHr.length
        ? Math.round(allHr.reduce((a, b) => a + b, 0) / allHr.length)
        : undefined;
      const maxHR = allHr.length ? Math.max(...allHr) : undefined;

      // avg speed = total distance / elapsed time (if we have distance)
      const distM = finalData?.distanceMeters ?? 0;
      const avgSpeedKph =
        elapsedSecs > 0 && distM > 0 ? (distM / 1000) / (elapsedSecs / 3600) : undefined;

      dispatch({ type: 'STOP_RECORDING' });
      sessionStartRef.current = null;

      saveTreadmillSession({
        startTime: start,
        endTime: end,
        maxSpeedKph: peakSpeedRef.current > 0 ? peakSpeedRef.current : undefined,
        avgSpeedKph,
        maxInclinePercent: peakInclineRef.current > 0 ? peakInclineRef.current : undefined,
        distanceMeters: distM > 0 ? distM : undefined,
        calories: finalData?.calories,
        maxHeartRate: maxHR,
        avgHeartRate: avgHR,
        elapsedSeconds: elapsedSecs > 0 ? elapsedSecs : undefined,
      }).catch(() => {});
    },
    []
  );

  return (
    <TreadmillContext.Provider
      value={{
        ...state,
        startScan,
        stopScan,
        connectDevice,
        disconnect,
        startRecording,
        stopRecording,
      }}
    >
      {children}
    </TreadmillContext.Provider>
  );
}

export function useTreadmill() {
  const ctx = useContext(TreadmillContext);
  if (!ctx) throw new Error('useTreadmill must be used inside TreadmillProvider');
  return ctx;
}
