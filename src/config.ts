/** Balance knobs — ported 1:1 from the Python original's config.py (v0.7.0).
 *
 * RULE (from docs/design/HANDOFF.md): the original app is the source of truth
 * for every value and behavior; the design mocks are visual-only. When values
 * here change, update docs/SPEC-game-mechanics.md in the same commit.
 */

// World size is picked at boot to MATCH the window's aspect ratio, so the
// Phaser canvas fills the screen (FIT-scaled) with no pillarbox — enemies
// then spawn from the true screen edges, not an inset 4:3 box. One axis is
// fixed (the "reference") so the on-screen tower size stays constant; the
// other extends to the screen. WORLD_W/H below are the legacy 4:3 reference
// (still the landscape values on a 4:3 monitor).
export const WORLD_W = 960;
export const WORLD_H = 720;               // landscape reference HEIGHT (tower scale)
export const WORLD_PORTRAIT_W = 640;      // portrait reference WIDTH (tower scale)
// Clamp the long:short ratio so an ultrawide/ultratall screen doesn't get an
// absurd arena (extreme ratios keep a small pillarbox; normal screens fill).
export const WORLD_AR_MIN = 1.2;
export const WORLD_AR_MAX = 2.4;

// Tower
export const TOWER_SIZE = 48;
export const TOWER_MAX_HP = 100;
export const TOWER_HP_PER_LEVEL = 20;
export const TOWER_EARN_PER_LEVEL = 0.10;
export const TOWER_CASH_PER_LEVEL = 30;
export const TOWER_UPGRADE_BASE_COST = 50; // cores
export const TOWER_UPGRADE_GROWTH = 1.4;

// Player gun
export const BULLET_RADIUS = 5;
export const BULLET_SPEED = 600;
export const BULLET_DAMAGE = 20;
export const FIRE_COOLDOWN = 0.5;
export const TURRET_DAMAGE_PER_LEVEL = 4;
export const TURRET_COOLDOWN_FACTOR = 0.9;

// Enemies (base stats; speed_mult scales the wave speed)
export const ROBOT_SPEED = 70;
export const SPAWN_MARGIN = 30;
export interface EnemyType {
  key: string;
  sprite: string;
  radius: number;
  hp: number;
  speedMult: number;
  reward: number;        // coins
  contactDamage: number;
  levelScaled: boolean;  // does HP ramp with effective wave?
  healthbar: boolean;
  ranged?: { fireRange: number; fireCd: number; projDamage: number };
  /** Visual only: air units cast a small detached shadow (hover height);
   * land units a tight one at their feet. Per the sprites: quadcopter,
   * missile swarm, and the hovering shooter pod fly. */
  air?: boolean;
  /** Spinning rotor blades placed at the 4 arm tips (procedurally in-engine,
   * no sprite sheet needed). Arms are at ±45° from the sprite's facing axis;
   * armReach is the fraction of displayHalfWidth to the arm tip in each axis. */
  rotors?: { texture: string; armReach: number; spinRads: number };
  /** Formation of wing-planes flying in loose V behind the leader sprite.
   * offsets[] are local-space px [lateral, behind]; each wing drifts
   * independently (driftAmp px, driftHz cycles/sec). */
  squadron?: { offsets: [number, number][]; driftAmp: number; driftHz: number };
  /** A separate overlay sprite (e.g. a radar dish) that sits on the body and
   * swivels independently: rotate to a random heading, pause, rotate again.
   * pivot is the swivel axis as a fraction of the overlay texture (= the same
   * point on the base body, since the two share an aligned canvas). It's set
   * as the overlay's origin AND used to plant it on the rotated base. */
  satellite?: { texture: string; pivot: [number, number]; swivelSpeed: number; pauseMin: number; pauseMax: number;
    /** Drop shadow cast onto the body (like the tower gun's): the dish
     * silhouette, black at shadowAlpha, dropped down-right by shadowDrop of the
     * body's display width, drawn between the body and the dish. */
    shadowAlpha: number; shadowDrop: number };
}
export const GRUNT: EnemyType = { key: "grunt", sprite: "enemy_0", radius: 21, hp: 20, speedMult: 1.0, reward: 3, contactDamage: 6, levelScaled: false, healthbar: false,
  satellite: { texture: "enemy_0_satellite", pivot: [0.506, 0.464], swivelSpeed: 3.0, pauseMin: 0.6, pauseMax: 1.8,
    shadowAlpha: 0.35, shadowDrop: 0.08 } };
