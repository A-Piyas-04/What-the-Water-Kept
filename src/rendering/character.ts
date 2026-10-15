import { Container, Graphics } from 'pixi.js';
import { clamp01, damp, lerp } from '@/core/math';
import { fbm1 } from '@/core/rng';

/**
 * Procedural skeletal character rendering.
 *
 * There are no sprite sheets. Every character is a small bone hierarchy whose
 * joint angles are driven by pose functions and damped toward their targets,
 * which is what gives smooth, pop-free transitions between locomotion states
 * for free - and lets one rig serve the protagonist and all of the Drowned.
 */

export type PoseName =
  | 'idle'
  | 'walk'
  | 'run'
  | 'crouch'
  | 'crouchwalk'
  | 'climb'
  | 'interact'
  | 'fear'
  | 'fall'
  | 'stagger'
  | 'kneel'
  | 'reach';

/** Joint angles in radians, relative to the parent bone. */
export interface Pose {
  spine: number;
  neck: number;
  /** Vertical pelvis offset; negative = crouched lower. */
  hip: number;
  shoulderL: number;
  elbowL: number;
  shoulderR: number;
  elbowR: number;
  hipL: number;
  kneeL: number;
  hipR: number;
  kneeR: number;
  /** Coat flare, 0..1. */
  coat: number;
  /** Lean into movement. */
  lean: number;
}

const POSE_KEYS: readonly (keyof Pose)[] = [
  'spine', 'neck', 'hip', 'shoulderL', 'elbowL', 'shoulderR', 'elbowR',
  'hipL', 'kneeL', 'hipR', 'kneeR', 'coat', 'lean',
];

const zeroPose = (): Pose => ({
  spine: 0, neck: 0, hip: 0,
  shoulderL: 0, elbowL: 0, shoulderR: 0, elbowR: 0,
  hipL: 0, kneeL: 0, hipR: 0, kneeR: 0,
  coat: 0, lean: 0,
});

/** Proportions. Changing these alone yields a different character. */
export interface Build {
  /** Total height in world units. */
  height: number;
  shoulderW: number;
  hipW: number;
  headR: number;
  limbThick: number;
  /** 0 = no coat, 1 = long heavy coat. */
  coatLength: number;
  /** Visual weight of the silhouette. */
  bulk: number;
}

export const WREN_BUILD: Build = {
  height: 56,
  shoulderW: 11,
  hipW: 8.5,
  headR: 5.2,
  limbThick: 3.6,
  coatLength: 0.62,
  bulk: 1,
};

export const DROWNED_BUILDS: Readonly<Record<string, Build>> = {
  adult: {
    height: 60,
    shoulderW: 10,
    hipW: 7,
    headR: 5,
    limbThick: 3,
    coatLength: 0.5,
    bulk: 0.86,
  },
  child: {
    height: 36,
    shoulderW: 7,
    hipW: 5.5,
    headR: 4.4,
    limbThick: 2.6,
    coatLength: 0.3,
    bulk: 0.9,
  },
  keeper: {
    height: 68,
    shoulderW: 13.5,
    hipW: 9.5,
    headR: 5.4,
    limbThick: 4.3,
    coatLength: 0.9,
    bulk: 1.18,
  },
};

/** Walk cycle. `phase` is 0..1 through one full stride. */
const walkPose = (phase: number, intensity: number): Pose => {
  const p = zeroPose();
  const a = phase * Math.PI * 2;
  const swing = 0.62 * intensity;
  p.hipL = Math.sin(a) * swing;
  p.hipR = Math.sin(a + Math.PI) * swing;
  // Knees bend on the backswing, straighten through the step.
  p.kneeL = Math.max(0, -Math.sin(a - 0.7)) * 0.95 * intensity;
  p.kneeR = Math.max(0, -Math.sin(a + Math.PI - 0.7)) * 0.95 * intensity;
  // Arms counter-swing.
  p.shoulderL = Math.sin(a + Math.PI) * 0.4 * intensity;
  p.shoulderR = Math.sin(a) * 0.4 * intensity;
  p.elbowL = 0.25 + Math.max(0, Math.sin(a)) * 0.3;
  p.elbowR = 0.25 + Math.max(0, Math.sin(a + Math.PI)) * 0.3;
  // Pelvis rise and fall: two bobs per stride.
  p.hip = -Math.abs(Math.sin(a)) * 1.5 * intensity;
  p.spine = 0.05 + 0.04 * intensity;
  p.neck = -0.03;
  p.coat = 0.3 + intensity * 0.35;
  p.lean = 0.05 * intensity;
  return p;
};

