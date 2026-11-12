/* global require, module */
/* eslint-disable @typescript-eslint/no-require-imports -- Expo loads config plugins with CommonJS. */
const { withMainActivity } = require("expo/config-plugins");

const marker = "// Readograph: bridge predictive Back on Android 13–15.";
const callback = `${marker}
  private val readographBackCallback = object : androidx.activity.OnBackPressedCallback(true) {
    override fun handleOnBackPressed() {
      isEnabled = false
      try {
        this@MainActivity.onBackPressed()
      } finally {
        isEnabled = true
      }
    }
  }
`;
const fallback = `
    if (Build.VERSION.SDK_INT in 33..35) {
      readographBackCallback.isEnabled = false
      try {
        super.invokeDefaultOnBackPressed()
      } finally {
        readographBackCallback.isEnabled = true
      }
      return
    }
`;

/**
 * RN 0.88 registers its predictive-Back bridge only on API 36+. With the manifest opt-in,
 * API 33–35 otherwise finish the Activity without emitting hardwareBackPress to JS.
 * Mirror RN's AndroidX dispatcher bridge, including disabling it for the unhandled default
 * exit (otherwise the dispatcher would call back into JS indefinitely).
 * Remove when RN registers its callback on these API levels too.
 */
module.exports = function withAndroidBack(config) {
  return withMainActivity(config, (config) => {
    const result = config.modResults;
    if (result.language !== "kt")
      throw new Error("Android Back bridge requires Kotlin MainActivity");
    if (result.contents.includes(marker)) return config;
    const anchors = [
      "class MainActivity : ReactActivity() {",
      "super.onCreate(null)",
      "override fun invokeDefaultOnBackPressed() {",
    ];
    if (!anchors.every((anchor) => result.contents.includes(anchor)))
      throw new Error("Could not find MainActivity Back bridge anchors");
    result.contents = result.contents
      .replace(anchors[0], `${anchors[0]}\n  ${callback}`)
      .replace(
        anchors[1],
        `${anchors[1]}\n    if (Build.VERSION.SDK_INT in 33..35) {\n      onBackPressedDispatcher.addCallback(this, readographBackCallback)\n    }`,
      )
      .replace(anchors[2], `${anchors[2]}${fallback}`);
    return config;
  });
};
