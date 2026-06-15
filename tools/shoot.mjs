// noesis-engine / shoot
// Render UNA escena headless en varios instantes, para verificación visual
// rápida sin grabar a mano. Reusa el enfoque CDP de capture.mjs (tiempo real,
// no virtual-time-budget, para que los RAF animen). Escribe a /tmp/shot_NN.png.
//
//   node tools/shoot.mjs 02-ciclo-del-agua 3,9,16,24
//
// Requiere el server local:  python3 -m http.server 8765

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const slug = process.argv[2];
const times = (process.argv[3] || '6').split(',').map(Number).filter(n => n >= 0).sort((a, b) => a - b);
if (!slug) { console.error('uso: node tools/shoot.mjs <slug> <t1,t2,...>'); process.exit(1); }

let canvas = { w: 800, h: 440 };
try { const c = JSON.parse(readFileSync(`./scenes/${slug}.json`, 'utf8')).canvas; if (c) canvas = { w: c.w || 800, h: c.h || 440 }; } catch {}

class CDP {
  constructor(ws) {
    this.ws = ws; this.msgId = 0; this.pending = new Map(); this.events = new Map();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id != null && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result); return;
      }
      if (m.method) { const l = this.events.get(m.method); if (l) for (const fn of l) fn(m.params, m.sessionId); }
    });
  }
  on(method, fn) { if (!this.events.has(method)) this.events.set(method, []); this.events.get(method).push(fn); }
  send(method, params = {}, sessionId) {
    const id = ++this.msgId; const msg = { id, method, params }; if (sessionId) msg.sessionId = sessionId;
    this.ws.send(JSON.stringify(msg));
    return new Promise((res, rej) => this.pending.set(id, { resolve: res, reject: rej }));
  }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

try {
  const r = await fetch('http://localhost:8765/tools/preview.html', { signal: AbortSignal.timeout(2000) });
  if (!r.ok) throw new Error('http ' + r.status);
} catch { console.error('server local no responde en :8765 (python3 -m http.server 8765)'); process.exit(1); }

const port = 9222 + Math.floor(Math.random() * 1000);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--mute-audio', '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'noesis-shoot-'))}`, `--remote-debugging-port=${port}`, 'about:blank'],
  { stdio: ['ignore', 'pipe', 'pipe'] });
chrome.stderr.on('data', () => {});

async function wsEndpoint() {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) return (await r.json()).webSocketDebuggerUrl; } catch {}
    await sleep(100);
  }
  throw new Error('CDP no responde');
}

try {
  const ws = new WebSocket(await wsEndpoint());
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  const cdp = new CDP(ws);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: canvas.w, height: canvas.h, deviceScaleFactor: 2, mobile: false }, sessionId);
  await cdp.send('Page.enable', {}, sessionId);
  const logoArg = process.argv[4] ? `&logo=${encodeURIComponent(process.argv[4])}` : '';
  await cdp.send('Page.navigate', { url: `http://localhost:8765/tools/preview.html?s=${slug}&w=${canvas.w}&h=${canvas.h}${logoArg}` }, sessionId);
  await sleep(1200);
  let elapsed = 1.2;
  let i = 0;
  for (const t of times) {
    const wait = Math.max(0, t - elapsed); if (wait > 0) await sleep(wait * 1000); elapsed = t;
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
    const out = `/tmp/shot_${String(++i).padStart(2, '0')}.png`;
    writeFileSync(out, Buffer.from(data, 'base64'));
    console.log(`t=${t}s -> ${out}`);
  }
  ws.close();
} finally { try { chrome.kill(); } catch {} }