const runPose = (phase: number): Pose => {
  const p = walkPose(phase, 1);
  const a = phase * Math.PI * 2;
  p.hipL = Math.sin(a) * 0.95;
  p.hipR = Math.sin(a + Math.PI) * 0.95;
  p.kneeL = Math.max(0, -Math.sin(a - 0.5)) * 1.5;
  p.kneeR = Math.max(0, -Math.sin(a + Math.PI - 0.5)) * 1.5;
  p.shoulderL = Math.sin(a + Math.PI) * 0.75;
  p.shoulderR = Math.sin(a) * 0.75;
  p.elbowL = 0.9;
  p.elbowR = 0.9;
  p.hip = -Math.abs(Math.sin(a)) * 2.6;
  p.spine = 0.2;
  p.neck = -0.1;
  p.lean = 0.2;
  p.coat = 0.95;
  return p;
};

const crouchPose = (phase: number, moving: boolean): Pose => {
  const p = zeroPose();
  p.hip = 13;
  p.spine = 0.42;
  p.neck = -0.3;
  p.coat = 0.12;
  if (moving) {
    const a = phase * Math.PI * 2;
    p.hipL = Math.sin(a) * 0.36;
    p.hipR = Math.sin(a + Math.PI) * 0.36;
    p.kneeL = 1.25 + Math.max(0, -Math.sin(a)) * 0.4;
    p.kneeR = 1.25 + Math.max(0, -Math.sin(a + Math.PI)) * 0.4;
    p.shoulderL = Math.sin(a + Math.PI) * 0.2 - 0.2;
    p.shoulderR = Math.sin(a) * 0.2 - 0.2;
    p.hip = 13 - Math.abs(Math.sin(a));
  } else {
    p.hipL = 0.18;
    p.hipR = -0.14;
    p.kneeL = 1.35;
    p.kneeR = 1.45;
    p.shoulderL = -0.3;
    p.shoulderR = -0.24;
  }
  p.elbowL = 0.75;
  p.elbowR = 0.6;
  return p;
};

const idlePose = (t: number): Pose => {
  const p = zeroPose();
  // Breathing, plus a slow weight shift so she never looks frozen.
  const breathe = Math.sin(t * 1.5) * 0.5 + 0.5;
  const shift = fbm1(t * 0.22, 2, 31);
  p.spine = 0.045 + breathe * 0.022;
  p.neck = -0.05 - breathe * 0.02;
  p.hip = -breathe * 0.35 + shift * 0.6;
  p.hipL = 0.05 + shift * 0.08;
  p.hipR = -0.07 - shift * 0.06;
  p.kneeL = 0.06;
  p.kneeR = 0.12;
  p.shoulderL = -0.12 + breathe * 0.03;
  p.shoulderR = -0.06;
  p.elbowL = 0.32;
  p.elbowR = 0.2;
  p.coat = 0.14;
  return p;
};

