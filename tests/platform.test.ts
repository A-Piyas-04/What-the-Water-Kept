import { afterEach, describe, expect, it } from 'vitest';
import { isNative, renderResolution } from '@/mobile/platform';

/**
 * Regression tests for the Android black-screen bug: Capacitor exposes
 * `isNativePlatform` as a FUNCTION, and treating it as a boolean made the app
 * render at 2x inside the WebView, which composites as black there.
 */
const g = globalThis as unknown as { window?: Record<string, unknown> };

const withWindow = (win: Record<string, unknown>): void => {
  g.window = { devicePixelRatio: 2.75, ...win };
};

afterEach(() => {
  delete g.window;
});

describe('native platform detection', () => {
  it('detects Capacitor 3+ (isNativePlatform is a function)', () => {
    withWindow({ Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' } });
    expect(isNative()).toBe(true);
  });

  it('detects a legacy boolean flag', () => {
    withWindow({ Capacitor: { isNativePlatform: true } });
    expect(isNative()).toBe(true);
  });

  it('falls back to the platform name', () => {
    withWindow({ Capacitor: { getPlatform: () => 'android' } });
    expect(isNative()).toBe(true);
  });

  it('is false on the web, with or without the Capacitor shim', () => {
    withWindow({});
    expect(isNative()).toBe(false);
    withWindow({ Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' } });
    expect(isNative()).toBe(false);
  });
});

describe('render resolution', () => {
  it('is pinned to 1x inside the native app, whatever the device density', () => {
    withWindow({ Capacitor: { isNativePlatform: () => true } });
    expect(renderResolution(false)).toBe(1);
    expect(renderResolution(true)).toBe(1);
  });

  it('uses the device pixel ratio, capped at 2, in a browser', () => {
    withWindow({});
    expect(renderResolution(false)).toBe(2);
    expect(renderResolution(true)).toBe(1);
  });
});

describe('lifecycle wiring', () => {
  it('survives a plugin whose addListener does not return a Promise', async () => {
    // This exact shape took the whole game down at boot on Android.
    const listeners: string[] = [];
    const docListeners: Record<string, unknown> = {};
    withWindow({
      Capacitor: {
        isNativePlatform: () => true,
        Plugins: {
          App: {
            addListener: (name: string) => {
              listeners.push(name);
              return { remove: () => undefined };
            },
            exitApp: () => undefined,
          },
        },
      },
      addEventListener: (n: string, f: unknown) => (docListeners[n] = f),
      removeEventListener: () => undefined,
    });
    (globalThis as unknown as { document?: unknown }).document = {
      hidden: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
    const { attachLifecycle } = await import('@/mobile/platform');
    expect(() =>
      attachLifecycle({ onPause: () => undefined, onResume: () => undefined, onBack: () => true }),
    ).not.toThrow();
    expect(listeners).toEqual(['appStateChange', 'backButton']);
    delete (globalThis as unknown as { document?: unknown }).document;
  });
});
