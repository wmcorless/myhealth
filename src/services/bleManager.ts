import { BleManager, State } from 'react-native-ble-plx';

// Single BleManager instance shared across all BLE services.
// react-native-ble-plx should never have more than one BleManager alive.
export const bleManager = new BleManager();

/** Wait until Bluetooth is powered on. Resolves false on timeout or if unavailable. */
export function waitForBleReady(timeoutMs = 6000): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      sub.remove();
      resolve(false);
    }, timeoutMs);

    const sub = bleManager.onStateChange((state) => {
      if (state === State.PoweredOn) {
        clearTimeout(timer);
        sub.remove();
        resolve(true);
      } else if (state === State.PoweredOff || state === State.Unsupported) {
        clearTimeout(timer);
        sub.remove();
        resolve(false);
      }
    }, true); // true = emit current state immediately
  });
}

/** Decode a base64 BLE characteristic value to a Uint8Array (safe in Hermes/JSC). */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