const POSES: Record<PoseName, (t: number, phase: number) => Pose> = {
  idle: (t) => idlePose(t),
  walk: (_t, phase) => walkPose(phase, 1),
  run: (_t, phase) => runPose(phase),
  crouch: (t) => crouchPose(t, false),
  crouchwalk: (_t, phase) => crouchPose(phase, true),
  climb: (_t, phase) => {
    const p = zeroPose();
    const a = phase * Math.PI * 2;
    p.spine = -0.08;
    p.neck = 0.1;
    p.shoulderL = -2.3 + Math.sin(a) * 0.5;
    p.shoulderR = -2.3 + Math.sin(a + Math.PI) * 0.5;
    p.elbowL = 0.5 + Math.max(0, Math.sin(a)) * 0.6;
    p.elbowR = 0.5 + Math.max(0, Math.sin(a + Math.PI)) * 0.6;
    p.hipL = 0.3 + Math.sin(a + Math.PI) * 0.45;
    p.hipR = 0.3 + Math.sin(a) * 0.45;
    p.kneeL = 0.7;
    p.kneeR = 0.7;
    p.coat = 0.08;
    return p;
  },
  interact: (t) => {
    const p = idlePose(t * 0.5);
    // Reaching forward with the free hand, lamp held back and low.
    p.shoulderR = -1.15;
    p.elbowR = 0.42;
    p.spine = 0.12;
    p.neck = 0.08;
    p.lean = 0.07;
    return p;
  },
  reach: (t) => {
    const p = idlePose(t * 0.5);
    p.shoulderR = -1.75;
    p.elbowR = 0.16;
    p.spine = 0.06;
    p.neck = 0.16;
    return p;
  },
  kneel: () => {
    const p = zeroPose();
    p.hip = 20;
    p.spine = 0.3;
    p.neck = 0.22;
    p.hipL = 1.2;
    p.kneeL = 1.9;
    p.hipR = -0.2;
    p.kneeR = 1.5;
    p.shoulderL = -0.3;
    p.shoulderR = -0.75;
    p.elbowL = 0.6;
    p.elbowR = 0.5;
    p.coat = 0.05;
    return p;
  },
  fear: (t) => {
    const p = zeroPose();
    // Pulled in, shoulders up, head back, small tremor.
    const tremor = Math.sin(t * 19) * 0.016 + fbm1(t * 7, 2, 3) * 0.02;
    p.spine = 0.26 + tremor;
    p.neck = -0.3;
    p.hip = 3;
    p.hipL = 0.22;
    p.hipR = -0.3;
    p.kneeL = 0.42;
    p.kneeR = 0.3;
    p.shoulderL = -0.62 + tremor;
    p.shoulderR = -0.5 - tremor;
    p.elbowL = 1.25;
    p.elbowR = 1.15;
    p.coat = 0.1;
    p.lean = -0.1;
    return p;
  },
  fall: () => {
    const p = zeroPose();
    p.spine = -0.12;
    p.neck = 0.06;
    p.shoulderL = -1.5;
    p.shoulderR = -1.3;
    p.elbowL = 0.7;
    p.elbowR = 0.55;
    p.hipL = -0.3;
    p.hipR = 0.4;
    p.kneeL = 0.9;
    p.kneeR = 0.4;
    p.coat = 1;
    return p;
  },
  stagger: (t) => {
    const p = zeroPose();
    p.spine = 0.36;
    p.neck = -0.24;
    p.lean = -0.26;
    p.hip = 5;
    p.hipL = -0.4 + Math.sin(t * 8) * 0.1;
    p.hipR = 0.5;
    p.kneeL = 0.7;
    p.kneeR = 1.0;
    p.shoulderL = -0.9;
    p.shoulderR = -0.4;
    p.elbowL = 1.3;
    p.elbowR = 0.9;
    p.coat = 0.5;
    return p;
  },
};

/** A tapered limb segment, drawn as a quad. */
const limb = (
  g: Graphics,
  x: number,
  y: number,
  angle: number,
  length: number,
  w0: number,
  w1: number,
  color: number,
): [number, number] => {
  const ex = x + Math.sin(angle) * length;
  const ey = y + Math.cos(angle) * length;
  const nx = Math.cos(angle);
  const ny = -Math.sin(angle);
  g.poly([
    x + nx * w0 * 0.5, y + ny * w0 * 0.5,
    x - nx * w0 * 0.5, y - ny * w0 * 0.5,
    ex - nx * w1 * 0.5, ey - ny * w1 * 0.5,
    ex + nx * w1 * 0.5, ey + ny * w1 * 0.5,
  ]).fill({ color });
  return [ex, ey];
};

export interface CharacterColors {
  /** Main silhouette. */
  body: number;
  /** Coat / outer garment. */
  coat: number;
  /** Skin, hands and face. */
  skin: number;
  /** Rim light, for separation from the background. */
  rim: number;
}

