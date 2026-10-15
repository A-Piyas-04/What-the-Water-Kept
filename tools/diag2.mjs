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
await new Promise((r) => server.listen(8789, '127.0.0.1', r));

const options = new firefox.Options();
options.addArguments('-headless');
options.setBinary('/home/amt/.local/opt/firefox/firefox');
options.setPreference('webgl.force-enabled', true);
const driver = await new Builder().forBrowser('firefox')
  .setFirefoxOptions(options)
  .setFirefoxService(new firefox.ServiceBuilder('/home/amt/.local/opt/geckodriver'))
  .build();

const js = (s) => driver.executeScript(s);

try {
  await driver.manage().window().setRect({ width: 1280, height: 720 });
  await driver.get('http://127.0.0.1:8789/');
  await driver.wait(async () => js('return !!window.__game'), 20000);
  await driver.sleep(1200);

  // Expose the director for introspection.
  await js(`
    const g = window.__game;
    window.__dir = Object.values(g).find(v => v && v.player && v.state && v.puzzles);
    window.__probe = () => {
      const d = window.__dir; const b = d.player.body;
      return { x: Math.round(b.x*10)/10, y: Math.round(b.y*10)/10,
               vx: Math.round(b.vx), vy: Math.round(b.vy),
               g: b.onGround, s: d.player.state, h: b.height };
    };
  `);

  const mode = await js('return window.__game.debugState.mode');
  console.log('mode before goto:', mode);

  await js("window.__game.debugGoto('shore','default')");
  // Probe immediately, synchronously after the load.
  console.log('right after load:', JSON.stringify(await js('return window.__probe()')));

  for (let i = 0; i < 10; i++) {
    await driver.sleep(120);
    console.log(`  +${(i + 1) * 120}ms`, JSON.stringify(await js('return window.__probe()')));
  }

  // What does the collision world think is under the spawn?
  const under = await js(`
    const d = window.__dir;
    const scene = d.currentScene;
    const sp = scene.spawns.default;
    const cols = scene.colliders.filter(c =>
      sp.x >= c.x - 1 && sp.x <= c.x + c.w + 1 && c.kind === 'solid');
    return JSON.stringify({ spawn: sp, under: cols.map(c => ({k:c.kind,l:c.layer,x:c.x,y:c.y,w:c.w,h:c.h})) });
  `);
  console.log('spawn + colliders spanning spawn x:', under);

  const bounds = await js('return JSON.stringify(window.__dir.currentScene.bounds)');
  console.log('bounds:', bounds);
} finally {
  await driver.quit().catch(() => {});
  server.close();
}
