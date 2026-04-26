package com.wmcorless.myhealth.bridge

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.ParcelUuid
import android.util.Log
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.File
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.UUID

/**
 * Foreground service that:
 *  1. Reads speed, incline and heart rate from the iFit log file on the NordicTrack X22i
 *  2. Advertises as a Bluetooth FTMS (Fitness Machine Service) treadmill (UUID 0x1826)
 *  3. Notifies connected phones (running MyHealth) with live treadmill data (UUID 0x2ACD)
 *
 * Packet format for characteristic 0x2ACD (FTMS Treadmill Data):
 *   Byte 0-1: Flags (uint16 LE) — 0x0408 (speed + inclination + elapsed) or
 *                                  0x0508 (speed + inclination + HR + elapsed)
 *   Byte 2-3: Instantaneous Speed (uint16 LE, unit: 0.01 km/h)
 *   Byte 4-5: Inclination (int16 LE, unit: 0.1 %)
 *   Byte 6-7: Ramp Angle Setting (int16 LE, unit: 0.1°) — always 0
 *   [Byte 8]:  Heart Rate (uint8, bpm) — only when HR > 0
 *   Byte 8/9 to 9/10: Elapsed Time (uint16 LE, seconds)
 */
class TreadmillBridgeService : Service() {

    companion object {
        private const val TAG = "MyHealthBridge"
        private const val NOTIFICATION_ID = 1
        private const val CHANNEL_ID = "bridge_channel"

        // FTMS service + characteristic UUIDs
        val FTMS_SERVICE_UUID: UUID = UUID.fromString("00001826-0000-1000-8000-00805f9b34fb")
        val TREADMILL_DATA_CHAR_UUID: UUID = UUID.fromString("00002acd-0000-1000-8000-00805f9b34fb")
        val FITNESS_MACHINE_FEATURE_CHAR_UUID: UUID = UUID.fromString("00002acc-0000-1000-8000-00805f9b34fb")
        val CLIENT_CONFIG_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

        // iFit log file candidates (checked in order; first existing path wins)
        private val IFIT_LOG_CANDIDATES = listOf(
            // iFit v2 (newer firmware — glassos)
            "/sdcard/android/data/com.ifit.glassos_service/files/.valinorlogs/log.latest.txt",
            // Classic iFit — wolflogs directory (picks latest file inside)
            "/sdcard/.wolflogs",
            "/.wolflogs"
        )
    }

    private var bluetoothManager: BluetoothManager? = null
    private var gattServer: BluetoothGattServer? = null
    private var advertiser: BluetoothLeAdvertiser? = null
    private var treadmillDataChar: BluetoothGattCharacteristic? = null

    private val connectedDevices = mutableSetOf<BluetoothDevice>()
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    @Volatile private var speedKph = 0f
    @Volatile private var inclinePct = 0f
    @Volatile private var heartRate = 0
    @Volatile private var elapsedSeconds = 0

    private var startTimeMs = 0L
    private var logFilePath = ""
    private var isIfitV2 = false

    // ── BLE GATT server callbacks ──────────────────────────────────────────────