export const WREN_COLORS: CharacterColors = {
  body: 0x14181d,
  coat: 0x1d242b,
  skin: 0x8a7f74,
  rim: 0x7fa0b2,
};

export const DROWNED_COLORS: CharacterColors = {
  body: 0x252c2a,
  coat: 0x2d3634,
  skin: 0x6e7b72,
  rim: 0xa8c6bd,
};

/**
 * A posed, drawn character.
 *
 * `setPose` picks the target pose; joint angles are damped toward it every
 * frame, so switching from run to crouch is a blend rather than a cut.
 */
export class Character {
  readonly container = new Container();
  private readonly g = new Graphics();
  private readonly current: Pose = zeroPose();
  private target: Pose = zeroPose();
  private poseName: PoseName = 'idle';
  private phase = 0;
  private time = 0;
  private facingVisual = 1;

  /** Set by the owner; drives the walk/run cycle speed. */
  strideRate = 0;
  /** 0..1 blend weight toward the pose; lower = lazier limbs. */
  blendRate = 15;
  /** Lantern-holding hand position in local space, filled in after draw. */
  readonly lampHand = { x: 0, y: 0 };
  /** Head position in local space, for audio and camera framing. */
  readonly headPoint = { x: 0, y: 0 };

  constructor(
    private readonly build: Build,
    private readonly colors: CharacterColors,
    /** Draws the lantern in the hand. The Drowned do not carry one. */
    private readonly carriesLantern = false,
  ) {
    this.container.addChild(this.g);
  }

  setPose(name: PoseName): void {
    this.poseName = name;
  }

  get pose(): PoseName {
    return this.poseName;
  }

  /** Instantly snaps the blend - for respawns and scene entry. */
  snapPose(): void {
    const t = POSES[this.poseName](this.time, this.phase);
    for (const k of POSE_KEYS) this.current[k] = t[k];
  }

  update(dt: number, facing: number): void {
    this.time += dt;
    if (this.poseName === 'walk' || this.poseName === 'run' || this.poseName === 'crouchwalk') {
      this.phase = (this.phase + this.strideRate * dt) % 1;
    } else if (this.poseName === 'climb') {
      this.phase = (this.phase + this.strideRate * dt) % 1;
    }

    this.target = POSES[this.poseName](this.time, this.phase);
    for (const k of POSE_KEYS) {
      this.current[k] = damp(this.current[k], this.target[k], this.blendRate, dt);
    }
    // Turning is a visual rotation of the whole rig, not an instant flip.
    this.facingVisual = damp(this.facingVisual, facing, 16, dt);
    this.draw();
  }

  get turning(): boolean {
    return Math.abs(this.facingVisual) < 0.82;
  }

