/** Economy/progression parity tests — mirror the original smoke_test.py. */

import { describe, expect, it } from "vitest";
import { GameState, SKILL_NODES } from "../src/sim/state";
import * as C from "../src/config";

function fakeStorage(): Pick<Storage, "getItem" | "setItem"> & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
}

function fresh(rand: () => number = () => 0.99): GameState {
  return new GameState(fakeStorage(), rand);
}

describe("economy core (parity with smoke_test.py)", () => {
  it("costs grow geometrically from the right bases", () => {
    const g = fresh();
    expect(g.genCost()).toBe(50);
    expect(g.turretCost()).toBe(60);
    expect(g.towerUpgradeCost()).toBe(50);          // v0.7.0 rebase
    g.towerLevel = 1;
    expect(g.towerUpgradeCost()).toBe(70);          // 50 * 1.4
    g.money = 10_000;
    g.tryBuyGen();
    expect(g.genCost()).toBe(80);                   // 50 * 1.6
  });

  it("skill-gated buys refuse without the tree node", () => {
    const g = fresh();
    g.money = 10_000;
    expect(g.tryBuyMulti()).toBe(false);
    g.skills.add("multi");
    expect(g.tryBuyMulti()).toBe(true);
    expect(g.multiLevel).toBe(1);
  });

  it("repair only when hurt; plating raises current AND max HP", () => {
    const g = fresh();
    g.money = 10_000;
    g.skills.add("repair").add("plating");
    expect(g.tryBuyRepair()).toBe(false);           // full HP -> no buy
    g.hp = 40;
    expect(g.tryBuyRepair()).toBe(true);
    expect(g.hp).toBe(70);
    const max0 = g.maxHp();
    expect(g.tryBuyPlating()).toBe(true);
    expect(g.maxHp()).toBe(max0 + C.PLATING_HP);
  });

  it("repair + plating are limited per level and reset with the run", () => {
    const g = fresh();
    g.money = 10_000;
    g.skills.add("repair").add("plating");
    g.hp = 10;
    for (let i = 0; i < C.REPAIR_MAX_BUYS; i++) expect(g.tryBuyRepair()).toBe(true);
    g.hp = 10;
    expect(g.tryBuyRepair()).toBe(false);           // cap hit, even while hurt
    for (let i = 0; i < C.PLATING_MAX_BUYS; i++) expect(g.tryBuyPlating()).toBe(true);
    expect(g.tryBuyPlating()).toBe(false);          // cap hit, money irrelevant
    g.resetRun();                                   // next level: fresh stock
    g.money = 10_000;
    g.hp = 10;
    expect(g.tryBuyRepair()).toBe(true);
    expect(g.tryBuyPlating()).toBe(true);
  });

  it("shield layers soak 30 each; overflow hits the tower (tank example)", () => {
    const g = fresh();
    g.money = 10_000;
    g.skills.add("repair").add("plating").add("shield");
    g.tryBuyShield();
    expect(g.shield).toBe(2);
    g.shield = 1;
    const r = g.damageTower(34);                    // the SPEC's literal example
    expect(r.layersSpent).toBe(1);
    expect(r.hpLost).toBe(4);
    g.shield = 3; g.hp = g.maxHp();
    const r2 = g.damageTower(90);                   // boss slam: exactly 3 layers
    expect(r2.layersSpent).toBe(3);
    expect(r2.hpLost).toBe(0);
  });

  it("cores: +1 x level per cleared wave, +15 x level on the boss wave; never from coins", () => {
    const g = fresh();
    g.level = 2;
    g.resetRun();
    g.money = 9_999;                                // hoarded coins must be worthless
    const c0 = g.cores;
    g.wave = 8;                                     // level 2, wave 1 (not boss)
    g.waveTookDamage = true;                        // suppress the Untouchable bounty
    expect(g.onWaveCleared()).toEqual({ bossWave: false, coresEarned: 2 });
    g.wave = 17;                                    // level 2 boss wave
    g.waveTookDamage = true;
    const r = g.onWaveCleared();
    expect(r).toEqual({ bossWave: true, coresEarned: 2 + 30 });
    expect(g.cores).toBe(c0 + 34);                  // wave pay only — no bounties
    expect(g.level).toBe(3);                        // boss clear advances the level
  });

  it("ultimates: own many, equip one, buying auto-equips", () => {
    const g = fresh();
    g.money = 10_000;
    g.skills.add("emp").add("freeze");
    expect(g.tryBuyUltimate("emp")).toBe(true);
    expect(g.tryBuyUltimate("freeze")).toBe(true);
    expect(g.equippedUltimate).toBe("freeze");
    expect(g.tryBuyUltimate("freeze")).toBe(false); // already owned
    expect(g.equipUltimate("emp")).toBe(true);
  });

  it("kill bonuses: 8% chance; heal never rolls at full HP", () => {
    let calls = 0;
    const seq = [0.01, 0.05];                       // roll passes, lands in "cash" band
    const g = fresh(() => seq[Math.min(calls++, seq.length - 1)]);
    const m0 = g.money;
    const { bonus } = g.onKill(5, false);
    expect(bonus).toBe("cash");                     // full HP -> heal weight 0
    expect(g.money).toBeGreaterThan(m0 + 5);        // reward + 40-coin bonus
  });

  it("combo multiplies kill rewards and decays after the window", () => {
    const g = fresh();
    g.onKill(10, false);
    g.onKill(10, false);
    expect(g.comboMult()).toBeCloseTo(1.1);
    g.tick(C.COMBO_WINDOW + 0.1);
    expect(g.combo).toBe(0);
  });

  it("skill tree: prereqs gate, cores are spent, tree total is 2040", () => {
    const g = fresh();
    g.cores = 10_000;
    expect(g.tryUnlockSkill("multi")).toBe(false);     // capstone — needs guided
    expect(g.tryUnlockSkill("pierce")).toBe(true);     // CANNON entry, no prereq
    expect(g.tryUnlockSkill("explosive")).toBe(true);  // needs pierce (just bought)
    expect(g.tryUnlockSkill("guided")).toBe(true);     // needs explosive
    expect(g.tryUnlockSkill("multi")).toBe(true);      // guided owned -> capstone unlocks
    expect(SKILL_NODES.reduce((a, n) => a + n.cost, 0)).toBe(2040);
  });

  it("a wave can NEVER pay twice (the level-1799 runaway regression)", () => {
    const g = fresh();
    g.level = 2;
    g.resetRun();
    g.wave = 17;                                    // level 2's boss wave
    const first = g.onWaveCleared();
    expect(first.bossWave).toBe(true);
    expect(g.level).toBe(3);
    const c = g.cores;
    // A runaway caller (scene ticking under the Home screen) re-clears it:
    for (let i = 0; i < 1000; i++) g.onWaveCleared();
    expect(g.cores).toBe(c);                        // not one core more
    expect(g.level).toBe(3);                        // not one level more
    g.resetRun();                                   // next battle clears fresh
    expect(g.onWaveCleared().coresEarned).toBeGreaterThan(0);
  });

  it("checkpoints: snapshot restores the full loadout at full HP; replays never re-pay", () => {
    const g = fresh();
    g.level = 3;                                  // 15-wave level: 18..32
    g.resetRun();
    g.money = 10_000;
    g.skills.add("multi").add("emp");
    // Clear waves 1-5 of level 3 (global 18-22), shopping along the way.
    for (let i = 0; i < 5; i++) { g.onWaveCleared(); g.startNextWave(); }
    expect(g.wave).toBe(23);                      // checkpoint wave (6 of 15)
    g.tryBuyTurret(); g.tryBuyMulti(); g.tryBuyUltimate("emp");
    g.snapshotCheckpoint();                       // (startNextWave also did this pre-buys; re-snap with buys)
    const coresAt5 = g.cores;
    const moneyAtCp = g.money;
    // Push to wave 8, get hurt, then die.
    g.onWaveCleared(); g.startNextWave();         // 6 cleared -> 7
    g.onWaveCleared(); g.startNextWave();         // 7 cleared -> 8
    const coresAt7 = g.cores;
    g.damageTower(9_999);
    expect(g.hp).toBe(0);
    // Restore: same loadout, same wave, full HP.
    expect(g.restoreCheckpoint()).toBe(true);
    expect(g.wave).toBe(23);
    expect(g.turretLevel).toBe(1);
    expect(g.multiLevel).toBe(1);
    expect(g.ultimatesOwned.has("emp")).toBe(true);
    expect(g.money).toBe(moneyAtCp);
    expect(g.hp).toBe(g.maxHp());
    // Re-clearing waves 6-7 pays nothing; wave 8 pays again.
    g.onWaveCleared();                            // wave 6 replay
    expect(g.cores).toBe(coresAt7);
    g.startNextWave(); g.onWaveCleared();         // wave 7 replay
    expect(g.cores).toBe(coresAt7);
    g.startNextWave(); g.onWaveCleared();         // wave 8 of the level: new ground
    expect(g.cores).toBe(coresAt7 + 3);           // level 3 pays 3/wave
    expect(coresAt5).toBeLessThan(coresAt7);
    // A fresh run clears the checkpoint.
    g.resetRun();
    expect(g.checkpoint).toBeNull();
  });

  it("Twin Targeting: tree-gated, bought per run, reset like everything else", () => {
    const g = fresh();
    g.money = 10_000;
    expect(g.tryBuyTwin()).toBe(false);             // not in the tree yet
    g.skills.add("twin");
    expect(g.tryBuyTwin()).toBe(true);
    expect(g.twinOwned).toBe(true);
    expect(g.tryBuyTwin()).toBe(false);             // one-time per run
    g.resetRun();
    expect(g.twinOwned).toBe(false);                // resets with the run
  });

  it("Interceptor + Field Medic: gated chain buys, once per run, reset", () => {
    const g = fresh();
    g.money = 10_000;
    expect(g.tryBuyInterceptor()).toBe(false);      // tree-gated
    g.skills.add("twin").add("interceptor").add("medic");
    expect(g.tryBuyInterceptor()).toBe(true);
    expect(g.tryBuyMedic()).toBe(true);
    expect(g.tryBuyInterceptor()).toBe(false);      // one-time per run
    g.resetRun();
    expect(g.interceptorOwned || g.medicOwned).toBe(false);
    // Tree chain: interceptor needs twin, medic needs interceptor
    const g2 = fresh();
    g2.cores = 10_000;
    expect(g2.tryUnlockSkill("interceptor")).toBe(false);
    g2.tryUnlockSkill("twin");
    expect(g2.tryUnlockSkill("medic")).toBe(false);
    expect(g2.tryUnlockSkill("interceptor")).toBe(true);
    expect(g2.tryUnlockSkill("medic")).toBe(true);
  });

  it("save/load round-trips permanent state only", () => {
    const store = fakeStorage();
    const g = new GameState(store, () => 0.99);
    g.cores = 123; g.towerLevel = 2; g.level = 4;
    g.skills.add("multi");
    g.volume = 0.4; g.reduceMotion = true;
    g.money = 555; // run state: must NOT persist
    g.save();
    const g2 = new GameState(store, () => 0.99);
    expect(g2.cores).toBe(123);
    expect(g2.towerLevel).toBe(2);
    expect(g2.level).toBe(4);
    expect(g2.skills.has("multi")).toBe(true);
    expect(g2.volume).toBeCloseTo(0.4);
    expect(g2.reduceMotion).toBe(true);
    expect(g2.money).toBe(g2.startCash());          // fresh run economy
  });

  it("achievement bounties pay once, on unlock", () => {
    const g = fresh();
    const c0 = g.cores;
    expect(g.unlockAchievement("boss")).toBe(true);
    expect(g.cores).toBe(c0 + 10);                  // Boss Slayer bounty
    expect(g.unlockAchievement("boss")).toBe(false);
    expect(g.cores).toBe(c0 + 10);                  // never twice
  });

  it("achievements unlock on their triggers", () => {
    const g = fresh();
    g.money = 2_500;
    g.checkAchievements();
    expect(g.achievements.has("rich")).toBe(true);
    g.wave = 26;
    g.checkAchievements();
    expect(g.achievements.has("wave10") && g.achievements.has("wave25")).toBe(true);
  });
});

