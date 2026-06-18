/** Balance sweep: A/B candidate tweaks against the reference players, averaged
 * over many seeds, to find the lightest touch that lets a *Good · Optimal*
 * player finish stage 15 without trivializing the early-mid game.
 *
 * Run via:  npm run playtest:balance
 * Nothing here ships — it patches the sim's Balance object, never the real game.
 * Edit CANDIDATES to try your own combos. */

import { aggregate, BASE_BALANCE, type Balance } from "./engine";
import { AIM, ECON, type PlayerProfile } from "./profiles";

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// The players we care about: the target (Good · Optimal must reach 15), the
// ceiling (Pro), and a guard rail (Average · Average shouldn't also rocket to 15
// — that would mean we over-buffed and flattened the difficulty curve).
const PROFILES: PlayerProfile[] = [
  { name: "Pro·Optimal", aim: AIM.pro, econ: ECON.optimal, pretrained: true },
  { name: "Good·Optimal", aim: AIM.good, econ: ECON.optimal, pretrained: true },
  { name: "Avg·Average", aim: AIM.average, econ: ECON.average, pretrained: true },
];

const B = (p: Partial<Balance>): Balance => ({ ...BASE_BALANCE, ...p });

const CANDIDATES: { name: string; bal: Balance }[] = [
  { name: "baseline (live v0.12.2)", bal: B({}) },
  // --- single levers ---
  { name: "Callum: auto cap 5→12", bal: B({ autoMaxLevel: 12 }) },
  { name: "startCash 30→90 /tower lvl", bal: B({ startCashPerLevel: 90 }) },
  { name: "turret +6 dmg per tower lvl", bal: B({ turretBonusPerTower: 6 }) },
  { name: "boss/heavy HP ramp .12→.09", bal: B({ heavyHpRamp: 0.09 }) },
  { name: "boss crash .9→.5 of maxHP", bal: B({ bossCrashFrac: 0.5 }) },
  { name: "boss covering fire 4→2 /lvl", bal: B({ bossFireDmgPerLevel: 2 }) },
  // --- combos (lightest-touch first) ---
  { name: "C1 turret+4 & crash.6", bal: B({ turretBonusPerTower: 4, bossCrashFrac: 0.6 }) },
  { name: "C2 turret+6 & crash.6 & covfire3", bal: B({ turretBonusPerTower: 6, bossCrashFrac: 0.6, bossFireDmgPerLevel: 3 }) },
  { name: "C3 startCash70 & HPramp.10 & crash.6", bal: B({ startCashPerLevel: 70, heavyHpRamp: 0.10, bossCrashFrac: 0.6 }) },
  { name: "C4 turret+5 & autoCap10 & covfire3", bal: B({ turretBonusPerTower: 5, autoMaxLevel: 10, bossFireDmgPerLevel: 3 }) },
];

export function runExperiments(): void {
  const rows: string[] = [];
  rows.push("candidate".padEnd(36) + PROFILES.map((p) => p.name.padStart(16)).join(""));
  rows.push("".padEnd(36) + PROFILES.map(() => "mean (win%)".padStart(16)).join(""));
  for (const c of CANDIDATES) {
    let row = c.name.padEnd(36);
    for (const p of PROFILES) {
      const a = aggregate(p, SEEDS, c.bal);
      const cell = `${a.meanReached.toFixed(1)}${a.winRate > 0 ? ` (${Math.round(a.winRate * 100)}%)` : ""}`;
      row += cell.padStart(16);
    }
    rows.push(row);
  }
  // eslint-disable-next-line no-console
  console.log(
    `\nMECH TIDE — balance sweep (mean stage reached over ${SEEDS.length} seeds; (win%) = stage-15 clears)\n` +
    `Goal: get Good·Optimal to win 15 while Avg·Average stays mid-campaign.\n\n` +
    rows.join("\n") + "\n",
  );
}