export const FAST: EnemyType = { key: "fast", sprite: "enemy_1", radius: 15, hp: 10, speedMult: 1.8, reward: 4, contactDamage: 4, levelScaled: false, healthbar: false, air: true,
  rotors: { texture: "enemy_1_rotor", armReach: 0.70, spinRads: 18 } };
export const TOUGH: EnemyType = { key: "tough", sprite: "enemy_3", radius: 22.5, hp: 70, speedMult: 0.9, reward: 14, contactDamage: 14, levelScaled: false, healthbar: false };
export const TANK: EnemyType = { key: "tank", sprite: "enemy_2", radius: 27.68, hp: 160, speedMult: 0.5, reward: 30, contactDamage: 34, levelScaled: true, healthbar: true };
export const BOMBER: EnemyType = { key: "bomber", sprite: "enemy_4", radius: 10, hp: 40, speedMult: 1.4, reward: 12, contactDamage: 26, levelScaled: true, healthbar: false, air: true,
  squadron: { offsets: [[-22, 14], [22, 14], [-42, 28], [42, 28], [0, 42]], driftAmp: 2.5, driftHz: 0.5 } };
export const BOSS: EnemyType = { key: "boss", sprite: "boss", radius: 48, hp: 400, speedMult: 0.35, reward: 150, contactDamage: 90, levelScaled: true, healthbar: true };
export const SHOOTER: EnemyType = { key: "shooter", sprite: "shooter", radius: 13, hp: 30, speedMult: 0.8, reward: 16, contactDamage: 8, levelScaled: true, healthbar: false, air: true, ranged: { fireRange: 260, fireCd: 1.6, projDamage: 8 } };
export const ENEMY_BULLET_SPEED = 240;
export const ENEMY_BULLET_RADIUS = 6;
/** Boss covering fire: it lobs projectiles at the tower as it advances (on top
 * of its melee crash), scaling with the game level — a shot or two of chip
 * damage at level 1, a faster, harder barrage later. cd and damage are
 * computed at spawn from gs.level. */
export const BOSS_FIRE = {
  baseCd: 6.0,          // level 1: ~1-2 shots across the slow trek
  cdPerLevel: 0.7,      // fire faster each level...
  minCd: 0.9,           // ...down to this floor
  baseDamage: 4,        // level 1: a scratch
  damagePerLevel: 4,    // +4 damage per level
  bulletRadius: 9,      // chunkier than a shooter round
  bulletColor: 0xff7a1a,
  muzzleForward: 0.13,  // spawn the round at the turret: this fraction of the
                        // sprite's display height ahead of center, toward the tower
};

/** Procedural "alive" animation per enemy — cheap transforms on the existing
 * still (no sprite sheets). Top-down robots read as alive from rigid-body
 * motion: a hover bob (air units float, their grounded shadow fades at the
 * top), a rotational wobble, and a charge-tell swell on ranged units as the
 * shot winds up. Each enemy gets a random phase so they don't pulse in sync.
 * Tune freely. */
export interface EnemyAnim {
  bobAmp?: number;     // px of hover float (air units); shadow fades as it rises
  bobHz?: number;      // float cycles/sec
  wobbleDeg?: number;  // rotational sway amplitude (degrees)
  wobbleHz?: number;
  chargeTell?: boolean; // ranged: swell toward the shot (telegraph)
  altitude?: number;   // static hover height in px above ground (0 = flat); dims shadow
  hexSnap?: number;    // discrete rotation snapping: N sides (e.g. 6); overrides tower-facing
}
export const ENEMY_ANIM: Record<string, EnemyAnim> = {
  grunt:   { altitude: -20, wobbleDeg: 2, wobbleHz: 1.7 },
  fast:    { altitude: 7.5, bobAmp: 5, bobHz: 2.1, wobbleDeg: 6, wobbleHz: 2.6 },
  tough:   { altitude: 0.5, bobAmp: 10, bobHz: 2.2 },
  tank:    { altitude: -12 },
  bomber:  { altitude: 2.5, bobAmp: 4.5, bobHz: 1.4, wobbleDeg: 2, wobbleHz: 0.8 },
  boss:    { altitude: -16.5, wobbleDeg: 2, wobbleHz: 0.8 },
  shooter: { altitude: 3.5, bobAmp: 4, bobHz: 2.2, chargeTell: true, hexSnap: 6 },
};

