/** Headless, deterministic combat sim for Mech Tide — a "reference player"
 * harness. It imports the REAL pure game core (src/sim/state, src/sim/waves,
 * src/config) and re-implements the spatial combat loop from
 * BattleScene.update() with no Phaser/DOM, driven by a tunable bot
 * (tools/playtest/profiles.ts).
 *
 * What it answers: with a given aim/reaction level and economy/skill-tree
 * efficiency, does a player survive each stage, and with how much HP to spare?
 *
 * Fidelity notes (read before trusting a number):
 *  - World is the 4:3 reference (960×720), tower dead-centre — same geometry the
 *    game uses to align backgrounds. Travel distances match a 4:3 screen.
 *  - One continuous life, NO checkpoint-retries. So "reached stage N" is a
 *    conservative LOWER bound — real players retry from wave 1/6/11 and get
 *    further. (A future knob could add retries.)
 *  - Cores are earned naturally across the single run (no grind), unless a
 *    profile is `pretrained`. Skill-tree/tower cores are spent between stages.
 *  - The bot aims at the closest threat with per-shot jitter + retarget lag; it
 *    doesn't lead moving targets (bullets are 3-9× faster than enemies, so the
 *    error is small). Squadrons (bombers) are treated as one circle.
 *  These are reference-player estimates for RELATIVE comparison + regression,
 *  not a frame-perfect replica. */

import * as C from "../../src/config";
import { GameState, type SkillKey } from "../../src/sim/state";
import {
  chooseEnemyType, effectiveWave, isBossWave,
  waveInLevel, waveRobotCount, waveRobotSpeed, waveSpawnInterval, wavesForLevel,
} from "../../src/sim/waves";
import {
  AIM, ECON, type CoinAction, type CoinStep, type CoreStep, type PlayerProfile,
} from "./profiles";

// --- world geometry (4:3 reference, matches game.world default) --------------
const W = 960, H = 720;
const TX = W / 2, TY = H / 2;
const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;

const DT = 1 / 30;              // fixed sim step (within MAX_DT=0.05; ~half the cost of 1/60)
const MAX_WAVE_SECONDS = 120;  // a wave the bot can't clear in 2 min = overwhelmed (loss)
export const MAX_STAGE = C.FINAL_STAGE; // 15

/** Candidate balance tweaks to A/B WITHOUT editing the shipped game. Defaults
 * (BASE_BALANCE) mirror the live config exactly, so an unpatched run reproduces
 * the real game. Used by tools/playtest/experiments.ts. */
