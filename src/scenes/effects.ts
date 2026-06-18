/** Transient battle juice — zaps, bursts, damage popups, screen flashes.
 * Everything goes through track() into one layer so startBattle can
 * hard-clear leftovers (manual sys.step driving taught us why: tweens
 * that never tick leave garbage on the field). */

import Phaser from "phaser";
import { game } from "../game";
import { perf } from "../perf";

export class Effects {
  readonly layer: Phaser.GameObjects.Layer;

  constructor(private scene: Phaser.Scene) {
    this.layer = scene.add.layer();
  }

  /** Track a transient object so clear() can sweep it. */
  track<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.layer.add(obj);
    return obj;
  }

  clear(): void {
    this.layer.removeAll(true);
  }

  zap(x1: number, y1: number, x2: number, y2: number, color: number): void {
    const line = this.track(this.scene.add.line(0, 0, x1, y1, x2, y2, color, 0.8))
      .setOrigin(0).setLineWidth(1.5);
    this.scene.tweens.add({ targets: line, alpha: 0, duration: 90, onComplete: () => line.destroy() });
  }

  /** Explosion built entirely from tweened geometry — filled circles on ADD
   * blend, no canvas/particle textures. Texture quads with a soft radial
   * gradient leave a faint dark fringe across the whole quad (straight-alpha
   * RGB the ADD pipeline still sums); harmless per particle but, when a dozen
   * stack on the same point at frame 0, they pile into a visible grey square.
   * Solid circles have no quad and no fringe, so the artifact can't happen. */
  burst(x: number, y: number, n: number): void {
    const big = n > 12; // boss tier
    const rnd = Phaser.Math.FloatBetween;
    const ADD = Phaser.BlendModes.ADD;

    // Central flash — additive so it reads as a hot pop, never a dark disc.
    const flash = this.track(this.scene.add.circle(x, y, big ? 26 : 17, 0xfffce0)).setBlendMode(ADD);
    this.scene.tweens.add({
      targets: flash, scaleX: big ? 4 : 3.2, scaleY: big ? 4 : 3.2, alpha: 0,
      duration: 200, ease: "Power2", onComplete: () => flash.destroy(),
    });

    // Shockwave ring
    const ring = this.track(this.scene.add.graphics());
    const rs = { r: 6, a: 0.72 };
    this.scene.tweens.add({
      targets: rs, r: big ? 80 : 52, a: 0, duration: 420, ease: "Power1",
      onUpdate: () => ring.clear().lineStyle(2.5, 0xff9833, rs.a).strokeCircle(x, y, rs.r),
      onComplete: () => ring.destroy(),
    });

    // Fireball chunks — solid orange circles flying outward, shrinking + fading.
    const fireColors = [0xffe27a, 0xffab33, 0xff6a1a, 0xff3d10];
    // perf.fx thins the additive chunks on devices dropping frames (or reduce-
    // motion); a floor keeps a burst from vanishing entirely.
    const fireN = Math.max(5, Math.round((big ? 18 : 11) * perf.fx));
    for (let i = 0; i < fireN; i++) {
      const ang = (Math.PI * 2 * i) / fireN + rnd(-0.4, 0.4);
      const reach = (big ? 72 : 46) * rnd(0.35, 1);
      const col = fireColors[(Math.random() * fireColors.length) | 0];
      const dot = this.track(this.scene.add.circle(x, y, (big ? 10 : 7) * rnd(0.6, 1.1), col)).setBlendMode(ADD);
      this.scene.tweens.add({
        targets: dot,
        x: x + Math.cos(ang) * reach, y: y + Math.sin(ang) * reach - (big ? 18 : 12),
        scale: 0, alpha: 0, duration: rnd(260, 520), ease: "Power2",
        onComplete: () => dot.destroy(),
      });
    }

    // Sparks — tiny, fast, bright embers shooting straight out.
    const sparkN = Math.max(6, Math.round((big ? 24 : 15) * perf.fx));
    for (let i = 0; i < sparkN; i++) {
      const ang = rnd(0, Math.PI * 2);
      const reach = (big ? 120 : 85) * rnd(0.4, 1);
      const sp = this.track(this.scene.add.circle(x, y, rnd(1.2, 2.6), 0xfff2c4)).setBlendMode(ADD);
      this.scene.tweens.add({
        targets: sp,
        x: x + Math.cos(ang) * reach, y: y + Math.sin(ang) * reach,
        scale: 0.2, alpha: 0, duration: rnd(180, 360), ease: "Power3",
        onComplete: () => sp.destroy(),
      });
    }
  }

  popup(x: number, y: number, text: string, color: string): void {
    const t = this.track(this.scene.add.text(x, y, text, {
      fontFamily: "Chakra Petch", fontSize: "15px", color, stroke: "#04080f", strokeThickness: 3,
    })).setOrigin(0.5);
    this.scene.tweens.add({ targets: t, y: y - 34, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }

  /** Ultimate cast: a hot disc + a crisp wavefront ring that rip outward from
   * (x,y) past every screen corner in a couple frames — a flash that travels,
   * reading as the blast washing over the field. Skipped under reduce-motion /
   * the perf throttle (same as flashScreen — it's pure overdraw + fast motion). */
  shockwave(x: number, y: number, color: number): void {
    if (game.gs.reduceMotion || perf.fx < 1) return;
    const R = (Math.hypot(game.world.w, game.world.h) / 2) * 1.05; // reach past corners
    const ADD = Phaser.BlendModes.ADD;
    // Filled disc — the flash body, additive so it glows; scaled up (cheaper
    // than re-tessellating radius) and faded out as it grows.
    const disc = this.track(this.scene.add.circle(x, y, R, color, 0.3)).setBlendMode(ADD).setScale(0.04);
    this.scene.tweens.add({
      targets: disc, scale: 1, alpha: 0, duration: 200, ease: "Cubic.Out",
      onComplete: () => disc.destroy(),
    });
    // Bright leading ring — a defined purple wavefront on top of the disc.
    const ring = this.track(this.scene.add.graphics());
    const rs = { r: 12, a: 0.95 };
    this.scene.tweens.add({
      targets: rs, r: R, a: 0, duration: 200, ease: "Cubic.Out",
      onUpdate: () => ring.clear().lineStyle(7, color, rs.a).strokeCircle(x, y, rs.r),
      onComplete: () => ring.destroy(),
    });
  }

  flashScreen(color: number, alpha: number): void {
    // Full-screen additive flashes are pure overdraw — skip them under reduce-
    // motion or when the perf throttle has kicked in.
    if (game.gs.reduceMotion || perf.fx < 1) return;
    const r = this.track(this.scene.add.rectangle(
      game.world.w / 2, game.world.h / 2, game.world.w, game.world.h, color, alpha));
    this.scene.tweens.add({ targets: r, alpha: 0, duration: 220, onComplete: () => r.destroy() });
  }

  /** Health / Rapid-Fire pickup flair: the bonus's glow icon blooms at the kill
   * spot and rushes the camera (grows + fades), with a big colored label
   * ("+25 HEALTH" / "RAPID FIRE!") zooming and fading just below it. Reduce-motion
   * gets a calmer, near-static version (no big zoom). */
  dropFlair(x: number, y: number, kind: "heal" | "rapid", label: string): void {
    const reduced = game.gs.reduceMotion;
    const color = kind === "heal" ? "#5cff8f" : "#ffb347";
    const key = kind === "heal" ? "drop_health" : "drop_rapid";

    if (this.scene.textures.exists(key)) {
      const img = this.track(this.scene.add.image(x, y, key));
      const peak = 130 / Math.max(1, img.width); // ~130px across at the peak
      img.setScale(peak * (reduced ? 1 : 0.5)).setAlpha(0.95);
      this.scene.tweens.add({
        targets: img, scale: peak * (reduced ? 1 : 1.7), alpha: 0,
        y: y - (reduced ? 0 : 26),
        duration: reduced ? 520 : 900, ease: "Cubic.Out",
        onComplete: () => img.destroy(),
      });
    }

    const t = this.track(this.scene.add.text(x, y + 46, label, {
      fontFamily: "Chakra Petch", fontSize: "30px", fontStyle: "bold",
      color, stroke: "#04101c", strokeThickness: 5,
    })).setOrigin(0.5).setScale(reduced ? 1 : 0.6);
    this.scene.tweens.add({
      targets: t, scale: reduced ? 1 : 1.4, y: (y + 46) - (reduced ? 24 : 64), alpha: 0,
      duration: reduced ? 620 : 950, ease: "Cubic.Out",
      onComplete: () => t.destroy(),
    });
  }
}
