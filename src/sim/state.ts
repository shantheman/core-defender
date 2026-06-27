/** GameState — the economy + progression core, a 1:1 port of the original
 * game.py (v0.7.0). Pure TS: no Phaser, no DOM (localStorage is injectable),
 * so every rule here is unit-testable. The battle scene and the UI panels both
 * talk to this object.
 *
 * Two money systems (never converted into each other):
 *  - coins: in-run economy, reset every battle; spent in the shop.
 *  - Cores: permanent; earned by CLEARING WAVES (+1 x level each, instantly)
 *    and a +15 x level bonus for the level's boss wave.
 */

import * as C from "../config";
import { isBossWave, levelStartWave, waveInLevel, wavesForLevel } from "./waves";

export type SkillKey =
  | "multi" | "pierce" | "explosive" | "guided"
  | "repair" | "plating" | "shield"
  | "twin" | "interceptor" | "medic"
  | "emp" | "freeze" | "warp" | "laser";

export interface SkillNode {
  key: SkillKey; name: string; cost: number; desc: string; prereq?: SkillKey;
  branch: "CANNON" | "DEFENSE" | "DRONE" | "ULTIMATES";
}

export const SKILL_NODES: SkillNode[] = [
  { key: "pierce", name: "Piercing Shots", cost: 70, desc: "Bullets pierce enemies", branch: "CANNON" },
  { key: "explosive", name: "Explosive Rounds", cost: 160, desc: "Hits blast nearby enemies", prereq: "pierce", branch: "CANNON" },
  { key: "guided", name: "Guided Rounds", cost: 220, desc: "Bullets bend toward enemies", prereq: "explosive", branch: "CANNON" },
  { key: "multi", name: "Multi-Shot", cost: 250, desc: "More bullets per shot", prereq: "guided", branch: "CANNON" }, // capstone: it's strong, so it's gated to the end
  { key: "repair", name: "Repair Bay", cost: 60, desc: "Buy tower repairs in battle", branch: "DEFENSE" },
  { key: "plating", name: "Reinforced Plating", cost: 100, desc: "Buy +max HP in battle", prereq: "repair", branch: "DEFENSE" },
  { key: "shield", name: "Shield Generator", cost: 180, desc: "Layered recharging shield", prereq: "plating", branch: "DEFENSE" },
  { key: "twin", name: "Twin Targeting", cost: 150, desc: "Drone hits 2 enemies", branch: "DRONE" },
  { key: "interceptor", name: "Interceptor", cost: 200, desc: "Drone shoots down enemy projectiles", prereq: "twin", branch: "DRONE" },
  { key: "medic", name: "Field Medic", cost: 250, desc: "Drone repairs the tower during lulls", prereq: "interceptor", branch: "DRONE" },
  { key: "emp", name: "EMP Burst", cost: 60, desc: "Zap + stun everything", branch: "ULTIMATES" },
  { key: "freeze", name: "Freeze Bomb", cost: 80, desc: "Freezes all enemies", prereq: "emp", branch: "ULTIMATES" },
  { key: "warp", name: "Time Warp", cost: 110, desc: "Slow-motion for enemies", prereq: "freeze", branch: "ULTIMATES" },
  { key: "laser", name: "Laser Beam", cost: 150, desc: "The mega-beam", prereq: "warp", branch: "ULTIMATES" },
];

