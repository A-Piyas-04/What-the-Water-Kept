import { CHAPTER_TITLES, CLUES, CLUE_BY_ID, ITEM_BY_ID } from '@/narrative/clues';
import { getText } from '@/narrative/text';
import type { SaveSettings } from '@/persistence/schema';
import { clear, el, formatDuration, formatSaveTime, show } from './dom';

export interface ScreenCallbacks {
  onNewGame: () => void;
  onContinue: () => void;
  onResume: () => void;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  onRestartChapter: () => void;
  onQuitToTitle: () => void;
  onCloseJournal: () => void;
  onSettingsChanged: (settings: SaveSettings) => void;
  onCredits: () => void;
  onEndingContinue: () => void;
  uiMove: () => void;
  uiConfirm: () => void;
  uiBack: () => void;
}

/**
 * Every full-screen interface: title, pause, settings, journal, ending and
 * credits.
 *
 * All of them are built once and toggled, rather than created on demand, so
 * opening the journal mid-chase costs nothing and nothing allocates during
 * play.
 */
export class Screens {
  readonly root: HTMLElement;

  private readonly titleScreen: HTMLElement;
  private readonly pauseScreen: HTMLElement;
  private readonly settingsScreen: HTMLElement;
  private readonly journalScreen: HTMLElement;
  private readonly endingScreen: HTMLElement;
  private readonly creditsScreen: HTMLElement;

  private readonly continueBtn: HTMLButtonElement;
  private readonly continueSub: HTMLElement;
  private readonly settingsList: HTMLElement;
  private readonly journalBody: HTMLElement;
  private readonly journalTabs: HTMLElement;
  private readonly endingBody: HTMLElement;
  private readonly endingTitle: HTMLElement;
  private readonly endingStats: HTMLElement;
  private readonly storageNote: HTMLElement;

  private settings: SaveSettings;
  private journalTab: 'clues' | 'items' = 'clues';
  private journalData: { clues: readonly string[]; items: readonly string[] } = {
    clues: [],
    items: [],
  };

