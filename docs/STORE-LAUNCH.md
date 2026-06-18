# Mech Tide — store launch playbook

Adapted from the Chimera (`~/Code/chimera/docs/play_store_*.md`) and Good Melon
(`~/Code/good-melon/GOOGLE_PLAY_LAUNCH.md`) submissions, retargeted for **Mech
Tide's** specifics. Publisher: **Bauman Games LLC** (sbauman@gmail.com).

> **What's different about this one:** Chimera is Flutter, Good Melon is RN/Expo.
> **Mech Tide is a Capacitor WebView wrap of the existing web build** — a *new
> build path* for us, even though the store/account side is identical. The one
> genuinely new risk is **Apple Guideline 4.2** (see iOS section).

---

## TL;DR

- **Policy profile sits between your two prior games.** Mech Tide has **PostHog
  analytics** (unlike Good Melon's zero-data), but **no accounts, no backend, no
  IAP, no ads** (unlike Chimera). So: declare **Usage Data**, nothing else. No
  merchant profile, no account-deletion URL, no loot-box odds disclosure.
- **Reuses the Bauman Games _org_ account** → exempt from the new-app closed-testing
  (20-tester / 14-day) gate. Same `com.baumangames.<game>` convention.
- **The real work is the Capacitor build pipeline** (new) + listing assets. The
  code/config scaffold is done (`capacitor.config.ts`, `src/native.ts`, `cap:*`
  npm scripts, haptics wired). What's left needs your Mac + Xcode/Android Studio.

---

## App identity

| | Value |
|---|---|
| Display name | **Mech Tide** |
| Bundle ID / package | **`com.baumangames.mechtide`** (set in `capacitor.config.ts`) |
| Category | **Action** (or Arcade) — wave-survival turret defense |
| Target audience | **13+ / general** — *not* the kids/families program (matches Chimera; required since we run PostHog). Keeps COPPA/GDPR-K off the table. |
| Content rating | Cartoon **sci-fi violence** (robots, no blood, no gore) → likely **Everyone 10+ / PEGI 7**. No loot boxes, no gambling. |
| Orientation | **Both** (the game is responsive — portrait + landscape). Don't lock it. |
| Privacy policy | `https://baumangames.com/privacy` (already live; confirm the text covers an analytics-only game) |

---

## Build pipeline (the new part)

Capacitor builds through **Xcode + Android Studio directly** — there's no EAS-style
cloud build and no Flutter toolchain. The web build *is* the app.

**One-time, on your Mac:**
```bash
npm install                      # Capacitor deps already in package.json
npx cap add ios
npx cap add android              # creates ios/ and android/ native projects (commit them)
npm run cap:assets               # generates icon + splash sets from a source image (see Assets)
npm run cap:sync                 # builds web → copies into both native shells
```
Then per release:
```bash
npm run cap:ios       # build web, sync, open Xcode → Archive → upload to App Store Connect
npm run cap:android   # build web, sync, open Android Studio → Generate Signed Bundle (.aab)
```

**Signing (same pattern as Chimera):**
- **Android:** generate an upload keystore (kept *outside* the repo), and **enroll
  in Play App Signing** at first upload (Google holds the real signing key; you
  hold the upload key). Capacitor's Android project signs the release `.aab`.
- **iOS:** standard Xcode automatic signing under the Bauman Games team →
  Archive → upload to App Store Connect → TestFlight.

**Version sync:** bump `package.json` `version` (the in-game footer reads it), then
mirror it into the native projects — iOS `CFBundleShortVersionString` + build
number, Android `versionName` + `versionCode` (must increment every upload).

**OTA (optional, recommended):** because store builds are frozen snapshots while
the web auto-updates, set up over-the-air JS updates (**Capgo**, open-source, or
Ionic Appflow) so you can push JS-only fixes without a store round-trip — only
native changes then need a resubmission. Keeps the fast web iteration loop.

---

## App content / declarations

### Google Play — Data Safety
- **Collected/shared:** **Product interaction / Usage data** (PostHog — a *third-
  party processor*, so it's "**shared**"). **Not** linked to identity, **no** tracking.
- Add **Diagnostics** (crash data) once the crash SDK ships (decided in TODO; not in yet).
- Everything else: **No** (no personal info, no location, no financial, no contacts).
- **Decision to make:** if you ship the store build with **no PostHog key set**
  (analytics is a no-op until keyed — see `src/analytics.ts`), Data Safety becomes
  "**no data collected**," the Good-Melon-clean case. If you want store telemetry,
  key it and declare Usage Data. *Recommend: keep analytics on, declare it.*
- **No account-deletion URL needed** (no accounts) — unlike Chimera.

### Apple — App Privacy + privacy manifest
- **App Privacy label** (App Store Connect): "Usage Data → Product Interaction,"
  **not linked to identity, not used for tracking** (or "Data Not Collected" if you
  ship analytics-off).
- **`ios/App/App/PrivacyInfo.xcprivacy`** (Apple now requires it): declare the data
  types + any required-reason API usage. Capacitor's WebView/UserDefaults need
  reason codes — copy the structure from Good Melon's `ios/GoodMelon/PrivacyInfo.xcprivacy`
  and trim/add for PostHog (network + product-interaction).
- **Export compliance:** set `ITSAppUsesNonExemptEncryption = NO` in `Info.plist`
  (HTTPS-only, no custom crypto).

### Both stores — standard declarations
- **Ads:** No. **IAP:** No. **Government / Financial / Health:** No.
- **App access:** all functionality available with no special login.
- **Permissions:** `INTERNET` (WebView + analytics), `VIBRATE` (haptics). Nothing
  sensitive — no location/camera/contacts.

### AI-art provenance
Mech Tide's sprites are AI-generated, same as Chimera and Good Melon — you've made
the content-rights attestation twice. Apply the **same stance** here; nothing new
to resolve, just confirm it carries.

---

## Listing assets

| Asset | Spec | Notes |
|---|---|---|
| Store-listing icon | **512×512** PNG | *Separate upload* from the in-app launcher/adaptive icon |
| Launcher / adaptive icon | generated by `npm run cap:assets` | needs a clean source (transparent-bg mech, 1024px+) — the **shared blocker** |
| Feature graphic (Play) | **1024×500** | |
| Screenshots | phone (+ tablet/iPad) | game is responsive; pick **landscape** shots for the hero — show a chaos wave, the skill tree, a boss, the You-Won screen |
| Short + full description | 80 / 4000 char | "Hold the center against robots from every side" angle |

Claude-Design can produce the graphics; the existing `public/og-image-v2.png` is a
palette starting point.

---

## Release flow + gotchas (learned on Chimera, verbatim-applicable)

1. **Internal testing track first** — no review, processes in minutes. Smoke-test
   the *exact signed artifact* on a device before production.
2. **Set Countries/regions at the _track_ level**, not in the release wizard —
   Chimera hit a hard "no countries selected" error here.
3. **Explicitly "Start full rollout"** — the production release won't join the
   review batch until you do (easy to miss).
4. First production submission reviews **everything together** (build + listing +
   declarations) via "Submit N changes for review."
5. The **"quick checks" pre-flight (~14 min) is NOT the review** — the real review
   is hours-to-days for a new app.
6. **Managed publishing**: off = goes live the instant Google approves; on = waits
   in "approved, ready to publish" until you click. Chimera shipped with it off.
7. **Staged rollout** (20% → 50% → 100%) on production so a showstopper can be halted.

**iOS:** the Apple account is mid **individual → company conversion** (Apple says
weeks) — that gates the iOS submission, not the build. Use **TestFlight** for the
friend circle first.

### Apple Guideline 4.2 — the one new risk
Both prior games were native-engine, so Apple never scrutinized a WebView wrapper
from this account. A **game** almost always clears 4.2 ("minimum functionality"),
and we've stacked the deck: **haptics** (wired: tower hits, ultimates, wave clear),
a **native splash**, **offline** play, fullscreen. If it's ever flagged, appeal
noting it's a self-contained game (no remote content, works offline), not a website
wrapper. Worst case is a round-trip, not a dead end.

---

## Order of operations

1. **App icon source** (transparent-bg mech, 1024px+) — unblocks `cap:assets` + both store icons.
2. `npx cap add ios && npx cap add android`; `npm run cap:assets`; `npm run cap:sync`.
3. Android: upload keystore + Play App Signing → signed `.aab`.
4. iOS: Xcode archive → App Store Connect (gated on the company-account conversion).
5. Create both app entries **under the Bauman Games org account**.
6. Fill declarations (Data Safety / App Privacy = Usage Data; ratings; ads=No; etc.);
   confirm `baumangames.com/privacy` covers an analytics-only game.
7. Listing assets (icon 512, feature graphic, landscape screenshots, copy).
8. Internal testing / TestFlight → smoke-test the signed build.
9. Production: set countries, Start full rollout, Submit for review (staged rollout).

---

## What carries over (reuse map)

| From | Reuse for Mech Tide |
|---|---|
| Org account + D-U-N-S | Tester-gate exemption, merchant profile (unused here) |
| `baumangames.com/privacy` + `/terms` | Same URLs; confirm copy covers analytics-only |
| Chimera Data Safety answers | Trim to just **Usage Data** (drop Identifiers/Email/Purchases/UserContent) |
| Good Melon `PrivacyInfo.xcprivacy` | Template for the iOS privacy manifest |
| `chimera/docs/play_store_{assets,listing}.md` | Asset specs + listing structure |
| Chimera signing/Play-App-Signing flow | Identical Android signing approach |