  private draw(): void {
    const g = this.g;
    const b = this.build;
    const c = this.colors;
    const p = this.current;
    g.clear();

    const dir = this.facingVisual >= 0 ? 1 : -1;
    // Squash the rig horizontally through a turn so she reads as rotating.
    const squash = Math.max(0.12, Math.abs(this.facingVisual));

    const legLen = b.height * 0.46;
    const torsoLen = b.height * 0.33;
    const armLen = b.height * 0.3;

    const hipY = -legLen + p.hip;
    const hipX = 0;
    const lean = p.lean * dir;

    // --- Legs (far leg first) ---
    const legThick = b.limbThick * b.bulk;
    const drawLeg = (hipAngle: number, kneeAngle: number, shade: number): [number, number] => {
      const a1 = Math.PI + hipAngle * dir * squash;
      const [kx, ky] = limb(
        g, hipX, hipY, a1, legLen * 0.52,
        legThick * 1.15, legThick * 0.95,
        shade,
      );
      const [fx, fy] = limb(
        g, kx, ky, a1 - kneeAngle * dir * squash, legLen * 0.48,
        legThick * 0.95, legThick * 0.7,
        shade,
      );
      // Boot.
      g.poly([
        fx - legThick * 0.6, fy - legThick * 0.4,
        fx + legThick * 0.6, fy - legThick * 0.4,
        fx + legThick * 0.6 + dir * squash * 4.5, fy + 1.4,
        fx - legThick * 0.8, fy + 1.4,
      ]).fill({ color: shade });
      return [fx, fy];
    };
    drawLeg(p.hipR, p.kneeR, c.body);
    drawLeg(p.hipL, p.kneeL, c.coat);

    // --- Torso ---
    const spineAngle = Math.PI + p.spine * dir * squash + lean * 0.5;
    const [shoX, shoY] = [
      hipX + Math.sin(spineAngle) * torsoLen,
      hipY + Math.cos(spineAngle) * torsoLen,
    ];
    g.poly([
      hipX - (b.hipW * 0.5) * squash, hipY,
      hipX + (b.hipW * 0.5) * squash, hipY,
      shoX + (b.shoulderW * 0.5) * squash, shoY,
      shoX - (b.shoulderW * 0.5) * squash, shoY,
    ]).fill({ color: c.body });

    // --- Coat: the silhouette's signature ---
    if (b.coatLength > 0) {
      const hemY = hipY + legLen * b.coatLength * 0.62;
      const flare = (6 + p.coat * 12) * squash;
      const back = -dir * flare;
      const front = dir * flare * 0.42;
      g.poly([
        shoX - (b.shoulderW * 0.56) * squash, shoY + 2,
        shoX + (b.shoulderW * 0.56) * squash, shoY + 2,
        hipX + (b.hipW * 0.7) * squash + front, hemY - 6,
        hipX + (b.hipW * 0.62) * squash + front * 1.3, hemY,
        hipX - (b.hipW * 0.62) * squash + back * 1.2, hemY + p.coat * 3,
        hipX - (b.hipW * 0.74) * squash + back, hemY - 7,
      ]).fill({ color: c.coat });
      // Hem shadow, so the coat reads as cloth not a card.
      g.poly([
        hipX + (b.hipW * 0.62) * squash + front * 1.3, hemY,
        hipX - (b.hipW * 0.62) * squash + back * 1.2, hemY + p.coat * 3,
        hipX - (b.hipW * 0.62) * squash + back * 1.2, hemY + p.coat * 3 - 2.5,
        hipX + (b.hipW * 0.62) * squash + front * 1.3, hemY - 2.5,
      ]).fill({ color: 0x000000, alpha: 0.35 });
    }

    // --- Arms ---
    const armThick = b.limbThick * 0.85 * b.bulk;
    const drawArm = (shoulderAngle: number, elbowAngle: number, shade: number): [number, number] => {
      const a1 = Math.PI + shoulderAngle * dir * squash;
      const [ex, ey] = limb(
        g, shoX, shoY + 1.5, a1, armLen * 0.5,
        armThick, armThick * 0.85, shade,
      );
      const [hx, hy] = limb(
        g, ex, ey, a1 - elbowAngle * dir * squash, armLen * 0.5,
        armThick * 0.85, armThick * 0.65, shade,
      );
      g.circle(hx, hy, armThick * 0.55).fill({ color: c.skin });
      return [hx, hy];
    };
    // Far arm behind the torso, near arm in front.
    drawArm(p.shoulderL, p.elbowL, c.body);
    const [handX, handY] = drawArm(p.shoulderR, p.elbowR, c.coat);
    this.lampHand.x = handX;
    this.lampHand.y = handY;

    // --- Head ---
    const neckAngle = spineAngle + p.neck * dir * squash;
    const headX = shoX + Math.sin(neckAngle) * (b.headR * 1.5);
    const headY = shoY + Math.cos(neckAngle) * (b.headR * 1.5);
    this.headPoint.x = headX;
    this.headPoint.y = headY;
    // Neck.
    g.poly([
      shoX - 2 * squash, shoY, shoX + 2 * squash, shoY,
      headX + 1.6 * squash, headY, headX - 1.6 * squash, headY,
    ]).fill({ color: c.skin });
    // Skull: an ellipse squashed with the turn, plus a jaw wedge.
    g.ellipse(headX, headY, b.headR * squash * 0.92, b.headR * 1.05).fill({ color: c.skin });
    g.poly([
      headX + dir * b.headR * 0.2 * squash, headY + b.headR * 0.3,
      headX + dir * b.headR * 0.95 * squash, headY + b.headR * 0.12,
      headX + dir * b.headR * 0.5 * squash, headY + b.headR * 0.85,
    ]).fill({ color: c.skin });
    // Hair: a hard shape, which is what carries the silhouette.
    g.poly([
      headX - dir * b.headR * 1.05 * squash, headY - b.headR * 0.5,
      headX - dir * b.headR * 0.1 * squash, headY - b.headR * 1.2,
      headX + dir * b.headR * 0.85 * squash, headY - b.headR * 0.62,
      headX + dir * b.headR * 0.5 * squash, headY - b.headR * 0.1,
      headX - dir * b.headR * 0.6 * squash, headY + b.headR * 0.55,
      headX - dir * b.headR * 1.2 * squash, headY + b.headR * 0.15,
    ]).fill({ color: c.body });

    // --- Rim light ---
    // A single cold edge down the back separates her from the dark. It is the
    // cheapest and most effective readability tool in the whole renderer.
    const rimX = -dir * 0.9;
    g.poly([
      shoX - dir * (b.shoulderW * 0.5) * squash + rimX, shoY,
      hipX - dir * (b.hipW * 0.5) * squash + rimX, hipY,
      hipX - dir * (b.hipW * 0.5) * squash + rimX - 1.3, hipY,
      shoX - dir * (b.shoulderW * 0.5) * squash + rimX - 1.3, shoY,
    ]).fill({ color: c.rim, alpha: 0.34 });
    g.ellipse(
      headX - dir * b.headR * 0.72 * squash,
      headY - b.headR * 0.18,
      b.headR * 0.3 * squash,
      b.headR * 0.78,
    ).fill({ color: c.rim, alpha: 0.26 });

    // --- The lantern ---
    if (this.carriesLantern) {
      const lx = handX + dir * 1.5;
      const ly = handY + 3.5;
      g.rect(lx - 3.4, ly - 1, 6.8, 7.5).fill({ color: 0x2b2a26 });
      g.rect(lx - 4.2, ly + 6.5, 8.4, 1.8).fill({ color: 0x3a3832 });
      g.poly([lx - 3, ly - 1, lx + 3, ly - 1, lx + 2, ly - 4.5, lx - 2, ly - 4.5])
        .fill({ color: 0x2b2a26 });
      g.circle(lx, ly + 3, 1.9).fill({ color: 0xffd9a0, alpha: 0.95 });
    }
  }

