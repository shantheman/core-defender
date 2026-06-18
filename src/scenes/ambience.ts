/** Enemy movement ambience — per-TYPE looping "engine" beds. While ≥1 enemy of
 * a type is alive, ONE looping source plays for that type (not one per
 * instance), so a swarm of grunts is a single bed, not forty stacked copies.
 * Beds start/stop with their type's presence and follow the SFX volume slider
 * live. The grunt also gets a satellite layer: its continuous engine loop with
 * alternating beep/boop one-shots a couple seconds apart.
 *
 * Driven by BattleScene.update via sync(present, dt); silenced on pause / game
 * over via stopAll(). Volume-gated on game.gs.volume (the SFX slider), the same
 * gate the one-shot SFX use, so muting kills everything. */

import { game } from "../game";
import { getAudioContext, perceptualGain } from "../audio";

const BASE = import.meta.env.BASE_URL;

// Per-type movement loop + a mix gain. Loops STACK when several types share the
// screen, so each is kept fairly low; the boss is alone and gets more presence.
const LOOPS: Record<string, { url: string; gain: number }> = {
  grunt:   { url: BASE + "audio/enemy-grunt-loop.mp3",   gain: 0.11 },
  fast:    { url: BASE + "audio/enemy-fast-loop.mp3",    gain: 0.28 },
  tough:   { url: BASE + "audio/enemy-tough-loop.mp3",   gain: 0.60 },
  tank:    { url: BASE + "audio/enemy-tank-loop.mp3",    gain: 0.40 },
  bomber:  { url: BASE + "audio/enemy-bomber-loop.mp3",  gain: 0.28 },
  shooter: { url: BASE + "audio/enemy-shooter-loop.mp3", gain: 0.28 },
  boss:    { url: BASE + "audio/enemy-boss-loop.mp3",    gain: 0.55 },
};

// Grunt's satellite chatter — alternated as one-shots over its engine loop.
const BEEP_A = "__grunt_beep_a";
const BEEP_A_URL = BASE + "audio/enemy-grunt-beep-a.mp3";
const BEEP_GAIN = 0.4;
const BEEP_GAP = 1.4;       // quiet beats AFTER a beep finishes, before the next
const BEEP_GAP_JITTER = 1.0;

const buffers = new Map<string, AudioBuffer>();
let loadStarted = false;
let loaded = false;

interface Bed { src: AudioBufferSourceNode; gain: GainNode; }
const beds = new Map<string, Bed>();

let beepTimer = 0;   // countdown to the next grunt beep (seconds)
// The beep currently sounding — held so it can be cut when the grunts die (a
// fire-and-forget would keep chirping after the last one's gone). At most one
// plays at a time (the timer prevents overlap).
let beepSrc: AudioBufferSourceNode | null = null;
let beepGain: GainNode | null = null;

async function ensureLoaded(c: AudioContext): Promise<void> {
  if (loadStarted) return;
  loadStarted = true;
  const jobs: Array<[string, string]> = [
    ...Object.entries(LOOPS).map(([k, v]) => [k, v.url] as [string, string]),
    [BEEP_A, BEEP_A_URL],
  ];
  await Promise.all(jobs.map(async ([name, url]) => {
    try {
      const arr = await (await fetch(url)).arrayBuffer();
      buffers.set(name, await c.decodeAudioData(arr));
    } catch { /* missing/undecodable -> that bed/beep stays silent */ }
  }));
  loaded = true;
}

function startBed(c: AudioContext, key: string, vol: number): void {
  const buf = buffers.get(key);
  if (!buf) return;
  try {
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = c.createGain();
    const target = vol * (LOOPS[key]?.gain ?? 0.3);
    g.gain.setValueAtTime(0, c.currentTime);          // fade in to avoid a click
    g.gain.linearRampToValueAtTime(target, c.currentTime + 0.12);
    src.connect(g).connect(c.destination);
    src.start();
    beds.set(key, { src, gain: g });
  } catch { /* never crash over audio */ }
}

function stopBed(c: AudioContext | null, key: string): void {
  const bed = beds.get(key);
  if (!bed) return;
  beds.delete(key);
  if (!c) return;
  try {
    const t = c.currentTime;
    bed.gain.gain.cancelScheduledValues(t);
    bed.gain.gain.setValueAtTime(bed.gain.gain.value, t);
    bed.gain.gain.linearRampToValueAtTime(0, t + 0.15); // fade out to avoid a click
    bed.src.stop(t + 0.18);
  } catch { /* already stopped */ }
}

/** Cut the grunt beep that's currently sounding (grunts died, muted, paused). */
function stopBeep(c: AudioContext | null): void {
  const src = beepSrc, g = beepGain;
  beepSrc = null; beepGain = null;
  if (!src) return;
  if (!c || !g) { try { src.stop(); } catch { /* already stopped */ } return; }
  try {
    const t = c.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.08); // quick fade so it doesn't click
    src.stop(t + 0.1);
  } catch { /* already stopped */ }
}

/** Reconcile the playing beds with the set of enemy-type keys currently on
 * screen, then advance the grunt beep layer. Call once per active frame. */
export function sync(present: Set<string>, dt: number): void {
  const c = getAudioContext();
  if (!c || c.state !== "running") return;
  if (!loaded) { void ensureLoaded(c); return; }
  const vol = perceptualGain(game.gs.volume);

  for (const key of Object.keys(LOOPS)) {
    const want = present.has(key) && vol > 0;
    const bed = beds.get(key);
    if (want && !bed) startBed(c, key, vol);
    else if (!want && bed) stopBed(c, key);
    else if (bed) bed.gain.gain.setTargetAtTime(vol * (LOOPS[key]?.gain ?? 0.3), c.currentTime, 0.05);
  }

  // Grunt satellite layer: while grunts are alive and audible, fire the beep on
  // a timer (reset to the clip's length + a gap so beeps never overlap, reading
  // as paced chatter). When the grunts are gone (or muted) the one sounding is
  // cut immediately so it doesn't keep chirping over an empty field.
  if (present.has("grunt") && vol > 0) {
    if (beepGain) beepGain.gain.setTargetAtTime(vol * BEEP_GAIN, c.currentTime, 0.05); // follow slider
    beepTimer -= dt;
    if (beepTimer <= 0) {
      const buf = buffers.get(BEEP_A);
      if (!buf) { beepTimer = 3; }
      else {
        try {
          const src = c.createBufferSource();
          src.buffer = buf;
          const g = c.createGain();
          g.gain.value = vol * BEEP_GAIN;
          src.connect(g).connect(c.destination);
          src.onended = () => { if (beepSrc === src) { beepSrc = null; beepGain = null; } };
          src.start();
          beepSrc = src; beepGain = g;
          beepTimer = buf.duration + BEEP_GAP + Math.random() * BEEP_GAP_JITTER;
        } catch { beepTimer = 3; }
      }
    }
  } else {
    stopBeep(c);
    beepTimer = 0; // re-arm so the next grunt wave chirps promptly
  }
}

/** Kill every bed immediately (pause, game over, leaving the battle). Safe to
 * call when nothing is playing or the context never came up. */
export function stopAll(): void {
  const c = getAudioContext();
  for (const key of [...beds.keys()]) stopBed(c, key);
  beds.clear();
  stopBeep(c);
  beepTimer = 0;
}
