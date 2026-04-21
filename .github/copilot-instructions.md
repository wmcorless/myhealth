# MyHealth – Copilot Instructions

Personal health tracking app for Android and iOS built with React Native + Expo.

## Commands

```bash
npx expo start           # start dev server (choose platform from menu)
npx expo start --android # open directly on Android
npx expo start --ios     # open directly on iOS
```

Builds are handled through EAS (not local):

```bash
eas build --platform android
eas build --platform ios
```

There is no test runner or linter configured.

## Architecture

The app uses **React Context + `useReducer`** for all state. Two providers wrap the entire navigation tree in `App.tsx`:

- **`HealthProvider`** (`src/context/HealthContext.tsx`) — aggregates health metrics from Samsung Health / Apple Health and the iFit API, persists to SQLite, exposes `refresh()` and device connection actions.
- **`TreadmillProvider`** (`src/context/TreadmillContext.tsx`) — manages BLE scan/connect lifecycle and saves treadmill sessions to SQLite on disconnect.

Data flows:

```
Native health (Android: Health Connect, iOS: HealthKit)  ──► healthAggregator ──► HealthContext ──► screens
BLE FTMS treadmill (react-native-ble-plx)               ──►                        TreadmillContext ──► TreadmillScreen
                                                                    │
                                                             expo-sqlite (offline cache)
```

**`src/services/healthAggregator.ts`** is the main fan-out point — it calls native health on the appropriate platform using `Promise.allSettled` and merges results. Failures are silently skipped so the app always shows whatever data is available.

Platform-specific health service files use Expo's platform extension convention:
- `healthKitService.ios.ts` — Apple HealthKit (iOS only)
- `healthKitService.android.ts` — stub / unused on Android
- `healthConnectService.ts` — Android Health Connect

## Key Conventions

**Error handling in contexts**: Async operations called from context providers use `.catch(() => {})` for fire-and-forget persistence calls. Top-level data fetches dispatch an `ERROR` action with a message string.

**Action types**: Context reducers use discriminated union `type` strings in `SCREAMING_SNAKE_CASE` (e.g., `'LOADING'`, `'DEVICE_FOUND'`, `'DISCONNECTED'`).

**`Promise.allSettled` over `Promise.all`**: Used in the aggregator so native health failures don't block the rest of the UI.

**Display formatting**: The `fmt(val, decimals?)` helper in screens returns `'—'` (em-dash) for `undefined` or `0` values. Use this pattern for all optional metric display.

**SQLite timestamps**: All timestamps are stored as Unix milliseconds (`Date.getTime()`). The `toDateStr()` helper produces `YYYY-MM-DD` strings used as primary keys for daily tables.

**iFit authentication**: Login is a 3-step process — web login → scrape `clientId`/`clientSecret` from the settings page HTML → OAuth password grant. Tokens are stored in `expo-secure-store`. The client credentials are dynamic and must be re-extracted from the page; do not hardcode them.

**BLE treadmill**: Uses the standard Bluetooth FTMS profile (service `0x1826`, characteristic `0x2ACD`). The `parseFtmsTreadmillData` function in `treadmillBleService.ts` decodes the binary packet per the FTMS spec.

**Theme**: Primary accent color is `#E53935` (red). Background is `#F5F6FA`. Tab bar active tint matches the accent.

**TypeScript**: Strict mode is enabled (`"strict": true` in `tsconfig.json`). Use `undefined` (not `null`) for optional fields in domain types; `null` is reserved for SQLite nullable columns.

**New Architecture**: `newArchEnabled: false` in `app.json` — do not enable it, as `react-native-ble-plx` and `react-native-health-connect` may not be compatible yet.
