# Changelog

Newest at top. The running version shows in Settings.

## v0.11.17 — 2026-06-18

- **Tap-to-fire is accurate now.** `AIM_FIRE_TOLERANCE` 0.2 → 0.03 rad (~11° →
  ~1.7°): the turret swivels to (essentially) the exact tapped heading before
  firing, so the first shot lands where you tapped (~7px off at 300px instead of
  ~60px). The swivel is fast, so it's still near-instant (~67ms) — mobile tap no
  longer wastes its opening shot.
- **New tutorial tip: unlocking ≠ owning.** The first time you buy a Skill Tree
  node, a centered tip explains the unlock just makes the item *available* — you
  still buy it in the Upgrades shop each stage to use it. Tutorial arc is now 5
  tips (the others renumbered to "of 5").

## v0.11.16 — 2026-06-18

- **Background music quieter.** `MUSIC_MASTER` 0.5 → 0.32, so the 50% slider now
  lands where the old curve put 40% (Shannon's preferred default).
- **Drone fire "de-chirped."** The `drone_fire` clip now plays through a 2.5 kHz
  lowpass at 0.85× pitch (deeper, less harsh) instead of the grating chirp —
  done with a new per-sound tone-shaping option in `play()` (no new asset).

## v0.11.15 — 2026-06-18

- **Fixed: Settings gear shifted position** between the battle HUD and the
  Upgrades/Skill Tree panels. The panel gear is now offset to account for the
  HUD `.counters` panel's padding + border, so it lands in the exact same spot
  (verified pixel-identical at the mobile breakpoint).

## v0.11.14 — 2026-06-18

- **Settings gear on the Upgrades & Skill Tree pages.** A gear now sits in the
  top-right corner of both panels (matching its battle-HUD spot) and opens the
  same Settings modal; closing it returns to the panel.
- **Grunt audio: dropped the second beep.** The grunt now uses only its engine
  loop + one satellite beep (the `moving2b` boop is gone) — simpler, less busy.

## v0.11.13 — 2026-06-18

- **Fixed: couldn't fire the ultimate while holding the joystick** (iOS). The
  ultimate button now responds to `pointerdown` instead of `click`, so a second
  finger fires it even with the aim-joystick finger still held down.
- **Fixed: wrong turret flashed at stage start.** A fresh stage briefly showed
  last stage's multi-barrel gun through the intermission before reverting to the
  single turret — the gun/base art now re-syncs every active frame, not just once
  the wave is live.

## v0.11.12 — 2026-06-18

- **Multi-Shot moved to the CANNON-branch capstone.** It was the cheap entry
  (70 cores) and too strong too early; it's now the end of the branch (250 cores,
  gated behind Piercing → Explosive → Guided). Piercing Shots is the new entry.
- **Tutorial: new intro + smarter Generator nudge.** First time the shop opens
  after a wave you get a centered "This is the Upgrade Shop…" intro (Tip 1 of 4)
  that adds "you don't have enough coins yet, but you will soon" when you're
  broke. The Coin Generator tip (now Tip 2 of 4) only appears the first time you
  can actually afford it, so it always just reads "a great first purchase" — no
  more conditional caveat. Home-screen tips renumbered 3 & 4 of 4.

## v0.11.11 — 2026-06-17

- **Early stages eased further** (still too hard for new players): starting
  floor `DIFF_WAVE1` 1.6 → 1.4, and the chaos surge `levelScale` for early stages
  dropped (stage 1 0.4× → 0.2×, stage 2 0.7× → 0.6×). Stage 1 now ramps
  5 → 6 → 7 → 9 → 10 → 12 → boss, with the first three waves pure grunts/fast
  (Tough at wave 4, Bomber wave 6, Tank only on the boss wave). Later stages are
  essentially unchanged.
- **Tutorial copy fix.** The first-shop coach-mark now checks your coins: if you
  can already afford the Coin Generator it drops the "you don't have enough coins
  yet" preamble and just recommends it.

## v0.11.10 — 2026-06-17

- **Drop rate back to 5%** (`DROP_CHANCE`) — the 25% in v0.11.9 was a temporary
  value for on-device flair testing; the icon-only flair is approved, so drops
  return to their intended rate.

## v0.11.9 — 2026-06-17

- **Difficulty eased across the board** (it was too hard, esp. later stages):
  within-stage ramp `DIFF_PER_WAVE` 0.7 → 0.52, per-stage steepening `LEVEL_RAMP`
  0.35 → 0.25, and swarm size `CHAOS_SURGE` 36 → 26. Stage-6 late waves drop from
  ~ew 24 / 50 enemies / speed 161 to ~ew 17 / 44 / 133; stage 1 ramps 6→…→16→boss
  with Tanks only on its boss wave and no Shooters.
- **Drop flair simplified to icon-only** — the Health/Rapid pickup now just blooms
  its glowing icon at the kill spot and zooms toward the camera (the text-label /
  arc-banner experiments were dropped).
- ⚠️ **Drop rate temporarily 25%** (`DROP_CHANCE`) for on-device flair testing —
  to be reverted to 5%.

## v0.11.8 — 2026-06-17

- **Drop flair.** Grabbing a **Health** or **Rapid Fire** bonus now blooms its
  glowing icon at the kill spot and rushes it toward the camera (grows + fades),
  with a big colored label — **+25 HEALTH** (green) / **RAPID FIRE!** (gold) —
  zooming and fading alongside. New art (`drop-health/rapid.webp`, luminance-keyed
  to transparent) + `Effects.dropFlair()`; replaces the old tiny text popups.
  Reduce-motion gets a calm, no-zoom version.
- **Faster boot — fonts to WoFF2.** All five fonts converted (ttf kept as
  fallback); Chakra Bold 78 KB → 26 KB, the rest ~60% smaller.
- **Fixed: splash title appeared late on a cold load.** `font-display: swap` on
  every face (text draws immediately in a fallback, then swaps — no more invisible
  "MECH TIDE" during boot) + the splash fonts are now preloaded.

## v0.11.7 — 2026-06-17

- **Economy + difficulty tuning** (reacting to the chaos pass — more enemies
  inflated coins and made the early game spike):
  - **Coins down** — Grunt reward 5→3, Fast 6→4 (85% of kills), and the combo
    multiplier cap dropped 3× → 2.25× (`COMBO_BONUS_MAX` 2.0→1.25), which a chaos
    wave had been pinning at max the whole time.
  - **Drops halved** — bonus chance 8% → 4% (`DROP_CHANCE`); far more kills now
    meant far more rapid/heal/cash drops per wave.
  - **Stages 1–2 eased** — the chaos surge now scales in by stage (≈0.4× at
    stage 1, ≈0.7× at stage 2, full at stage 3+), so the early game floods are
    gentler. Stage 1 ramps ~6 → 7 → 10 → 13 → 15 → 20 → boss. Later stages
    unchanged.