/** Silhouette shadows — every unit casts its own sprite, black-tinted, under
 * a fixed top-left light (shadows fall down-right). Offsets derive from the
 * owner's radius r. Tuned with Shannon 2026-06-12. */
export const SHADOW = {
  landOff: (r: number) => ({ x: r * 0.34 + 2, y: r * 0.6 + 4 }),  // rim past the feet
  airOff: (r: number) => ({ x: r * 0.5 + 4, y: r * 1.4 + 10 }),   // detached: hover height
  landAlpha: 0.42,
  airAlpha: 0.32,
  airScale: 0.92, // flyers' shadows slightly smaller (altitude)
} as const;
/** The tower's shadows (hand-tuned px): grounded base rim + the elevated
 * gun's silhouette, which falls ONTO the base and swivels with the aim. */
export const TOWER_SHADOW = {
  base: { x: 7, y: 11, alpha: 0.42 },
  gun: { x: 13, y: 21, alpha: 0.3, scale: 0.95 },
} as const;
/** Drone sprite display width = DRONE_RADIUS * 2 * this (art has padding). */
export const DRONE_SPRITE_SCALE = 1.408;
/** The drone body has 4 fan holes (N/E/S/W). Each gets a spinning fan sprite,
 * drawn UNDER the body so the frame rim occludes the fan edge (recessed look).
 * offset = hole distance from center as a fraction of the body's display width;
 * scale = fan size relative to the body's scale; spinRads = spin speed. */
export const DRONE_FAN = { texture: "drone_fan", offset: 0.255, scale: 1.0, spinRads: 16 };
/** Muzzle flash/bullet origin, as fractions of the gun sprite: distance along
 * the barrel from the pivot, and the alternating left/right barrel offset. */
export const MUZZLE_DIST_FACTOR = 0.92;
export const MUZZLE_SIDE_FACTOR = 0.16;
/** Good-guy fire is "core blue" — the blue Cores power the tower. Light enough
 * to read against the dark battlefield. */
export const PLAYER_BULLET_COLOR = 0x8ec9ff; // tower gun rounds
export const PLAYER_MUZZLE_COLOR = 0xe6f4ff; // bright blue-white muzzle flash
export const AUTO_SHOOTER_COLOR = 0x8ec9ff;  // auto-turret zap

/** Level backgrounds (visual only). Files live at
 * public/backgrounds/<name>_land.webp (960x720-ish worlds) and
 * <name>_port.webp (portrait worlds); the battlefield pad MUST sit at the
 * exact image center — the tower is at world center, the canvas is
 * FIT+centered, and the CSS bg is cover+centered, so centers align by
 * construction. Levels cycle through this list; to add art, drop both
 * variants in and append the name here. (A landscape-only set works too:
 * the pipeline rotates it 90° for portrait — fine for radial compositions.) */
export const LEVEL_BACKGROUNDS = [
  "bg1", "bg2", "bg3", "bg4", "bg5", "bg6", "bg7", "bg8",
  "bg9", "bg10", "bg11", "bg12", "bg13", "bg14", "bg15", "bg16",
];

// Waves / difficulty curve
export const WAVES_BY_LEVEL: Record<number, number> = { 1: 7, 2: 10, 3: 15, 4: 20 };
export const WAVES_LEVEL_EXTRA = 5;
export const WAVES_LEVEL_CAP = 15;  // v2 balance: levels never exceed this
export const FINAL_STAGE = 15;      // clearing this stage's boss wins the game (-> You Won screen)
export const GODMODE_STAGE = 16;    // the bonus "god mode" wave's stage (uses bg16)

