import { getText } from '@/narrative/text';
import { clear, el } from './dom';

/**
 * Narration overlay.
 *
 * Text is shown one paragraph at a time and advanced by a tap anywhere, which
 * matters on a phone: a wall of text in a 5-inch landscape window is unread,
 * and the pacing of a reveal is part of the writing.
 */
export class Narration {
  readonly root: HTMLElement;
  private readonly source: HTMLElement;
  private readonly body: HTMLElement;
  private readonly hint: HTMLElement;

  private lines: readonly string[] = [];
  private index = 0;
  private onComplete: (() => void) | null = null;
  /** Blocks an accidental second tap from skipping a line. */
  private cooldown = 0;

  constructor() {
    this.source = el('div', { class: 'narration__source' });
    this.body = el('div', { class: 'narration__body' });
    this.hint = el('div', { class: 'narration__hint', text: 'Tap to continue' });
    this.root = el('div', { class: 'narration' }, [
      el('div', { class: 'narration__inner' }, [this.source, this.body, this.hint]),
    ]);
    this.root.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.advance();
    });
  }

  get isOpen(): boolean {
    return this.root.classList.contains('is-open');
  }

  show(textId: string, onComplete: () => void): void {
    const entry = getText(textId);
    if (!entry || entry.lines.length === 0) {
      onComplete();
      return;
    }
    this.lines = entry.lines;
    this.index = 0;
    this.onComplete = onComplete;
    this.source.textContent = entry.source ?? '';
    this.source.style.display = entry.source ? '' : 'none';
    this.cooldown = performance.now() + 240;
    this.render();
    this.root.classList.add('is-open');
  }

  private render(): void {
    clear(this.body);
    const line = this.lines[this.index];
    if (line === undefined) return;
    const p = el('p', { class: 'narration__line', text: line });
    this.body.append(p);
    // A short fade per line, so each paragraph lands rather than snapping in.
    p.style.opacity = '0';
    p.style.transition = 'opacity 420ms ease';
    requestAnimationFrame(() => {
      p.style.opacity = '1';
    });
    const last = this.index >= this.lines.length - 1;
    this.hint.textContent = last ? 'Tap to close' : 'Tap to continue';
  }

  /** Advances a line, or closes. Also bound to the keyboard. */
  advance(): void {
    if (!this.isOpen) return;
    if (performance.now() < this.cooldown) return;
    this.cooldown = performance.now() + 180;
    this.index++;
    if (this.index >= this.lines.length) {
      this.close();
      return;
    }
    this.render();
  }

  close(): void {
    this.root.classList.remove('is-open');
    const done = this.onComplete;
    this.onComplete = null;
    this.lines = [];
    done?.();
  }
}

/** The chapter card shown on scene entry. */
export class ChapterCard {
  readonly root: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly subtitleEl: HTMLElement;
  private timer = 0;

  constructor() {
    this.titleEl = el('div', { class: 'chapter-card__title' });
    this.subtitleEl = el('div', { class: 'chapter-card__subtitle' });
    this.root = el('div', { class: 'chapter-card' }, [
      el('div', {}, [this.titleEl, this.subtitleEl]),
    ]);
  }

  show(title: string, subtitle: string, duration = 3200): void {
    this.titleEl.textContent = title;
    this.subtitleEl.textContent = subtitle;
    this.root.classList.add('is-visible');
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.root.classList.remove('is-visible');
    }, duration);
  }

  hide(): void {
    window.clearTimeout(this.timer);
    this.root.classList.remove('is-visible');
  }
}
