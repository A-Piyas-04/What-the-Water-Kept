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
await new Promise((r) => server.listen(8791, '127.0.0.1', r));
const o = new firefox.Options();
o.addArguments('-headless');
o.setBinary('/home/amt/.local/opt/firefox/firefox');
o.setPreference('webgl.force-enabled', true);
const driver = await new Builder().forBrowser('firefox').setFirefoxOptions(o)
  .setFirefoxService(new firefox.ServiceBuilder('/home/amt/.local/opt/geckodriver')).build();
const js = (s) => driver.executeScript(s);
try {
  await driver.manage().window().setRect({ width: 1366, height: 768 });
  await driver.get('http://127.0.0.1:8791/');
  await driver.wait(async () => js('return !!window.__game'), 20000);
  await driver.sleep(1000);
  for (const [scene, spawn] of [['highstreet','bridge'], ['gatehouse','desk'], ['ward','door']]) {
    await js(`window.__game.debugGoto('${scene}','${spawn}')`);
    await driver.sleep(1400);
    for (let i=0;i<10;i++){
      const st = await js('return window.__game.debugState');
      if (!st.busy) break;
      if (st.narration) await js("document.querySelector('.narration').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");
      await driver.sleep(350);
    }
    await js("window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space'}))");
    await driver.sleep(1500);
    console.log(scene, JSON.stringify(await js('return window.__game.debugLayers()')));
    await js("window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space'}))");
    await driver.sleep(300);
  }
} finally { await driver.quit().catch(()=>{}); server.close(); }
