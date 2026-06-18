/** Reference-player profiles for the headless playtest sim (tools/playtest/engine.ts).
 *
 * Two independent levers, exactly as requested:
 *  1. AIM  — how good their reaction time + accuracy is (aimErrorDeg, retargetInterval).
 *  2. ECON — how efficiently they spend: in-run coins (coinOrder) AND permanent
 *            cores between stages (coreOrder). "optimal" rushes compounding income
 *            + the cannon AoE line; "poor" dumps everything into the turret and
 *            never touches the generator or AoE skills.
 *
 * These are the knobs to pull — edit the numbers/orders here (or build new
 * combos in engine.ts REFERENCE_PLAYERS) and re-run `npm run playtest`. */

import type { SkillKey } from "../../src/sim/state";

/** How the player aims and reacts. Worse players miss small/fast/distant enemies
 * and are slow to swing onto a new threat (so more leaks through). */
export interface AimProfile {
  label: string;
  aimErrorDeg: number;       // per-shot aim jitter, ± this many degrees (0 = laser-perfect)
  retargetInterval: number;  // seconds before they re-pick the closest threat (reaction/tracking lag)
  fireTolerance: number;     // radians: how aligned the gun must be before they shoot (game default 0.03)
}

/** A single shop purchase rule: buy `action` repeatedly until its level hits `upto`.
 * Earlier steps have priority — the shop loop rescans from the top after each buy. */
export type CoinAction =
  | "gen" | "turret" | "auto" | "multi" | "pierce" | "explosive" | "guided"
  | "repair" | "plating" | "shield" | "drone" | "emp" | "freeze" | "warp" | "laser";
export interface CoinStep {
  action: CoinAction;
  upto: number;
  /** "Save up for this": if it's affordable-except-for-cash, the shop stops for
   * the visit instead of spending the money on cheaper lower-priority items.
   * Used for the pricey Laser so a disciplined player actually banks for it. */
  block?: boolean;
}

/** A permanent (cores) purchase: a tower-level target, or unlocking a skill node. */
export type CoreAction = "tower" | SkillKey;
export interface CoreStep { action: CoreAction; upto?: number; } // upto only for "tower"

export interface EconProfile {
  label: string;
  coinOrder: CoinStep[];  // in-run, rebuilt each stage from that stage's coins
  coreOrder: CoreStep[];  // permanent, spent between stages as cores accumulate
}

export interface PlayerProfile {
  name: string;
  aim: AimProfile;
  econ: EconProfile;
  /** Optional: pre-unlock the whole tree + a tower head-start before stage 1,
   * to model a player who already ground out cores on earlier runs. */
  pretrained?: boolean;
}

// --- AIM levers ---------------------------------------------------------------
export const AIM: Record<string, AimProfile> = {
  pro:     { label: "pro",     aimErrorDeg: 1.5, retargetInterval: 0.12, fireTolerance: 0.05 },
  good:    { label: "good",    aimErrorDeg: 3.0, retargetInterval: 0.22, fireTolerance: 0.06 },
  average: { label: "average", aimErrorDeg: 6.0, retargetInterval: 0.38, fireTolerance: 0.09 },
  casual:  { label: "casual",  aimErrorDeg: 11.0, retargetInterval: 0.60, fireTolerance: 0.13 },
};

