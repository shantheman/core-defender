/** The battle scene: tower + swiveling gun, waves of enemies, hold-click
 * shooting, drone/auto-shooter, ultimates. Mechanics live in GameState
 * (src/sim/state.ts) — this scene is rendering, motion, and collisions.
 * Visuals per docs/design/HANDOFF.md.
 *
 * The HUD/panels are DOM overlays (src/ui/*) fed via the onHud callback.
 */

import Phaser from "phaser";
import * as C from "../config";
import { game, isTouch } from "../game";
import { joystick } from "../ui/joystick";
import { dismissSplash } from "../ui/splash";
import { play, playExplosionBurst } from "../audio";
import {
  chooseEnemyType, effectiveWave, isBossWave, levelStartWave, waveInLevel,
  waveRobotCount, waveRobotSpeed, waveSpawnInterval, wavesForLevel,
} from "../sim/waves";
import { DroneController } from "./drone";
import * as ambience from "./ambience";
import { Effects } from "./effects";
import { perf } from "../perf";
import { track, setPlayer, addPlaytime, flushPlaytime, addFps, flushFps } from "../analytics";
import { enemyAnimFrame, updateEnemyRotors, updateSquadron, placeSatellite } from "./enemyAnim";
import { makeSilhouette, shadowOffset } from "./shadows";
import type { Enemy, EnemyBullet } from "./types";

/** Non-boss death sounds — one picked at random per kill so a swarm dying
 * doesn't machine-gun the same clip. */
const ENEMY_POPS = ["enemy_pop_1", "enemy_pop_2", "enemy_pop_3"] as const;

/** The purple flash that rips outward from the tower on every non-laser
 * ultimate — one shared colour so "purple = ultimate" reads at a glance. */
const ULTIMATE_PURPLE = 0xb15cff;

export interface HudState {
  level: number; waveInLevel: number; wavesInLevel: number;
  hp: number; maxHp: number; money: number; cores: number;
  shield: number; combo: number; comboMult: number;
  intermission: number;
  ultimate: { key: C.UltimateKey; name: string; ready: boolean; cooldown: number } | null;
  rapid: boolean;
}

interface Bullet {
  dot: Phaser.GameObjects.Arc;
  vx: number; vy: number;
  damage: number; radius: number;
  pierce: number;        // extra enemies it may pass through
  guided: boolean;
  hit: Set<Enemy>;       // don't hit the same enemy twice while piercing
  alive: boolean;
}

export class BattleScene extends Phaser.Scene {
  private onHud!: (s: HudState) => void;

  private towerPos = new Phaser.Math.Vector2(game.world.w / 2, game.world.h / 2);
  private base!: Phaser.GameObjects.Image;
  private baseBlue = false;          // showing the Auto-Shooter (blue-ring) base?
  private gun!: Phaser.GameObjects.Image;
  private gunShadow!: Phaser.GameObjects.Image;
  private gunVariant = 0;            // shots (1+multiLevel) the current gun art shows
  private shieldGfx!: Phaser.GameObjects.Graphics;
  private effects!: Effects;          // transient juice UNDER the tower (bursts, popups)
  private towerFx!: Effects;          // tower-origin beams ABOVE the base, BELOW the gun
  private shadowLayer!: Phaser.GameObjects.Layer;
  private droneCtl!: DroneController;
  private autoFireTimer = 0;

  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private enemyBullets: EnemyBullet[] = [];
  private toSpawn = 0;
  private spawnTimer = 0;
  private clearedLinger = 0;
  private animClock = 0; // drives enemy idle animation; advances with enemyDt (freeze stops it, warp slows it)
  private bossPending = false;
  private godMode = false;          // bonus post-win wave: maxed weapons, dense onslaught
  private godTimer = 0;             // seconds left in the god-mode onslaught
  private intermission = C.INTERMISSION_TIME;
  private fireTimer = 0;
  private aimAngle = -Math.PI / 2;                       // eased gun heading (gun/laser/bullets)
  private aimTarget = -Math.PI / 2;                      // raw heading; the gun rests here when not aiming
  private fpsAvg = 60;                                   // smoothed FPS for the perf throttle
  private perfLite = false;                              // FPS-driven low-quality state
  private perfFrames = 0;                                // active frames seen (grace period)
  private fpsFlushT = 0;                                 // active seconds since the last FPS analytics flush
  private aimP: Phaser.Input.Pointer | null = null;      // touch: pointer driving a field tap/drag aim
  private paused = false;
  private over = false; // tower destroyed; stop simulating

  // Ultimate effect timers (cooldowns are per-ultimate)
  private cooldowns: Record<C.UltimateKey, number> = { emp: 0, freeze: 0, warp: 0, laser: 0 };
  private freezeActive = 0;
  private stunActive = 0;
  private warpActive = 0;
  private laserActive = 0;

  constructor() { super("battle"); }

  init(data: { onHud: (s: HudState) => void }) { this.onHud = data.onHud; }

  preload() {
    this.load.image("turret_base", "sprites/turret_base.png");
    this.load.image("base_blue", "sprites/base_blue.png"); // Auto-Shooter base
    for (const k of C.TURRET_GUN_TEXTURES) this.load.image(k, `sprites/${k}.png`);
    this.load.image("drone", "sprites/drone.png");
    this.load.image(C.DRONE_FAN.texture, `sprites/${C.DRONE_FAN.texture}.png`);
    for (const k of ["enemy_0", "enemy_1", "enemy_2", "enemy_3", "enemy_4", "boss", "shooter"]) {
      this.load.image(k, `sprites/${k}.png`);
    }
    for (const t of [C.GRUNT, C.FAST, C.TOUGH, C.TANK, C.BOMBER, C.BOSS, C.SHOOTER]) {
      if (t.rotors) this.load.image(t.rotors.texture, `sprites/${t.rotors.texture}.png`);
      if (t.satellite) this.load.image(t.satellite.texture, `sprites/${t.satellite.texture}.png`);
    }
    // Drop-bonus flair icons (glow art, luminance-keyed to transparent).
    this.load.image("drop_health", "art/drop-health.webp");
    this.load.image("drop_rapid", "art/drop-rapid.webp");
  }