    private val gattCallback = object : BluetoothGattServerCallback() {

        override fun onConnectionStateChange(device: BluetoothDevice, status: Int, newState: Int) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                connectedDevices.add(device)
                Log.i(TAG, "Phone connected: ${device.address}")
                updateNotification("Connected — streaming to ${device.address.takeLast(5)}")
            } else {
                connectedDevices.remove(device)
                Log.i(TAG, "Phone disconnected: ${device.address}")
                if (connectedDevices.isEmpty()) {
                    updateNotification("Broadcasting — open MyHealth on your phone")
                }
            }
        }

        override fun onCharacteristicReadRequest(
            device: BluetoothDevice, requestId: Int, offset: Int,
            characteristic: BluetoothGattCharacteristic
        ) {
            val value = when (characteristic.uuid) {
                FITNESS_MACHINE_FEATURE_CHAR_UUID ->
                    // Feature flags: speed + inclination supported
                    byteArrayOf(0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00)
                TREADMILL_DATA_CHAR_UUID -> buildFtmsPacket()
                else -> byteArrayOf()
            }
            gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value)
        }

        override fun onDescriptorWriteRequest(
            device: BluetoothDevice, requestId: Int,
            descriptor: BluetoothGattDescriptor, preparedWrite: Boolean,
            responseNeeded: Boolean, offset: Int, value: ByteArray
        ) {
            if (responseNeeded) {
                gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value)
            }
        }
    }

    // ── Lifecycle ──────────────────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        startTimeMs = System.currentTimeMillis()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification("Initializing…"))

        bluetoothManager = getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager

        findLogFile()
        setupGattServer()
        startAdvertising()
        startDataLoop()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
        advertiser?.stopAdvertising(object : AdvertiseCallback() {})
        gattServer?.close()
    }

    // ── iFit log discovery ─────────────────────────────────────────────────────

    private fun findLogFile() {
        // Check iFit v2 path first
        val v2 = IFIT_LOG_CANDIDATES[0]
        if (File(v2).exists()) {
            isIfitV2 = true
            logFilePath = v2
            Log.i(TAG, "Found iFit v2 log: $v2")
            return
        }

        // Fall back to wolflog directories
        for (dirPath in IFIT_LOG_CANDIDATES.drop(1)) {
            val dir = File(dirPath)
            if (dir.exists() && dir.isDirectory) {
                val latest = dir.listFiles()?.maxByOrNull { it.lastModified() }
                if (latest != null) {
                    logFilePath = latest.absolutePath
                    Log.i(TAG, "Found wolflog: $logFilePath")
                    return
                }
            }
        }
        Log.w(TAG, "No iFit log file found — will retry periodically")
    }

    // ── Data reading ───────────────────────────────────────────────────────────

    private fun readLatestValues() {
        if (logFilePath.isEmpty()) {
            findLogFile()
            if (logFilePath.isEmpty()) return
        }

        try {
            val lines = File(logFilePath).readLines()
            for (line in lines) {
                when {
                    line.contains("Changed KPH") || line.contains("Kph changed") -> {
                        line.trim().split(" ").lastOrNull()?.toFloatOrNull()?.let { speedKph = it }
                    }
                    line.contains("Changed Grade") || line.contains("Grade changed") -> {
                        line.trim().split(" ").lastOrNull()?.toFloatOrNull()?.let { inclinePct = it }
                    }
                    line.contains("HeartRateDataUpdate") -> {
                        line.trim().split(" ").lastOrNull()?.toIntOrNull()?.let { heartRate = it }
                    }
                }
            }
        } catch (e: IOException) {
            Log.e(TAG, "Error reading log: ${e.message}")
            logFilePath = "" // reset so next iteration retries discovery
        }
    }

    // ── FTMS packet builder ────────────────────────────────────────────────────

    /**
     * Builds an FTMS Treadmill Data packet (0x2ACD) compatible with the MyHealth
     * parseFtmsTreadmillData() function in treadmillBleService.ts.
     */
    private fun buildFtmsPacket(): ByteArray {
        val hasHr = heartRate in 30..250

        // Flags: bit 0=0 (speed present), bit 3=1 (inclination), bit 8=1 (HR if valid), bit 10=1 (elapsed)
        var flags = 0x0408 // speed + inclination + elapsed (always)
        if (hasHr) flags = flags or 0x0100

        val size = 2 + 2 + 2 + 2 + (if (hasHr) 1 else 0) + 2
        val buf = ByteBuffer.allocate(size).order(ByteOrder.LITTLE_ENDIAN)

        buf.putShort(flags.toShort())
        buf.putShort((speedKph * 100).toInt().coerceIn(0, 32767).toShort())   // uint16 (0.01 km/h)
        buf.putShort((inclinePct * 10).toInt().coerceIn(-3270, 3270).toShort()) // int16 (0.1 %)
        buf.putShort(0.toShort())                                               // ramp angle = 0
        if (hasHr) buf.put(heartRate.toByte())
        buf.putShort(elapsedSeconds.coerceIn(0, 65535).toShort())

        return buf.array()
    }

    // ── Main data loop ─────────────────────────────────────────────────────────

    private fun startDataLoop() {
        serviceScope.launch {
            while (isActive) {
                readLatestValues()
                elapsedSeconds = ((System.currentTimeMillis() - startTimeMs) / 1000).toInt()
                notifyConnectedDevices()
                delay(500)
            }
        }
    }

    private fun notifyConnectedDevices() {
        val char = treadmillDataChar ?: return
        val packet = buildFtmsPacket()
        char.value = packet
        for (device in connectedDevices.toList()) {
            gattServer?.notifyCharacteristicChanged(device, char, false)
        }
    }

    // ── BLE setup ──────────────────────────────────────────────────────────────

    private fun setupGattServer() {
        val bm = bluetoothManager ?: return
        gattServer = bm.openGattServer(this, gattCallback) ?: run {
            Log.e(TAG, "Failed to open GATT server")
            updateNotification("Error: could not open BLE GATT server")
            return
        }

        val ftmsService = BluetoothGattService(
            FTMS_SERVICE_UUID,
            BluetoothGattService.SERVICE_TYPE_PRIMARY
        )

        // Fitness Machine Feature characteristic (required by FTMS spec — READ)
        val featureChar = BluetoothGattCharacteristic(
            FITNESS_MACHINE_FEATURE_CHAR_UUID,
            BluetoothGattCharacteristic.PROPERTY_READ,
            BluetoothGattCharacteristic.PERMISSION_READ
        ).apply { value = byteArrayOf(0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00) }
        ftmsService.addCharacteristic(featureChar)

        // Treadmill Data characteristic (NOTIFY)
        val dataChar = BluetoothGattCharacteristic(
            TREADMILL_DATA_CHAR_UUID,
            BluetoothGattCharacteristic.PROPERTY_NOTIFY,
            0
        ).apply {
            addDescriptor(BluetoothGattDescriptor(
                CLIENT_CONFIG_UUID,
                BluetoothGattDescriptor.PERMISSION_READ or BluetoothGattDescriptor.PERMISSION_WRITE
            ).also { it.value = BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE })
        }
        treadmillDataChar = dataChar
        ftmsService.addCharacteristic(dataChar)

        gattServer?.addService(ftmsService)
        Log.i(TAG, "FTMS GATT server ready")
    }

    private fun startAdvertising() {
        val adapter = bluetoothManager?.adapter ?: return
        if (!adapter.isMultipleAdvertisementSupported) {
            Log.e(TAG, "BLE peripheral advertising not supported on this device")
            updateNotification("Error: BLE advertising not supported")
            return
        }

        // Set a recognizable device name that appears in MyHealth scan results
        @Suppress("DEPRECATION")
        adapter.name = "MyHealth Treadmill"

        advertiser = adapter.bluetoothLeAdvertiser
        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setConnectable(true)
            .setTimeout(0) // advertise indefinitely
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
            .build()

        val data = AdvertiseData.Builder()
            .setIncludeDeviceName(true)
            .addServiceUuid(ParcelUuid(FTMS_SERVICE_UUID))
            .build()

        advertiser?.startAdvertising(settings, data, object : AdvertiseCallback() {
            override fun onStartSuccess(settingsInEffect: AdvertiseSettings) {
                Log.i(TAG, "Advertising as FTMS treadmill 'MyHealth Treadmill'")
                updateNotification("Broadcasting — open MyHealth on your phone")
            }

            override fun onStartFailure(errorCode: Int) {
                Log.e(TAG, "BLE advertising failed: error $errorCode")
                updateNotification("Error: BLE advertising failed ($errorCode)")
            }
        })
    }

    // ── Notification helpers ───────────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Treadmill Bridge",
                NotificationManager.IMPORTANCE_LOW
            ).apply { description = "MyHealth Treadmill Bridge status" }
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                .createNotificationChannel(channel)
        }
    }

    private fun buildNotification(status: String): Notification {
        val intent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("MyHealth Bridge")
            .setContentText(status)
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentIntent(intent)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(status: String) {
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .notify(NOTIFICATION_ID, buildNotification(status))
    }
}
