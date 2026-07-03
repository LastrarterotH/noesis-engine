// Headless functional smoke test for all scenes.
// Stubs canvas/DOM/window so the real engine runs in Node, then for each scene:
// construct World, runInit, tick runStep+runDraw many times, click, reset,
// tick again. Any thrown error = FAIL. No pixels involved.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// --- Browser stubs -----------------------------------------------------------
const gradient = { addColorStop() {} };
const ctx = new Proxy({}, {
  get(t, p) {
    if (p === 'createRadialGradient' || p === 'createLinearGradient' || p === 'createConicGradient') return () => gradient;
    if (p === 'measureText') return () => ({ width: 0 });
    if (p === 'canvas') return t.canvas;
    if (p === 'getImageData') return () => ({ data: [] });
    return () => {};           // any method = no-op
  },
  set() { return true; },      // swallow fillStyle/font/globalAlpha/etc.
});
const rect = (w, h) => ({ width: w, height: h, left: 0, top: 0, right: w, bottom: h });
function makeCanvas(w = 760, h = 440) {
  const c = {
    width: w, height: h, style: {},
    getContext: () => ctx,
    getBoundingClientRect: () => rect(w, h),
  };
  ctx.canvas = c;
  return c;
}
function makeEl() {
  const e = {
    style: {}, dataset: {}, _children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild(x) { e._children.push(x); return x; },
    removeChild() {}, remove() {}, setAttribute() {}, removeAttribute() {},
    addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
    getBoundingClientRect: () => rect(0, 0),
    set innerHTML(_) {}, get innerHTML() { return ''; },
    set textContent(_) {}, get textContent() { return ''; },
  };
  return e;
}
globalThis.window = {};                       // no AudioContext -> audio no-ops
globalThis.document = { createElement: (tag) => (tag === 'canvas' ? makeCanvas() : makeEl()) };
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
if (!globalThis.performance) globalThis.performance = { now: () => 0 };

// --- Run ---------------------------------------------------------------------
const { World } = await import(join(ROOT, 'engine', 'world.js'));
const { validateScene } = await import(join(ROOT, 'tools', 'validate.mjs'));

const files = readdirSync(join(ROOT, 'scenes')).filter(f => f.endsWith('.json')).sort()
  .map(f => ['scenes', f]);
// Corre el guion y detecta CUELGUES. Un cuelgue = un script ESTANCADO: no
// terminó (sc.done) y su sc.i no avanzó durante >= STALL ticks simulados (parado
// en un waitFor:arrive inalcanzable o un waitUntil imposible). Se evalúa sobre
// TODOS los scripts, INCLUIDOS los que contienen un `loop` de control: un loop
// sano sigue moviendo sc.i (nunca se estanca), pero un guion que cuelga ANTES de
// llegar a su loop sí se estanca y debe cazarse. Al tope de ticks NO se reprueba
// por "no terminó" (un goto-loop o loop:true avanza para siempre por diseño): solo
// el estancamiento es cuelgue. Tickea un mínimo para ejercitar escenas sin guion.
// `onTick(i)` inyecta la interacción. Devuelve un mensaje de fallo o null.
function runToCompletionOrHang(world, onTick) {
  const dt = 0.05, MIN_TICKS = 120, MAX_TICKS = 8000, STALL = 2000;   // tope 400s; 100s sin avanzar sc.i = colgado
  const prog = new Map();   // sc -> { i, tick del último avance de sc.i }
  for (let i = 0; i < MAX_TICKS; i++) {
    world.runStep(dt);
    world.runDraw();
    if (onTick) onTick(i);
    const scripts = world._scripts || [];
    for (const sc of scripts) {
      const pr = prog.get(sc);
      if (!pr || pr.i !== sc.i) prog.set(sc, { i: sc.i, tick: i });
    }
    if (i >= MIN_TICKS - 1) {
      const stuck = scripts.find(sc => !sc.done && (i - (prog.get(sc)?.tick ?? i)) >= STALL);
      if (stuck) {
        const why = stuck.waitForArrive ? `esperando arrive:"${stuck.waitForArrive}" que nunca llega`
          : stuck.waitPredicate ? `esperando waitUntil "${stuck.waitPredicate}" que nunca se cumple`
          : 'sin avanzar en una espera';
        return `guion COLGADO: un script no avanzó en ${Math.round(STALL * dt)}s simulados (atascado en el step ${stuck.i}, ${why}). Un waitFor:arrive a un destino inalcanzable o un waitUntil imposible congela la escena y "Ver nuevamente" nunca aparece.`;
      }
      // Terminó todo lo que puede terminar (los guiones con loop de control no
      // llegan a done por diseño; el estancamiento ya se descartó arriba).
      if (!scripts.length || scripts.every(sc => sc.done)) return null;
    }
  }
  return null;   // avanzó hasta el tope sin estancarse: bucle por diseño (goto/loop), no cuelgue.
}

let pass = 0, fail = 0;
for (const [dir, file] of files) {
  const config = JSON.parse(readFileSync(join(ROOT, dir, file), 'utf8'));
  // Static vocabulary check first: a scene that references kinds/ids/keys the
  // engine doesn't know can still "run" (the engine ignores them), so the
  // runtime ticks below would never catch it. Details: node tools/validate.mjs
  const v = validateScene(config);
  if (v.errors.length) {
    console.log(`FAIL  ${file.padEnd(34)} ${v.errors.length} error(es) de validación`);
    for (const e of v.errors.slice(0, 5)) console.log(`      ✗ ${e}`);
    if (v.errors.length > 5) console.log(`      … ${v.errors.length - 5} más (node tools/validate.mjs ${dir}/${file})`);
    fail++;
    continue;
  }
  const w = config.canvas?.w || 760, h = config.canvas?.h || 440;
  let world, note = '';
  try {
    world = new World(config, makeCanvas(w, h), null);
    world._muted = true;
    world.runInit();
    const ents0 = world.entities.length;
    // Corre el guion completo desde t=0 y detecta cuelgues (con el click de
    // interacción a mitad, sin tocar el botón de replay si ya terminó).
    const hang = runToCompletionOrHang(world, (i) => {
      if (i === 60 && !(world.state && world.state.showReplay)) world.handleClick(w / 2, h / 2);
    });
    if (hang) throw new Error(hang);
    const tMid = world.t;
    world.reset();                                      // exercise reset() + camera re-init
    for (let i = 0; i < 40; i++) { world.runStep(0.05); world.runDraw(); }
    // Sanity assertions on evolved state.
    if (!Array.isArray(world.entities)) throw new Error('entities not array after reset');
    if (!(world.t > 0)) throw new Error('world.t did not advance after reset');
    if (!(tMid > 0)) throw new Error('world.t did not advance in first run');
    note = `entities ${ents0}->${world.entities.length}, fx=${world._fx.length}, scripts=${(world._scripts||[]).length}`;
    console.log(`PASS  ${file.padEnd(34)} ${note}`);
    pass++;
  } catch (err) {
    console.log(`FAIL  ${file.padEnd(34)} ${err.message}`);
    console.log(`      ${(err.stack || '').split('\n').slice(1, 4).join('\n      ')}`);
    fail++;
  }
}
console.log(`\n${pass}/${pass + fail} scenes passed` + (fail ? `, ${fail} FAILED` : ''));
process.exit(fail ? 1 : 0);