export interface Balance {
  startCashPerLevel: number;    // coins granted at stage start, × towerLevel (game: 30)
  turretBonusPerTower: number;  // permanent +cannon damage per tower level (game: 0 — power resets each stage)
  autoMaxLevel: number;         // auto-laser cap (game: 5) — Callum's "tower raises caps" idea
  heavyHpRamp: number;          // per-effective-wave HP growth for tank/bomber/shooter/boss (game: 0.12)
  bossCrashFrac: number;        // a boss crash deals this × maxHp (game: 0.9 — a near one-shot)
  bossFireDmgPerLevel: number;  // boss covering-fire damage growth per stage (game: 4)
}
export const BASE_BALANCE: Balance = {
  startCashPerLevel: C.TOWER_CASH_PER_LEVEL,
  turretBonusPerTower: 0,
  autoMaxLevel: C.AUTO_MAX_LEVEL,
  heavyHpRamp: C.HEAVY_HP_RAMP,
  bossCrashFrac: 0.9,
  bossFireDmgPerLevel: C.BOSS_FIRE.damagePerLevel,
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wrap(a: number): number { return ((a + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI; }
function clamp(v: number, lo: number, hi: number): number { return v < lo ? lo : v > hi ? hi : v; }

type EType = ReturnType<typeof chooseEnemyType>;
interface SimEnemy {
  type: EType; x: number; y: number; hp: number; maxHp: number; alive: boolean;
  speed: number; fireTimer: number; fireCd: number; fireDamage: number; isBoss: boolean;
}
interface SimBullet { x: number; y: number; vx: number; vy: number; damage: number; radius: number; pierce: number; guided: boolean; hit: Set<SimEnemy>; alive: boolean; }
interface SimEBullet { x: number; y: number; vx: number; vy: number; damage: number; alive: boolean; }

export interface StageResult { stage: number; cleared: boolean; hpPct: number; deathWaveInLevel?: number; reason?: "killed" | "stalled"; loadout?: string; }
export interface CampaignResult {
  profile: string; aim: string; econ: string; pretrained: boolean;
  won: boolean; reachedStage: number; deathStage?: number; deathWaveInLevel?: number;
  stages: StageResult[];
  finalCores: number; finalTowerLevel: number; skills: number;
}

// --- buy engines (greedy by priority; rescans from the top after each buy) ----
function coinLevel(gs: GameState, a: CoinAction): number {
  switch (a) {
    case "gen": return gs.genLevel;
    case "turret": return gs.turretLevel;
    case "auto": return gs.autoLevel;
    case "multi": return gs.multiLevel;
    case "pierce": return gs.pierceLevel;
    case "explosive": return gs.explosiveLevel;
    case "drone": return gs.droneLevel;
    case "shield": return gs.shieldLevel;
    case "repair": return gs.repairBuys;
    case "plating": return gs.platingBuys;
    case "guided": return gs.guidedOwned ? 1 : 0;
    default: return gs.ultimatesOwned.has(a) ? 1 : 0; // emp/freeze/warp/laser
  }
}
function coinBuy(gs: GameState, a: CoinAction): boolean {
  switch (a) {
    case "gen": return gs.tryBuyGen();
    case "turret": return gs.tryBuyTurret();
    case "auto": return gs.tryBuyAuto();
    case "multi": return gs.tryBuyMulti();
    case "pierce": return gs.tryBuyPierce();
    case "explosive": return gs.tryBuyExplosive();
    case "guided": return gs.tryBuyGuided();
    case "repair": return gs.tryBuyRepair();
    case "plating": return gs.tryBuyPlating();
    case "shield": return gs.tryBuyShield();
    case "drone": return gs.tryBuyDrone();
    default: return gs.tryBuyUltimate(a); // emp/freeze/warp/laser
  }
}
/** Why an action can't be bought RIGHT NOW for a non-money reason (skill locked,
 * already owned, or capped) — so a `block` step doesn't wedge the shop when the
 * item simply isn't available yet (e.g. a blind run with the tree still locked). */
function coinGated(gs: GameState, a: CoinAction): boolean {
  switch (a) {
    case "multi": return !gs.skills.has("multi");
    case "pierce": return !gs.skills.has("pierce");
    case "explosive": return !gs.skills.has("explosive");
    case "guided": return !gs.skills.has("guided") || gs.guidedOwned;
    case "shield": return !gs.skills.has("shield");
    case "auto": return gs.autoLevel >= C.AUTO_MAX_LEVEL;
    case "repair": return !gs.skills.has("repair") || gs.repairBuys >= C.REPAIR_MAX_BUYS;
    case "plating": return !gs.skills.has("plating") || gs.platingBuys >= C.PLATING_MAX_BUYS;
    case "emp": case "freeze": case "warp": case "laser":
      return !gs.skills.has(a) || gs.ultimatesOwned.has(a);
    default: return false; // gen / turret / drone — never gated
  }
}
function runShop(gs: GameState, order: CoinStep[]): void {
  for (let guard = 0; guard < 500; guard++) {
    let bought = false;
    for (const step of order) {
      if (coinLevel(gs, step.action) >= step.upto) continue;
      if (coinBuy(gs, step.action)) { bought = true; break; }
      // Couldn't buy. If it's a "save up" step that's available but unaffordable,
      // bank the cash (stop here) rather than spend it on cheaper later steps.
      if (step.block && !coinGated(gs, step.action)) return;
    }
    if (!bought) return;
  }
}
function homeSpendCores(gs: GameState, order: CoreStep[]): void {
  for (let guard = 0; guard < 500; guard++) {
    let bought = false;
    for (const step of order) {
      if (step.action === "tower") {
        if (gs.towerLevel >= (step.upto ?? Infinity)) continue;
        if (gs.tryBuyTowerUpgrade()) { bought = true; break; }
      } else {
        if (gs.skills.has(step.action as SkillKey)) continue;
        if (gs.tryUnlockSkill(step.action as SkillKey)) { bought = true; break; }
      }
    }
    if (!bought) return;
  }
}

export class Sim {
  enemies: SimEnemy[] = [];
  private bullets: SimBullet[] = [];
  private ebullets: SimEBullet[] = [];
  private toSpawn = 0;
  private spawnTimer = 0;
  private bossPending = false;
  private intermission = 0;
  private clearedLinger = 0;
  private fireTimer = 0;
  private autoTimer = 0;
  private aimAngle = -Math.PI / 2;
  private aimTarget = -Math.PI / 2;
  private retargetClock = 0;
  private cd = { emp: 0, freeze: 0, warp: 0, laser: 0 } as Record<C.UltimateKey, number>;
  private freezeActive = 0; private stunActive = 0; private warpActive = 0; private laserActive = 0;
  // drone state
  private dExists = false; private dx = 0; private dy = 0; private dvx = 0; private dvy = 0;
  private dAngle = 0; private dFire = 0; private dIntercept = 0;

  constructor(private gs: GameState, private rng: () => number, private profile: PlayerProfile, private bal: Balance = BASE_BALANCE) {}

  /** Begin the current gs.wave: queue spawns, arm the boss, reset the breather. */
  setupWave(): void {
    this.intermission = C.INTERMISSION_TIME;
    this.toSpawn = waveRobotCount(this.gs.wave);
    this.bossPending = isBossWave(this.gs.wave);
    this.spawnTimer = 0;
    this.clearedLinger = C.WAVE_CLEAR_LINGER;
    this.bullets = []; this.ebullets = []; this.enemies = [];
  }

  /** Run the current wave to a conclusion. */
  runWave(): "cleared" | "killed" | "stalled" {
    let t = 0;
    for (;;) {
      const r = this.step(DT);
      if (r === "cleared") return "cleared";
      if (r === "dead") return "killed";
      t += DT;
      if (t > MAX_WAVE_SECONDS) return "stalled";
    }
  }

  private edgePos(): [number, number] {
    const side = Math.floor(this.rng() * 4);
    if (side === 0) return [this.rng() * W, -C.SPAWN_MARGIN];
    if (side === 1) return [this.rng() * W, H + C.SPAWN_MARGIN];
    if (side === 2) return [-C.SPAWN_MARGIN, this.rng() * H];
    return [W + C.SPAWN_MARGIN, this.rng() * H];
  }

  private spawnOne(): void {
    const gs = this.gs;
    const type = this.bossPending ? C.BOSS : chooseEnemyType(gs.wave, this.rng);
    this.bossPending = false;
    const [x, y] = this.edgePos();
    const ew = effectiveWave(gs.wave);
    const hp = type.levelScaled ? type.hp * (1 + this.bal.heavyHpRamp * (ew - 1)) : type.hp;
    const isBoss = type === C.BOSS;
    const fireCd = isBoss ? Math.max(C.BOSS_FIRE.minCd, C.BOSS_FIRE.baseCd - C.BOSS_FIRE.cdPerLevel * (gs.level - 1)) : 0;
    const fireDamage = isBoss ? C.BOSS_FIRE.baseDamage + this.bal.bossFireDmgPerLevel * (gs.level - 1) : 0;
    this.enemies.push({
      type, x, y, hp, maxHp: hp, alive: true,
      speed: waveRobotSpeed(gs.wave) * type.speedMult,
      fireTimer: type.ranged?.fireCd ?? fireCd, fireCd, fireDamage, isBoss,
    });
  }

  private hit(e: SimEnemy, dmg: number): void {
    if (!e.alive) return;
    e.hp -= dmg;
    if (e.hp <= 0) { e.alive = false; this.gs.onKill(e.type.reward, e.isBoss); }
  }

  private explode(ax: number, ay: number, exclude: SimEnemy): void {
    const gs = this.gs;
    if (gs.explosiveLevel <= 0) return;
    const dmg = C.EXPLOSIVE_SPLASH_DMG + C.EXPLOSIVE_SPLASH_PER_LEVEL * (gs.explosiveLevel - 1);
    const radius = C.EXPLOSIVE_RADIUS_BASE + C.EXPLOSIVE_RADIUS_PER_LEVEL * (gs.explosiveLevel - 1);
    for (const e of this.enemies) {
      if (e === exclude || !e.alive) continue;
      if (Math.hypot(e.x - ax, e.y - ay) <= radius) this.hit(e, dmg);
    }
  }

  private fireSpread(): void {
    const gs = this.gs;
    const n = 1 + gs.multiLevel;
    const angles = [0];
    for (let k = 1; angles.length < n; k++) {
      angles.push(C.MULTI_SPREAD_DEG * k);
      if (angles.length < n) angles.push(-C.MULTI_SPREAD_DEG * k);
    }
    const errRad = this.profile.aim.aimErrorDeg * DEG;
    for (const deg of angles) {
      const jitter = (this.rng() * 2 - 1) * errRad;
      const dir = this.aimAngle + deg * DEG + jitter;
      this.bullets.push({
        x: TX, y: TY, vx: Math.cos(dir) * C.BULLET_SPEED, vy: Math.sin(dir) * C.BULLET_SPEED,
        damage: gs.playerDamage(), radius: gs.playerBulletRadius(),
        pierce: gs.pierceLevel, guided: gs.guidedOwned, hit: new Set(), alive: true,
      });
    }
  }

  private maybeFireUltimate(): void {
    const gs = this.gs;
    const key = gs.equippedUltimate;
    if (!key || this.cd[key] > 0) return;
    const bossOnField = this.enemies.some((e) => e.isBoss);
    if (!bossOnField && this.enemies.length < 6) return; // save it for a real threat
    if (key === "freeze") { this.freezeActive = C.FREEZE_DURATION; this.cd.freeze = C.FREEZE_COOLDOWN; }
    else if (key === "emp") {
      this.ebullets = [];
      for (const e of [...this.enemies]) this.hit(e, C.EMP_DAMAGE);
      this.stunActive = C.EMP_STUN; this.cd.emp = C.EMP_COOLDOWN;
    } else if (key === "warp") { this.warpActive = C.WARP_DURATION; this.cd.warp = C.WARP_COOLDOWN; }
    else if (key === "laser") { this.laserActive = C.LASER_DURATION; this.cd.laser = C.LASER_COOLDOWN; }
  }

  private updateLaser(dt: number): void {
    if (this.laserActive <= 0) return;
    this.laserActive -= dt;
    const ax = Math.cos(this.aimAngle), ay = Math.sin(this.aimAngle);
    for (const e of [...this.enemies]) {
      const tx = e.x - TX, ty = e.y - TY;
      const along = tx * ax + ty * ay;
      if (along < 0) continue;
      const perp = Math.abs(tx * ay - ty * ax);
      if (perp <= C.LASER_WIDTH / 2 + e.type.radius) {
        if (e.type === C.GRUNT || e.type === C.FAST) this.hit(e, e.hp); // vaporized
        else this.hit(e, C.LASER_DPS * dt);
      }
    }
  }

  private updateAuto(dt: number): void {
    const gs = this.gs;
    if (gs.autoLevel <= 0) return;
    this.autoTimer -= dt;
    if (this.autoTimer > 0) return;
    let best: SimEnemy | null = null, bestD = Infinity;
    for (const e of this.enemies) { const d = Math.hypot(e.x - TX, e.y - TY); if (d < bestD) { bestD = d; best = e; } }
    if (!best || bestD > C.AUTO_RANGE) return;
    this.hit(best, C.AUTO_BULLET_DAMAGE);
    this.autoTimer = C.AUTO_BASE_COOLDOWN / gs.autoLevel;
  }

  /** Port of DroneController (movement + twin fire + medic + interceptor). */
  private updateDrone(dt: number, enemyDt: number): void {
    const gs = this.gs;
    if (gs.droneLevel <= 0) return;
    if (!this.dExists) { this.dExists = true; this.dx = TX; this.dy = TY - C.DRONE_ORBIT_RADIUS; }
    const range = C.DRONE_BASE_RANGE + C.DRONE_RANGE_PER_LEVEL * (gs.droneLevel - 1);
    let target: SimEnemy | null = null;
    for (const e of this.enemies) if (!target || e.maxHp > target.maxHp) target = e;
    let wx: number, wy: number;
    if (target) {
      const tlen = Math.hypot(target.x - TX, target.y - TY) || 1;
      const tox = (target.x - TX) / tlen, toy = (target.y - TY) / tlen;
      const sx = -toy * C.DRONE_STANDOFF, sy = tox * C.DRONE_STANDOFF;
      wx = target.x - tox * C.DRONE_STANDOFF + sx * 0.4;
      wy = target.y - toy * C.DRONE_STANDOFF + sy * 0.4;
    } else {
      this.dAngle += C.DRONE_ORBIT_SPEED * DEG * dt;
      wx = TX + Math.cos(this.dAngle) * C.DRONE_ORBIT_RADIUS;
      wy = TY + Math.sin(this.dAngle) * C.DRONE_ORBIT_RADIUS;
    }
    const ddx = wx - this.dx, ddy = wy - this.dy;
    const dist = Math.hypot(ddx, ddy);
    const desired = dist > C.DRONE_ARRIVE_RADIUS ? C.DRONE_SPEED : C.DRONE_SPEED * (dist / C.DRONE_ARRIVE_RADIUS);
    const dvx = dist > 0.001 ? (ddx / dist) * desired : 0;
    const dvy = dist > 0.001 ? (ddy / dist) * desired : 0;
    let sx = dvx - this.dvx, sy = dvy - this.dvy;
    const sMag = Math.hypot(sx, sy), maxDV = C.DRONE_ACCEL * dt;
    if (sMag > maxDV && sMag > 0) { sx *= maxDV / sMag; sy *= maxDV / sMag; }
    this.dvx += sx; this.dvy += sy;
    const spd = Math.hypot(this.dvx, this.dvy);
    if (spd > C.DRONE_SPEED) { this.dvx *= C.DRONE_SPEED / spd; this.dvy *= C.DRONE_SPEED / spd; }
    this.dx += this.dvx * dt; this.dy += this.dvy * dt;
    // fire
    this.dFire -= enemyDt > 0 ? dt : 0;
    if (this.dFire <= 0) {
      const inRange = this.enemies
        .filter((e) => Math.hypot(e.x - this.dx, e.y - this.dy) <= range)
        .sort((a, b) => b.maxHp - a.maxHp)
        .slice(0, gs.twinOwned ? 2 : 1);
      if (inRange.length) {
        const dmg = C.DRONE_DAMAGE + C.DRONE_DAMAGE_PER_LEVEL * (gs.droneLevel - 1);
        for (const e of inRange) this.hit(e, dmg);
        this.dFire = C.DRONE_BASE_CD * Math.pow(C.DRONE_CD_FACTOR, gs.droneLevel - 1);
      }
    }
    // medic
    if (gs.medicOwned && gs.hp < gs.maxHp()) {
      const nearest = this.enemies.reduce((m, e) => Math.min(m, Math.hypot(e.x - this.dx, e.y - this.dy)), Infinity);
      if (nearest > range) gs.hp = Math.min(gs.maxHp(), gs.hp + C.MEDIC_HPS * dt);
    }
  }

  private droneIntercept(dt: number): void {
    const gs = this.gs;
    if (!this.dExists || !gs.interceptorOwned || !this.ebullets.length) return;
    this.dIntercept -= dt;
    if (this.dIntercept > 0) return;
    const range = C.DRONE_BASE_RANGE + C.DRONE_RANGE_PER_LEVEL * (gs.droneLevel - 1);
    const t = this.ebullets.find((b) => b.alive && Math.hypot(b.x - this.dx, b.y - this.dy) <= range);
    if (t) { t.alive = false; this.dIntercept = C.INTERCEPT_CD; }
  }

  /** One fixed sim step. Returns "dead" if the tower fell, "cleared" if the wave
   * is done, else "running". Mirrors BattleScene.update() (campaign path). */
  private step(dt: number): "running" | "cleared" | "dead" {
    const gs = this.gs;
    gs.tick(dt);
    for (const k of Object.keys(this.cd) as C.UltimateKey[]) if (this.cd[k] > 0) this.cd[k] -= dt;
    if (this.freezeActive > 0) this.freezeActive -= dt;
    if (this.stunActive > 0) this.stunActive -= dt;
    if (this.warpActive > 0) this.warpActive -= dt;
    const frozen = this.freezeActive > 0 || this.stunActive > 0;
    const enemyDt = frozen ? 0 : dt * (this.warpActive > 0 ? C.WARP_FACTOR : 1);

    if (this.intermission > 0) {
      this.intermission -= dt;
    } else {
      if (this.toSpawn > 0) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) { this.spawnOne(); this.toSpawn -= 1; this.spawnTimer = waveSpawnInterval(gs.wave); }
      } else if (this.enemies.length === 0) {
        this.clearedLinger -= dt;
        if (this.clearedLinger <= 0) return "cleared";
      }
      // --- player: aim at closest threat (with retarget lag), fire (with jitter)
      this.retargetClock -= dt;
      if (this.retargetClock <= 0 && this.enemies.length) {
        // A bomb-walking boss is the lethal threat (its crash ~one-shots the
        // tower), so focus it; otherwise shoot the closest incoming enemy.
        let best: SimEnemy | null = this.enemies.find((e) => e.isBoss && e.alive) ?? null;
        if (!best) {
          let bestD = Infinity;
          for (const e of this.enemies) { const d = Math.hypot(e.x - TX, e.y - TY); if (d < bestD) { bestD = d; best = e; } }
        }
        if (best) this.aimTarget = Math.atan2(best.y - TY, best.x - TX);
        this.retargetClock = this.profile.aim.retargetInterval;
      }
      this.aimAngle += wrap(this.aimTarget - this.aimAngle) * (1 - Math.exp(-C.AIM_SMOOTH_RATE * dt));
      const aligned = Math.abs(wrap(this.aimTarget - this.aimAngle)) < this.profile.aim.fireTolerance;
      this.fireTimer -= dt;
      if (this.enemies.length > 0 && aligned && this.fireTimer <= 0) {
        this.fireSpread();
        this.fireTimer = gs.playerCooldown();
      }
      this.maybeFireUltimate();
      this.updateAuto(dt);
      this.updateDrone(dt, enemyDt);
      this.updateLaser(dt);
    }

    // --- enemies advance / fire / crash
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = TX - e.x, dy = TY - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const ranged = e.type.ranged;
      if (ranged && dist <= ranged.fireRange) {
        e.fireTimer -= enemyDt;
        if (e.fireTimer <= 0 && enemyDt > 0) {
          this.ebullets.push({ x: e.x, y: e.y, vx: (dx / dist) * C.ENEMY_BULLET_SPEED, vy: (dy / dist) * C.ENEMY_BULLET_SPEED, damage: ranged.projDamage, alive: true });
          e.fireTimer = ranged.fireCd;
        }
      } else if (enemyDt > 0) {
        e.x += (dx / dist) * e.speed * enemyDt;
        e.y += (dy / dist) * e.speed * enemyDt;
      }
      if (e.isBoss && enemyDt > 0) {
        e.fireTimer -= enemyDt;
        if (e.fireTimer <= 0) {
          this.ebullets.push({ x: e.x, y: e.y, vx: (dx / dist) * C.ENEMY_BULLET_SPEED, vy: (dy / dist) * C.ENEMY_BULLET_SPEED, damage: e.fireDamage, alive: true });
          e.fireTimer = e.fireCd;
        }
      }
      const crashAt = gs.shield > 0 ? gs.shieldRadius() + e.type.radius : e.type.radius + C.TOWER_SIZE / 2;
      if (!ranged && dist <= crashAt) {
        let dmg = e.type.contactDamage;
        if (e.isBoss) dmg = Math.max(dmg, Math.floor(gs.maxHp() * this.bal.bossCrashFrac));
        const res = gs.damageTower(dmg);
        e.alive = false;
        if (res.died) return "dead";
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive);

    this.droneIntercept(dt);

    // --- enemy projectiles -> tower
    for (const b of this.ebullets) {
      b.x += b.vx * enemyDt; b.y += b.vy * enemyDt;
      const dist = Math.hypot(b.x - TX, b.y - TY);
      const hit = gs.shield > 0 ? dist <= gs.shieldRadius() : dist <= C.TOWER_SIZE / 2 + C.ENEMY_BULLET_RADIUS;
      if (hit) { const res = gs.damageTower(b.damage); b.alive = false; if (res.died) return "dead"; }
    }
    this.ebullets = this.ebullets.filter((b) => b.alive);

    // --- player bullets: steer, travel, collide, pierce, splash
    for (const b of this.bullets) {
      if (b.guided) this.steer(b, dt);
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) { b.alive = false; continue; }
      for (const e of this.enemies) {
        if (!e.alive || b.hit.has(e)) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) <= e.type.radius + b.radius) {
          this.hit(e, b.damage);
          this.explode(e.x, e.y, e);
          b.hit.add(e);
          if (b.pierce > 0) b.pierce -= 1; else b.alive = false;
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.alive);
    return "running";
  }

  private steer(b: SimBullet, dt: number): void {
    let best: SimEnemy | null = null, bestD = C.GUIDED_RANGE;
    for (const e of this.enemies) { const d = Math.hypot(e.x - b.x, e.y - b.y); if (d < bestD) { bestD = d; best = e; } }
    if (!best) return;
    const want = Math.atan2(best.y - b.y, best.x - b.x);
    const cur = Math.atan2(b.vy, b.vx);
    const maxTurn = C.GUIDED_TURN * DEG * dt;
    const ang = cur + clamp(wrap(want - cur), -maxTurn, maxTurn);
    const speed = Math.hypot(b.vx, b.vy);
    b.vx = Math.cos(ang) * speed; b.vy = Math.sin(ang) * speed;
  }
}

