/** Entry point: boot Phaser into #game with the DOM HUD + panels overlaid.
 * The Game controller (src/game.ts) owns flow; this file wires the pieces
 * and the global keyboard routing. */

import "./crash"; // FIRST: the crash banner must catch module-init errors below
import Phaser from "phaser";
import { WORLD_AR_MAX, WORLD_AR_MIN, WORLD_H, WORLD_PORTRAIT_W } from "./config";
import { game, isTouch, applyHanded } from "./game";
import { play } from "./audio";
import { initMusic } from "./music";
import { initAnalytics } from "./analytics";
import { installKeyboardRouting } from "./input";
import { BattleScene } from "./scenes/BattleScene";
import { updateHud } from "./ui/hud";
import { ShopPanel } from "./ui/shop";
import { SkillsPanel } from "./ui/skills";
import { HomeScreen } from "./ui/home";
import { DeadScreen } from "./ui/dead";
import { WonPanel } from "./ui/won";
import { PauseScreen } from "./ui/pause";
import { SettingsModal } from "./ui/settings";
import { AchievementsModal } from "./ui/achievements";
import { TowerModal } from "./ui/towerModal";
import { initJoystick } from "./ui/joystick";
import { initNative, haptic } from "./native";

initNative(); // iOS/Android Capacitor wrap setup (no-op on web)

if (matchMedia("(hover: none) and (pointer: coarse)").matches) {
  document.documentElement.classList.add("touch");
}
applyHanded(); // mirror the touch HUD to the saved left/right preference
initJoystick(); // wire the touch aim-joystick (no-op visuals on desktop)

initMusic(); // looping background music, unlocked on first gesture (autoplay policy)
initAnalytics(); // anonymous playtime + progression (no-op until a PostHog key is set)

// Global UI click sound — broad brush: any <button> press. Capture phase so it
// still fires for handlers that stopPropagation. (Canvas/battle clicks aren't
// buttons, so aiming/firing stays silent here.)
document.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement)?.closest?.("button");
  if (btn && btn.dataset.sfx !== "none") { play("click"); haptic("light"); } // buttons opt out via data-sfx="none"
}, true);

const stage = document.getElementById("stage")!;
const panels = document.createElement("div");
panels.id = "panels";
stage.appendChild(panels);

const shop = new ShopPanel(panels);
const skills = new SkillsPanel(panels);
const home = new HomeScreen(panels);
new DeadScreen(panels);
new WonPanel(panels);
const pause = new PauseScreen(panels);
const settings = new SettingsModal(document.body);
const achievements = new AchievementsModal(document.body);
const tower = new TowerModal(document.body);
home.onSkills = () => { skills.returnTo = "home"; game.show("skills"); };
home.onSettings = () => settings.show();
home.onAchievements = () => achievements.show();
home.onTower = () => tower.show();
tower.onClose = () => { if (game.screen === "home") home.render(); }; // refresh cores/tower strip
pause.onSettings = () => settings.show();
shop.onSettings = () => settings.show();   // gear in the Upgrades panel
skills.onSettings = () => settings.show(); // gear in the Skill Tree panel

// Size the world to the window's aspect ratio so the canvas fills the screen
// (no FIT pillarbox) — enemies then enter from the real edges. The reference
// axis is fixed (height in landscape, width in portrait) to keep the tower a
// constant on-screen size; the other axis stretches to the screen, clamped so
// extreme ratios don't make an absurd arena.
function computeWorld(): { w: number; h: number } {
  const winW = Math.max(1, window.innerWidth);
  const winH = Math.max(1, window.innerHeight);
  const clamp = (v: number) => Math.min(WORLD_AR_MAX, Math.max(WORLD_AR_MIN, v));
  if (winH > winW) {
    const ar = clamp(winH / winW); // portrait: tall arena
    return { w: WORLD_PORTRAIT_W, h: Math.round(WORLD_PORTRAIT_W * ar) };
  }
  const ar = clamp(winW / winH); // landscape: wide arena
  return { w: Math.round(WORLD_H * ar), h: WORLD_H };
}
game.world = computeWorld();

const phaser = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: game.world.w,
  height: game.world.h,
  transparent: true, // the page draws the backdrop + grid (full-bleed at any ratio)
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [],
});
phaser.scene.add("battle", BattleScene, true, { onHud: updateHud });

// Boot to Home (the entry point), with the battle scene idling underneath.
game.screen = "home";
queueMicrotask(() => { game.screen = "battle"; game.show("home"); });

// Dev/debug handle (used by the headless QA driver) — dev builds only.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).rt2 = game;
}

