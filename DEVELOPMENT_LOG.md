# Development Log — What the Water Kept

> A record of decisions, milestones and the fixes that mattered, for whoever
> picks this project up next. Ordered roughly as the work happened.

---

## 1. Environment

The machine had no Node, no JDK, no Android SDK and no sudo. Rather than ask,
every toolchain was installed **locally** under `~/.local/opt`, with nothing
changed system-wide:

- Node 24.22.0 LTS, from nodejs.org
- Temurin JDK 21, from Adoptium
- Android command-line tools, then platform 35, build-tools 35.0.0,
  platform-tools, the emulator and an Android 14 system image
- Standalone Firefox and geckodriver for browser automation (the snap
  packages could not be driven — see §6)

`/dev/kvm` was accessible through an ACL, which is what made a real emulator
test possible.

## 2. Creative preproduction

Concepts considered and why the winner won:

| Concept | Verdict |
| --- | --- |
| Tide lighthouse: water level reveals paths | Strong image, weak verb set |
| Radio station: tune frequencies to hear rooms | Original, but audio-only puzzles are hard on a phone speaker |
| Shadow as a separate entity | Well-trodden |
| Held breath as a resource | A meter, not a mechanic |
| **A lamp whose light shows the past** | **Chosen** |

The lantern won because **one rule generates traversal, puzzles and horror at
once**, and the three pull against each other. It is also cheap to build well
in a 2D renderer: a second layer of art behind a mask.

The story was built backwards from the ending: the most painful version of
"lighting the dead is dangerous" is a final scene where lighting one is the
only kind thing to do.

## 3. Architecture decisions

- **No binary assets.** Every texture is generated from a canvas at startup,
  every character is a bone rig, every sound is synthesised. Nothing can fail
  to load, the APK is 3.5 MB, and offline is true by construction.
- **DOM for UI, PixiJS for the world.** Crisp text at any density, real touch
  targets, safe areas for free.
- **Scenes as data.** Level design is testable without a renderer, which is
  what made the level audits in §5 possible.
- **Props in a value ramp, tinted per band.** One rule produces aerial
  perspective across six locations.
- **Pure functions at the core.** Cone geometry, the locomotion resolver and
  every puzzle run with no PixiJS, so 177 tests run in under a second.

## 4. Milestones

1. Core: maths, deterministic RNG, event bus, bounded fixed-timestep loop,
   explicit state machines.
2. Physics with light-dependent solidity.
3. Procedural art library, parallax scene view, two-pass lighting.
4. Bone-rig characters for Wren and three Drowned builds.
5. Touch and keyboard input; player controller; the lantern.
6. Fully synthesised audio: drones, wind, water, creaks, footsteps, the choir.
7. Narrative, 12 clues, 4 items; game state; versioned saves.
8. Four puzzles with machine-checked soft-lock analysis.
9. The Drowned: three rules, seven states.
10. Six scenes, director, cinematics, scene scripts, both endings.
11. UI: title, HUD, narration, journal, settings, pause, ending, credits.
12. Test suite and browser smoke test.
13. Android packaging, release signing, emulator verification.

## 5. Fixes that mattered

These are the bugs that would have shipped a broken game. Most were caught by
tests written specifically to look for their class of failure.

### Level geometry — every chapter was impassable

