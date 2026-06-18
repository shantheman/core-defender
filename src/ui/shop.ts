/** The Upgrades store — real HTML/CSS per docs/design/panels.jsx. Content and
 * prices come from GameState (the original app's values); the mock supplies
 * only the look. Opens between waves ("cleared") or on Tab ("paused"). */

import * as C from "../config";
import { game, isTouch } from "../game";
import { play } from "../audio";
import { waveInLevel, wavesForLevel } from "../sim/waves";
import { esc } from "./html";
import { Category, ITEM_ART, catIcon } from "./icons";
import { towerBannerHtml } from "./towerBanner";
import { maybeTutorial } from "./tutorial";
import { Panel } from "./panel";

interface CardSpec {
  key: string;
  name: string;
  desc: string;
  cost: number | null;          // null -> owned/used (green check)
  state: "buy" | "poor" | "owned" | "equipped";
  stateLabel?: string;          // green-check text override (e.g. "USED")
  cat: Category;                // which cluster it renders under (v3 layout)
  onBuy?: () => boolean;
}

export class ShopPanel extends Panel {
  onSettings: (() => void) | null = null; // wired in main.ts -> opens the Settings modal
  constructor(parent: HTMLElement) {
    super(parent, "shop", "shop");
  }

  private fieldCards(): CardSpec[] {
    const gs = game.gs;
    const m = gs.money;
    const cards: CardSpec[] = [
      {
        key: "gen", cat: "ECONOMY", name: "Generator",
        desc: `Lv ${gs.genLevel} · +${Math.round(C.GEN_INCOME * (gs.genLevel + 1))} coins/sec`,
        cost: gs.genCost(), state: m >= gs.genCost() ? "buy" : "poor",
        onBuy: () => gs.tryBuyGen(),
      },
      {
        key: "auto", cat: "CANNON", name: "Auto-Laser",
        desc: gs.autoLevel === 0
          ? "Auto-fires at close-in enemies"
          : `Lv ${gs.autoLevel}/${C.AUTO_MAX_LEVEL} · fires faster`,
        cost: gs.autoLevel >= C.AUTO_MAX_LEVEL ? null : gs.autoCost(),
        state: gs.autoLevel >= C.AUTO_MAX_LEVEL ? "owned" : m >= gs.autoCost() ? "buy" : "poor",
        stateLabel: "MAXED",
        onBuy: () => gs.tryBuyAuto(),
      },
      {
        key: "turret", cat: "CANNON", name: "Main Turret",
        desc: `Lv ${gs.turretLevel} · more damage, fire rate & size`,
        cost: gs.turretCost(), state: m >= gs.turretCost() ? "buy" : "poor",
        onBuy: () => gs.tryBuyTurret(),
      },
      {
        key: "drone", cat: "DRONE", name: "Drone",
        desc: gs.droneLevel === 0 ? "Flies out to hunt enemies" : `Lv ${gs.droneLevel} · more damage, range & fire rate`,
        cost: gs.droneCost(), state: m >= gs.droneCost() ? "buy" : "poor",
        onBuy: () => gs.tryBuyDrone(),
      },
    ];
    if (gs.skills.has("multi")) cards.push({
      key: "multi", cat: "CANNON", name: "Multi-Shot", desc: `Lv ${gs.multiLevel} · +1 bullet per level`,
      cost: gs.multiCost(), state: m >= gs.multiCost() ? "buy" : "poor",
      onBuy: () => gs.tryBuyMulti(),
    });
    if (gs.skills.has("pierce")) cards.push({
      key: "pierce", cat: "CANNON", name: "Piercing", desc: `Lv ${gs.pierceLevel} · shots pass through enemies`,
      cost: gs.pierceCost(), state: m >= gs.pierceCost() ? "buy" : "poor",
      onBuy: () => gs.tryBuyPierce(),
    });
    if (gs.skills.has("explosive")) cards.push({
      key: "explosive", cat: "CANNON", name: "Explosive",
      desc: `Lv ${gs.explosiveLevel} · ${C.EXPLOSIVE_SPLASH_DMG + C.EXPLOSIVE_SPLASH_PER_LEVEL * Math.max(0, gs.explosiveLevel - 1)} splash damage, ${C.EXPLOSIVE_RADIUS_BASE + C.EXPLOSIVE_RADIUS_PER_LEVEL * Math.max(0, gs.explosiveLevel - 1)} radius`,
      cost: gs.explosiveCost(), state: m >= gs.explosiveCost() ? "buy" : "poor",
      onBuy: () => gs.tryBuyExplosive(),
    });
    if (gs.skills.has("twin")) cards.push({
      key: "twin", cat: "DRONE", name: "Twin Targeting",
      desc: "Drone hits 2 enemies at once",
      cost: gs.twinOwned ? null : C.TWIN_COST,
      state: gs.twinOwned ? "owned" : m >= C.TWIN_COST ? "buy" : "poor",
      onBuy: () => gs.tryBuyTwin(),
    });
    if (gs.skills.has("interceptor")) cards.push({
      key: "interceptor", cat: "DRONE", name: "Interceptor",
      desc: "Drone shoots down enemy fire",
      cost: gs.interceptorOwned ? null : C.INTERCEPTOR_COST,
      state: gs.interceptorOwned ? "owned" : m >= C.INTERCEPTOR_COST ? "buy" : "poor",
      onBuy: () => gs.tryBuyInterceptor(),
    });
    if (gs.skills.has("medic")) cards.push({
      key: "medic", cat: "DRONE", name: "Field Medic",
      desc: `Drone heals the tower +${C.MEDIC_HPS} HP/sec when idle`,
      cost: gs.medicOwned ? null : C.MEDIC_COST,
      state: gs.medicOwned ? "owned" : m >= C.MEDIC_COST ? "buy" : "poor",
      onBuy: () => gs.tryBuyMedic(),
    });
    if (gs.skills.has("guided")) cards.push({
      key: "guided", cat: "CANNON", name: "Guided", desc: "Shots curve toward enemies",
      cost: gs.guidedOwned ? null : C.GUIDED_COST,
      state: gs.guidedOwned ? "owned" : m >= C.GUIDED_COST ? "buy" : "poor",
      onBuy: () => gs.tryBuyGuided(),
    });
    // Repair + Plating are limited per level (v2 balance: stacking them made
    // the tower unkillable). Spent cards show a green "USED".
    const per = (max: number) => max === 1 ? "once per stage" : `${max}× per stage`;
    if (gs.skills.has("repair")) {
      const used = gs.repairBuys >= C.REPAIR_MAX_BUYS;
      const hurt = gs.hp < gs.maxHp();
      cards.push({
        key: "repair", cat: "DEFENSE", name: "Repair",
        desc: `+${C.REPAIR_HP} HP · ${per(C.REPAIR_MAX_BUYS)}`,
        cost: used ? null : gs.repairCost(),
        state: used ? "owned" : hurt && m >= gs.repairCost() ? "buy" : "poor",
        stateLabel: "USED",
        onBuy: () => gs.tryBuyRepair(),
      });
    }
    if (gs.skills.has("plating")) {
      const used = gs.platingBuys >= C.PLATING_MAX_BUYS;
      cards.push({
        key: "plating", cat: "DEFENSE", name: "Plating",
        desc: `+${C.PLATING_HP} max HP · ${per(C.PLATING_MAX_BUYS)}`,
        cost: used ? null : gs.platingCost(),
        state: used ? "owned" : m >= gs.platingCost() ? "buy" : "poor",
        stateLabel: "USED",
        onBuy: () => gs.tryBuyPlating(),
      });
    }
    if (gs.skills.has("shield")) cards.push({
      key: "shield", cat: "DEFENSE", name: "Shield",
      desc: gs.shieldLevel === 0
        ? `${C.SHIELD_BASE_HITS} layers, absorbs ${C.SHIELD_HIT_ABSORB} damage each`
        : `Lv ${gs.shieldLevel} · +1 layer`,
      cost: gs.shieldCost(), state: m >= gs.shieldCost() ? "buy" : "poor",
      onBuy: () => gs.tryBuyShield(),
    });
    return cards;
  }