## v0.11.6 — 2026-06-17

- **Chaos waves** (Callum's ask) — each stage now builds to a swarm concentrated
  in its final waves: a `frac²` count surge on top of the base, spawning fast
  enough to flood (stage 1 ramps ~7 → 9 → 14 → 20 → 26 → 35 → boss+23, capped at
  50). The swarm is mostly one-shot fodder (Grunt/Fast weights 20/8 → 30/12), so
  it stays survivable and gives **Piercing** real value — one shot clears a
  column. Dials: `CHAOS_SURGE`, `CHAOS_SPAWN_WINDOW`.
- **Auto-Laser nerf** — capped at **level 5** and given a **200px range** (under
  the shooter's 260 fire range), so it's now a close-in defense rather than a
  full-map auto-clear. Kids could previously win the early stages on Auto-Laser
  alone without ever firing the cannon; now the cannon is needed for anything at
  range. Shop shows `Lv N/5` and **MAXED** at the cap.

## v0.11.5 — 2026-06-17

- **Tank explosion is louder** — a tank death plays its pop at 2× the normal
  enemy-death gain (via a new optional gain multiplier on `play()`), so a tank
  going down reads heavier than a grunt.
- **Dev: boss test shortcut** (dev build only, stripped from prod) — press `B`
  (or call `rt2boss()`) in a battle to drop a lone boss with the player buffed
  to a super-cannon (no auto-laser/drone), for testing the boss move-loop +
  explosion sounds without grinding to a boss wave.

## v0.11.4 — 2026-06-17

- **New cannon-fire sound** for the main turret (replaces the original clip);
  gain dropped to 0.2 since the new clip is hot.

## v0.11.3 — 2026-06-17

- **Ultimates get recorded sounds + a purple shockwave.** Freeze / EMP / Warp
  now play dedicated clips (laser keeps its synth sweep), and each non-laser cast
  fires a fast purple flash — a bright wavefront ring + soft disc — ripping out
  from the tower past the screen edges in ~200 ms, so "purple = ultimate" reads
  at a glance. The shockwave replaces the old per-ultimate cyan/blue/green
  screen-flash on those three; it's skipped under reduce-motion / the perf
  throttle like the other full-screen flashes.

## v0.11.2 — 2026-06-17

- **Bomber squad explosions now read as a series.** The chain of pops fires one
  per plane *inside* the visual cascade (80 ms apart, in step with each plane's
  burst) instead of a ~10 ms cluster that smeared into a single blast — six
  planes, six distinct booms over ~400 ms. (A reduce-motion squad, which dies
  instantly, still gets the tight all-at-once burst.)
- **Splash holds ~2s.** Boot splash minimum on-screen time raised 0.5s → 2s so
  there's time to enjoy it on fast/cached loads (still dismisses immediately
  once assets are ready past that floor).
- **Shop buy click is louder.** The `upgrade` SFX gain went 0.6 → 1.6 (the
  source clip is quiet and bright; this pushes it past unity so the purchase
  actually registers).

## v0.11.1 — 2026-06-17

- **Music at half volume.** A master trim (`MUSIC_MASTER = 0.5`) drops the
  background track ~6 dB so it sits under the new SFX. Applied on top of the
  Music slider, so the slider still spans 0–100% and no saved preference
  changes — the track is simply half as loud at any setting.

## v0.11.0 — 2026-06-17

- **Enemy movement ambience + recorded tower fire.** New audio layer
  (`src/scenes/ambience.ts`): each enemy **type** on screen gets one looping
  "engine" bed (not one per instance — a swarm of grunts is a single bed), which
  starts/stops with that type's presence, fades in/out to avoid clicks, and
  follows the SFX volume slider live. The **grunt** adds a satellite layer over
  its engine loop — alternating beep/boop one-shots paced a couple seconds apart
  (timer = clip length + gap, so they never overlap themselves). Beds are killed
  on pause / game over / leaving the battle.
- **Tower firing sounds** swapped from the synth `shoot` blip to recorded clips:
  `cannon` (main turret), `auto_laser` (the Auto-Laser base zap, previously
  silent), and `drone_fire` (the drone's bolt — also previously silent on its
  main weapon). A small per-sound replay throttle (~50 ms) keeps a high fire
  rate from stacking into a muddy roar.
- **Explosions, enemy fire & wave clears** (recorded clips replace the synth
  blips): the boss death gets its own `boss_explosion`; every other enemy death
  picks one of three pop variations at random (throttled, so a mass wipe is a
  crunch not a wall); the shooter enemy's shot now uses the real `shooter-firing`
  clip; and clearing a non-boss wave plays a `wave_complete` sting (the boss /
  stage clear keeps its existing `level_clear` fanfare). A **bomber squad**
  blowing up fires a rolling chain of blasts — one pop per plane, ~10 ms apart,
  stacked on the audio clock so the whole formation goes off as one roar.
- **Tower hit.** An enemy crashing into the tower body now plays a recorded
  `tower_hit` thud (replacing the synth `hit` blip on that path); a shield-absorbed
  crash still plays the shield sound, and enemy *bullet* hits are unchanged.

## v0.10.5 — 2026-06-15

- **Boot splash screen.** Full-bleed splash art (square, cover-cropped so it
  works portrait & landscape) with a CSS-rendered **MECH TIDE** title (brushed
  silver + teal glow, scales to any aspect via `clamp`) and an animated
  **LOADING** dots indicator. Shows from first paint until the battle scene's
  assets are loaded, then fades out (min ~0.5s on screen; 9s hard-timeout safety).

## v0.10.4 — 2026-06-14

- **Analytics: track the furthest stage a player reaches.** Added a persisted
  `bestStage` high-water mark (in the save) and send it to PostHog as a
  `best_stage` **person property** (on run start + stage clear), so "highest
  stage per player" is a one-click distribution. (The stage was already on every
  run/wave/clear/game-over event as `level`, so it was derivable before — this
  just makes it a clean per-user attribute.)

## v0.10.3 — 2026-06-14

- **Fixed: clicking a HUD button fired a bullet** (desktop). Pressing Upgrades /
  Skill Tree / the Settings gear during battle no longer also fires the turret —
  the gun only fires when the press lands on the battlefield itself, not on a HUD
  button (gated on the pointer's `downElement`). Same guard added on touch.

## v0.10.2 — 2026-06-14

- **Renamed the game "Level" to "Stage"** everywhere it's player-visible (HUD,
  wave intro, home, death screen, "Stage X Complete", the achievement) so it no
  longer clashes with **Tower Level**. Tower Level and item upgrade levels ("Lv")
  are unchanged; internal code/save keys untouched.