// Bonus "god mode" wave (post-win): all weapons maxed, a dense ~20s onslaught of
// swarms + frequent bosses, then home (win or die). Sandboxed — never touches
// campaign progress. Tunable.
export const GODMODE_DURATION = 20;        // seconds the onslaught lasts
export const GODMODE_SPAWN_INTERVAL = 0.12; // seconds between spawns (dense flood)
export const GODMODE_BOSS_CHANCE = 0.12;    // fraction of spawns that are bosses
export const GODMODE_WAVE = 30;             // effective wave the god-mode pool draws from (tough variety)
export const GODMODE_TURRET_LEVEL = 50;     // "level 50 turret" — absurd damage + fire rate
export const GODMODE_MULTI_LEVEL = 6;       // 7 bullets (50 would be a perf/visual mess)
export const CHECKPOINT_EVERY = 5;  // checkpoint at waves 1, 6, 11 of a level
export const WAVE_BASE_COUNT = 5;
export const WAVE_COUNT_PER_WAVE = 1;
export const WAVE_SPEED_PER_WAVE = 4.0;
export const DIFF_WAVE1 = 1.4; // eased 2026-06-17 (was 1.6) — lower floor; early waves slower/fewer + heavies unlock later
export const DIFF_PER_WAVE = 0.52; // eased 2026-06-17 (0.7 → 0.62 → 0.52) — gentler ramp every stage; also delays heavy-enemy unlocks
export const LEVEL_RAMP = 0.25; // eased 2026-06-17 (was 0.35) — later stages steepen less (stage 6 was brutal)
export const HEAVY_HP_RAMP = 0.12;
// Chaos (2026-06-17, Callum's ask): each stage builds to a swarm concentrated in
// its final waves (extra count grows with frac^2 through the stage), so the end
// of a stage floods the field. Mostly one-shot fodder (see GRUNT/FAST weights in
// waves.ts) keeps it survivable and gives Piercing real value. SURGE = the dial.
export const CHAOS_SURGE = 26;        // extra enemies on a stage's final non-boss wave (eased 36 → 26)
export const WAVE_COUNT_MAX = 50;     // hard cap per wave (survivability + perf)
export const CHAOS_SPAWN_WINDOW = 6.5; // a wave's spawns pour in within ~this many seconds
export const SPAWN_INTERVAL_BASE = 1.1;
export const SPAWN_INTERVAL_STEP = 0.02;
export const SPAWN_INTERVAL_MIN = 0.12; // floor lowered so big swarms flood, not trickle
export const INTERMISSION_TIME = 3.0;
/** Pause between the last kill and the shop/home swap, so the final
 * explosion, popups, and sound finish instead of being cut off. */
export const WAVE_CLEAR_LINGER = 1.0;

// Economy — coins (in-run) and Cores (permanent). Cores are earned by
// CLEARING WAVES, never by converting coins (v0.7.0 model).
export const MONEY_PER_KILL = 5; // (enemy rewards above are the real payouts)
export const COMBO_WINDOW = 2.0;
export const COMBO_BONUS_PER = 0.1;
export const COMBO_BONUS_MAX = 1.25; // combo tops out at 2.25x (was 3x) — chaos kept it pinned at max
export const WAVE_CLEAR_CORES = 1;   // x level, per cleared wave (instant)
export const LEVEL_CLEAR_CORES = 15; // x level, bonus for the boss wave

// Turret sprite rig (from the design handoff — pivots took iteration!)
export const GUN_PIVOT = { x: 0.5, y: 0.86 };   // of the turret_gun_* art (rotation socket)
export const BASE_SOCKET = { x: 0.5, y: 0.43 }; // of turret_base.png
/** The swiveling gun art swaps with how many bullets a single shot fires
 * (shots = 1 + multiLevel): 1 / 2 / 3 barrels, then "many" for 4+. All four
 * share the same dimensions + pivot, so they're drop-in swaps. */
export const TURRET_GUN_TEXTURES = ["turret_gun_1", "turret_gun_2", "turret_gun_3", "turret_gun_many"];
export function turretGunKey(shots: number): string {
  return TURRET_GUN_TEXTURES[Math.min(Math.max(shots, 1), 4) - 1];
}
// Visual sizes (world px), proportions per the mock: gun height = 0.69 x base.
export const TURRET_BASE_W = 96;
export const TURRET_GUN_H = 66;
/** When Auto-Shooter is owned the base swaps to base_blue.png (a glowing blue
 * ring round the hub); its zaps leave that ring at the point facing the target.
 * Radius as a fraction of the base's display width (the ring sits ~halfway out). */
