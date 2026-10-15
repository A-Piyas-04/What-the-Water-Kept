import type { SceneId } from '@/world/types';

/** Bump when the shape changes. `migrate` must then handle the old shape. */
export const SAVE_VERSION = 3;

export const SCENE_IDS: readonly SceneId[] = [
  'shore',
  'highstreet',
  'ward',
  'tunnels',
  'gatehouse',
  'gate',
];

export interface SaveSettings {
  master: number;
  music: number;
  sfx: number;
  /** Reduced effects for weaker devices. */
  lowQuality: boolean;
  /** Larger UI text. */
  largeText: boolean;
  /** Reduces camera shake and screen movement. */
  reducedMotion: boolean;
  /** Holds the interact button instead of requiring a press-and-hold. */
  holdAssist: boolean;
  /** Shows the context prompt label as well as the icon. */
  showHints: boolean;
}

export const DEFAULT_SETTINGS: SaveSettings = {
  master: 0.85,
  music: 0.7,
  sfx: 0.9,
  lowQuality: false,
  largeText: false,
  reducedMotion: false,
  holdAssist: false,
  showHints: true,
};

export interface SaveData {
  version: number;
  /** Unix ms, for the Continue label. */
  savedAt: number;
  sceneId: SceneId;
  spawnId: string;
  chapter: number;
  checkpointScene: SceneId;
  checkpointSpawn: string;
  /** Position is only restored when it is safe to do so. */
  playerX: number | null;
  playerY: number | null;
  playerFacing: 1 | -1;
  flags: string[];
  clues: string[];
  items: string[];
  puzzles: Record<string, Record<string, number | string | boolean>>;
  playTime: number;
  completed: boolean;
  endingId: string | null;
  deaths: number;
}

export interface SaveEnvelope {
  data: SaveData;
  /** Simple integrity check over the serialised payload. */
  checksum: number;
}

/**
 * FNV-1a over the serialised payload.
 *
 * Not security - it exists to catch a half-written record from a WebView that
 * was killed mid-write, which is a real failure mode on Android.
 */
export const checksum = (text: string): number => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const isSceneId = (value: unknown): value is SceneId =>
  typeof value === 'string' && (SCENE_IDS as readonly string[]).includes(value);

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const str = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const strArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

/**
 * Coerces anything into a usable SaveData, or returns null if it is too far
 * gone to be worth trusting.
 *
 * The contract is deliberately forgiving about fields and strict about the one
 * thing that matters: the checkpoint must name a scene that exists. A save
 * that points at a scene we cannot load is worse than no save at all, because
 * it looks like progress and then soft-locks.
 */
export const validate = (raw: unknown): SaveData | null => {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;

  const checkpointScene = isSceneId(o.checkpointScene) ? o.checkpointScene : null;
  if (!checkpointScene) return null;

  const sceneId = isSceneId(o.sceneId) ? o.sceneId : checkpointScene;
  const facing = o.playerFacing === -1 ? -1 : 1;

  const puzzles: Record<string, Record<string, number | string | boolean>> = {};
  if (o.puzzles && typeof o.puzzles === 'object') {
    for (const [key, value] of Object.entries(o.puzzles as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const record: Record<string, number | string | boolean> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (typeof v === 'number' && Number.isFinite(v)) record[k] = v;
        else if (typeof v === 'string' || typeof v === 'boolean') record[k] = v;
      }
      puzzles[key] = record;
    }
  }

  return {
    version: num(o.version, SAVE_VERSION),
    savedAt: num(o.savedAt, Date.now()),
    sceneId,
    spawnId: str(o.spawnId, 'default'),
    chapter: Math.max(1, Math.min(6, Math.round(num(o.chapter, 1)))),
    checkpointScene,
    checkpointSpawn: str(o.checkpointSpawn, 'default'),
    playerX: typeof o.playerX === 'number' && Number.isFinite(o.playerX) ? o.playerX : null,
    playerY: typeof o.playerY === 'number' && Number.isFinite(o.playerY) ? o.playerY : null,
    playerFacing: facing,
    flags: strArray(o.flags),
    clues: strArray(o.clues),
    items: strArray(o.items),
    puzzles,
    playTime: Math.max(0, num(o.playTime, 0)),
    completed: bool(o.completed, false),
    endingId: typeof o.endingId === 'string' ? o.endingId : null,
    deaths: Math.max(0, Math.round(num(o.deaths, 0))),
  };
};

/**
 * Brings older saves forward.
 *
 * Version 1 had no `puzzles` map and stored the chapter as a scene name.
 * Version 2 had no `deaths` or `endingId`. Both are handled by `validate`'s
 * defaults; this hook exists for changes that need real work, and for the
 * one thing defaults cannot fix: a position that is no longer valid.
 */
export const migrate = (data: SaveData): SaveData => {
  const out = { ...data };
  if (out.version < 2) {
    // v1 saved a mid-scene position that predates the current collision data.
    // Dropping it sends the player to the checkpoint spawn instead, which is
    // always safe.
    out.playerX = null;
    out.playerY = null;
  }
  if (out.version < 3) {
    // v2 did not record the lantern as an inventory item, but every save past
    // the prologue implies it.
    if (out.checkpointScene !== 'shore' && !out.items.includes('item-lantern')) {
      out.items = [...out.items, 'item-lantern'];
    }
  }
  out.version = SAVE_VERSION;
  return out;
};

export const validateSettings = (raw: unknown): SaveSettings => {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  const o = raw as Record<string, unknown>;
  const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
  return {
    master: clamp01(num(o.master, DEFAULT_SETTINGS.master)),
    music: clamp01(num(o.music, DEFAULT_SETTINGS.music)),
    sfx: clamp01(num(o.sfx, DEFAULT_SETTINGS.sfx)),
    lowQuality: bool(o.lowQuality, DEFAULT_SETTINGS.lowQuality),
    largeText: bool(o.largeText, DEFAULT_SETTINGS.largeText),
    reducedMotion: bool(o.reducedMotion, DEFAULT_SETTINGS.reducedMotion),
    holdAssist: bool(o.holdAssist, DEFAULT_SETTINGS.holdAssist),
    showHints: bool(o.showHints, DEFAULT_SETTINGS.showHints),
  };
};