export interface Achievement {
  id: string; name: string; how: string;
  bounty: number; // one-time cores reward on unlock
}
export const ACHIEVEMENTS: Achievement[] = [
  { id: "wave10", name: "Hold the Line", how: "Reach wave 10", bounty: 10 },
  { id: "wave25", name: "Last Stand", how: "Reach wave 25", bounty: 15 },
  { id: "wave50", name: "Unstoppable", how: "Reach wave 50", bounty: 25 },
  { id: "level5", name: "Onward & Upward", how: "Reach Stage 5", bounty: 15 },
  { id: "boss", name: "Boss Slayer", how: "Destroy a boss", bounty: 10 },
  { id: "combo15", name: "Killing Spree", how: "Hit a 15+ kill combo", bounty: 15 },
  { id: "kills200", name: "Robot Recycler", how: "200 kills in one run", bounty: 20 },
  { id: "perfect", name: "Untouchable", how: "Clear a wave with zero tower damage", bounty: 15 },
  { id: "rich", name: "War Chest", how: "Hold 2,000 coins at once", bounty: 15 },
  { id: "arsenal", name: "Full Arsenal", how: "Own 3 ultimates in one run", bounty: 20 },
  { id: "skilled", name: "Scholar of War", how: "Unlock 6 skill-tree nodes", bounty: 20 },
  { id: "emp_fry", name: "Flyswatter", how: "Fry 5+ projectiles with one EMP", bounty: 10 },
];
const ACH_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export type BonusKind = "cash" | "heal" | "rapid";

export interface DamageResult {
  layersSpent: number;   // shield layers stripped by this hit
  hpLost: number;        // damage that reached the tower itself
  died: boolean;
}

/** Frozen forever: this predates the game's renames, but changing it
 * silently wipes every player's progress (localStorage is keyed per-origin).
 * If a rename is ever truly needed, dual-read (old key -> migrate -> new).
 * (Exported for the Settings save-code transfer + reset.) */
export const SAVE_KEY = "rts2_save";

export class GameState {
  // -- permanent progression (persisted) -----------------------------------
  cores = 0;
  towerLevel = 0;
  level = 1;
  bestWave = 0;
  bestStage = 1;  // highest stage ever reached (high-water mark; analytics person prop)
  wonGame = false; // beat the final stage at least once — unlocks the god-mode bonus + its home button
  skills = new Set<SkillKey>();
  achievements = new Set<string>();
  tutorialsSeen = new Set<string>(); // one-time tutorial overlays already shown
  volume = 0.5;       // SFX (0 = mute)
  musicVolume = 0.5;  // background music (0 = off)
  reduceMotion = false;
  handed: "left" | "right" = "right"; // touch: which bottom corner the aim stick sits in

  // -- run state (reset every battle) ---------------------------------------
  money = 0;
  runCores = 0;
  wave = 1;            // global wave number
  kills = 0;
  combo = 0;
  comboTimer = 0;
  hp = C.TOWER_MAX_HP;
  genLevel = 0;
  autoLevel = 0;
  turretLevel = 0;
  multiLevel = 0;
  pierceLevel = 0;
  explosiveLevel = 0;
  guidedOwned = false;
  repairBuys = 0;
  platingBuys = 0;
  shieldLevel = 0;
  shield = 0;          // layers remaining right now
  droneLevel = 0;
  twinOwned = false;   // Twin Targeting (tree-gated, bought once per run)
  interceptorOwned = false;
  medicOwned = false;
  ultimatesOwned = new Set<C.UltimateKey>();
  equippedUltimate: C.UltimateKey | null = null;
  rapidTimer = 0;
  waveTookDamage = false;
  private lastClearedWave = -1;  // guard: a wave can never pay cores twice
  private paidThroughWave = 0;   // checkpoint replays never re-pay cores
  /** Loadout snapshot taken when a checkpoint wave (6, 11, ...) starts.
   * Death offers "retry from wave N" with exactly this state restored. */
  checkpoint: Record<string, unknown> | null = null;

  /** Announcements for the UI to drain (popups for cores/achievements/bonuses). */
  events: { kind: string; text: string }[] = [];

  // -- persistence hooks (wired by the app layer in game.ts; undefined in the
  //    pure unit tests = no-op, so the sim stays DOM/Capacitor-free) -----------
  /** Set in load()'s catch (null = clean read). Reported once at boot for telemetry. */
  lastLoadError: unknown = null;
  /** Telemetry sink for read/write failures (PostHog via game.ts). */
  onStorageError?: (where: "load" | "save", err: unknown) => void;
  /** Durable mirror of each successful save (native Preferences via game.ts). */
  onPersist?: (serialized: string) => void;

