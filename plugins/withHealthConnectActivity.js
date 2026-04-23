const { withMainActivity } = require('@expo/config-plugins');

/**
 * Injects HealthConnectPermissionDelegate.setPermissionDelegate(this) into
 * MainActivity.onCreate() so that the Health Connect permission dialog works.
 * Without this the requestPermission() native call crashes with an
 * uninitialised lateinit property.
 *
 * Handles two template variants:
 *  1. MainActivity already has an onCreate — injects after super.onCreate(...)
 *  2. MainActivity has no onCreate (Expo SDK 54 default) — adds the method
 */
const withHealthConnectActivity = (config) => {
  return withMainActivity(config, (mod) => {
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
      // No onCreate — add one before the final closing brace of the class
      contents = contents.replace(
        /^}[ \t]*$/m,
        `\n  override fun onCreate(savedInstanceState: android.os.Bundle?) {\n    super.onCreate(savedInstanceState)\n    ${setDelegateCall}\n  }\n}`
      );
    }

    mod.modResults.contents = contents;
    return mod;
  });
};

module.exports = withHealthConnectActivity;
