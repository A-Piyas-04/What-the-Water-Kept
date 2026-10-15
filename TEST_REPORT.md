# Test Report — What the Water Kept

> For anyone deciding whether to trust this build. Every result below was
> actually run; anything that was not is listed as unverified. Date of the
> final run: 15 October 2026.

---

## Summary

| Area | Result |
| --- | --- |
| Type check (strict) | **Clean** |
| Unit, logic and level-audit tests | **177 / 177 pass** |
| Browser smoke test (production build, Firefox) | **Pass** |
| Ending sequence, both endings (Firefox) | **Pass** |
| Release APK build and signature | **Pass** — v1 + v2 signed, 3.5 MB |
| Release APK on Android 14 emulator, airplane mode, touch only | **Pass** — see caveats |
| Physical Android hardware | **Not tested** |
| iOS | **Not built** |

---

## 1. Automated tests — `npm test`

177 tests in 9 files, all passing, in under a second.

| File | Tests | What it proves |
| --- | --- | --- |
| `cone.test.ts` | 17 | The beam geometry the whole mechanic rests on, including the long thin bridge deck that straddles the cone with every corner outside it |
| `collision.test.ts` | 15 | Landing, walls, no tunnelling, one-way platforms, **Before geometry solid only while lit**, flag-gated colliders, volume queries |
| `locomotion.test.ts` | 20 | Every movement state and priority rule; crouching under ceilings; the transition table; decel > accel |
| `puzzles.test.ts` | 30 | All four puzzles: solutions, near misses, save round-trips, resets, and a machine-checked **no-soft-lock** audit |
| `persistence.test.ts` | 28 | Save validation of corrupt, partial and hostile data; migration from v1 and v2; checksums; game-state round-trips |
| `progression.test.ts` | 29 | The full progression audit (§2) |
| `walkability.test.ts` | 31 | Ground scans, escape tests, end-to-end traversal of every chapter (§2) |
| `platform.test.ts` | 7 | Regression tests for the two Android boot/render bugs (§5) |

## 2. Progression audit

The brief asks for each chapter to be entered, its clues found, its puzzles
completed and the next chapter reached. Done against the real scene data:

- **Scene graph** — six chapters, every exit names a real scene and spawn,
  each chapter exits to the next, every scene reachable from the first, the
  finale ends rather than exits.
- **Gating** — every flag that anything requires can be granted somewhere;
  every required item can be picked up; every clue, text and cinematic that is
  referenced exists.
- **Critical path** — walks all six chapters asserting each gate opens in turn
  with what the player holds at that point. Checks, for example, that the winch
  crank is reachable *before* the roof beam it clears, and that the gatehouse
  door needs the log that the dials release.
- **No stranding** — the cold ending needs nothing, so a player who never
  lights Martin can still finish.
- **Geometry** — every spawn has present-day floor under it and is not inside
  a wall; nowhere the player can stand is inside geometry; running into every
  boundary from every spawn keeps her in the world; **every chapter is
  walkable from its entrance to its exit**, and every checkpoint is reachable.

This audit found real bugs the first time it ran — every chapter was
impassable — which are described in `DEVELOPMENT_LOG.md` §5.

## 3. Browser automation — Firefox 158, headless

### Smoke test — `node tools/smoke.mjs`

Drives the production build: boots it, starts a new game from the title,
walks with the keyboard, then visits all six chapters lit and unlit, opens
pause and the journal, and checks storage, console and network.

| Check | Result |
| --- | --- |
| Boots, canvas created | Pass |
| New game from the title screen | Pass |
| Player moves under input and stays grounded | Pass |
| Frame rate | 59.9–60.1 fps |
| All six chapters load and render (150–250 distinct colours each) | Pass |
| Lantern lights in every chapter and changes the frame | Pass |
| Pause and journal open | Pass |
| Save written to IndexedDB, versioned, checksummed | Pass |
| Console errors | None |
| **Remote network requests** | **0** (of 19–22 total) |

### Ending test — `node tools/ending.mjs [--shown]`

| Path | Result |
| --- | --- |
| Run east through the rising water without showing Martin | Withheld ending → ending screen → credits; save records `completed: true, ending: "withheld"` |
| Light Martin while carrying the log, press interact | *Show him* prompt offered → warm ending → credits; save records `ending: "shown"` |

## 4. Android

### Build

| Check | Result |
| --- | --- |
| `assembleRelease` | Pass |
| Signature (`apksigner verify`) | v1 + v2 verified, RSA 4096, single signer |
| Size | 3.5 MB release, 4.5 MB debug |
| Permissions | **No `INTERNET`** — only Capacitor's internal broadcast permission |
| minSdk / targetSdk | 23 / 35 |

