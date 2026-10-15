# Architecture — What the Water Kept

> Written for a developer joining this codebase. It describes how the systems
> fit together and, where a decision was non-obvious, the failure it avoids.

---

## Shape of the thing

```
                    ┌──────────────┐
                    │   Game       │  app/game.ts
                    │  (shell)     │  PixiJS app, loop, saves, UI wiring
                    └──────┬───────┘
                           │ owns
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼─────┐   ┌──────▼──────┐  ┌──────▼──────┐
    │ Director  │   │  SceneView  │  │  GameAudio  │
    │ (sim)     │──▶│  (render)   │  │  (synth)    │
    └─────┬─────┘   └─────────────┘  └─────────────┘
          │ owns
   ┌──────┼──────┬──────────┬───────────┬──────────┐
   │      │      │          │           │          │
 Player  World  Drowned  Puzzles  GameState  Cinematics
          │
   CollisionWorld
```

**Dependency rule.** The Director owns the simulation and talks *down* to
physics, rendering and audio. The UI only listens to Director events. Nothing
below the Director imports PixiJS except the rendering layer, and nothing below
it touches the DOM — which is what lets 177 tests run in plain Node with no
renderer and no browser.

---

## 1. The loop

`core/clock.ts` — fixed-timestep simulation at 60 Hz, decoupled from the
display refresh rate.

```
rawDt ──▶ [stall filter] ──▶ accumulator ──▶ N × fixedUpdate(1/60) ──▶ render(rawDt)
```

Three protections, each against a real failure:

- **`MAX_FRAME_DT` (0.25 s).** A frame longer than this is a stall — a GC
  pause, a scene load, the Android WebView being backgrounded — and the elapsed
  time is *discarded*, not simulated.
- **`MAX_STEPS_PER_FRAME` (5).** The accumulator is bounded, so catch-up can
  never become a burst of steps that teleports the player through a wall.
- **`resetTiming()`** is called on resume so returning from the background does
  not try to replay the missing minutes.

`render` receives the raw delta and an interpolation alpha. Simulation state is
never mutated during render.

---

## 2. Rendering

### Layer order

This ordering *is* the game's image, and the comment in `scene-view.ts` says so:

```
sky
present bands 0–4            ← parallax, below the darkness
dynamic layer                ← scene-script art (the cart, the dials, the flood)
fog
particles
SHADOW  (darkness quad with lights erased out of it)
BEFORE  (1964, masked to the beam)   ← ABOVE the darkness
actor   (Wren, tinted by how lit she actually is)
fore bands 5–6               ← occludes the past, carries its own darkness
glow
post    (vignette, grain, letterbox)
```

The Before layer above the darkness is the single most important line in the
renderer. Below it, the lamp looks like a torch in a cave. Above it, the beam
is a window into a lit night.

### Parallax

Seven depth bands with coefficients 0 → 1.58, anchored at the scene centre:

```
screen = world + viewport/2 − anchor − (camera − anchor) × k
```

Anchoring at the scene centre means authors place every prop in plain world
coordinates and get correct aerial perspective for free.

### Lighting

Two passes, a handful of additively blended sprites, no per-pixel shader:

1. **Shadow** — a flat darkness quad with lights punched out using the `erase`
   blend mode. The layer is its own render group, which is what makes `erase`
   subtract alpha from the darkness rather than paint black on the backdrop.
2. **Glow** — the visible bloom, in each light's own colour. Kept low (0.15 of
   beam intensity): higher and it becomes an additive wash that flattens the
   lit past into a featureless orange cone.

### The beam mask

A Sprite mask multiplies by its alpha, so `beamMaskTexture` is **opaque across
the whole cone with a feathered rim** — deliberately a different curve from the
lighting falloff. Reusing the soft lighting texture here drew the revealed past
at partial opacity everywhere except the beam's centre.

### Procedural art

`rendering/props/` — 43 parameterised draw functions over a shared `PropCtx`.

