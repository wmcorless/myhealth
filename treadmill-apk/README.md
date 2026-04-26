# MyHealth Treadmill Bridge

Android APK that runs on the **NordicTrack X22i** console and streams live workout data (speed, incline, heart rate) to the **MyHealth** phone app over Bluetooth FTMS.

## How it works

1. The service reads the iFit log file (`/sdcard/android/data/com.ifit.glassos_service/files/.valinorlogs/log.latest.txt` or `/sdcard/.wolflogs/`) which the iFit app writes continuously during workouts.
2. It parses `Changed KPH`, `Changed Grade`, and `HeartRateDataUpdate` lines (same format used by QZCompanion).
3. It advertises as a standard **Bluetooth FTMS treadmill** (service UUID `0x1826`, characteristic `0x2ACD`).
4. The MyHealth app (phone) connects and reads data using the existing FTMS scanner — no app changes required.

## Build

The APK is built automatically by GitHub Actions on every push to `main` that changes files under `treadmill-apk/`. Download the latest APK from the [Releases page](../../releases).

To build locally:
```bash
cd treadmill-apk
# macOS/Linux
./gradlew assembleDebug

# Windows
gradlew.bat assembleDebug
```

Requires Android SDK and JDK 17. The built APK is at `app/build/outputs/apk/debug/app-debug.apk`.

## Installation on the NordicTrack X22i

### Step 1 — Unlock maintenance mode

1. On the treadmill, open the **Maintenance** menu
2. Tap the blank white area **10 times**
3. Wait **7 seconds**
4. Tap the blank white area **10 more times**
5. A **challenge code** appears on screen
6. Visit **https://getresponsecode.com/** on your phone, enter the challenge code, and receive a response code
7. Enter the response code on the treadmill to unlock maintenance/developer access

### Step 2 — Download nordictrack.apk

Open the **Browser** in the maintenance menu, navigate to the [Releases page](../../releases), and download `nordictrack.apk`. Tap the file to install (allow Unknown Sources if prompted).

### Step 3 — Grant log permission (one-time, from a PC)

```bash
adb connect <treadmill-ip-address>:5555
adb shell pm grant com.wmcorless.myhealth.bridge android.permission.READ_LOGS
```

### Step 4 — Start broadcasting

Open **MyHealth Bridge** on the treadmill and tap **Start Broadcasting**. The service auto-starts on reboot.

## Credits

Data reading approach based on [QZCompanionNordictrackTreadmill](https://github.com/cagnulein/QZCompanionNordictrackTreadmill) by Roberto Viola ([@cagnulein](https://github.com/cagnulein)).
