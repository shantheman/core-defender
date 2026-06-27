/** Capacitor native bridge. Everything platform-specific lives here so the web
 * build is untouched: on the web `isNative` is false and every function is a
 * no-op (the plugins ship web fallbacks, so static imports are safe to bundle).
 * Active only inside the iOS/Android Capacitor wrap. */

import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Preferences } from "@capacitor/preferences";
import { SAVE_KEY } from "./sim/state";

const isNative = Capacitor.isNativePlatform();

/** Run once at boot (from main.ts). Hides the native splash so the game's own
 * #splash takes over, and lays the content out clear of the system bars. */
export async function initNative(): Promise<void> {
  if (!isNative) return;
  const platform = Capacitor.getPlatform();
  try {
    await StatusBar.setStyle({ style: Style.Dark }).catch(() => {}); // light icons on the dark bar
    if (platform === "ios") {
      // iOS reports CSS safe-area insets correctly, so hide the bar for an
      // immersive game — the HUD/panels already pad for env(safe-area-inset-*).
      await StatusBar.hide().catch(() => {});
    } else {
      // Android: keep the bar visible AND stop the WebView from drawing under it
      // (overlay defaults to true → content slid behind the status bar + camera).
      // overlay:false insets the WebView below the bar. Paired with the theme's
      // edge-to-edge opt-out so it sticks on Android 15.
      await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
      await StatusBar.setBackgroundColor({ color: "#0a0f1c" }).catch(() => {});
    }
  } catch { /* plugin unavailable — ignore */ }
  try {
    await SplashScreen.hide();
  } catch { /* ignore */ }
}

// -- save durability ----------------------------------------------------------
// Mirror the localStorage save (`rts2_save`) to the native Preferences store
// (SharedPreferences / UserDefaults) so a transient empty-localStorage read on
// boot — or an accidental origin change — can't make us load defaults and then
// clobber the real save on the next write. All no-ops on web (there, localStorage
// IS the durable store, so the mirror would be redundant). See src/sim/state.ts.

/** Mirror a successful save to the durable native store (GameState.onPersist). */
export function mirrorSave(serialized: string): void {
  if (!isNative) return;
  void Preferences.set({ key: SAVE_KEY, value: serialized }).catch(() => {});
}

/** Wipe the native mirror — call wherever localStorage `SAVE_KEY` is removed
 * (the Settings reset) so a deliberate reset isn't silently undone by reconcile. */
export function clearSaveMirror(): void {
  if (!isNative) return;
  void Preferences.remove({ key: SAVE_KEY }).catch(() => {});
}

/** Boot guard (run before any save can fire): if localStorage has NO save but
 * the native mirror does, the boot read was bad (or the origin changed) — restore
 * the durable copy into localStorage so GameState.load() picks it up instead of
 * defaulting. Acts ONLY when localStorage is empty, so a legit reset/new game is
 * never undone (reset clears the mirror too). Returns true if it restored. */
export async function reconcileSaveFromNative(): Promise<boolean> {
  if (!isNative || typeof localStorage === "undefined") return false;
  try {
    if (localStorage.getItem(SAVE_KEY)) return false; // localStorage already has a save -> trust it
    const { value } = await Preferences.get({ key: SAVE_KEY });
    if (value) { localStorage.setItem(SAVE_KEY, value); return true; }
  } catch { /* best effort — never block boot */ }
  return false;
}

export type HapticKind = "light" | "medium" | "heavy" | "success" | "warning";

/** Fire a haptic — native app only (web stays silent: iOS web has no vibration
 * and we don't want to buzz Android web). Fire-and-forget. */
export function haptic(kind: HapticKind): void {
  if (!isNative) return;
  if (kind === "success") { void Haptics.notification({ type: NotificationType.Success }).catch(() => {}); return; }
  if (kind === "warning") { void Haptics.notification({ type: NotificationType.Warning }).catch(() => {}); return; }
  const style = kind === "heavy" ? ImpactStyle.Heavy : kind === "medium" ? ImpactStyle.Medium : ImpactStyle.Light;
  void Haptics.impact({ style }).catch(() => {});
}
