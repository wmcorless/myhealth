package com.wmcorless.myhealth.bridge

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val statusText = findViewById<TextView>(R.id.status_text)
        val startBtn = findViewById<Button>(R.id.start_btn)
        val stopBtn = findViewById<Button>(R.id.stop_btn)

        requestBlePermissionsIfNeeded()

        startBtn.setOnClickListener {
            val intent = Intent(this, TreadmillBridgeService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                startService(intent)
            }
            statusText.text = "Service started!\n\nOpen MyHealth on your phone, go to Preferences → Treadmill, and tap Scan."
        }

        stopBtn.setOnClickListener {
            stopService(Intent(this, TreadmillBridgeService::class.java))
            statusText.text = "Service stopped."
        }

        statusText.text = "Tap Start to begin broadcasting treadmill data to MyHealth via Bluetooth."
    }

    private fun requestBlePermissionsIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val perms = arrayOf(
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_ADVERTISE
            )
            val missing = perms.filter {
                ActivityCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
            }
            if (missing.isNotEmpty()) {
                ActivityCompat.requestPermissions(this, missing.toTypedArray(), 100)
            }
        }
    }
}