// --- ECON levers --------------------------------------------------------------
// OPTIMAL: compounding income first, then the cannon AoE line (the chaos-wave
// answer), drone + a shield + cheap ultimates. Spends cores down the cannon line
// to the Multi-Shot capstone, with a few early tower levels for HP/start-cash.
const OPTIMAL: EconProfile = {
  label: "optimal",
  coinOrder: [
    { action: "gen", upto: 2 },        // compounding income first
    { action: "turret", upto: 2 },
    { action: "gen", upto: 3 },
    { action: "drone", upto: 1 },
    { action: "pierce", upto: 2 },
    { action: "explosive", upto: 2 },
    { action: "turret", upto: 4 },
    { action: "multi", upto: 1 },
    { action: "auto", upto: 3 },
    { action: "shield", upto: 2 },
    { action: "multi", upto: 2 },
    { action: "explosive", upto: 4 },
    { action: "turret", upto: 6 },
    { action: "pierce", upto: 3 },
    { action: "multi", upto: 3 },       // swarm width — the chaos-wave answer (does scatter off lone bosses)
    { action: "shield", upto: 3 },
    // Skip Guided on purpose: it bends bullets toward the NEAREST enemy, pulling
    // fire onto fodder instead of bursting a focused boss.
    { action: "laser", upto: 1, block: true }, // bank for it: vaporizes fodder lines + 240 DPS on the boss (equipped last)
    { action: "drone", upto: 5 },
    { action: "turret", upto: 9 },
    { action: "auto", upto: 12 },   // capped at AUTO_MAX_LEVEL (5) live; lets the balance sweep test a raised cap
    { action: "turret", upto: 14 },
  ],
  coreOrder: [
    { action: "tower", upto: 2 },
    { action: "pierce" }, { action: "explosive" },
    { action: "emp" }, { action: "freeze" },
    { action: "tower", upto: 4 },
    { action: "guided" }, { action: "multi" },
    { action: "twin" },
    { action: "repair" }, { action: "plating" }, { action: "shield" },
    { action: "warp" }, { action: "laser" },
    { action: "tower", upto: 7 },
    { action: "interceptor" }, { action: "medic" },
    { action: "tower", upto: 12 },
  ],
};

// AVERAGE: turret-leaning, some generator, AoE arrives late and shallow; spreads
// cores around (ultimates/drone before finishing the cannon line).
const AVERAGE: EconProfile = {
  label: "average",
  coinOrder: [
    { action: "turret", upto: 2 },
    { action: "gen", upto: 1 },
    { action: "turret", upto: 4 },
    { action: "auto", upto: 2 },
    { action: "drone", upto: 1 },
    { action: "pierce", upto: 1 },
    { action: "turret", upto: 6 },
    { action: "multi", upto: 1 },
    { action: "explosive", upto: 1 },
    { action: "auto", upto: 4 },
    { action: "shield", upto: 1 },
    { action: "turret", upto: 9 },
  ],
  coreOrder: [
    { action: "tower", upto: 1 },
    { action: "emp" }, { action: "twin" },
    { action: "pierce" }, { action: "repair" },
    { action: "tower", upto: 2 },
    { action: "explosive" }, { action: "freeze" },
    { action: "plating" },
    { action: "guided" },
    { action: "tower", upto: 3 },
    { action: "multi" },
    { action: "shield" }, { action: "warp" },
    { action: "interceptor" },
    { action: "tower", upto: 5 },
    { action: "laser" }, { action: "medic" },
  ],
};

// POOR: pours coins into the turret only (no generator → income stagnates, no
// AoE/multi/drone → nothing to clear a 50-enemy chaos wave), and dumps cores
// into tower HP + scattered cheap nodes, never reaching the cannon capstones.
const POOR: EconProfile = {
  label: "poor",
  coinOrder: [
    { action: "turret", upto: 3 },
    { action: "auto", upto: 1 },
    { action: "turret", upto: 6 },
    { action: "turret", upto: 9 },
    { action: "turret", upto: 12 },
  ],
  coreOrder: [
    { action: "tower", upto: 3 },
    { action: "emp" },
    { action: "repair" },
    { action: "tower", upto: 5 },
    { action: "twin" },
    { action: "pierce" },
    { action: "tower", upto: 8 },
    { action: "plating" },
    { action: "tower", upto: 12 },
  ],
};

export const ECON: Record<string, EconProfile> = { optimal: OPTIMAL, average: AVERAGE, poor: POOR };