  private ultimateCards(): CardSpec[] {
    const gs = game.gs;
    return (["emp", "freeze", "warp", "laser"] as C.UltimateKey[])
      .filter((k) => gs.skills.has(k))
      .map((k) => {
        const owned = gs.ultimatesOwned.has(k);
        const equipped = gs.equippedUltimate === k;
        const cost = C.ULTIMATE_COSTS[k];
        return {
          key: k, cat: "ULTIMATES" as Category, name: C.ULTIMATE_NAMES[k],
          desc: { emp: "Zap + stun everything", freeze: "Freezes all enemies", warp: "Slow-motion for enemies", laser: "The mega-beam" }[k],
          cost: owned ? null : cost,
          state: equipped ? "equipped" as const : owned ? "owned" as const
            : gs.money >= cost ? "buy" as const : "poor" as const,
          onBuy: () => owned ? gs.equipUltimate(k) : gs.tryBuyUltimate(k),
        };
      });
  }

  private card(it: CardSpec): string {
    const priceOrState = it.cost === null || it.state === "equipped"
      ? `<div class="card-state">✓ ${it.stateLabel ?? (it.state === "equipped" ? "EQUIPPED" : "OWNED")}</div>`
      : `<div class="card-price ${it.state === "poor" ? "poor" : ""}">
           <span class="coin-icon ${it.state === "poor" ? "dim" : ""}"></span>
           ${it.cost!.toLocaleString("en-US")}
         </div>`;
    const art = ITEM_ART[it.key];
    return `<button class="store-card ${it.state}" data-key="${it.key}" data-sfx="none">
      ${art ? `<img class="card-art" src="${art}" alt="" draggable="false" /><span class="card-scrim"></span>` : ""}
      <span class="card-name">${esc(it.name)}</span>
      <span class="card-desc">${esc(it.desc)}</span>
      ${priceOrState}
    </button>`;
  }