  constructor(
    private storage: Pick<Storage, "getItem" | "setItem"> | null =
      typeof localStorage === "undefined" ? null : localStorage,
    private rand: () => number = Math.random,
  ) {
    this.load();
    this.resetRun();
  }

  // -- persistence -----------------------------------------------------------
  load(): void {
    try {
      const raw = this.storage?.getItem(SAVE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      this.cores = d.cores | 0;
      this.towerLevel = d.tower_level | 0;
      this.level = Math.max(1, d.level | 0);
      this.bestWave = d.best_wave | 0;
      this.bestStage = Math.max(d.best_stage | 0, this.level); // backfill from prior progress
      this.wonGame = !!d.won_game;
      this.skills = new Set(d.skills ?? []);
      this.achievements = new Set(d.achievements ?? []);
      this.tutorialsSeen = new Set(d.tutorials ?? []);
      this.volume = Math.min(1, Math.max(0, d.volume ?? 0.5));
      this.musicVolume = Math.min(1, Math.max(0, d.music_volume ?? 0.5));
      this.reduceMotion = !!d.reduce_motion;
      this.handed = d.handed === "left" ? "left" : "right";
      this.lastLoadError = null; // a clean read clears any earlier failure
    } catch (e) {
      // Unreadable/corrupt save -> keep defaults, NEVER write here (a bad read
      // must not clobber the on-disk save). Surface it for telemetry instead.
      this.lastLoadError = e;
      this.onStorageError?.("load", e);
    }
  }

  save(): void {
    try {
      const serialized = JSON.stringify({
        save_version: C.SAVE_VERSION,
        cores: this.cores,
        tower_level: this.towerLevel,
        level: this.level,
        best_wave: this.bestWave,
        best_stage: this.bestStage,
        won_game: this.wonGame,
        skills: [...this.skills].sort(),
        achievements: [...this.achievements].sort(),
        tutorials: [...this.tutorialsSeen].sort(),
        volume: Math.round(this.volume * 100) / 100,
        music_volume: Math.round(this.musicVolume * 100) / 100,
        reduce_motion: this.reduceMotion,
        handed: this.handed,
      });
      this.storage?.setItem(SAVE_KEY, serialized);
      this.onPersist?.(serialized); // mirror to the durable native store
    } catch (e) { this.onStorageError?.("save", e); } // a failed save never crashes the game
  }

  // -- tower stats (all scale off the permanent tower level) -----------------
  maxHp(): number {
    return C.TOWER_MAX_HP + C.TOWER_HP_PER_LEVEL * this.towerLevel
      + C.PLATING_HP * this.platingBuys;
  }
  startCash(): number { return C.TOWER_CASH_PER_LEVEL * this.towerLevel; }
  earnMult(): number { return 1 + C.TOWER_EARN_PER_LEVEL * this.towerLevel; }
  playerDamage(): number {
    return C.BULLET_DAMAGE + C.TURRET_DAMAGE_PER_LEVEL * this.turretLevel
      + C.TOWER_TURRET_DAMAGE * this.towerLevel; // permanent per-tower-level bonus (carries across stages)
  }
  playerCooldown(): number {
    const base = C.FIRE_COOLDOWN * Math.pow(C.TURRET_CD_FACTOR, this.turretLevel);
    return this.rapidTimer > 0 ? base * C.RAPID_FIRE_CD_MULT : base;
  }
  playerBulletRadius(): number { return C.BULLET_RADIUS + C.TURRET_SIZE_PER_LEVEL * this.turretLevel; }

  // -- run lifecycle ----------------------------------------------------------
  resetRun(): void {
    this.money = this.startCash();
    this.runCores = 0;
    this.wave = levelStartWave(this.level);
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.genLevel = this.autoLevel = this.turretLevel = 0;
    this.multiLevel = this.pierceLevel = this.explosiveLevel = 0;
    this.guidedOwned = false;
    this.repairBuys = this.platingBuys = 0;
    this.shieldLevel = 0;
    this.shield = 0;
    this.droneLevel = 0;
    this.twinOwned = false;
    this.interceptorOwned = false;
    this.medicOwned = false;
    this.ultimatesOwned = new Set();
    this.equippedUltimate = null;
    this.rapidTimer = 0;
    this.waveTookDamage = false;
    this.lastClearedWave = -1;
    this.paidThroughWave = 0;
    this.checkpoint = null;
    this.hp = this.maxHp();
  }

  /** "New Game" after winning: wipe progression to a first-time start but keep
   * settings, achievements, the high-water stage, and wonGame (so the god-mode
   * button stays available). */
  newGame(): void {
    this.cores = 0;
    this.towerLevel = 0;
    this.level = 1;
    this.bestWave = 0;
    this.skills = new Set();
    this.resetRun();
    this.save();
  }

  /** Crank every weapon to the extreme for the bonus god-mode wave. Run state
   * only (not persisted) — the next real battle's resetRun wipes it. */
  maxOutForGodMode(): void {
    this.turretLevel = C.GODMODE_TURRET_LEVEL;
    this.multiLevel = C.GODMODE_MULTI_LEVEL;
    this.pierceLevel = 6;
    this.explosiveLevel = 6;
    this.guidedOwned = true;
    this.autoLevel = C.AUTO_MAX_LEVEL;
    this.droneLevel = 10;
    this.twinOwned = this.interceptorOwned = this.medicOwned = true;
    this.shieldLevel = 5;
    this.ultimatesOwned = new Set<C.UltimateKey>(["emp", "freeze", "warp", "laser"]);
    this.equippedUltimate = "laser";
    this.money = 999999;
    this.shield = this.shieldCapacity();
    this.hp = this.maxHp();
  }

  /** Wave cleared: pay cores (+ level bonus on the boss wave). Returns what
   * happened so the caller can route flow (shop vs level-complete). */
  onWaveCleared(): { bossWave: boolean; coresEarned: number } {
    // Idempotence guard: a runaway caller (e.g. a scene that keeps ticking
    // after the level ends) must never double-pay or double-advance.
    if (this.wave === this.lastClearedWave) {
      return { bossWave: isBossWave(this.wave), coresEarned: 0 };
    }
    this.lastClearedWave = this.wave;
    const bossWave = isBossWave(this.wave);
    let earned = 0;
    if (this.wave > this.paidThroughWave) {
      earned = C.WAVE_CLEAR_CORES * this.level;
      if (bossWave) earned += C.LEVEL_CLEAR_CORES * this.level;
      this.paidThroughWave = this.wave;
      this.cores += earned;
      this.runCores += earned;
    }
    if (!this.waveTookDamage) this.unlockAchievement("perfect");
    if (this.wave > this.bestWave) this.bestWave = this.wave;
    if (bossWave) this.level += 1; // advance the checkpoint
    if (this.level > this.bestStage) this.bestStage = this.level; // high-water stage
    this.save();
    return { bossWave, coresEarned: earned };
  }

  startNextWave(): void {
    this.wave += 1;
    this.shield = this.shieldCapacity(); // recharges each wave
    this.waveTookDamage = false;
    // Entering a checkpoint wave (6, 11, ...) snapshots the loadout — shop
    // purchases made between waves are deliberately included.
    if ((waveInLevel(this.wave) - 1) % C.CHECKPOINT_EVERY === 0) {
      this.snapshotCheckpoint();
    }
  }

  /** The run fields a checkpoint preserves (everything the shop can change). */
  private static readonly RUN_FIELDS = [
    "money", "wave", "genLevel", "autoLevel", "turretLevel", "multiLevel",
    "pierceLevel", "explosiveLevel", "guidedOwned", "repairBuys", "platingBuys",
    "shieldLevel", "droneLevel", "twinOwned", "interceptorOwned", "medicOwned",
    "equippedUltimate",
    // NOTE: paidThroughWave is deliberately NOT snapshotted — it keeps its
    // high-water mark across restores so replayed waves never re-pay cores.
  ] as const;

  snapshotCheckpoint(): void {
    const snap: Record<string, unknown> = {};
    for (const f of GameState.RUN_FIELDS) snap[f] = this[f as keyof this];
    snap.ultimatesOwned = [...this.ultimatesOwned];
    this.checkpoint = snap;
  }

  /** Die -> resume from the checkpoint with the saved loadout at full HP. */
  restoreCheckpoint(): boolean {
    const snap = this.checkpoint;
    if (!snap) return false;
    Object.assign(this, snap as object);
    this.ultimatesOwned = new Set(snap.ultimatesOwned as C.UltimateKey[]);
    this.runCores = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.rapidTimer = 0;
    this.waveTookDamage = false;
    this.lastClearedWave = -1;
    // paidThroughWave keeps its high-water mark (replays never re-pay), and
    // the checkpoint itself survives so a second death retries here too.
    this.hp = this.maxHp();              // checkpoints restore a fresh tower
    this.shield = this.shieldCapacity();
    return true;
  }

  /** Which wave a death-retry would resume at (for the death screen button). */
  checkpointWaveInLevel(): number | null {
    return this.checkpoint ? waveInLevel(this.checkpoint.wave as number) : null;
  }

  // -- economy ----------------------------------------------------------------
  comboMult(): number {
    return 1 + Math.min(C.COMBO_BONUS_MAX, C.COMBO_BONUS_PER * Math.max(0, this.combo - 1));
  }

  awardMoney(base: number): number {
    const gain = base * this.earnMult();
    this.money += gain;
    return gain;
  }

  /** Everything economic about a kill; returns the coin gain + any bonus. */
  onKill(reward: number, boss: boolean): { gain: number; bonus: BonusKind | null } {
    this.kills += 1;
    this.combo += 1;
    this.comboTimer = C.COMBO_WINDOW;
    const gain = Math.round(this.awardMoney(reward * this.comboMult()));
    if (boss) this.unlockAchievement("boss");
    return { gain, bonus: this.maybeBonus() };
  }

  private maybeBonus(): BonusKind | null {
    if (this.rand() >= C.DROP_CHANCE) return null;
    const w = { ...C.DROP_WEIGHTS };
    if (this.hp >= this.maxHp()) w.heal = 0; // heal only rolls when hurt
    const total = w.cash + w.heal + w.rapid;
    if (total <= 0) return null;
    let r = this.rand() * total;
    for (const kind of ["cash", "heal", "rapid"] as BonusKind[]) {
      r -= w[kind];
      if (r <= 0) {
        this.applyBonus(kind);
        return kind;
      }
    }
    return null;
  }

  private applyBonus(kind: BonusKind): void {
    if (kind === "cash") this.awardMoney(C.DROP_CASH);
    else if (kind === "heal") this.hp = Math.min(this.maxHp(), this.hp + C.DROP_HEAL);
    else this.rapidTimer = C.DROP_RAPID_TIME;
  }

  tick(dt: number): void {
    if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 0; }
    if (this.rapidTimer > 0) this.rapidTimer -= dt;
    if (this.genLevel > 0) this.money += C.GEN_INCOME * this.genLevel * dt;
    this.checkAchievements();
  }