### On an emulator

Pixel 5 profile, Android 14 (API 34, Google Play image), KVM, **host GPU**.
`tools/device-play.sh` installs the **release** APK and plays it with real
taps and drags only — no debug hooks.

| Check | Result |
| --- | --- |
| Install | Pass |
| Airplane mode on during the whole run | Yes (`airplane_mode_on=1`) |
| INTERNET permission granted | 0 |
| Launches in landscape | Pass |
| Title screen and typography | Pass |
| *Begin* by tap; narration paged by tap | Pass |
| **World renders** | **Pass** |
| Thumbstick drag moves the player | Pass — walked from the dam to the survey camp and the *Read* prompt appeared |
| Lantern denied before it is found | Pass (correct behaviour) |
| Hardware Back during play | Pauses; app stays in the foreground |
| Home, then relaunch | Resumes to the pause screen |
| Force-stop, then relaunch | Title shown; no crash |
| Fatal exceptions in logcat | 0 |

Screenshots: `docs/screenshots/android-*.png`.

### Emulator caveats — please read

- **Software GPU modes cannot show the game.** Under `swiftshader_indirect`
  and `swangle_indirect` the WebGL canvas never composites, even at 1×, while
  the game demonstrably renders correct pixels (verified by extracting them
  from the renderer). Only `-gpu host` displays it. This is believed to be an
  emulator limitation, but it is a reason the result below matters.
- The host-GPU emulator's GL translator crashed twice during long sessions
  (`glestranslator ... null ctx`), taking the emulator off adb. Both times the
  app had logged no exception.
- `adb shell screencap` does not reliably capture WebView layers on this
  emulator. All Android screenshots were taken with the emulator's own
  `screenrecord` and decoded in Firefox.

## 5. Bugs found by testing, and fixed

Two of these would have shipped a game that does not work on Android.

| Found by | Bug | Status |
| --- | --- | --- |
| Device + CDP | World black in the Android WebView at render resolution > 1 | Fixed: native renders at 1× |
| Device | Release build still black: `isNativePlatform` is a function, compared to `true` | Fixed + regression test |
| Device | `@capacitor/app` missing, so Back exited mid-game | Fixed |
| Device | Its `addListener` is not a Promise via the global proxy; `.catch()` crashed boot | Fixed + regression test |
| Device | Title menu overflowed a 345 dp-tall landscape screen | Fixed |
| Device | Back on Credits exited the app | Fixed |
| Review | Returning from Credits overwrote the real save with an empty game | Fixed |
| Traversal audit | Every chapter impassable (crawl gaps were walls, cliffs instead of slopes, blocked streets, buried ladder) | Fixed |
| Walkability audit | Boundary walls overlapped floors; solver could eject the player out of the world | Fixed + rescue added |
| Diagnostics | Horizontal collision treated the player's own floor as a wall | Fixed |
| Screenshots | Revealed past drew at partial opacity; washed out; hard-edged fog slabs | Fixed |
| Progression audit | Finale spawn inside the gate's concrete | Fixed |

## 6. Not tested, or not verified

Stated plainly, because the brief asks for the line between implemented and
verified to be explicit.

- **Physical Android hardware.** Not available. Performance on a mid-range
  phone is **unmeasured**; 60 fps was measured only in desktop Firefox and in
  the emulator on the host GPU.
- **A full, continuous playthrough of all six chapters through to an ending.**
  Not automated. Each chapter was entered and exercised, the critical path is
  verified as data and as geometry, and both endings were played from the
  final chapter — but no single run went from the title to the credits.
- **The puzzles solved by input in the running game** (as opposed to through
  their logic APIs). Their logic is fully tested; the in-game interactions
  (dials, crank, bridge, chalk) were not individually driven by automation.
- **The Drowned pursuing and catching the player in the running game.** The
  state machine is implemented; it has no dedicated automated test.
- **Audio.** Synthesis runs without errors, but nothing was listened to:
  headless browsers and the emulator ran with audio disabled.
- **Touch multitouch** (moving and pressing a button at once). Implemented;
  `adb input` cannot produce simultaneous touches.
- **Save migration from a real older install.** Tested only as unit tests.
- **iOS.** Not built; requires macOS and Xcode.

## 7. Known limitations

- On Android the game renders at 1× device pixels, so it is softer on
  high-density screens than in a desktop browser. This is the fix for the
  black-screen bug and is deliberate.
- The signing key is a locally generated development key, not a store key.
- Some dense scenes are dark by design; there is no brightness setting.
