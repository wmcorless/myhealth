/**
 * BLE Heart Rate Profile service (0x180D / 0x2A37)
 *
 * Works with any standard BLE HR sensor — chest straps, Galaxy Watch 7
 * running the "Heart Rate Broadcast" Wear OS app, etc.
 */
import { Device, Characteristic, BleError } from 'react-native-ble-plx';
import { bleManager, base64ToBytes } from './bleManager';

export { waitForBleReady } from './bleManager';

export const HR_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
export const HR_CHARACTERISTIC = '00002a37-0000-1000-8000-00805f9b34fb';

/** Scan for BLE devices advertising the Heart Rate service. Returns a stop function. */
export function scanForHrSensors(onFound: (device: Device) => void): () => void {
  const seen = new Set<string>();
  bleManager.startDeviceScan(
    [HR_SERVICE],
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
 * Connect to an HR device and start streaming BPM notifications.
 * Returns a cleanup function that disconnects.
 */
export async function connectAndStream(
  deviceId: string,
  onBpm: (bpm: number) => void,
  onDisconnect: () => void
): Promise<() => void> {
  const device = await bleManager.connectToDevice(deviceId, {
    requestMTU: 185,
    autoConnect: false,
  });
  await device.discoverAllServicesAndCharacteristics();

  const sub = device.monitorCharacteristicForService(
    HR_SERVICE,
    HR_CHARACTERISTIC,
    (error: BleError | null, char: Characteristic | null) => {
      if (error || !char?.value) return;
      const bpm = parseHrMeasurement(char.value);
      if (bpm > 0) onBpm(bpm);
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
 * Parse BLE Heart Rate Measurement characteristic (base64).
 * Flags byte0 bit0: 0 = uint8 BPM at byte1; 1 = uint16 BPM at bytes 1-2.
 */
export function parseHrMeasurement(base64: string): number {
  const bytes = base64ToBytes(base64);
  if (bytes.length < 2) return 0;
  const flags = bytes[0];
  if ((flags & 0x01) !== 0 && bytes.length >= 3) {
    return bytes[1] | (bytes[2] << 8);
  }
  return bytes[1];
}