  // -- damage / shield ---------------------------------------------------------
  shieldCapacity(): number {
    return this.shieldLevel <= 0 ? 0 : C.SHIELD_BASE_HITS + (this.shieldLevel - 1);
  }
  shieldRadius(): number {
    return C.SHIELD_RING_BASE + C.SHIELD_RING_GAP * Math.max(0, this.shield - 1);
  }

  /** Layered shield model: each layer soaks up to SHIELD_HIT_ABSORB of a single
   * hit; the unsoaked remainder reaches the tower. */
  damageTower(amount: number): DamageResult {
    let layersSpent = 0;
    if (this.shield > 0) {
      layersSpent = Math.min(this.shield, Math.ceil(amount / C.SHIELD_HIT_ABSORB));
      this.shield -= layersSpent;
      amount -= layersSpent * C.SHIELD_HIT_ABSORB;
    }
    const hpLost = amount > 0 ? amount : 0;
    if (hpLost > 0) {
      this.hp = Math.max(0, this.hp - hpLost);
      this.waveTookDamage = true;
    }
    return { layersSpent, hpLost, died: this.hp <= 0 };
  }

  // -- shop: costs --------------------------------------------------------------
  private cost(base: number, growth: number, level: number): number {
    return Math.floor(base * Math.pow(growth, level));
  }
  genCost(): number { return this.cost(C.GEN_BASE_COST, C.GEN_COST_GROWTH, this.genLevel); }
  autoCost(): number { return this.cost(C.AUTO_BASE_COST, C.AUTO_COST_GROWTH, this.autoLevel); }
  turretCost(): number { return this.cost(C.TURRET_BASE_COST, C.TURRET_COST_GROWTH, this.turretLevel); }
  multiCost(): number { return this.cost(C.MS_BASE_COST, C.MS_COST_GROWTH, this.multiLevel); }
  pierceCost(): number { return this.cost(C.PIERCE_BASE_COST, C.PIERCE_COST_GROWTH, this.pierceLevel); }
  explosiveCost(): number { return this.cost(C.EXPLOSIVE_BASE_COST, C.EXPLOSIVE_COST_GROWTH, this.explosiveLevel); }
  repairCost(): number { return this.cost(C.REPAIR_BASE_COST, C.REPAIR_COST_GROWTH, this.repairBuys); }
  platingCost(): number { return this.cost(C.PLATING_BASE_COST, C.PLATING_COST_GROWTH, this.platingBuys); }
  shieldCost(): number { return this.cost(C.SHIELD_BASE_COST, C.SHIELD_COST_GROWTH, this.shieldLevel); }
  droneCost(): number {
    return this.droneLevel === 0 ? C.DRONE_COST
      : this.cost(C.DRONE_UPGRADE_BASE_COST, C.DRONE_UPGRADE_GROWTH, this.droneLevel - 1);
  }
  towerUpgradeCost(): number {
    return Math.floor(C.TOWER_UPGRADE_BASE_COST * Math.pow(C.TOWER_UPGRADE_GROWTH, this.towerLevel));
  }

