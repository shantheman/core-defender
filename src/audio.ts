/** Synthesized SFX — a Web Audio port of the original audio.py. No audio
 * files; every sound is generated at runtime from the same recipes
 * (square/sine, linear decay, optional pitch sweep + noise).
 *
 * Respects GameState.volume (0 = muted). The AudioContext unlocks on the first
 * user gesture (browser autoplay policy).
 */

import { game } from "./game";

interface ToneSpec {
  freq: number; dur: number; vol: number;
  wave: "square" | "sine";
  sweep?: number;   // Hz/sec added to freq over time
  noise?: number;   // 0..1 noise mix
}

// Same recipes as the original audio.py (+ "shield" from v0.5.1).
const SPECS: Record<string, ToneSpec> = {
  shoot: { freq: 660, dur: 0.06, vol: 0.20, wave: "square", sweep: -3000 },
  kill: { freq: 200, dur: 0.12, vol: 0.30, wave: "square", sweep: -600, noise: 0.6 },
  hit: { freq: 150, dur: 0.10, vol: 0.30, wave: "square", noise: 0.8 },
  shield: { freq: 520, dur: 0.16, vol: 0.32, wave: "sine", sweep: -900, noise: 0.15 },
  laser: { freq: 130, dur: 0.30, vol: 0.30, wave: "square", noise: 0.35 },
  boom: { freq: 80, dur: 0.40, vol: 0.50, wave: "sine", sweep: -120, noise: 0.7 },
  buy: { freq: 880, dur: 0.10, vol: 0.30, wave: "square", sweep: 700 },
};

/** File-based one-shot SFX, decoded into the same buffer pool as the synth
 * sounds (so they share the Sound-volume gate + the AudioContext unlock).
 * `gain` balances each clip against the synth SFX in the mix. Add more here. */
const FILE_SFX: Record<string, { url: string; gain: number }> = {
  boss_fire:    { url: import.meta.env.BASE_URL + "audio/mythic-hit-02.mp3", gain: 0.6 },
  shooter_fire: { url: import.meta.env.BASE_URL + "audio/shooter-firing.mp3", gain: 0.6 },
  level_clear:  { url: import.meta.env.BASE_URL + "audio/big-win-confetti-09.mp3", gain: 0.7 },
  upgrade:      { url: import.meta.env.BASE_URL + "audio/win03.mp3", gain: 1.6 }, // shop buy click — boosted past unity; the source clip is quiet so there's headroom
  click:        { url: import.meta.env.BASE_URL + "audio/selection-click-05.mp3", gain: 0.45 },
  // Tower firing — one per shot. cannon = main turret, auto_laser = the
  // Auto-Laser upgrade's base zap, drone_fire = the drone's bolt.
  cannon:       { url: import.meta.env.BASE_URL + "audio/tower-cannon.mp3", gain: 0.5 },
  auto_laser:   { url: import.meta.env.BASE_URL + "audio/tower-auto-laser.mp3", gain: 0.45 },
  drone_fire:   { url: import.meta.env.BASE_URL + "audio/tower-drone.mp3", gain: 0.45 },
  // Enemy deaths: boss gets its own boom; everything else picks one of three
  // pop variations at random (see kill() in BattleScene) so it never machine-guns.
  boss_explosion: { url: import.meta.env.BASE_URL + "audio/boss-explosion.mp3", gain: 0.6 },
  enemy_pop_1:    { url: import.meta.env.BASE_URL + "audio/enemy-explosion-1.mp3", gain: 0.4 },
  enemy_pop_2:    { url: import.meta.env.BASE_URL + "audio/enemy-explosion-2.mp3", gain: 0.4 },
  enemy_pop_3:    { url: import.meta.env.BASE_URL + "audio/enemy-explosion-3.mp3", gain: 0.4 },
  // Cleared a wave (the non-boss waves; the boss/stage clear keeps level_clear).
  wave_complete:  { url: import.meta.env.BASE_URL + "audio/wave-complete.mp3", gain: 0.6 },
  // An enemy crashing into the tower body (not the shield, not a bullet hit).
  tower_hit:      { url: import.meta.env.BASE_URL + "audio/tower-hit.mp3", gain: 0.6 },
  // Ultimate activations (laser keeps its own synth sweep). One-shot per cast;
  // the ultimate cooldown is the throttle.
  ultimate_freeze: { url: import.meta.env.BASE_URL + "audio/ultimate-freeze.mp3", gain: 0.7 },
  ultimate_emp:    { url: import.meta.env.BASE_URL + "audio/ultimate-emp.mp3", gain: 0.7 },
  ultimate_warp:   { url: import.meta.env.BASE_URL + "audio/ultimate-timewarp.mp3", gain: 0.7 },
};

/** Min seconds between replays of a rapid-fire one-shot. A high fire rate (low
 * cooldowns + multi-shot) would otherwise stack dozens of overlapping copies
 * into a muddy roar; a tiny gap keeps it punchy without dropping audible shots. */
const THROTTLE: Record<string, number> = {
  cannon: 0.05, auto_laser: 0.05, drone_fire: 0.05,
  // Mass-death frames (EMP, explosive splash) would otherwise stack a pile of
  // pops; per-name throttle caps each variation so a wipe is a crunch, not a wall.
  enemy_pop_1: 0.05, enemy_pop_2: 0.05, enemy_pop_3: 0.05,
  // A swarm reaching the tower in one frame shouldn't stack a pile of 1s thuds.
  tower_hit: 0.06,
};
const lastPlayed = new Map<string, number>();

