import { describe, expect, it } from 'vitest';
import { GameState } from '@/gameplay/state';
import {
  DEFAULT_SETTINGS,
  SAVE_VERSION,
  type SaveData,
  checksum,
  migrate,
  validate,
  validateSettings,
} from '@/persistence/schema';

const goodSave = (overrides: Partial<SaveData> = {}): SaveData => ({
  version: SAVE_VERSION,
  savedAt: 1_700_000_000_000,
  sceneId: 'ward',
  spawnId: 'mid',
  chapter: 3,
  checkpointScene: 'ward',
  checkpointSpawn: 'mid',
  playerX: 1440,
  playerY: 0,
  playerFacing: 1,
  flags: ['knows-rule', 'read-notice'],
  clues: ['clue-lantern', 'clue-chalk'],
  items: ['item-lantern'],
  puzzles: { 'puzzle-chalk': { reached: 3, woke: 1 } },
  playTime: 842.5,
  completed: false,
  endingId: null,
  deaths: 2,
  ...overrides,
});

describe('save validation', () => {
  it('accepts a well-formed save unchanged', () => {
    const data = validate(goodSave());
    expect(data).not.toBeNull();
    expect(data?.checkpointScene).toBe('ward');
    expect(data?.clues).toEqual(['clue-lantern', 'clue-chalk']);
    expect(data?.puzzles['puzzle-chalk'].reached).toBe(3);
  });

  it('rejects non-objects', () => {
    expect(validate(null)).toBeNull();
    expect(validate(undefined)).toBeNull();
    expect(validate('a string')).toBeNull();
    expect(validate(42)).toBeNull();
  });

  it('rejects a save whose checkpoint scene does not exist', () => {
    // The one unrecoverable case: a save pointing at a scene we cannot load
    // looks like progress and then soft-locks, so it must be refused.
    expect(validate(goodSave({ checkpointScene: 'atlantis' as never }))).toBeNull();
    expect(validate({ ...goodSave(), checkpointScene: undefined })).toBeNull();
  });

  it('fills in missing optional fields rather than failing', () => {
    const data = validate({ checkpointScene: 'shore' });
    expect(data).not.toBeNull();
    expect(data?.chapter).toBe(1);
    expect(data?.spawnId).toBe('default');
    expect(data?.flags).toEqual([]);
    expect(data?.deaths).toBe(0);
    expect(data?.completed).toBe(false);
  });

  it('discards garbage inside the arrays', () => {
    const data = validate({
      checkpointScene: 'shore',
      flags: ['ok', 42, null, { a: 1 }, 'fine'],
      clues: 'not-an-array',
    });
    expect(data?.flags).toEqual(['ok', 'fine']);
    expect(data?.clues).toEqual([]);
  });

  it('rejects non-finite numbers', () => {
    const data = validate(goodSave({ playerX: Number.NaN, playTime: Number.POSITIVE_INFINITY }));
    expect(data?.playerX).toBeNull();
    expect(data?.playTime).toBe(0);
  });

  it('clamps the chapter into range', () => {
    expect(validate(goodSave({ chapter: 99 }))?.chapter).toBe(6);
    expect(validate(goodSave({ chapter: -4 }))?.chapter).toBe(1);
  });

  it('normalises facing', () => {
    expect(validate(goodSave({ playerFacing: -1 }))?.playerFacing).toBe(-1);
    expect(validate(goodSave({ playerFacing: 7 as never }))?.playerFacing).toBe(1);
  });

  it('falls back to the checkpoint when sceneId is invalid', () => {
    const data = validate(goodSave({ sceneId: 'nowhere' as never }));
    expect(data?.sceneId).toBe('ward');
  });

  it('strips unserialisable puzzle values', () => {
    const data = validate({
      checkpointScene: 'shore',
      puzzles: {
        good: { a: 1, b: 'two', c: true },
        bad: { d: Number.NaN, e: { nested: 1 }, f: [1, 2] },
        notAnObject: 5,
      },
    });
    expect(data?.puzzles.good).toEqual({ a: 1, b: 'two', c: true });
    expect(data?.puzzles.bad).toEqual({});
    expect(data?.puzzles.notAnObject).toBeUndefined();
  });
});

describe('save migration', () => {
  it('stamps the current version', () => {
    expect(migrate(goodSave({ version: 1 })).version).toBe(SAVE_VERSION);
  });

  it('drops a v1 position, since it predates the current collision data', () => {
    const out = migrate(goodSave({ version: 1 }));
    expect(out.playerX).toBeNull();
    expect(out.playerY).toBeNull();
  });

  it('grants the lantern to a v2 save past the prologue', () => {
    const out = migrate(goodSave({ version: 2, items: [], checkpointScene: 'tunnels' }));
    expect(out.items).toContain('item-lantern');
  });

  it('does not grant the lantern to a v2 save still in the prologue', () => {
    const out = migrate(goodSave({ version: 2, items: [], checkpointScene: 'shore' }));
    expect(out.items).not.toContain('item-lantern');
  });

  it('leaves a current save alone', () => {
    const input = goodSave();
    const out = migrate(input);
    expect(out.playerX).toBe(input.playerX);
    expect(out.items).toEqual(input.items);
  });
});

