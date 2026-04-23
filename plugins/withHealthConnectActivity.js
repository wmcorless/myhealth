const { withMainActivity } = require('@expo/config-plugins');

/**
 * Injects HealthConnectPermissionDelegate.setPermissionDelegate(this) into
 * MainActivity.onCreate() so that the Health Connect permission dialog works.
 * Without this the requestPermission() native call crashes with an
 * uninitialised lateinit property.
 */
const withHealthConnectActivity = (config) => {
  return withMainActivity(config, (mod) => {
    let contents = mod.modResults.contents;

    const importLine = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';

    // Add import if not already present
    if (!contents.includes(importLine)) {
      contents = contents.replace(
        /(^import .+$)/m,
        `$1\n${importLine}`
      );
    }

    // Inject setPermissionDelegate call inside onCreate after super.onCreate
    const setDelegateCall = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';
    if (!contents.includes(setDelegateCall)) {
      contents = contents.replace(
        /(super\.onCreate\(savedInstanceState\))/,
        `$1\n    ${setDelegateCall}`
      );
    }

    mod.modResults.contents = contents;
    return mod;
  });
};

module.exports = withHealthConnectActivity;
