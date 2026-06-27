/** Settings modal — sound toggle, volume slider, reduce-motion, fullscreen.
 * Same options as the original game's panel (plus the version + credits
 * footer). Opens over Home or as the in-battle pause menu's settings. */

import { game, isTouch, applyHanded } from "../game";
import { SAVE_KEY } from "../sim/state";
import { clearSaveMirror } from "../native";
import { setMusicVolume } from "../music";
import { GAME_VERSION } from "../version";

export class SettingsModal {
  private root: HTMLElement;
  /** Assigned by main.ts — e.g. resume the battle when the modal closes. */
  onClose: () => void = () => {};

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.id = "settings";
    this.root.className = "modal-dim hidden";
    parent.appendChild(this.root);
    this.root.addEventListener("click", (ev) => {
      if (ev.target === this.root) this.hide();
    });
  }

  show(): void { this.render(); this.root.classList.remove("hidden"); }
  hide(): void {
    this.root.classList.add("hidden");
    game.gs.save();
    this.onClose();
  }
  get visible(): boolean { return !this.root.classList.contains("hidden"); }

  private row(label: string, control: string): string {
    return `<div class="set-row"><span class="set-label">${label}</span>${control}</div>`;
  }

  render(): void {
    const gs = game.gs;
    const toggle = (key: string, on: boolean) =>
      `<button class="set-toggle ${on ? "on" : ""}" data-key="${key}">${on ? "ON" : "OFF"}</button>`;
    this.root.innerHTML = `
      <div class="modal-card">
        <header><span class="modal-title">SETTINGS</span><button class="modal-x" data-act="close">✕</button></header>
        ${this.row("Sound", `<span class="set-slider"><input type="range" min="0" max="100" value="${Math.round(gs.volume * 100)}" data-key="volume" />
          <b id="vol-pct">${Math.round(gs.volume * 100)}%</b></span>`)}
        ${this.row("Music", `<span class="set-slider"><input type="range" min="0" max="100" value="${Math.round(gs.musicVolume * 100)}" data-key="music" />
          <b id="music-pct">${Math.round(gs.musicVolume * 100)}%</b></span>`)}
        ${this.row("Reduce motion (no shake)", toggle("motion", gs.reduceMotion))}
        ${isTouch() ? this.row("Joystick side", `<span class="set-seg">
          <button class="set-toggle ${gs.handed === "left" ? "on" : ""}" data-key="handL">LEFT</button>
          <button class="set-toggle ${gs.handed === "right" ? "on" : ""}" data-key="handR">RIGHT</button></span>`) : ""}
        ${this.row("Reset progress", `<button class="set-toggle danger" data-key="reset">RESET</button>`)}
        <footer class="modal-foot">
          <span>v${GAME_VERSION} © 2026 Callum Bauman / Bauman Games.</span>
        </footer>
      </div>`;

    this.root.querySelectorAll<HTMLButtonElement>(".set-toggle").forEach((el) => {
      el.addEventListener("click", () => {
        const k = el.dataset.key;
        if (k === "motion") gs.reduceMotion = !gs.reduceMotion;
        else if (k === "handL") { gs.handed = "left"; applyHanded(); }
        else if (k === "handR") { gs.handed = "right"; applyHanded(); }
        else if (k === "reset") {
          if (el.textContent === "SURE?") {
            localStorage.removeItem(SAVE_KEY);
            clearSaveMirror(); // wipe the native mirror too, or reconcile would restore it
            location.reload();
          } else {
            el.textContent = "SURE?"; // second tap confirms
          }
          return;
        }
        gs.save();
        this.render();
      });
    });
    const slider = this.root.querySelector<HTMLInputElement>("input[data-key=volume]");
    slider?.addEventListener("input", () => {
      gs.volume = Number(slider.value) / 100;
      this.root.querySelector("#vol-pct")!.textContent = `${slider.value}%`;
    });
    slider?.addEventListener("change", () => gs.save());
    const music = this.root.querySelector<HTMLInputElement>("input[data-key=music]");
    music?.addEventListener("input", () => {
      setMusicVolume(Number(music.value) / 100); // updates gs + the live track
      this.root.querySelector("#music-pct")!.textContent = `${music.value}%`;
    });
    music?.addEventListener("change", () => gs.save());
    this.root.querySelector("[data-act=close]")?.addEventListener("click", () => this.hide());
  }
}
