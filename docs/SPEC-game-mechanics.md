# Game Mechanics & Balance Reference

The concrete numbers behind Mech Tide (originally Robot Tower Survival) —
enemy stats, weapon damage, upgrades, drops, and the wave/stage logic.

> ⚠️ **KEEP THIS IN SYNC.** Whenever any of these gameplay values or formulas
> change (in `config.py`, `entities.py`, `waves.py`, or `game.py`), **update this
> doc in the same change.** If it drifts from the code it's worse than useless.

**Where the values live:** almost everything is a named constant in
[`config.py`](../config.py); enemy definitions are in
[`entities.py`](../entities.py); wave/stage math is in [`waves.py`](../waves.py);
how they combine (damage, scaling) is in `game.py`. This doc reflects the code as
of **2026-06-10** (cores-per-wave economy update).

> **Terminology:** the game's progression unit is a **Stage** (the in-game
> label). In code and the formulas below it's still named `level` (`gs.level`,
> `WAVES_BY_LEVEL`, `wave_in_level`, `LEVEL_RAMP`, …) — same thing. This is
> distinct from **Tower Level** (the permanent, cores-bought upgrade) and from an
> item's **Lv** (its per-upgrade level). Prose here says "Stage"; code names and
> formula variables keep `level`.


> ## v2 balance changes (this port diverges from the original here)
> - **Stage length is capped at 15 waves** (`WAVES_LEVEL_CAP`). The original
>   grew +5 forever (stage 10 = 50 waves). Stages past 3 are all 15 waves and
>   differentiate by their steeper difficulty ramp instead.
> - **Explosive Rounds buffed** (original: 12+6/lvl splash in a fixed 60px):
>   splash **16 + 6/lvl**, radius **100 + 25/lvl** — sparse enemy spacing made
>   the original blast nearly useless. Splash victims show damage numbers.
> - **Twin Targeting is an in-run purchase** (200 coins, one-time per run,
>   tree-gated) — the original auto-granted it from the tree, the only node
>   that broke its own gate-not-grant rule.
> - **New Drone-branch nodes (v2 content)**: Interceptor (200 cores / 250
>   coins per run — drone shoots down one enemy projectile in its range every
>   0.35s) and Field Medic (250 cores / 300 coins — while the drone has no
>   enemy in firing range it repairs the tower at 2 HP/s). Chain: Twin
>   Targeting -> Interceptor -> Field Medic.
> - **Mid-stage checkpoints** (`CHECKPOINT_EVERY` = 5): starting wave 6/11 of a
>   stage snapshots the full loadout (coins, upgrades, ultimates — including
>   between-wave purchases). Death offers "Retry from wave N": the snapshot is
>   restored at full HP. Replayed waves never re-pay cores (high-water mark).
> - **Repair + Plating limited to once per stage** (`REPAIR_MAX_BUYS` /
>   `PLATING_MAX_BUYS` = 1, added 2026-06-12): unlimited buys let players
>   stack cheap HP every shop visit — including mid-wave via the pause shop —
>   into a near-unkillable tower. Spent cards show "✓ USED" for the rest of
>   the stage; the buy counters reset with the run.

---

## Tower (the thing you defend)

| Stat | Value |
|---|---|
| Base max HP | **100** (`TOWER_MAX_HP`) |
| +HP per **Tower Level** (permanent "Upgrade Tower") | **+20** per level (`TOWER_HP_PER_LEVEL`) |
| +Earnings per Tower Level | **+10%** per level (`TOWER_EARN_PER_LEVEL`) |
| +Starting cash per Tower Level | **+30** per level (`TOWER_CASH_PER_LEVEL`) |

**Important:** the permanent **Tower Level** boosts HP, earnings, and starting
cash — it does **not** increase gun damage. Damage comes from the in-run **Main
Turret** upgrade (below).

---

## Enemies

