/** Save-durability hardening (2026-06-19): a bad/transient storage read must
 * NEVER write defaults over a real save, failures are surfaced for telemetry,
 * and every successful save is mirrored (onPersist) to the durable native store. */

import { describe, expect, it } from "vitest";
import { GameState, SAVE_KEY } from "../src/sim/state";

function fakeStorage(opts: { throwOnGet?: boolean; throwOnSet?: boolean; seed?: string } = {}) {
  const data: Record<string, string> = {};
  if (opts.seed !== undefined) data[SAVE_KEY] = opts.seed;
  let writes = 0;
  return {
    data,
    writes: () => writes,
    getItem: (k: string) => { if (opts.throwOnGet) throw new Error("read fail"); return data[k] ?? null; },
    setItem: (k: string, v: string) => { if (opts.throwOnSet) throw new Error("write fail"); data[k] = v; writes++; },
  };
}

describe("save durability: no-clobber on a bad read", () => {
  it("a throwing read records lastLoadError and writes NOTHING (can't clobber disk)", () => {
    const st = fakeStorage({ throwOnGet: true });
    const g = new GameState(st, () => 0.99);
    expect(g.lastLoadError).not.toBeNull();
    expect(st.writes()).toBe(0); // load() never writes, even when the read fails
    expect(g.cores).toBe(0);     // fell back to defaults in memory only
  });

  it("a corrupt save records lastLoadError, keeps defaults, still doesn't write", () => {
    const st = fakeStorage({ seed: "{ not valid json" });
    const g = new GameState(st, () => 0.99);
    expect(g.lastLoadError).not.toBeNull();
    expect(st.writes()).toBe(0);
  });

  it("a clean read leaves lastLoadError null and loads the values", () => {
    const st = fakeStorage({ seed: JSON.stringify({ cores: 42, level: 3, best_stage: 3 }) });
    const g = new GameState(st, () => 0.99);
    expect(g.lastLoadError).toBeNull();
    expect(g.cores).toBe(42);
    expect(g.level).toBe(3);
  });
});

describe("save durability: hooks", () => {
  it("onPersist receives the serialized save on every successful save (durable mirror)", () => {
    const st = fakeStorage();
    const g = new GameState(st, () => 0.99);
    const mirrored: string[] = [];
    g.onPersist = (s) => mirrored.push(s);
    g.cores = 77;
    g.save();
    expect(mirrored).toHaveLength(1);
    expect(JSON.parse(mirrored[0]).cores).toBe(77); // mirror matches what hit localStorage
  });

  it("onStorageError fires (where='save') when the write throws", () => {
    const st = fakeStorage({ throwOnSet: true });
    const g = new GameState(st, () => 0.99);
    const wheres: string[] = [];
    g.onStorageError = (where) => wheres.push(where);
    g.save();
    expect(wheres).toEqual(["save"]);
  });
});