describe("saves survive game updates (never wipe on schema drift)", () => {
  it("loads a sparse old-version save, filling new fields with defaults", () => {
    const st = fakeStorage();
    // a v0-era save: no save_version, missing every field added since
    st.data["rts2_save"] = JSON.stringify({ cores: 120, tower_level: 3, skills: ["multi"] });
    const g = new GameState(st, () => 0.99);
    expect(g.cores).toBe(120);
    expect(g.towerLevel).toBe(3);
    expect(g.skills.has("multi")).toBe(true);
    expect(g.level).toBe(1);                        // missing -> default, not a wipe
    expect(g.volume).toBe(0.5);                      // missing -> default SFX volume
  });

  it("tolerates a future save with unknown fields and version", () => {
    const st = fakeStorage();
    st.data["rts2_save"] = JSON.stringify({
      save_version: 999, cores: 50, level: 4, from_the_future: { shiny: true },
    });
    const g = new GameState(st, () => 0.99);
    expect(g.cores).toBe(50);
    expect(g.level).toBe(4);
  });

  it("a corrupt save falls back to defaults without throwing", () => {
    const st = fakeStorage();
    st.data["rts2_save"] = "{not json";
    const g = new GameState(st, () => 0.99);
    expect(g.cores).toBe(0);
    expect(g.level).toBe(1);
  });
});
