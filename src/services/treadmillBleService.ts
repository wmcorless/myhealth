/**
 * Bluetooth FTMS (Fitness Machine Service) treadmill service
 *
 * FTMS Service UUID:            0x1826
 * Treadmill Data Characteristic: 0x2ACD  (notify — live speed/incline/distance/etc.)
 * Control Point Characteristic:  0x2AD9  (write — set speed / incline)
 *
 * NordicTrack X22i + NordicFTMS app broadcasts as standard FTMS.
 * Any treadmill that natively supports FTMS also works.
 */
import { Device, BleError, Characteristic } from 'react-native-ble-plx';
import { bleManager, base64ToBytes } from './bleManager';
import { TreadmillData } from '../types/health';

export const FTMS_SERVICE = '00001826-0000-1000-8000-00805f9b34fb';
const TREADMILL_DATA_CHAR = '00002acd-0000-1000-8000-00805f9b34fb';

/** Scan for BLE treadmills advertising the FTMS service. Returns a stop function. */
export function scanForTreadmills(onFound: (device: Device) => void): () => void {
  const seen = new Set<string>();
  bleManager.startDeviceScan(
    [FTMS_SERVICE],
    { allowDuplicates: false },
    (error: BleError | null, device: Device | null) => {
      if (error || !device) return;
      if (seen.has(device.id)) return;
      seen.add(device.id);
      onFound(device);
    }
  );
  return () => bleManager.stopDeviceScan();
}

/**
 * Connect to a treadmill, discover services, and start streaming data.
 * Returns a cleanup function that disconnects.
 */
export async function connectTreadmill(
  deviceId: string,
  onData: (data: TreadmillData) => void,
  onDisconnect: () => void
): Promise<() => void> {
  const device = await bleManager.connectToDevice(deviceId, {
    requestMTU: 185,
    autoConnect: false,
  });
  await device.discoverAllServicesAndCharacteristics();

  const sub = device.monitorCharacteristicForService(
    FTMS_SERVICE,
    TREADMILL_DATA_CHAR,
    (error: BleError | null, char: Characteristic | null) => {
      if (error || !char?.value) return;
      const data = parseFtmsTreadmillData(char.value);
      if (data) onData(data);
    }
  );

  const disconnectSub = bleManager.onDeviceDisconnected(deviceId, () => onDisconnect());

  return () => {
    sub.remove();
    disconnectSub.remove();
    bleManager.cancelDeviceConnection(deviceId).catch(() => {});
  };
}

/**
 * Parse FTMS Treadmill Data characteristic (0x2ACD) from base64.
 *
 * Byte layout (all little-endian):
 *   [0-1] Flags (uint16)
 *   Conditional fields follow in order per flag bits:
 *   Bit 0 = 0: Instantaneous Speed (uint16, 0.01 km/h)
 *   Bit 1 = 1: Average Speed (uint16, 0.01 km/h)
 *   Bit 2 = 1: Total Distance (uint24, 1 m)
 *   Bit 3 = 1: Inclination (int16, 0.1%) + Ramp Angle (int16, 0.1°)
 *   Bit 4 = 1: Positive Elevation Gain (uint16, 0.1 m) + Negative (uint16, 0.1 m)
 *   Bit 5 = 1: Instantaneous Pace (uint16)
 *   Bit 6 = 1: Average Pace (uint16)
 *   Bit 7 = 1: Expended Energy Total (uint16 kcal) + Per Hour (uint16) + Per Minute (uint8)
 *   Bit 8 = 1: Heart Rate (uint8, bpm)
 *   Bit 9 = 1: Metabolic Equivalent (uint8, 0.1 METs)
 *   Bit 10 = 1: Elapsed Time (uint16, seconds)
 *   Bit 11 = 1: Remaining Time (uint16, seconds)
 */
export function parseFtmsTreadmillData(base64: string): TreadmillData | null {
  const bytes = base64ToBytes(base64);
  if (bytes.length < 4) return null;

  const view = new DataView(bytes.buffer);
  const flags = view.getUint16(0, true);
  let o = 2; // byte offset

  // Bit 0 = 0 means Instantaneous Speed is present
  let speedKph = 0;
  if ((flags & 0x01) === 0 && o + 2 <= bytes.length) {
    speedKph = view.getUint16(o, true) / 100;
    o += 2;
  }

  if ((flags & 0x02) && o + 2 <= bytes.length) o += 2; // Average Speed

  // Total Distance (uint24)
  let distanceMeters = 0;
  if ((flags & 0x04) && o + 3 <= bytes.length) {
    distanceMeters = bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16);
    o += 3;
  }

  // Inclination (int16, 0.1%) + Ramp Angle (int16)
  let inclinePercent = 0;
  if ((flags & 0x08) && o + 4 <= bytes.length) {
    inclinePercent = view.getInt16(o, true) / 10;
    o += 4; // inclination + ramp angle
  }

  if ((flags & 0x10) && o + 4 <= bytes.length) o += 4; // Elevation Gain ×2
  if ((flags & 0x20) && o + 2 <= bytes.length) o += 2; // Instantaneous Pace
  if ((flags & 0x40) && o + 2 <= bytes.length) o += 2; // Average Pace

  // Expended Energy: Total (uint16) + Per Hour (uint16) + Per Minute (uint8) = 5 bytes
  let calories: number | undefined;
  if ((flags & 0x80) && o + 5 <= bytes.length) {
    calories = view.getUint16(o, true);
    o += 5;
  }

  // Heart Rate (uint8)
  let heartRate: number | undefined;
  if ((flags & 0x100) && o + 1 <= bytes.length) {
    heartRate = bytes[o];
    o += 1;
  }

  if ((flags & 0x200) && o + 1 <= bytes.length) o += 1; // Metabolic Equivalent

  // Elapsed Time (uint16, seconds)
  let elapsedSeconds = 0;
  if ((flags & 0x400) && o + 2 <= bytes.length) {
    elapsedSeconds = view.getUint16(o, true);
  }

  return { speedKph, inclinePercent, distanceMeters, heartRate, calories, elapsedSeconds };
}