  // -- shop: buys -----------------------------------------------------------------
  private spend(cost: number): boolean {
    if (this.money < cost) return false;
    this.money -= cost;
    return true;
  }
  tryBuyGen(): boolean { return this.spend(this.genCost()) && ++this.genLevel > 0; }
  tryBuyAuto(): boolean { return this.autoLevel < C.AUTO_MAX_LEVEL && this.spend(this.autoCost()) && ++this.autoLevel > 0; }
  tryBuyTurret(): boolean { return this.spend(this.turretCost()) && ++this.turretLevel > 0; }
  tryBuyMulti(): boolean {
    return this.skills.has("multi") && this.spend(this.multiCost()) && ++this.multiLevel > 0;
  }
  tryBuyPierce(): boolean {
    return this.skills.has("pierce") && this.spend(this.pierceCost()) && ++this.pierceLevel > 0;
  }
  tryBuyExplosive(): boolean {
    return this.skills.has("explosive") && this.spend(this.explosiveCost()) && ++this.explosiveLevel > 0;
  }
  tryBuyGuided(): boolean {
    if (!this.skills.has("guided") || this.guidedOwned || !this.spend(C.GUIDED_COST)) return false;
    this.guidedOwned = true;
    return true;
  }
  tryBuyRepair(): boolean {
    if (!this.skills.has("repair") || this.repairBuys >= C.REPAIR_MAX_BUYS) return false;
    if (this.hp >= this.maxHp() || !this.spend(this.repairCost())) return false;
    this.repairBuys += 1;
    this.hp = Math.min(this.maxHp(), this.hp + C.REPAIR_HP);
    return true;
  }
  tryBuyPlating(): boolean {
    if (!this.skills.has("plating") || this.platingBuys >= C.PLATING_MAX_BUYS) return false;
    if (!this.spend(this.platingCost())) return false;
    this.platingBuys += 1;
    this.hp += C.PLATING_HP; // current HP rises with the new max
    return true;
  }
  tryBuyShield(): boolean {
    if (!this.skills.has("shield") || !this.spend(this.shieldCost())) return false;
    this.shieldLevel += 1;
    this.shield = this.shieldCapacity(); // charges up immediately
    return true;
  }
  tryBuyDrone(): boolean { return this.spend(this.droneCost()) && ++this.droneLevel > 0; }
  tryBuyTwin(): boolean {
    if (!this.skills.has("twin") || this.twinOwned || !this.spend(C.TWIN_COST)) return false;
    this.twinOwned = true;
    return true;
  }
  tryBuyInterceptor(): boolean {
    if (!this.skills.has("interceptor") || this.interceptorOwned || !this.spend(C.INTERCEPTOR_COST)) return false;
    this.interceptorOwned = true;
    return true;
  }
  tryBuyMedic(): boolean {
    if (!this.skills.has("medic") || this.medicOwned || !this.spend(C.MEDIC_COST)) return false;
    this.medicOwned = true;
    return true;
  }
  tryBuyUltimate(key: C.UltimateKey): boolean {
    if (!this.skills.has(key) || this.ultimatesOwned.has(key)) return false;
    if (!this.spend(C.ULTIMATE_COSTS[key])) return false;
    this.ultimatesOwned.add(key);
    this.equippedUltimate = key; // buying auto-equips
    return true;
  }
  equipUltimate(key: C.UltimateKey): boolean {
    if (!this.ultimatesOwned.has(key)) return false;
    this.equippedUltimate = key;
    return true;
  }
  tryBuyTowerUpgrade(): boolean {
    const cost = this.towerUpgradeCost();
    if (this.cores < cost) return false;
    this.cores -= cost;
    this.towerLevel += 1;
    this.hp += C.TOWER_HP_PER_LEVEL; // current HP rises with the new max
    this.save();
    return true;
  }
  tryUnlockSkill(key: SkillKey): boolean {
    const node = SKILL_NODES.find((n) => n.key === key);
    if (!node || this.skills.has(key)) return false;
    if (node.prereq && !this.skills.has(node.prereq)) return false;
    if (this.cores < node.cost) return false;
    this.cores -= node.cost;
    this.skills.add(key);
    this.save();
    return true;
  }

