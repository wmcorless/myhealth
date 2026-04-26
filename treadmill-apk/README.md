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

1. **Enable developer mode**: Tap the white corner of the screen 10× → wait 7 seconds → tap 10× again
2. **Enable USB debugging** in Settings → Developer Options
3. **Download the APK** to the treadmill console (browser or USB flash drive)
4. **Install** via the file manager or Settings → Apps → Unknown sources
5. **Grant log read permission** (one-time setup from a PC on the same WiFi network):
   ```bash
   adb connect <treadmill-ip-address>:5555
   adb shell pm grant com.wmcorless.myhealth.bridge android.permission.READ_LOGS
   ```
6. Open **MyHealth Bridge** on the treadmill and tap **Start Broadcasting**
7. The service auto-starts on reboot

## Credits

Data reading approach based on [QZCompanionNordictrackTreadmill](https://github.com/cagnulein/QZCompanionNordictrackTreadmill) by Roberto Viola ([@cagnulein](https://github.com/cagnulein)).
