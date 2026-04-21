import { BleManager, Device, State } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { TreadmillData } from '../types/health';

// Standard Bluetooth FTMS UUIDs
const FTMS_SERVICE = '00001826-0000-1000-8000-00805f9b34fb';
const TREADMILL_DATA_CHAR = '00002acd-0000-1000-8000-00805f9b34fb';

export type ScanResult = { id: string; name: string };
export type ConnectionState = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error';

let manager: BleManager | null = null;

function getManager(): BleManager {
  if (!manager) manager = new BleManager();
  return manager;
}

export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version < 31) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  const results = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
  ]);
  return (
    results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
    results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
  );
}

export async function isBleReady(): Promise<boolean> {
  const state = await getManager().state();
  return state === State.PoweredOn;
}

export function scanForTreadmills(
  onFound: (device: ScanResult) => void,
  onError: (msg: string) => void,
): () => void {
  const m = getManager();
  m.startDeviceScan([FTMS_SERVICE], { allowDuplicates: false }, (err, device) => {
    if (err) {
      onError(err.message);
      return;
    }
    if (device) {
      onFound({ id: device.id, name: device.name ?? device.localName ?? device.id });
    }
  });
  return () => m.stopDeviceScan();
}

let connectedDevice: Device | null = null;

export async function connectToTreadmill(
  deviceId: string,
  onData: (data: TreadmillData) => void,
  onDisconnect: () => void,
): Promise<void> {
  const m = getManager();
  m.stopDeviceScan();

  const device = await m.connectToDevice(deviceId, { autoConnect: false });
  await device.discoverAllServicesAndCharacteristics();
  connectedDevice = device;

  device.onDisconnected(() => {
    connectedDevice = null;
    onDisconnect();
  });

  device.monitorCharacteristicForService(FTMS_SERVICE, TREADMILL_DATA_CHAR, (err, char) => {
    if (err || !char?.value) return;
    const data = parseFtmsTreadmillData(char.value);
    if (data) onData(data);
  });
}

export async function disconnectTreadmill(): Promise<void> {
  if (connectedDevice) {
    await connectedDevice.cancelConnection().catch(() => {});
    connectedDevice = null;
  }
}

// FTMS Treadmill Data packet parser (Bluetooth spec Vol 3, Part G, 3.224)
function parseFtmsTreadmillData(base64: string): TreadmillData | null {
  try {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    if (bytes.length < 4) return null;
    const view = new DataView(bytes.buffer);

    const flags = view.getUint16(0, true);
    let offset = 2;

    // Bit 0 = "More Data" — when 0, instantaneous speed IS present
    const hasSpeed = (flags & 0x0001) === 0;
    const hasAvgSpeed = (flags & 0x0002) !== 0;
    const hasDistance = (flags & 0x0004) !== 0;
    const hasInclination = (flags & 0x0008) !== 0;
    const hasElevation = (flags & 0x0010) !== 0;
    const hasInstPace = (flags & 0x0020) !== 0;
    const hasAvgPace = (flags & 0x0040) !== 0;
    const hasEnergy = (flags & 0x0080) !== 0;
    const hasHeartRate = (flags & 0x0100) !== 0;
    const hasMet = (flags & 0x0200) !== 0;
    const hasElapsed = (flags & 0x0400) !== 0;

    let speedKph = 0;
    if (hasSpeed && offset + 2 <= bytes.length) {
      speedKph = view.getUint16(offset, true) / 100;
      offset += 2;
    }
    if (hasAvgSpeed && offset + 2 <= bytes.length) offset += 2;

    let distanceMeters = 0;
    if (hasDistance && offset + 3 <= bytes.length) {
      distanceMeters = view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16);
      offset += 3;
    }

    let inclinePercent = 0;
    if (hasInclination && offset + 4 <= bytes.length) {
      inclinePercent = view.getInt16(offset, true) / 10;
      offset += 4; // inclination (2) + ramp angle (2)
    }
    if (hasElevation && offset + 4 <= bytes.length) offset += 4;
    if (hasInstPace && offset + 2 <= bytes.length) offset += 2;
    if (hasAvgPace && offset + 2 <= bytes.length) offset += 2;

    let calories: number | undefined;
    if (hasEnergy && offset + 5 <= bytes.length) {
      calories = view.getUint16(offset, true);
      offset += 5; // total (2) + per hour (2) + per minute (1)
    }

    let heartRate: number | undefined;
    if (hasHeartRate && offset + 1 <= bytes.length) {
      heartRate = view.getUint8(offset);
      offset += 1;
    }
    if (hasMet && offset + 1 <= bytes.length) offset += 1;

    let elapsedSeconds = 0;
    if (hasElapsed && offset + 2 <= bytes.length) {
      elapsedSeconds = view.getUint16(offset, true);
    }

    return { speedKph, inclinePercent, distanceMeters, heartRate, calories, elapsedSeconds };
  } catch {
    return null;
  }
}
