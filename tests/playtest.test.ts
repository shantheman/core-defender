/** Headless playtest report + balance regression guard.
 *
 *   npm run playtest      → prints the full per-stage table.
 *   npm test              → runs the coarse regression asserts (quiet).
 *
 * The table shows, per reference player, the HP% left after clearing each stage
 * (or ✗<wave> where they died). See tools/playtest/engine.ts for the model and
 * tools/playtest/profiles.ts for the levers (aim + economy efficiency). */

import { describe, expect, it } from "vitest";
import { MAX_STAGE, REFERENCE_PLAYERS, runCampaign, type CampaignResult } from "../tools/playtest/engine";
import { runExperiments } from "../tools/playtest/experiments";

const ENV = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

const SEED = 12345;
const results: CampaignResult[] = REFERENCE_PLAYERS.map((p) => runCampaign(p, SEED));
const by = (name: string) => results.find((r) => r.profile === name)!;

function summary(r: CampaignResult): string {
  const head = r.won ? "WON 🏆" : `died Stage ${r.deathStage} (wave ${r.deathWaveInLevel})`;
  const death = r.stages.find((s) => !s.cleared);
  const why = death ? `  [${death.reason}] ${death.loadout ?? ""}` : "";
  return `${r.profile.padEnd(26)} ${head.padEnd(26)} cores:${String(r.finalCores).padStart(4)} tower:${String(r.finalTowerLevel).padStart(2)} skills:${r.skills}/14${why}`;
}

function table(): string {
  const head = "Stage".padEnd(26) + Array.from({ length: MAX_STAGE }, (_, i) => String(i + 1).padStart(4)).join("");
  const rows = results.map((r) => {
    const cells = Array.from({ length: MAX_STAGE }, (_, i) => {
      const stage = i + 1;
      const s = r.stages.find((x) => x.stage === stage);
      if (s?.cleared) return String(Math.round(s.hpPct)).padStart(4);
      if (s && !s.cleared) return ("x" + s.deathWaveInLevel).padStart(4);
      return "   ·";
    }).join("");
    return r.profile.padEnd(26) + cells;
  });
  return [head, ...rows].join("\n");
}

if (ENV.PLAYTEST_EXPERIMENTS) runExperiments();

if (ENV.PLAYTEST_REPORT) {
  // eslint-disable-next-line no-console
  console.log(
    `\nMECH TIDE — reference-player survivability (seed ${SEED})\n` +
    `cells = HP% left after clearing each stage; x<n> = died at wave n of that stage\n\n` +
    table() + "\n\n" + results.map(summary).join("\n") + "\n",
  );
}

// Bounds are coarse on purpose: they guard the SHAPE of the balance curve (the
// levers matter; the late campaign is a wall) without being brittle to tuning.
// If a deliberate balance change shifts these, update the numbers + CHANGELOG.
describe("playtest harness", () => {
  it("is deterministic for a fixed seed", () => {
    const a = runCampaign(REFERENCE_PLAYERS[0], 999);
    const b = runCampaign(REFERENCE_PLAYERS[0], 999);
    expect(a.reachedStage).toBe(b.reachedStage);
    expect(a.finalCores).toBe(b.finalCores);
  });

  it("economy efficiency matters: a decent spend out-reaches a poor spend at equal aim", () => {
    expect(by("Average · Average").reachedStage).toBeGreaterThan(by("Average · Poor").reachedStage);
  });

  it("aim matters: better aim reaches at least as far at equal economy", () => {
    expect(by("Average · Average").reachedStage).toBeGreaterThanOrEqual(by("Casual · Average").reachedStage);
    expect(by("Pro · Optimal").reachedStage).toBeGreaterThanOrEqual(by("Good · Optimal").reachedStage - 1);
  });

  it("the skill-tree grind gates progress: a blind first run walls far earlier than a geared player", () => {
    expect(by("Pro · Optimal (blind 1st run)").reachedStage).toBeLessThan(by("Pro · Optimal").reachedStage - 4);
  });

  it("a geared, accurate, optimal player pushes deep into the campaign", () => {
    expect(by("Pro · Optimal").reachedStage).toBeGreaterThanOrEqual(9);
  });

  it("FINDING: the late bosses are a wall — no reference player wins (flag if a buff flips this)", () => {
    expect(results.every((r) => !r.won)).toBe(true);
  });
});
