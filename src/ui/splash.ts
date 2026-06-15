/** Boot splash — full-bleed art + a CSS "MECH TIDE" title (scales to any aspect)
 * + loading dots. Shown from first paint (it's static in index.html) until the
 * battle scene's assets are ready (BattleScene.create calls dismissSplash). A
 * minimum on-screen time keeps it from flashing on instant/cached loads, and a
 * hard timeout means a hang never strands the player on it. */

const START = performance.now();
let done = false;

export function dismissSplash(): void {
  if (done) return;
  done = true;
  const el = document.getElementById("splash");
  if (!el) return;
  const wait = Math.max(0, 500 - (performance.now() - START)); // min visible ~0.5s
  window.setTimeout(() => {
    el.classList.add("gone");                       // fade (CSS transition)
    window.setTimeout(() => el.remove(), 500);
  }, wait);
}

// Safety net: never trap the player on the splash if the scene never readies.
window.setTimeout(dismissSplash, 9000);