## v0.10.1 — 2026-06-14

- **Decluttered the blue CTA buttons.** Dropped the ▸ play-triangle from the
  death-screen retry, the Upgrades "Start Next Wave / Resume", and the Skill Tree
  "Back to Base" buttons. Kept it on the Home screen's New Game / Continue.
- **Removed the Skill Tree legend** (the Owned / Can Buy / Locked key) — the node
  states are self-evident, so it was just clutter. (Orphaned CSS pruned.)

## v0.10.0 — 2026-06-14

- **Mobile battle-HUD redesign** (hud-joystick-handoff; touch only — desktop is
  unchanged):
  - **Skill Tree + Upgrades moved to the top bar** (they pause the game, so
    they're not in the thumb zone), with the new **Upgrade chip icon** replacing
    the triangle. Gear sized up.
  - **Bottom = AIM joystick + ultimate FIRE orb** as mirrored corner twins with
    a clear dead zone between them (no more accidental taps). The joystick is now
    a styled DOM puck (gradient base, direction ticks, tracking knob) that drives
    the gun heading; hold it (or press the field) to fire.
  - **Settings → Joystick side (L/R)** now mirrors the whole pair.
  - The ultimate slot is **reserved when empty** ("NONE") so the layout never
    shifts mid-run; ready shows the purple FIRE orb, cooldown the countdown arc.

## v0.9.9 — 2026-06-14

- **Volume sliders now follow perceived loudness** (Sound + Music). Hearing is
  ~logarithmic, so a linear slider barely changed across its top half; both
  sliders now apply an `x²` taper to the gain (`perceptualGain` in audio.ts), so
  50% sounds roughly half as loud. Stored value / displayed % unchanged; 0 still
  mutes.

## v0.9.8 — 2026-06-14

- **Fixed the music slider on mobile** (was binary — any level played at full).
  iOS ignores `HTMLMediaElement.volume`, so setting the `<audio>` element's
  volume did nothing there. Music now routes through the same Web Audio context
  as the SFX and its level is set via a gain node (which iOS honors), so the
  slider scales smoothly on mobile too. Desktop unchanged.

## v0.9.7 — 2026-06-14

- **Session replay turned off.** `SESSION_REPLAY = false` — the SDK no longer
  records sessions (it was on only for the friend test, and wasn't earning its
  keep). Anonymous playtime/progression/FPS analytics is unaffected.

## v0.9.6 — 2026-06-14

- **Bust LinkedIn's stale preview cache** — the share image moved to a fresh URL
  (`og-image-v2.png`). LinkedIn had pinned a tiny favicon fallback from before
  the `og:image` existed (pre-v0.9.5) and wouldn't re-fetch the same URL; a new
  URL forces a clean crawl of the full 1200×630 card.

## v0.9.5 — 2026-06-13

- **Link previews (social "unfurl" cards).** Added Open Graph + Twitter Card
  meta tags + a 1200×630 key-art image (Claude Design's "Hold the center" card),
  so sharing mechtide.com on Facebook / iMessage / Slack / Discord / X / LinkedIn
  shows a proper title, description, and image instead of a bare link.

## v0.9.4 — 2026-06-13

- **No more firing mid-swing.** When you tap a new direction, the gun holds fire
  until it has swung onto the target heading (within ~11°), so shots land where
  you tapped instead of spraying the angles it sweeps past. Sustained fire still
  keeps up while you track a moving aim.

## v0.9.3 — 2026-06-13

- **Reverted always-fire — hold to fire again.** Always-fire (v0.9.0) left too
  little to do ("you just sit there"). The turret now fires only while held:
  press/hold anywhere on the field (aim there + fire), or hold the corner stick
  (aim + fire); lifting stops it. Desktop is back to hold-left-mouse. The new
  aiming (corner stick + tap/hold) stays.

## v0.9.2 — 2026-06-13

- **Renamed the "Auto-Shooter" upgrade to "Auto-Laser"** (display name only;
  mechanics, cost, and save data unchanged). SPEC updated to match.

## v0.9.1 — 2026-06-13

- **Smaller aim-stick, tucked tighter into the corner** — ring radius 62 → 50px,
  corner margin 26 → 14px (grab zone scales with the radius).

## v0.9.0 — 2026-06-13

- **The turret always fires now** (both platforms). Aiming is the whole game;
  you no longer hold/tap to shoot — input only steers the gun. *(Balance note:
  this raises player DPS uptime — early waves clear noticeably faster. Flagged
  in TODO for the balance pass.)*
- **New mobile controls.** Two ways to aim, both live at once:
  - **Tap (or drag) anywhere** to point the turret there — momentary, so your
    finger doesn't camp on the battlefield like the old floating stick did.
  - **A fixed corner aim-stick** for smooth tracking, anchored in one bottom
    corner. Touches inside it drive a relative analog aim; touches elsewhere are
    taps. The other controls move to the opposite corner so nothing's under it.
- **Settings → Joystick side (Left / Right)** — handedness toggle that mirrors
  the whole bottom HUD; persisted. Touch only.
- Desktop is unchanged: cursor aims, layout stays skills-left / upgrades-right /
  ultimate-center (no on-screen stick).

## v0.8.59 — 2026-06-13

- **FPS analytics.** The battle loop already measured a smoothed frame rate for
  the quality throttle; now it also samples it for analytics and emits an `fps`
  event per window (`fps_avg`, `fps_min`, `slow_pct`, `samples`) — flushed every
  60s of active play and on level-clear / game-over / tab-hide, never per frame.
- **`platform` + `dpr` super-properties.** Every event is now tagged
  `platform` (`web` now; `ios`/`android` once the Capacitor build ships) so FPS
  and everything else can be sliced native-vs-web, plus `dpr` to help classify
  devices on the web (where the exact model isn't exposed).

## v0.8.58 — 2026-06-13

- **Tutorial coach-marks redesigned** (Claude Design handoff). The flat arrow is
  now a glowing **bouncing double-chevron** that points at its target; the bubble
  got a glassy fill, HUD **corner brackets**, a **"TIP n OF 3"** counter, a caret
  notch, and cyan keyword highlights; the spotlight now cuts a **soft-edged hole
  with a crisp cyan ring** around each target instead of a hard rectangle.
- **Responsive placement.** The coach-mark keeps the on-brand top-centered look
  when it fits, but on a short landscape screen — where two targets (Tower chip +
  Skill Tree) straddle the middle — it drops into the roomier side column with a
  capped width and a chevron aimed at each target, so the bubble never covers a
  spotlight. Verified at desktop, phone-landscape, and phone-portrait.

## v0.8.57 — 2026-06-13

- **Drone cost always climbs now.** It used to dip (deploy 🪙100 → first upgrade
  🪙80); the upgrade base is raised to 120, so it's 100 → 120 → 192 → 307 → ….
- **Removed the faint blue rings** drawn around the tower.
- **No more per-kill camera "jiggle."** Only a boss kill shakes the screen;
  routine kills (incl. Auto-Shooter clearing waves) keep their burst + sound but
  no longer shake the view — that's what felt like the tower jiggling every
  other shot.

## v0.8.56 — 2026-06-13

- **Tower sits centered on the pad on every level.** Re-centered the pad in 11
  backgrounds using Shannon's marked centers — most visibly bg2/bg6/bg13
  portrait (pad was off to the side/top). Each off-center image was cropped a
  sliver on its far edge so the pad lands at the image center, which keeps the
  tower on it at *all* resolutions (vs. a per-device CSS nudge). The rest were
  already centered.

## v0.8.55 — 2026-06-13

- **Generator coach mark** now spotlights just the Generator card (not the whole
  ECONOMY row), so the bouncing arrow points right at it.
- **Tower modal** locked LEVEL UP button uses the custom padlock graphic
  (`art/lock.webp`) instead of the OS emoji.

## v0.8.54 — 2026-06-13

- **Home tower-upgrade modal redesigned** (per mock): tower image, big
  `LEVEL N → N+1` with a pip bar + "X levels remaining", a "WHAT LEVEL N GIVES
  YOU" current→next breakdown (Coins Earned ×, Max Tower HP, Starting Coins —
  real values, coins + icons, never "$"), and a YOUR CORES / LEVEL UP footer
  that locks to "You need X more cores" when short. (The shop's compact banner
  is unchanged.)
- **Fresh saves start SFX at 50%** (music was already 50%).
- **Analytics never fires from localhost** (the Claude Code preview / local
  `vite preview`), so test traffic can't reach the data — no per-session
  opt-out to remember.

## v0.8.53 — 2026-06-13

- **Tutorial coach marks** (shown once each, remembered in the save). A dark
  scrim with spotlight cutouts, a bouncing arrow at each target, a text card,
  and a close X (bounce respects reduce-motion). Three moments:
  1. After clearing wave 1 of level 1 → in the shop, spotlights the **Coin
     Generator** as a good first buy.
  2. After clearing **Level 1** → on Home, explains that coins + field upgrades
     reset each level but Tower Level and Skill Tree unlocks are permanent.
  3. After clearing **Level 2** → on Home, spotlights the **Tower** box and
     **Skill Tree** button (Cores raise your tower and unlock skills).

## v0.8.52 — 2026-06-13

- **Removed "Transfer save"** (export/import) from Settings.
- **Upgrade your tower from Home.** Clicking the "TOWER Lv X" box on the home
  screen opens a modal with the same TOWER LEVEL → LEVEL UP banner as the
  Upgrades shop, so you can spend Cores on the tower without starting a run.
  Banner extracted to a shared module (towerBanner.ts) so shop + modal match.

## v0.8.51 — 2026-06-13

- **Custom domain: mechtide.com.** Vite base path `/mech-tide/` → `/` (served
  at the domain root) and added `public/CNAME`. DNS is 4 apex A records to
  GitHub Pages + a `www` CNAME. Finish in GitHub repo Settings → Pages (set the
  custom domain, enable HTTPS once the cert provisions). The old
  shantheman.github.io/mech-tide URL auto-redirects to the new domain.

## v0.8.50 — 2026-06-13

- **Session replay ON for the friend test** (`SESSION_REPLAY` flag in
  analytics.ts). CSP updated for replay (`worker-src blob:`). ⚠️ Must be turned
  OFF before any public release — flagged on the launch checklist. (Requires
  enabling Session + Canvas recording in PostHog project settings; canvas
  capture is a dashboard toggle, else the Phaser battle records blank.)
- **Self-exclude opt-out:** load the game once with `?notrack=1` to keep your
  own sessions (events + replays) out of the data; `?notrack=0` undoes it.
  Persisted per browser — PostHog never loads on opted-out devices.

## v0.8.49 — 2026-06-13

- **Analytics live.** Set the PostHog project key (US cloud) — playtime +
  progression now flow, tagged `app = mech-tide`. Verified ingestion returns OK.
- **CSP allows PostHog.** The deploy CSP was `connect-src 'self'`, which would
  have silently blocked every event; added `us.i.posthog.com` /
  `us-assets.i.posthog.com` to `connect-src` (+ assets host to `script-src`).

## v0.8.48 — 2026-06-13

- **Analytics events tagged `app: "mech-tide"`** so the game can share a single
  PostHog project with other games (free-tier = one project); separate them by
  filtering insights/dashboards on `app = mech-tide`. Still inert until a key
  is set.

## v0.8.47 — 2026-06-13

- **Anonymous analytics wiring (PostHog).** Added `src/analytics.ts` and
  instrumented playtime + progression for the friend test: `app_open`,
  `run_started`, `wave_cleared{level,wave}`, `level_cleared{level}`,
  `game_over{level,wave}`, and `playtime{seconds}` (active battle time, summed
  per anonymous per-browser user). No PII; off in dev. **Inert and zero-bundle
  until a `POSTHOG_KEY` is set** — the SDK is dead-code-eliminated while the key
  is blank, so this ships doing nothing until configured. Same code runs in the
  Capacitor webview and queues offline.

## v0.8.46 — 2026-06-13

- **Home menu labels align.** Gave the menu-button icon a fixed-width slot so
  CONTINUE / SKILL TREE / SETTINGS all start at the same x — the wider tree icon
  was pushing "SKILL TREE" out of line with the ▸/⚙ glyph buttons.

## v0.8.45 — 2026-06-13

- **Home Settings gear is grey**, matching the header gear (`var(--dim)`)
  instead of the default cyan.

## v0.8.44 — 2026-06-13

- **New Skill Tree icon.** Replaced the hexagon glyph/SVG with the connected-
  nodes `skill-tree-icon.png` on the Home menu button and the mobile battle HUD.
  Applied as a CSS mask (`.tree-glyph`) so it inherits the button's green like
  the icon it replaced, rather than baking in a fixed colour.

## v0.8.43 — 2026-06-13

- **Drone body swivels at a capped rate.** The drone used to snap its facing to
  its direction of travel instantly; now the nose eases toward its heading at
  `DRONE_TURN_RATE` (5 rad/s ≈ 0.6s for a 180° turn). Separate knob from the
  accel/decel momentum.

## v0.8.42 — 2026-06-13

- **Drone `DRONE_ACCEL` → 900.** Right at the settle-vs-circle threshold:
  clear momentum through turns, but still brakes cleanly on arrival (no
  orbiting). Tuning sweep landing point — easy to nudge ±.

## v0.8.41 — 2026-06-13

- **Drone `DRONE_ACCEL` → 200** (was 1200) to feel out the floaty extreme: ~3s
  to reverse full speed, and it overshoots/circles its target since it can't
  brake within the arrive radius. Experimental — expect to dial back up.

## v0.8.40 — 2026-06-13

- **Drone turns are softer.** `DRONE_ACCEL` halved (2400 → 1200) so the drone
  carries more momentum through direction changes — less of the instant snap
  when its target dies and it re-aims at another. Easy to nudge back up.
- **Friendlier upgrade descriptions.** Spelled out the stat-screen shorthand on
  the Upgrades cards (e.g. Main Turret `+dmg, rate, size` → "more damage, fire
  rate & size"; Multi-Shot `+1 bullet / lvl` → "+1 bullet per level"; "drone
  swats projectiles" → "Drone shoots down enemy fire"). Kept `Lv N` and `HP` as
  the standard short forms.

## v0.8.39 — 2026-06-13

- **Adaptive effects throttle (safety net for slow devices).** If a device's
  smoothed FPS drops below ~48 (or reduce-motion is on), explosion particle
  counts thin (`FX_LITE_SCALE`) and full-screen flashes are skipped, cutting the
  additive overdraw that's the heaviest moment in a fight. Recovers with
  hysteresis once FPS climbs back. Devices that hold framerate never trip it —
  **no effect on capable hardware** (verified: a 118fps machine stays at full
  quality). No blanket resolution cap — that would soften capable high-DPI
  devices; dropping resolution only while FPS is low is held as a later lever.

## v0.8.38 — 2026-06-12

- **Drone flies with momentum.** The drone used to move at a constant speed
  straight at its target spot, so it flipped direction instantly (5 mph right →
  5 mph left). It now carries a velocity and accelerates/decelerates toward
  where it wants to be — banking through direction changes and easing in as it
  arrives, instead of snapping. Still quick (reverses full speed in ~0.25s);
  tunable via `DRONE_ACCEL` / `DRONE_ARRIVE_RADIUS`. Top speed is unchanged.

## v0.8.37 — 2026-06-12

- **Tower beams draw above the base, below the gun.** The auto-shooter zaps
  (and the ultimate laser) lived on the effects layer *under* the base, so a
  zap leaving the blue ring was hidden by the base and only showed past its rim.
  They now render on a dedicated layer between the base and the gun barrel, so
  the zap reads as leaving the ring while the barrel still sits on top.

## v0.8.36 — 2026-06-12

- **Auto-Shooter lights up the base.** Once you own Auto-Shooter, the tower base
  swaps to a version with a glowing blue ring round the hub (`base_blue.png`),
  and its zaps now leave that ring — at the point facing the target, so each
  zap reads as a straight line out of the middle of the base instead of from
  the tower centre or the sprite edge. Ring radius is tunable
  (`AUTO_RING_RADIUS_FRAC`). Updates live the moment you buy Auto-Shooter.

## v0.8.35 — 2026-06-12

Turret firing + feel fixes:

- **Rounds now leave the muzzle, not the base.** Every shot spawns at the gun's
  barrel tips out front and then fans to its spread angle. Before, each round
  started its travel distance along its *own* wide angle, so the outer shots of
  a 3-/4-/many-fan appeared to spawn back around the base. Most obvious on 4+.
- **Gun points at the shot fan's centre so the barrels match the spread.** The
  fan is asymmetric (one round straight at the cursor, extras to alternating
  sides), so for even shot counts (2, 4, …) the gun now aims at the fan's
  centroid — a slight skew off the cursor — so its symmetric barrels straddle
  the rounds instead of looking mismatched. Odd counts (1, 3, …) still point
  dead at the cursor. The straight round always flies at the cursor.
- **Smoother turret sweep.** The gun heading now eases toward the cursor each
  frame (frame-rate independent, `AIM_SMOOTH_RATE`). The long barrel was
  amplifying brief gaps in the pointer's position updates during fast circles,
  reading as a stutter; easing smooths it. Gun, laser, and bullets all read the
  same eased heading, so nothing lags relative to anything else.

## v0.8.34 — 2026-06-12

- **Home + shop turret art matches the battle gun.** The home-screen hero
  turret and the shop's "Main Turret" thumbnail now use the new single-barrel
  art (`turret_gun_1.png`) with the matching 86% pivot, so the menus and the
  battlefield show the same gun. The old twin-barrel `turret_gun.png` is no
  longer referenced anywhere.

## v0.8.33 — 2026-06-12

- **Turret gun art swaps with your shot count.** The main tower's swiveling gun
  now shows a barrel set that matches how many bullets a shot fires
  (`1 + Multi-Shot`): single (1), double (2), triple (3), then a multi-barrel
  "many" for 4+. New art (`turret_gun_1/2/3/many.png`), new rotation pivot
  (86%), and the single-barrel variant fires straight from center. The art
  updates live the moment you buy Multi-Shot.
- **Playground:** the reference turret uses the new art with a **bullets-per-shot
  (1 / 2 / 3 / many)** selector to preview each variant.
- (Decorative home-screen + shop turret thumbnails still use the old
  twin-barrel art for now.)

## v0.8.32 — 2026-06-12

- **Purchase ping on the Upgrades page.** Buying a card now flashes a copy of
  its blue border that quickly grows and fades out — a visual "got it"
  confirmation on the box you picked, alongside the upgrade chime. Works on
  the field cards and the Tower Level Up button; skipped under reduce-motion.
  (The Tower Level Up still uses the same ping for now — a bigger, distinct
  animation for the headline upgrade is left as a follow-up in TODO.)

## v0.8.31 — 2026-06-12

- **Good-guy fire is core-blue.** The tower's gun rounds (and muzzle flash) and
  the Auto-Shooter's zap are now a light blue (`PLAYER_BULLET_COLOR` /
  `AUTO_SHOOTER_COLOR` `0x8ec9ff`) instead of warm yellow — leaning into the
  blue Cores powering the defenders. Light enough to read on the dark floor.

## v0.8.30 — 2026-06-12

- **Drone is 2× bigger** (DRONE_RADIUS 11 → 22) — body, fans, and shadow scale
  together. Purely on-screen size; no gameplay effect (range/medic/interceptor
  use separate constants).

## v0.8.29 — 2026-06-12

- **New animated drone.** The player's drone is now a quad-frame body with a
  glowing core and **4 spinning fans**, one per hole (N/E/S/W). Fans sit under
  the body so the frame rim hides their edges (recessed look) and counter-rotate
  in pairs; the spin freezes under reduce-motion. Tunable via `DRONE_FAN`
  (`offset` / `scale` / `spinRads`).
- **Drone added to the Animation Playground** — selectable like an enemy, with
  live **Fan offset / scale / spin** sliders and a Copy-config that emits the
  `DRONE_FAN` line.

## v0.8.28 — 2026-06-12

- **Upgrade sound** (Win03) plays on a successful purchase in the Upgrades shop
  (field upgrades + Tower Level Up). Those buttons opt out of the generic UI
  click (`data-sfx="none"`) so it's the chime, not a double-up.
- **Celebration sound moved to level complete.** The big-win sting now plays
  only when you finish a level (the boss wave), not on every wave clear.
- Added a TODO for upgrade-screen animations (expanding-outline ping on the
  bought card; a bigger one for Tower Level Up).

## v0.8.27 — 2026-06-12

- **More sound effects.** The ranged **Shooter** now has a fire sound, **clearing
  a wave** plays a celebratory sting, and a **click** sound plays on every UI
  button press (broad brush — specific buttons can be carved out later). All ride
  the file-SFX system, so they respect the **Sound** volume and per-clip gains.

## v0.8.26 — 2026-06-12

- **Boss-fire sound effect.** The boss now plays an impact sound each time it
  fires at the tower. Added a small file-based SFX system: clips are fetched +
  decoded into the same Web Audio pool as the synth sounds, so they share the
  **Sound** volume gate and the autoplay unlock — and stay low-latency and
  overlappable. Adding more SFX is now a one-line entry in `FILE_SFX`.

## v0.8.25 — 2026-06-12

- **Background music.** A looping soundtrack plays across the whole game
  (streamed MP3, ~3.5 MB, converted from the source WAV). Settings now has two
  independent sliders — **Sound** (the synth SFX) and **Music** — each with
  **0 = off**, and both persist in the save. Music starts on the first
  tap/click (browser autoplay policy) and pauses when the tab is hidden.

## v0.8.24 — 2026-06-12

- **The game is now MECH TIDE** — Callum's pick (renamed from "Core Defender").
  The name was conflict-checked across Steam, the Apple App Store, and Google
  Play before committing. Home screen, browser tab, repo, and the live URL all
  updated; the repo/Pages address moves to
  **https://shantheman.github.io/mech-tide/** (the old `/core-defender/` URL
  retires). Saves are untouched — the storage key is internal and frozen.

## v0.8.23 — 2026-06-12

- **Hid the Animation Playground link** from Settings. The playground page is
  still built and live at `/playground.html` (direct URL) — just no longer
  surfaced in-game.

## v0.8.22 — 2026-06-12

- **Grunt dish pivot corrected** to Shannon's marked spot: pivot `0.545,0.475`
  → `0.506,0.464` (detected from the blue-dot reference, pixel-identical
  framing to the texture). The dish now swivels about its true mount.

## v0.8.21 — 2026-06-12

- **Size tweaks:** Tank 20% smaller (radius 34.6 → 27.68), Boss 20% bigger
  (radius 40 → 48). Radius is also the hitbox, so it scales with each.

## v0.8.20 — 2026-06-12

- **Boss faces the right way + fires from its turret.** The boss art was
  approaching backwards (guns pointing away from the tower) — rotated the
  sprite 180°. Its covering fire now spawns from the central turret muzzle
  (forward of center toward the tower, `BOSS_FIRE.muzzleForward`) instead of
  the sprite's center.

## v0.8.19 — 2026-06-12

- **New Boss art** (a hulking mech) and **boss covering fire.** The boss now
  lobs projectiles at the tower as it advances (on top of its melee crash),
  scaling with the game level: at level 1 just a shot or two of chip damage
  over its slow trek, ramping to a faster, harder barrage later. Cooldown
  `max(0.9, 6.0 − 0.7·(level−1))` s, damage `4 + 4·(level−1)` (`BOSS_FIRE`).
  The drone's interceptor can swat these like any enemy round.

## v0.8.18 — 2026-06-12

- **Tank is 33% bigger** (radius 26 → 34.6) and re-tuned: sits lower and stops
  wobbling (`tank: { altitude: -12 }`). As with the other size bumps, radius is
  also the hitbox, so it scales too.

## v0.8.17 — 2026-06-12

- **New Tank enemy art** (enemy_2, Shannon's drop) — armored hull with a glowing
  reactor core. Same 1px export frame stripped as the earlier drops.

## v0.8.16 — 2026-06-12

- **Playground export now keeps `hexSnap`** (dev tool): structural fields that
  have no slider (currently just the shooter's `hexSnap: 6`) are carried
  straight from config into the Copy-config output, so pasting a full
  ENEMY_ANIM block round-trips without silently dropping them.

## v0.8.15 — 2026-06-12

- **Tough now hovers** (Shannon's tune): altitude 0.5, a 10px hover bob at
  2.2 Hz — it floats and casts a fading detached shadow instead of sitting
  flat. Other enemies' anim values unchanged.

## v0.8.14 — 2026-06-12

- **Grunt, Tough, and Fast are 50% bigger.** Bumped their hit radius ×1.5
  (grunt 14→21, fast 10→15, tough 15→22.5), which scales the sprite, shadow,
  and grunt dish proportionally. Note: radius is also the hitbox, so they're
  correspondingly easier to hit and reach the tower a hair sooner — shout if
  you want the visual decoupled from the hitbox.

## v0.8.13 — 2026-06-12

- **Grunt dish casts a drop shadow.** Like the tower gun's, the radar dish now
  throws a soft black silhouette onto the body — dropped down-right, swiveling
  with the dish, drawn in the gap between dish and base — so it reads as
  sitting above the hull. Tunable per enemy (`shadowAlpha`, `shadowDrop`).
- **New Tough enemy art** (enemy_3, Shannon's drop).
- **Cleaned a 1px export frame** off the new grunt + tough sprites (a faint
  semi-transparent border ring the art shipped with); sub-pixel at game size,
  but now they're clean cutouts.

## v0.8.12 — 2026-06-12

- **Grunt is a radar tank now.** New two-part art (Shannon's drop): a tank
  body plus a satellite dish that mounts on the body's central plate and
  swivels on its own — it rotates to a random heading, holds for a beat, then
  re-aims, continuously. The dish pivots about its mount (origin pinned to the
  clamp at 0.545, 0.475 of the shared canvas) and rides the body as it turns to
  face the tower. Generic: any enemy can now declare a `satellite` overlay in
  config. Honors reduce-motion (dish freezes, still seated). Previewable and
  tunable in the Animation Playground.

## v0.8.11 — 2026-06-12

- **Explosion grey-square artifact fixed (for real).** v0.8.9/v0.8.10 chased
  the wrong causes (breathe, canvas corners, smoke); the true culprit was the
  particle *textures* themselves. The soft radial gradients had non-zero RGB at
  their zero-alpha outer stop, so the additive pipeline summed that dark colour
  across each full texture quad — invisible per particle, but at frame 0 when a
  dozen particles stack on one point the fringes piled into a visible grey
  square. Rebuilt `burst()` entirely from tweened solid circles (no canvas
  textures, no particle emitters): a flash, shockwave ring, fireball chunks,
  and sparks, all additive. Geometry has no quad and no fringe, so the artifact
  is structurally impossible now.
- **Bomber squadron no longer freezes solid-white on death.** The hit-flash
  tint is now cleared the instant a formation dies, so the planes explode in
  their own colours through the cascade instead of sitting white for ~0.5 s
  (once dead they leave the update loop that would otherwise clear the tint).

## v0.8.10 — 2026-06-12

- **Explosion black-square artifact fixed.** Particle canvas textures
  were drawn with `fillRect`, which painted the full rectangle including
  corners outside the radial gradient — those pixels rendered as opaque
  black in WebGL. Switched to `arc()` + `fill()` so only the circular
  gradient region is ever painted; corners stay transparent.

## v0.8.9 — 2026-06-12

- **Animation retune + breathe removed.** All enemies updated to
  Shannon's final ENEMY_ANIM values (altitude-based positioning, revised
  bob/wobble per enemy). The breathe scale-pulse feature is removed —
  `breatheAmp`/`breatheHz` stripped from the interface, runtime, and
  playground sliders.

## v0.8.8 — 2026-06-12

- **Shooter rotation aligned.** Hex-snap faces were offset by 30°, so
  the shooter was firing from between its weapon ports. Added a π/6
  half-step to every snap target so a weapon port always faces the tower.

## v0.8.7 — 2026-06-12

- **Bomber squadron: full hitbox + cascade explosion.** All 6 planes
  are now valid bullet targets (previously only the leader counted).
  They share a single HP pool, so any hit damages the formation. On
  kill, whichever plane took the killing shot explodes first; the other
  five chain-react nearest-to-farthest in 80 ms steps — six rapid
  fireballs rippling through the formation.

## v0.8.6 — 2026-06-12

- **Shooter rotates like it has a brain.** The hexagonal shooter pod now
  snaps to its 6 discrete faces instead of smoothly tracking the tower.
  While flying in it idles through random face changes (1–2 s per side);
  once it's in firing position it rotates to a fresh random face just before
  each shot — a subtle pre-shot tell. All other enemies are unaffected.

## v0.8.5 — 2026-06-12

- **Particle explosions.** `burst()` now uses Phaser's particle emitter system
  with three soft radial-gradient textures generated at runtime (no new assets):
  fire (additive blend — glows orange against dark backgrounds), smoke (expands
  as it drifts upward), and sparks (fast outward, additive). The flash and
  shockwave ring are kept as crisp geometry. Looks like a real game explosion.

- **Bomber fixes.** Planes scaled down (radius 10 → was 16), formation offsets
  tightened. Each wing plane now casts its own shadow, forming a mini V-shadow
  below the main formation.

## v0.8.4 — 2026-06-12

- **Bomber is now a squadron.** enemy_4 replaced with a sleek top-down
  fighter jet (bomber-v2.png); six copies fly in a tight V-formation toward
  the tower. Each wing plane drifts independently (per-plane sine phase) while
  the group bobs and wobbles as one unit — giving a living, undulating swarm
  feel without any extra assets.

## v0.7.8 — 2026-06-12

- **Animation Playground** (dev tool, Settings → Animation playground): a
  standalone page to view each enemy in its states (idle / moving / firing /
  explode) and tune the procedural-animation values live, then copy them
  into config. Uses the exact same animation code as the game, so what you
  tune is what you get. Harmless if the link leaks.

## v0.7.7 — 2026-06-12

- **Enemies feel alive (procedural animation, prototype).** No new art — the
  existing sprites now breathe (idle scale pulse), flyers hover with a
  bobbing float and a fading ground shadow, twitchy units wobble, and the
  shooter swells as it charges a shot (a readable telegraph). All tunable
  per enemy in config; freeze pauses it and slow-mo slows it. Honors the
  Reduce-motion setting (those players keep static enemies).

## v0.7.6 — 2026-06-12

- **Resizing the window re-fits the arena.** The playfield was sized once at
  load; now any shape change — a desktop window resize as well as a phone
  rotation — re-fits the arena to fill the new screen. It applies at the
  next Home screen (every level ends there), so an in-progress run is never
  interrupted or lost. Phones still only react to real rotations, not the
  address-bar showing/hiding.

## v0.7.5 — 2026-06-12

- **Enemies enter from the true screen edges now.** The arena was a fixed
  4:3 box letterboxed onto wider screens, so on desktop enemies appeared
  to spawn well inside the playfield (the dead space showed background).
  The world now matches your window's shape, filling it edge to edge —
  the tower stays the same on-screen size, the arena just gets as wide
  (or tall) as your screen. Worst-affected was desktop; phones improve too.

## v0.7.4 — 2026-06-12

Balance: **Repair and Plating are once per level now** (Shannon's call —
stacked, they made the tower effectively unkillable, especially with
mid-wave panic-buys through the pause shop). Spent cards show "✓ USED"
until the next level. The caps are config knobs (REPAIR_MAX_BUYS /
PLATING_MAX_BUYS) if playtests say once is too strict.

## v0.7.3 — 2026-06-12

- **Transfer your save**: Settings → Transfer save. EXPORT copies a save
  code; IMPORT loads one (with a SURE? confirm — it replaces the current
  progress). Carry progress between phone and desktop, and across the
  upcoming domain move.
- **Crash safety net**: if the game ever breaks, a friendly banner with a
  RELOAD button appears (progress is saved) instead of a silent freeze.

## v0.7.2 — 2026-06-12

The code-health pass (player-visible bits listed; the rest is internal):

- **Rotating your phone now sorts itself out**: flip orientation and the
  game re-fits at the next safe moment — instantly on the Home screen,
  otherwise when you next return there (mid-battle stays playable
  letterboxed until then).
- Under the hood: BattleScene split into focused modules (drone, effects,
  shadows), a Playwright end-to-end suite that plays the game in CI,
  vitest 4 (audit clean), SHA-pinned CI actions, a production Content-
  Security-Policy, HTML-escaping discipline, and assorted housekeeping.

## v0.7.1 — 2026-06-12

Shadow realism pass (Shannon's review of v0.7.0) + 14 more battlefields:

- **Shadows are silhouettes now**: every unit casts its own shape, tinted
  black — a top-down view demands it (the old soft ellipse read like the
  unit was standing on its side). Shadows rotate with their owner.
- **Light from the top-left**: all shadows fall down-right, consistently.
  Land units show a visible rim past their feet; flyers stay detached.
- **The tower casts shadows too**: a grounded rim under the base, and the
  swiveling gun throws its silhouette onto the base as you aim.
- **Backgrounds 3–16**: a full 15-level run never repeats a battlefield.
  Sets 6+ are landscape-only; their portrait variant is a 90° rotation
  (radial compositions make this safe).
- **Home knows why you're there**: clearing a level now greets you with
  "LEVEL N COMPLETE — CORES BANKED" and a NEXT LEVEL button instead of
  "welcome back, defender".

## v0.7.0 — 2026-06-12

The battlefield gets real ground under it:

- **Level backgrounds** (Shannon's art drop): the metal launch deck and the
  cracked crater, alternating per level — more on the way; the list in
  config.ts just grows. The pad in the art sits exactly under the tower at
  any window size or orientation (center-aligned by construction), with a
  dedicated portrait variant for phones.
- **Enemy drop shadows**: land robots (grunt, tough, tank, boss) cast a
  tight dark shadow at their feet; flyers (quadcopter, bombers, the shooter
  pod) cast a smaller, fainter one offset well below — the gap reads as
  altitude. The player's drone got one too, so it isn't the only thing
  flying shadowless.
- The CSS grid floor retires during battles — the art is the floor now.

## v0.6.2 — 2026-06-11

- **Floating footer on Upgrades + Skill Tree** (new mocks): the big CTA and
  your balance (coins in the store, cores in the tree) now ride a pinned
  bar at the bottom of the screen instead of hiding below the fold on
  phones. Applied on desktop too — same bar, same reason, shorter windows.
- The currency readout moved out of the panel headers into that bar.

## v0.6.1 — 2026-06-11

- **Favicon**: the crystal core in the browser tab, plus an apple-touch-icon
  (navy-backed) for iOS home screens.
- **Save durability, pinned by tests**: updates never wipe progress — the
  loader fills missing fields with defaults, ignores unknown fields, and
  shrugs off corrupt saves. (Deploys never could touch localStorage; now a
  schema change can't either.)

## v0.6.0 — 2026-06-11

Shannon's art drop — the last text-only corners get real paint:

- **Auto-Shooter** finally has its own icon (a proper tower-mounted
  auto-turret), and **Interceptor** + **Field Medic** ship with their
  quadcopter art in both the store and the skill tree.
- **Currency went painterly**: the gold coin (single on every price chip,
  a coin *stack* in the corner money displays) and the crystal **core**
  replace the old CSS circle/diamond everywhere — battle HUD, store,
  skill tree, home, and achievement bounties.
- The game's new address: **https://shantheman.github.io/core-defender/**
  (repo renamed to match the new name; the old URL is retired).

## v0.5.1 — 2026-06-11

- **The game is now CORE DEFENDER** — Callum picked the name from the design
  mocks over the working title "Robot Tower". Home screen, browser tab, and
  all docs updated. Saves are untouched (the storage key is internal).

## v0.5.0 — 2026-06-11

Two new Drone skills (the branch grows to 4 nodes, tree total 1,880 cores):

- **Interceptor** (200 cores, then 250 coins/run): the drone shoots down
  enemy projectiles that enter its range — one swat every 0.35s, with a
  zap + spark so you see every save. The shooter counter.
- **Field Medic** (250 cores, then 300 coins/run): whenever the drone has
  no enemy in firing range — flying, repositioning, or a clear field — it
  repairs the tower at 2 HP/s with a green tether pulse. Offense or
  sustain: the drone now has a job every second of the wave.

## v0.4.1 — 2026-06-11

- **Twin Targeting now follows the rules**: unlock it in the tree, then buy it
  in-battle (200 coins, once per run) like every other tree power. It was the
  only node that auto-granted — an inconsistency inherited from the original.
- Auto-Shooter recategorized under CANNON (it's the tower's auto-turret, not
  a drone) and untangled from the quadcopter art.

## v0.4.0 — 2026-06-11

The art update (Claude Design icon drop, docs/design/ICONS-AND-PANELS-SPEC.md):

- **Upgrades store**: every card now carries its painterly icon, bleeding in
  from the right edge under a legibility scrim — merchandising-style. Grids
  fixed at 5 / 4 / 2 columns (desktop / landscape / portrait). Unaffordable
  cards desaturate their art.
- **Skill tree**: compact 46px icon tiles on every node (deliberately smaller
  than the store — the tree is a map, the store is a shelf).
- 15 icons shipped as webp (95KB total, converted from the 240px PNG drop).

## v0.3.1 — 2026-06-11

Explosive Rounds actually explode now:

- Blast radius **100px base, +25 per level** (was a fixed 60 — too small for
  how spread out enemies are). Splash damage **16 base** (one-shots Fast),
  still +6 per level.
- Every splash victim shows an orange **damage number**, and the shop card
  lists the real splash/range numbers per level.

## v0.3.0 — 2026-06-11

Achievements get their windows back (the system always worked — silently):

- **Trophy button** in the Home top bar opens the achievements modal
  (two columns on desktop, single-column scroll on phones).
- **Unlock toasts in battle**: "Achievement: Boss Slayer! +10 cores" slides
  in top-center the moment it happens.
- **Cores bounties**: each achievement pays a one-time 10-25 cores
  (190 total across all 12) — a fun secondary goal that doesn't distort
  the wave economy.

## v0.2.0 — 2026-06-11

Death shouldn't erase 14 waves of fun:

- **Levels cap at 15 waves** (the original grew forever; level 10 was 50).
- **Mid-level checkpoints every 5 waves**: entering wave 6/11 snapshots your
  full loadout — coins, upgrades, drone, ultimates. Dying offers RETRY FROM
  WAVE N: the snapshot restored at full HP. Replayed waves never re-pay cores.
- Plus this morning's batch: virtual-joystick touch aiming, tap-to-fire
  ultimate (bottom-center), touch-aware hints, iOS silent-switch audio fix,
  mobile home/death/shop layouts, settings gear in battle, level-up runaway
  fix, save reset (?reset + Settings).

## v0.1.0 — 2026-06-11

The overnight port: the complete game loop from the original Python v0.7.0,
rebuilt in TypeScript + Phaser 3 with all UI as real HTML/CSS per the design
handoff. Battle (all enemies/weapons/defenses/ultimates), the cores-per-wave
economy, shop, skill tree, home/death/pause/settings, versioned localStorage
saves, synthesized audio, 19 sim parity tests + wave-math tests, CI.
