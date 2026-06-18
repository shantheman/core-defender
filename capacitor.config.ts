import type { CapacitorConfig } from "@capacitor/cli";

/** Capacitor wrap config (com.baumangames.mechtide). The web build in dist/ is
 * the app; `npm run cap:sync` copies it into the native shells. The native
 * splash stays up until the web app boots (we hide it in src/native.ts), then
 * the game's own #splash takes over — no flash between them. */
const config: CapacitorConfig = {
  appId: "com.baumangames.mechtide",
  appName: "Mech Tide",
  webDir: "dist",
  backgroundColor: "#0a0f1c", // dark field — no white flash before the WebView paints
  plugins: {
    SplashScreen: {
      launchAutoHide: false,    // we hide it ourselves once the page is up
      backgroundColor: "#0a0f1c",
    },
  },
};

export default config;
