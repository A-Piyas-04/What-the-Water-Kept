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
await new Promise((r) => server.listen(8790, '127.0.0.1', r));
const o = new firefox.Options();
o.addArguments('-headless');
o.setBinary('/home/amt/.local/opt/firefox/firefox');
o.setPreference('webgl.force-enabled', true);
const driver = await new Builder().forBrowser('firefox').setFirefoxOptions(o)
  .setFirefoxService(new firefox.ServiceBuilder('/home/amt/.local/opt/geckodriver')).build();
const js = (s) => driver.executeScript(s);
try {
  await driver.manage().window().setRect({ width: 1280, height: 720 });
  await driver.get('http://127.0.0.1:8790/');
  await driver.wait(async () => js('return !!window.__game'), 20000);
  await driver.sleep(1200);
  await js(`
    const g = window.__game;
    window.__dir = Object.values(g).find(v => v && v.player && v.puzzles);
    window.__ctl = Object.values(g).find(v => v && v.state && typeof v.sample === 'function');
    window.__keyLog = [];
    window.addEventListener('keydown', (e) => window.__keyLog.push('down:' + e.code), true);
    window.addEventListener('blur', () => window.__keyLog.push('BLUR'), true);
    window.addEventListener('focus', () => window.__keyLog.push('FOCUS'), true);
  `);
  await js("window.__game.debugGoto('shore','default')");
  await driver.sleep(1200);
  for (let i = 0; i < 8; i++) {
    const open = await js("return document.querySelector('.narration')?.classList.contains('is-open')===true");
    if (!open) break;
    await js("document.querySelector('.narration').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");
    await driver.sleep(340);
  }
  console.log('state before key:', await js('return JSON.stringify(window.__ctl.state)'));
  await js("window.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowRight'}))");
  console.log('keylog:', await js('return JSON.stringify(window.__keyLog)'));
  // Read immediately, before any sample() has run.
  console.log('ctl.state right after dispatch:', await js('return JSON.stringify(window.__ctl.state)'));
  await driver.sleep(300);
  console.log('ctl.state +300ms:', await js('return JSON.stringify(window.__ctl.state)'));
  console.log('player:', await js(`
    const b = window.__dir.player.body;
    return JSON.stringify({x: Math.round(b.x), vx: Math.round(b.vx), s: window.__dir.player.state});
  `));
  console.log('keylog2:', await js('return JSON.stringify(window.__keyLog)'));
  console.log('movementLocked?', await js('return JSON.stringify({ml: window.__ctl.movementLocked, en: window.__ctl.enabled})'));
} finally {
  await driver.quit().catch(() => {});
  server.close();
}
