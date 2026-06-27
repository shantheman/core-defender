/** The Game controller: owns the GameState and routes between screens.
 * Phaser runs the battle; every menu/panel is DOM. Screens register
 * themselves here so the controller stays the single flow authority.
 *
 * Flow (same as the original):
 *   HOME -> BATTLE -> (wave cleared) SHOP -> BATTLE ... boss wave -> HOME
 *   BATTLE -> (hp 0) DEAD -> HOME (retry same level at wave 1)
 */

import { GameState } from "./sim/state";
import { reportStorageEvent } from "./analytics";
import { mirrorSave } from "./native";

/** Short, PII-free error string for storage telemetry. */
function errMsg(e: unknown): string {
  return String((e as { message?: unknown })?.message ?? e ?? "unknown").slice(0, 120);
}

/** Touch-primary device (phone/tablet): no hover, coarse pointer. main.ts
 * sets the html "touch" class from the media query at boot; reading the class
 * (not the query) keeps every consumer consistent and testable. */
export function isTouch(): boolean {
  return document.documentElement.classList.contains("touch");
}

/** Reflect the player's handedness onto <html> so CSS can mirror the touch HUD
 * (stick on the chosen corner, buttons on the other). Call at boot and whenever
 * the Settings toggle changes. */
export function applyHanded(): void {
  const el = document.documentElement;
  const left = game.gs.handed === "left";
  el.classList.toggle("handed-left", left);
  el.classList.toggle("handed-right", !left);
}

export type Screen = "home" | "battle" | "shop" | "skills" | "pause" | "dead" | "won";

export interface ScreenHooks {
  onShow?: (from: Screen) => void;
  onHide?: () => void;
}

export class Game {
  readonly gs: GameState;
  screen: Screen = "home";
  /** World dimensions — picked at boot: classic 960x720 on landscape screens,
   * a tall battlefield on portrait phones (same mechanics, taller arena). */
  world = { w: 960, h: 720 };
  /** Why the shop is open: between waves (cleared) or a mid-wave Tab pause. */
  shopMode: "cleared" | "paused" = "paused";
  /** One-shot: set when a boss clear sends the player home, so the Home
   * screen can celebrate the level instead of saying "welcome back". */
  justClearedLevel: number | null = null;
  private hooks = new Map<Screen, ScreenHooks>();
  /** The battle scene registers these so DOM panels can drive it. */
  battle: {
    startBattle: () => void;      // fresh run at gs.level
    resumeWave: () => void;       // unpause after a shop/pause panel closes
    nextWave: () => void;         // leave the between-waves shop
    setPaused: (p: boolean) => void;
    fireUltimate: () => void;     // the HUD chip taps this on touch devices
    retryFromCheckpoint: () => boolean; // death -> resume at the snapshot wave
    startGodMode: () => void;     // post-win bonus: maxed weapons, ~20s onslaught, sandboxed
    inGodMode: () => boolean;     // true during the bonus wave (hide shop/skills + their shortcuts)
    relayout: () => void;         // re-center the tower after a live world resize (rotation)
  } | null = null;
  /** Optional global observer, fired after every screen swap (main.ts uses
   * it to schedule lossless orientation reloads). */
  onScreenChange: ((s: Screen) => void) | null = null;

  constructor() {
    this.gs = new GameState();
    // Wire the app-layer persistence hooks (the sim itself stays DOM/Capacitor-free).
    this.gs.onPersist = mirrorSave; // durable native copy of every save
    this.gs.onStorageError = (where, err) =>
      reportStorageEvent("storage_error", { where, message: errMsg(err) });
    // The boot load() ran in the GameState constructor, before onStorageError was
    // set — report any failure it recorded now (buffered until PostHog is live).
    if (this.gs.lastLoadError !== null)
      reportStorageEvent("storage_error", { where: "load", message: errMsg(this.gs.lastLoadError) });
  }

  register(screen: Screen, hooks: ScreenHooks): void {
    this.hooks.set(screen, hooks);
  }

  show(next: Screen): void {
    if (next === this.screen) return;
    const prev = this.screen;
    this.hooks.get(prev)?.onHide?.();
    this.screen = next;
    this.hooks.get(next)?.onShow?.(prev);
    this.onScreenChange?.(next);
  }
}

export const game = new Game();