/** Run one full campaign (stages 1..MAX_STAGE) for a profile + seed, optionally
 * under a balance patch (defaults reproduce the live game exactly). */
export function runCampaign(profile: PlayerProfile, seed = 12345, bal: Balance = BASE_BALANCE): CampaignResult {
  const rng = mulberry32(seed);
  const gs = new GameState(null, rng);
  gs.cores = 0; gs.towerLevel = 0; gs.level = 1; gs.skills = new Set();
  if (profile.pretrained) {
    for (const k of ["pierce", "explosive", "guided", "multi", "repair", "plating", "shield", "twin", "interceptor", "medic", "emp", "freeze", "warp", "laser"] as SkillKey[]) gs.skills.add(k);
    gs.towerLevel = 8;
  }
  // Player-side balance patches as instance overrides (the real game is untouched).
  if (bal.startCashPerLevel !== C.TOWER_CASH_PER_LEVEL) {
    gs.startCash = () => bal.startCashPerLevel * gs.towerLevel;
  }
  if (bal.turretBonusPerTower !== 0) {
    gs.playerDamage = () => C.BULLET_DAMAGE + C.TURRET_DAMAGE_PER_LEVEL * gs.turretLevel + bal.turretBonusPerTower * gs.towerLevel;
  }
  if (bal.autoMaxLevel !== C.AUTO_MAX_LEVEL) {
    gs.tryBuyAuto = () => {
      if (gs.autoLevel >= bal.autoMaxLevel) return false;
      const cost = gs.autoCost();
      if (gs.money < cost) return false;
      gs.money -= cost; gs.autoLevel += 1; return true;
    };
  }
  gs.resetRun();

  const sim = new Sim(gs, rng, profile, bal);
  const stages: StageResult[] = [];
  let won = false, deathStage: number | undefined, deathWaveInLevel: number | undefined;

  while (gs.level <= MAX_STAGE) {
    const stageLevel = gs.level;
    homeSpendCores(gs, profile.econ.coreOrder);
    gs.resetRun();                       // money=startCash, wave=levelStartWave, weapons 0, hp full
    runShop(gs, profile.econ.coinOrder); // start-of-stage shopping
    const waves = wavesForLevel(stageLevel);
    let stageCleared = false, dead = false;
    for (let wi = 1; wi <= waves; wi++) {
      sim.setupWave();
      const out = sim.runWave();
      if (out !== "cleared") {
        dead = true;
        deathStage = stageLevel; deathWaveInLevel = waveInLevel(gs.wave);
        const loadout = `T${gs.turretLevel} M${gs.multiLevel} P${gs.pierceLevel} E${gs.explosiveLevel} G${gs.guidedOwned ? 1 : 0} Au${gs.autoLevel} Dr${gs.droneLevel} Sh${gs.shieldLevel} ult:${gs.equippedUltimate ?? "-"} maxHp:${gs.maxHp()}`;
        stages.push({ stage: stageLevel, cleared: false, hpPct: 0, deathWaveInLevel, reason: out === "stalled" ? "stalled" : "killed", loadout });
        break;
      }
      const { bossWave } = gs.onWaveCleared();
      if (bossWave) { stageCleared = true; break; }
      gs.startNextWave();
      runShop(gs, profile.econ.coinOrder); // between-waves shop
    }
    if (dead) break;
    if (stageCleared) {
      stages.push({ stage: stageLevel, cleared: true, hpPct: (gs.hp / gs.maxHp()) * 100 });
      if (stageLevel >= MAX_STAGE) { won = true; break; }
      // gs.level was advanced by onWaveCleared
    }
  }

  const reachedStage = won ? MAX_STAGE : (deathStage ?? stages.filter((s) => s.cleared).length);
  return {
    profile: profile.name, aim: profile.aim.label, econ: profile.econ.label, pretrained: !!profile.pretrained,
    won, reachedStage, deathStage, deathWaveInLevel, stages,
    finalCores: gs.cores, finalTowerLevel: gs.towerLevel, skills: gs.skills.size,
  };
}