A traversability audit (walk from each chapter's entrance to its exit) failed
on **all six chapters** on its first run.

- **Crawl gaps were walls.** "Crouch through this opening" had been authored
  as a solid wall plus a forced-crouch volume. A lowspace does not remove
  solidity, so the openings were impassable. Fixed with a `crawl()` helper
  that hangs the mass from the ceiling and extends the crouch volume past the
  opening so the crouch triggers on approach.
- **Height changes were cliffs.** Floors of different heights had been butted
  together; anything above 14 px is a climb. Fixed with `ramp()`, now the only
  sanctioned way to change height.
- **Decorative walls blocked the street** in Chapter II.
- **The finale's catwalk was a 400 px block of concrete** with the ladder down
  from it buried inside.
- **The bridge deck was a one-way platform a few pixels above the street**, so
  the player walked underneath it. Replaced with a thin solid slab.
- **The leat had to stay a puzzle.** Ramps on both banks let players walk
  around the bridge, so the east wall is sheer and the west bank is a slope —
  falling in is a walk back, never a dead end, and never a bypass.

### Physics — falling out of the world

- **Boundary walls overlapped the floors they bounded.** A player walking into
  the overlap was inside a solid.
- **The horizontal pass treated the floor she stood on as a wall.** A grounded
  body is seated a hair inside its floor; testing the full rect horizontally
  hit it, and resolution then cascaded her along the bucket into the boundary
  wall and out of the world. This was the root cause of an early mystery where
  the player appeared at x = −249 and fell forever. Fixed with an inset
  horizontal probe.
- **De-penetration, then de-penetration's own bug.** A pass that ejects a
  trapped body by its nearest face was added; its first version fired on
  resting contact every step and zeroed velocity, so she could not walk. Fixed
  with a skin tolerance.
- **An out-of-bounds rescue** returns her to the checkpoint if anything ever
  escapes again, and is not counted as a death.

### Rendering — the past looked like a cave

- Before-layer art sat **under** the darkness quad, so the reveal looked like a
  torch in a cellar. Moved above it.
- The beam **mask** reused the soft lighting falloff; a Sprite mask multiplies
  by alpha, so the revealed room drew at partial opacity. Replaced with an
  opaque mask with a feathered rim.
- Value remapping was linear and **flattened all interior detail**; replaced
  with a gamma curve.
- The fog texture's gradient radius exceeded its canvas, giving every fog bank
  **hard horizontal edges** — visible as grey slabs across the sky.
- A town `roofline` prop used as a horizon read as a flat block; added a
  proper `hills` prop.
- Foreground bands moved above the darkness carry the scene's darkness in
  their own tint so they stay silhouettes.

### Android — a black world under a working HUD

The most serious finding, and the reason emulator testing was worth the time.

On the Android 14 WebView the game booted, the HUD and menus rendered, audio
and saves worked, the loop ran at 60 fps — and **the world was black**.

Diagnosis, over the Chrome DevTools Protocol against the live WebView:

1. Scene graph correct, on-screen, populated.
2. Disabling the darkness layer and the mask: still black. Not my blend modes.
3. A plain 2D canvas composited. A raw WebGL clear composited.
4. **Extracting pixels from the renderer itself returned the correct image**
   (a first attempt returned black only because it exceeded the 4096 px
   texture limit). So the renderer drew; the canvas did not composite.
5. A fresh Pixi app with default options rendered; one with the game's exact
   options did not.
6. Removing `powerPreference` and `resizeTo`: still black.
7. **Setting renderer resolution to 1: the world appeared.**

Any canvas whose backing store exceeded its CSS size failed to composite in
that WebView. The native build now renders at 1×; browsers still use the
device pixel ratio up to 2. The art is soft, fogged and grained by design, so
the sharpness cost is small.

The fix then failed in the *release* build. Platform detection compared
`Capacitor.isNativePlatform === true`, but in Capacitor 3+ that is a
**function**, so the app believed it was a web page and kept rendering at 2×.
Fixed, with regression tests in `tests/platform.test.ts`.

Testing also showed that the `@capacitor/app` plugin, which the Back-button
and lifecycle code depend on, had never been installed — Back would have
exited the game mid-play. Installed; it adds no permissions.

`adb shell screencap` also turned out to be unreliable for WebView layers on
this emulator (garbled text, missing canvases). The emulator's own
`screenrecord`, decoded frame by frame in Firefox, was used as the source of
truth.

### UI

- Display type was sized off viewport **width**; a phone in landscape is
  around 345 dp tall, so the title menu ran off the bottom of the screen.
  Everything is now sized off viewport height.
- Android Back on the Credits screen exited the app.
- Returning to the title from Credits **saved an empty game over the real
  save**, because quitting always saved. Saving now only happens when a run is
  in progress.

### Test harness honesty

The first browser smoke test paged through narration with the Space key, which
also toggles the lantern, so it was silently changing the state it measured.
It then judged "the lantern changed the frame" by brightness, which a chapter
title card fading out also does. Both were fixed before any result was
trusted.

## 6. Tooling notes

- npm blocks install scripts here; `npm install-scripts approve esbuild`.
- Snap Firefox cannot be driven by geckodriver, and snap confinement cannot
  read dot-directories, so both were installed standalone.
- `adb shell screencap` is not trustworthy for WebView content on this
  emulator; use `adb emu screenrecord` plus `tools/webm-frame.mjs`.
- `tools/cdp.mjs` evaluates JavaScript inside the debug APK's WebView.

## 7. Remaining blockers and known gaps

See `TEST_REPORT.md` for the full list. In short:

- Tested on an emulator with the host GPU, **not on physical hardware**.
- No iOS build — requires macOS and Xcode.
- The signing key is a locally generated development key.
- A complete scripted playthrough of all six chapters through to an ending was
  **not** automated end to end; the critical path is verified as data and as
  geometry, and every chapter was entered and exercised individually.