export const AUTO_RING_RADIUS_FRAC = 0.245;
export const ENEMY_SPRITE_SCALE = 3.0;          // sprite width = radius x this

// -- In-run upgrade costs (base x growth^level) -------------------------------
export const GEN_BASE_COST = 50;
export const GEN_COST_GROWTH = 1.6;
export const GEN_INCOME = 3.0;            // coins/sec per level
export const AUTO_BASE_COST = 50;
export const AUTO_COST_GROWTH = 1.6;
export const AUTO_BASE_COOLDOWN = 1.0;    // seconds per shot / level
export const AUTO_BULLET_DAMAGE = 18;
export const AUTO_MAX_LEVEL = 5;          // cap upgrades so it can't solo waves
export const AUTO_RANGE = 200;            // only zaps enemies this close — a close-in
                                          // defense, not a full-map auto-clear (< shooter's
                                          // 260 fire range, so shooters must be cannoned)
export const TURRET_BASE_COST = 60;
export const TURRET_COST_GROWTH = 1.6;
export const TURRET_CD_FACTOR = 0.9;
export const TURRET_SIZE_PER_LEVEL = 1;
export const MS_BASE_COST = 220;
export const MS_COST_GROWTH = 2.0;
export const MULTI_SPREAD_DEG = 16;
/** Turret aim easing: how fast the gun heading chases the cursor (per second,
 * frame-rate independent: fraction closed = 1 - e^(-rate·dt)). Higher = snappier
 * / less lag; lower = smoother. Smooths the long barrel's sweep when the
 * pointer reports its position in bursts during fast circles. */
export const AIM_SMOOTH_RATE = 50;
/** Hold fire until the eased gun heading is within this of the aim target
 * (radians, ~1.7°). Tight so the shot lands where you tapped — at 0.2 (~11°) the
 * first shot after a mobile tap fired mid-swivel and almost always missed. The
 * swivel is fast (AIM_SMOOTH_RATE 50, ~100ms to settle) so this adds no felt lag;
 * it just means "swivel to exactly there, then fire there." */
export const AIM_FIRE_TOLERANCE = 0.03;
/** When a device is dropping frames (or reduce-motion is on), explosion
 * particle counts scale to this fraction to cut additive overdraw. Devices
 * holding framerate stay at 1 (full). See perf.ts + BattleScene.updatePerf. */
export const FX_LITE_SCALE = 0.45;
export const PIERCE_BASE_COST = 150;
export const PIERCE_COST_GROWTH = 1.8;
export const EXPLOSIVE_BASE_COST = 250;
export const EXPLOSIVE_COST_GROWTH = 1.8;
export const EXPLOSIVE_SPLASH_DMG = 16;        // v2: was 12 (one-shots Fast)
export const EXPLOSIVE_SPLASH_PER_LEVEL = 6;
export const EXPLOSIVE_RADIUS_BASE = 100;      // v2: was a fixed 60 — felt useless
export const EXPLOSIVE_RADIUS_PER_LEVEL = 25;  // with sparse enemies, blasts grow
export const GUIDED_COST = 350;
export const GUIDED_TURN = 120;           // deg/sec steering cap
export const GUIDED_RANGE = 240;

// Defense trio
export const REPAIR_BASE_COST = 60;
export const REPAIR_COST_GROWTH = 1.4;
export const REPAIR_HP = 30;
export const PLATING_BASE_COST = 90;
export const PLATING_COST_GROWTH = 1.5;
export const PLATING_HP = 25;
/** v2 balance (Shannon, 2026-06-12): repair+plating stacked into a
 * near-unkillable tower (cheap HP every shop visit, even mid-wave via the
 * pause shop). Both are now limited buys per level — raise if playtests
 * say 1 is too harsh. */
export const REPAIR_MAX_BUYS = 1;
export const PLATING_MAX_BUYS = 1;
export const SHIELD_BASE_COST = 350;
export const SHIELD_COST_GROWTH = 1.7;
export const SHIELD_BASE_HITS = 2;        // layers at level 1 (+1 per level)
export const SHIELD_HIT_ABSORB = 30;      // dmg one layer soaks from a single hit
export const SHIELD_RING_BASE = 66;       // innermost ring radius (px)
export const SHIELD_RING_GAP = 7;         // +radius per extra layer