Base stats (from `entities.py`). **Contact damage** = HP the tower loses when the
enemy reaches it. The grunt's default would be `TOWER_CONTACT_DAMAGE` (10), but
every enemy sets its own value. The **Sprite** column is the actual in-game art
(the old colored circles are gone).

| Enemy | Sprite | HP | Contact dmg | Speed× | Reward (coins) | Laser | HP scales w/ stage? |
|---|---|---|---|---|---|---|---|
| **Grunt** | <img src="../public/sprites/enemy_0.png" width="42"> | 20 | 6 | 1.0 | 3 | one-shot | no |
| **Fast** | <img src="../public/sprites/enemy_1.png" width="42"> | 10 | 4 | 1.8 | 4 | one-shot | no |
| **Tough / Brute** | <img src="../public/sprites/enemy_3.png" width="42"> | 70 | 14 | 0.9 | 14 | drains | no |
| **Tank** | <img src="../public/sprites/enemy_2.png" width="42"> | 160 | 34 | 0.5 | 30 | drains | **yes** |
| **Bomber** | <img src="../public/sprites/enemy_4.png" width="42"> | 40 | 26 | 1.4 | 12 | drains | **yes** |
| **Shooter** | <img src="../public/sprites/shooter.png" width="42"> | 30 | 8 per projectile | 0.8 | 16 | drains | **yes** |
| **Boss** | <img src="../public/sprites/boss.png" width="58"> | 400 | ≈one-shot | 0.35 | 150 | drains | **yes** |

Notes:
- **Sprites** are the real in-game art (`public/sprites/`). As of 2026-06-05
  every enemy type has its own sprite — the Shooter (glowing-core orb) and Boss
  (heavy armored mech) got unique art sliced from the reserve sheet, ending the
  old enemy_1/enemy_3 reuse.