Props draw in a **neutral value ramp**, never in final colour; the renderer
tints each band. Values pass through a gamma curve (`vl()`), because prop
detail is authored in 0.05–0.35 and a linear remap compresses all of it flat.

Each placement gets a deterministic `Rng` seeded from prop name and position,
so the same building has the same broken windows every run and after every
reload.

### Characters

`rendering/character.ts` — bone hierarchies, not sprite sheets. Pose functions
produce joint angles; the rig damps toward them each frame, which gives
pop-free transitions between every locomotion state for free. One rig serves
Wren and all three Drowned builds.

---

## 3. Physics

`physics/collision.ts` — axis-separated swept AABB against static colliders,
with a coarse horizontal bucket index. Deterministic by construction.

### Collider kinds

`solid`, `oneway` (stairs and catwalks, caught only when descending), `ladder`,
`lowspace` (forces a crouch), `hazard`.

### The lantern as physics

```ts
isActive(c, q) {
  if (c.requiresFlag && !q.hasFlag(c.requiresFlag)) return false;
  if (c.blockedByFlag && q.hasFlag(c.blockedByFlag)) return false;
  if (c.layer === 'before' && !q.isBeforeLit(c)) return false;   // ← the mechanic
  return true;
}
```

`isBeforeLit` runs `coneRect` from `gameplay/cone.ts` — pure geometry, no
renderer, fully unit-tested.

### Three subtleties worth knowing

- **The horizontal pass uses an inset rect.** A grounded body is seated 0.001 px
  inside its floor so the overlap test keeps reporting contact. Testing the
  full rect horizontally therefore treats its own floor as a wall and cascades
  it along every collider in the bucket. The horizontal probe is inset by the
  skin at the top and by `STEP_UP` at the bottom.
- **`STEP_UP` (14 px)** is how high a lip the player walks over. Above it is a
  climb. All slopes are built from `ramp()` so they stay under it.
- **`depenetrate()`** pushes a body that starts inside geometry out by its
  *nearest face*, never by direction of travel — which could otherwise eject it
  outside the world. It ignores penetration shallower than `SKIN` (0.6 px),
  or it fires every step and cancels velocity.

---

## 4. Simulation

`gameplay/director.ts` owns the step:

```
narration pending?  → freeze the world, wait for dismissal
dying?              → run the death timer, then respawn
cinematic playing?  → advance steps, run scripted body, update world
otherwise           → lantern toggle → interaction → player → world
```

`updateWorld` then runs the Drowned, triggers, the interaction prompt, puzzle
ticks, the scene script, hazards, the out-of-bounds rescue, and the camera.

### State

`GameState` is a flat, serialisable bag: flags, clues, items, per-puzzle
records, checkpoint, chapter. Every door, puzzle and story beat is a flag,
which means the save file is a faithful description of progress rather than a
pile of special cases — and a partial save degrades to "slightly earlier"
rather than to "broken".

### The out-of-bounds rescue

A body that escapes the geometry would fall forever, which is an unrecoverable
soft-lock. `checkBounds()` returns her to the last checkpoint and deliberately
does **not** count it as a death. The collision solver and the level audit
should make it unreachable; it exists because "should" is not a guarantee.

### Scene scripts

Four scenes need behaviour too specific to be data (`gameplay/scripts.ts`): the
ward's choir ducking, the tunnels' cart visual, the gatehouse dials, and the
gate's rising flood. A scene script is an admission that something is bespoke,
so there are as few as possible.

---

## 5. Scenes as data

`world/types.ts` defines the model; `world/build.ts` provides the authoring
helpers; `scenes/*.ts` are plain data.

Helpers that encode a rule rather than saving keystrokes:

- **`ramp(x0, x1, fromY, toY)`** — a staircase of sub-`STEP_UP` treads. The
  only sanctioned way to change height.
- **`crawl(x0, x1, floorY, gap)`** — a mass hanging from the ceiling plus a
  forced-crouch volume that reaches past the opening on both sides, so the
  crouch triggers on approach. Authoring this as a bare wall plus a lowspace
  produces a wall the player simply cannot pass.
