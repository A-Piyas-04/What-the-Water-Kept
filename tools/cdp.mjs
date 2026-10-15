/**
 * Evaluates JavaScript inside the Android WebView over the Chrome DevTools
 * Protocol, so the game can be inspected on a real device the same way it is
 * in a desktop browser.
 *
 * Usage: node tools/cdp.mjs '<expression>'
 */
const res = await fetch('http://127.0.0.1:9222/json');
const pages = await res.json();
const page = pages.find((p) => p.type === 'page' && p.url.includes('localhost'));
if (!page) {
  console.error('no page found');
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
const expression = process.argv[2] ?? '1+1';

const done = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('CDP timeout')), 20000);
  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression,
          returnByValue: true,
          awaitPromise: true,
        },
      }),
    );
  };
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id !== 1) return;
    clearTimeout(timer);
    if (msg.result?.exceptionDetails) {
      console.log('EXCEPTION:', JSON.stringify(msg.result.exceptionDetails.exception?.description ?? msg.result.exceptionDetails));
    } else {
      const v = msg.result?.result?.value;
      console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 2));
    }
    ws.close();
    resolve();
  };
  ws.onerror = (e) => {
    clearTimeout(timer);
    reject(new Error('ws error ' + (e.message ?? '')));
  };
});

await done;
