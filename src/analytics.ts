/** Anonymous product analytics (PostHog) — playtime + progression for the
 * friend test and beyond.
 *
 * Privacy: NO PII. PostHog assigns an anonymous per-browser id; we never set a
 * name. It's OFF in dev and whenever POSTHOG_KEY is blank, and every call fails
 * silently (ad blockers, offline, init errors) so analytics can never affect
 * gameplay. The SDK is dynamically imported only when enabled, so it adds
 * nothing to the bundle until a key is set.
 *
 * Same code runs in the Capacitor (App Store) build's webview and queues events
 * offline — see docs/TODO.md (analytics) and the App Privacy nutrition label. */

import { GAME_VERSION } from "./version";

// Public client key — safe to embed in the client. Paste the PostHog PROJECT
// key here to turn analytics on; leave blank to keep it fully off. This game can
// share ONE project with other games: every event is tagged `app` (below), so
// you filter PostHog insights/dashboards by `app = mech-tide` to separate them.
const POSTHOG_KEY = "phc_CuTrrwvvBx54Wm2pxor6hDm2Xy3bdakZnFm95cUHgvsV"; // public client key (safe to embed)
const POSTHOG_HOST = "https://us.i.posthog.com"; // US Cloud
const APP = "mech-tide"; // event tag so multiple games can live in one project
// Session replay: OFF (it wasn't earning its keep). It was on briefly for the
// Callum-friends test. To re-enable, flip this to true AND turn on Session +
// Canvas recording in the PostHog project settings (canvas capture is a
// dashboard toggle — without it the Phaser battle records blank).
const SESSION_REPLAY = false;

type PH = {
  capture: (event: string, props?: Record<string, unknown>) => void;
  setPersonProperties?: (props: Record<string, unknown>) => void;
};
let ph: PH | null = null;
let playedMs = 0; // accumulated ACTIVE play time, flushed in chunks

// Storage health events (save/load failures, mirror restores) can fire at boot
// — before initAnalytics() finishes its async PostHog load — so buffer them and
// flush once `ph` is live. Best-effort; capped so a storage storm can't grow it.
const pendingStorage: { event: string; props?: Record<string, unknown> }[] = [];
export function reportStorageEvent(event: string, props?: Record<string, unknown>): void {
  if (ph) { try { ph.capture(event, props); } catch { /* ignore */ } return; }
  if (pendingStorage.length < 20) pendingStorage.push({ event, props });
}

export async function initAnalytics(): Promise<void> {
  if (!POSTHOG_KEY || import.meta.env.DEV) return; // off when unconfigured / in dev
  // Never send from localhost / preview builds (the Claude Code preview, local
  // `vite preview`, etc.) so test traffic never reaches the data — no per-
  // browser opt-out flag to remember.
  const host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host.endsWith(".local")) return;
  // Self-exclude your own sessions: load the game once with ?notrack=1 on each
  // of your browsers (persisted); ?notrack=0 undoes it. Keeps your events AND
  // replays out of the data entirely — PostHog never even loads on opted-out
  // devices.
  try {
    const nt = new URLSearchParams(location.search).get("notrack");
    if (nt === "1") localStorage.setItem("mt_notrack", "1");
    else if (nt === "0") localStorage.removeItem("mt_notrack");
    if (localStorage.getItem("mt_notrack") === "1") return;
  } catch { /* storage blocked — fall through and track normally */ }
  try {
    const { default: posthog } = await import("posthog-js");
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      autocapture: false,     // canvas game — we send explicit events, not DOM clicks
      capture_pageview: true,
      persistence: "localStorage",
      disable_session_recording: !SESSION_REPLAY, // replay for the friend test; off before launch
    });
    // Tag every event: `app` separates games sharing one project; `platform`
    // lets you slice metrics (esp. FPS) by native-vs-web once the App Store
    // build ships; `dpr` + the SDK's $screen_* help guess device class on web.
    posthog.register({ app: APP, platform: detectPlatform(),
      dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100 });
    ph = posthog as unknown as PH;
    track("app_open", { version: GAME_VERSION });
    // Flush any storage events that fired before PostHog was ready (boot reads).
    for (const e of pendingStorage.splice(0)) { try { ph.capture(e.event, e.props); } catch { /* ignore */ } }
    // Capture pending samples even if the player just closes the tab.
    const flushAll = () => { flushPlaytime(); flushFps(); };
    document.addEventListener("visibilitychange", () => { if (document.hidden) flushAll(); });
    window.addEventListener("pagehide", flushAll);
  } catch { /* blocked / failed — analytics is best-effort, never fatal */ }
}

export function track(event: string, props?: Record<string, unknown>): void {
  if (!ph) return;
  try { ph.capture(event, props); } catch { /* ignore */ }
}

/** Set person properties on the (anonymous) profile — e.g. `best_stage`, so the
 * furthest stage a player reached is a one-click distribution in PostHog rather
 * than a max-over-events query. */
export function setPlayer(props: Record<string, unknown>): void {
  if (!ph) return;
  try { ph.setPersonProperties?.(props); } catch { /* ignore */ }
}

/** "ios" / "android" inside the Capacitor native shell, else "web". Registered
 * as a super-property so every metric (esp. FPS) can be sliced native-vs-web. */
function detectPlatform(): string {
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  }).Capacitor;
  if (cap?.isNativePlatform?.()) return cap.getPlatform?.() ?? "native";
  return "web";
}

// FPS: BattleScene samples the (already smoothed) frame rate each active frame;
// we accumulate and emit ONE summary event per window — never per frame. Slice
// the summary by $device_type / platform to see which devices run smoothly.
let fpsSum = 0, fpsN = 0, fpsMin = Infinity, fpsSlow = 0;
const FPS_SLOW_BELOW = 50; // a sampled frame rate under this counts toward slow_pct

export function addFps(fps: number): void {
  if (!(fps > 0) || fps > 240) return; // skip warm-up / garbage samples
  fpsSum += fps; fpsN++;
  if (fps < fpsMin) fpsMin = fps;
  if (fps < FPS_SLOW_BELOW) fpsSlow++;
}

/** Send the accumulated FPS window (avg, worst, % slow). No-op under ~0.5s. */
export function flushFps(): void {
  if (fpsN < 30) { fpsSum = fpsN = fpsSlow = 0; fpsMin = Infinity; return; }
  const avg = Math.round(fpsSum / fpsN), min = Math.round(fpsMin);
  const slowPct = Math.round((fpsSlow / fpsN) * 100), samples = fpsN;
  fpsSum = fpsN = fpsSlow = 0; fpsMin = Infinity;
  track("fps", { fps_avg: avg, fps_min: min, slow_pct: slowPct, samples });
}

/** Add active play time (called each frame while a wave is live, in seconds). */
export function addPlaytime(seconds: number): void { playedMs += seconds * 1000; }

/** Send accumulated active time as a chunk; PostHog sums `seconds` per person. */
export function flushPlaytime(): void {
  const sec = Math.round(playedMs / 1000);
  playedMs = 0;
  if (sec > 0) track("playtime", { seconds: sec });
}
