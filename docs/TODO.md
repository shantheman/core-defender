# Mech Tide — Master TODO

A running checklist for the rewrite. **Anyone (Callum, Dad, Claude Code) can
add to this** — drop a `- [ ]` line in the right section. Check things off as
they land; prune completed items periodically (history lives in CHANGELOG.md
and git).

---

## Gameplay


- [x] **Is there an end?** — RESOLVED (v0.12.0): the campaign is **15 stages**.
      Clearing stage 15's boss shows a **YOU WON** screen (credits + confetti),
      which (and the Home menu thereafter) offers a purple **God Mode** bonus
      wave: stage 16 (bg16), all weapons maxed, a dense ~20s onslaught of swarms
      + bosses, killable, then back home. Sandboxed — never affects campaign
      progress. Home keeps a **New Game** (fresh campaign) alongside it.
- [ ] **Difficulty / balance pass with real playtest data** — ultimate
      pricing, shooter spawn weights vs. the Interceptor, Medic heal rate,
      checkpoint spacing. Tune after Callum and friends have real hours in.
- [ ] **Haptics** — buzz on tower hit / ultimate fire / wave clear. Comes
      free with the Capacitor wrap (Haptics plugin); not available in
      browser on iOS.

## Art, animations & assets

- [ ] **App icon** — favicon shipped (the crystal core); still needed: the
      proper app icon set for the PWA manifest and app stores (512px+,
      maskable, Android adaptive layers).
- [x] **Loading/splash screen** (v0.10.5) — full-bleed boot splash (square art,
      cover-cropped) with a CSS "MECH TIDE" title that scales to any aspect +
      animated LOADING dots; covers first paint until the battle scene's assets
      are ready, then fades. (The native Capacitor splash is still part of the
      Capacitor wrap item below.)
- [ ] **Tower Level Up animation** — give the headline upgrade its own bigger,
      distinct buy animation (it currently reuses the field-card ping).

## Code health
Last full pass 2026-06-12 (see git/CHANGELOG): sim core tested (unit + Playwright e2e in CI), BattleScene split into modules, panels share a base class, keyboard map in src/input.ts, CSP on prod builds, innerHTML via esc().

## Launch readiness

- [ ] **PWA pass** — manifest + icons + service worker: installable to the
      home screen, runs offline, fullscreen standalone on iOS. Cheap, and a
      real alternative to app stores for the friend-circle audience.
      Blocked on the app icon (Art section).
- [ ] **Capacitor wrap (iOS/Android)** — the real-app path: haptics, app
      icon, splash, store listing. Publishing under **Bauman Games LLC**
      (Apple org account exists). Bundle ID: **com.baumangames.mechtide**.
- [ ] **Desktop packaging decision** — Tauri/Electron, or is "it runs in any
      browser" enough for desktop? (Leaning: browser is enough until proven
      otherwise.)
- [ ] **Performance pass on older phones** — tested on Shannon's recent
      iPhone only. Check an older device + Android; watch particle counts on
      late waves. (An adaptive throttle already thins particles/flashes below
      ~48 FPS — tunables: `FX_LITE_SCALE` + the 48/56 hysteresis in
      `BattleScene.updatePerf`. Next lever if needed: dynamic resolution.)
- [ ] **Browser-compat sweep** — developed against Safari/Chrome; give
      Firefox and Android Chrome one full playthrough.
- [ ] **LICENSE + asset provenance** — carried from v1, still unresolved:
      no LICENSE file; confirm the AI-generated art/sprites are cleared for
      whatever distribution ends up happening.
- [ ] **ToS / Privacy Policy + marketing site** — handled in the
      baumangames.com repo. Crash-data disclosure gets added there only once
      the crash SDK ships.
- [ ] **Crash reporting** — DECIDED (2026-06-12): yes, before the Apple
      submission. Shannon leans Crashlytics; consider Sentry (Capacitor
      "crashes" are mostly JS webview errors, which Sentry/PostHog capture
      first-class). Crashlytics stays the native-crash tool.

### Store submission checklist (Apple + Google Play)

Context: publisher **Bauman Games LLC**, bundle ID **com.baumangames.mechtide**,
target audience **13+**, ToS + Privacy Policy live at baumangames.com.

**Legal / policy**
- [ ] baumangames.com updates (ToS / Privacy Policy / marketing).
- [ ] Apple "App Privacy" label: declare diagnostics/crash data AND Product
      Interaction / Usage Data (PostHog) — not linked to identity, no tracking.
- [ ] Google Play Data Safety form: same declaration (incl. analytics/usage).
- [ ] Age-rating questionnaires (Apple + IARC): cartoon violence, ~9+/E10;
      target audience 13+ on Play.
- [ ] EU DSA trader declaration (both stores; confirm what chimera did).
- [ ] Asset provenance comfort check (AI art) before content-rights
      attestations — ties to the LICENSE item above.

**Accounts / process**
- [ ] Google Play account: confirm whether an LLC org account exists (org
      accounts skip the 12-testers × 14-days rule but need a D-U-N-S number).
- [ ] Reserve the "Mech Tide" name in App Store Connect early.
- [ ] Android signing: enroll in Play App Signing (Google keeps the key).
- [ ] TestFlight internal → friend-circle external test before release;
      Play internal testing track likewise.

**Store assets** (Claude-Design batch)
- [ ] App icon: 1024px (Apple) + Android adaptive (fg/bg, maskable) — same
      art unblocks the PWA manifest item.
- [ ] Screenshots: iPhone 6.7"/6.5"/5.5" (+ iPad), Android phone + 7"/10"
      tablet, Play feature graphic 1024×500.
- [ ] Splash screen (required by Capacitor anyway — see Art section).
- [ ] Listing copy: short + full descriptions, Apple keywords, support URL,
      contact email.

**Technical**
- [ ] Capacitor config: bundle ID, versionName/versionCode sync with
      GAME_VERSION, min/target OS (Play ratchets target API yearly).
- [ ] Apple export compliance: ITSAppUsesNonExemptEncryption=NO (HTTPS-only).
- [ ] Apple 4.2 minimum-functionality pass: fully offline, no browser chrome,
      haptics wired.
- [ ] Decide store-release cadence (web updates every push; store builds are
      snapshots).

## Decisions needed (Shannon/Callum)

- [ ] Onboarding: beyond the 3 coach-marks + the pending controls hint, is more
      tutorial needed, or is the friend-circle audience fine learning by doing?
- [ ] Accessibility beyond reduce-motion: colorblind-safe palette and text
      scaling — worth it pre-launch or post?
