# Headless playtest harness

A deterministic combat simulator that plays Mech Tide as a tunable **reference
player** and reports how far each profile gets, stage by stage. It imports the
*real* pure game core (`src/config.ts`, `src/sim/state.ts`, `src/sim/waves.ts`)
and re-implements the spatial combat loop from `BattleScene.update()` with no
Phaser/DOM — so balance numbers come straight from the live config.

## Run it

```bash
npm run playtest      # prints the per-stage survivability table
npm test              # runs the coarse balance-regression asserts (quiet)
```

## The two levers (edit `profiles.ts`)

1. **AIM** — reaction + accuracy (`AIM.pro/good/average/casual`): per-shot aim
   jitter (degrees), how fast they re-pick the closest threat, and how aligned
   the gun must be before firing. Worse aim misses small/fast/distant enemies
   and is slow to swing onto a new threat, so more leaks through.
2. **ECON** — spend efficiency (`ECON.optimal/average/poor`): the in-run **coin**
   build order (`coinOrder`) and the permanent **core** order (`coreOrder`).
   `optimal` rushes compounding income + the cannon AoE line + a banked Laser;
   `poor` dumps everything into the turret and never buys the generator or AoE.

Cross them however you like in `engine.ts` → `REFERENCE_PLAYERS`. A profile with
`pretrained: true` starts with the whole skill tree unlocked + a tower head-start
(models a player who's already ground out cores); without it, cores are earned
naturally across one blind run.

## How to read it / fidelity

- Cells = HP% left after **clearing** each stage; `x<n>` = died at wave `n`.
- World is the 4:3 reference (960×720), tower centred — matches the game's
  background alignment, so travel distances are a 4:3 screen's.
- **One continuous life, no checkpoint-retries** — so "reached stage N" is a
  conservative **lower bound**; real players retry from wave 1/6/11 and push
  further. Expert micro the bot doesn't model (freeze→burst combos on a boss,
  perfect boss/fodder target-splitting, leading shots) would also help.
- Deterministic for a fixed seed (`SEED` in `tests/playtest.test.ts`).

It's a **reference-player model for relative comparison + regression**, not a
frame-perfect replica. Trust the *shape* (which lever moves the needle, where
the walls are), not the third significant figure.

## What it found (and the v0.12.3 rebalance)

At v0.12.1 the late bosses (≈stage 11-15) were a hard wall: no reference player
won — weapons reset/cap each stage (nowhere near god-mode's turret 50), Multi-Shot's
16° fan scatters off a lone boss (weak single-target burst), and late bosses stack
big HP + heavy covering fire. The balance sweep (`npm run playtest:balance`) showed:

- Raising the **auto-laser cap alone does nothing** (it's single-target / close-range).
- The boss's **90%-HP crash is a non-factor** — the boss dies before it reaches you;
  nerfing the crash changed no outcomes.
- The fix is letting power **persist across stages**. Shipped as **C1** (v0.12.3):
  a permanent **+4 cannon damage per tower level** (`TOWER_TURRET_DAMAGE`) plus a
  crash ease (`BOSS_CRASH_FRAC` 0.9 → 0.6).

With C1, a geared **Good · Optimal** player now finishes stage 15 (~71% HP), Pro
~89%, while Average · Average still walls ~stage 9-10 and a blind first run ~stage 4
— the curve is eased, not flattened. The `playtest harness` regression test now
asserts skilled players win; if a future change flips that, update it + the CHANGELOG.