// Drone
export const INTERCEPTOR_COST = 250;  // in-run, one-time (tree-gated)
export const INTERCEPT_CD = 0.35;     // seconds between projectile swats
export const MEDIC_COST = 300;        // in-run, one-time (tree-gated)
export const MEDIC_HPS = 2;           // HP/sec healed while the field is clear
export const TWIN_COST = 200;   // v2: one-time per-run buy (tree-gated) — the
                                // original auto-granted it, breaking gate-not-grant
export const DRONE_RADIUS = 22; // 2x — purely the drone's on-screen size (+ shadow); no gameplay effect
export const DRONE_SPEED = 300;           // top speed (px/s)
/** The drone steers with momentum instead of snapping its heading: it
 * accelerates/decelerates toward the wanted spot. ACCEL is the max change in
 * velocity (px/s²) — high = snappy, low = floaty (200 ≈ 3s to reverse full
 * speed, 1200 ≈ 0.5s, 2400 ≈ 0.25s). Below ~900 it can't brake within
 * ARRIVE_RADIUS, so it overshoots/circles its target — fine for feeling out the
 * extreme. ARRIVE_RADIUS is how close it starts easing off. */
export const DRONE_ACCEL = 900;
export const DRONE_ARRIVE_RADIUS = 50;
/** Max rate the drone's body can rotate to face its direction of travel
 * (rad/s). The nose eases toward its heading instead of snapping — lower =
 * slower, more deliberate swivel (5 ≈ 0.6s for a 180° turn). Independent of
 * ACCEL: that's how fast it changes its movement; this is just sprite spin. */
export const DRONE_TURN_RATE = 5;
export const DRONE_DAMAGE = 18;
export const DRONE_DAMAGE_PER_LEVEL = 4;
export const DRONE_STANDOFF = 75;
export const DRONE_BASE_RANGE = 130;
export const DRONE_RANGE_PER_LEVEL = 55;
export const DRONE_BASE_CD = 1.6;
export const DRONE_CD_FACTOR = 0.8;
export const DRONE_COST = 100;            // deploy (Lv 0 -> 1)
export const DRONE_ORBIT_RADIUS = 100;
export const DRONE_ORBIT_SPEED = 90;      // deg/sec idle orbit
// First upgrade must cost MORE than deploy so the price never dips: deploy 100,
// then 120 -> 192 -> 307 -> …
export const DRONE_UPGRADE_BASE_COST = 120;
export const DRONE_UPGRADE_GROWTH = 1.6;

// Ultimates (own many, equip one; Space fires the equipped one)
export const LASER_COST = 1000;
export const LASER_COOLDOWN = 12;
export const LASER_DURATION = 2.5;
export const LASER_DPS = 240;
export const LASER_WIDTH = 44;
export const FREEZE_COST = 250;
export const FREEZE_DURATION = 3.0;
export const FREEZE_COOLDOWN = 14;
export const EMP_COST = 400;
export const EMP_DAMAGE = 60;
export const EMP_STUN = 0.8;              // a pulse, NOT a freeze
export const EMP_COOLDOWN = 10;
export const WARP_COST = 500;
export const WARP_FACTOR = 0.35;
export const WARP_DURATION = 8.0;
export const WARP_COOLDOWN = 16;
export type UltimateKey = "emp" | "freeze" | "warp" | "laser";
export const ULTIMATE_COSTS: Record<UltimateKey, number> = {
  emp: EMP_COST, freeze: FREEZE_COST, warp: WARP_COST, laser: LASER_COST,
};
export const ULTIMATE_NAMES: Record<UltimateKey, string> = {
  emp: "EMP Burst", freeze: "Freeze Bomb", warp: "Time Warp", laser: "Laser Beam",
};

// Instant kill bonuses (no pickups — granted on the kill itself)
export const DROP_CHANCE = 0.05; // chaos waves have far more kills; 5% keeps drops a treat, not a flood
export const DROP_WEIGHTS = { cash: 1, heal: 3, rapid: 1 }; // heal only rolls when hurt
export const DROP_CASH = 40;
export const DROP_HEAL = 25;
export const DROP_RAPID_TIME = 5.0;
export const RAPID_FIRE_CD_MULT = 0.4;

// Juice
export const FLASH_TIME = 0.06;
export const MAX_DT = 0.05;
export const SAVE_VERSION = 1;
