/** DOM HUD updater — the battle scene calls this every frame with its state.
 * All chrome is real HTML/CSS (see index.html + styles.css); this file only
 * moves numbers and toggles classes. */

import type { HudState } from "../scenes/BattleScene";
import { EMP_COOLDOWN, FREEZE_COOLDOWN, LASER_COOLDOWN, WARP_COOLDOWN, GODMODE_ULT_COOLDOWN } from "../config";
import { game, isTouch } from "../game";
import { ULT_ICONS } from "./icons";
import { isBossWave, levelStartWave } from "../sim/waves";

const ULT_CD_TOTAL: Record<string, number> = {
  emp: EMP_COOLDOWN, freeze: FREEZE_COOLDOWN, warp: WARP_COOLDOWN, laser: LASER_COOLDOWN,
  all: GODMODE_ULT_COOLDOWN,
};
let shownUltKey: string | null = null;

const $ = (id: string) => document.getElementById(id)!;

let lastShown = { level: -1, wave: -1, money: -1, cores: -1, hp: -1, count: -1 };

/** Drain sim announcements (achievement unlocks) into sliding toasts. */
function drainToasts(): void {
  const ev = game.gs.events;
  while (ev.length) {
    const e = ev.shift()!;
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = e.text;
    document.getElementById("toasts")!.appendChild(t);
    setTimeout(() => t.classList.add("out"), 2600);
    setTimeout(() => t.remove(), 3100);
  }
}

export function updateHud(s: HudState): void {
  drainToasts();
  if (s.level !== lastShown.level) {
    $("hud-level").textContent = String(s.level);
    lastShown.level = s.level;
  }
  const waveText = s.waveInLevel * 1000 + s.wavesInLevel;
  if (waveText !== lastShown.wave) {
    $("hud-wave").textContent = `${s.waveInLevel}/${s.wavesInLevel}`;
    lastShown.wave = waveText;
  }
  if (s.money !== lastShown.money) {
    $("hud-money").textContent = String(Math.floor(s.money));
    lastShown.money = s.money;
  }
  if (s.cores !== lastShown.cores) {
    $("hud-cores").textContent = String(s.cores);
    lastShown.cores = s.cores;
  }
  if (s.hp !== lastShown.hp) {
    const fill = $("hud-hp");
    fill.style.width = `${(100 * s.hp) / s.maxHp}%`;
    fill.classList.toggle("low", s.hp / s.maxHp <= 0.35);
    $("hud-hp-text").textContent = `${Math.max(0, Math.ceil(s.hp))} / ${s.maxHp}`;
    lastShown.hp = s.hp;
  }

  // Status chips: shield layers, equipped ultimate, combo, rapid fire.
  const chip = (id: string, show: boolean, html?: string) => {
    const el = $(id);
    el.classList.toggle("hidden", !show);
    if (show && html !== undefined && el.innerHTML !== html) el.innerHTML = html;
  };
  chip("st-shield", s.shield > 0, `SHIELD <b>${s.shield}</b>`);
  const wrap = $("ult-wrap");
  if (s.ultimate) {
    const u = s.ultimate;
    wrap.classList.remove("hidden", "empty");
    if (shownUltKey !== u.key) {
      shownUltKey = u.key;
      $("ult-name").textContent = u.name.toUpperCase();
      // Monochrome glyphs, deliberately — the painterly art was tried and
      // reverted (2026-06-11): a fire button needs instant read, and the art
      // only worked muted into wallpaper. Painterly stays in store/tree.
      $("ult-icon").innerHTML = ULT_ICONS[u.key] ?? "";
    }
    const stateText = u.ready ? "FIRE" : `${Math.ceil(u.cooldown)}s`;
    const st = $("ult-state");
    if (st.textContent !== stateText) st.textContent = stateText;
    const circle = $("st-ult");
    circle.classList.toggle("cooling", !u.ready);
    const frac = u.ready ? 1 : 1 - u.cooldown / (ULT_CD_TOTAL[u.key] ?? 10);
    circle.style.setProperty("--cd", String(Math.max(0, Math.min(1, frac))));
  } else {
    shownUltKey = null;
    // Touch: reserve the slot with an empty "NONE" orb so the corner layout
    // never shifts when an ultimate becomes available mid-run. Desktop hides it.
    if (isTouch()) {
      wrap.classList.remove("hidden");
      wrap.classList.add("empty");
      $("ult-name").textContent = "ULTIMATE";
      $("ult-state").textContent = "NONE";
      $("ult-icon").innerHTML = "";
      $("st-ult").classList.remove("cooling");
    } else {
      wrap.classList.add("hidden");
    }
  }
  chip("st-combo", s.combo >= 3,
    `COMBO x<b>${s.combo}</b> · +${Math.round((s.comboMult - 1) * 100)}% coins`);
  chip("st-rapid", s.rapid);

  // Wave-intro countdown overlay
  const intro = $("wave-intro");
  if (s.intermission > 0) {
    intro.classList.remove("hidden");
    $("wi-level").textContent = `STAGE ${s.level}`;
    const globalWave = levelStartWave(s.level) + s.waveInLevel - 1;
    const boss = isBossWave(globalWave);
    const waveEl = $("wi-wave");
    waveEl.textContent = boss ? "BOSS WAVE" : `WAVE ${s.waveInLevel}`;
    waveEl.classList.toggle("boss", boss);
    const count = Math.max(1, Math.ceil(s.intermission));
    if (count !== lastShown.count) {
      $("wi-count").textContent = String(count);
      lastShown.count = count;
    }
  } else {
    intro.classList.add("hidden");
  }

  // God-mode bonus wave: hide the shop/skill controls (CSS keys off #hud.god-mode)
  // and show the big centered countdown to the end of the 20s onslaught.
  $("hud").classList.toggle("god-mode", s.godMode);
  const gc = $("god-countdown");
  if (s.godMode) {
    gc.classList.remove("hidden");
    const secs = Math.max(0, Math.ceil(s.godTimer));
    if (gc.textContent !== String(secs)) gc.textContent = String(secs);
    gc.classList.toggle("urgent", secs <= 5);
  } else {
    gc.classList.add("hidden");
  }
}
