import type { Rect } from '@/core/math';
import type { Collider, Layer } from '@/physics/types';

export type SceneId = 'shore' | 'highstreet' | 'ward' | 'tunnels' | 'gatehouse' | 'gate';

export type Facing = 1 | -1;

/** A placed piece of procedural art. Props are drawn by the prop registry. */
export interface PropPlacement {
  /** Key into the prop registry. */
  readonly prop: string;
  readonly x: number;
  readonly y: number;
  /** Parallax depth band; see DEPTHS in the renderer. */
  readonly depth: number;
  readonly layer?: Layer;
  readonly flip?: boolean;
  readonly scale?: number;
  readonly alpha?: number;
  readonly tint?: number;
  /** Prop-specific parameters (width, window count, text, ...). */
  readonly params?: Readonly<Record<string, number | string | boolean>>;
}

/** Static light source. Present-layer lamps are dead; Before lamps still burn. */
export interface LampDef {
  readonly id?: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly color: number;
  readonly intensity: number;
  readonly layer: Layer;
  /** 0 = steady, 1 = violent flicker. */
  readonly flicker?: number;
  readonly requiresFlag?: string;
}

export type InteractKind =
  | 'examine'
  | 'clue'
  | 'pickup'
  | 'door'
  | 'puzzle'
  | 'lever'
  | 'hide'
  | 'note';

export interface InteractableDef {
  readonly id: string;
  /** Interaction zone in world space. */
  readonly zone: Rect;
  readonly kind: InteractKind;
  /** Short verb shown on the context button ("Read", "Open", "Turn"). */
  readonly verb: string;
  /** One-line label shown above the prompt. */
  readonly label: string;
  /** Narrative id resolved against the narrative database. */
  readonly textId?: string;
  /** Clue granted on first use. */
  readonly clueId?: string;
  /** Inventory item granted on first use. */
  readonly itemId?: string;
  /** Flag set on use. */
  readonly setsFlag?: string;
  /** Only offered while this flag is set. */
  readonly requiresFlag?: string;
  /** Hidden once this flag is set. */
  readonly hiddenByFlag?: string;
  /** Requires an inventory item; otherwise shows `lockedTextId`. */
  readonly requiresItem?: string;
  readonly lockedTextId?: string;
  /** Only interactable while lit by the lantern (Before-layer objects). */
  readonly requiresLight?: boolean;
  /** Puzzle id for `kind: 'puzzle'`. */
  readonly puzzleId?: string;
  /** Scene transition for `kind: 'door'`. */
  readonly exitTo?: SceneId;
  readonly exitSpawn?: string;
  /** Single-use. */
  readonly once?: boolean;
}

export type TriggerKind =
  | 'story'
  | 'checkpoint'
  | 'camera'
  | 'scare'
  | 'cinematic'
  | 'flag'
  | 'exit'
  | 'death';

export interface TriggerDef {
  readonly id: string;
  readonly zone: Rect;
  readonly kind: TriggerKind;
  readonly once?: boolean;
  readonly requiresFlag?: string;
  readonly hiddenByFlag?: string;
  readonly setsFlag?: string;
  readonly textId?: string;
  readonly cinematicId?: string;
  readonly checkpointId?: string;
  readonly exitTo?: SceneId;
  readonly exitSpawn?: string;
  /** Camera framing override while inside the zone. */
  readonly camera?: {
    readonly zoom?: number;
    readonly offsetX?: number;
    readonly offsetY?: number;
    readonly lockX?: number;
  };
  /** Only fires while the lantern is lit (or explicitly unlit). */
  readonly requiresLantern?: boolean;
  readonly requiresLanternOff?: boolean;
}

export type DrownedBehaviour = 'sentinel' | 'wanderer' | 'choir' | 'scripted';

export interface DrownedDef {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  /** Horizontal patrol/return extent. */
  readonly homeMin: number;
  readonly homeMax: number;
  readonly behaviour: DrownedBehaviour;
  /** Movement speed while pursuing, px/s. */
  readonly speed?: number;
  readonly requiresFlag?: string;
  readonly hiddenByFlag?: string;
  /** Visual variant: adult, child, keeper. */
  readonly variant?: 'adult' | 'child' | 'keeper';
}

export interface ScenePalette {
  /** Vertical sky/void gradient, top to bottom. */
  readonly skyTop: number;
  readonly skyBottom: number;
  /** Present-day silhouette ramp, far to near. */
  readonly far: number;
  readonly mid: number;
  readonly near: number;
  readonly ground: number;
  /** Atmospheric fog colour. */
  readonly fog: number;
  readonly fogStrength: number;
  /** How dark the unlit world is (0 = daylight, 1 = pitch black). */
  readonly darkness: number;
  /** Cold ambient key light (moon/sky bounce). */
  readonly ambient: number;
  /** Before-layer warm key. */
  readonly beforeKey: number;
}

export interface AmbienceDef {
  /** Base drone frequency in Hz. */
  readonly droneHz: number;
  /** Wind intensity 0..1. */
  readonly wind: number;
  /** Water/drip density 0..1. */
  readonly water: number;
  /** Structural creak density 0..1. */
  readonly creak: number;
  /** Reverb size 0..1 - small room to cathedral. */
  readonly space: number;
}

export interface SpawnPoint {
  readonly x: number;
  readonly y: number;
  readonly facing: Facing;
}

export interface SceneDef {
  readonly id: SceneId;
  /** Chapter card title. */
  readonly title: string;
  readonly subtitle: string;
  readonly bounds: Rect;
  /** Named spawn points; 'default' must exist. */
  readonly spawns: Readonly<Record<string, SpawnPoint>>;
  readonly palette: ScenePalette;
  readonly ambience: AmbienceDef;
  readonly colliders: readonly Collider[];
  readonly props: readonly PropPlacement[];
  readonly lamps: readonly LampDef[];
  readonly interactables: readonly InteractableDef[];
  readonly triggers: readonly TriggerDef[];
  readonly drowned: readonly DrownedDef[];
  /** Particle/weather mood. */
  readonly particles?: {
    readonly silt?: number;
    readonly dust?: number;
    readonly drips?: number;
    readonly embers?: number;
  };
  /** Scene-entry cinematic. */
  readonly introCinematic?: string;
  /** Whether the lantern is available at all (prologue starts without it). */
  readonly lanternAvailable?: boolean;
}