  constructor(
    private readonly callbacks: ScreenCallbacks,
    initialSettings: SaveSettings,
  ) {
    this.settings = { ...initialSettings };

    // ---------------------------------------------------------- title
    this.continueSub = el('span', { class: 'menu-item__sub', text: 'No saved descent' });
    this.continueBtn = el(
      'button',
      { class: 'menu-item', type: 'button', disabled: true },
      [document.createTextNode('Continue'), this.continueSub],
    );
    this.continueBtn.addEventListener('click', () => {
      this.callbacks.uiConfirm();
      this.callbacks.onContinue();
    });

    const newBtn = this.menuItem('Begin', () => this.callbacks.onNewGame());
    const settingsBtn = this.menuItem('Settings', () => this.callbacks.onOpenSettings());
    const creditsBtn = this.menuItem('Credits', () => this.callbacks.onCredits());

    this.storageNote = el('p', { class: 'screen__note' });

    this.titleScreen = el('section', { class: 'screen' }, [
      el('div', { class: 'screen__inner' }, [
        el('div', { class: 'title' }, [
          el('h1', { class: 'title__name', html: 'What the<br>Water Kept' }),
          el('div', { class: 'title__rule' }),
          el('p', {
            class: 'title__tag',
            text: 'They drained the reservoir on Tuesday. The village is still down there.',
          }),
          el('nav', { class: 'menu' }, [this.continueBtn, newBtn, settingsBtn, creditsBtn]),
          this.storageNote,
        ]),
      ]),
    ]);

    // ---------------------------------------------------------- pause
    this.pauseScreen = el('section', { class: 'screen screen--overlay' }, [
      el('div', { class: 'screen__inner' }, [
        el('div', { class: 'title' }, [
          el('h2', { class: 'screen__heading', text: 'Paused' }),
          el('p', {
            class: 'screen__note',
            text: 'Progress is saved at every checkpoint. The valley will wait.',
          }),
          el('nav', { class: 'menu' }, [
            this.menuItem('Resume', () => this.callbacks.onResume()),
            this.menuItem('Journal', () => this.openJournal(this.journalData)),
            this.menuItem('Settings', () => this.callbacks.onOpenSettings()),
            this.menuItem('Restart from checkpoint', () => this.callbacks.onRestartChapter()),
            this.menuItem('Leave the valley', () => this.callbacks.onQuitToTitle()),
          ]),
        ]),
      ]),
    ]);

    // ---------------------------------------------------------- settings
    this.settingsList = el('div', { class: 'settings-list' });
    this.settingsScreen = el('section', { class: 'screen screen--overlay' }, [
      el('div', { class: 'screen__inner' }, [
        el('h2', { class: 'screen__heading', text: 'Settings' }),
        el('p', {
          class: 'screen__note',
          text: 'Audio is synthesised on the device. Nothing here needs a connection.',
        }),
        this.settingsList,
        el('div', { class: 'screen__footer' }, [
          this.menuItem('Back', () => this.callbacks.onCloseSettings()),
        ]),
      ]),
    ]);
    this.buildSettings();

    // ---------------------------------------------------------- journal
    this.journalTabs = el('div', { class: 'journal__tabs' });
    this.journalBody = el('div', { class: 'journal__body' });
    this.journalScreen = el('section', { class: 'screen screen--overlay' }, [
      el('div', { class: 'screen__inner' }, [
        el('h2', { class: 'screen__heading', text: 'Field journal' }),
        el('p', {
          class: 'screen__note',
          text: 'What she has actually seen, in her own words.',
        }),
        el('div', { class: 'journal' }, [this.journalTabs, this.journalBody]),
        el('div', { class: 'screen__footer' }, [
          this.menuItem('Close', () => this.callbacks.onCloseJournal()),
        ]),
      ]),
    ]);
    this.buildJournalTabs();

    // ---------------------------------------------------------- ending
    this.endingTitle = el('h2', { class: 'ending__title' });
    this.endingBody = el('div', { class: 'ending__body' });
    this.endingStats = el('div', { class: 'ending__stats' });
    this.endingScreen = el('section', { class: 'screen' }, [
      el('div', { class: 'screen__inner' }, [
        el('div', { class: 'ending' }, [
          this.endingTitle,
          this.endingBody,
          this.endingStats,
          el('nav', { class: 'menu' }, [
            this.menuItem('Credits', () => this.callbacks.onEndingContinue()),
          ]),
        ]),
      ]),
    ]);

    // ---------------------------------------------------------- credits
    this.creditsScreen = el('section', { class: 'screen' }, [
      el('div', { class: 'screen__inner' }, [
        el('div', { class: 'credits' }, [
          el('h2', { class: 'ending__title', text: 'What the Water Kept' }),
          ...this.creditLines(),
          el('div', { class: 'screen__footer' }, [
            this.menuItem('Return to the title', () => this.callbacks.onQuitToTitle()),
          ]),
        ]),
      ]),
    ]);

    this.root = el('div', { class: 'screens' }, [
      this.titleScreen,
      this.pauseScreen,
      this.settingsScreen,
      this.journalScreen,
      this.endingScreen,
      this.creditsScreen,
    ]);
  }

  private menuItem(label: string, onClick: () => void): HTMLButtonElement {
    const btn = el('button', { class: 'menu-item', type: 'button' }, [label]);
    btn.addEventListener('click', () => {
      this.callbacks.uiConfirm();
      onClick();
    });
    btn.addEventListener('pointerenter', () => this.callbacks.uiMove());
    return btn;
  }

  private creditLines(): HTMLElement[] {
    const rows: Array<[string, string]> = [
      ['Design, writing, art and code', 'Built autonomously in Claude Code'],
      ['Engine', 'TypeScript, PixiJS, Vite — no game engine'],
      ['Art', 'Procedural vector illustration, generated at runtime'],
      ['Audio', 'Web Audio synthesis — no recorded assets'],
      ['Typography', 'EB Garamond and Inter (SIL Open Font License)'],
      ['Packaging', 'Capacitor for Android'],
      [
        'With thanks to',
        'The drowned villages of Mardale Green, Capel Celyn, Derwent and Ashopton, whose histories suggested this one. Corran Mill is invented.',
      ],
    ];
    const out: HTMLElement[] = [];
    for (const [role, name] of rows) {
      out.push(el('div', { class: 'credits__role', text: role }));
      out.push(el('div', { class: 'credits__name', text: name }));
    }
    out.push(
      el('div', { class: 'credits__role', text: 'Plays entirely offline' }),
      el('div', {
        class: 'credits__name',
        text: 'No network, no account, no telemetry, no advertising.',
      }),
    );
    return out;
  }

  // ---------------------------------------------------------------- settings