  render(): void {
    const gs = game.gs;
    const cleared = game.shopMode === "cleared";
    const wil = waveInLevel(gs.wave);
    const total = wavesForLevel(gs.level);
    const ults = this.ultimateCards();

    this.setHtml(`
      <button class="gear panel-gear" data-act="settings" title="Settings" aria-label="Settings">&#9881;</button>
      <div class="panel-scroll">
      <header class="panel-head">
        <div class="panel-title-group">
          <h1>UPGRADES</h1>
          <span class="panel-status ${cleared ? "ok" : ""}">${cleared ? "✓ WAVE CLEARED" : "❚❚ BATTLE PAUSED"}</span>
        </div>
      </header>

      ${towerBannerHtml()}

      <div class="section-head field"><span class="sh-label">FIELD UPGRADES</span>
        <span class="sh-note">↺ reset at end of stage</span><span class="sh-rule"></span></div>
      ${(["ECONOMY", "CANNON", "DEFENSE", "DRONE"] as Category[]).map((cat) => {
        const items = this.fieldCards().filter((c) => c.cat === cat);
        if (!items.length) return "";
        return `<div class="cluster">
          <div class="cluster-head">${catIcon(cat)}<span>${cat}</span><i class="cluster-rule"></i></div>
          <div class="card-grid">${items.map((c) => this.card(c)).join("")}</div>
        </div>`;
      }).join("")}

      ${ults.length === 0 ? "" : `
      <div class="section-head ult"><span class="sh-label">ULTIMATES</span>
        <span class="sh-note">${isTouch()
          ? "own many · tap to equip · reset at end of stage"
          : "own many · click to equip · [Space] fires it · reset at end of stage"}</span><span class="sh-rule"></span></div>
      <div class="card-grid ult">${ults.map((c) => this.card(c)).join("")}</div>`}
      </div>

      <footer class="panel-foot">
        <div class="foot-bal"><label>BALANCE</label>
          <span class="fb-val"><span class="coin-icon"></span><b>${Math.floor(gs.money).toLocaleString("en-US")}</b></span></div>
        ${cleared
        ? `<button class="cta startwave" data-act="next">
             <span class="cta-col"><span class="cta-big">START NEXT WAVE</span>
             <span class="cta-sub2">Wave ${Math.min(wil + 1, total)} of ${total}${isTouch() ? "" : " · [Space]"}</span></span>
           </button>`
        : `<button class="cta startwave" data-act="close">
             <span class="cta-col"><span class="cta-big">RESUME BATTLE</span>
             <span class="cta-sub2">Wave ${wil} of ${total}${isTouch() ? "" : " · [Tab / Esc]"}</span></span>
           </button>`}
      </footer>`);

    // Wire clicks
    const all = [...this.fieldCards(), ...this.ultimateCards()];
    this.root.querySelectorAll<HTMLButtonElement>(".store-card").forEach((el) => {
      el.addEventListener("click", () => {
        const spec = all.find((c) => c.key === el.dataset.key);
        if (spec?.onBuy?.()) { play("upgrade"); this.ping(el); this.render(); }
      });
    });
    this.root.querySelector<HTMLButtonElement>("[data-act=towerup]")?.addEventListener("click", (ev) => {
      if (game.gs.tryBuyTowerUpgrade()) { play("upgrade"); this.ping(ev.currentTarget as HTMLElement); this.render(); }
    });
    this.root.querySelector("[data-act=next]")?.addEventListener("click", () => this.startNext());
    this.root.querySelector("[data-act=close]")?.addEventListener("click", () => this.close());
    this.root.querySelector("[data-act=settings]")?.addEventListener("click", () => this.onSettings?.());

    // Tutorial: first time the shop opens after clearing wave 1 of level 1,
    // point new players at the Coin Generator.
    if (cleared && game.gs.level === 1) {
      // First cleared-shop visit: a centered intro to the shop. The Generator
      // nudge waits until the intro's been seen AND the player can actually
      // afford the Generator — so the "great first purchase" tip only ever fires
      // when it's true (no more "you don't have enough yet" caveat on it).
      if (!game.gs.hasSeenTut("shop-intro")) {
        const intro = "This is the <b>Upgrade Shop</b> — you land here after clearing each wave. Spend your coins to power up your tower, then hit <b>Start Next Wave</b> when you're ready.";
        maybeTutorial({
          key: "shop-intro",
          step: 1, total: 4,
          text: game.gs.money < game.gs.genCost()
            ? `${intro} You don't have enough coins to buy anything yet — but you will soon!`
            : intro,
        });
      } else if (game.gs.money >= game.gs.genCost()) {
        maybeTutorial({
          key: "generator",
          step: 2, total: 4,
          text: "The <b>Coin Generator</b> is a great first purchase: it speeds up how fast you collect coins.",
          targets: () => [this.root.querySelector<HTMLElement>('[data-key="gen"]')],
        });
      }
    }
  }

  /** Purchase confirmation: clone the picked card's blue border as an overlay
   * that scales up and fades. Lives in <body> (fixed at the card's rect) so the
   * panel's re-render can't kill it mid-animation. Skipped under reduce-motion. */
  private ping(el: HTMLElement): void {
    if (game.gs.reduceMotion) return;
    const r = el.getBoundingClientRect();
    const p = document.createElement("div");
    p.className = "card-ping";
    p.style.left = `${r.left}px`;
    p.style.top = `${r.top}px`;
    p.style.width = `${r.width}px`;
    p.style.height = `${r.height}px`;
    p.style.borderRadius = getComputedStyle(el).borderRadius;
    document.body.appendChild(p);
    p.addEventListener("animationend", () => p.remove());
  }

  startNext(): void {
    if (game.shopMode !== "cleared") return;
    game.show("battle");
    game.battle?.nextWave();
  }

  close(): void {
    if (game.shopMode !== "paused") return;
    game.show("battle");
    game.battle?.resumeWave();
  }
}
