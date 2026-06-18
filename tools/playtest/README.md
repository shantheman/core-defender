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

## What it found (v0.12.1 balance)

- The two levers clearly separate the field: geared+accurate+optimal reaches
  the low-teens; mid play walls ~stage 7-8; a poor spender (even with the tree
  unlocked) walls ~stage 2-3; a blind first run walls ~stage 2.
- **The late bosses (≈stage 11-15) are a wall.** No reference player wins in the
  model — weapon levels reset/cap each stage (nowhere near god-mode's turret 50),
  Multi-Shot's 16° fan scatters off a lone boss (weak single-target burst), and
  late bosses stack ~1800 HP + heavy covering fire + a ~90%-max-HP crash on top
  of a 40-enemy chaos wave. See the `FINDING:` regression test — if a future buff
  makes the campaign winnable for a reference player, that test flips (update it
  and note the rebalance in the CHANGELOG).