  private buildSettings(): void {
    clear(this.settingsList);

    const slider = (
      label: string,
      hint: string,
      key: 'master' | 'music' | 'sfx',
    ): HTMLElement => {
      const value = el('span', {
        class: 'setting__value',
        text: `${Math.round(this.settings[key] * 100)}%`,
      });
      const input = el('input', {
        type: 'range',
        min: '0',
        max: '100',
        step: '1',
        value: String(Math.round(this.settings[key] * 100)),
        'aria-label': label,
      });
      input.addEventListener('input', () => {
        const v = Number((input as HTMLInputElement).value) / 100;
        this.settings = { ...this.settings, [key]: v };
        value.textContent = `${Math.round(v * 100)}%`;
        this.callbacks.onSettingsChanged(this.settings);
      });
      return el('div', { class: 'setting' }, [
        el('div', { class: 'setting__label' }, [
          label,
          el('span', { class: 'setting__hint', text: hint }),
        ]),
        input,
        value,
      ]);
    };

    const toggle = (
      label: string,
      hint: string,
      key: 'lowQuality' | 'largeText' | 'reducedMotion' | 'holdAssist' | 'showHints',
    ): HTMLElement => {
      const btn = el('button', {
        class: 'toggle',
        type: 'button',
        'aria-pressed': String(this.settings[key]),
        text: this.settings[key] ? 'On' : 'Off',
      });
      btn.addEventListener('click', () => {
        const next = !this.settings[key];
        this.settings = { ...this.settings, [key]: next };
        btn.setAttribute('aria-pressed', String(next));
        btn.textContent = next ? 'On' : 'Off';
        this.callbacks.uiConfirm();
        this.callbacks.onSettingsChanged(this.settings);
      });
      return el('div', { class: 'setting' }, [
        el('div', { class: 'setting__label' }, [
          label,
          el('span', { class: 'setting__hint', text: hint }),
        ]),
        btn,
      ]);
    };

    this.settingsList.append(
      slider('Master volume', 'Everything, including the heartbeat.', 'master'),
      slider('Ambience and music', 'Drones, wind, water and the choir.', 'music'),
      slider('Effects', 'Footsteps, the lantern, mechanisms.', 'sfx'),
      toggle(
        'Lower graphics quality',
        'Fewer particles, no film grain, no light bloom. Use this if the frame rate dips.',
        'lowQuality',
      ),
      toggle('Larger text', 'Increases every interface size by a fifth.', 'largeText'),
      toggle(
        'Reduced motion',
        'Removes camera shake and most screen movement.',
        'reducedMotion',
      ),
      toggle(
        'Show interaction labels',
        'Turn this off for a cleaner screen once you know the controls.',
        'showHints',
      ),
    );
  }

  setSettings(settings: SaveSettings): void {
    this.settings = { ...settings };
    this.buildSettings();
  }

  setStorageNote(note: string | null): void {
    this.storageNote.textContent = note ?? '';
    this.storageNote.style.display = note ? '' : 'none';
  }

  // ----------------------------------------------------------------- journal

  private buildJournalTabs(): void {
    clear(this.journalTabs);
    for (const [key, label] of [
      ['clues', 'Clues'],
      ['items', 'Carried'],
    ] as const) {
      const btn = el('button', {
        class: 'journal__tab',
        type: 'button',
        'aria-selected': String(this.journalTab === key),
        text: label,
      });
      btn.addEventListener('click', () => {
        this.journalTab = key;
        this.callbacks.uiMove();
        this.buildJournalTabs();
        this.renderJournal();
      });
      this.journalTabs.append(btn);
    }
  }

  openJournal(data: { clues: readonly string[]; items: readonly string[] }): void {
    this.journalData = data;
    this.renderJournal();
    show(this.pauseScreen, false);
    show(this.journalScreen, true);
  }

