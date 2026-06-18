/** Looping background music — a streamed HTML5 <audio> element, kept separate
 * from the synthesized SFX in audio.ts. Respects GameState.musicVolume
 * (0 = off). Browser autoplay policy: it only starts after the first user
 * gesture; raising the Settings slider (a gesture itself) also starts it. */

import { game } from "./game";
import { getAudioContext, perceptualGain } from "./audio";

const TRACK = import.meta.env.BASE_URL + "audio/future.mp3";

/** Master trim on the background track so it sits under the SFX. Applied on top
 * of the player's Music slider (which still spans its full 0–100%). Output is
 * `slider² × MUSIC_MASTER`; 0.32 makes the 50% slider land where the old 0.5 ×
 * curve put 40% (0.4²·0.5 = 0.5²·0.32 = 0.08) — Shannon's preferred default. */
const MUSIC_MASTER = 0.32;

let el: HTMLAudioElement | null = null;
let unlocked = false;
let gainNode: GainNode | null = null;

function ensureEl(): HTMLAudioElement {
  if (!el) {
    el = new Audio(TRACK);
    el.loop = true;
    el.preload = "auto";
    el.id = "bgm";
    document.body.appendChild(el); // in-DOM aids mobile playback reliability
  }
  return el;
}

/** Route the <audio> element through a Web Audio gain node so the volume is
 * actually adjustable on iOS, which IGNORES HTMLMediaElement.volume (there any
 * value > 0 plays at full). Built once, after a gesture has unlocked audio.
 * After routing, the element plays ONLY through the graph, so gainNode owns the
 * level. Returns null pre-context / if routing fails (caller falls back to
 * a.volume, which is correct on desktop). */
function ensureGraph(a: HTMLAudioElement): GainNode | null {
  if (gainNode) return gainNode;
  const ctx = getAudioContext();
  if (!ctx) return null;
  if (ctx.state === "suspended") void ctx.resume();
  try {
    const src = ctx.createMediaElementSource(a);
    const g = ctx.createGain();
    src.connect(g).connect(ctx.destination);
    gainNode = g;
  } catch {
    gainNode = null; // already routed / unsupported -> a.volume fallback
  }
  return gainNode;
}

/** Push the current musicVolume to the live element, starting or pausing as
 * needed. Playback only begins once a user gesture has unlocked audio. */
function apply(): void {
  const a = ensureEl();
  const v = Math.max(0, Math.min(1, game.gs.musicVolume));
  const g = unlocked ? ensureGraph(a) : null;
  if (g) {
    g.gain.value = perceptualGain(v) * MUSIC_MASTER; // iOS-safe volume, perceptual taper
    a.volume = 1;                                    // element at full; the gain node sets the level
  } else {
    a.volume = perceptualGain(v) * MUSIC_MASTER;     // pre-unlock / no Web Audio: best-effort (desktop)
  }
  if (v <= 0) {
    a.pause();
  } else if (unlocked && a.paused) {
    void a.play().catch(() => { /* still blocked; retried on next gesture/apply */ });
  }
}

/** Settings "Music" slider -> live volume (0 = off). */
export function setMusicVolume(v: number): void {
  game.gs.musicVolume = Math.max(0, Math.min(1, v));
  apply();
}

/** Wire autoplay unlock + tab-visibility handling. Call once at boot. */
export function initMusic(): void {
  const unlock = () => { unlocked = true; apply(); };
  for (const ev of ["pointerdown", "touchend", "keydown"]) {
    window.addEventListener(ev, unlock, { once: true });
  }
  // Pause when the tab is hidden; resume (if music is on) when it returns.
  document.addEventListener("visibilitychange", () => {
    if (!el) return;
    if (document.hidden) el.pause();
    else apply();
  });
}
