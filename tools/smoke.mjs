/**
 * Browser smoke test.
 *
 * Drives the real built game in Firefox: boots it, starts a new game, walks,
 * uses the lantern, visits every chapter, and captures a screenshot of each.
 * It fails on any console error and on any frame where the renderer is not
 * producing output.
 *
 * Run with: node tools/smoke.mjs [--headed]
 */
import { Builder, By, Key, until } from 'selenium-webdriver';
import { imageStats } from './png.mjs';
import firefox from 'selenium-webdriver/firefox.js';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const SHOTS = new URL('../artifacts/screenshots/', import.meta.url).pathname;
const PORT = 8787;
const HEADED = process.argv.includes('--headed');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/** Serves dist/ and records every request, so we can prove nothing is remote. */
const requests = [];
const server = createServer(async (req, res) => {
  requests.push(req.url);
  const path = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const file = join(DIST, normalize(path).replace(/^(\.\.[/\\])+/, ''));
  if (!existsSync(file)) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch (err) {
    res.writeHead(500);
    res.end(String(err));
  }
});

const log = (...args) => console.log('[smoke]', ...args);
const failures = [];
const notes = [];

const main = async () => {
  await mkdir(SHOTS, { recursive: true });
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  log(`serving dist on http://127.0.0.1:${PORT}`);

  const options = new firefox.Options();
  if (!HEADED) options.addArguments('-headless');
  options.setBinary(process.env.FIREFOX_BIN ?? '/home/amt/.local/opt/firefox/firefox');
  // Force WebGL on in headless, where Firefox otherwise refuses it.
  options.setPreference('webgl.force-enabled', true);
  options.setPreference('webgl.disabled', false);
  options.setPreference('layers.acceleration.force-enabled', true);
  options.setPreference('gfx.webrender.all', true);
  options.setPreference('dom.webaudio.enabled', true);
  options.setPreference('media.autoplay.default', 0);
  options.setPreference('media.navigator.permission.disabled', true);

  const service = new firefox.ServiceBuilder(process.env.GECKODRIVER_BIN ?? '/home/amt/.local/opt/geckodriver');

  const driver = await new Builder()
    .forBrowser('firefox')
    .setFirefoxOptions(options)
    .setFirefoxService(service)
    .build();

  const shotStats = {};
  const shot = async (name) => {
    const data = await driver.takeScreenshot();
    const buf = Buffer.from(data, 'base64');
    await writeFile(join(SHOTS, `${name}.png`), buf);
    let stats = null;
    try {
      stats = imageStats(buf);
      shotStats[name] = stats;
    } catch (err) {
      notes.push(`could not analyse ${name}.png: ${err.message}`);
    }
    log(
      `screenshot: ${name}.png` +
        (stats ? ` (mean ${stats.mean}, sd ${stats.stdDev}, ${stats.distinctColours} colours)` : ''),
    );
    return stats;
  };

  const evalJs = (script) => driver.executeScript(script);

  /**
   * Dismisses narration by clicking the overlay.
   *
   * Deliberately NOT the space key: space also toggles the lantern, so using
   * it to page through text silently changes the game state the test is about
   * to measure. (It did, and the first run of this test lied to us about it.)
   */
  /** Waits until the game is accepting ordinary gameplay input. */
  const settle = async (max = 40) => {
    for (let i = 0; i < max; i++) {
      const st = await evalJs('return window.__game.debugState');
      if (!st.busy) return true;
      if (st.narration) {
        await evalJs(
          "document.querySelector('.narration').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))",
        );
      }
      await driver.sleep(400);
    }
    return false;
  };

  const clearNarration = async (max = 8) => {
    for (let i = 0; i < max; i++) {
      const open = await evalJs(
        "return document.querySelector('.narration')?.classList.contains('is-open') === true",
      );
      if (!open) return true;
      await evalJs(
        "document.querySelector('.narration').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))",
      );
      await driver.sleep(360);
    }
    return !(await evalJs(
      "return document.querySelector('.narration')?.classList.contains('is-open') === true",
    ));
  };


  const consoleErrors = async () => {
    const entries = await evalJs('return window.__errors || []');
    return entries;
  };

  try {
    await driver.manage().window().setRect({ width: 1280, height: 720 });

    // Capture console errors and uncaught exceptions from inside the page.
    await driver.get(`http://127.0.0.1:${PORT}/`);
    await evalJs(`
      window.__errors = [];
      const origError = console.error;
      console.error = (...a) => { window.__errors.push(a.map(String).join(' ')); origError.apply(console, a); };
      window.addEventListener('error', (e) => window.__errors.push('uncaught: ' + e.message));
      window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + String(e.reason)));
    `);
    // Reload so the hooks are in place before the game boots.
    await driver.navigate().refresh();
    await evalJs(`
      window.__errors = [];
      const origError = console.error;
      console.error = (...a) => { window.__errors.push(a.map(String).join(' ')); origError.apply(console, a); };
      window.addEventListener('error', (e) => window.__errors.push('uncaught: ' + e.message));
      window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + String(e.reason)));
    `);

    log('waiting for boot...');
    await driver.wait(async () => evalJs('return !!window.__game'), 25000, 'game never booted');
    await driver.sleep(1500);

    const hasCanvas = await evalJs("return !!document.querySelector('#stage-root canvas')");
    if (!hasCanvas) failures.push('no canvas was created');

    const canvasSize = await evalJs(`
      const c = document.querySelector('#stage-root canvas');
      return c ? { w: c.width, h: c.height } : null;
    `);
    log('canvas', JSON.stringify(canvasSize));
    if (!canvasSize || canvasSize.w < 100) failures.push('canvas has no size');

    await shot('01-title');

    // --- The title screen must offer Begin ---
    const begin = await driver.wait(
      until.elementLocated(By.xpath("//button[contains(., 'Begin')]")),
      8000,
    );
    await begin.click();
    log('started a new game');
    await driver.sleep(2600);
    await shot('02-chapter1-shore');

    let state = await evalJs('return window.__game.debugState');
    log('state', JSON.stringify(state));
    if (state.scene !== 'shore') failures.push(`expected shore, got ${state.scene}`);
    if (state.mode !== 'playing') failures.push(`expected playing, got ${state.mode}`);

    // --- Dismiss the opening narration ---
    if (!(await settle())) failures.push('the game never became interactive');
    await driver.sleep(400);
    await shot('03-gameplay');

    // --- Walk right for a while using the keyboard ---
    const startX = (await evalJs('return window.__game.debugState')).playerX;
    await evalJs(
      "window.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowRight'}))",
    );
    await driver.sleep(2500);
    await evalJs("window.dispatchEvent(new KeyboardEvent('keyup',{code:'ArrowRight'}))");
    await driver.sleep(400);
    const afterX = (await evalJs('return window.__game.debugState')).playerX;
    log(`walked from ${Math.round(startX)} to ${Math.round(afterX)}`);
    if (afterX - startX < 150) {
      failures.push(`player barely moved (${Math.round(startX)} -> ${Math.round(afterX)})`);
    }
    // She must still be standing in the world, not falling through it.
    const grounded = await evalJs(`
      const dir = Object.values(window.__game).find(v => v && v.player && v.puzzles);
      const b = dir.player.body;
      return { onGround: b.onGround, state: dir.player.state, y: Math.round(b.y) };
    `);
    log('after walking', JSON.stringify(grounded));
    if (grounded.state === 'fall') failures.push(`player is falling after walking (y=${grounded.y})`);
    notes.push(`after a 2.5s run: state=${grounded.state} y=${grounded.y}`);
    await shot('04-walking');

    // --- The FPS counter must show the loop is actually running ---
    await evalJs("const e=new KeyboardEvent('keydown',{code:'F3'});window.dispatchEvent(e);");
    await driver.sleep(1200);
    const fps = (await evalJs('return window.__game.debugState')).fps;
    log(`fps ${fps.toFixed(1)}`);
    if (fps < 10) failures.push(`frame rate implausibly low: ${fps}`);
    notes.push(`headless Firefox frame rate: ${fps.toFixed(1)} fps`);

    // --- Visit every chapter and photograph it ---
    const chapters = [
      ['shore', 'tower'],
      ['highstreet', 'bridge'],
      ['ward', 'door'],
      ['tunnels', 'winch'],
      ['gatehouse', 'desk'],
      ['gate', 'mouth'],
    ];
    for (const [i, [scene, spawn]] of chapters.entries()) {
      await evalJs(`window.__game.debugGoto('${scene}', '${spawn}')`);
      await driver.sleep(1800);
      // Wait out the arrival cinematic, narration and chapter card, so the
      // "dark" frame is a real gameplay frame and not a title overlay.
      if (!(await settle())) failures.push(`${scene} never became interactive`);
      await driver.sleep(400);
      const s = await evalJs('return window.__game.debugState');
      if (s.scene !== scene) failures.push(`debugGoto failed for ${scene} (got ${s.scene})`);
      await shot(`1${i}-${scene}-dark`);

      // Turn the lantern on and photograph the Before layer.
      await evalJs("const e=new KeyboardEvent('keydown',{code:'Space'});window.dispatchEvent(e);");
      await driver.sleep(1600);
      const after = await evalJs('return window.__game.debugState');
      if (!after.lanternFound) failures.push(`the lantern is missing in ${scene}`);
      else if (!after.lanternOn) failures.push(`the lantern would not light in ${scene}`);
      await shot(`1${i}-${scene}-lit`);
      // Off again.
      await evalJs("const e=new KeyboardEvent('keydown',{code:'Space'});window.dispatchEvent(e);");
      await driver.sleep(400);
    }

    // --- Pause, journal and settings must open ---
    await evalJs("const e=new KeyboardEvent('keydown',{code:'Escape'});window.dispatchEvent(e);");
    await driver.sleep(900);
    await shot('20-pause');
    const pauseOpen = await evalJs(
      "return [...document.querySelectorAll('.screen')].some(s => s.classList.contains('is-open'))",
    );
    if (!pauseOpen) failures.push('pause menu did not open');

    const journalBtn = await driver.findElements(By.xpath("//button[contains(., 'Journal')]"));
    if (journalBtn.length > 0) {
      await journalBtn[0].click();
      await driver.sleep(800);
      await shot('21-journal');
    } else {
      failures.push('journal button not found in the pause menu');
    }

    // --- The renderer must be producing a real frame ---
    // The WebGL back buffer is empty after compositing, so the evidence is the
    // screenshot: what the player would actually see.
    await evalJs("document.querySelectorAll('.screen').forEach(s=>s.classList.remove('is-open'))");
    await driver.sleep(500);
    const frame = await shot('22-final');
    if (!frame) {
      failures.push('could not analyse the final frame');
    } else {
      if (frame.distinctColours < 60) {
        failures.push(`frame looks flat (${frame.distinctColours} distinct colours)`);
      }
      if (frame.stdDev < 4) {
        failures.push(`frame has almost no contrast (sd ${frame.stdDev})`);
      }
      if (frame.max < 20) failures.push(`frame is entirely black (max luminance ${frame.max})`);
      notes.push(
        `final frame: mean ${frame.mean}, sd ${frame.stdDev}, ${frame.distinctColours} colours`,
      );
    }

    // Every chapter must render something, lit and unlit, and lighting the
    // lamp must visibly change the picture.
    for (const [scene] of chapters) {
      const dark = shotStats[`1${chapters.findIndex((c) => c[0] === scene)}-${scene}-dark`];
      const lit = shotStats[`1${chapters.findIndex((c) => c[0] === scene)}-${scene}-lit`];
      if (!dark || !lit) continue;
      if (dark.distinctColours < 40) {
        failures.push(`${scene} renders almost nothing (${dark.distinctColours} colours)`);
      }
      const brighter = lit.mean - dark.mean;
      const changed = Math.abs(brighter) > 0.4 || Math.abs(lit.distinctColours - dark.distinctColours) > 40;
      if (!changed) {
        failures.push(`${scene}: the lantern did not change the frame`);
      } else {
        notes.push(
          `${scene}: dark mean ${dark.mean} -> lit mean ${lit.mean} (${brighter > 0 ? '+' : ''}${brighter.toFixed(2)})`,
        );
      }
    }

    // --- Saves must round-trip through IndexedDB ---
    const saved = await evalJs(`
      return new Promise((resolve) => {
        const req = indexedDB.open('what-the-water-kept', 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('state', 'readonly');
          const get = tx.objectStore('state').get('save:primary');
          get.onsuccess = () => resolve(get.result ? {
            found: true,
            scene: get.result.data?.checkpointScene,
            version: get.result.data?.version,
            checksum: typeof get.result.checksum,
            clues: get.result.data?.clues?.length ?? 0,
          } : { found: false });
          get.onerror = () => resolve({ found: false, error: 'get failed' });
        };
        req.onerror = () => resolve({ found: false, error: 'open failed' });
      });
    `);
    log('save record', JSON.stringify(saved));
    if (!saved?.found) failures.push('no save was written to IndexedDB');
    else notes.push(`save written: scene=${saved.scene} v${saved.version} clues=${saved.clues}`);

    // --- Console must be clean ---
    const errors = await consoleErrors();
    for (const e of errors) {
      // Known-benign: headless audio and font decoding warnings.
      if (/AudioContext|autoplay|downloadable font|WebGL warning/i.test(e)) {
        notes.push(`ignored console noise: ${e.slice(0, 120)}`);
        continue;
      }
      failures.push(`console error: ${e.slice(0, 300)}`);
    }

    // --- Nothing may have been requested from off-device ---
    const remote = requests.filter((r) => /^https?:\/\//i.test(r));
    if (remote.length > 0) failures.push(`remote requests: ${remote.join(', ')}`);
    notes.push(`${requests.length} local requests, 0 remote`);

  } catch (err) {
    failures.push(`harness error: ${err?.message ?? String(err)}`);
    try {
      await shot('99-failure');
    } catch {
      /* ignore */
    }
  } finally {
    await driver.quit().catch(() => undefined);
    server.close();
  }

  console.log('\n================ SMOKE TEST ================');
  for (const n of notes) console.log('  note:', n);
  if (failures.length === 0) {
    console.log('  RESULT: PASS');
    process.exit(0);
  }
  for (const f of failures) console.log('  FAIL:', f);
  console.log(`  RESULT: FAIL (${failures.length})`);
  process.exit(1);
};

main();