  private renderJournal(): void {
    clear(this.journalBody);
    if (this.journalTab === 'items') {
      const items = this.journalData.items.map((id) => ITEM_BY_ID[id]).filter(Boolean);
      if (items.length === 0) {
        this.journalBody.append(el('p', { class: 'empty', text: 'She is carrying nothing.' }));
        return;
      }
      for (const item of items) {
        this.journalBody.append(
          el('article', { class: 'clue' }, [
            el('h3', { class: 'clue__title', text: item.name }),
            el('p', { class: 'clue__body', text: item.description }),
          ]),
        );
      }
      return;
    }

    const found = CLUES.filter((c) => this.journalData.clues.includes(c.id));
    if (found.length === 0) {
      this.journalBody.append(
        el('p', { class: 'empty', text: 'Nothing recorded yet. Go and look at something.' }),
      );
      return;
    }
    for (const clue of found) {
      const node = el('article', { class: 'clue' }, [
        el('div', {
          class: 'clue__chapter',
          text: CHAPTER_TITLES[clue.chapter] ?? `Chapter ${clue.chapter}`,
        }),
        el('h3', { class: 'clue__title', text: clue.title }),
        el('p', { class: 'clue__body', text: clue.body }),
      ]);
      if (clue.bearing) {
        node.append(el('div', { class: 'clue__bearing', text: clue.bearing }));
      }
      this.journalBody.append(node);
    }
  }

  // ------------------------------------------------------------------ ending

  showEnding(opts: {
    endingId: string;
    playTime: number;
    clues: number;
    deaths: number;
  }): void {
    const textId = opts.endingId === 'shown' ? 'ending-shown' : 'ending-withheld';
    const entry = getText(textId);
    const epilogue = getText('ending-epilogue');

    this.endingTitle.textContent = entry?.title ?? 'What the Water Kept';
    clear(this.endingBody);
    for (const line of entry?.lines ?? []) {
      this.endingBody.append(el('p', { text: line }));
    }
    if (epilogue) {
      this.endingBody.append(
        el('div', { class: 'credits__role', text: epilogue.source ?? '' }),
      );
      for (const line of epilogue.lines) {
        this.endingBody.append(
          el('p', { style: 'font-size:0.86em;color:var(--ink-faint)', text: line }),
        );
      }
    }

    clear(this.endingStats);
    const stats: Array<[string, string]> = [
      [formatDuration(opts.playTime), 'Time in the valley'],
      [`${opts.clues} of ${CLUES.length}`, 'Clues recorded'],
      [String(opts.deaths), opts.deaths === 1 ? 'Time taken' : 'Times taken'],
    ];
    for (const [value, label] of stats) {
      this.endingStats.append(
        el('div', { class: 'stat' }, [
          el('div', { class: 'stat__value', text: value }),
          el('div', { class: 'stat__label', text: label }),
        ]),
      );
    }
    this.closeAll();
    show(this.endingScreen, true);
  }

  // ------------------------------------------------------------------ toggles

  setContinueAvailable(available: boolean, savedAt: number, chapter: number): void {
    this.continueBtn.disabled = !available;
    this.continueSub.textContent = available
      ? `${CHAPTER_TITLES[chapter] ?? 'Chapter ' + chapter} · ${formatSaveTime(savedAt)}`
      : 'No saved descent';
  }

  showTitle(): void {
    this.closeAll();
    show(this.titleScreen, true);
  }

  showPause(): void {
    show(this.settingsScreen, false);
    show(this.journalScreen, false);
    show(this.pauseScreen, true);
  }

  showSettings(): void {
    show(this.settingsScreen, true);
  }

  hideSettings(): void {
    show(this.settingsScreen, false);
  }

  hideJournal(): void {
    show(this.journalScreen, false);
  }

  showCredits(): void {
    this.closeAll();
    show(this.creditsScreen, true);
  }

  closeAll(): void {
    for (const s of [
      this.titleScreen,
      this.pauseScreen,
      this.settingsScreen,
      this.journalScreen,
      this.endingScreen,
      this.creditsScreen,
    ]) {
      show(s, false);
    }
  }

  get anyOpen(): boolean {
    return [
      this.titleScreen,
      this.pauseScreen,
      this.settingsScreen,
      this.journalScreen,
      this.endingScreen,
      this.creditsScreen,
    ].some((s) => s.classList.contains('is-open'));
  }

  get pauseOpen(): boolean {
    return this.pauseScreen.classList.contains('is-open');
  }

  get settingsOpen(): boolean {
    return this.settingsScreen.classList.contains('is-open');
  }

  get journalOpen(): boolean {
    return this.journalScreen.classList.contains('is-open');
  }

  get titleOpen(): boolean {
    return this.titleScreen.classList.contains('is-open');
  }

  /** Looks up a clue title, for the toast. */
  static clueTitle(id: string): string {
    return CLUE_BY_ID[id]?.title ?? 'A clue';
  }
}
