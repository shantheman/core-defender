/** Wave / level math — a 1:1 port of the original's waves.py. All scaling is
 * driven by effectiveWave(), which resets each level and ramps steeper on
 * higher levels. Pure functions: no Phaser, no DOM (unit-tested in tests/). */

import {
  BOMBER, CHAOS_SPAWN_WINDOW, CHAOS_SURGE, DIFF_PER_WAVE, DIFF_WAVE1, EnemyType,
  FAST, GRUNT, LEVEL_RAMP, ROBOT_SPEED, SHOOTER, SPAWN_INTERVAL_BASE,
  SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_STEP, TANK, TOUGH, WAVE_COUNT_MAX,
  WAVES_BY_LEVEL, WAVES_LEVEL_CAP, WAVES_LEVEL_EXTRA, WAVE_BASE_COUNT,
  WAVE_COUNT_PER_WAVE, WAVE_SPEED_PER_WAVE,
} from "../config";

export function wavesForLevel(level: number): number {
  // v2 balance: capped (the original grew +5 forever — level 10 was 50 waves).
  if (level in WAVES_BY_LEVEL) return Math.min(WAVES_LEVEL_CAP, WAVES_BY_LEVEL[level]);
  const top = Math.max(...Object.keys(WAVES_BY_LEVEL).map(Number));
  return Math.min(WAVES_LEVEL_CAP, WAVES_BY_LEVEL[top] + (level - top) * WAVES_LEVEL_EXTRA);
}

export function levelStartWave(level: number): number {
  let w = 1;
  for (let l = 1; l < level; l++) w += wavesForLevel(l);
  return w;
}

export function levelForWave(wave: number): number {
  let level = 1;
  while (wave > levelStartWave(level) + wavesForLevel(level) - 1) level++;
  return level;
}

export function waveInLevel(wave: number): number {
  const level = levelForWave(wave);
  return wave - levelStartWave(level) + 1;
}

export function isBossWave(wave: number): boolean {
  return waveInLevel(wave) === wavesForLevel(levelForWave(wave));
}

/** The "difficulty wave": resets to DIFF_WAVE1 at each level's first wave,
 * climbs DIFF_PER_WAVE per wave, steeper on higher levels. */
export function effectiveWave(wave: number): number {
  const level = levelForWave(wave);
  const w = waveInLevel(wave);
  const ramp = 1.0 + LEVEL_RAMP * (level - 1);
  return DIFF_WAVE1 + (w - 1) * DIFF_PER_WAVE * ramp;
}

/** Spawn pool + weights for this wave (bosses spawn separately). */
export function enemyPopulation(wave: number): [EnemyType[], number[]] {
  const ew = effectiveWave(wave);
  const pop: EnemyType[] = [GRUNT, FAST];
  const weights: number[] = [30.0, 12.0]; // bias the swarm toward one-shot fodder (chaos waves)
  if (ew >= 2.5) { pop.push(TOUGH); weights.push(2 + (ew - 2.5)); }
  if (ew >= 3.5) { pop.push(BOMBER); weights.push(1 + (ew - 3.5) / 2); }
  if (ew >= 4.5) { pop.push(TANK); weights.push(1 + (ew - 4.5) / 2); }
  if (ew >= 5.5) { pop.push(SHOOTER); weights.push(1 + (ew - 5.5) / 2); }
  return [pop, weights];
}

export function chooseEnemyType(wave: number, rand: () => number = Math.random): EnemyType {
  const [pop, weights] = enemyPopulation(wave);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < pop.length; i++) {
    r -= weights[i];
    if (r <= 0) return pop[i];
  }
  return pop[pop.length - 1];
}

export function waveRobotCount(wave: number): number {
  const base = WAVE_BASE_COUNT + Math.round(WAVE_COUNT_PER_WAVE * (effectiveWave(wave) - 1));
  // Chaos surge: extra enemies grow with frac^2 through the stage, so the final
  // waves swarm. Boss waves stay tamer (the boss is the main event). Capped.
  const frac = waveInLevel(wave) / wavesForLevel(levelForWave(wave)); // 0..1 through the stage
  const surge = Math.round(CHAOS_SURGE * frac * frac * (isBossWave(wave) ? 0.4 : 1));
  return Math.min(WAVE_COUNT_MAX, base + surge);
}

export function waveRobotSpeed(wave: number): number {
  return ROBOT_SPEED + WAVE_SPEED_PER_WAVE * (effectiveWave(wave) - 1);
}

export function waveSpawnInterval(wave: number): number {
  // Pace the whole wave to pour in within ~CHAOS_SPAWN_WINDOW seconds so a big
  // swarm floods instead of trickling — but never below the floor, and never
  // slower than the original per-difficulty curve (small early waves are gentle).
  const ramp = SPAWN_INTERVAL_BASE - SPAWN_INTERVAL_STEP * (effectiveWave(wave) - 1);
  const flood = CHAOS_SPAWN_WINDOW / Math.max(1, waveRobotCount(wave));
  return Math.max(SPAWN_INTERVAL_MIN, Math.min(ramp, flood));
}
