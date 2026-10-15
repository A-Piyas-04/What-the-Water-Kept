import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor packaging.
 *
 * The web bundle in `dist/` is copied into the APK verbatim and served from
 * the app's own storage, so the installed game never touches the network.
 * `androidScheme: 'https'` keeps the WebView origin stable, which is what
 * IndexedDB keys its database against - change it and existing saves vanish.
 */
const config: CapacitorConfig = {
  appId: 'com.corranmill.whatthewaterkept',
  appName: 'What the Water Kept',
  webDir: 'dist',
  android: {
    // The game draws its own background; a transparent one causes flicker.
    backgroundColor: '#05080b',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
    // No cleartext, no external host: everything is local to the install.
    cleartext: false,
  },
  plugins: {},
};

export default config;