let ctx: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();
const gainByName = new Map<string, number>(); // per-name volume multiplier (synth omitted = 1)
let filesLoaded = false;

function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
  } catch {
    return null; // no audio -> silent, never crash
  }
  for (const [name, t] of Object.entries(SPECS)) {
    const rate = ctx.sampleRate;
    const n = Math.max(1, Math.floor(rate * t.dur));
    const buf = ctx.createBuffer(1, n, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const time = i / rate;
      const env = 1 - i / n;
      const f = t.freq + (t.sweep ?? 0) * time;
      let s = Math.sin(2 * Math.PI * f * time);
      if (t.wave === "square") s = s >= 0 ? 1 : -1;
      if (t.noise) s = (1 - t.noise) * s + t.noise * (Math.random() * 2 - 1);
      data[i] = Math.max(-1, Math.min(1, s * env * t.vol));
    }
    buffers.set(name, buf);
  }
  void loadFileSfx(ctx); // decode the mp3 SFX into the same pool (async, once)
  return ctx;
}

/** The shared AudioContext (created on demand). music.ts routes the background
 * track through it so volume is adjustable on iOS, which ignores
 * HTMLMediaElement.volume. Reusing one context keeps the iOS unlock + the
 * "playback" audioSession set up here in one place. */
export function getAudioContext(): AudioContext | null {
  return ensureContext();
}

/** Map a 0..1 slider value to a gain that tracks PERCEIVED loudness. Hearing is
 * ~logarithmic, so a raw linear slider barely changes across its top half;
 * squaring makes the knob position feel natural (0 still = silent). Shared by
 * SFX (here) and music (music.ts) so the curve has one home. */
export function perceptualGain(v: number): number {
  return v <= 0 ? 0 : v * v;
}

/** Fetch + decode each FILE_SFX clip into the buffer pool. Runs once, after the
 * context exists (decodeAudioData needs it). A failed load just skips that SFX. */
async function loadFileSfx(c: AudioContext): Promise<void> {
  if (filesLoaded) return;
  filesLoaded = true;
  for (const [name, spec] of Object.entries(FILE_SFX)) {
    try {
      const arr = await (await fetch(spec.url)).arrayBuffer();
      buffers.set(name, await c.decodeAudioData(arr));
      gainByName.set(name, spec.gain);
    } catch { /* missing/undecodable -> that SFX stays silent */ }
  }
}

// iOS: route audio as "playback" so the physical ring/silent switch doesn't
// mute the game (Web Audio is treated as ambient by default and silenced).
try {
  const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
  if (session) session.type = "playback";
} catch { /* older iOS / non-iOS */ }

// Unlock on the first user gesture (required by autoplay policies). iOS
// historically prefers touchend; listen broadly and self-heal on visibility.
for (const ev of ["pointerdown", "touchend", "keydown"]) {
  window.addEventListener(ev, () => { void ensureContext()?.resume(); }, { once: true });
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && ctx?.state === "suspended") void ctx.resume();
});

export function play(name: keyof typeof SPECS | keyof typeof FILE_SFX): void {
  const gs = game.gs;
  if (gs.volume <= 0) return; // volume 0 IS mute
  const c = ensureContext();
  const buf = buffers.get(name);
  if (!c || !buf) return;
  if (c.state === "suspended") void c.resume(); // self-heal; this sound is dropped
  if (c.state !== "running") return;
  const minGap = THROTTLE[name];
  if (minGap != null) {
    if (c.currentTime - (lastPlayed.get(name) ?? -1) < minGap) return;
    lastPlayed.set(name, c.currentTime);
  }
  try {
    const src = c.createBufferSource();
    src.buffer = buf;
    const gain = c.createGain();
    gain.gain.value = perceptualGain(gs.volume) * (gainByName.get(name) ?? 1);
    src.connect(gain).connect(c.destination);
    src.start();
  } catch { /* never crash over audio */ }
}

/** A tight cluster of explosion pops — for a squadron (the bomber squad) blowing
 * up as a chain. `count` blasts, each a few ms after the last, scheduled on the
 * audio clock so they stack into one big rolling multi-explosion. Deliberately
 * bypasses the single-pop THROTTLE (stacking IS the point) and cycles the three
 * pop variations so adjacent blasts don't sound identical. */
export function playExplosionBurst(count: number): void {
  const gs = game.gs;
  if (gs.volume <= 0) return;
  const c = ensureContext();
  if (c?.state === "suspended") void c.resume();
  if (!c || c.state !== "running") return;
  const names = ["enemy_pop_1", "enemy_pop_2", "enemy_pop_3"] as const;
  const base = perceptualGain(gs.volume);
  const n = Math.max(1, Math.min(count, 12)); // cap so nothing can schedule a swarm of dozens
  for (let i = 0; i < n; i++) {
    const name = names[i % names.length];
    const buf = buffers.get(name);
    if (!buf) continue;
    try {
      const src = c.createBufferSource();
      src.buffer = buf;
      const g = c.createGain();
      const vary = 0.82 + (i % 3) * 0.09;            // slight per-blast level variation
      g.gain.value = base * (gainByName.get(name) ?? 0.4) * vary;
      src.connect(g).connect(c.destination);
      src.start(c.currentTime + i * 0.008 + Math.random() * 0.004); // ~8–12 ms apart
    } catch { /* never crash over audio */ }
  }
}