describe('checksum', () => {
  it('is stable for identical payloads', () => {
    expect(checksum('hello')).toBe(checksum('hello'));
  });

  it('differs for a truncated payload', () => {
    const full = JSON.stringify(goodSave());
    expect(checksum(full)).not.toBe(checksum(full.slice(0, full.length - 8)));
  });

  it('differs for a single changed character', () => {
    expect(checksum('{"a":1}')).not.toBe(checksum('{"a":2}'));
  });
});

describe('settings validation', () => {
  it('returns defaults for nonsense', () => {
    expect(validateSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(validateSettings('x')).toEqual(DEFAULT_SETTINGS);
  });

  it('clamps volumes to 0..1', () => {
    const s = validateSettings({ master: 4, music: -2, sfx: 0.5 });
    expect(s.master).toBe(1);
    expect(s.music).toBe(0);
    expect(s.sfx).toBe(0.5);
  });

  it('keeps valid booleans and defaults invalid ones', () => {
    const s = validateSettings({ lowQuality: true, largeText: 'yes' });
    expect(s.lowQuality).toBe(true);
    expect(s.largeText).toBe(DEFAULT_SETTINGS.largeText);
  });
});

describe('game state', () => {
  it('reports flag changes once', () => {
    const state = new GameState();
    const seen: string[] = [];
    state.events.on('flagSet', ({ flag }) => seen.push(flag));
    expect(state.setFlag('a')).toBe(true);
    expect(state.setFlag('a')).toBe(false);
    expect(seen).toEqual(['a']);
    expect(state.hasFlag('a')).toBe(true);
  });

  it('clears a flag', () => {
    const state = new GameState();
    state.setFlag('a');
    expect(state.setFlag('a', false)).toBe(true);
    expect(state.hasFlag('a')).toBe(false);
  });

  it('deduplicates clues and items', () => {
    const state = new GameState();
    expect(state.addClue('c1')).toBe(true);
    expect(state.addClue('c1')).toBe(false);
    expect(state.clueCount).toBe(1);
    expect(state.addItem('i1')).toBe(true);
    expect(state.addItem('i1')).toBe(false);
    expect(state.allItems).toEqual(['i1']);
  });

  it('round-trips through hydrate', () => {
    const a = new GameState();
    a.setFlag('f1');
    a.addClue('c1');
    a.addItem('i1');
    a.setPuzzle('p1', { x: 3 });
    a.setCheckpoint('tunnels', 'winch');
    a.playTime = 123;
    a.deaths = 4;

    const b = new GameState();
    b.hydrate({
      flags: a.allFlags,
      clues: a.allClues,
      items: a.allItems,
      puzzles: a.allPuzzles,
      sceneId: a.sceneId,
      spawnId: a.spawnId,
      chapter: a.chapter,
      checkpointScene: a.checkpointScene,
      checkpointSpawn: a.checkpointSpawn,
      playTime: a.playTime,
      completed: a.completed,
      endingId: a.endingId,
      deaths: a.deaths,
    });
    expect(b.hasFlag('f1')).toBe(true);
    expect(b.hasClue('c1')).toBe(true);
    expect(b.hasItem('i1')).toBe(true);
    expect(b.getPuzzle('p1')).toEqual({ x: 3 });
    expect(b.checkpointScene).toBe('tunnels');
    expect(b.deaths).toBe(4);
  });

  it('hydrate copies puzzle records rather than sharing them', () => {
    const source = { p1: { x: 1 } };
    const state = new GameState();
    state.hydrate({
      flags: [], clues: [], items: [], puzzles: source,
      sceneId: 'shore', spawnId: 'default', chapter: 1,
      checkpointScene: 'shore', checkpointSpawn: 'default',
      playTime: 0, completed: false, endingId: null, deaths: 0,
    });
    state.getPuzzle('p1').x = 99;
    expect(source.p1.x).toBe(1);
  });

  it('reset wipes everything', () => {
    const state = new GameState();
    state.setFlag('f');
    state.addClue('c');
    state.addItem('i');
    state.setCheckpoint('gate', 'mouth');
    state.playTime = 500;
    state.completed = true;
    state.reset();
    expect(state.allFlags).toEqual([]);
    expect(state.clueCount).toBe(0);
    expect(state.allItems).toEqual([]);
    expect(state.checkpointScene).toBe('shore');
    expect(state.playTime).toBe(0);
    expect(state.completed).toBe(false);
  });

  it('emits a dirty event for anything worth saving', () => {
    const state = new GameState();
    const reasons: string[] = [];
    state.events.on('dirty', ({ reason }) => reasons.push(reason));
    state.setFlag('f');
    state.addClue('c');
    state.addItem('i');
    state.setCheckpoint('ward', 'mid');
    expect(reasons).toEqual(['flag:f', 'clue:c', 'item:i', 'checkpoint']);
  });
});
