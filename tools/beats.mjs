// noesis-engine / beats
// Imprime el BEAT SHEET de una escena: a qué segundo dispara cada caption, say,
// focus, chart, diagram... sumando los `wait` del guion, estimando los
// `waitFor: arrive` (por distancia/velocidad) y calculando la duración de
// LECTURA de los globos. Reusa el reloj `simulateScript` del validador
// (engine/validate.js), el mismo del que cuelga el lint de tiempos. Sirve para
// elegir el segundo fotogénico de capture/shoot sin adivinar y para ver de un
// vistazo el ritmo de una escena.
//
//   node tools/beats.mjs 12-bosque-oscuro
//   node tools/beats.mjs 08              # prefijo
//   node tools/beats.mjs scenes/01-netflix-prize.json

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename, resolve } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { simulateScript } = await import(join(ROOT, 'engine', 'validate.js'));

function resolveScene(arg) {
  if (arg.endsWith('.json')) return resolve(process.cwd(), arg);
  const dir = join(ROOT, 'scenes');
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  const hit = files.find(f => f === `${arg}.json`) || files.find(f => f.startsWith(`${arg}-`)) || files.find(f => f.startsWith(arg));
  return join(dir, hit || `${arg}.json`);
}

const KIND = {
  caption: 'CAP', title: 'TITULO', say: 'SAY', think: 'THINK', focus: 'FOCUS',
  camera: 'CAMARA', chart: 'CHART', formula: 'FORMULA', annotation: 'ANNOT',
  diagram: 'DIAG', meter: 'METER', scene: 'ESCENA', music: 'MUSICA',
  weather: 'CLIMA', mood: 'MOOD',
};

const args = process.argv.slice(2);
if (!args.length) { console.error('uso: node tools/beats.mjs <slug|NN|ruta.json> [...]'); process.exit(1); }

for (const arg of args) {
  const file = resolveScene(arg);
  let config;
  try { config = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { console.error(`✗ no pude leer ${arg}: ${e.message}`); process.exit(1); }
  const { beats, duration } = simulateScript(config);
  const id = (config.meta && config.meta.id) || basename(file, '.json');
  console.log(`\n${id}  —  ${beats.length} beats, ~${duration.toFixed(1)} s\n`);
  if (!beats.length) { console.log('  (sin "script" top-level: nada que simular)'); continue; }
  // Cuándo cambia cada slot de caption/título (para marcar los que pasan rápido).
  const nextSlotT = {};
  for (const slot of ['caption', 'title']) {
    const sb = beats.filter(b => b.kind === slot);
    for (let k = 0; k < sb.length; k++) if (sb[k + 1]) nextSlotT[`${slot}#${sb[k].i}`] = sb[k + 1].t;
  }
  const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
  for (const b of beats) {
    const tag = KIND[b.kind] || b.kind.toUpperCase();
    let detail = '';
    if (b.entity) detail = b.entity + (b.text != null ? `: ${b.text}` : '');
    else if (b.text != null) detail = String(b.text);
    if (b.off) detail += '  (off)';
    const dur = b.dur ? `  [${b.dur.toFixed(1)}s]` : '';
    let mark = '';
    if ((b.kind === 'caption' || b.kind === 'title') && b.text) {
      const nt = nextSlotT[`${b.kind}#${b.i}`], read = 0.5 + 0.3 * words(b.text);
      if (nt != null && nt - b.t < read) mark = `  <- rápida (${(nt - b.t).toFixed(1)}s de ~${read.toFixed(1)}s de lectura)`;
    }
    console.log(`  t=${b.t.toFixed(1).padStart(6)}  ${tag.padEnd(7)}  ${String(detail).slice(0, 66)}${dur}${mark}`);
  }
}
