/**
 * Typed event bus. Every subscription returns an unsubscribe handle, and
 * scenes are required to release theirs on teardown so repeated scene loads
 * cannot accumulate duplicate listeners.
 */
export type Unsubscribe = () => void;

type Handler<T> = (payload: T) => void;

export class EventBus<Events> {
  private handlers = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events>(type: K, handler: Handler<Events[K]>): Unsubscribe {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as Handler<never>);
    return () => {
      set?.delete(handler as Handler<never>);
    };
  }

  once<K extends keyof Events>(type: K, handler: Handler<Events[K]>): Unsubscribe {
    const off = this.on(type, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    // Copy: handlers may unsubscribe (or subscribe) during dispatch.
    for (const handler of [...set]) (handler as Handler<Events[K]>)(payload);
  }

  listenerCount(type: keyof Events): number {
    return this.handlers.get(type)?.size ?? 0;
  }

  clear(): void {
    this.handlers.clear();
  }
}

/** Collects unsubscribe handles so a scene can drop all of them at once. */
export class Subscriptions {
  private items: Unsubscribe[] = [];

  add(unsub: Unsubscribe): Unsubscribe {
    this.items.push(unsub);
    return unsub;
  }

  get size(): number {
    return this.items.length;
  }

  dispose(): void {
    for (const unsub of this.items) unsub();
    this.items.length = 0;
  }
}
