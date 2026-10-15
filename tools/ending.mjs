/**
 * Ending-sequence test: drops into the finale, runs east through the rising
 * water to the valley side using only keyboard input, and asserts the ending
 * cinematic, the ending screen and the credits all appear - and that the save
 * records the run as completed.
 */
import { Builder } from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const SHOTS = new URL('../artifacts/screenshots/', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  const p = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const f = join(DIST, normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] ?? 'application/octet-stream' });
  res.end(await readFile(f));
});
await new Promise((r) => server.listen(8792, '127.0.0.1', r));
await mkdir(SHOTS, { recursive: true });

const o = new firefox.Options();
o.addArguments('-headless');
o.setBinary(process.env.FIREFOX_BIN ?? '/home/amt/.local/opt/firefox/firefox');
o.setPreference('webgl.force-enabled', true);
const driver = await new Builder().forBrowser('firefox').setFirefoxOptions(o)
  .setFirefoxService(new firefox.ServiceBuilder(process.env.GECKODRIVER_BIN ?? '/home/amt/.local/opt/geckodriver')).build();
const js = (s) => driver.executeScript(s);
const sleep = (ms) => driver.sleep(ms);
const fails = [];
const settle = async () => {
  for (let i = 0; i < 60; i++) {
    const st = await js('return window.__game.debugState');
    if (!st.busy) return true;
    if (st.narration) await js("document.querySelector('.narration').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");
    await sleep(350);
  }
  return false;
};
const shot = async (n) => writeFile(join(SHOTS, n + '.png'), Buffer.from(await driver.takeScreenshot(), 'base64'));

try {
  await driver.manage().window().setRect({ width: 1280, height: 720 });
  await driver.get('http://127.0.0.1:8792/');
  await driver.wait(async () => js('return !!window.__game'), 20000);
  await sleep(800);
  // The log is what the warm ending needs; carry it as a real run would.
  const WARM = process.argv.includes('--shown');
  if (WARM) {
    // Carry the log, stand in the gate mouth facing Martin, light him, show him.
    // Enter the scene first: debugGoto resets state when called from the title.
    await js("window.__game.debugGoto('gate','mouth')");
    await sleep(1200); await settle();
    await js("Object.values(window.__game).find(v=>v&&v.player&&v.puzzles).state.addItem('item-log')");
    await js("window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space'}))");
    await sleep(1500); await settle();
    const prompt = await js("return document.querySelector('.prompt__verb')?.textContent || ''");
    console.log('prompt offered:', JSON.stringify(prompt));
    if (prompt !== 'Show him') fails.push('the Show him prompt was not offered');
    await shot('43-show-him');
    await js("window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE'}))");
    await js("window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyE'}))");
  } else {
    await js("window.__game.debugGoto('gate','apron')");
    await sleep(1200);
    await settle();
    await shot('40-finale');
    await js("window.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowRight'}))");
  }
  let ended = false;
  for (let i = 0; i < 80 && !ended; i++) {
    await sleep(250);
    const st = await js('return window.__game.debugState');
    if (st.narration) await js("document.querySelector('.narration').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");
    ended = st.mode === 'ended';
  }
  await js("window.dispatchEvent(new KeyboardEvent('keyup',{code:'ArrowRight'}))");
  // Page through the ending narration.
  for (let i = 0; i < 40; i++) {
    const st = await js('return window.__game.debugState');
    if (st.mode === 'ended') break;
    if (st.narration) await js("document.querySelector('.narration').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");
    await sleep(400);
  }
  await sleep(1800);
  const mode = (await js('return window.__game.debugState')).mode;
  if (mode !== 'ended') fails.push(`expected mode=ended, got ${mode}`);
  const endingText = await js("return document.querySelector('.ending__title')?.textContent || ''");
  const endingOpen = await js("return [...document.querySelectorAll('.screen')].some(s=>s.classList.contains('is-open') && s.querySelector('.ending'))");
  if (!endingOpen) fails.push('ending screen did not open');
  console.log('ending title:', JSON.stringify(endingText));
  await shot('41-ending');
  const credits = await driver.findElements({ xpath: "//button[contains(., 'Credits')]" });
  for (const b of credits) { if (await b.isDisplayed()) { await b.click(); break; } }
  await sleep(800);
  const creditsOpen = await js("return [...document.querySelectorAll('.screen')].some(s=>s.classList.contains('is-open') && s.querySelector('.credits'))");
  if (!creditsOpen) fails.push('credits did not open');
  await shot('42-credits');
  const save = await js(`return new Promise((res)=>{const r=indexedDB.open('what-the-water-kept',1);
    r.onsuccess=()=>{const g=r.result.transaction('state','readonly').objectStore('state').get('save:primary');
    g.onsuccess=()=>res(g.result?{completed:g.result.data.completed,ending:g.result.data.endingId}:null);};});`);
  console.log('save after ending:', JSON.stringify(save));
  if (process.argv.includes('--shown') && save?.ending !== 'shown') fails.push('expected the shown ending, got ' + save?.ending);
  if (!save?.completed) fails.push('save does not record the run as completed');
} catch (e) { fails.push('harness: ' + e.message); }
finally { await driver.quit().catch(() => {}); server.close(); }
console.log(fails.length ? 'ENDING TEST: FAIL\n  ' + fails.join('\n  ') : 'ENDING TEST: PASS');
process.exit(fails.length ? 1 : 0);