/** Average a profile over many seeds under a balance patch — the trustworthy
 * signal (single seeds are noisy: one unlucky wave swings a result). */
export interface Aggregate { profile: string; meanReached: number; minReached: number; maxReached: number; winRate: number; }
export function aggregate(profile: PlayerProfile, seeds: number[], bal: Balance = BASE_BALANCE): Aggregate {
  const runs = seeds.map((s) => runCampaign(profile, s, bal));
  const reached = runs.map((r) => r.reachedStage);
  return {
    profile: profile.name,
    meanReached: reached.reduce((a, b) => a + b, 0) / runs.length,
    minReached: Math.min(...reached),
    maxReached: Math.max(...reached),
    winRate: runs.filter((r) => r.won).length / runs.length,
  };
}

/** The reference roster. The top rows are "geared" (skill tree already unlocked
 * — the realistic state of an engaged player who's ground out cores), so the
 * AIM lever and the in-run COIN-spend lever are what's being compared. The last
 * row is a BLIND first run (cores earned naturally, no grind) to show the
 * tree-unlock gate. Edit freely — these are the levers to pull. */
export const REFERENCE_PLAYERS: PlayerProfile[] = [
  { name: "Pro · Optimal",      aim: AIM.pro,     econ: ECON.optimal, pretrained: true },
  { name: "Good · Optimal",     aim: AIM.good,    econ: ECON.optimal, pretrained: true },
  { name: "Average · Average",  aim: AIM.average, econ: ECON.average, pretrained: true },
  { name: "Casual · Average",   aim: AIM.casual,  econ: ECON.average, pretrained: true },
  { name: "Average · Poor",     aim: AIM.average, econ: ECON.poor,    pretrained: true },
  { name: "Casual · Poor",      aim: AIM.casual,  econ: ECON.poor,    pretrained: true },
  { name: "Pro · Optimal (blind 1st run)", aim: AIM.pro, econ: ECON.optimal },
];
