const { withMainActivity, withAndroidManifest } = require('@expo/config-plugins');

const HC_PACKAGE = 'com.google.android.apps.healthdata';

/**
 * Applies all Health Connect manifest and Activity requirements:
 *
 * 1. <queries> block — required for Android 11+ package-visibility so that
 *    HealthConnectClient.getSdkStatus() can detect whether HC is installed.
 *
 * 2. <activity-alias ViewPermissionUsageActivity> — required on Android 14+
 *    for MyHealth to appear in Health Connect's "App permissions" list.
 *
 * 3. HealthConnectPermissionDelegate.setPermissionDelegate(this) in
 *    MainActivity.onCreate() — required so the native requestPermission()
 *    can launch the HC dialog without crashing.  Handles both Expo SDK
 *    templates: those that already have an onCreate() and those that don't.
 */
const withHealthConnectActivity = (config) => {
  // ── Manifest additions ────────────────────────────────────────────────
  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;

    // 1. <queries> for package visibility
    if (!manifest.queries) manifest.queries = [];
    const hasPackageQuery = manifest.queries.some(
      (q) => q.package && q.package.some((p) => p.$?.['android:name'] === HC_PACKAGE)
    );
    if (!hasPackageQuery) {
      manifest.queries.push({ package: [{ $: { 'android:name': HC_PACKAGE } }] });
    }

    // 2. <activity-alias> for Android 14+ VIEW_PERMISSION_USAGE
    const application = manifest.application[0];
    const aliases = application['activity-alias'] ?? [];
    const hasAlias = aliases.some(
      (a) => a.$?.['android:name'] === 'ViewPermissionUsageActivity'
    );
    if (!hasAlias) {
      aliases.push({
        $: {
          'android:name': 'ViewPermissionUsageActivity',
          'android:exported': 'true',
          'android:targetActivity': '.MainActivity',
          'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }],
            category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }],
          },
        ],
      });
      application['activity-alias'] = aliases;
    }

    return mod;
  });

  // ── MainActivity injection ────────────────────────────────────────────
  config = withMainActivity(config, (mod) => {
    let contents = mod.modResults.contents;

    const importLine =
      'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
    const setDelegateCall =
      'HealthConnectPermissionDelegate.setPermissionDelegate(this)';

    // Add import after the first existing import line
    if (!contents.includes(importLine)) {
      contents = contents.replace(/(^import .+$)/m, `$1\n${importLine}`);
    }

    // Nothing to do if already injected
    if (contents.includes(setDelegateCall)) {
      mod.modResults.contents = contents;
      return mod;
    }

    if (contents.includes('override fun onCreate')) {
      // onCreate exists — inject after super.onCreate(...)
      contents = contents.replace(
        /(super\.onCreate\([^)]*\))/,
        `$1\n    ${setDelegateCall}`
      );
    } else {
      // No onCreate (Expo SDK 54 default) — add the method before closing brace
      contents = contents.replace(
        /^}[ \t]*$/m,
        `\n  override fun onCreate(savedInstanceState: android.os.Bundle?) {\n    super.onCreate(savedInstanceState)\n    ${setDelegateCall}\n  }\n}`
      );
    }

    mod.modResults.contents = contents;
    return mod;
  });

  return config;
};

module.exports = withHealthConnectActivity;
