import { Builder } from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  const path = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const file = join(DIST, normalize(path).replace(/^(\.\.[/\\])+/, ''));
  if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(await readFile(file));
});
await new Promise((r) => server.listen(8788, '127.0.0.1', r));

const options = new firefox.Options();
options.addArguments('-headless');
options.setBinary('/home/amt/.local/opt/firefox/firefox');
options.setPreference('webgl.force-enabled', true);
const driver = await new Builder().forBrowser('firefox')
  .setFirefoxOptions(options)
  .setFirefoxService(new firefox.ServiceBuilder('/home/amt/.local/opt/geckodriver'))
  .build();

try {
  await driver.manage().window().setRect({ width: 1280, height: 720 });
  await driver.get('http://127.0.0.1:8788/');
  await driver.wait(async () => driver.executeScript('return !!window.__game'), 20000);
  await driver.sleep(1200);
  // Start directly, bypassing the title button.
  await driver.executeScript("window.__game.debugGoto('shore','default')");
  await driver.sleep(1500);

  // Close any narration by clicking the overlay, NOT with the space key.
  for (let i = 0; i < 8; i++) {
    const open = await driver.executeScript(
      "return document.querySelector('.narration')?.classList.contains('is-open')");
    if (!open) break;
    await driver.executeScript(
      "document.querySelector('.narration').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");
    await driver.sleep(350);
  }

  await driver.executeScript("window.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowRight'}))");
  const samples = [];
  for (let i = 0; i < 14; i++) {
    await driver.sleep(250);
    samples.push(await driver.executeScript(`
      const d = window.__game;
      const p = d.debugState;
      return {
        t: ${i},
        x: Math.round(p.playerX),
        state: window.__dbgState ?? null,
      };
    `));
  }
  await driver.executeScript("window.dispatchEvent(new KeyboardEvent('keyup',{code:'ArrowRight'}))");

  // Richer introspection via the director.
  const deep = await driver.executeScript(`
    const g = window.__game;
    const d = g.debugState;
    return JSON.stringify(d);
  `);
  console.log('samples:', samples.map((s) => s.x).join(' -> '));
  console.log('final:', deep);

  const detail = await driver.executeScript(`
    const g = window.__game;
    // Reach into the director through the known field name.
    const dir = Object.values(g).find(v => v && v.player && v.state && v.puzzles);
    if (!dir) return 'no director';
    const p = dir.player;
    return {
      state: p.state,
      vx: Number(p.body.vx.toFixed(1)),
      vy: Number(p.body.vy.toFixed(1)),
      onGround: p.body.onGround,
      blockedX: p.body.blockedX,
      inLowSpace: p.body.inLowSpace,
      onLadder: p.body.onLadder,
      x: Math.round(p.body.x),
      y: Math.round(p.body.y),
      height: p.body.height,
      locked: p.locked,
      interacting: p.interacting,
      textPending: dir.textPending,
      cinematic: dir.cinematic.playing,
      paused: dir.isPaused,
    };
  `);
  console.log('detail:', JSON.stringify(detail, null, 2));

  const inputDetail = await driver.executeScript(`
    const g = window.__game;
    const c = Object.values(g).find(v => v && v.state && typeof v.sample === 'function');
    return c ? JSON.stringify(c.state) : 'no controls';
  `);
  console.log('input:', inputDetail);
} finally {
  await driver.quit().catch(() => {});
  server.close();
}