- **`beforeSlab`** — a thin *solid* Before collider, for a bridge deck flush
  with the street. A one-way platform a few pixels up is something she walks
  underneath.

---

## 6. Audio

`audio/` — everything synthesised; no files.

```
oscillators / filtered noise ─┬─▶ music bus ─┐
                              └─▶ sfx bus ───┼─▶ master ─▶ limiter ─▶ out
                                   └─▶ reverb send ─┘
```

The reverb is a convolver with a **generated** impulse response: decaying noise
through a one-pole lowpass whose cutoff falls with time, so the tail goes dark
and reads as stone and water rather than metal.

House style: noise shaped by resonant filters for anything physical, detuned
oscillators through lowpass for anything meant to feel wrong. A limiter sits on
the master so nothing can ever be painfully loud.

Everything degrades to silence rather than throwing. If the AudioContext cannot
start — an old WebView, denied audio focus, a headless test — the game remains
completely playable.

---

## 7. Saving

`persistence/` — IndexedDB primary, localStorage fallback, in-memory last
resort. No network path exists.

### Write strategy

Two slots. The previous good save is copied to a backup before the new one is
written, so a process killed mid-write — routine on Android — costs at most one
checkpoint. Payloads carry an FNV-1a checksum to catch a half-written record.

Writes are deferred and rate-limited to one per 1.5 s, except for forced
moments (pause, backgrounding, ending, quit). An IndexedDB transaction per flag
would cost frames.

### Reading

`validate()` is forgiving about every field except one: the checkpoint must
name a scene that exists. A save pointing at a scene we cannot load looks like
progress and then soft-locks, so it is refused outright and the backup is tried.

`migrate()` brings older versions forward. Loading always enters at the
*checkpoint* scene, because that is the only position guaranteed valid against
the current collision data; a mid-scene position is restored only when it is in
the same scene and inside the bounds.

---

## 8. Mobile

`mobile/platform.ts` loads Capacitor lazily and optionally — the same bundle
runs as a plain web page with no plugins present, which is what makes
development and automated browser testing possible without a device.

- **Lifecycle** uses both the Capacitor listener and DOM `visibilitychange`,
  plus `pagehide`. Autosave on background is the single most important one:
  Android kills backgrounded WebViews without warning.
- **Orientation** is requested as landscape and enforced in the manifest, with
  a CSS rotate prompt as the fallback.
- **Safe areas** come from `env(safe-area-inset-*)`, with the activity drawing
  into the display cutout.
- **Resolution** is capped at 2× device pixel ratio, or 1× on low quality.

### Scaling

Vertical fit with horizontal reveal: every device sees the same amount of the
world vertically and wider screens simply see further to the sides. Design
height is a fixed 540 units, so composition is predictable from 16:9 to 21:9.

---

## 9. Input

One `InputState` per frame, produced from touch or keyboard.

The left half of the screen is a floating thumbstick that appears wherever the
thumb lands; the right side carries the lantern and context buttons. Pushing
the stick past 72% runs and pulling it down crouches, which removes two buttons
from the screen.

Edge-triggered fields (`lanternPressed`, `interactPressed`) are cleared at the
end of each frame by `endFrame()`. Touch gestures are blocked on the game
surface so the WebView never treats a drag as a page scroll.

---

## 10. Testing

| Suite | Covers |
| --- | --- |
| `cone` | The beam geometry the whole mechanic rests on |
| `collision` | Solver, one-way platforms, light-dependent solidity, flag gates |
| `locomotion` | Every state transition and priority rule |
| `puzzles` | All four puzzles, their save records, and soft-lock audits |
| `persistence` | Validation, migration, checksums, corrupt and partial saves |
| `progression` | Scene graph, flag reachability, the critical path |
| `walkability` | Ground scans, escape tests, traversability end to end |

Plus `tools/smoke.mjs`, which drives the real production build in Firefox,
analyses the screenshots it captures, and asserts that zero remote requests
were made.
