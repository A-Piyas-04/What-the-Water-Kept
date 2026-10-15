# Game Design — What the Water Kept

> Design document. Written for anyone picking this project up: it records not
> just what the game does, but why each decision was made and what it is
> protecting against.

---

## 1. Identity

**Title** — *What the Water Kept*
**Genre** — side-view cinematic horror-mystery; exploration and investigation
**Target length** — 25–35 minutes, first playthrough
**Platform** — Android, landscape, touch
**Tone** — cold, documentary, quiet. Grief rather than gore.

### The one-line pitch

A surveyor in a drained reservoir finds a lamp whose light shows the drowned
village as it was on the night it died — and the village's dead can only see
her when she shines it on them.

### What it is not

No jump scares. No combat. No collectible-note deluge. No haunted dolls, no
abandoned asylum, no monster that chases the player because the design needed
tension. The horror is that the protagonist is carrying the only thing keeping
her alive, and it is also the only thing that can get her killed.

---

## 2. Story

### Premise

In April 1964 the Corran Valley was flooded for a reservoir. Corran Mill went
under. The high town was evacuated to Ardbeg by bus; the low town was not told.

Sixty-one years later the reservoir is drawn down for a dam inspection. Wren
Calloway, a hydrographic surveyor, is contracted to measure the silt. She took
the job because her mother, Edith, has never once said the word *Corran* — and
because it was Edith who sent her the posting.

### The central question

Wren believes her mother disappeared from her own history. The question the
game asks is *what Edith did on the night of the flood*, and the answer
recontextualises everything, including the fact that Wren is holding the
lantern at all.

### The revelation

On 11 April 1964 the relief sluice jammed at 40%. Ardbeg exchange advised that
the dam face was failing, with two thousand people below it. At 21:51 the upper
gate was opened on the authority of **E. C., apprentice keeper** — Edith
Calloway, aged nineteen, alone in a gatehouse.

Opening the gate drowned the nineteen people still in the low town immediately.
Not opening it would have burst the dam onto Ardbeg. She did the arithmetic and
she opened the gate.

Her four-year-old brother Martin was in the low town.

She wrote a signed confession, listed all nineteen names on the back of it, and
filed it where the next keeper would find it. The next keeper was a reservoir.
She has been waiting sixty-one years for someone to read it — and when they
finally drained the valley, she could not come down here herself.

So she sent her daughter. Not to clear her name. To have somebody read it.

### How the player learns it

Entirely from documents and environment, in this order:

| Chapter | Discovery | What it changes |
| --- | --- | --- |
| I | A 1964 field book from a surveyor who fled | Someone else used this lamp |
| II | Evacuation notice: *"Low town not told. Ask Edith why."* | The name lands |
| II | Nineteen chalk tally marks on a low-town wall | Someone counted the dead |
| III | School register: twelve children never collected; *Calloway, M., aged four* | A Calloway child died here |
| III | A child's coat, name-taped MARTIN, in Edith's stitching | Edith had a brother |
| IV | The gate ledger: three times, and *E. C., apprentice keeper* | Edith opened the gate |
| V | Three stopped clocks matching the ledger times | The dials are a record, not a lock |
| V | Edith's signed confession, nineteen names on the reverse | She was never missing |

Nothing in the journal is anything Wren has not personally seen.

### The ending

The reservoir is refilled on schedule and nobody tells the surveyor still in
the valley. Martin stands in the gate mouth, where he has stood for sixty-one
years, facing the gatehouse, waiting for his sister to come out. Wren has
Edith's confession in her hand, with his name on the back of it.

Two endings, one deliberate action:

- **Shown** — she puts the light on him and holds it there while the water
  rises. For five chapters, lighting one of the Drowned has been the one thing
  that can kill her. Here it is the only kind thing left to do. *He stops
  waiting.*
- **Withheld** — she douses the lamp and walks past him in the dark. Safe. She
  carries his sister's confession out of the valley and never shows it to the
  only person it was addressed to.

The game does not label either as correct. It labels the prompt *Show him*.

An epilogue frames the whole thing as paragraph 14 of a survey report
recommending that nineteen names be added to a valley memorial which currently
lists none.

---

## 3. The protagonist

**Wren Calloway**, hydrographic surveyor, early thirties.