  // -- achievements ------------------------------------------------------------
  unlockAchievement(id: string): boolean {
    if (this.achievements.has(id)) return false;
    this.achievements.add(id);
    const a = ACH_BY_ID.get(id);
    if (a) this.cores += a.bounty; // one-time cores bounty
    this.save();
    this.events.push({
      kind: "achievement",
      text: `Achievement: ${a?.name ?? id}!${a ? ` +${a.bounty} cores` : ""}`,
    });
    return true;
  }

  /** One-time tutorial overlays: shown once each, then remembered forever. */
  hasSeenTut(key: string): boolean { return this.tutorialsSeen.has(key); }
  markTutSeen(key: string): void { this.tutorialsSeen.add(key); this.save(); }

  checkAchievements(): void {
    if (this.wave >= 10) this.unlockAchievement("wave10");
    if (this.wave >= 25) this.unlockAchievement("wave25");
    if (this.wave >= 50) this.unlockAchievement("wave50");
    if (this.level >= 5) this.unlockAchievement("level5");
    if (this.combo >= 15) this.unlockAchievement("combo15");
    if (this.kills >= 200) this.unlockAchievement("kills200");
    if (this.money >= 2000) this.unlockAchievement("rich");
    if (this.ultimatesOwned.size >= 3) this.unlockAchievement("arsenal");
    if (this.skills.size >= 6) this.unlockAchievement("skilled");
  }

  wavesInLevel(): number { return wavesForLevel(this.level); }
}
