/**
 * Extracts a frame from a webm using Firefox, because the emulator's own
 * screen recording is the only capture path that sees the WebView's
 * hardware-composited WebGL surface, and there is no ffmpeg here.
 */
import { Builder } from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';

const input = process.argv[2];
const output = process.argv[3] ?? input.replace(/\.webm$/, '.png');
const seek = Number(process.argv[4] ?? 3);

const dir = dirname(input);
const name = basename(input);
const server = createServer(async (req, res) => {
  if (req.url.startsWith('/v')) {
    res.writeHead(200, { 'content-type': 'video/webm' });
    res.end(await readFile(input));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(`<!doctype html><body style="margin:0;background:#000">
    <video id="v" src="/v" muted></video>
    <canvas id="c"></canvas></body>`);
});
await new Promise((r) => server.listen(8898, '127.0.0.1', r));

const o = new firefox.Options();
o.addArguments('-headless');
o.setBinary(process.env.FIREFOX_BIN ?? '/home/amt/.local/opt/firefox/firefox');
const driver = await new Builder()
  .forBrowser('firefox')
  .setFirefoxOptions(o)
  .setFirefoxService(new firefox.ServiceBuilder(process.env.GECKODRIVER_BIN ?? '/home/amt/.local/opt/geckodriver'))
  .build();

try {
  await driver.get('http://127.0.0.1:8898/');
  const data = await driver.executeAsyncScript(`
    const cb = arguments[arguments.length - 1];
    const v = document.getElementById('v');
    const c = document.getElementById('c');
    v.addEventListener('loadeddata', () => { v.currentTime = ${seek}; });
    v.addEventListener('seeked', () => {
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0);
      cb(c.toDataURL('image/png'));
    }, { once: true });
    v.addEventListener('error', () => cb('ERROR:' + (v.error && v.error.message)));
    v.load();
  `);
  if (typeof data === 'string' && data.startsWith('ERROR')) throw new Error(data);
  await writeFile(output, Buffer.from(data.split(',')[1], 'base64'));
  console.log('wrote', output);
  void name; void dir;
} finally {
  await driver.quit().catch(() => undefined);
  server.close();
}
