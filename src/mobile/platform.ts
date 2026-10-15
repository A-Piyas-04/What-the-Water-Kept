/**
 * Mobile and WebView integration.
 *
 * Capacitor is loaded lazily and optionally: the same bundle runs as a web
 * page with no native plugins present, which is what makes development and
 * automated browser testing possible without a device.
 */

export interface PlatformHooks {
  /** The app went to the background: pause, save, suspend audio. */
  onPause: () => void;
  /** The app came back: resume, reset the loop's timing. */
  onResume: () => void;
  /** Hardware back button (Android). Returns true if handled. */
  onBack: () => boolean;
}

interface CapacitorApp {
  addListener(
    event: 'appStateChange',
    cb: (state: { isActive: boolean }) => void,
  ): Promise<unknown>;
  addListener(event: 'backButton', cb: () => void): Promise<unknown>;
  exitApp(): Promise<void>;
}

interface CapacitorGlobal {
  /** A function in Capacitor 3+, a boolean in some older builds. */
  isNativePlatform?: boolean | (() => boolean);
  getPlatform?: () => string;
  Plugins?: {
    App?: CapacitorApp;
    StatusBar?: { hide: () => Promise<void>; setOverlaysWebView?: (o: { overlay: boolean }) => Promise<void> };
    ScreenOrientation?: { lock: (o: { orientation: string }) => Promise<void> };
    NavigationBar?: { hide: () => Promise<void> };
  };
}

const cap = (): CapacitorGlobal | null =>
  (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor ?? null;

/**
 * Are we running inside the native app?
 *
 * `Capacitor.isNativePlatform` is a function in Capacitor 3 and later. The
 * first version of this check compared it to `true`, which is never the case
 * for a function, so the Android build believed it was a web page and kept
 * rendering at 2x - which is the setting that leaves the world black there.
 */
export const isNative = (): boolean => {
  const c = cap();
  if (!c) return false;
  const flag = c.isNativePlatform;
  try {
    if (typeof flag === 'function') return flag.call(c) === true;
  } catch {
    /* fall through */
  }
  if (flag === true) return true;
  // Last resort: the platform name.
  try {
    const name = c.getPlatform?.();
    return name === 'android' || name === 'ios';
  } catch {
    return false;
  }
};

export const platformName = (): string => {
  const c = cap();
  if (!c) return 'web';
  try {
    return c.getPlatform?.() ?? 'web';
  } catch {
    return 'web';
  }
};

/**
 * Asks the platform for landscape and an immersive, edge-to-edge view.
 *
 * All of it is best-effort: if a plugin is missing the game simply runs in
 * whatever orientation the device gives it, and the CSS rotate prompt covers
 * the portrait case.
 */
export const requestLandscapeImmersive = async (): Promise<void> => {
  const plugins = cap()?.Plugins;
  if (!plugins) return;
  try {
    await plugins.ScreenOrientation?.lock({ orientation: 'landscape' });
  } catch {
    /* orientation not available */
  }
  try {
    await plugins.StatusBar?.setOverlaysWebView?.({ overlay: true });
    await plugins.StatusBar?.hide();
  } catch {
    /* status bar not available */
  }
  try {
    await plugins.NavigationBar?.hide();
  } catch {
    /* navigation bar not available */
  }
};

/** Attempts to go fullscreen in a browser. Needs a user gesture. */
export const requestFullscreen = async (): Promise<void> => {
  if (isNative()) return;
  try {
    const node = document.documentElement;
    if (!document.fullscreenElement && node.requestFullscreen) {
      await node.requestFullscreen({ navigationUI: 'hide' });
    }
  } catch {
    /* refused; harmless */
  }
};

/**
 * Wires lifecycle events.
 *
 * Both the Capacitor listener and the DOM `visibilitychange` are used: the
 * former is authoritative on a device, the latter covers the browser and acts
 * as a backstop if the plugin is absent. Autosave on background is the single
 * most important one - Android kills backgrounded WebViews without warning.
 */
export const attachLifecycle = (hooks: PlatformHooks): (() => void) => {
  let active = true;
  const goInactive = (): void => {
    if (!active) return;
    active = false;
    hooks.onPause();
  };
  const goActive = (): void => {
    if (active) return;
    active = true;
    hooks.onResume();
  };

  const onVisibility = (): void => {
    if (document.hidden) goInactive();
    else goActive();
  };
  const onBlur = (): void => goInactive();
  const onFocus = (): void => goActive();
  // `pagehide` is the last reliable moment to persist on mobile browsers.
  const onPageHide = (): void => goInactive();

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);
  window.addEventListener('pagehide', onPageHide);

  // The App plugin is optional, and how its `addListener` returns depends on
  // how it was reached: a Promise via the module import, a plain handle via
  // the global proxy. Treating it as a Promise is exactly what once took the
  // whole game down at boot, so every call is guarded and nothing here is
  // allowed to throw - the DOM listeners above already cover pause/resume.
  const app = cap()?.Plugins?.App;
  const listen = (fn: () => unknown): void => {
    try {
      void Promise.resolve(fn()).catch(() => undefined);
    } catch {
      /* plugin missing or incompatible: the DOM fallbacks still apply */
    }
  };
  if (app) {
    listen(() =>
      app.addListener('appStateChange', ({ isActive }) => {
        if (isActive) goActive();
        else goInactive();
      }),
    );
    listen(() =>
      app.addListener('backButton', () => {
        const handled = hooks.onBack();
        if (!handled) listen(() => app.exitApp());
      }),
    );
  }

  const onKey = (e: KeyboardEvent): void => {
    if (e.code === 'Backspace') {
      // Stops the browser navigating back out of the game.
      e.preventDefault();
    }
  };
  window.addEventListener('keydown', onKey);

  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('keydown', onKey);
  };
};

/** Tracks orientation so the CSS can show a rotate prompt in portrait. */
export const watchOrientation = (): (() => void) => {
  const update = (): void => {
    const portrait = window.innerHeight > window.innerWidth * 1.02;
    document.body.classList.toggle('is-portrait', portrait);
  };
  update();
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
  return () => {
    window.removeEventListener('resize', update);
    window.removeEventListener('orientationchange', update);
  };
};

/**
 * Render resolution.
 *
 * Inside the Android app this is pinned to 1x. On the Android 14 WebView the
 * game was tested on, any resolution above 1 (a canvas backing store larger
 * than its CSS size) rendered correct pixels - verified by extracting them
 * from the renderer - but the canvas never composited, so the player saw a
 * black world under a working HUD. Dropping to 1x fixed it on device. The art
 * is soft, grained and fogged by design, so the cost in sharpness is small;
 * a black screen is not a cost, it is the whole game.
 *
 * In a desktop or mobile browser, where higher densities composite normally,
 * the device pixel ratio is used, capped at 2.
 */
export const renderResolution = (lowQuality: boolean): number => {
  if (isNative()) return 1;
  const dpr = window.devicePixelRatio || 1;
  if (lowQuality) return Math.min(dpr, 1);
  return Math.min(dpr, 2);
};
