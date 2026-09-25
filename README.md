# Cut the Traffic

A mobile-first casual **traffic-management game**. You control the signal heads
of a busy junction: tap a light group to turn it green, let traffic flow, and
keep everyone from colliding. Each level is a short puzzle of timing
(15–40 s), designed for 2–8 minute sessions.

Built as a **genuinely playable MVP** — real car-following simulation, queueing,
collision detection with a slow-motion crash cinematic, 10 data-driven levels,
local progression, and monetization/analytics abstractions ready for a future
AdMob integration. No backend, no API keys, no copyrighted assets: every sprite
and the whole city are drawn procedurally at runtime.

## Tech stack

| Layer        | Choice                                          |
| ------------ | ----------------------------------------------- |
| Language     | TypeScript (strict)                             |
| Game engine  | [Phaser 3](https://phaser.io) (Canvas/WebGL)    |
| Build        | [Vite](https://vitejs.dev)                      |
| Tests        | [Vitest](https://vitest.dev) (simulation/logic) |
| Persistence  | `localStorage`                                  |
| Audio        | WebAudio synthesis (zero audio files needed)    |
| E2E (dev)    | puppeteer-core + bundled Chromium (optional)    |

Portrait 9:16 design resolution (540×960), scales with `Scale.FIT` — plays
fine in a desktop browser for development.

## Install

```bash
npm install
```

## Run

```bash
npm run dev        # http://localhost:5173
```

The dev server binds `0.0.0.0` and allows all hosts so the Arena live preview
works out of the box.

## Build & preview

```bash
npm run build      # typecheck (tsc --noEmit) + production build → dist/
npm run preview    # serve dist/
```

`base: './'` is set so the built bundle can be dropped into a Capacitor/Cordova
webview without path rewrites.

## Tests

```bash
npm test           # vitest: simulation, lights, collision, progression, ads
npm run typecheck  # strict TS, no emit
npm run e2e        # optional: full browser smoke test (needs `npm run dev` first)
```

The E2E run boots a real (npm-bundled) Chromium, plays level 1 with an
autopilot policy, forces a crash, exercises the rewarded continue, retries,
loads all 10 levels, and verifies localStorage progression. Screenshots are
written to `e2e/shots/` (git-ignored).

## Project structure

```
src/
  main.ts                 # Phaser game bootstrap (9:16 FIT canvas)
  types.ts                # shared domain types (no Phaser imports)
  config/
    game.ts               # design size, vehicle stats, sim/crash tuning
    monetization.ts       # CENTRAL ad policy (frequency, intervals, entitlements)
  data/
    levels/
      common.ts           # layout + light-group presets + spawn scheduler
      level01..level10.ts # one file per level (pure data)
      index.ts            # level registry
  sim/                    # pure TypeScript simulation (unit tested, no Phaser)
    trafficSim.ts         # world: spawn, stepping, collision, snapshots, win/loss
    vehicle.ts            # per-vehicle acceleration / braking / car-following
    trafficLights.ts      # group controller + all-red clearance interval
    collision.ts          # broad/narrow phase overlap check
    geometry.ts           # lanes, stop lines, exits, rects
  render/
    worldArt.ts           # procedural city block (roads, crosswalks, buildings)
    vehicleArt.ts         # procedural car / van / truck textures
    vehicleView.ts        # sim → sprite sync + suspension bob
  scenes/
    BootScene.ts          # texture generation, font wait
    MenuScene.ts          # PLAY / LEVELS / SETTINGS
    LevelSelectScene.ts   # 10 cards: locked / unlocked / best time
    SettingsScene.ts      # sound, music, vibration, mock ads (dev), privacy, reset
    GameScene.ts          # gameplay scene: drives the sim, HUD, result panels
    AdOverlayScene.ts     # mock ad presenter (clearly labelled placeholder)
  services/
    save.ts               # SaveService (localStorage, versioned, testable)
    ads.ts                # AdService facade, MockAdProvider, InterstitialScheduler
    analytics.ts          # AnalyticsService (console implementation)
    audio.ts              # AudioManager (synthesised SFX + ambient music)
    audioConfig.ts        # settings → audio/haptics binding
    vibration.ts          # navigator.vibrate wrapper
  ui/
    widgets.ts            # buttons, panels, toggles, palette
    LightButton.ts        # the big round traffic-light touch control
tests/                    # vitest suites (sim, lights, progression, ads, levels)
scripts/e2e.mjs           # browser smoke test
```

### Separation of duties

* **`src/sim`** owns all gameplay rules and is 100 % Phaser-free, so it runs
  headlessly in Vitest and can be driven deterministically.
* **`scenes/GameScene`** only *presents* the sim (sprites, HUD, panels,
  camera cinematics) and forwards input.
* **`services`** own persistence, ads, analytics and audio behind small
  interfaces the game code never reaches around.

## How levels are defined

Levels are **pure data** (`LevelConfig` in `src/types.ts`):

```ts
{
  id, name, hint,
  layout:  { width, height, roadWidth, laneOffset, centerX, centerY },
  groups:  [{ id, label, short, directions: ['E','W'], slot: 'bl' }, ...],
  spawn:   [{ type: 'car'|'van'|'truck', dir, at }, ...],   // explicit schedule
  speedMul, parTime,
  objective: { type: 'clear-all', totalVehicles },
  initialGreen?: ['ew'],
}
```

* **`groups`** = the touch controls. A group turns its `directions` green
  together; tapping a red group forces conflicting (perpendicular) groups red
  immediately and applies the green after a computed **all-red clearance**
  interval, so committed vehicles always finish crossing first.
* **`slot`** places the button (`bl`, `br`, `tl`, `tr`); helper `atSlot()`
  re-seats a preset for a specific level.
* **`spawn`** is built with `schedule(start, defaultGap, items)` where each
  item may override its `gap` (seconds since the previous spawn). The sim also
  sorts the queue by time defensively.

### Adding a new level

1. Create `src/data/levels/level11.ts` exporting a `LevelConfig`
   (copy `level01.ts`, adjust `groups`, `spawn`, `speedMul`, `parTime`).
2. Import and append it in `src/data/levels/index.ts`.
3. Run `npm test` — the level-data suite validates ids, spawn ordering,
   group coverage and slot uniqueness automatically.

Nothing else changes: menu, select screen, HUD, sim and progression all read
from the registry.

## How AdService works

`src/services/ads.ts` exposes one facade the game talks to:

```ts
adService.isInterstitialAvailable(): boolean
adService.showInterstitial(): Promise<AdResult>
adService.isRewardedAdAvailable(): boolean
adService.showRewardedAd(): Promise<RewardedResult>   // { rewarded: boolean }
adService.showInterstitialIfEligible(): Promise<AdResult>  // policy-gated
```

**Policy lives in `src/config/monetization.ts`** (one file):

* interstitial after every **3** completed levels (configurable),
* **60 s** minimum interval between interstitials,
* first completion of a session never shows one,
* `removeAds` entitlement (future IAP) disables interstitials **but never
  rewarded ads**,
* mock interstitial UI only appears when the developer flips
  **Settings → Mock ads (dev)** — by default the mock resolves instantly and
  never interrupts gameplay.

**Placements (MVP):** the only interstitial call site is the *CONTINUE* tap on
the level-complete panel — a natural transition, never mid-gameplay, never on
failure/restart. Rewarded is one mechanic: on the crash panel the player may
voluntarily **CONTINUE · WATCH AD** (once per attempt) — the sim rewinds to a
snapshot ~2 s before the crash, freezes briefly with a *GO!* cue, and resumes.
If no snapshot exists it falls back to a clean restart.

**Analytics** (`AnalyticsService`, console implementation) fires
`level_started/completed/failed/restarted`, `perfect_flow`,
`rewarded_offer_shown/accepted/completed`,
`interstitial_eligible/shown`, `game_started` with simple payloads
(level, attempt, times, vehicle types).

### Replacing the mock with real AdMob later

1. `npm i @awesome-cordova-plugins/admob-...` or the official Google Mobile
   Ads SDK via Capacitor — wrap it in one class implementing `AdProvider`:

   ```ts
   export class AdMobProvider implements AdProvider {
     isInterstitialAvailable() { /* ready check */ }
     async showInterstitial()   { /* show & resolve on dismiss */ }
     isRewardedAdAvailable()    { /* isLoaded() */ }
     async showRewardedAd()     { /* resolve {rewarded: true} only on
                                      onUserEarnedReward */ }
   }
   ```

2. Register it at boot: `getAdService(save).setProvider(new AdMobProvider())`.
3. Keep reading cadence **only** from `config/monetization.ts`.
4. Leave `MockAdProvider` in place for tests/dev builds.

No gameplay scene ever imports an ad SDK.

## Future Remove Ads

`SaveService.setRemoveAds(true)` persists an entitlement flag today (Settings
shows the placeholder). When a real IAP lands it flips that flag;
`interstitialsAllowed()` already respects it, while rewarded ads remain
available by design.

## Settings

Sound on/off · Music on/off · Vibration on/off · Mock ads (dev) · Reset
progress · Privacy placeholder. All persisted through `SaveService`.

## Progression & save

`localStorage` key `ctt.save.v1` (versioned, corruption-safe): unlocked level,
completion flags, per-level best times, attempt counters, settings, ad
bookkeeping. Level N+1 unlocks when level N completes.

## Controls

* Tap a round signal head → that group toggles RED ↔ GREEN (pending switches
  blink amber while the clearance interval runs).
* HUD: `MENU`, `RETRY` (desktop: `R`).
* Big targets only — no gestures, no joystick.

## Vehicle types

| Type  | Length | Speed | Accel/Brake | Role |
| ----- | ------ | ----- | ----------- | ---- |
| car   | 46 px  | fast  | agile       | baseline |
| van   | 58 px  | med   | moderate    | level 4+ |
| truck | 88 px  | slow  | lazy        | needs long windows, creates pressure |

All movement uses smooth acceleration and sqrt-based braking envelopes;
vehicles queue bumper-to-bumper and roll forward naturally.

## Known limitations / not tested

* **Not tested:** real touch devices (only headless Chromium + mouse input),
  audio output quality (WebAudio is exercised, listening is not), iOS Safari.
* **E2E screenshots** need the rAF-primed capture helper — raw WebGL frame
  capture in headless Chromium can return a stale frame.
* Rewarded "continue" falls back to a plain restart if a crash happens before
  the first snapshot (~0.2 s in); the offer is hidden in that case.
* No yellow phase; switching is protected by the all-red clearance interval.
* Ad providers, IAP and analytics SDKs are interfaces only — nothing networked.
* GameScene is a single (large) scene; if features grow, split HUD/panels into
  sub-scenes before adding more mechanics.

## Roadmap (suggested next steps)

1. Game-feel pass with real-device profiling (particles on exits, engine hum
   per vehicle, haptic tuning) + difficulty tuning from playtest data.
2. Capacitor wrapper (portrait lock, safe-area insets, back button) and a
   coins/cosmetics layer behind the existing rewarded hooks (Double Coins).
3. Wire the first real AdMob test suite behind `AdProvider` and a privacy
   policy page; keep `config/monetization.ts` as the only frequency source.
