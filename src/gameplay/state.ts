import { EventBus } from '@/core/events';
import type { SceneId } from '@/world/types';

export interface GameStateEvents {
  flagSet: { flag: string };
  clueFound: { clueId: string };
  itemTaken: { itemId: string };
  checkpoint: { sceneId: SceneId; spawnId: string };
  chapterChanged: { chapter: number };
  /** Something happened that is worth writing to disk. */
  dirty: { reason: string };
}

export interface PuzzleRecord {
  /** Opaque per-puzzle state, serialised into the save. */
  readonly [key: string]: number | string | boolean;
}

/**
 * All mutable progress, in one place.
 *
 * Deliberately a flat, serialisable bag of flags, sets and small records. Every
 * puzzle, door and story beat is expressed as a flag, which means the save file
 * is a faithful description of progress rather than a pile of special cases -
 * and it means a corrupted or partial save degrades to "slightly earlier" and
 * not to "broken".
 */
export class GameState {
  readonly events = new EventBus<GameStateEvents>();

  private flags = new Set<string>();
  private clues = new Set<string>();
  private items = new Set<string>();
  private puzzles = new Map<string, Record<string, number | string | boolean>>();

  sceneId: SceneId = 'shore';
  spawnId = 'default';
  chapter = 1;

  /** Last checkpoint, which is what a reload restores to. */
  checkpointScene: SceneId = 'shore';
  checkpointSpawn = 'default';

  /** Seconds of play, for the ending screen. */
  playTime = 0;
  /** Set once the player reaches an ending. */
  completed = false;
  /** Which ending they chose. */
  endingId: string | null = null;
  /** How many times the Drowned have taken her. Shown in the credits. */
  deaths = 0;

  // ------------------------------------------------------------------ flags

  hasFlag(flag: string): boolean {
    return this.flags.has(flag);
  }

  setFlag(flag: string, value = true): boolean {
    const had = this.flags.has(flag);
    if (value) {
      if (had) return false;
      this.flags.add(flag);
    } else {
      if (!had) return false;
      this.flags.delete(flag);
    }
    this.events.emit('flagSet', { flag });
    this.events.emit('dirty', { reason: `flag:${flag}` });
    return true;
  }

  get allFlags(): readonly string[] {
    return [...this.flags];
  }

  // ------------------------------------------------------------------ clues

  hasClue(id: string): boolean {
    return this.clues.has(id);
  }

  addClue(id: string): boolean {
    if (this.clues.has(id)) return false;
    this.clues.add(id);
    this.events.emit('clueFound', { clueId: id });
    this.events.emit('dirty', { reason: `clue:${id}` });
    return true;
  }

  get allClues(): readonly string[] {
    return [...this.clues];
  }

  get clueCount(): number {
    return this.clues.size;
  }

  // ------------------------------------------------------------------ items

  hasItem(id: string): boolean {
    return this.items.has(id);
  }

  addItem(id: string): boolean {
    if (this.items.has(id)) return false;
    this.items.add(id);
    this.events.emit('itemTaken', { itemId: id });
    this.events.emit('dirty', { reason: `item:${id}` });
    return true;
  }

  removeItem(id: string): boolean {
    const had = this.items.delete(id);
    if (had) this.events.emit('dirty', { reason: `item-used:${id}` });
    return had;
  }

  get allItems(): readonly string[] {
    return [...this.items];
  }

  // ---------------------------------------------------------------- puzzles

  getPuzzle(id: string): Record<string, number | string | boolean> {
    let record = this.puzzles.get(id);
    if (!record) {
      record = {};
      this.puzzles.set(id, record);
    }
    return record;
  }

  setPuzzle(id: string, record: Record<string, number | string | boolean>): void {
    this.puzzles.set(id, { ...record });
    this.events.emit('dirty', { reason: `puzzle:${id}` });
  }

  get allPuzzles(): Readonly<Record<string, Record<string, number | string | boolean>>> {
    return Object.fromEntries(this.puzzles);
  }

  // ------------------------------------------------------------- checkpoint

  setCheckpoint(sceneId: SceneId, spawnId: string): void {
    if (this.checkpointScene === sceneId && this.checkpointSpawn === spawnId) return;
    this.checkpointScene = sceneId;
    this.checkpointSpawn = spawnId;
    this.events.emit('checkpoint', { sceneId, spawnId });
    this.events.emit('dirty', { reason: 'checkpoint' });
  }

  setChapter(chapter: number): void {
    if (this.chapter === chapter) return;
    this.chapter = chapter;
    this.events.emit('chapterChanged', { chapter });
    this.events.emit('dirty', { reason: 'chapter' });
  }

  /** Wipes everything, for a new game. */
  reset(): void {
    this.flags.clear();
    this.clues.clear();
    this.items.clear();
    this.puzzles.clear();
    this.sceneId = 'shore';
    this.spawnId = 'default';
    this.chapter = 1;
    this.checkpointScene = 'shore';
    this.checkpointSpawn = 'default';
    this.playTime = 0;
    this.completed = false;
    this.endingId = null;
    this.deaths = 0;
  }

  /** Bulk load, used by the save system. Does not emit per-item events. */
  hydrate(data: {
    flags: readonly string[];
    clues: readonly string[];
    items: readonly string[];
    puzzles: Readonly<Record<string, Record<string, number | string | boolean>>>;
    sceneId: SceneId;
    spawnId: string;
    chapter: number;
    checkpointScene: SceneId;
    checkpointSpawn: string;
    playTime: number;
    completed: boolean;
    endingId: string | null;
    deaths: number;
  }): void {
    this.flags = new Set(data.flags);
    this.clues = new Set(data.clues);
    this.items = new Set(data.items);
    this.puzzles = new Map(Object.entries(data.puzzles).map(([k, v]) => [k, { ...v }]));
    this.sceneId = data.sceneId;
    this.spawnId = data.spawnId;
    this.chapter = data.chapter;
    this.checkpointScene = data.checkpointScene;
    this.checkpointSpawn = data.checkpointSpawn;
    this.playTime = data.playTime;
    this.completed = data.completed;
    this.endingId = data.endingId;
    this.deaths = data.deaths;
  }
}
