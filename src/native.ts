/** Capacitor native bridge. Everything platform-specific lives here so the web
 * build is untouched: on the web `isNative` is false and every function is a
 * no-op. The plugin modules are dynamically imported so they aren't pulled into
 * the web bundle at all. Active only inside the iOS/Android Capacitor wrap. */

import { Capacitor } from "@capacitor/core";

const isNative = Capacitor.isNativePlatform();

/** Run once at boot (from main.ts). Hides the native splash so the game's own
 * #splash takes over, and makes the bar dark/hidden for an immersive game. */
export async function initNative(): Promise<void> {
  if (!isNative) return;
  const platform = Capacitor.getPlatform();
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark }).catch(() => {}); // light icons on our dark bar
    if (platform === "ios") {
      // iOS reports CSS safe-area insets correctly, so hide the bar for an
      // immersive game — the HUD/panels already pad for env(safe-area-inset-*).
      await StatusBar.hide().catch(() => {});
    } else {
      // Android 15 forces edge-to-edge and its WebView doesn't surface safe-area
      // insets to CSS, so hiding the bar pushed the HUD under the camera cutout.
      // Keep the bar visible (the theme opts out of edge-to-edge → content sits
      // below it) and just tint it to match the field.
      await StatusBar.setBackgroundColor({ color: "#0a0f1c" }).catch(() => {});
    }
  } catch { /* plugin unavailable — ignore */ }
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch { /* ignore */ }
}

export type HapticKind = "light" | "medium" | "heavy" | "success" | "warning";

/** Fire a haptic — native app only. The web stays silent on purpose (iOS web has
 * no vibration, and we don't want to buzz Android web). Fire-and-forget. */
export function haptic(kind: HapticKind): void {
  if (!isNative) return;
  void (async () => {
    try {
      const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
      if (kind === "success") await Haptics.notification({ type: NotificationType.Success });
      else if (kind === "warning") await Haptics.notification({ type: NotificationType.Warning });
      else {
        const style = kind === "heavy" ? ImpactStyle.Heavy : kind === "medium" ? ImpactStyle.Medium : ImpactStyle.Light;
        await Haptics.impact({ style });
      }
    } catch { /* ignore */ }
  })();
}