Rendered as a procedural bone rig rather than a sprite sheet: long coat that
flares when she runs, short hard-edged hair, survey satchel, lantern held in
her leading hand. The silhouette has to read at 56 pixels tall in near
darkness, so it is built around three shapes — coat hem, shoulder line, hair —
with a single cold rim light down her back for separation.

Animation states: idle (with breathing and weight shift), walk, run, crouch,
crouch-walk, climb, interact, reach, kneel, fear, fall, stagger. Transitions
are damped joint angles rather than clip blending, which is what makes every
transition smooth without authoring any of them.

Her voice in the writing is present-tense and plain. She is a professional
looking at a site. The documents she finds are formal and bureaucratic, which
is what makes them frightening.

---

## 4. Core mechanic — the Survey Lantern

### Rules

1. **Revelation.** Inside the beam, the world is 1964: lit windows, dry
   streets, furnished rooms.
2. **Solidity.** Before-layer geometry is collidable *only while lit*. The
   footbridge is real while you keep the beam on it.
3. **Attention.** The Drowned exist only in the Before and are blind in
   darkness. Lighting one is what lets it see you.

### Why it works

One rule generates traversal, every puzzle, and all the horror, and the three
pull against each other: you need the light to cross, you need the light to
read, and the light is what gets you caught.

### Feel decisions

- The lamp **comes up slowly and dies fast** (5.2/s vs 15/s). Dousing is a
  defensive action and has to be instant; igniting should feel like a
  commitment.
- There is **no fuel or battery**. Resource management would turn a dread
  mechanic into an inventory chore.
- The beam has a **near-field pool** so the ground directly underfoot is always
  revealed. Without it the player falls through the tile they are standing on
  when they look away, which feels like a bug no matter how consistent it is.
- Aim is **facing plus stick tilt**, damped. No separate aiming control: on a
  phone, every control you can delete is a win.

---

## 5. Movement

Not a platformer. There is no jump button.

| Verb | How |
| --- | --- |
| Walk | Thumbstick, 96 px/s |
| Run | Push the stick past 72%, 182 px/s |
| Crouch | Pull the stick down, or enter a low space |
| Climb | Ladders, up/down on the stick |
| Interact | Context button, appears only when relevant |
| Hide | Crouch and stay still in darkness |

Tuning favours response over momentum: acceleration 980, deceleration 1500,
turn acceleration 2200. Deceleration exceeds acceleration on purpose — the
character stops crisply and never feels like ice.

Height changes above 14 px are a climb, not a step. Every slope in the game is
built from `ramp()`, which emits a staircase of sub-threshold steps, and a
test walks every chapter end to end to prove it.

---

## 6. Puzzles

Four concepts, four *kinds of thinking*. None is a key-and-door, and a test
asserts that none can soft-lock.

### I — The Footbridge (traversal under a mechanical constraint)
*Chapter II.* The teaching puzzle. The bridge exists only in the beam; crossing
means trusting the mechanic with your footing. Failure drops you into a dry
channel with a slope back up the west bank — the east wall is sheer, so the
bridge stays the only way onward but falling is never a death or a dead end.

### II — The Children's Chalk (symbol interpretation under threat)
*Chapter III.* The low-town children worked the lantern's rule out the hard way
and chalked the ward floor: a closed mouth where it is safe to be lit, a cross
where it is not. The crosses mark where the Drowned stand. The entire floor is
crossable with the lamp off, so a player who panics and runs blind still gets
through; the puzzle is about confidence, not gating.

### III — The Counterweight Cart (object manipulation, tool vs hazard)
*Chapter IV.* A spoil cart must be wound up a graded rail to hold a collapsed
roof beam clear. The rail only exists in 1964, so the beam has to be on it for
the crank to bite. Players arrive expecting to need two hands at once and
discover the winch has a ratchet: nothing is ever lost, so the answer is light,
crank, repeat. Realising the ratchet exists *is* the puzzle.

### IV — The Sluice Dials (narrative deduction)
*Chapter V.* Three dials, three stopped clocks above them, three times in the
gate ledger: 21:40, 21:44, 21:51. The dials are not a lock — they are a record.
Setting them is the player performing Edith's act, deliberately, sixty-one
years late. The answer is in the documents, and nowhere else.

### Validation

