# Build — What the Water Kept

> For whoever builds this next. Exact versions, exact commands, and the
> environment variables that are easy to get wrong.

---

## Toolchain

| Tool | Version used | Notes |
| --- | --- | --- |
| Node.js | 24.22.0 LTS | 20+ should work |
| npm | 11.x | Ships with Node |
| TypeScript | 5.7.2 | strict |
| Vite | 6.0.7 | |
| PixiJS | 8.6.6 | renderer only |
| Capacitor | 7.4.3 | core, cli, android; `@capacitor/app` 7.1.0 for Back and lifecycle |
| JDK | Temurin 21.0.12 | Android Gradle Plugin 8.7 needs 17+ |
| Android SDK | platform 35, build-tools 35.0.0 | plus platform-tools |
| Gradle | 8.11.1 via wrapper | no system Gradle needed |

None of this needs to be installed system-wide. Everything used here lives
under `~/.local/opt`.

---

## Environment

```sh
export JAVA_HOME=~/.local/opt/jdk21
export ANDROID_HOME=~/.local/opt/android-sdk
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
```

`ANDROID_HOME` **and** `ANDROID_SDK_ROOT` both need setting: the Gradle plugin
reads one and the Capacitor CLI reads the other.

### First-time SDK install

```sh
sdkmanager --licenses                       # accept
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"
```

---

## Web build

```sh
npm install
npm run build        # tsc --noEmit, then vite build -> dist/
```

Output is ~840 KB uncompressed, ~210 KB gzipped, with no runtime network
requests. `npm run preview` serves it on port 4173.

### npm install scripts

npm blocks package install scripts by default here. `esbuild` (a Vite
dependency) needs its postinstall to fetch its platform binary:

```sh
npm install-scripts approve esbuild
```

Without it, `vite build` fails with a missing-binary error.

---

## Android

```sh
npm run build
npx cap sync android          # copies dist/ into the Android project
cd android
./gradlew assembleDebug       # debug APK
./gradlew assembleRelease     # release APK (signed if the key is present)
```

### Output

| Build | Path | Size |
| --- | --- | --- |
| Release | `android/app/build/outputs/apk/release/app-release.apk` | 3.5 MB |
| Debug | `android/app/build/outputs/apk/debug/app-debug.apk` | 4.5 MB |

Copies are staged in `release/`:

```
release/what-the-water-kept.apk          ← release-signed, the deliverable
release/what-the-water-kept-debug.apk    ← debug-signed, for CDP inspection
release/SHA256SUMS.txt
```

### Install

```sh
adb install -r release/what-the-water-kept.apk
```

---

## Signing

Release signing reads a properties file **outside the repository**:

```
~/.local/keystores/wtwk-signing.properties
```

```properties
storeFile=/home/you/.local/keystores/what-the-water-kept.jks
storePassword=...
keyAlias=wtwk
keyPassword=...
```

Override the location with `WTWK_SIGNING_PROPERTIES`. If the file is absent,
`assembleRelease` still succeeds and produces an **unsigned** release APK —
a checkout without the key builds rather than fails.

### The key shipped with this build

Generated locally for this project: RSA 4096, 30-year validity, alias `wtwk`.

```
SHA-256: 48:83:E0:E6:BB:4A:33:24:E5:C4:8E:38:2C:1D:95:4D:8F:B1:81:2A:F6:B0:0E:9D:99:BF:5C:40:CA:8B:15:9F
```

It is a **development key**, not a Play Store upload key. Nothing secret is
in source control; `.gitignore` excludes `*.jks`, `*.keystore` and
`*signing*.properties`.

To create your own:

```sh
keytool -genkeypair -v -keystore my.jks -alias wtwk \
  -keyalg RSA -keysize 4096 -validity 10950
```

Publishing to Play requires an App Bundle, not an APK:

```sh
cd android && ./gradlew bundleRelease
```

That path has **not** been exercised here.

---

## What the APK contains, and what it does not

```sh
aapt2 dump permissions release/what-the-water-kept.apk
```

```
package: com.corranmill.whatthewaterkept
permission: com.corranmill.whatthewaterkept.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION
uses-permission: name='com.corranmill.whatthewaterkept.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'
```

**There is no `INTERNET` permission.** Capacitor adds one by default; it is
removed in `android/app/src/main/AndroidManifest.xml`, so the offline
requirement is enforced by the operating system rather than being a claim
about the source. The only permission is Capacitor's own internal broadcast
permission.

| Setting | Value |
| --- | --- |
| applicationId | `com.corranmill.whatthewaterkept` |
| minSdk / targetSdk | 23 / 35 |
| Orientation | `sensorLandscape` |
| Cutout | `shortEdges`, drawn edge to edge |
| Cleartext traffic | disabled |
| GLES | 2.0 required |

---

## Testing

```sh
npm test                 # 177 unit, logic and level-audit tests
node tools/smoke.mjs     # drives the production build in Firefox
node tools/smoke.mjs --headed
```

The smoke test needs a standalone Firefox and geckodriver (the snap packages
do not work — geckodriver rejects the snap wrapper, and snap confinement
cannot read dot-directories):

```sh
export FIREFOX_BIN=~/.local/opt/firefox/firefox
export GECKODRIVER_BIN=~/.local/opt/geckodriver
```

It writes annotated screenshots to `artifacts/screenshots/`.

### On a device or emulator

```sh
avdmanager create avd -n wtwk-test -k "system-images;android-34;google_apis_playstore;x86_64" -d pixel_5
emulator -avd wtwk-test -gpu host
adb install -r release/what-the-water-kept.apk
adb shell am start -n com.corranmill.whatthewaterkept/.MainActivity
```

The debug APK is WebView-debuggable, so the running game can be inspected
exactly as in a desktop browser:

```sh
adb forward tcp:9222 localabstract:webview_devtools_remote_$(adb shell pidof com.corranmill.whatthewaterkept)
node tools/cdp.mjs "JSON.stringify(window.__game.debugState)"
```

See `TEST_REPORT.md` for results, including an emulator GPU caveat that
matters when reading them.

---

## iOS

The codebase is platform-neutral: `src/mobile/platform.ts` loads Capacitor
lazily and uses no Android-only API.

```sh
npx cap add ios
npx cap sync ios
npx cap open ios
```

Remaining work, none of it done or verified here:

1. **macOS with Xcode 15+** — required; it cannot be produced on Linux.
2. An Apple Developer account and signing identity.
3. `Info.plist`: `UISupportedInterfaceOrientations` restricted to landscape,
   `UIRequiresFullScreen`, and a launch storyboard matching `#05080b`.
4. Confirm WKWebView honours the Web Audio unlock on first touch (the
   AudioContext is already unlocked from a user gesture, which is the usual
   requirement).
5. Confirm IndexedDB persistence under WKWebView's storage policy.

**No IPA has been produced and no iOS build has been attempted.**