- **Speed×** multiplies the wave's base speed (see Waves). Base = `ROBOT_SPEED` 70 px/s.
- **Boss contact damage** is special: it's `max(90, 90% of the tower's max HP)`,
  so it nearly one-shots the tower **no matter how upgraded you are** (`Robot.update`).
- **Boss covering fire** (v2 addition, not in the original): as it advances the boss
  also lobs projectiles at the tower, scaling with the **game stage** (`BOSS_FIRE`):
  cooldown `max(0.9, 6.0 − 0.7×(level−1))` s and damage `4 + 4×(level−1)`. Stage 1 is
  a shot or two of chip damage over the slow trek; later stages are a faster, harder
  barrage. It still crashes the tower normally (the fire is on top of the melee hit).
- **Shooter** is ranged: it stops **260 px** from the tower (`SHOOTER_RANGE`) and
  fires a projectile every **1.6 s** (`SHOOTER_FIRE_CD`) for **8 dmg** each
  (`SHOOTER_PROJ_DAMAGE`). It **never reaches the tower** — it halts at 260 px
  (well outside contact range) and even spawns farther out than that — so it only
  ever deals damage via its projectiles. (Its `contact_damage` of 8 in the code is
  effectively unused.)
- **HP scaling** (Tank/Bomber/Shooter/Boss only): `max_hp × (1 + 0.12 × (effective_wave − 1))`
  (`HEAVY_HP_RAMP` = 0.12). Grunts/Fast/Tough are **fixed** HP so a basic shot
  always one-shots a grunt. (`effective_wave` is defined under Waves below — note
  it starts at **1.6** on every stage's first wave, so heavies are already a touch
  tankier than their base HP.)

---

## Your weapons

### DPS at a glance (damage per second by upgrade level)

Theoretical sustained DPS — assumes continuous fire at a single target in range,
and that every shot connects. The **💰 columns** are the *cumulative* coin cost to
reach that level from scratch.

| Weapon | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | 💰 Cost → Lv 5 | Lv 6 | Lv 7 | Lv 8 | Lv 9 | Lv 10 | 💰 Cost → Lv 10 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Standard gun** | 40 | 53.3 | 69.1 | 87.8 | 109.7 | 135.5 | **🪙 947** | 165.6 | 200.7 | 241.6 | 289.1 | 344.2 | **🪙 10,891** |
| **Auto-Laser** | — | 18.0 | 36.0 | 54.0 | 72.0 | 90.0 | **🪙 789** | _capped at Lv 5_ | | | | | |
| **Drone** | — | 11.2 | 17.2 | 25.4 | 36.6 | 51.9 | **🪙 839** | 72.5 | 100.1 | 137.1 | 186.3 | 251.5 | **🪙 9,125** |

> The two **💰 cost** columns are the cumulative coins to fully buy that weapon up
> to Lv 5 / Lv 10. (GitHub markdown can't shade table cells, so they're flagged
> with 💰/🪙 rather than a background color.)
> **Balance pass 2026-06-05:** the Auto-Laser and Drone were buffed (they were
> far behind the gun in DPS-per-coin — see `dads_feedback.md`). The gun is still
> the strongest per coin; the helpers are now worth buying.

What "level" means per row, and why the DPS scales:
- **Standard gun** — *Base* = no **Main Turret** upgrade (the gun you always have);
  *Lv N* = Main Turret level N. DPS climbs from **both** more damage (`20 + 4N`)
  **and** a faster cooldown (`0.5 × 0.9^N`). DPS = `(20 + 4N) ÷ (0.5 × 0.9^N)`.
- **Auto-Laser** — *Base* = not deployed (it doesn't fire). *Lv N* = Auto-Laser
  level N (the first purchase is Lv 1). Per-shot damage is fixed at **18**; only
  the fire rate scales: DPS = `18 ÷ (1.0 ÷ N)` = `18 × N`.
- **Drone** — *Base* = not deployed. *Lv N* = Drone level N (deploy = Lv 1).
  Both the damage AND the fire rate scale:
  DPS = `(18 + 4×(N−1)) ÷ (1.6 × 0.8^(N−1))`.

Caveats: **Multi-Shot** multiplies the *Standard gun* row by the bullet count
(`1 + MultiShotLevel`) if every bullet hits; the **rapid-fire** power-up
temporarily multiplies the gun's rate by ~2.5× (for 5 s). The **Auto-Laser/Drone** numbers assume a
target is in range (the Drone also focus-fires only the strongest enemy and must
be within its range). The **Laser** isn't a sustained-DPS weapon (burst ultimate)
so it's listed separately below.

### Standard gun (click to shoot) — always available
| | Value |
|---|---|
| Base damage | **20** (`BULLET_DAMAGE`) — one-shots Grunts & Fast |
| Fire cooldown | **0.5 s** (`FIRE_COOLDOWN`) |
| **Main Turret** upgrade (in-run, paid with coins) | **+4 damage/level** (`TURRET_DAMAGE_PER_LEVEL`), fire cooldown **×0.9/level** (faster), bullet radius **+1/level** |

So gun damage = `20 + 4 × MainTurretLevel`. (Again: the permanent *Tower Level*
does **not** change this — only the Main Turret upgrade does.)

### Auto-Laser (in-run turret) — always available
| | Value |
|---|---|
| Damage per shot | **18** (`AUTO_BULLET_DAMAGE`) — **fixed**, does not scale |
| Fire cooldown | `1.0 s ÷ AutoLevel` (`AUTO_BASE_COOLDOWN`) — **each upgrade fires faster**, same per-shot damage |
| Range | **200** (`AUTO_RANGE`) — only zaps enemies this close to the tower |
| Max level | **5** (`AUTO_MAX_LEVEL`) — caps at 90 DPS |

*(Buffed 2026-06-05: base cooldown 1.3 s → 1.0 s, cost growth 1.8 → 1.6.)*
*(Nerfed 2026-06-17: it was uncapped + infinite-range, so kids could win the
early stages on Auto-Laser alone without ever firing the cannon. Now it's a
close-in defense (range 200, < the shooter's 260 fire range) capped at Lv 5, so
the cannon is needed for anything at range.)*

### Drone (in-run) — deploy, then upgrade
| | Value |
|---|---|
| Damage per shot | `18 + 4 × (level − 1)` (`DRONE_DAMAGE` + `DRONE_DAMAGE_PER_LEVEL`) — **scales with level** |
| Range | `130 + 55 × (level − 1)` (`DRONE_BASE_RANGE` / `_PER_LEVEL`) |
| Fire cooldown | `1.6 s × 0.8^(level − 1)` — **faster each upgrade** |

So drone upgrades buy **more damage + more range + faster fire**. *(Buffed
2026-06-05: was a fixed 14 damage that never scaled — by far the worst
DPS-per-coin in the game.)*

### Ultimates (skill-tree gated — own many, EQUIP one)
You can **own several ultimates in a run** (each bought once with coins), but exactly
**one is equipped** — **Spacebar fires the equipped one**. Buying an ultimate
equips it; swap which is equipped for free by clicking it in the between-waves
shop. Each ultimate keeps its **own cooldown**, so swapping never skips one.

| Ultimate | Effect | Duration | Cooldown | Cost (per run) |
|---|---|---|---|---|
| **EMP Burst** | **60 dmg to EVERY enemy on screen** (`EMP_DAMAGE`) + **fries all enemy projectiles in flight** + a brief **0.8 s** system-shock | instant | 10 s | 400 coins |
| **Freeze Bomb** | All enemies **fully stop** | 3 s | 14 s | 250 coins |
| **Time Warp** | Enemies (movement, fire rates, projectiles) run at **35% speed** (`WARP_FACTOR`) — you deal full damage the whole time | 8 s | 16 s | 500 coins |
| **Laser Beam** | **Vaporizes** Grunts & Fast on contact; **drains 240 HP/sec** (`LASER_DPS`) from the rest. Beam **tracks the cursor exactly** | 2.5 s | 12 s | 1000 coins |

### Multi-Shot (CANNON-branch capstone)
**Each bullet does the *full* gun damage — there is no per-bullet reduction.**
You fire `1 + MultiShotLevel` bullets at once: always one straight at the cursor,
with the extras fanned out symmetrically at **16°/level** (`MULTI_SPREAD_DEG`).
Every one of those bullets carries the same `player_damage()` (and any Piercing).

*(Moved 2026-06-17: it was the cheap CANNON-branch **entry** (70 cores) and proved
too strong too early. It's now the **capstone** — 250 cores, gated behind
Piercing → Explosive → Guided — so the branch reads Piercing → Explosive → Guided
→ Multi-Shot.)*

### Piercing Shots (gated by the skill tree)
Each level lets your bullets pass through **+1 extra enemy** before disappearing.

### Explosive Rounds (gated by the skill tree)
Every **friendly bullet hit** (gun, auto-laser, drone) also splashes
`12 + 6×(level−1)` damage (`EXPLOSIVE_SPLASH_DMG` / `_PER_LEVEL`) to enemies
within **60 px** (`EXPLOSIVE_RADIUS`) of the struck enemy. No chain reactions.
Each blast shows an expanding orange **shockwave ring** out to the real splash
radius.

### Guided Rounds (gated by the skill tree; one-time 350 coins)
**Gun bullets bend gently** toward the nearest enemy within **240 px**
(`GUIDED_RANGE`), turning at most **120°/sec** (`GUIDED_TURN`) — a slight curve,
not a heat-seeker.

### Twin Targeting (Drone branch, skill tree — no in-run purchase)
Once unlocked, every drone volley also fires at a **second** enemy in range
(the next-strongest after its locked target). Doubles drone output when crowded.

## Defense (skill-tree gated in-run purchases)

| Purchase | Effect | Base cost | Growth |
|---|---|---|---|
| **Repair** | Restore **+30 HP** (`REPAIR_HP`); only when hurt; **once per stage** (`REPAIR_MAX_BUYS`) | 60 coins | n/a (single buy) |
| **Plating** | **+25 max HP** (and +25 current) (`PLATING_HP`); **once per stage** (`PLATING_MAX_BUYS`) | 90 coins | n/a (single buy) |
| **Shield** | **Layered**: `2 + (level−1)` layers (`SHIELD_BASE_HITS`), each soaking up to **30 dmg** of a single hit (`SHIELD_HIT_ABSORB`) — a 34-dmg tank slam strips 2 layers; a 90-dmg boss slam strips 3; if a hit needs more layers than remain, the **unsoaked remainder damages the tower** (34 dmg into 1 layer = 4 tower dmg). **Recharges fully at each wave start.** One **ring** shows per remaining layer, and enemies/projectiles **crash on the outer ring** instead of reaching the tower | 350 coins | ×1.7 per level |

---

## Kill bonuses (instant — no pickups to chase)

*(Reworked 2026-06-05: there is no longer a drop entity on the field — some kills
simply grant their bonus **immediately**, with a zoom-in callout at the kill spot.)*

| | Value |
|---|---|
| Bonus chance per kill | **5%** (`DROP_CHANCE`) — trimmed from 8% for chaos waves (far more kills → far more drops) |
| **Cash** bonus | **+40 coins** (`DROP_CASH`, scaled by your earnings multiplier) |
| **Heal** bonus | **+25 tower HP** (`DROP_HEAL`) |
| **Rapid** bonus | **5 s** of rapid fire (`DROP_RAPID_TIME`); rapid fire = cooldown ×0.4 |

**Which bonus you get** is weighted (`DROP_WEIGHTS` = cash 1 / heal 3 / rapid 1),
with one rule: a **Heal is only rolled when the tower is below full HP** (so it's
never wasted). Net effect:
- **At full HP:** cash or rapid only → 50% / 50%.
- **When hurt:** heal 60% / cash 20% / rapid 20%.

---

## Waves & stages

### How many waves
| Stage | Waves | (`WAVES_BY_LEVEL`) |
|---|---|---|
| 1 | 7 | |
| 2 | 10 | |
| 3 | 15 | |
| 4 | 20 | |
| 5+ | +5 each (25, 30, …) | (`WAVES_LEVEL_EXTRA`) |

The **last wave of every stage is a boss wave** (`is_boss_wave`). On a boss wave,
**1 Boss spawns plus the rest of that wave's normal enemies**.

### Difficulty curve — `effective_wave(wave)`
All scaling (enemy count, speed, heavy-HP, which types appear) is driven by a
single "difficulty wave" that **resets each stage** and ramps **steeper on higher
stages**:

```
effective_wave = DIFF_WAVE1 + (wave_in_level − 1) × DIFF_PER_WAVE × ramp
ramp           = 1 + LEVEL_RAMP × (level − 1)
```
with `DIFF_WAVE1` = 1.4, `DIFF_PER_WAVE` = 0.52, `LEVEL_RAMP` = 0.25. So every
stage's wave 1 is difficulty **1.4**, climbing ~0.52 per wave (faster on later
stages). *(Eased 2026-06-17 over several passes — `DIFF_WAVE1` 1.6 → 1.4,
`DIFF_PER_WAVE` 0.7 → 0.52, `LEVEL_RAMP` 0.35 → 0.25 — gentler everywhere, with the
early game skewed easiest. Heavy-enemy unlocks land later: in stage 1, Tough at
wave 4, Bomber at wave 6, Tank only on the boss wave, Shooters not at all.)*

### Enemy count / speed / spawn rate (per wave)
| | Formula |
|---|---|
| Robots in the wave | `5 + round(1 × (effective_wave − 1))` **+ chaos surge**, capped at **50** (`WAVE_COUNT_MAX`) |
| ↳ chaos surge | `round(CHAOS_SURGE(26) × frac² × levelScale × bossFactor)`, `frac = waveInStage / wavesInStage`, `levelScale = min(1, 0.2 + 0.4×(stage−1))` (stage 1 ≈ 0.2×, stage 2 ≈ 0.6×, full at 3+), `bossFactor = 0.4 on the boss wave else 1` |
| Robot speed (px/s) | `70 + 4 × (effective_wave − 1)`, then × the enemy type's Speed× |
| Seconds between spawns | `clamp(0.12 … ramp, ≤ 6.5 / waveCount)` — big swarms flood within ~6.5 s (`CHAOS_SPAWN_WINDOW`); `ramp = 1.1 − 0.02 × (effective_wave − 1)` |
| Breather between waves | **2.5 s** (`INTERMISSION_TIME`) |

> **Chaos pass (2026-06-17, Callum's ask):** each stage now builds to a swarm
> concentrated in its final waves (the `frac²` surge), spawning fast enough to
> flood. The surge is eased in the early stages (`levelScale`: stage 1 ≈ 0.2×,
> stage 2 ≈ 0.6×, full at stage 3+), so stage 1 ramps roughly
> **5 → 6 → 7 → 9 → 10 → 12 → (boss + ~2)** and the big floods arrive once the
> player has some upgrades. The swarm is mostly one-shot fodder (Grunt/Fast
> weights raised, below) so it stays survivable and gives **Piercing** real value
> (one shot clears a column). Dials: `CHAOS_SURGE` (size), `CHAOS_SPAWN_WINDOW`
> (flood speed), `levelScale` in `waveRobotCount` (early-stage easing).

### Which enemy types appear (by `effective_wave`)
Spawn pool + relative weights (bosses are spawned separately, not from this pool):

| effective_wave ≥ | Adds to the pool |
|---|---|
| (always) | **Grunt** (weight 30), **Fast** (weight 12) — raised from 20/8 for the chaos pass so swarms are mostly one-shot fodder |
| 2.5 | **Tough/Brute** |
| 3.5 | **Bomber** |
| 4.5 | **Tank** |
| 5.5 | **Shooter** |

So early waves of *every* stage are just grunts + fast, and the tougher types
unlock as the stage ramps (sooner on higher stages). The added types' weights
grow slowly as `effective_wave` climbs past their unlock point.

---

## Economy quick reference (upgrade costs)

All in-run upgrade costs grow geometrically: `base × growth^level`.

| Upgrade | Base cost | Growth | Currency |
|---|---|---|---|
| Money Generator (+3 coins/s per level) | 50 | 1.6 | coins |
| Auto-Laser | 50 | 1.6 | coins |
| Main Turret | 60 | 1.6 | coins |
| Multi-Shot | 220 | 2.0 | coins |
| Piercing | 150 | 1.8 | coins |
| Explosive Rounds | 250 | 1.8 | coins |
| Guided Rounds (per run) | 350 | — | coins |
| Repair | 60 | 1.4 | coins |
| Plating | 90 | 1.5 | coins |
| Shield | 350 | 1.7 | coins |
| EMP Burst (per run) | 400 | — | coins |
| Time Warp (per run) | 500 | — | coins |
| Drone (deploy / upgrade) | 100 / 120 | 1.6 | coins | <!-- upgrade base > deploy so the price never dips -->
| Laser (per run) | 1000 | — | coins |
| Freeze Bomb (per run) | 250 | — | coins |
| **Tower Level** (permanent) | 50 | 1.4 | **Cores** |

**Cores are earned during the run** — coins never convert to Cores (so shop
spending doesn't tax your progression, and an instant quit earns nothing):

- **+1 Core × stage for every cleared wave** (`WAVE_CLEAR_CORES`), granted the
  moment the wave ends — you keep these even if you die later in the run.
- **+15 Cores × stage for clearing the stage's boss wave** (`LEVEL_CLEAR_CORES`).

So Stage 3 (15 waves) pays 15×3 + 45 = **90 Cores** for a full clear. Skill-tree
node prices (total **1,430** Cores): Cannon 70/90/160/220, Defense 60/100/180,
Drone 150, Ultimates 60/80/110/150.