Every puzzle declares, in its source header: required inputs, available clues,
the solution, state transitions, failure behaviour, completion behaviour, save
representation, reset behaviour, and its soft-lock analysis. `softlockRisk()`
is machine-checked by the test suite.

---

## 7. Horror design

### Where the fear comes from

Isolation; an enormous dark space with one small light in it; the knowledge
that the thing you need is the thing that will find you; and the fact that the
Drowned are people, with names, who were failed by paperwork.

### The Drowned

Three states the player can state out loud after two encounters:

1. It cannot see you unless your light is on it.
2. Once lit, it walks to where the light was.
3. In darkness it stops. **Standing still in the dark is always safe.**

Everything else — the 0.85s stir delay before it moves, the patience timer, the
walk home, the ripple it leaves in the silt — exists to make those three rules
legible, not to add depth.

Numbers chosen so being caught is always a decision, never arithmetic: pursuit
speed 104 px/s sits between Wren's walk (96) and her run (182). It can corner
her. It can never outrun her.

### Fairness

- Invisible *and* silent would be unfair, so each Drowned displaces a little
  silt: a faint ripple within about 190 px. Enough to warn, too vague to
  reassure.
- The stir delay is always the same length. It is the player's window and it
  never varies.
- Death costs about fifteen seconds. Same scene, same checkpoint, every clue
  and flag intact, every Drowned back to dormant. A horror game with expensive
  deaths teaches players to stop exploring, which is the one thing this game
  needs them to do.

### The Drowning Choir

Chapter III's set piece. Nineteen voices holding one note that none of them has
finished since 1964, synthesised as detuned triangle oscillators through
formant bandpass filters, drifting slowly flat over a minute. It ducks when
Wren crouches and stays still, so hiding is audibly rewarded.

---

## 8. Art direction

### Method

Procedural vector illustration, generated at runtime. 43 parameterised props
compose every location; there are no image files.

### The one rule that makes it cohere

Props are drawn in a **neutral value ramp**, not in final colour. The renderer
tints each parallax band with the scene palette and layers fog over it. Depth
therefore produces correct aerial perspective automatically, and the same prop
serves as a near silhouette and a distant haze-washed shape.

Values are mapped through a gamma curve rather than linearly, because prop
detail is authored between 0.05 and 0.35 and a linear lift squeezes all of it
into a flat rectangle.

### Two worlds, two palettes

| | Present | Before |
| --- | --- | --- |
| Key | Cold moon / inspection floodlight | Warm sodium, firelight, lit windows |
| Value | Near-black silhouettes | A lit night |
| Where | Below the darkness layer | **Above** it |

The Before layer sitting *above* the darkness is the whole image. The lamp is
not a torch brightening a cave; it is a window into another night.

### Composition

Seven parallax depth bands: void, far, mid-far, mid, play, near, fore. Actors
sit between mid and near. Foreground bands draw above the revealed past so they
occlude it correctly, and carry the scene's darkness in their own tint so they
still read as near-black silhouettes.

---

## 9. Scene progression

| # | Scene | Role | Beats |
| --- | --- | --- | --- |
| I | The Drained Shore | Teach | Walk, find the lantern, first reveal. No threat at all. |
| II | Corran Mill | Establish | Footbridge; first Drowned in open ground; the notice; the tally |
| III | The Sunken Ward | Horror | The choir; the chalk floor; Martin's coat |
| IV | The Mill Tunnels | Turn | The ledger; the counterweight; Martin waiting |
| V | The Gatehouse | Reveal | Clocks, dials, the confession, the revelation |
| VI | The Drowning Gate | Resolve | Rising water; the choice; the ending |

Chapter I contains no threat whatsoever. The player has to trust the lantern
completely before the game makes it dangerous.

---

## 10. Interface

Four controls on screen: an invisible movement surface, the lantern, a context
button that appears only when relevant, and two small corner utilities.
Running and crouching are folded into the stick.

Screens: title, pause, settings, clue journal, ending, credits. Narration is
shown one paragraph at a time and advanced by a tap — a wall of text in a
five-inch landscape window is unread text, and the pacing of a reveal is part
of the writing.

Accessibility: larger text, reduced motion, lower graphics quality, separate
master/music/effects volumes, and an option to hide interaction labels once
the controls are learned.
