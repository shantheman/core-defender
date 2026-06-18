/** "YOU WON" — the campaign finale, shown after clearing the final stage's boss
 * (BattleScene.waveCleared). Streaming confetti, a credits card, and a purple
 * button into the bonus god-mode wave (the same wave the Home button offers once
 * you've won). HOME drops back to the menu. */

import { game } from "../game";
import * as C from "../config";
import { Panel } from "./panel";

const CONFETTI_COLORS = ["#46e39a", "#ff5238", "#ffc94a", "#7fe8ff", "#b15cff", "#ffffff", "#ff9341"];

export class WonPanel extends Panel {
  constructor(parent: HTMLElement) {
    super(parent, "won", "won", "panel-screen won");
  }

  /** A field of confetti pieces with randomized colour/size/timing/drift; the CSS
   * animation streams them down forever. */
  private confetti(): string {
    if (game.gs.reduceMotion) return ""; // streaming confetti is exactly what reduce-motion should kill
    let s = "";
    for (let i = 0; i < 60; i++) {
      const left = Math.round(Math.random() * 100);
      const color = CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0];
      const delay = (Math.random() * 6).toFixed(2);
      const dur = (3.5 + Math.random() * 3.5).toFixed(2);
      const size = (5 + Math.random() * 6).toFixed(1);
      const round = Math.random() < 0.4 ? "border-radius:50%;" : "";
      const drift = Math.round(Math.random() * 60 - 30);
      s += `<i class="confetti" style="left:${left}%;width:${size}px;height:${size}px;`
        + `background:${color};${round}animation-delay:${delay}s;animation-duration:${dur}s;--drift:${drift}px;"></i>`;
    }
    return s;
  }

  render(): void {
    this.setHtml(`
      <div class="confetti-layer" aria-hidden="true">${this.confetti()}</div>
      <div class="won-wrap">
        <div class="won-eyebrow">TOWER DEFENDED</div>
        <h1 class="won-title">YOU WON!</h1>
        <div class="won-sub">You survived all ${C.FINAL_STAGE} stages and saved the Core.</div>

        <div class="won-credits">
          <div class="wc-head">CREDITS</div>
          <div class="wc-row"><span class="wc-label">STUDIO</span><span class="wc-val gold">Bauman Games</span></div>
          <div class="wc-row"><span class="wc-label">GAME DESIGNER</span><span class="wc-val">Callum Bauman</span></div>
          <div class="wc-row"><span class="wc-label">DEVELOPERS</span><span class="wc-val">Callum Bauman · Shannon Bauman</span></div>
          <div class="wc-row"><span class="wc-label">SOUND DESIGNER</span><span class="wc-val">Corey Bauman</span></div>
        </div>

        <div class="won-btns">
          <button class="cta godmode" data-act="godmode">
            <span class="cta-col"><span class="cta-big">⚡ BONUS WAVE</span>
            <span class="cta-sub2">God mode · all weapons maxed</span></span>
          </button>
          <button class="ghost-btn" data-act="home">HOME</button>
        </div>
      </div>`);

    this.root.querySelector("[data-act=godmode]")?.addEventListener("click", () => {
      game.show("battle");
      game.battle?.startGodMode();
    });
    this.root.querySelector("[data-act=home]")?.addEventListener("click", () => game.show("home"));
  }
}