  /** Where the lantern sits in local space. */
  lampOffset(): [number, number] {
    return [this.lampHand.x, this.lampHand.y + 3];
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}

/**
 * The faint disturbance a Drowned leaves in the present-day air.
 *
 * The Drowned are invisible in darkness - that is the rule, and it is what
 * makes the lantern frightening. But invisible-and-silent would be unfair, so
 * each one displaces a little of the silt around it. Close enough to matter,
 * vague enough to stay frightening.
 */
export class Disturbance {
  readonly container = new Container();
  private readonly g = new Graphics();
  private t = 0;
  private strength = 0;

  constructor() {
    this.container.addChild(this.g);
    this.g.blendMode = 'add';
  }

  setStrength(s: number): void {
    this.strength = clamp01(s);
  }

  update(dt: number): void {
    this.t += dt;
    const g = this.g;
    g.clear();
    if (this.strength <= 0.01) {
      this.container.visible = false;
      return;
    }
    this.container.visible = true;
    const s = this.strength;
    for (let i = 0; i < 4; i++) {
      const phase = this.t * 1.5 + i * 0.9;
      const r = 7 + ((phase % 2.4) / 2.4) * 26;
      const a = (1 - (phase % 2.4) / 2.4) * 0.1 * s;
      g.ellipse(0, -22 + Math.sin(phase) * 5, r, r * 0.42)
        .stroke({ width: 1.1, color: 0x9fc4bd, alpha: a });
    }
    g.ellipse(0, -24, 10 * s, 26 * s).fill({ color: 0x6d8f88, alpha: 0.045 * s });
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}

export const blendPose = (a: Pose, b: Pose, t: number): Pose => {
  const out = zeroPose();
  for (const k of POSE_KEYS) out[k] = lerp(a[k], b[k], t);
  return out;
};
