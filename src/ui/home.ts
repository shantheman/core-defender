/** Home screen — new/returning states per the mobile mocks (Downloads drop,
 * 2026-06-11): portrait stacks full-width controls under the hero; landscape
 * is hero-left / menu-right. Title is "MECH TIDE" — Callum's call, renamed
 * 2026-06-12 (was "Core Defender"; original working title "Robot Tower"). */

import { game } from "../game";
import * as C from "../config";
import { ACHIEVEMENTS, SKILL_NODES } from "../sim/state";
import { TROPHY_ICON } from "./icons";
import { maybeTutorial } from "./tutorial";
import { Panel } from "./panel";

export class HomeScreen extends Panel {
  onSkills: () => void = () => {};
  onSettings: () => void = () => {};
  onAchievements: () => void = () => {};
  onTower: () => void = () => {};

  constructor(parent: HTMLElement) {
    super(parent, "home", "home", "panel-screen home");
  }

  render(): void {
    const gs = game.gs;
    const returning = gs.towerLevel > 0 || gs.cores > 0 || gs.level > 1
      || gs.skills.size > 0 || gs.bestWave > 0;
    // The win-celebration menu (God Mode + New Game, no Continue) shows ONLY
    // while the campaign is actually finished — after the win, gs.level sits at
    // FINAL_STAGE + 1. Starting a New Game resets level to 1, so an in-progress
    // campaign falls through to the normal Continue/Next-Stage flow (the bug:
    // wonGame stays true forever for god-mode access, and it used to hijack the
    // whole menu, leaving no way past Stage 1). God Mode stays reachable as a
    // side button during a new campaign since wonGame remains true.
    const campaignDone = gs.wonGame && gs.level > C.FINAL_STAGE;

    const strip = !returning ? "" : `
      <div class="home-strip">
        <div class="hs-box"><label>REACHED</label><b class="lt">Stage ${gs.level}</b></div>
        <div class="hs-box"><label>CORES</label><span class="hs-val"><span class="core-icon small"></span><b class="cy">${gs.cores}</b></span></div>
        <div class="hs-box hs-tower" data-act="tower" title="Upgrade tower"><label>TOWER</label><b class="cy">Lv ${gs.towerLevel}</b></div>
        <div class="hs-box"><label>SKILLS</label><b class="gr">${gs.skills.size}/${SKILL_NODES.length}</b></div>
      </div>`;

    this.setHtml(`
      <div class="home-grid"></div>
      <div class="home-topbar">
        ${returning ? `<div class="home-cores"><span class="core-icon small"></span><b>${gs.cores}</b></div>` : ""}
        <button class="gear trophy" data-act="achievements" title="Achievements (${gs.achievements.size}/${ACHIEVEMENTS.length})">${TROPHY_ICON}</button>
        <button class="gear" data-act="settings" title="Settings">⚙</button>
      </div>
      <div class="home-cols">
        <div class="home-hero">
          <div class="hero-turret">
            <span class="hero-glow"></span>
            <img class="hero-base" src="sprites/turret_base.png" alt="" />
            <img class="hero-gun" src="sprites/turret_gun_1.png" alt="" />
          </div>
          <div class="home-badge">${game.justClearedLevel
            ? `STAGE ${game.justClearedLevel} COMPLETE — CORES BANKED`
            : returning ? "WELCOME BACK, DEFENDER" : "A 360° SURVIVAL DEFENSE"}</div>
          <h1 class="home-title">MECH TIDE</h1>
        </div>
        <div class="home-menu">
          ${strip}
          ${campaignDone ? `
          <button class="menu-btn primary godmode" data-act="godmode">
            <span class="mb-icon">⚡</span>
            <span class="mb-col"><span class="mb-title">GOD MODE</span>
            <span class="mb-sub">Bonus wave · all weapons maxed</span></span>
          </button>
          <button class="menu-btn" data-act="newgame">
            <span class="mb-icon">▸&#xFE0E;</span>
            <span class="mb-col"><span class="mb-title">NEW GAME</span>
            <span class="mb-sub">Restart the campaign from Stage 1</span></span>
          </button>` : `
          <button class="menu-btn primary" data-act="play">
            <span class="mb-icon">▸&#xFE0E;</span>
            <span class="mb-col"><span class="mb-title">${game.justClearedLevel ? "NEXT STAGE" : returning ? "CONTINUE" : "NEW GAME"}</span>
            <span class="mb-sub">${returning ? `${game.justClearedLevel ? "Onward" : "Jump back in"} · Stage ${gs.level} · Wave 1` : "Begin at Stage 1 · Wave 1"}</span></span>
          </button>
          ${gs.wonGame ? `
          <button class="menu-btn godmode" data-act="godmode">
            <span class="mb-icon">⚡</span>
            <span class="mb-col"><span class="mb-title">GOD MODE</span>
            <span class="mb-sub">Bonus wave · jump in any time</span></span>
          </button>` : ""}`}
          <div class="menu-row">
            <button class="menu-btn green" data-act="skills"><span class="mb-icon tree-glyph"></span>
              <span class="mb-col"><span class="mb-title">SKILL TREE</span>
              <span class="mb-sub">${returning ? `${gs.cores} cores ready` : "Spend cores"}</span></span></button>
            <button class="menu-btn" data-act="settings"><span class="mb-icon">⚙</span>
              <span class="mb-col"><span class="mb-title">SETTINGS</span><span class="mb-sub">Sound & more</span></span></button>
          </div>
          ${returning ? "" : `<div class="home-blurb">Defend the core from robots closing in on every side.
            Survive waves, earn coins to spend, and bank permanent Cores for every wave you clear.</div>`}
          <div class="home-credit">A game by Bauman Games</div>
        </div>
      </div>`);

    this.root.querySelector("[data-act=play]")?.addEventListener("click", () => {
      game.show("battle");
      game.battle?.startBattle();
    });
    this.root.querySelector("[data-act=godmode]")?.addEventListener("click", () => {
      game.show("battle");
      game.battle?.startGodMode();
    });
    this.root.querySelector("[data-act=newgame]")?.addEventListener("click", () => {
      game.gs.newGame();          // fresh campaign at Stage 1 (keeps settings + god-mode access)
      game.show("battle");
      game.battle?.startBattle();
    });
    this.root.querySelectorAll("[data-act=skills]").forEach((el) =>
      el.addEventListener("click", () => this.onSkills()));
    this.root.querySelectorAll("[data-act=settings]").forEach((el) =>
      el.addEventListener("click", () => this.onSettings()));
    this.root.querySelector("[data-act=tower]")?.addEventListener("click", () => this.onTower());

    // Tutorials, triggered by which level the player just finished.
    if (game.justClearedLevel === 1) {
      maybeTutorial({
        key: "level1",
        step: 3, total: 5,
        text: "Congrats — you've got the hang of it and cleared <b>Stage 1</b>! Heads up: each new stage resets your coins and field upgrades, but your <b>Tower Level</b> and unlocked <b>Skill Tree</b> items stay with you.",
      });
    } else if (game.justClearedLevel === 2) {
      maybeTutorial({
        key: "level2",
        step: 4, total: 5,
        text: "<b>Cores</b> are your permanent currency — spend them to raise your <b>Tower Level</b> and to unlock new abilities in the <b>Skill Tree</b>.",
        targets: () => [
          this.root.querySelector<HTMLElement>("[data-act=tower]"),
          this.root.querySelector<HTMLElement>("[data-act=skills]"),
        ],
      });
    }
    this.root.querySelector("[data-act=achievements]")?.addEventListener("click", () =>
      this.onAchievements());
  }
}
