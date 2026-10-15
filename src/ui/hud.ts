import { CLUE_BY_ID, ITEM_BY_ID } from '@/narrative/clues';
import { el } from './dom';

export interface HudCallbacks {
  onLantern: () => void;
  onInteract: () => void;
  onPause: () => void;
  onJournal: () => void;
}

/**
 * The in-play HUD.
 *
 * The brief asks for a minimal cinematic interface, so there are exactly four
 * controls on screen: the movement surface (invisible), the lantern, a context
 * button that only appears when there is something to do, and two small
 * utilities tucked into the corner. Running and crouching are folded into the
 * stick rather than given buttons of their own.
 */
export class Hud {
  readonly root: HTMLElement;
  readonly touchSurface: HTMLElement;

  private readonly stick: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly lanternBtn: HTMLButtonElement;
  private readonly interactBtn: HTMLButtonElement;
  private readonly pauseBtn: HTMLButtonElement;
  private readonly journalBtn: HTMLButtonElement;
  private readonly promptEl: HTMLElement;
  private readonly promptLabel: HTMLElement;
  private readonly promptVerb: HTMLElement;
  private readonly toast: HTMLElement;
  private readonly toastKind: HTMLElement;
  private readonly toastTitle: HTMLElement;

  private toastTimer = 0;
  private showHints = true;

  constructor(private readonly callbacks: HudCallbacks) {
    this.touchSurface = el('div', { class: 'touch-surface' });
    this.knob = el('div', { class: 'stick__knob' });
    this.stick = el('div', { class: 'stick' }, [this.knob]);

    this.lanternBtn = el(
      'button',
      { class: 'btn btn--lantern', type: 'button', 'aria-label': 'Lantern' },
      [el('span', { class: 'btn__glyph', text: '◉' })],
    );
    this.interactBtn = el(
      'button',
      { class: 'btn btn--interact', type: 'button', 'aria-label': 'Interact' },
      [el('span', { class: 'btn__glyph', text: '➜' })],
    );
    this.pauseBtn = el(
      'button',
      { class: 'btn btn--small', type: 'button', 'aria-label': 'Pause' },
      [el('span', { class: 'btn__glyph', text: '‖' })],
    );
    this.journalBtn = el(
      'button',
      { class: 'btn btn--small', type: 'button', 'aria-label': 'Journal' },
      [el('span', { class: 'btn__glyph', text: '☷' })],
    );

    this.promptLabel = el('div', { class: 'prompt__label' });
    this.promptVerb = el('span', { class: 'prompt__verb' });
    this.promptEl = el('div', { class: 'prompt' }, [this.promptLabel, this.promptVerb]);

    this.toastKind = el('div', { class: 'toast__kind' });
    this.toastTitle = el('div', { class: 'toast__title' });
    this.toast = el('div', { class: 'toast' }, [this.toastKind, this.toastTitle]);

    this.root = el('div', { class: 'hud' }, [
      this.touchSurface,
      this.stick,
      el('div', { class: 'top-left' }, [this.pauseBtn, this.journalBtn]),
      el('div', { class: 'buttons' }, [this.interactBtn, this.lanternBtn]),
      this.promptEl,
      this.toast,
    ]);

    // Click handlers for mouse/keyboard; the Controls class owns pointer
    // handling for the gameplay buttons so multitouch works properly.
    this.pauseBtn.addEventListener('click', () => this.callbacks.onPause());
    this.journalBtn.addEventListener('click', () => this.callbacks.onJournal());
  }

  /** Handed to Controls so it can drive the stick's visual. */
  get stickVisual(): {
    show: (x: number, y: number) => void;
    move: (dx: number, dy: number) => void;
    hide: () => void;
  } {
    return {
      show: (x, y) => {
        this.stick.style.left = `${x}px`;
        this.stick.style.top = `${y}px`;
        this.stick.classList.add('is-visible');
        this.knob.style.transform = 'translate(0, 0)';
      },
      move: (dx, dy) => {
        this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      },
      hide: () => {
        this.stick.classList.remove('is-visible');
        this.knob.style.transform = 'translate(0, 0)';
      },
    };
  }

  get buttons(): {
    lantern: HTMLElement;
    interact: HTMLElement;
    pause: HTMLElement;
    journal: HTMLElement;
  } {
    return {
      lantern: this.lanternBtn,
      interact: this.interactBtn,
      pause: this.pauseBtn,
      journal: this.journalBtn,
    };
  }

  setHintsEnabled(enabled: boolean): void {
    this.showHints = enabled;
    this.promptLabel.style.display = enabled ? '' : 'none';
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  /** Dims the whole HUD, for cinematics. */
  setDimmed(dimmed: boolean): void {
    this.root.classList.toggle('is-dimmed', dimmed);
  }

  setLanternOn(on: boolean, available: boolean): void {
    this.lanternBtn.classList.toggle('is-on', on);
    this.lanternBtn.style.opacity = available ? '1' : '0.3';
  }

  setPrompt(prompt: { verb: string; label: string } | null): void {
    if (prompt) {
      this.promptLabel.textContent = prompt.label;
      this.promptVerb.textContent = prompt.verb;
      this.promptEl.classList.add('is-visible');
      this.interactBtn.classList.add('is-available');
      if (!this.showHints) this.promptLabel.style.display = 'none';
    } else {
      this.promptEl.classList.remove('is-visible');
      this.interactBtn.classList.remove('is-available');
    }
  }

  showClue(clueId: string): void {
    const clue = CLUE_BY_ID[clueId];
    this.showToast('Clue recorded', clue?.title ?? 'Something noted');
  }

  showItem(itemId: string): void {
    const item = ITEM_BY_ID[itemId];
    this.showToast('Taken', item?.name ?? 'Something');
  }

  private showToast(kind: string, title: string): void {
    this.toastKind.textContent = kind;
    this.toastTitle.textContent = title;
    this.toast.classList.add('is-visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toast.classList.remove('is-visible');
    }, 3200);
  }
}
