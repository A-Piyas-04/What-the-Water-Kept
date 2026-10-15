import {
  DEFAULT_SETTINGS,
  SAVE_VERSION,
  type SaveData,
  type SaveEnvelope,
  type SaveSettings,
  checksum,
  migrate,
  validate,
  validateSettings,
} from './schema';

const DB_NAME = 'what-the-water-kept';
const DB_VERSION = 1;
const STORE = 'state';
const SLOT_PRIMARY = 'save:primary';
const SLOT_BACKUP = 'save:backup';
const SLOT_SETTINGS = 'settings';

/**
 * Offline persistence.
 *
 * IndexedDB is the primary store, with localStorage as a fallback for WebViews
 * where IndexedDB is unavailable or blocked. There is no network path of any
 * kind here, and there never can be: the game must run in airplane mode.
 *
 * Writes use a two-slot strategy. The previous good save is copied to a backup
 * slot before the new one is written, so a process killed mid-write - which is
 * routine on Android - costs at most one checkpoint rather than the run.
 */
export class SaveStore {
  private db: IDBDatabase | null = null;
  private opening: Promise<IDBDatabase | null> | null = null;
  private memory = new Map<string, unknown>();
  private useFallback = false;

  /** Last error, surfaced in the settings screen rather than thrown at play. */
  lastError: string | null = null;

  private open(): Promise<IDBDatabase | null> {
    if (this.db) return Promise.resolve(this.db);
    if (this.opening) return this.opening;
    this.opening = new Promise<IDBDatabase | null>((resolve) => {
      if (typeof indexedDB === 'undefined') {
        this.useFallback = true;
        resolve(null);
        return;
      }
      let settled = false;
      const finish = (db: IDBDatabase | null): void => {
        if (settled) return;
        settled = true;
        resolve(db);
      };
      // A WebView that never answers must not hang the title screen.
      const timeout = setTimeout(() => {
        this.useFallback = true;
        this.lastError = 'IndexedDB did not respond; using local fallback.';
        finish(null);
      }, 2500);

      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        };
        request.onsuccess = () => {
          clearTimeout(timeout);
          this.db = request.result;
          this.db.onversionchange = () => {
            this.db?.close();
            this.db = null;
          };
          finish(this.db);
        };
        request.onerror = () => {
          clearTimeout(timeout);
          this.useFallback = true;
          this.lastError = 'IndexedDB unavailable; using local fallback.';
          finish(null);
        };
        request.onblocked = () => {
          clearTimeout(timeout);
          this.useFallback = true;
          finish(null);
        };
      } catch (err) {
        clearTimeout(timeout);
        this.useFallback = true;
        this.lastError = `IndexedDB threw: ${String(err)}`;
        finish(null);
      }
    });
    return this.opening;
  }

  private async put(key: string, value: unknown): Promise<boolean> {
    const db = await this.open();
    if (!db) return this.fallbackPut(key, value);
    return new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => {
          this.lastError = 'Write failed; using local fallback.';
          resolve(this.fallbackPut(key, value));
        };
        tx.onabort = () => resolve(this.fallbackPut(key, value));
      } catch {
        resolve(this.fallbackPut(key, value));
      }
    });
  }

  private async get(key: string): Promise<unknown> {
    const db = await this.open();
    if (!db) return this.fallbackGet(key);
    return new Promise<unknown>((resolve) => {
      try {
        const tx = db.transaction(STORE, 'readonly');
        const request = tx.objectStore(STORE).get(key);
        request.onsuccess = () => resolve(request.result ?? this.fallbackGet(key));
        request.onerror = () => resolve(this.fallbackGet(key));
      } catch {
        resolve(this.fallbackGet(key));
      }
    });
  }

  private async del(key: string): Promise<void> {
    this.memory.delete(key);
    try {
      localStorage.removeItem(`${DB_NAME}:${key}`);
    } catch {
      /* storage disabled */
    }
    const db = await this.open();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  private fallbackPut(key: string, value: unknown): boolean {
    this.memory.set(key, value);
    try {
      localStorage.setItem(`${DB_NAME}:${key}`, JSON.stringify(value));
      return true;
    } catch {
      // In-memory only. The game still plays; progress will not survive a
      // relaunch, and the settings screen says so.
      this.lastError = 'No persistent storage available. Progress will not be kept.';
      return false;
    }
  }

  private fallbackGet(key: string): unknown {
    if (this.memory.has(key)) return this.memory.get(key);
    try {
      const raw = localStorage.getItem(`${DB_NAME}:${key}`);
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  }

  private wrap(data: SaveData): SaveEnvelope {
    const payload = JSON.stringify(data);
    return { data: JSON.parse(payload) as SaveData, checksum: checksum(payload) };
  }

  private unwrap(raw: unknown): SaveData | null {
    if (!raw || typeof raw !== 'object') return null;
    const envelope = raw as Partial<SaveEnvelope>;
    if (!envelope.data) {
      // Pre-envelope format: treat the record itself as the payload.
      const direct = validate(raw);
      return direct ? migrate(direct) : null;
    }
    const payload = JSON.stringify(envelope.data);
    if (typeof envelope.checksum === 'number' && checksum(payload) !== envelope.checksum) {
      this.lastError = 'A save was incomplete and has been skipped.';
      return null;
    }
    const data = validate(envelope.data);
    return data ? migrate(data) : null;
  }

  /**
   * Writes the save, keeping the previous good one as a backup first.
   */
  async save(data: SaveData): Promise<boolean> {
    const payload: SaveData = { ...data, version: SAVE_VERSION, savedAt: Date.now() };
    const existing = await this.get(SLOT_PRIMARY);
    if (existing) await this.put(SLOT_BACKUP, existing);
    return this.put(SLOT_PRIMARY, this.wrap(payload));
  }

  /** Reads the save, falling back to the backup slot if the primary is bad. */
  async load(): Promise<SaveData | null> {
    const primary = this.unwrap(await this.get(SLOT_PRIMARY));
    if (primary) return primary;
    const backup = this.unwrap(await this.get(SLOT_BACKUP));
    if (backup) {
      this.lastError = 'The latest save was unreadable; an earlier one was restored.';
      return backup;
    }
    return null;
  }

  async hasSave(): Promise<boolean> {
    return (await this.load()) !== null;
  }

  async clearSave(): Promise<void> {
    await this.del(SLOT_PRIMARY);
    await this.del(SLOT_BACKUP);
  }

  async loadSettings(): Promise<SaveSettings> {
    const raw = await this.get(SLOT_SETTINGS);
    return validateSettings(raw ?? DEFAULT_SETTINGS);
  }

  async saveSettings(settings: SaveSettings): Promise<boolean> {
    return this.put(SLOT_SETTINGS, settings);
  }

  /** True when progress will not survive a relaunch. */
  get isEphemeral(): boolean {
    return this.useFallback && this.memory.size > 0 && this.lastError !== null;
  }
}