// HUD buttons
document.getElementById("btn-shop")?.addEventListener("click", openPauseShop);
// The ultimate-ready chip doubles as the fire button (the only way on touch).
// Use pointerdown, not click: on iOS a second finger's tap won't synthesize a
// click while another touch (the aim joystick) is held, so a "click" listener
// silently misses. pointerdown fires per-finger regardless of the held joystick.
document.getElementById("st-ult")?.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (game.screen === "battle") game.battle?.fireUltimate();
});
// Battle HUD gear: pause and open the same settings modal as the Home screen;
// closing it resumes the battle (other screens are left as they are).
document.getElementById("hud-gear")?.addEventListener("click", () => {
  if (game.screen !== "battle") return;
  game.battle?.setPaused(true);
  settings.show();
});
settings.onClose = () => {
  if (game.screen === "battle") game.battle?.resumeWave();
};
document.getElementById("btn-skills")?.addEventListener("click", openSkills);

function openSkills(): void {
  if (game.battle?.inGodMode()) return; // no skill tree during the bonus wave
  if (game.screen === "battle") {
    skills.returnTo = "battle";
    game.battle?.setPaused(true);
  } else if (game.screen === "home") {
    skills.returnTo = "home";
  } else return;
  game.show("skills");
}

function openPauseShop(): void {
  if (game.screen !== "battle" || game.battle?.inGodMode()) return; // no shop during the bonus wave
  game.shopMode = "paused";
  game.battle?.setPaused(true);
  game.show("shop");
}

// Global keyboard routing — the full shortcut map lives in src/input.ts.
installKeyboardRouting({ shop, skills, pause, settings, achievements, openSkills, openPauseShop });

// A live battle auto-pauses when the window loses focus (parity with the
// original); regaining focus does NOT auto-resume.
function autoPause(): void {
  if (game.screen === "battle") {
    game.battle?.setPaused(true); // also stops the ambience engine loops (ambience.stopAll)
    game.show("pause");
  }
}
window.addEventListener("blur", autoPause);
// Mobile: backgrounding the app fires visibilitychange (NOT reliably blur), and a
// backgrounded WebView keeps Web Audio running — so without this the enemy engine
// loops kept playing after leaving the app. Pausing here runs ambience.stopAll().
document.addEventListener("visibilitychange", () => { if (document.hidden) autoPause(); });

// Re-fit when the window's shape changes enough that the boot-time world no
// longer matches it (a rotation, OR a desktop window resize). We re-pick the
// world for the new orientation and LIVE-RESIZE the Phaser game to it — no
// reload, so a mid-run rotation keeps the run. (Previously we deferred to a
// reload at Home; mid-run, FIT then squished the boot-orientation world into the
// rotated viewport, leaving a tiny tower with enemies entering from mid-field.)
let refitTimer = 0;
function checkViewport(): void {
  const target = computeWorld();
  const flipped = target.w > target.h !== game.world.w > game.world.h;
  // Touch devices only react to a real rotation: mobile URL-bar show/hide
  // changes innerHeight and must NOT trigger a re-fit. Desktop has no such
  // jitter, so there we also re-fit a meaningful within-orientation resize.
  const desktopResized = !isTouch() &&
    (Math.abs(target.w - game.world.w) > 80 || Math.abs(target.h - game.world.h) > 80);
  if (flipped || desktopResized) {
    game.world.w = target.w;
    game.world.h = target.h;
    // setGameSize (NOT resize) so FIT recomputes the DISPLAY box to the new aspect
    // too — resize() only updated the internal resolution, leaving the canvas
    // stretched into the old-orientation box (a squished/oval tower).
    phaser.scale.setGameSize(target.w, target.h);
    game.battle?.relayout();                  // re-center the tower for it
  }
  // Always re-fit the canvas to the SETTLED viewport. Phaser's FIT auto-refit can
  // latch a stale (lagged) size during a rotation — notably when rotating BACK to
  // the boot orientation, which otherwise leaves the scene shrunk to a tiny box.
  phaser.scale.refresh();
}
function onViewportChange(): void {
  // Debounce: a drag-resize fires many events; act once it settles.
  clearTimeout(refitTimer);
  refitTimer = window.setTimeout(checkViewport, 350);
}
window.addEventListener("resize", onViewportChange);
window.addEventListener("orientationchange", onViewportChange);
game.onScreenChange = (s) => {
  // The touch combat controls (joystick + ultimate orb) only show in battle.
  document.documentElement.classList.toggle("in-battle", s === "battle");
};
