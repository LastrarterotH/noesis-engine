// noesis-engine / capture
// Headless screenshot tool for catalog previews. Uses Chrome's DevTools
// Protocol (CDP) over WebSocket so we control timing in REAL time — Chrome's
// --virtual-time-budget would kill RAF before our scenes have animated.
//
//   node tools/capture.mjs
//
// Requires the local dev server running:  python3 -m http.server 8765

import { spawn } from 'child_process';
import { mkdirSync, existsSync, readFileSync, writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:8765/tools/preview.html';
const OUT = './previews';

// El repertorio viejo se podó el 2026-06-09 tras fijar la vara de la
// escena 01 (Netflix Prize). Al crear una escena nueva, sumarla aquí con su `wait` (el
// segundo del momento más fotogénico de su guion).
const SCENES = [
  { slug: '01-netflix-prize', wait: 62 },
  { slug: '02-cuarto-de-mary', wait: 44 },
  { slug: '03-gato-de-schrodinger', wait: 30 },
  { slug: '04-tpack', wait: 36 },
  { slug: '05-persefone-demeter', wait: 30 },
  { slug: '06-basilisco-roko', wait: 34 },
  { slug: '07-tragedia-de-los-comunes', wait: 40 },
  { slug: '08-contagio-r0', wait: 28 },
  { slug: '09-la-caverna', wait: 14 },
  { slug: '10-fuera-de-juego', wait: 20 },
  { slug: '11-cuentos-grimm', wait: 114 },
  { slug: '12-bosque-oscuro', wait: 3 },
  { slug: '13-genially-coffee', wait: 19 },
  { slug: '14-red-neuronal', wait: 36 },
];

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

if (!existsSync(CHROME)) {
  console.error('Chrome not found at', CHROME);
  process.exit(1);
}

// Verify the dev server is up; otherwise Chrome loads blank pages and we get
// 9 useless screenshots before noticing.
try {
  const r = await fetch('http://localhost:8765/tools/preview.html', { signal: AbortSignal.timeout(2000) });
  if (!r.ok) throw new Error(`http ${r.status}`);
} catch (err) {
  console.error('local server not reachable at http://localhost:8765');
  console.error('start it with:  python3 -m http.server 8765');
  console.error('(detail:', err.message + ')');
  process.exit(1);
}

function readCanvasSize(slug) {
  try {
    const cfg = JSON.parse(readFileSync(`./scenes/${slug}.json`, 'utf8'));
    return { w: cfg.canvas?.w || 800, h: cfg.canvas?.h || 440 };
  } catch { return { w: 800, h: 440 }; }
}

// --- CDP helper: minimal client around the native node WebSocket ---
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.msgId = 0;
    this.pending = new Map();      // id -> {resolve, reject}
    this.sessions = new Set();
    this.events = new Map();        // method -> [handler]
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id != null && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (m.error) reject(new Error(`${m.error.code}: ${m.error.message}`));
        else resolve(m.result);
        return;
      }
      if (m.method) {
        const list = this.events.get(m.method);
        if (list) for (const fn of list) fn(m.params, m.sessionId);
      }
    });
  }
  on(method, fn) {
    if (!this.events.has(method)) this.events.set(method, []);
    this.events.get(method).push(fn);
  }
  send(method, params = {}, sessionId) {
    const id = ++this.msgId;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    this.ws.send(JSON.stringify(msg));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getBrowserWsEndpoint(port) {
  // Chrome publishes the browser-level WS endpoint here once it's ready.
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch {}
    await sleep(100);
  }
  throw new Error('Chrome devtools endpoint not reachable');
}

async function main() {
  // Launch Chrome with remote debugging on a fixed-ish port (random in range).
  const port = 9222 + Math.floor(Math.random() * 1000);
  const userDataDir = mkdtempSync(join(tmpdir(), 'noesis-chrome-'));
  const chromeArgs = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    '--mute-audio',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${port}`,
    'about:blank',
  ];
  console.log(`launching chrome (cdp port ${port})...`);
  const chrome = spawn(CHROME, chromeArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
  chrome.stderr.on('data', () => {}); // suppress chatter
  chrome.on('error', (e) => { console.error('chrome spawn error', e); process.exit(1); });

  const browserWs = await getBrowserWsEndpoint(port);
  const ws = new WebSocket(browserWs);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const cdp = new CDP(ws);

  // Optional filter: `node tools/capture.mjs 09` will only capture matching scenes.
  const filter = process.argv[2];
  const scenes = filter ? SCENES.filter(s => s.slug.startsWith(filter)) : SCENES;
  try {
    for (const { slug, wait } of scenes) {
      const { w, h } = readCanvasSize(slug);
      const url = `${BASE}?s=${slug}&w=${w}&h=${h}`;
      const num = slug.slice(0, 2);
      const out = `${OUT}/scene-${num}.png`;
      console.log(`-> ${slug}  (${w}x${h}, wait ${wait}s real)`);

      // Create a fresh target per scene so timers/audio/etc. don't leak.
      const { targetId } = await cdp.send('Target.createTarget', {
        url: 'about:blank',
      });
      const { sessionId } = await cdp.send('Target.attachToTarget', {
        targetId,
        flatten: true,
      });
      // Set the viewport exactly to the canvas, scale 2 for crisp output.
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: w, height: h, deviceScaleFactor: 2, mobile: false,
      }, sessionId);
      await cdp.send('Page.enable', {}, sessionId);
      // Navigate and wait for the load event.
      const loaded = new Promise((res) => {
        const once = (params, sid) => {
          if (sid === sessionId) { cdp.events.get('Page.loadEventFired')?.splice(0); res(); }
        };
        cdp.on('Page.loadEventFired', once);
      });
      await cdp.send('Page.navigate', { url }, sessionId);
      // Race the load event with a hard 5s cap; either way we still need to
      // wait `wait` real seconds for the scene to animate.
      await Promise.race([loaded, sleep(5000)]);
      await sleep(wait * 1000);
      const { data } = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      }, sessionId);
      writeFileSync(out, Buffer.from(data, 'base64'));
      console.log(`   wrote ${out}`);
      await cdp.send('Target.closeTarget', { targetId });
    }
  } finally {
    try { ws.close(); } catch {}
    try { chrome.kill(); } catch {}
  }
  console.log('done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