  create() {
    this.shadowLayer = this.add.layer(); // every shadow sits under tower/enemies/fx
    this.effects = new Effects(this);    // fx layer created here: above shadows, under the tower
    this.droneCtl = new DroneController(
      this, this.effects, this.shadowLayer, this.towerPos,
      (e, dmg) => this.hitEnemy(e, dmg));
    // Tower shadows (same language as the units): the grounded base casts a
    // tight "land" rim into shadowLayer; the elevated gun casts a detached
    // "air" silhouette ONTO the base (created between base and gun so it
    // draws above the base art), swiveling with the aim.
    // The base shows base_blue (glowing ring) once Auto-Shooter is owned.
    this.baseBlue = game.gs.autoLevel > 0;
    this.base = this.add.image(this.towerPos.x, this.towerPos.y, this.baseBlue ? "base_blue" : "turret_base")
      .setOrigin(C.BASE_SOCKET.x, C.BASE_SOCKET.y);
    this.base.setScale(C.TURRET_BASE_W / this.base.width);
    // The blue ring is internal glow — the plate silhouette is unchanged, so the
    // shadow always uses the plain plate.
    const baseShadow = this.add.image(
      this.towerPos.x + C.TOWER_SHADOW.base.x, this.towerPos.y + C.TOWER_SHADOW.base.y, "turret_base")
      .setOrigin(C.BASE_SOCKET.x, C.BASE_SOCKET.y).setScale(this.base.scale)
      .setTintFill(0x000000).setAlpha(C.TOWER_SHADOW.base.alpha);
    this.shadowLayer.add(baseShadow);
    // The gun art swaps with how many bullets a shot fires (1/2/3/many barrels).
    this.gunVariant = 1 + game.gs.multiLevel;
    const gunKey = C.turretGunKey(this.gunVariant);
    this.gunShadow = this.add.image(
      this.towerPos.x + C.TOWER_SHADOW.gun.x, this.towerPos.y + C.TOWER_SHADOW.gun.y, gunKey)
      .setOrigin(C.GUN_PIVOT.x, C.GUN_PIVOT.y)
      .setTintFill(0x000000).setAlpha(C.TOWER_SHADOW.gun.alpha);
    this.shieldGfx = this.add.graphics();
    // Tower-origin beams (auto-shooter zaps, ultimate laser) draw here — created
    // AFTER the base so they sit above it, BEFORE the gun so the barrel stays on top.
    this.towerFx = new Effects(this);
    this.gun = this.add.image(this.towerPos.x, this.towerPos.y, gunKey)
      .setOrigin(C.GUN_PIVOT.x, C.GUN_PIVOT.y);
    this.gun.setScale(C.TURRET_GUN_H / this.gun.height); // mock: gun height = 0.69 x base
    this.gunShadow.setScale(this.gun.scale * C.TOWER_SHADOW.gun.scale);

    this.input.addPointer(1); // allow a battlefield touch alongside the DOM joystick
    // Hold to fire (see update). On touch: the DOM aim-joystick (src/ui/joystick)
    // drives a RELATIVE aim + fires while held; a press anywhere on the field
    // aims toward that point (tracks if dragged) + fires while held. On desktop
    // the aim follows the cursor and fires while the mouse is down.
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      // Touch field press only — ignore desktop (joystick is DOM) and any press
      // that landed on a HUD button (downElement is then the button, not the
      // canvas), so tapping menus/gear doesn't also fire.
      if (!p.wasTouch || p.downElement !== this.game.canvas) return;
      this.aimP = p;
      this.aimTarget = Phaser.Math.Angle.Between(this.towerPos.x, this.towerPos.y, p.worldX, p.worldY);
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (this.aimP === p) this.aimP = null;
    });
    // (Space-fires-ultimate lives in the global keyboard map: src/input.ts.)

    game.battle = {
      startBattle: () => this.startBattle(),
      resumeWave: () => this.setPaused(false),
      nextWave: () => this.nextWave(),
      setPaused: (p) => this.setPaused(p),
      fireUltimate: () => this.fireUltimate(),
      retryFromCheckpoint: () => this.retryFromCheckpoint(),
      startGodMode: () => this.startGodMode(),
    };
    // Dev/debug handle for the headless QA driver (steps update() manually).
    if (import.meta.env.DEV) {
      const w = window as unknown as Record<string, unknown>;
      w.rt2scene = this;
      // Audio/boss test aid (dev only — stripped in prod): drop a lone boss into
      // the current battle with the player buffed enough to kill it fast, so the
      // boss move-loop + explosion are easy to hear. Press B, or call rt2boss().
      const summonBoss = () => {
        const gs = game.gs;
        gs.turretLevel = 60; gs.multiLevel = 4; gs.pierceLevel = 6; // super cannon only
        gs.autoLevel = 0; gs.droneLevel = 0; // no auto-laser/drone auto-fire — keep it quiet to hear the boss
        gs.hp = gs.maxHp();
        gs.wave = levelStartWave(gs.level) + wavesForLevel(gs.level) - 1; // this level's boss wave
        this.clearBoard(true);
        this.over = false;
        this.setPaused(false);
        this.startWave();
        this.toSpawn = 1; this.intermission = 0; this.spawnTimer = 0; // the boss, alone, right now
      };
      w.rt2boss = summonBoss;
      window.addEventListener("keydown", (e) => {
        if ((e.key === "b" || e.key === "B") && game.screen === "battle") summonBoss();
      });
    }
    this.startBattle();
    // If a menu screen (Home) is up, idle paused until it starts a battle.
    if (game.screen !== "battle") this.setPaused(true);
    dismissSplash(); // assets preloaded + scene built → reveal the game
  }

  setPaused(p: boolean): void {
    this.paused = p;
    this.aimP = null;
    if (p) ambience.stopAll(); // kill the engine beds while the sim is frozen
  }

  // -- run / wave flow ---------------------------------------------------------
  startBattle(): void {
    game.gs.resetRun();
    track("run_started", { level: game.gs.level });
    setPlayer({ best_stage: game.gs.bestStage }); // furthest stage reached (high-water)
    game.justClearedLevel = null;  // the celebration was seen; back to normal Home copy
    this.applyLevelBackground();
    this.clearBoard(true);
    this.effects.clear();
    this.towerFx.clear();
    this.over = false;
    this.setPaused(false);
    this.droneCtl.reset();
    this.startWave();
  }

  /** Swap the page-level battlefield image for this level. Alignment is by
   * construction: tower at world center, canvas FIT+centered, CSS background
   * cover+centered — so the image's central pad lands exactly under the
   * tower at any window size (see LEVEL_BACKGROUNDS in config.ts). */
  private applyLevelBackground(): void {
    const stage = document.getElementById("stage");
    if (!stage) return;
    const idx = this.godMode ? C.GODMODE_STAGE - 1 : (game.gs.level - 1); // god mode always uses bg16
    const name = C.LEVEL_BACKGROUNDS[idx % C.LEVEL_BACKGROUNDS.length];
    const variant = game.world.w > game.world.h ? "land" : "port";
    stage.style.backgroundImage = `url(backgrounds/${name}_${variant}.webp)`;
    stage.classList.add("has-bg");
  }

  /** Death-retry from the loadout snapshot (full HP, same gear, same wave). */
  retryFromCheckpoint(): boolean {
    if (!game.gs.restoreCheckpoint()) return false;
    this.clearBoard(true);
    this.effects.clear();
    this.towerFx.clear();
    this.over = false;
    this.setPaused(false);
    this.droneCtl.reset();
    this.startWave();
    return true;
  }

  /** Bonus post-win onslaught (from the You Won screen / the Home god-mode
   * button): every weapon maxed, a dense ~20s flood of swarms + frequent bosses
   * on bg16, then home (win or die). Sandboxed — touches only run state (never
   * persisted), so campaign progress is untouched; bg16 is forced directly so we
   * don't even borrow the campaign level. */
  startGodMode(): void {
    game.gs.resetRun();          // clean slate…
    game.gs.maxOutForGodMode();  // …then crank every weapon
    track("godmode_started", {});
    this.godMode = true;
    this.godTimer = C.GODMODE_DURATION;
    this.applyLevelBackground(); // forced to bg16 while godMode
    this.clearBoard(true);
    this.effects.clear();
    this.towerFx.clear();
    this.droneCtl.reset();
    this.over = false;
    this.setPaused(false);
    this.intermission = 0;       // no breather — pour it on
    this.toSpawn = 999999;       // endless flood (never depletes → never "clears")
    this.spawnTimer = 0;
    this.bossPending = false;
    this.clearedLinger = C.WAVE_CLEAR_LINGER;
  }

  /** End the bonus wave (timer out or tower fell): wipe the maxed loadout and
   * drop back home. No persisted state changed, so the campaign is intact. */
  private endGodMode(): void {
    this.godMode = false;
    this.over = true;
    ambience.stopAll();
    flushPlaytime(); flushFps();
    game.gs.resetRun();          // clear the maxed run state
    game.justClearedLevel = null;
    this.setPaused(true);
    game.show("home");
  }

  private startWave(): void {
    this.intermission = C.INTERMISSION_TIME;
    this.toSpawn = waveRobotCount(game.gs.wave);
    this.bossPending = isBossWave(game.gs.wave);
    this.spawnTimer = 0;
    this.clearedLinger = C.WAVE_CLEAR_LINGER;
  }

  private nextWave(): void {
    game.gs.startNextWave();
    this.startWave();
    this.setPaused(false);
  }

  private clearBoard(everything: boolean): void {
    // Between waves nothing may linger and sucker-punch the tower.
    for (const eb of this.enemyBullets) eb.dot.destroy();
    this.enemyBullets = [];
    for (const b of this.bullets) b.dot.destroy();
    this.bullets = [];
    if (everything) {
      for (const e of this.enemies) {
        e.sprite.destroy(); e.shadow.destroy(); e.hpBar?.destroy();
        e.rotors?.forEach(r => r.destroy()); e.squadronWings?.forEach(r => r.destroy());
        e.squadronShadows?.forEach(r => r.destroy()); e.satellite?.destroy(); e.satShadow?.destroy();
      }
      this.enemies = [];
    }
  }

  private waveCleared(): void {
    const level = game.gs.level, wave = game.gs.wave; // capture before onWaveCleared advances
    this.clearBoard(false);
    const { bossWave } = game.gs.onWaveCleared();
    track("wave_cleared", { level, wave });
    if (bossWave) {
      track("level_cleared", { level });
      setPlayer({ best_stage: game.gs.bestStage }); // just advanced a stage
      flushPlaytime();          // level done → bank the active time so far
      flushFps();               // …and the FPS window for this level
      play("level_clear");      // celebratory sting only on level (boss-wave) completion
      this.setPaused(true);     // CRITICAL: stop simulating under the Home screen
      if (level >= C.FINAL_STAGE) {              // beat the final stage → You Won
        game.gs.wonGame = true; game.gs.save();
        track("game_won", {});
        game.justClearedLevel = null;
        game.show("won");
        return;
      }
      game.justClearedLevel = game.gs.level - 1; // onWaveCleared advanced it
      game.show("home");        // level complete -> Home (cores banked)
    } else {
      play("wave_complete");     // non-boss wave cleared (boss/stage clear uses level_clear)
      game.shopMode = "cleared"; // between-waves shop (Start Next Wave to go on)
      game.show("shop");
      this.setPaused(true);
    }
  }

  private towerDestroyed(): void {
    if (this.godMode) { this.endGodMode(); return; } // bonus wave: death just drops you home
    this.over = true;
    ambience.stopAll();
    track("game_over", { level: game.gs.level, wave: game.gs.wave });
    flushPlaytime();
    flushFps();
    game.gs.save();
    game.show("dead");
  }

  // -- spawning ------------------------------------------------------------------
  private spawnOne(): void {
    const type = this.godMode
      ? (Math.random() < C.GODMODE_BOSS_CHANCE ? C.BOSS : chooseEnemyType(C.GODMODE_WAVE))
      : (this.bossPending ? C.BOSS : chooseEnemyType(game.gs.wave));
    if (this.bossPending) this.bossPending = false;
    const [x, y] = this.edgePosition();
    const sprite = this.add.image(x, y, type.sprite);
    sprite.setScale((type.radius * C.ENEMY_SPRITE_SCALE) / sprite.width);
    // Grounding shadow: the unit's own silhouette (top-down view — a blob
    // would read side-on). Land: a small rim past the feet; air: detached.
    const air = !!type.air;
    const { x: shadowOffX, y: shadowOffY } = shadowOffset(type.radius, air);
    const shadow = makeSilhouette(
      this, this.shadowLayer, type.sprite, x + shadowOffX, y + shadowOffY, sprite.scale, air);
    const ew = effectiveWave(game.gs.wave);
    const hp = type.levelScaled ? type.hp * (1 + C.HEAVY_HP_RAMP * (ew - 1)) : type.hp;
    // Boss covering fire scales with the game level (computed once at spawn).
    const lvl = game.gs.level;
    const fireCd = type === C.BOSS
      ? Math.max(C.BOSS_FIRE.minCd, C.BOSS_FIRE.baseCd - C.BOSS_FIRE.cdPerLevel * (lvl - 1)) : 0;
    const fireDamage = type === C.BOSS
      ? C.BOSS_FIRE.baseDamage + C.BOSS_FIRE.damagePerLevel * (lvl - 1) : 0;
    // Squadron wings render below the leader; create them then lift sprite to top.
    const squadronPhases = type.squadron
      ? type.squadron.offsets.map(() => Math.random() * Math.PI * 2) : [];
    const squadronWings = type.squadron
      ? type.squadron.offsets.map(() =>
          this.add.image(x, y, type.sprite).setScale(sprite.scale))
      : undefined;
    const squadronShadows = squadronWings?.map(() =>
      makeSilhouette(this, this.shadowLayer, type.sprite, x + shadowOffX, y + shadowOffY, sprite.scale, air));
    if (squadronWings?.length) this.children.bringToTop(sprite);
    // Swiveling overlay (origin = pivot so it rotates about its mount), layered
    // above the body. Its drop shadow is created first so it sits between body
    // and dish. placeSatellite re-positions both every animation frame.
    const satShadow = type.satellite
      ? this.add.image(x, y, type.satellite.texture)
          .setOrigin(type.satellite.pivot[0], type.satellite.pivot[1])
          .setScale(sprite.scale).setTintFill(0x000000).setAlpha(type.satellite.shadowAlpha)
      : undefined;
    const satellite = type.satellite
      ? this.add.image(x, y, type.satellite.texture)
          .setOrigin(type.satellite.pivot[0], type.satellite.pivot[1])
          .setScale(sprite.scale)
      : undefined;
    this.enemies.push({
      sprite, shadow, shadowOffX, shadowOffY, type, hp, maxHp: hp, alive: true, flash: 0,
      fireTimer: type.ranged?.fireCd ?? fireCd,  // first boss shot after one cooldown
      fireCd, fireDamage,
      speed: waveRobotSpeed(game.gs.wave) * type.speedMult,
      animPhase: Math.random() * Math.PI * 2, baseScale: sprite.scale, animOX: 0, animOY: 0,
      rotorAngle: 0,
      snapSide: Math.floor(Math.random() * 6), snapTimer: Math.random() * 1.5,
      rotors: type.rotors
        ? [0, 1, 2, 3].map(() =>
            this.add.image(x, y, type.rotors!.texture).setScale(sprite.scale))
        : undefined,
      squadronWings, squadronShadows, squadronPhases,
      satellite, satShadow,
      satAngle: Math.random() * Math.PI * 2, satTarget: Math.random() * Math.PI * 2, satTimer: 0,
    });
  }

  private edgePosition(): [number, number] {
    const { w, h } = game.world;
    const side = Math.floor(Math.random() * 4);
    if (side === 0) return [Math.random() * w, -C.SPAWN_MARGIN];
    if (side === 1) return [Math.random() * w, h + C.SPAWN_MARGIN];
    if (side === 2) return [-C.SPAWN_MARGIN, Math.random() * h];
    return [w + C.SPAWN_MARGIN, Math.random() * h];
  }

  /** Procedural "alive" pass (config ENEMY_ANIM) — runs after movement +
   * collision on the LOGICAL position, layering feedback-safe transforms:
   * always-face-tower + wobble, breathe/charge scale, and a hover bob whose
   * offset is recorded in animOX/animOY so it's undone before the next move. */
  private animateEnemy(e: Enemy, dt: number): void {
    if (game.gs.reduceMotion) {
      e.rotors?.forEach(r => r.setVisible(false));
      // Keep the overlay planted on the (statically posed) body, just frozen.
      if (e.satellite && e.type.satellite) {
        placeSatellite(e.sprite, e.satellite, e.type.satellite.pivot, e.satAngle,
          e.satShadow, e.sprite.displayWidth * e.type.satellite.shadowDrop);
      }
      return;
    }
    // Hex-snap rotation: lerp toward the target discrete face.
    const anim = C.ENEMY_ANIM[e.type.key];
    if (anim?.hexSnap && dt > 0) {
      const hexSnap = anim.hexSnap;
      // Moving-state idle rotation: tick the side-change timer when out of range.
      const dist = Math.hypot(this.towerPos.x - e.sprite.x, this.towerPos.y - e.sprite.y);
      if (!e.type.ranged || dist > e.type.ranged.fireRange) {
        e.snapTimer -= dt;
        if (e.snapTimer <= 0) {
          e.snapSide = (e.snapSide + 1 + Math.floor(Math.random() * (hexSnap - 1))) % hexSnap;
          e.snapTimer = 1.0 + Math.random() * 1.5;
        }
      }
      const targetRot = e.snapSide * (Math.PI * 2 / hexSnap) + Math.PI / hexSnap;
      const diff = Phaser.Math.Angle.Wrap(targetRot - e.sprite.rotation);
      e.sprite.setRotation(e.sprite.rotation + Math.sign(diff) * Math.min(Math.abs(diff), 6 * dt));
    }
    const charge = e.type.ranged ? 1 - Math.max(0, e.fireTimer) / e.type.ranged.fireCd : 0;
    const { ox, oy } = enemyAnimFrame({
      sprite: e.sprite, shadow: e.shadow, anim: C.ENEMY_ANIM[e.type.key],
      clock: this.animClock, phase: e.animPhase, baseScale: e.baseScale,
      fireCharge: charge, towerX: this.towerPos.x, towerY: this.towerPos.y,
    });
    e.animOX = ox; e.animOY = oy;
    if (e.rotors && e.type.rotors) {
      e.rotorAngle += dt * e.type.rotors.spinRads;
      updateEnemyRotors(e.sprite, e.rotors, e.type.rotors.armReach, e.rotorAngle);
    }
    if (e.squadronWings && e.type.squadron) {
      const sq = e.type.squadron;
      updateSquadron(e.sprite, e.squadronWings, sq.offsets, sq.driftAmp, sq.driftHz, this.animClock, e.squadronPhases);
    }
    // Radar dish: swivel toward satTarget, dwell on arrival, then re-aim.
    if (e.satellite && e.type.satellite && dt > 0) {
      const sc = e.type.satellite;
      const diff = Phaser.Math.Angle.Wrap(e.satTarget - e.satAngle);
      if (Math.abs(diff) <= sc.swivelSpeed * dt) {
        e.satAngle = e.satTarget;          // arrived
        e.satTimer -= dt;
        if (e.satTimer <= 0) {
          e.satTarget = Math.random() * Math.PI * 2;
          e.satTimer = sc.pauseMin + Math.random() * (sc.pauseMax - sc.pauseMin);
        }
      } else {
        e.satAngle += Math.sign(diff) * sc.swivelSpeed * dt;
      }
    }
    if (e.satellite && e.type.satellite) {
      placeSatellite(e.sprite, e.satellite, e.type.satellite.pivot, e.satAngle,
        e.satShadow, e.sprite.displayWidth * e.type.satellite.shadowDrop);
    }
  }

  // -- player fire -----------------------------------------------------------------
  /** Swap the gun art when the per-shot bullet count changes (1/2/3/many
   * barrels). Cheap: only touches the texture when multiLevel actually moves
   * (between waves, in the shop). All four share dims + pivot, so the scale
   * carries over. */
  private syncGunTexture(): void {
    const shots = 1 + game.gs.multiLevel;
    if (shots === this.gunVariant) return;
    this.gunVariant = shots;
    const key = C.turretGunKey(shots);
    this.gun.setTexture(key).setScale(C.TURRET_GUN_H / this.gun.height);
    this.gunShadow.setTexture(key).setScale(this.gun.scale * C.TOWER_SHADOW.gun.scale);
  }

  /** Swap the base art when Auto-Shooter is bought/owned (between waves). */
  private syncBaseTexture(): void {
    const on = game.gs.autoLevel > 0;
    if (on === this.baseBlue) return;
    this.baseBlue = on;
    this.base.setTexture(on ? "base_blue" : "turret_base").setScale(C.TURRET_BASE_W / this.base.width);
  }

  /** Centroid of the shot fan, in radians. The pattern is asymmetric (one round
   * straight at the cursor, extras to alternating sides), so its centroid is 0
   * for odd shot counts and +half-spread for even. The gun points HERE — not at
   * the cursor — so its symmetric barrels straddle the rounds, while the
   * straight round still flies at the cursor. */
  private gunSkew(): number {
    const n = 1 + game.gs.multiLevel;
    return Phaser.Math.DegToRad((n % 2 === 0) ? C.MULTI_SPREAD_DEG / 2 : 0);
  }

  private fireSpread(): void {
    const gs = game.gs;
    const aim = new Phaser.Math.Vector2(Math.cos(this.aimAngle), Math.sin(this.aimAngle));
    // One bullet straight at the cursor, extras fanned to alternating sides.
    const n = 1 + gs.multiLevel;
    const angles = [0];
    for (let k = 1; angles.length < n; k++) {
      angles.push(C.MULTI_SPREAD_DEG * k);
      if (angles.length < n) angles.push(-C.MULTI_SPREAD_DEG * k);
    }
    // Gun points at the fan's centroid; spawn every round at the MUZZLE (the
    // barrel tips out front) fanned across the barrels — not from each round's
    // own wide angle, which used to splay the origins back around the base.
    const centroid = Phaser.Math.DegToRad(angles.reduce((a, d) => a + d, 0) / n);
    const gunDir = aim.clone().rotate(centroid);
    const perp = gunDir.clone().rotate(Math.PI / 2);
    const muzzleDist = this.gun.displayHeight * C.GUN_PIVOT.y * C.MUZZLE_DIST_FACTOR;
    const muzzleBase = this.towerPos.clone().add(gunDir.clone().scale(muzzleDist));
    const barrelStep = this.gun.displayWidth * C.MUZZLE_SIDE_FACTOR;
    play("cannon");
    for (const deg of angles) {
      const dir = aim.clone().rotate(Phaser.Math.DegToRad(deg));
      // Offset across the barrels, symmetric about the gun's centre (so 1 shot =
      // centre, 2 = straddle, 3 = centre+two, …): index = (deg - centroid)/spread.
      const barrel = Phaser.Math.DegToRad(deg) - centroid;
      const start = muzzleBase.clone().add(
        perp.clone().scale((barrel / Phaser.Math.DegToRad(C.MULTI_SPREAD_DEG)) * barrelStep));
      const dot = this.effects.track(this.add.circle(start.x, start.y, gs.playerBulletRadius(), C.PLAYER_BULLET_COLOR));
      this.bullets.push({
        dot, vx: dir.x * C.BULLET_SPEED, vy: dir.y * C.BULLET_SPEED,
        damage: gs.playerDamage(), radius: gs.playerBulletRadius(),
        pierce: gs.pierceLevel, guided: gs.guidedOwned, hit: new Set(), alive: true,
      });
      const flash = this.effects.track(this.add.circle(start.x, start.y, 9, C.PLAYER_MUZZLE_COLOR, 0.9));
      this.tweens.add({ targets: flash, alpha: 0, scale: 1.8, duration: 70, onComplete: () => flash.destroy() });
    }
  }

  /** Guided Rounds: bend velocity a little toward the nearest enemy in range. */
  private steerBullet(b: Bullet, dt: number): void {
    let best: Enemy | null = null;
    let bestD = C.GUIDED_RANGE;
    for (const e of this.enemies) {
      const d = Math.hypot(e.sprite.x - b.dot.x, e.sprite.y - b.dot.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) return;
    const want = Math.atan2(best.sprite.y - b.dot.y, best.sprite.x - b.dot.x);
    const cur = Math.atan2(b.vy, b.vx);
    const maxTurn = Phaser.Math.DegToRad(C.GUIDED_TURN) * dt;
    const turn = Phaser.Math.Angle.Wrap(want - cur);
    const ang = cur + Phaser.Math.Clamp(turn, -maxTurn, maxTurn);
    const speed = Math.hypot(b.vx, b.vy);
    b.vx = Math.cos(ang) * speed;
    b.vy = Math.sin(ang) * speed;
  }

  private hitEnemy(e: Enemy, damage: number, hitPlane?: Phaser.GameObjects.Image): void {
    e.hp -= damage;
    e.flash = game.gs.reduceMotion ? 0 : C.FLASH_TIME;
    if (e.hp <= 0 && e.alive) this.kill(e, hitPlane);
  }

  /** Explosive Rounds: splash around the struck enemy + a visible shockwave.
   * Radius and damage both grow per level; every victim shows a damage number
   * so the blast visibly DOES something. */
  private explode(at: Phaser.Math.Vector2, exclude: Enemy): void {
    const gs = game.gs;
    if (gs.explosiveLevel <= 0) return;
    const dmg = C.EXPLOSIVE_SPLASH_DMG + C.EXPLOSIVE_SPLASH_PER_LEVEL * (gs.explosiveLevel - 1);
    const radius = C.EXPLOSIVE_RADIUS_BASE + C.EXPLOSIVE_RADIUS_PER_LEVEL * (gs.explosiveLevel - 1);
    for (const e of this.enemies) {
      if (e === exclude || !e.alive) continue;
      if (Math.hypot(e.sprite.x - at.x, e.sprite.y - at.y) <= radius) {
        this.effects.popup(e.sprite.x, e.sprite.y - 14, `-${dmg}`, "#ff9341");
        this.hitEnemy(e, dmg);
      }
    }
    const ring = this.effects.track(this.add.circle(at.x, at.y, 6).setStrokeStyle(3, 0xff9341, 0.9));
    this.tweens.add({
      targets: ring, radius, alpha: 0, duration: 300,
      onUpdate: () => ring.setStrokeStyle(2, 0xff9341, ring.alpha * 0.9),
      onComplete: () => ring.destroy(),
    });
  }

  private kill(e: Enemy, hitPlane?: Phaser.GameObjects.Image): void {
    e.alive = false;
    // Drop the hit-flash tint now — once alive is false this enemy is filtered
    // out of the update loop, so the flash branch can never clear it. Without
    // this the whole squadron sits solid-white through the cascade.
    e.sprite.clearTint();
    e.squadronWings?.forEach(w => w.clearTint());
    const boss = e.type === C.BOSS;
    const { gain, bonus } = game.gs.onKill(e.type.reward, boss);
    const wings = e.squadronWings;
    // A squadron visibly explodes plane-by-plane below (the 80ms cascade) — so
    // its audio fires one pop PER PLANE inside that loop, in step with each
    // burst, reading as a real series of explosions. The boss has its own boom;
    // a single enemy (or a squad collapsed instantly by reduce-motion) pops once.
    const cascade = !!(wings && wings.length > 0 && !game.gs.reduceMotion);
    if (boss) play("boss_explosion");
    else if (cascade) { /* per-plane pops fire in the cascade loop below */ }
    else if (wings && wings.length > 0) playExplosionBurst(1 + wings.length); // reduce-motion squad: all at once
    else play(ENEMY_POPS[Math.floor(Math.random() * ENEMY_POPS.length)], e.type === C.TANK ? 2 : 1); // tank dies louder
    this.effects.popup(e.sprite.x, e.sprite.y, `+${gain}`, "#ffc94a");
    if (bonus === "cash") this.effects.popup(e.sprite.x, e.sprite.y - 18, `BONUS +${C.DROP_CASH}`, "#ffc94a");
    else if (bonus === "heal") this.effects.dropFlair(e.sprite.x, e.sprite.y, "heal");
    else if (bonus === "rapid") this.effects.dropFlair(e.sprite.x, e.sprite.y, "rapid");
    // Shake only on a boss kill — a per-grunt-kill shake reads as a constant
    // "jiggle" once the Auto-Shooter is mowing things down.
    if (boss && !game.gs.reduceMotion) this.cameras.main.shake(260, 0.012);
    e.hpBar?.destroy();

    if (cascade) {
      // Cascade: hit plane explodes first, then chain to nearest neighbours.
      const first = (hitPlane?.active ? hitPlane : undefined) ?? e.sprite;
      const rest = [e.sprite, ...wings]
        .filter(p => p !== first)
        .sort((a, b) => Math.hypot(a.x - first.x, a.y - first.y) - Math.hypot(b.x - first.x, b.y - first.y));
      const order = [first, ...rest];
      const shadowMap = new Map<Phaser.GameObjects.Image, Phaser.GameObjects.Image>();
      shadowMap.set(e.sprite, e.shadow);
      e.squadronShadows?.forEach((s, i) => { if (wings[i]) shadowMap.set(wings[i], s); });
      order.forEach((plane, idx) => {
        this.time.delayedCall(idx * 80, () => {
          if (!plane.active) return;
          play(ENEMY_POPS[idx % ENEMY_POPS.length]); // one blast per plane, in step with its burst
          this.effects.burst(plane.x, plane.y, 8);
          plane.destroy();
          shadowMap.get(plane)?.destroy();
          if (idx === order.length - 1) { e.rotors?.forEach(r => r.destroy()); e.satellite?.destroy(); e.satShadow?.destroy(); }
        });
      });
    } else {
      this.effects.burst(e.sprite.x, e.sprite.y, boss ? 22 : 8);
      e.sprite.destroy();
      e.shadow.destroy();
      e.rotors?.forEach(r => r.destroy());
      e.squadronWings?.forEach(r => r.destroy());
      e.squadronShadows?.forEach(r => r.destroy());
      e.satellite?.destroy();
      e.satShadow?.destroy();
    }
  }

  // -- auto-shooter --------------------------------------------------------------
  private updateAutoShooter(dt: number): void {
    const gs = game.gs;
    if (gs.autoLevel <= 0) return;
    this.autoFireTimer -= dt;
    if (this.autoFireTimer > 0) return;
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      const d = Math.hypot(e.sprite.x - this.towerPos.x, e.sprite.y - this.towerPos.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best || bestD > C.AUTO_RANGE) return; // close-in defense only — far/fast enemies are the cannon's job
    // Zap leaves the base's blue ring at the point facing the target, so it
    // reads as a straight line out of the middle of the base.
    const dir = new Phaser.Math.Vector2(best.sprite.x - this.towerPos.x, best.sprite.y - this.towerPos.y).normalize();
    const r = C.AUTO_RING_RADIUS_FRAC * this.base.displayWidth;
    this.towerFx.zap(this.towerPos.x + dir.x * r, this.towerPos.y + dir.y * r,
      best.sprite.x, best.sprite.y, C.AUTO_SHOOTER_COLOR);
    play("auto_laser");
    this.hitEnemy(best, C.AUTO_BULLET_DAMAGE);
    this.autoFireTimer = C.AUTO_BASE_COOLDOWN / gs.autoLevel;
  }

  // -- ultimates ------------------------------------------------------------------
  private fireUltimate(): void {
    const gs = game.gs;
    const key = gs.equippedUltimate;
    if (!key || this.paused || this.over || this.cooldowns[key] > 0) return;
    if (key === "freeze") {
      this.freezeActive = C.FREEZE_DURATION;
      this.cooldowns.freeze = C.FREEZE_COOLDOWN;
      play("ultimate_freeze");
      this.effects.shockwave(this.towerPos.x, this.towerPos.y, ULTIMATE_PURPLE);
    } else if (key === "emp") {
      // Instant damage to EVERYTHING + fries projectiles; brief pulse stun.
      if (this.enemyBullets.length >= 5) gs.unlockAchievement("emp_fry");
      for (const eb of this.enemyBullets) eb.dot.destroy();
      this.enemyBullets = [];
      for (const e of [...this.enemies]) this.hitEnemy(e, C.EMP_DAMAGE);
      this.stunActive = C.EMP_STUN;
      this.cooldowns.emp = C.EMP_COOLDOWN;
      play("ultimate_emp");
      this.effects.shockwave(this.towerPos.x, this.towerPos.y, ULTIMATE_PURPLE);
    } else if (key === "warp") {
      this.warpActive = C.WARP_DURATION;
      this.cooldowns.warp = C.WARP_COOLDOWN;
      play("ultimate_warp");
      this.effects.shockwave(this.towerPos.x, this.towerPos.y, ULTIMATE_PURPLE);
    } else if (key === "laser") {
      this.laserActive = C.LASER_DURATION;
      this.cooldowns.laser = C.LASER_COOLDOWN;
      play("laser");
    }
  }

  private updateLaser(dt: number): void {
    if (this.laserActive <= 0) return;
    this.laserActive -= dt;
    const aim = new Phaser.Math.Vector2(Math.cos(this.aimAngle), Math.sin(this.aimAngle));
    const end = this.towerPos.clone().add(aim.clone().scale(2000));
    const beam = this.towerFx.track(this.add.line(0, 0, this.towerPos.x, this.towerPos.y, end.x, end.y, 0xffffff, 0.9))
      .setOrigin(0).setLineWidth(C.LASER_WIDTH / 8);
    const glow = this.towerFx.track(this.add.line(0, 0, this.towerPos.x, this.towerPos.y, end.x, end.y, 0x7fe8ff, 0.35))
      .setOrigin(0).setLineWidth(C.LASER_WIDTH / 3);
    this.time.delayedCall(40, () => { beam.destroy(); glow.destroy(); });
    // Damage every enemy near the beam line.
    for (const e of [...this.enemies]) {
      const toE = new Phaser.Math.Vector2(e.sprite.x - this.towerPos.x, e.sprite.y - this.towerPos.y);
      const along = toE.dot(aim);
      if (along < 0) continue;
      const perp = Math.abs(toE.x * aim.y - toE.y * aim.x);
      if (perp <= C.LASER_WIDTH / 2 + e.type.radius) {
        if (e.type === C.GRUNT || e.type === C.FAST) this.kill(e); // vaporized
        else this.hitEnemy(e, C.LASER_DPS * dt);
      }
    }
  }

  private drawShield(): void {
    const gs = game.gs;
    this.shieldGfx.clear();
    // One ring per remaining layer; outermost brightest (matches the original).
    for (let i = 0; i < gs.shield; i++) {
      const r = C.SHIELD_RING_BASE + C.SHIELD_RING_GAP * i;
      const outer = i === gs.shield - 1;
      this.shieldGfx.lineStyle(outer ? 2 : 1, outer ? 0xc8f0ff : 0x7fe8ff, outer ? 0.9 : 0.45);
      this.shieldGfx.strokeCircle(this.towerPos.x, this.towerPos.y, r);
    }
  }

  /** Adaptive effects throttle: thin the heavy additive explosion particles
   * only when a device is genuinely dropping frames (or reduce-motion is on).
   * A smoothed FPS + hysteresis avoids reacting to one-off hitches; a grace
   * period skips start-of-run decode jank. Hardware that holds ~60fps never
   * trips it, so it has no effect on capable devices. */
  private updatePerf(): void {
    this.fpsAvg = this.fpsAvg * 0.98 + this.game.loop.actualFps * 0.02;
    addFps(this.game.loop.actualFps); // analytics sample (summary flushed in chunks, not per frame)
    if (this.perfFrames++ > 120) {
      if (this.fpsAvg < 48) this.perfLite = true;
      else if (this.fpsAvg > 56) this.perfLite = false;   // recover with hysteresis
    }
    perf.fx = (game.gs.reduceMotion || this.perfLite) ? C.FX_LITE_SCALE : 1;
  }

  // -- main loop ---------------------------------------------------------------------
  update(_time: number, deltaMs: number) {
    const gs = game.gs;
    const dt = Math.min(deltaMs / 1000, C.MAX_DT);
    if (this.paused || this.over) { this.pushHud(); return; }

    this.updatePerf();
    addPlaytime(dt); // active play time (this branch only runs while not paused)
    this.fpsFlushT += dt;
    if (this.fpsFlushT >= 60) { this.fpsFlushT = 0; flushFps(); } // periodic FPS summary on long waves
    gs.tick(dt);
    for (const k of Object.keys(this.cooldowns) as C.UltimateKey[]) {
      if (this.cooldowns[k] > 0) this.cooldowns[k] -= dt;
    }
    if (this.freezeActive > 0) this.freezeActive -= dt;
    if (this.stunActive > 0) this.stunActive -= dt;
    if (this.warpActive > 0) this.warpActive -= dt;

    const frozen = this.freezeActive > 0 || this.stunActive > 0;
    const enemyDt = frozen ? 0 : dt * (this.warpActive > 0 ? C.WARP_FACTOR : 1);
    this.animClock += enemyDt; // freeze pauses enemy animation; warp slows it

    // Keep the turret/base art matched to the current upgrades every active frame
    // (not just once the wave is live) — otherwise a fresh stage, where resetRun
    // has zeroed Multi-Shot, shows last stage's multi-barrel gun through the whole
    // intermission and only snaps back to single when the first enemy spawns.
    this.syncGunTexture();
    this.syncBaseTexture();

    if (this.godMode) {                       // bonus wave: count down to the end
      this.godTimer -= dt;
      if (this.godTimer <= 0) { this.endGodMode(); this.pushHud(); return; }
    }

    if (this.intermission > 0) {
      this.intermission -= dt;
    } else {
      if (this.toSpawn > 0) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnOne();
          this.toSpawn -= 1;
          this.spawnTimer = this.godMode ? C.GODMODE_SPAWN_INTERVAL : waveSpawnInterval(gs.wave);
        }
      } else if (!this.godMode && this.enemies.length === 0) {
        // Let the last kill's burst, popups, and sound breathe before the
        // screen swap (the battle keeps simulating for this beat).
        this.clearedLinger -= dt;
        if (this.clearedLinger <= 0) {
          this.waveCleared();
          this.pushHud();
          return;
        }
      }
      // Steer the aim. Desktop follows the cursor; touch uses the DOM joystick
      // (relative) or a field tap/drag (absolute); with no active input the
      // heading just persists (gun rests there, not firing).
      if (!isTouch()) {
        const p = this.input.activePointer;
        this.aimTarget = Phaser.Math.Angle.Between(this.towerPos.x, this.towerPos.y, p.worldX, p.worldY);
      } else if (joystick.active) {
        this.aimTarget = joystick.angle;
      } else if (this.aimP?.isDown) {
        this.aimTarget = Phaser.Math.Angle.Between(this.towerPos.x, this.towerPos.y,
          this.aimP.worldX, this.aimP.worldY);
      }
      // Ease the heading toward the target (frame-rate independent). The pointer
      // reports its position in bursts during fast circles, which would freeze
      // the long barrel for a frame then snap it; easing makes the sweep smooth.
      // gun, laser, and bullets all read aimAngle, so they stay in lockstep.
      this.aimAngle += Phaser.Math.Angle.Wrap(this.aimTarget - this.aimAngle)
        * (1 - Math.exp(-C.AIM_SMOOTH_RATE * dt));
      this.gun.setRotation(this.aimAngle + this.gunSkew() + Math.PI / 2);
      this.gunShadow.setRotation(this.gun.rotation);
      // Hold to fire: mouse down (desktop), or the joystick / a field press held
      // (touch). Lifting stops the gun — the player stays engaged rather than
      // parking the turret on auto-fire.
      const firing = isTouch()
        ? (joystick.active || this.aimP?.isDown === true)
        : (this.input.activePointer.isDown
           && this.input.activePointer.downElement === this.game.canvas); // not a HUD button
      // Hold fire until the gun has swung onto the target heading, so a tap to a
      // new direction doesn't spray shots at the in-between angles it sweeps past.
      const aligned = Math.abs(Phaser.Math.Angle.Wrap(this.aimTarget - this.aimAngle)) < C.AIM_FIRE_TOLERANCE;
      this.fireTimer -= dt;
      if (firing && aligned && this.fireTimer <= 0) {
        this.fireSpread();
        this.fireTimer = gs.playerCooldown();
      }
      this.updateAutoShooter(dt);
      this.droneCtl.update(dt, enemyDt, this.enemies);
      this.updateLaser(dt);
    }

    // Enemies advance; crash on the shield ring (or the tower itself).
    for (const e of this.enemies) {
      // Undo last frame's hover offset so movement integrates the LOGICAL
      // position (the bob is re-applied at the end, post-collision).
      e.sprite.x -= e.animOX; e.sprite.y -= e.animOY;
      e.animOX = 0; e.animOY = 0;
      if (e.flash > 0) {
        e.flash -= dt;
        e.sprite.setTintFill(0xffffff);
        e.squadronWings?.forEach(w => w.setTintFill(0xffffff));
      } else {
        e.sprite.clearTint();
        e.squadronWings?.forEach(w => w.clearTint());
      }
      const dx = this.towerPos.x - e.sprite.x;
      const dy = this.towerPos.y - e.sprite.y;
      const dist = Math.hypot(dx, dy);
      const ranged = e.type.ranged;
      if (ranged && dist <= ranged.fireRange) {
        e.fireTimer -= enemyDt;
        const preShot = C.ENEMY_ANIM[e.type.key]?.hexSnap;
        if (preShot && e.fireTimer <= 0.35 && e.fireTimer + enemyDt > 0.35 && enemyDt > 0) {
          e.snapSide = (e.snapSide + 1 + Math.floor(Math.random() * (preShot - 1))) % preShot;
        }
        if (e.fireTimer <= 0 && enemyDt > 0) {
          const dot = this.effects.track(this.add.circle(e.sprite.x, e.sprite.y, C.ENEMY_BULLET_RADIUS, 0xff5238));
          this.enemyBullets.push({
            dot, vx: (dx / dist) * C.ENEMY_BULLET_SPEED, vy: (dy / dist) * C.ENEMY_BULLET_SPEED,
            damage: ranged.projDamage, alive: true,
          });
          play("shooter_fire");
          e.fireTimer = ranged.fireCd;
        }
      } else if (dist > 0 && enemyDt > 0) {
        if (!C.ENEMY_ANIM[e.type.key]?.hexSnap) {
          e.sprite.setRotation(Math.atan2(dy, dx) + Math.PI / 2);
        }
        e.sprite.x += (dx / dist) * e.speed * enemyDt;
        e.sprite.y += (dy / dist) * e.speed * enemyDt;
      }
      // Boss covering fire: lobs a round at the tower as it advances (rate +
      // damage scale with level, seeded at spawn). It still crashes normally.
      if (e.type === C.BOSS && enemyDt > 0 && dist > 0) {
        e.fireTimer -= enemyDt;
        if (e.fireTimer <= 0) {
          // Muzzle: forward of center (toward the tower) by muzzleForward of the
          // sprite height; nudge for the boss's static altitude so it lines up
          // with the rendered turret rather than the logical (pre-anim) position.
          const ahead = e.sprite.displayHeight * C.BOSS_FIRE.muzzleForward;
          const alt = C.ENEMY_ANIM[e.type.key]?.altitude ?? 0;
          const mx = e.sprite.x + (dx / dist) * ahead;
          const my = e.sprite.y - alt + (dy / dist) * ahead;
          const dot = this.effects.track(this.add.circle(
            mx, my, C.BOSS_FIRE.bulletRadius, C.BOSS_FIRE.bulletColor));
          this.enemyBullets.push({
            dot, vx: (dx / dist) * C.ENEMY_BULLET_SPEED, vy: (dy / dist) * C.ENEMY_BULLET_SPEED,
            damage: e.fireDamage, alive: true,
          });
          play("boss_fire");
          e.fireTimer = e.fireCd;
        }
      }
      e.shadow.setPosition(e.sprite.x + e.shadowOffX, e.sprite.y + e.shadowOffY);
      e.shadow.setRotation(e.sprite.rotation);
      const crashAt = gs.shield > 0 ? gs.shieldRadius() + e.type.radius : e.type.radius + C.TOWER_SIZE / 2;
      if (!ranged && dist <= crashAt) {
        let dmg = e.type.contactDamage;
        if (e.type === C.BOSS) dmg = Math.max(dmg, Math.floor(gs.maxHp() * 0.9));
        const res = gs.damageTower(dmg);
        play(res.layersSpent > 0 ? "shield" : "tower_hit");
        if (!gs.reduceMotion) this.cameras.main.shake(140, res.layersSpent && !res.hpLost ? 0.005 : 0.009);
        e.alive = false;
        e.sprite.destroy(); e.shadow.destroy(); e.hpBar?.destroy();
        e.rotors?.forEach(r => r.destroy()); e.squadronWings?.forEach(r => r.destroy());
        e.squadronShadows?.forEach(r => r.destroy()); e.satellite?.destroy(); e.satShadow?.destroy();
        if (res.died) { this.towerDestroyed(); return; }
      }
      if (e.alive && e.type.healthbar) {
        e.hpBar ??= this.add.graphics();
        e.hpBar.clear();
        const w = e.type.radius * 2;
        e.hpBar.fillStyle(0x0a1424, 0.8).fillRect(e.sprite.x - w / 2, e.sprite.y - e.type.radius - 12, w, 5);
        e.hpBar.fillStyle(0x46e39a, 1).fillRect(e.sprite.x - w / 2, e.sprite.y - e.type.radius - 12, w * Math.max(0, e.hp / e.maxHp), 5);
      }
      if (e.alive) {
        this.animateEnemy(e, enemyDt);
        if (e.squadronWings && e.squadronShadows) {
          const a = e.shadow.alpha * 0.85;
          for (let i = 0; i < e.squadronWings.length; i++) {
            e.squadronShadows[i].setPosition(
              e.squadronWings[i].x + e.shadowOffX,
              e.squadronWings[i].y + e.shadowOffY,
            ).setRotation(e.squadronWings[i].rotation).setAlpha(a);
          }
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive);

    // Movement ambience: one looping engine bed per enemy TYPE on screen.
    const present = new Set<string>();
    for (const e of this.enemies) present.add(e.type.key);
    ambience.sync(present, dt);

    // Interceptor: the drone swats projectiles that enter its range.
    this.droneCtl.intercept(dt, this.enemyBullets);

    // Enemy projectiles -> shield ring or tower.
    for (const eb of this.enemyBullets) {
      eb.dot.x += eb.vx * enemyDt;
      eb.dot.y += eb.vy * enemyDt;
      const dist = Math.hypot(eb.dot.x - this.towerPos.x, eb.dot.y - this.towerPos.y);
      const hit = gs.shield > 0 ? dist <= gs.shieldRadius() : dist <= C.TOWER_SIZE / 2 + C.ENEMY_BULLET_RADIUS;
      if (hit) {
        const res = gs.damageTower(eb.damage);
        play(res.layersSpent > 0 ? "shield" : "hit");
        if (!gs.reduceMotion) this.cameras.main.shake(100, 0.005);
        eb.alive = false; eb.dot.destroy();
        if (res.died) { this.towerDestroyed(); return; }
      }
    }
    this.enemyBullets = this.enemyBullets.filter((b) => b.alive);

    // Player bullets: steer, travel, pierce, splash.
    for (const b of this.bullets) {
      if (b.guided) this.steerBullet(b, dt);
      b.dot.x += b.vx * dt;
      b.dot.y += b.vy * dt;
      if (b.dot.x < -20 || b.dot.x > game.world.w + 20 || b.dot.y < -20 || b.dot.y > game.world.h + 20) {
        b.alive = false; b.dot.destroy(); continue;
      }
      for (const e of this.enemies) {
        if (b.hit.has(e)) continue;
        // Check leader + all wing planes so the full formation is a valid target.
        let hitPlane: Phaser.GameObjects.Image | undefined;
        if (Math.hypot(e.sprite.x - b.dot.x, e.sprite.y - b.dot.y) <= e.type.radius + b.radius) {
          hitPlane = e.sprite;
        } else if (e.squadronWings) {
          for (const w of e.squadronWings) {
            if (Math.hypot(w.x - b.dot.x, w.y - b.dot.y) <= e.type.radius + b.radius) {
              hitPlane = w; break;
            }
          }
        }
        if (hitPlane) {
          const at = new Phaser.Math.Vector2(hitPlane.x, hitPlane.y);
          this.hitEnemy(e, b.damage, hitPlane);
          this.explode(at, e);
          b.hit.add(e);
          if (b.pierce > 0) { b.pierce -= 1; } else { b.alive = false; b.dot.destroy(); }
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.alive);

    this.drawShield();
    this.pushHud();
  }

  private pushHud(): void {
    const gs = game.gs;
    const key = gs.equippedUltimate;
    this.onHud({
      level: gs.level, waveInLevel: waveInLevel(gs.wave), wavesInLevel: wavesForLevel(gs.level),
      hp: gs.hp, maxHp: gs.maxHp(), money: gs.money, cores: gs.cores,
      shield: gs.shield, combo: gs.combo, comboMult: gs.comboMult(),
      intermission: this.intermission,
      ultimate: key ? {
        key, name: C.ULTIMATE_NAMES[key],
        ready: this.cooldowns[key] <= 0, cooldown: Math.max(0, this.cooldowns[key]),
      } : null,
      rapid: gs.rapidTimer > 0,
    });
  }
}
