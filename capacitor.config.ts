import type { CapacitorConfig } from "@capacitor/cli";

/** Capacitor wrap config (com.baumangames.mechtide). The web build in dist/ is
 * the app; `npm run cap:sync` copies it into the native shells. The native
 * splash stays up until the web app boots (we hide it in src/native.ts), then
 * the game's own #splash takes over — no flash between them. */
const config: CapacitorConfig = {
  appId: "com.baumangames.mechtide",
  appName: "Mech Tide",
  webDir: "dist",
  // ⚠️ DO NOT add a `server` block / set `androidScheme` / `hostname` / `url`.
  // localStorage (the save store, key `rts2_save`) is keyed by ORIGIN
  // (scheme://host). Changing any of these changes the origin and orphans
  // EVERY existing player's save in a single update — a mass wipe. The native
  // Preferences mirror (src/native.ts) is a safety net, not a license to change
  // this. If a server config is ever truly needed, migrate saves deliberately.
  backgroundColor: "#0a0f1c", // dark field — no white flash before the WebView paints
  plugins: {
    SplashScreen: {
      launchAutoHide: false,    // we hide it ourselves once the page is up
      backgroundColor: "#0a0f1c",
    },
  },
};

export default config;
