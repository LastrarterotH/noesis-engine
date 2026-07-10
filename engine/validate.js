// noesis-engine / validate
// Núcleo del validador de escenas: chequea un JSON de escena contra el
// vocabulario REAL del motor antes de correrlo. Es puro (sin Node, sin DOM)
// para que funcione igual en el CLI (tools/validate.mjs) y en el navegador.
// Los mensajes de error dicen qué se encontró, qué se
// esperaba y qué valores son válidos, para que un LLM (o un humano) corrija
// solo a partir del texto del error.
//
// Los enums grandes y cambiantes se importan (PROP_SPRITES, SKY_PRESETS,
// hooks) o se escanean del código fuente del motor (buildVocab recibe un
// lector de fuentes), así el validador no se desincroniza al crecer el motor.

import { PROP_SPRITES } from './prop-sprites.js?v=149';
import { SKY_PRESETS } from './sky-presets.js?v=149';
import { HOOK_NAMES, HOOK_ARGS } from './hooks.js?v=149';
import { compileForm, FORM_TYPES } from './forms.js?v=149';

// Fuentes del motor que buildVocab escanea con regex (enums de despachos
// if/else que no se exportan como datos).
export const VOCAB_SOURCES = [
  'prop-draw.js', 'floor.js', 'mood.js', 'accessories.js',
  'ambient.js', 'learner.js', 'util.js', 'audio.js', 'fx.js',
];

const scan = (text, re) => {
  const out = new Set();
  for (const m of text.matchAll(re)) out.add(m[1]);
  return [...out];
};

// `src` es una función (nombreArchivo) => texto fuente de engine/<archivo>.
export function buildVocab(src) {
  const soundSrc = src('audio.js');
  const musicBlock = soundSrc.slice(soundSrc.indexOf('const MUSIC_PRESETS'));
  const tintSrc = src('ambient.js');
  const tintBlock = tintSrc.slice(tintSrc.indexOf('const TINTS'));
  return {
    PROP_KINDS: new Set([
      ...Object.keys(PROP_SPRITES),
      ...scan(src('prop-draw.js'), /prop\.type === '([a-z-]+)'/g),
    ]),
    SKY_KINDS: Object.keys(SKY_PRESETS),
    FLOOR_KINDS: [...new Set(['solid', ...scan(src('floor.js'), /kind === '([a-z-]+)'/g)])],
    MOOD_KINDS: ['neutral', ...scan(src('mood.js'), /mood === '([a-z]+)'/g)],
    ACCESSORY_KINDS: scan(src('accessories.js'), /=== '([a-z]+)'/g),
    PARTICLE_KINDS: scan(src('ambient.js'), /kind === '([a-z]+)'/g),
    BEHAVIOR_TYPES: [...new Set([...scan(src('learner.js'), /b\.type === '([a-zA-Z]+)'/g), 'stop'])],
    EASING_KINDS: ['linear', ...scan(src('util.js'), /case '(ease[A-Za-z]+)'/g)],
    SOUND_KINDS: scan(
      soundSrc.slice(soundSrc.indexOf('createAmbientSound'), soundSrc.indexOf('MUSIC_PRESETS')),
      /type === '([a-z]+)'/g
    ),
    MUSIC_MOODS: scan(musicBlock.slice(0, musicBlock.indexOf('\n};')), /^ {2}(\w+):/gm),
    PARTICLE_PRESETS: (() => {
      const fxSrc = src('fx.js');
      const block = fxSrc.slice(fxSrc.indexOf('const PARTICLE_PRESETS'));
      return scan(block.slice(0, block.indexOf('\n};')), /^ {2}(\w+):/gm);
    })(),
    TINT_PRESETS: scan(tintBlock.slice(0, tintBlock.indexOf('\n};')), /^ {2}(\w+):/gm),
  };
}

// Props que se apoyan en el suelo (su (x,y) es la base del sprite). Si quedan
// con una y muy arriba en una escena declarativa, flotan: se advierte.
const FLOOR_PROPS = new Set([
  'table', 'chair', 'blackboard', 'bookshelf', 'lamp', 'candle', 'plant', 'rug',
  'rug-stripes', 'rug-medallion', 'rug-checker', 'computer', 'book', 'tree', 'bush',
  'flower', 'flower-cluster', 'rock', 'fountain', 'pond', 'bench', 'mushroom', 'tall-grass',
  'cactus', 'palm', 'crate', 'barrel', 'streetlamp', 'building', 'lighthouse', 'boat',
  'pedestal', 'bonfire', 'swing', 'door', 'sign', 'chest', 'switch', 'path-tile',
  'flag', 'mountain', 'domino', 'cat', 'vault', 'wheat', 'column', 'wonderflower', 'chasm', 'tree-bare', 'basilisk',
  'sheep', 'fence', 'turtle', 'grinder',
  'tower', 'oven', 'candy-house', 'shoe', 'mirror', 'wall', 'coffee', 'notebook', 'umbrella',
  'bistro-table', 'bistro-chair', 'laptop',
]);

const LABEL_ANCHORS = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];
const HEALTH_KINDS = ['normal', 'sick', 'feverish', 'frozen'];
const ZONE_EFFECTS = ['mood', 'reinforce', 'quiet', 'sleep'];

const TOP_KEYS = ['meta', 'text', 'hint', 'hintDuration', 'canvas', 'entities', 'props', 'labels', 'walls', 'zones', 'ambient', 'hooks', 'script', 'meters', 'charts', 'formulas', 'annotations', 'diagrams', 'sets', 'seed', 'form'];
const FORMULA_KEYS = ['id', 'tex', 'x', 'y', 'px', 'color', 'weight', 'family', 'align', 'valign', 'alpha', 'screen', 'panel'];
const FORMULA_PANEL_KEYS = ['title', 'titleColor', 'bg', 'border', 'pad', 'radius'];
const ANNOTATION_KEYS = ['id', 'target', 'text', 'dx', 'dy', 'px', 'weight', 'align', 'color', 'textColor', 'bg', 'dot', 'head', 'alpha', 'screen'];
const DIAGRAM_KEYS = ['id', 'alpha', 'reveal', 'screen', 'panel', 'nodes', 'edges', 'texts'];
const DNODE_KEYS = ['id', 'x', 'y', 'w', 'h', 'label', 'fill', 'stroke', 'strokeWidth', 'radius', 'labelColor', 'font', 'px', 'weight', 'at', 'fadeIn', 'target', 'shape'];
const DEDGE_KEYS = ['from', 'fromSide', 'to', 'toSide', 'curve', 'color', 'width', 'dash', 'head', 'both', 'label', 'labelColor', 'labelBg', 'gap', 'at', 'fadeIn'];
const DTEXT_KEYS = ['id', 'x', 'y', 'text', 'align', 'color', 'px', 'weight', 'font', 'at', 'fadeIn'];
const DPANEL_KEYS = ['x', 'y', 'w', 'h', 'radius', 'pad', 'fill', 'stroke', 'strokeWidth', 'title', 'titleColor'];

// Reloj del guion: simula `config.script` para obtener la línea de tiempo (a qué
// segundo dispara cada step y qué queda visible). Puro y sin dibujar: suma los
// `wait`, estima los `waitFor: arrive` por distancia/velocidad, calcula la
// duración de LECTURA de cada globo (el mismo piso que fx.js: max(dur ?? 2.2,
// min(7, 1.2 + 0.4·palabras))) y rastrea la visibilidad (appear/vanish/_alpha).
// Es el simulador que comparten la herramienta `tools/beats.mjs` y el lint de
// tiempos `checkTiming`. Devuelve { beats, duration }.
function _wordCount(s) { return String(s == null ? '' : s).trim().split(/\s+/).filter(Boolean).length; }
function _sayDur(step) { return Math.max(typeof step.duration === 'number' ? step.duration : 2.2, Math.min(7, 1.2 + 0.4 * _wordCount(step.text))); }
function _resAxis(v, size) {
  if (typeof v === 'number') return v >= 0 && v <= 1 ? v * size : v;
  if (typeof v === 'string') { const m = v.match(/^(left|right|top|bottom|center|middle)([+-]\d+(\.\d+)?)?$/); if (m) { const base = { left: 0, top: 0, center: size / 2, middle: size / 2, right: size, bottom: size }[m[1]] || 0; return base + (m[2] ? parseFloat(m[2]) : 0); } }
  return size / 2;
}
export function simulateScript(config) {
  const script = Array.isArray(config && config.script) ? config.script : null;
  if (!script) return { beats: [], duration: 0 };
  const W = (config.canvas && config.canvas.w) || 800, H = (config.canvas && config.canvas.h) || 450;
  const pos = {}, alpha = {};
  for (const e of config.entities || []) {
    if (!e || !e.id) continue;
    pos[e.id] = { x: _resAxis(e.x, W), y: _resAxis(e.y, H) };
    alpha[e.id] = e._alpha == null ? 1 : e._alpha;
  }
  const beats = [];
  let t = 0, pendingWalk = null;
  for (let i = 0; i < script.length; i++) {
    const s = script[i];
    if (!s || typeof s !== 'object' || Array.isArray(s)) continue;
    const vis = { ...alpha };
    const push = (kind, extra) => beats.push({ t, i, kind, vis, ...(extra || {}) });
    if ('caption' in s && s.caption) push(s.style === 'title' ? 'title' : 'caption', { text: s.caption, dur: Math.min(7, 1.2 + 0.4 * _wordCount(s.caption)) });
    if (s.say != null) push('say', { entity: s.say, text: s.text, dur: _sayDur(s), pos: pos[s.say] ? { x: pos[s.say].x, y: pos[s.say].y } : null });
    if (s.think != null) push('think', { entity: s.think, text: s.text, dur: _sayDur(s), pos: pos[s.think] ? { x: pos[s.think].x, y: pos[s.think].y } : null });
    if (s.focus != null) push('focus', { target: Array.isArray(s.focus) ? null : s.focus, off: s.off === true, text: Array.isArray(s.focus) ? `[${s.focus.join(',')}]` : String(s.focus) });
    if (s.camera && typeof s.camera === 'object') push('camera', { target: typeof s.camera.to === 'string' ? s.camera.to : (typeof s.camera.follow === 'string' ? s.camera.follow : null), text: JSON.stringify(s.camera).slice(0, 40) });
    if (s.chart) push('chart', { text: s.chart });
    if (s.formula) push('formula', { text: s.formula });
    if (s.annotation) push('annotation', { text: s.annotation });
    if (s.diagram) push('diagram', { text: s.diagram });
    if (s.meter) push('meter', { text: s.meter });
    if (s.scene) push('scene', { text: s.scene });
    if (s.music != null) push('music', { text: typeof s.music === 'string' ? s.music : JSON.stringify(s.music) });
    if (s.weather != null) push('weather', { text: String(s.weather) });
    if (s.mood != null) push('mood', { entity: s.mood, text: s.value });
    // Movimiento: recuerda el último walk para estimar el arrive.
    if (s.walk != null && pos[s.walk]) {
      const to = Array.isArray(s.to) ? { x: s.to[0], y: s.to[1] } : (typeof s.to === 'string' && pos[s.to] ? pos[s.to] : null);
      if (to) pendingWalk = { id: s.walk, dist: Math.hypot(to.x - pos[s.walk].x, to.y - pos[s.walk].y), speed: s.speed || 60, to };
    }
    // Visibilidad declarativa.
    if (s.appear != null && alpha[s.appear] != null) alpha[s.appear] = 1;
    if (s.vanish != null && alpha[s.vanish] != null) alpha[s.vanish] = 0;
    if (s.set && typeof s.set === 'object') for (const k of Object.keys(s.set)) { const m = k.match(/^(.+)\._alpha$/); if (m && alpha[m[1]] != null && typeof s.set[k] === 'number') alpha[m[1]] = s.set[k]; }
    // Avance del reloj.
    if (typeof s.wait === 'number') t += s.wait;
    if (s.waitFor === 'arrive' || (typeof s.waitFor === 'string' && s.waitFor.startsWith('arrive'))) {
      if (pendingWalk) { t += pendingWalk.dist / (pendingWalk.speed || 60); pos[pendingWalk.id] = pendingWalk.to; pendingWalk = null; }
      else t += 1.5;
    }
  }
  return { beats, duration: t };
}

// Lints de TIEMPO colgados del reloj `simulateScript` (fallos que "corren" pero
// se ven mal): (1) una caption/título que se reemplaza antes de poder leerse (el
// motor NO le pone piso de lectura como a los globos); (2) un foco o la cámara
// que apunta a una entidad oculta (vanish/_alpha 0) en ese beat: el halo cae
// sobre la nada. Ambos son warnings y conservadores. (El solape de globos NO se
// lintea: el motor ya lo resuelve subiendo el segundo globo en `positionBubbles`,
// así que avisar sería redundante y ruidoso.)
function checkTiming(ctx, config) {
  if (!Array.isArray(config.script) || !config.script.length) return;
  // Si la escena puede mostrar/ocultar entidades por vías que el simulador NO
  // rastrea (hooks, o steps `do`/`call`/`if` en el guion), no se puede confiar
  // en la visibilidad simulada: se omite el lint (2) para no falsear como la
  // escena 11. El lint (1) es puro tiempo y no se ve afectado.
  const visUncertain = Object.values(config.hooks || {}).some(v => typeof v === 'string' && v.trim())
    || config.script.some(s => s && (s.do != null || s.call != null || s.if != null));
  const { beats } = simulateScript(config);
  // (1) Captions/títulos que pasan de largo: el próximo beat del MISMO slot los
  // reemplaza MUY por debajo de lo que toma leerlos. Conservador a propósito
  // (una caption de narración continua se lee más rápido que un globo, y el
  // motor no le pone piso): usa un modelo de lectura realista (~0.5 s + 0.3 s por
  // palabra) y solo avisa cuando el hueco es menos de la MITAD de eso, para no
  // castigar el ritmo rápido deliberado. Es el caso claramente roto (una frase
  // larga que se borra en un instante), no el estilístico.
  for (const slot of ['caption', 'title']) {
    const sb = beats.filter(b => b.kind === slot);
    for (let k = 0; k < sb.length; k++) {
      const b = sb[k], next = sb[k + 1];
      if (!b.text || !next) continue;
      const words = _wordCount(b.text);
      if (words < 4) continue; // 1-3 palabras se leen de un vistazo
      const read = 0.5 + 0.3 * words;
      const gap = next.t - b.t;
      if (gap + 0.05 < read * 0.5) {
        ctx.warn(`script[${b.i}].caption`, `este ${slot === 'title' ? 'título' : 'caption'} (${words} palabras, ~${read.toFixed(1)} s de lectura) se reemplaza a los ${gap.toFixed(1)} s: pasa de largo sin poder leerse. Sube el "wait" antes del próximo ${slot}.`);
      }
    }
  }
  // (2) Foco/cámara sobre una entidad oculta en ese momento.
  if (!visUncertain) for (const b of beats) {
    if ((b.kind !== 'focus' && b.kind !== 'camera') || b.off) continue;
    const id = b.target;
    if (!id || typeof id !== 'string' || b.vis[id] == null) continue; // solo entidades rastreadas
    if (b.vis[id] < 0.05) {
      ctx.warn(`script[${b.i}].${b.kind}`, `${b.kind === 'camera' ? 'la cámara apunta a' : 'el foco cae sobre'} "${id}", que está oculto (vanish/_alpha 0) en t≈${b.t.toFixed(1)} s: ${b.kind === 'camera' ? 'encuadra el vacío' : 'el halo cae sobre la nada'}. Muéstralo (appear) antes o apunta a otra cosa.`);
    }
  }
}
const SET_KEYS = ['id', 'cx', 'cy', 'zoom'];
const CHART_KEYS = ['id', 'type', 'x', 'y', 'w', 'h', 'xDomain', 'yDomain', 'xScale', 'yScale', 'xTicks', 'yTicks', 'xLabel', 'yLabel', 'xFormat', 'yFormat', 'title', 'target', 'panel', 'alpha', 'reveal', 'gap', 'color', 'series', 'values'];
const SERIES_KEYS = ['id', 'color', 'width', 'fill', 'dash', 'dots', 'data', 'fn', 'reveal', 'head'];
const CANVAS_KEYS = ['w', 'h', 'bg', 'ss', 'sky', 'horizon', 'floor', 'safeArea', 'ysort', 'layers'];
const ENTITY_KEYS = ['id', 'type', 'x', 'y', 'name', 'body', 'color2', 'scale', 'hero', 'mood', 'accessory', 'accessoryColor', 'behavior', 'look', 'lookAt', 'health', 'extinguishable', 'extinctionThreshold', 'ageRate', 'maxAge', 'skybound', 'greets', 'sleepable', 'solid', 'stage', 'noShadow'];
const PROP_KEYS = ['type', 'id', 'tag', 'x', 'y', 'scale', 'color', 'color2', 'beakColor', 'interactive', 'solid', 'solidBox', 'z', 'dir', 'state', 'open', 'label', 'light', 'fall', 'w', 'h', 'cols', 'rows', 'disorder', 'homeFrac', 'jitter', 'pose', 'alpha', 'glass', 'wheel', 'face', 'lift', 'seeds', 'eye', 'glow', 'spin', 'wear', 'depth', 'panels', 'crank', 'braid', 'fire', 'live', 'far'];
const LABEL_KEYS = ['id', 'html', 'text', 'x', 'y', 'anchor', 'style', 'hidden'];
const METER_KEYS = ['id', 'label', 'x', 'y', 'w', 'h', 'color', 'max', 'value', 'showValue'];
// Un step puede combinar varias acciones; esto es la unión de claves que
// scripts.js lee de verdad (control + acciones + modificadores).
const STEP_KEYS = [
  'label', 'goto', 'loop', 'end', 'if', 'then', 'else', 'wait', 'waitFor', 'waitUntil',
  'walk', 'to', 'speed', 'path', 'points', 'duration', 'easing', 'curve', 'fromCurrent',
  'stop', 'say', 'think', 'text', 'exclaim', 'surprise', 'wonder', 'mood', 'value',
  'flash', 'reinforce', 'tone', 'dur', 'opts', 'sweep', 'particles', 'floatNumber',
  'celebrate', 'cry', 'thinking', 'jump', 'lookAt', 'appear', 'vanish', 'camera', 'caption', 'meter',
  'tween', 'chart', 'formula', 'annotation', 'diagram', 'show', 'hide', 'alpha', 'series', 'reveal',
  'focus', 'off', 'radius', 'color', 'style', 'scene', 'move', 'weather', 'intensity',
  'showLabel', 'hideLabel', 'music',
  'set', 'add', 'clamp', 'do', 'call', 'runScript', 'runScriptOpts',
];
const STEP_ENTITY_REFS = ['walk', 'stop', 'say', 'think', 'exclaim', 'surprise', 'wonder', 'mood', 'flash', 'reinforce', 'celebrate', 'cry', 'thinking', 'appear', 'vanish', 'jump', 'lookAt'];

const ANCHOR_RE = /^(left|right|center|top|bottom|middle)([+-]\d+(\.\d+)?)?$/;
const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()/;
// Solo las formas voseantes (acentuadas o propias): «observa»/«mira» son neutras y válidas.
const VOSEO_RE = /(?:^|[^\p{L}])(mirá|fijate|podés|tenés|querés|sabés|armás|observá|escuchá|decime|dale|vos|vení|andá|acordate)(?=[^\p{L}]|$)/iu;

const list = (arr) => [...arr].sort().join(', ');

function isCoord(v) {
  if (typeof v === 'number') return v >= 0 || 'las coordenadas negativas no existen (usa anchors tipo "right-20" para medir desde un borde)';
  if (typeof v === 'string') return ANCHOR_RE.test(v) || 'no es un anchor válido (formato: "left+10", "center", "bottom-30")';
  return 'debe ser número (0..1 fracción del canvas, >=1 píxeles) o string anchor ("left+10", "center")';
}

// Resuelve una coordenada de escena (número px, fracción 0..1 o anchor string)
// a píxeles. Devuelve null si no se puede resolver (anchor raro): el caller la
// trata como no rastreable.
function resolveCoord(v, dim) {
  if (typeof v === 'number') return v <= 1 ? v * dim : v;
  if (typeof v === 'string') {
    const m = v.match(/^(left|right|center|top|bottom|middle)([+-]\d+(?:\.\d+)?)?$/);
    if (!m) return null;
    const off = m[2] ? parseFloat(m[2]) : 0;
    if (m[1] === 'left' || m[1] === 'top') return off;
    if (m[1] === 'right' || m[1] === 'bottom') return dim + off;
    return dim / 2 + off;   // center / middle
  }
  return null;
}

// Distancia de un punto a un segmento (para saber si una ruta de caminata pasa
// por encima de un cuerpo quieto).
function distPointSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const L2 = dx * dx + dy * dy;
  let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Radio aproximado del cuerpo de un aprendiz, derivado de su escala (un hero a
// scale 5 mide ~55 px de alto, ~27 de medio-ancho).
function learnerRadius(e) {
  return (typeof e.scale === 'number' ? e.scale : 4) * 5.2;
}

// Rastrea las posiciones de las entidades a lo largo del guion lineal y avisa
// cuando un step "walk" haría que el caminante atraviese a otro cuerpo (sus
// siluetas se solapan), o cuando dos entidades arrancan encimadas. Es una
// heurística de autoría: sigue el guion top-level (no ramas if/runScript) y no
// puede seguir posiciones que cambie un "do" en JS. No toca la física.
function checkMovement(ctx, config) {
  const ents = (config.entities || []).filter(e => e && e.id);
  if (ents.length < 2) return;
  const W = (config.canvas && typeof config.canvas.w === 'number') ? config.canvas.w : 720;
  const H = (config.canvas && typeof config.canvas.h === 'number') ? config.canvas.h : 400;
  const pos = new Map();
  for (const e of ents) {
    const x = resolveCoord(e.x == null ? 0.5 : e.x, W);
    const y = resolveCoord(e.y == null ? 0.5 : e.y, H);
    if (x == null || y == null) continue;        // no rastreable
    pos.set(e.id, { x, y, r: learnerRadius(e), invisible: e._alpha === 0 });
  }
  // Solape al arrancar (dos cuerpos visibles en el mismo punto).
  const ids = [...pos.keys()];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = pos.get(ids[i]), b = pos.get(ids[j]);
      if (a.invisible || b.invisible) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) < (a.r + b.r) * 0.8) {
        ctx.warn('entities', `"${ids[i]}" y "${ids[j]}" arrancan encimados (sus cuerpos se solapan en su posición inicial). Sepáralos para que no se monten.`);
      }
    }
  }
  const steps = Array.isArray(config.script) ? config.script : null;
  if (!steps) return;
  const segCheck = (moverId, from, to, targetId, path) => {
    for (const [id, p] of pos) {
      if (id === moverId || id === targetId || p.invisible) continue;
      const d = distPointSegment(p.x, p.y, from.x, from.y, to.x, to.y);
      if (d < (p.r + from.r) * 0.9) {
        ctx.warn(path, `la caminata de "${moverId}" pasa por encima de "${id}" (los cuerpos se solapan en el trayecto). Reubica el destino, el origen o a "${id}", o haz que "${id}" se aparte antes con su propio walk.`);
      }
    }
  };
  steps.forEach((s, i) => {
    if (!s || typeof s !== 'object') return;
    if (s.walk != null && pos.has(s.walk)) {
      const from = pos.get(s.walk);
      let to = null, targetId = null;
      if (Array.isArray(s.to)) {
        const x = resolveCoord(s.to[0], W), y = resolveCoord(s.to[1], H);
        if (x != null && y != null) to = { x, y };
      } else if (typeof s.to === 'string' && pos.has(s.to)) {
        const tp = pos.get(s.to); to = { x: tp.x, y: tp.y }; targetId = s.to;
      } else if (s.to && typeof s.to === 'object') {
        const x = resolveCoord(s.to.x, W), y = resolveCoord(s.to.y, H);
        if (x != null && y != null) to = { x, y };
      }
      if (to) { segCheck(s.walk, from, to, targetId, `script[${i}].walk`); from.invisible = false; pos.set(s.walk, { x: to.x, y: to.y, r: from.r, invisible: false }); }
    }
    if (s.path != null && pos.has(s.path) && Array.isArray(s.points) && s.points.length) {
      let from = pos.get(s.path);
      s.points.forEach((pt, k) => {
        const x = resolveCoord(Array.isArray(pt) ? pt[0] : pt.x, W);
        const y = resolveCoord(Array.isArray(pt) ? pt[1] : pt.y, H);
        if (x == null || y == null) return;
        segCheck(s.path, from, { x, y }, null, `script[${i}].path`);
        from = { x, y, r: from.r, invisible: false };
      });
      pos.set(s.path, from);
    }
    if (s.appear != null && pos.has(s.appear)) pos.get(s.appear).invisible = false;
    if (s.vanish != null && pos.has(s.vanish)) pos.get(s.vanish).invisible = true;
    if (s.scene != null && s.move && typeof s.move === 'object') {
      for (const [mid, p] of Object.entries(s.move)) {
        if (pos.has(mid) && Array.isArray(p) && p.length === 2) {
          const x = resolveCoord(p[0], W), y = resolveCoord(p[1], H);
          if (x != null && y != null) { const cur = pos.get(mid); pos.set(mid, { x, y, r: cur.r, invisible: cur.invisible }); }
        }
      }
    }
  });
}

// Alcanzabilidad de walk/path: los clamps del motor (banda de subtítulos y
// horizonte) retienen al learner por debajo/encima de una línea; un destino más
// allá de esa línea NUNCA se alcanza (el umbral de arribo es 4 px), y un
// `waitFor: "arrive"` sobre él CUELGA el guion para siempre, sin error de
// runtime. También caza un path con loop (que nunca termina) esperado por
// arrive, y un `arrive:<id>` huérfano que no espera a nada. Estático y lineal:
// sigue el guion top-level, no ramas ni cambios por `do`. Números en sintonía
// con learner.js (CAPTION_BAND 56, NAME_RESERVE 20, umbral de arribo 4).
function checkReachability(ctx, config) {
  const steps = Array.isArray(config.script) ? config.script : null;
  if (!steps) return;
  const c = config.canvas || {};
  const H = typeof c.h === 'number' ? c.h : 400;
  const hasSky = c.sky != null;
  const horizonY = Math.round(H * (typeof c.horizon === 'number' ? c.horizon : 0.45));
  const footBand = H - 56 - 20;              // CAPTION_BAND + NAME_RESERVE
  const ARRIVE = 4;                          // stopAt default del walkTo (learner.js)
  const hasHooks = Object.values(config.hooks || {}).some(v => typeof v === 'string' && v.trim());
  const ents = new Map();
  for (const e of (config.entities || [])) {
    if (!e || !e.id) continue;
    const half = ((e.hero !== false ? 11 : 7) * (typeof e.scale === 'number' ? e.scale : 4)) / 2;
    ents.set(e.id, { yMax: footBand - half, yMin: (hasSky && e.skybound !== true) ? horizonY : 0 });
  }
  // Razón por la que una `y` destino es inalcanzable para una entidad (o null).
  const yReason = (info, y) => {
    if (y == null) return null;
    if (y > info.yMax + ARRIVE) return `su y=${Math.round(y)} cae bajo la banda de subtítulos (el motor lo clampa a y=${Math.round(info.yMax)} y el arribo, umbral ${ARRIVE}px, nunca ocurre). Baja el destino a y<=${Math.round(info.yMax)}`;
    if (info.yMin && y < info.yMin - ARRIVE) return `su y=${Math.round(y)} queda sobre el horizonte (el motor lo clampa a y=${info.yMin}). Marca la entidad "skybound": true o baja el destino a y>=${info.yMin}`;
    return null;
  };
  const lastMove = new Map();   // id -> { reason, loop, stepIdx }
  let lastMover = null;
  steps.forEach((s, i) => {
    if (!s || typeof s !== 'object') return;
    if (s.walk != null && ents.has(s.walk)) {
      const info = ents.get(s.walk);
      const t = s.to;
      let ty = null;
      if (Array.isArray(t)) ty = resolveCoord(t[1], H);
      else if (t && typeof t === 'object' && !Array.isArray(t)) ty = resolveCoord(t.y, H);
      // destino = otra entidad (string): su posición ya está clampeada → alcanzable; no se evalúa.
      const reason = yReason(info, ty);
      lastMove.set(s.walk, { reason, loop: false, kind: 'walk', stepIdx: i });
      lastMover = s.walk;
      if (reason) ctx.warn(`script[${i}].to`, `"${s.walk}" camina a un destino inalcanzable: ${reason}. Aunque no cuelgue el guion, el personaje no llega adonde lo mandas.`);
    }
    if (s.path != null && ents.has(s.path) && Array.isArray(s.points) && s.points.length) {
      const info = ents.get(s.path);
      const last = s.points[s.points.length - 1];
      const ly = resolveCoord(Array.isArray(last) ? last[1] : (last && last.y), H);
      const reason = yReason(info, ly);
      lastMove.set(s.path, { reason, loop: s.loop === true, kind: 'path', stepIdx: i });
      lastMover = s.path;
      // Un `path` (followPath) llega por DISTANCIA recorrida, no por proximidad
      // (learner.js: `_dist += speed*dt` hasta `>= _total`), así que SIEMPRE
      // completa aunque el clamp impida tocar el waypoint: no cuelga. Solo es
      // aviso visual (no llega adonde apuntas); el cuelgue real es el loop.
      if (reason) ctx.warn(`script[${i}].points`, `el path de "${s.path}" termina en un punto inalcanzable: ${reason}. El personaje no llega ahí (aunque el path completa igual, no cuelga).`);
    }
    const wf = s.waitFor;
    if (wf === 'arrive' || (typeof wf === 'string' && wf.startsWith('arrive:'))) {
      const target = wf === 'arrive' ? lastMover : wf.slice(7);
      if (!target) return;
      const mv = lastMove.get(target);
      if (!mv) {
        if (wf !== 'arrive' && ents.has(target)) {
          ctx.warn(`script[${i}].waitFor`, `"arrive:${target}" pero "${target}" no tiene ningún walk/path antes en el guion: no espera a nada (resuelve al instante). ¿Querías esperar a otra entidad, o mover a "${target}" primero?`);
        }
        return;
      }
      // Cuelga SOLO si: (a) un path con loop:true (nunca termina), o (b) un
      // `walk` (walkTo, llegada por proximidad d<4px) a un destino inalcanzable.
      // Un `path` no-loop a un punto inalcanzable NO cuelga (completa por
      // distancia): ese caso quedó en el aviso visual de arriba, no en ERROR.
      const hangs = mv.loop || (mv.reason && mv.kind === 'walk');
      if (hangs) {
        const why = mv.loop
          ? `su path (script[${mv.stepIdx}]) tiene "loop": true y nunca termina`
          : `su destino es inalcanzable (${mv.reason})`;
        const msg = `CUELGA la escena: "waitFor: ${wf}" espera a que "${target}" llegue, pero ${why}. El arribo nunca ocurre y el guion se congela para siempre (nunca aparece "Ver nuevamente"). Corrige el walk/path de "${target}" (script[${mv.stepIdx}]) o quita el waitFor.`;
        if (hasHooks) ctx.warn(`script[${i}].waitFor`, msg + ' (La escena tiene hooks: si un `do` reubica a la entidad o el destino en runtime, ignora esto.)');
        else ctx.err(`script[${i}].waitFor`, msg);
      }
    }
  });
}

// Ids duplicados: byId (y todos los steps que resuelven por id) devuelven el
// PRIMERO, así que un segundo objeto con el mismo id queda indirigible sin
// aviso: los walk/say/tween/focus dirigen siempre al primero. Chequea unicidad
// dentro de cada colección, y avisa si un id de prop pisa uno de entidad.
function checkDuplicateIds(ctx, config) {
  const scan = (arr, label, hasId) => {
    const seen = new Map();
    (arr || []).forEach((o, i) => {
      const id = o && o.id;
      if (id == null) return;
      if (seen.has(id)) {
        ctx.err(`${label}[${i}].id`, `"${id}" ya está declarado en ${label}[${seen.get(id)}]: los steps (walk/say/tween/focus...) siempre dirigen al primero y este queda indirigible y quieto. Dale un id único.`);
      } else seen.set(id, i);
    });
    return seen;
  };
  const entIds = scan(config.entities, 'entities');
  const propIds = scan(config.props, 'props');
  const chartIds = scan(config.charts, 'charts');
  scan(config.labels, 'labels');
  scan(config.meters, 'meters');
  scan(config.formulas, 'formulas');
  scan(config.annotations, 'annotations');
  scan(config.diagrams, 'diagrams');
  // series por chart
  (config.charts || []).forEach((c, i) => {
    if (c && Array.isArray(c.series)) scan(c.series, `charts[${i}].series`);
  });
  // Colisiones ENTRE colecciones que comparten el namespace de resolución de
  // focus/camera/tween/path: la precedencia es entidad > prop > chart (byId
  // busca entidades primero; focus/camera resuelven entidad, luego prop, luego
  // chart). Un id que coincide entre dos deja al de menor precedencia
  // indirigible (p. ej. el push-in sobre un chart homónimo de una entidad nunca
  // ocurre). Aviso, no error: puede ser coincidencia inofensiva si nunca se
  // referencia por id.
  const order = [['entities', entIds], ['props', propIds], ['charts', chartIds]];
  for (let a = 0; a < order.length; a++) {
    for (let b = a + 1; b < order.length; b++) {
      const [laA, mapA] = order[a], [laB, mapB] = order[b];
      for (const [id, iB] of mapB) {
        if (mapA.has(id)) {
          ctx.warn(`${laB}[${iB}].id`, `"${id}" coincide con el id de ${laA}[${mapA.get(id)}]: focus/camera/tween/byId resuelven ${laA} antes que ${laB}, así que una referencia a "${id}" apuntará a ${laA.slice(0, -1)}, no a este ${laB.slice(0, -1)}. Usa ids distintos.`);
        }
      }
    }
  }
}

function checkTextStyle(ctx, path, value) {
  if (typeof value !== 'string') return;
  if (value.includes('—')) {
    ctx.err(path, 'contiene un em-dash (—). Regla del proyecto: comas, dos puntos o paréntesis; guiones solo para rangos.');
  }
  const m = value.match(VOSEO_RE);
  if (m) ctx.warn(path, `posible voseo («${m[1]}»). La voz del proyecto es español neutro: «mira», «puedes», «fíjate».`);
  if (/[¡!]/.test(value)) {
    ctx.warn(path, 'tiene signos de exclamación (¡ !). La voz del proyecto es sobria: reemplázalos por punto o coma. Para marcar sorpresa usa el paso "exclaim" o un "mood" (shocked, surprise), no el texto.');
  }
}

function compiles(ctx, path, args, code) {
  try { new Function(...args, code); }
  catch (e) { ctx.err(path, `el código JS no compila: ${e.message}`); }
}

// Crea un validador ligado a un vocabulario (ver buildVocab).
export function createValidator(vocab) {
  const {
    PROP_KINDS, SKY_KINDS, FLOOR_KINDS, MOOD_KINDS, ACCESSORY_KINDS,
    PARTICLE_KINDS, BEHAVIOR_TYPES, EASING_KINDS, SOUND_KINDS, MUSIC_MOODS, TINT_PRESETS,
    PARTICLE_PRESETS,
  } = vocab;

  function vMeta(ctx, meta) {
    if (!meta || typeof meta !== 'object') return ctx.err('meta', 'falta el objeto meta (al menos { "id": "NN-slug" }).');
    if (!meta.id || typeof meta.id !== 'string') ctx.err('meta.id', 'falta o no es string. Es el identificador único de la escena (ej. "07-dia-d").');
    if (meta.music != null && !MUSIC_MOODS.includes(meta.music)) {
      ctx.err('meta.music', `"${meta.music}" no es un mood de música. Usa uno de: ${list(MUSIC_MOODS)}.`);
    }
    if (meta.lang != null && !Array.isArray(meta.lang)) ctx.err('meta.lang', 'debe ser un array de códigos de idioma (ej. ["es"]).');
  }

  function vCanvas(ctx, c) {
    if (!c || typeof c !== 'object') return ctx.err('canvas', 'falta el objeto canvas (al menos { "w": 800, "h": 450 }).');
    for (const k of Object.keys(c)) {
      if (!CANVAS_KEYS.includes(k)) {
        if (TOP_KEYS.includes(k)) ctx.err(`canvas.${k}`, `"${k}" va al NIVEL SUPERIOR del JSON (hermano de "canvas"), no dentro de canvas. Sácalo de canvas y ponlo al mismo nivel.`);
        else ctx.err(`canvas.${k}`, `clave desconocida. Válidas: ${list(CANVAS_KEYS)}.`);
      }
    }
    for (const k of ['w', 'h']) {
      if (c[k] != null && (typeof c[k] !== 'number' || c[k] < 100)) ctx.err(`canvas.${k}`, 'debe ser un número en píxeles (>= 100).');
    }
    if (c.sky != null && !SKY_KINDS.includes(c.sky) && !COLOR_RE.test(c.sky)) {
      ctx.err('canvas.sky', `"${c.sky}" no es un preset de cielo ni un color CSS. Presets: ${list(SKY_KINDS)}.`);
    }
    if (c.sky != null && c.horizon == null) {
      ctx.warn('canvas.horizon', 'hay cielo pero no horizonte explícito (default 0.45). Regla: las escenas outdoor declaran canvas.sky y canvas.horizon.');
    }
    if (c.horizon != null && (typeof c.horizon !== 'number' || c.horizon < 0 || c.horizon > 1)) {
      ctx.err('canvas.horizon', 'debe ser una fracción 0..1 de la altura del canvas.');
    }
    if (c.floor != null && !FLOOR_KINDS.includes(c.floor)) {
      ctx.err('canvas.floor', `"${c.floor}" no es un piso válido. Usa uno de: ${list(FLOOR_KINDS)}.`);
    }
    if (c.ss != null && (typeof c.ss !== 'number' || c.ss < 1 || c.ss > 4)) {
      ctx.err('canvas.ss', 'el supersampling debe ser un número entre 1 y 4 (default 3).');
    }
    if (c.layers != null && !Array.isArray(c.layers)) ctx.err('canvas.layers', 'debe ser un array de capas de parallax.');
  }

  function vEntity(ctx, e, i) {
    const p = `entities[${i}]`;
    if (!e || typeof e !== 'object') return ctx.err(p, 'cada entidad debe ser un objeto.');
    if (e.type !== 'learner') ctx.err(`${p}.type`, `"${e.type}" no es un tipo de entidad. El único tipo es "learner".`);
    if (e.color != null) ctx.err(`${p}.color`, 'la clave del color del cuerpo es "body", no "color".');
    for (const k of Object.keys(e)) {
      if (!ENTITY_KEYS.includes(k) && !k.startsWith('_') && k !== 'color') {
        ctx.warn(`${p}.${k}`, `clave desconocida (el motor la ignora salvo que un hook la lea). Conocidas: ${list(ENTITY_KEYS)}; las claves _privadas son estado libre para hooks.`);
      }
    }
    for (const k of ['x', 'y']) {
      if (e[k] != null) { const r = isCoord(e[k]); if (r !== true) ctx.err(`${p}.${k}`, r); }
    }
    if (e.look === 'blank') ctx.err(`${p}.look`, 'look "blank" está prohibido: los aprendices siempre tienen pupilas. Quita la clave o pasa un vector de mirada en onDraw.');
    if (e.mood != null && !MOOD_KINDS.includes(e.mood)) {
      ctx.err(`${p}.mood`, `"${e.mood}" no es un mood. Usa uno de: ${list(MOOD_KINDS)}.`);
    }
    const accs = e.accessory == null ? [] : Array.isArray(e.accessory) ? e.accessory : [e.accessory];
    for (const a of accs) {
      if (!ACCESSORY_KINDS.includes(a)) ctx.err(`${p}.accessory`, `"${a}" no es un accesorio. Usa uno de: ${list(ACCESSORY_KINDS)}.`);
    }
    if (e.health != null && !HEALTH_KINDS.includes(e.health)) {
      ctx.warn(`${p}.health`, `"${e.health}" no es un estado de salud conocido (${list(HEALTH_KINDS)}).`);
    }
    if (e.body != null && !COLOR_RE.test(e.body)) ctx.warn(`${p}.body`, `"${e.body}" no parece un color CSS.`);
    if (e.stage != null && (typeof e.stage !== 'number' || e.stage < 0 || e.stage > 4)) {
      ctx.warn(`${p}.stage`, 'stage es un número 0..4 (halos concéntricos).');
    }
    if (e.behavior != null) vBehavior(ctx, e.behavior, `${p}.behavior`);
    checkTextStyle(ctx, `${p}.name`, e.name);
  }

  function vBehavior(ctx, b, p) {
    if (typeof b !== 'object') return ctx.err(p, 'behavior debe ser un objeto { "type": ... }.');
    if (!BEHAVIOR_TYPES.includes(b.type)) {
      return ctx.err(`${p}.type`, `"${b.type}" no es un behavior. Usa uno de: ${list(BEHAVIOR_TYPES)}.`);
    }
    if (b.type === 'walkTo' && b.target == null) ctx.err(p, 'walkTo necesita "target": {x, y}.');
    if (b.type === 'followPath' && (!Array.isArray(b.points) || !b.points.length)) ctx.err(p, 'followPath necesita "points": array de {x,y} o [x,y].');
    if (b.type === 'patrolBetween' && (!Array.isArray(b.points) || b.points.length < 2)) ctx.err(p, 'patrolBetween necesita "points" con al menos 2 puntos.');
    if ((b.type === 'fleeFrom' && b.source == null) || (b.type === 'followEntity' && b.target == null)) {
      ctx.err(p, `${b.type} necesita ${b.type === 'fleeFrom' ? '"source"' : '"target"'}.`);
    }
    if (b.easing != null && !EASING_KINDS.includes(b.easing)) ctx.err(`${p}.easing`, `"${b.easing}" no es un easing. Usa uno de: ${list(EASING_KINDS)}.`);
  }

  function vProp(ctx, pr, i, env) {
    const p = `props[${i}]`;
    if (!pr || typeof pr !== 'object') return ctx.err(p, 'cada prop debe ser un objeto.');
    if (pr.type == null) return ctx.err(`${p}.type`, 'falta el tipo del prop.');
    if (!PROP_KINDS.has(pr.type)) {
      ctx.err(`${p}.type`, `"${pr.type}" no es un prop del motor. Usa uno de: ${list(PROP_KINDS)}.`);
    }
    // El (x,y) de un prop es su BASE (anclado abajo-centro). Un prop de suelo
    // con y muy arriba queda flotando. Solo se chequea en escenas declarativas
    // (sin hooks): las de autor componen alturas a propósito.
    if (env && env.declarative && env.h && FLOOR_PROPS.has(pr.type) && typeof pr.y === 'number') {
      const py = pr.y <= 1 ? pr.y * env.h : pr.y;
      if (py < env.h * 0.55) {
        ctx.warn(`${p}.y`, `"${pr.type}" es un objeto de suelo y su (x, y) es la base del sprite: con y=${pr.y} queda flotando. Usa una y entre ${Math.round(env.h * 0.72)} y ${Math.round(env.h * 0.82)} para que se apoye en el piso.`);
      }
    }
    for (const k of Object.keys(pr)) {
      if (!PROP_KEYS.includes(k) && !k.startsWith('_')) {
        ctx.warn(`${p}.${k}`, `clave desconocida (el motor la ignora salvo que un hook la lea). Conocidas: ${list(PROP_KEYS)}.`);
      }
    }
    for (const k of ['x', 'y']) {
      if (pr[k] != null) { const r = isCoord(pr[k]); if (r !== true) ctx.err(`${p}.${k}`, r); }
    }
    for (const k of ['color', 'color2', 'beakColor']) {
      if (pr[k] != null && !COLOR_RE.test(pr[k])) ctx.warn(`${p}.${k}`, `"${pr[k]}" no parece un color CSS.`);
    }
    if (pr.light != null && pr.light !== false && pr.light !== true) {
      if (typeof pr.light !== 'object') {
        ctx.err(`${p}.light`, 'light es true/false o un objeto { "radius": px, "strength": 0..1 }.');
      } else {
        if (pr.light.radius != null && (typeof pr.light.radius !== 'number' || pr.light.radius <= 0)) {
          ctx.err(`${p}.light.radius`, 'radius es el alcance del haz en píxeles (número positivo).');
        }
        if (pr.light.strength != null && (typeof pr.light.strength !== 'number' || pr.light.strength < 0 || pr.light.strength > 1)) {
          ctx.err(`${p}.light.strength`, 'strength es la intensidad de la luz, un número 0..1.');
        }
      }
    }
  }

  function vLabel(ctx, l, i) {
    const p = `labels[${i}]`;
    if (!l || typeof l !== 'object') return ctx.err(p, 'cada label debe ser un objeto.');
    if (!l.id) ctx.err(`${p}.id`, 'falta el id (necesario para show/hide/setLabel desde hooks o scripts).');
    for (const k of Object.keys(l)) {
      if (!LABEL_KEYS.includes(k)) ctx.warn(`${p}.${k}`, `clave desconocida. Conocidas: ${list(LABEL_KEYS)}.`);
    }
    for (const k of ['x', 'y']) {
      const v = l[k];
      if (v == null) continue;
      if (typeof v !== 'number' || v < 0 || v > 1) {
        ctx.err(`${p}.${k}`, `los labels SOLO aceptan fracción 0..1 (encontré ${JSON.stringify(v)}). El motor hace x*100 y lo aplica como left:N%; un valor en píxeles queda fuera de pantalla. Divide por canvas.w / canvas.h.`);
      }
    }
    if (l.anchor != null && !LABEL_ANCHORS.includes(l.anchor)) {
      ctx.err(`${p}.anchor`, `"${l.anchor}" no es un anchor de label. Usa uno de: ${list(LABEL_ANCHORS)}.`);
    }
  }

  function vRect(ctx, r, p) {
    if (!r || typeof r !== 'object') return ctx.err(p, 'debe ser un objeto {x, y, w, h}.');
    for (const k of ['x', 'y', 'w', 'h']) {
      if (r[k] == null) ctx.err(`${p}.${k}`, 'falta (x, y, w, h son obligatorios).');
      else { const ok = isCoord(r[k]); if (ok !== true) ctx.err(`${p}.${k}`, ok); }
    }
  }

  function vZone(ctx, z, i) {
    const p = `zones[${i}]`;
    vRect(ctx, z, p);
    if (z && z.effect != null) {
      if (typeof z.effect !== 'object') return ctx.err(`${p}.effect`, 'debe ser un objeto.');
      for (const k of Object.keys(z.effect)) {
        if (!ZONE_EFFECTS.includes(k)) ctx.warn(`${p}.effect.${k}`, `efecto desconocido. Conocidos: ${list(ZONE_EFFECTS)}.`);
      }
      if (z.effect.mood != null && !MOOD_KINDS.includes(z.effect.mood)) {
        ctx.err(`${p}.effect.mood`, `"${z.effect.mood}" no es un mood. Usa uno de: ${list(MOOD_KINDS)}.`);
      }
    }
    if (z) checkTextStyle(ctx, `${p}.label`, z.label);
  }

  function vAmbient(ctx, a) {
    if (typeof a !== 'object') return ctx.err('ambient', 'debe ser un objeto.');
    if (a.darkness != null && (typeof a.darkness !== 'number' || a.darkness < 0 || a.darkness > 1)) {
      ctx.err('ambient.darkness', 'la oscuridad es un número 0..1 (0 = día pleno, ~0.6 = noche con luces).');
    }
    if (a.darknessColor != null && !/^#/.test(a.darknessColor)) {
      ctx.err('ambient.darknessColor', `"${a.darknessColor}" debe ser hex (#rrggbb): el motor degrada su alpha para el scrim de noche.`);
    }
    if (a.saturation != null && (typeof a.saturation !== 'number' || a.saturation < 0 || a.saturation > 1)) {
      ctx.err('ambient.saturation', 'la saturación es un número 0..1 (0 = escala de grises, 1 = color pleno). Se anima con tween "ambient.saturation".');
    }
    if (a.particles != null && !PARTICLE_KINDS.includes(a.particles)) {
      ctx.err('ambient.particles', `"${a.particles}" no es un tipo de partícula. Usa uno de: ${list(PARTICLE_KINDS)}.`);
    }
    const sounds = a.sound == null ? [] : Array.isArray(a.sound) ? a.sound : [a.sound];
    for (const s of sounds) {
      if (!SOUND_KINDS.includes(s)) ctx.err('ambient.sound', `"${s}" no es un sonido ambiente. Usa uno de: ${list(SOUND_KINDS)}.`);
    }
    const checkTint = (t, p) => {
      if (typeof t === 'string' && !TINT_PRESETS.includes(t)) {
        ctx.err(p, `"${t}" no es un preset de tint. Usa uno de: ${list(TINT_PRESETS)}, o un objeto {color, alpha}.`);
      }
      if (t && typeof t === 'object' && !Array.isArray(t)) {
        if (t.preset != null && !TINT_PRESETS.includes(t.preset)) ctx.err(`${p}.preset`, `"${t.preset}" no es un preset de tint (${list(TINT_PRESETS)}).`);
        if (t.preset == null && t.color == null) ctx.err(p, 'un tint objeto necesita "color" (o "preset").');
      }
    };
    if (Array.isArray(a.tint)) {
      a.tint.forEach((f, i) => {
        if (f.t == null) ctx.err(`ambient.tint[${i}].t`, 'cada keyframe necesita su tiempo "t" en segundos.');
        checkTint(f, `ambient.tint[${i}]`);
      });
    } else if (a.tint != null) checkTint(a.tint, 'ambient.tint');
  }

  function vHooks(ctx, hooks) {
    if (typeof hooks !== 'object') return ctx.err('hooks', 'debe ser un objeto de strings JS.');
    for (const [k, v] of Object.entries(hooks)) {
      if (!HOOK_NAMES.includes(k)) {
        ctx.err(`hooks.${k}`, `hook desconocido. Válidos: ${list(HOOK_NAMES)}.`);
        continue;
      }
      if (typeof v !== 'string') { ctx.err(`hooks.${k}`, 'cada hook es un string de código JS.'); continue; }
      if (v.trim()) compiles(ctx, `hooks.${k}`, HOOK_ARGS[k], v);
    }
  }

  function vChart(ctx, c, i) {
    const p = `charts[${i}]`;
    if (!c || typeof c !== 'object') return ctx.err(p, 'cada chart debe ser un objeto.');
    if (!c.id) ctx.err(`${p}.id`, 'falta el id (el step "chart" lo necesita para mostrarlo y revelarlo).');
    const type = c.type ?? 'line';
    if (type !== 'line' && type !== 'bars') ctx.err(`${p}.type`, `"${c.type}" no es un tipo de chart. Usa "line" o "bars".`);
    for (const k of Object.keys(c)) {
      if (!CHART_KEYS.includes(k)) ctx.warn(`${p}.${k}`, `clave desconocida. Conocidas: ${list(CHART_KEYS)}.`);
    }
    for (const k of ['xDomain', 'yDomain']) {
      if (c[k] != null && (!Array.isArray(c[k]) || c[k].length !== 2 || c[k].some(n => typeof n !== 'number'))) {
        ctx.err(`${p}.${k}`, `${k} es [min, max] numérico.`);
      }
    }
    for (const k of ['xScale', 'yScale']) {
      if (c[k] != null && c[k] !== 'log' && c[k] !== 'linear') ctx.err(`${p}.${k}`, `${k} es "log" (para fenómenos exponenciales) o "linear" (default).`);
    }
    if (c.xScale === 'log' && Array.isArray(c.xDomain) && typeof c.xDomain[0] === 'number' && c.xDomain[0] <= 0) ctx.err(`${p}.xDomain`, 'con xScale "log" el dominio debe ser > 0 (el log de 0 o negativo no existe). Usa un mínimo positivo, ej. [1, 1000].');
    if (c.yScale === 'log' && Array.isArray(c.yDomain) && typeof c.yDomain[0] === 'number' && c.yDomain[0] <= 0) ctx.err(`${p}.yDomain`, 'con yScale "log" el dominio debe ser > 0. Usa un mínimo positivo, ej. [1, 1000000].');
    if (c.target != null) {
      if (typeof c.target !== 'object' || typeof c.target.y !== 'number') {
        ctx.err(`${p}.target`, 'target es { "y": <número>, "label": "..." } (línea de meta punteada).');
      } else checkTextStyle(ctx, `${p}.target.label`, c.target.label);
    }
    if (type === 'line') {
      if (!Array.isArray(c.series) || !c.series.length) {
        ctx.err(`${p}.series`, 'un chart "line" necesita "series": array de { id, data, ... }.');
      } else c.series.forEach((sr, j) => {
        const sp = `${p}.series[${j}]`;
        if (!sr || typeof sr !== 'object') return ctx.err(sp, 'cada serie es un objeto.');
        if (!sr.id) ctx.err(`${sp}.id`, 'falta el id de la serie (el step "chart" lo usa para revelarla).');
        for (const k of Object.keys(sr)) {
          if (!SERIES_KEYS.includes(k)) ctx.warn(`${sp}.${k}`, `clave desconocida. Conocidas: ${list(SERIES_KEYS)}.`);
        }
        // Una serie se declara con `data` (puntos) O `fn` (expresión en x).
        if (typeof sr.fn === 'string' && sr.fn.trim()) {
          compiles(ctx, `${sp}.fn`, ['x'], 'return (' + sr.fn + ');');
        } else if (!Array.isArray(sr.data) || !sr.data.length || sr.data.some(pt => !Array.isArray(pt) || pt.length !== 2 || pt.some(n => typeof n !== 'number'))) {
          ctx.err(`${sp}.data`, 'data es un array de puntos [x, y] numéricos (ej. [[2006, 0], [2007, 5]]), o declara la serie como función con "fn": "exp(0.8*x)" (se muestrea sobre el xDomain).');
        }
        if (sr.head != null && sr.head !== true && (typeof sr.head !== 'object' || Array.isArray(sr.head))) {
          ctx.err(`${sp}.head`, 'head es true (punto viajero por defecto) o un objeto { r, color, pulse, guides, label }.');
        }
      });
    } else if (type === 'bars') {
      if (!Array.isArray(c.values) || !c.values.length) {
        ctx.err(`${p}.values`, 'un chart "bars" necesita "values": array de { "label": "...", "value": <número> }.');
      } else c.values.forEach((v, j) => {
        if (!v || typeof v.value !== 'number') ctx.err(`${p}.values[${j}]`, 'cada barra es { "label": "...", "value": <número> } (value numérico).');
        else checkTextStyle(ctx, `${p}.values[${j}].label`, v.label);
      });
    }
    checkTextStyle(ctx, `${p}.title`, c.title);
    checkTextStyle(ctx, `${p}.xLabel`, c.xLabel);
    checkTextStyle(ctx, `${p}.yLabel`, c.yLabel);
    // Cruce datos vs dominios: lo que el validador no atrapaba y CLAUDE.md marca
    // en el checklist ("ajusta yDomain a los datos o la curva queda aplastada y
    // la target inalcanzable"). El motor cae a [0,1] cuando falta el dominio
    // (world.js), así que un dominio AUSENTE se trata como [0,1] efectivo para
    // los chequeos de fuera-de-rango (datos fuera de [0,1] sin declararlo se
    // dibujan fuera del marco). La "curva aplastada" solo se avisa con yDomain
    // DECLARADO (con default [0,1] podría ser una escala intencional). Warnings.
    const okDom = (d) => Array.isArray(d) && d.length === 2 && d.every(n => typeof n === 'number') && d[1] > d[0];
    const yDdecl = okDom(c.yDomain) ? c.yDomain : null;   // declarado y válido
    const xD = okDom(c.xDomain) ? c.xDomain : [0, 1];      // efectivo (default del motor)
    const yD = yDdecl || [0, 1];
    const dtxt = (dcl) => dcl ? '' : ' (no lo declaraste: el motor usa [0, 1] por defecto)';
    if (type === 'line' && Array.isArray(c.series)) {
      let ymin = Infinity, ymax = -Infinity, flaggedOut = false;
      for (const sr of c.series) {
        if (!sr || !Array.isArray(sr.data)) continue;
        for (const pt of sr.data) {
          if (!Array.isArray(pt) || pt.length !== 2 || typeof pt[1] !== 'number') continue;
          const [x, y] = pt;
          ymin = Math.min(ymin, y); ymax = Math.max(ymax, y);
          if (!flaggedOut && typeof x === 'number' && (x < xD[0] || x > xD[1])) {
            ctx.warn(`${p}.series`, `un punto [${x}, ${y}] cae fuera de xDomain [${xD[0]}, ${xD[1]}]${dtxt(okDom(c.xDomain))}: se dibuja fuera del marco. Declara/amplía xDomain para incluir todos los datos.`); flaggedOut = true;
          }
          if (!flaggedOut && (y < yD[0] || y > yD[1])) {
            ctx.warn(`${p}.series`, `un punto [${x}, ${y}] cae fuera de yDomain [${yD[0]}, ${yD[1]}]${dtxt(yDdecl)}: se dibuja fuera del marco. Declara/amplía yDomain (~[${Math.floor(Math.min(0, ymin))}, ${Math.ceil(ymax)}]).`); flaggedOut = true;
          }
        }
      }
      // La "curva aplastada" no aplica con yScale log (comprimir es el punto).
      if (!flaggedOut && yDdecl && c.yScale !== 'log' && isFinite(ymin) && isFinite(ymax)) {
        const frac = (ymax - ymin) / (yDdecl[1] - yDdecl[0]);
        if (frac < 0.15) {
          ctx.warn(`${p}.yDomain`, `los datos ocupan solo ${Math.round(frac * 100)}% del yDomain [${yDdecl[0]}, ${yDdecl[1]}]: la curva queda aplastada contra el piso y no se lee. Ajusta yDomain al rango real de los datos (~[${Math.floor(ymin)}, ${Math.ceil(ymax)}]).`);
        }
      }
    }
    if (type === 'bars' && Array.isArray(c.values)) {
      for (const v of c.values) {
        const val = v && typeof v === 'object' ? v.value : v;
        if (typeof val === 'number' && (val > yD[1] || val < Math.min(0, yD[0]))) {
          ctx.warn(`${p}.values`, `una barra (value=${val}) excede yDomain [${yD[0]}, ${yD[1]}]${dtxt(yDdecl)}: se dibuja fuera del marco. Declara/amplía yDomain al máximo de los datos.`); break;
        }
      }
    }
    if (c.target && typeof c.target.y === 'number' && (c.target.y < yD[0] || c.target.y > yD[1])) {
      ctx.warn(`${p}.target`, `la meta (target.y=${c.target.y}) cae fuera de yDomain [${yD[0]}, ${yD[1]}]${dtxt(yDdecl)}: la línea de meta queda fuera del marco (inalcanzable en pantalla). Incluye la meta dentro de yDomain.`);
    }
  }

  function vFormula(ctx, f, i) {
    const p = `formulas[${i}]`;
    if (!f || typeof f !== 'object') return ctx.err(p, 'cada fórmula es un objeto { "id", "tex", ... }.');
    if (!f.id || typeof f.id !== 'string') ctx.err(`${p}.id`, 'falta el id (el step "formula" lo usa para mostrarla/animarla).');
    // tex: string, o array de strings / { tex, color } (segmentos en fila).
    const segs = Array.isArray(f.tex) ? f.tex : [f.tex];
    if (f.tex == null || !segs.some(s => (typeof s === 'string' && s.trim()) || (s && typeof s === 'object' && typeof s.tex === 'string' && s.tex.trim()))) {
      ctx.err(`${p}.tex`, 'falta "tex": la ecuación LaTeX (un string, o un array de segmentos { "tex", "color" } para pintar partes en distinto color, ej. un resultado resaltado).');
    }
    segs.forEach((s, j) => {
      if (s && typeof s === 'object' && !Array.isArray(s)) {
        if (typeof s.tex !== 'string') ctx.err(`${p}.tex[${j}].tex`, 'cada segmento es { "tex": "...", "color"? }.');
        if (s.color != null && !COLOR_RE.test(s.color)) ctx.warn(`${p}.tex[${j}].color`, `"${s.color}" no parece un color CSS.`);
      }
    });
    for (const k of Object.keys(f)) {
      if (!FORMULA_KEYS.includes(k)) ctx.warn(`${p}.${k}`, `clave desconocida. Conocidas: ${list(FORMULA_KEYS)}.`);
    }
    for (const k of ['x', 'y']) {
      if (f[k] != null) { const r = isCoord(f[k]); if (r !== true) ctx.err(`${p}.${k}`, r); }
    }
    if (f.align != null && !['left', 'center', 'right'].includes(f.align)) ctx.err(`${p}.align`, 'align es "left", "center" o "right".');
    if (f.valign != null && !['baseline', 'middle', 'top', 'bottom'].includes(f.valign)) ctx.err(`${p}.valign`, 'valign es "baseline", "middle", "top" o "bottom".');
    if (f.color != null && !COLOR_RE.test(f.color)) ctx.warn(`${p}.color`, `"${f.color}" no parece un color CSS.`);
    if (f.alpha != null && (typeof f.alpha !== 'number' || f.alpha < 0 || f.alpha > 1)) ctx.warn(`${p}.alpha`, 'alpha es la opacidad inicial 0..1 (usa 0 para revelarla luego con el step "formula").');
    if (f.panel != null && f.panel !== true && (typeof f.panel !== 'object' || Array.isArray(f.panel))) {
      ctx.err(`${p}.panel`, 'panel es true (tarjeta por defecto) o un objeto { title, bg, border, pad, radius }.');
    } else if (f.panel && typeof f.panel === 'object') {
      for (const k of Object.keys(f.panel)) {
        if (!FORMULA_PANEL_KEYS.includes(k)) ctx.warn(`${p}.panel.${k}`, `clave desconocida del panel. Conocidas: ${list(FORMULA_PANEL_KEYS)}.`);
      }
      checkTextStyle(ctx, `${p}.panel.title`, f.panel.title);
    }
  }

  function vAnnotation(ctx, a, i, knownIds) {
    const p = `annotations[${i}]`;
    if (!a || typeof a !== 'object' || Array.isArray(a)) return ctx.err(p, 'cada anotación es un objeto { "id", "target", "text", ... }.');
    if (!a.id || typeof a.id !== 'string') ctx.err(`${p}.id`, 'falta el id (el step "annotation" lo usa para mostrarla/animarla).');
    if (a.text == null || String(a.text).trim() === '') {
      ctx.err(`${p}.text`, 'falta "text": la etiqueta del callout (soporta notación _/^ y $...$; usa \\n para varias líneas).');
    } else {
      checkTextStyle(ctx, `${p}.text`, String(a.text).replace(/\n/g, ' '));
    }
    if (a.target == null) {
      ctx.err(`${p}.target`, 'falta "target": a qué apunta el callout (id de entidad, prop o chart, o un punto [x, y]).');
    } else if (Array.isArray(a.target)) {
      if (a.target.length !== 2 || !a.target.every(n => typeof n === 'number')) ctx.err(`${p}.target`, 'un punto es [x, y] en píxeles.');
    } else if (typeof a.target === 'string') {
      if (!knownIds.has(a.target)) {
        ctx.err(`${p}.target`, `"${a.target}" no es id de ninguna entidad, prop ni chart declarado. Usa un id existente o un punto [x, y].`);
      }
    } else {
      ctx.err(`${p}.target`, 'target es un id (string) de entidad/prop/chart, o un punto [x, y].');
    }
    for (const k of Object.keys(a)) {
      if (!ANNOTATION_KEYS.includes(k)) ctx.warn(`${p}.${k}`, `clave desconocida. Conocidas: ${list(ANNOTATION_KEYS)}.`);
    }
    for (const k of ['dx', 'dy', 'px']) {
      if (a[k] != null && typeof a[k] !== 'number') ctx.err(`${p}.${k}`, `${k} es un número${k === 'px' ? '' : ' (puede ser negativo: es un desplazamiento del chip respecto al objetivo)'}.`);
    }
    for (const [k, v] of [['color', a.color], ['textColor', a.textColor], ['bg', a.bg]]) {
      if (v != null && !COLOR_RE.test(v)) ctx.warn(`${p}.${k}`, `"${v}" no parece un color CSS.`);
    }
    if (a.align != null && !['left', 'center', 'right'].includes(a.align)) ctx.err(`${p}.align`, 'align es "left", "center" o "right".');
    if (a.alpha != null && (typeof a.alpha !== 'number' || a.alpha < 0 || a.alpha > 1)) ctx.warn(`${p}.alpha`, 'alpha es la opacidad inicial 0..1 (usa 0 para revelarla luego con el step "annotation").');
  }

  function vDiagram(ctx, d, i, knownIds) {
    const p = `diagrams[${i}]`;
    if (!d || typeof d !== 'object' || Array.isArray(d)) return ctx.err(p, 'cada diagrama es un objeto { "id", "nodes", "edges", ... }.');
    if (!d.id || typeof d.id !== 'string') ctx.err(`${p}.id`, 'falta el id (el step "diagram" lo usa para mostrarlo/revelarlo).');
    for (const k of Object.keys(d)) {
      if (!DIAGRAM_KEYS.includes(k)) ctx.warn(`${p}.${k}`, `clave desconocida. Conocidas: ${list(DIAGRAM_KEYS)}.`);
    }
    if (d.nodes != null && !Array.isArray(d.nodes)) ctx.err(`${p}.nodes`, 'nodes es un array de nodos { id, x, y, w, h, label }.');
    const nodes = Array.isArray(d.nodes) ? d.nodes : [];
    const nodeIds = new Set();
    nodes.forEach((n, j) => {
      const np = `${p}.nodes[${j}]`;
      if (!n || typeof n !== 'object' || Array.isArray(n)) return ctx.err(np, 'cada nodo es un objeto { id, x, y, w, h, label }.');
      if (!n.id || typeof n.id !== 'string') ctx.err(`${np}.id`, 'cada nodo necesita un id (los edges lo referencian).');
      else if (nodeIds.has(n.id)) ctx.err(`${np}.id`, `"${n.id}" ya está usado por otro nodo de este diagrama: los edges dirigirían al primero. Dale un id único.`);
      else nodeIds.add(n.id);
      for (const k of Object.keys(n)) {
        if (!DNODE_KEYS.includes(k)) ctx.warn(`${np}.${k}`, `clave desconocida. Conocidas: ${list(DNODE_KEYS)}.`);
      }
      if (n.shape != null && n.shape !== 'box') ctx.warn(`${np}.shape`, `"${n.shape}" no está en v1 (solo "box"; "circle"/venn están diferidos). Se dibuja como caja.`);
      if (n.target != null) {
        if (Array.isArray(n.target)) { if (n.target.length !== 2 || !n.target.every(v => typeof v === 'number')) ctx.err(`${np}.target`, 'un punto es [x, y].'); }
        else if (typeof n.target === 'string') { if (!knownIds.has(n.target)) ctx.err(`${np}.target`, `"${n.target}" no es id de ninguna entidad, prop ni chart. Usa un id existente, un punto [x, y], o pon x/y.`); }
        else ctx.err(`${np}.target`, 'target es un id (string) o un punto [x, y].');
      } else {
        for (const k of ['x', 'y']) { if (n[k] != null) { const r = isCoord(n[k]); if (r !== true) ctx.err(`${np}.${k}`, r); } }
      }
      if (n.fill != null && !COLOR_RE.test(n.fill)) ctx.warn(`${np}.fill`, `"${n.fill}" no parece un color CSS.`);
      if (n.label != null) checkTextStyle(ctx, `${np}.label`, String(n.label));
    });
    if (d.edges != null && !Array.isArray(d.edges)) ctx.err(`${p}.edges`, 'edges es un array de conectores { from, to }.');
    const edges = Array.isArray(d.edges) ? d.edges : [];
    const SIDES = ['left', 'right', 'top', 'bottom', 'center'];
    edges.forEach((e, j) => {
      const ep = `${p}.edges[${j}]`;
      if (!e || typeof e !== 'object' || Array.isArray(e)) return ctx.err(ep, 'cada edge es un objeto { from, to }.');
      for (const k of Object.keys(e)) {
        if (!DEDGE_KEYS.includes(k)) ctx.warn(`${ep}.${k}`, `clave desconocida. Conocidas: ${list(DEDGE_KEYS)}.`);
      }
      const checkEnd = (ref, key) => {
        if (ref == null) return ctx.err(`${ep}.${key}`, `falta "${key}": el id de un nodo del diagrama (o un punto [x, y], o un id de entidad/prop/chart).`);
        if (Array.isArray(ref)) { if (ref.length !== 2 || !ref.every(v => typeof v === 'number')) ctx.err(`${ep}.${key}`, 'un punto es [x, y].'); return; }
        if (typeof ref === 'string') { if (!nodeIds.has(ref) && !knownIds.has(ref)) ctx.err(`${ep}.${key}`, `"${ref}" no es id de ningún nodo de este diagrama (${list(nodeIds) || 'ninguno'}) ni de una entidad/prop/chart. Usa un id de nodo, un punto [x, y], o un id existente.`); return; }
        ctx.err(`${ep}.${key}`, `${key} es un id (string) o un punto [x, y].`);
      };
      checkEnd(e.from, 'from'); checkEnd(e.to, 'to');
      if (e.fromSide != null && !SIDES.includes(e.fromSide)) ctx.err(`${ep}.fromSide`, `fromSide es ${list(SIDES)}.`);
      if (e.toSide != null && !SIDES.includes(e.toSide)) ctx.err(`${ep}.toSide`, `toSide es ${list(SIDES)}.`);
    });
    if (d.texts != null && !Array.isArray(d.texts)) ctx.err(`${p}.texts`, 'texts es un array de { x, y, text }.');
    (Array.isArray(d.texts) ? d.texts : []).forEach((t, j) => {
      const tp = `${p}.texts[${j}]`;
      if (!t || typeof t !== 'object' || Array.isArray(t)) return ctx.err(tp, 'cada texto es un objeto { x, y, text }.');
      for (const k of Object.keys(t)) {
        if (!DTEXT_KEYS.includes(k)) ctx.warn(`${tp}.${k}`, `clave desconocida. Conocidas: ${list(DTEXT_KEYS)}.`);
      }
      if (t.text == null || String(t.text).trim() === '') ctx.err(`${tp}.text`, 'falta "text".');
      else checkTextStyle(ctx, `${tp}.text`, String(t.text));
    });
    if (d.panel != null) {
      if (typeof d.panel !== 'object' || Array.isArray(d.panel)) ctx.err(`${p}.panel`, 'panel es un objeto { fill, stroke, radius, pad, title } (auto-encaja el bbox de los nodos) o con x/y/w/h explícitos.');
      else for (const k of Object.keys(d.panel)) { if (!DPANEL_KEYS.includes(k)) ctx.warn(`${p}.panel.${k}`, `clave desconocida del panel. Conocidas: ${list(DPANEL_KEYS)}.`); }
    }
    if (d.alpha != null && (typeof d.alpha !== 'number' || d.alpha < 0 || d.alpha > 1)) ctx.warn(`${p}.alpha`, 'alpha es la opacidad inicial del grupo 0..1 (0 para revelarlo luego con el step "diagram").');
    if (d.reveal != null && (typeof d.reveal !== 'number' || d.reveal < 0 || d.reveal > 1)) ctx.warn(`${p}.reveal`, 'reveal es el barrido inicial 0..1 (0 = nada revelado).');
  }

  function vSteps(ctx, steps, p, scope) {
    if (!Array.isArray(steps)) return ctx.err(p, 'script debe ser un array de steps.');
    // goto puede apuntar a labels de ramas then/else (se inyectan al correr).
    const labels = new Set();
    const collect = (arr) => {
      for (const s of arr || []) {
        if (s && s.label != null) labels.add(s.label);
        if (s && s.if != null) { collect(s.then); collect(s.else); }
        if (s && Array.isArray(s.runScript)) collect(s.runScript);
      }
    };
    collect(steps);
    steps.forEach((s, i) => vStep(ctx, s, `${p}[${i}]`, scope, labels));
  }

  function vStep(ctx, s, p, scope, labels) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) return ctx.err(p, 'cada step es un objeto, ej. { "say": "L1", "text": "Hola" }.');
    const keys = Object.keys(s);
    if (!keys.length) return ctx.err(p, 'step vacío.');
    for (const k of keys) {
      if (!STEP_KEYS.includes(k)) ctx.err(`${p}.${k}`, `clave de step desconocida. Válidas: ${list(STEP_KEYS)}.`);
    }
    const refEntity = (key) => {
      const id = s[key];
      if (typeof id !== 'string') return ctx.err(`${p}.${key}`, `debe ser el id (string) de una entidad.`);
      if (!scope.entityIds.has(id)) {
        const msg = `"${id}" no es el id de ninguna entidad declarada (${list(scope.entityIds) || 'ninguna'}).`;
        if (scope.hasHooks) ctx.warn(`${p}.${key}`, msg + ' Si un hook la spawnea en runtime, ignora esta advertencia.');
        else ctx.err(`${p}.${key}`, msg);
      }
    };
    for (const k of STEP_ENTITY_REFS) if (s[k] != null) refEntity(k);

    if (s.walk != null) {
      const t = s.to;
      const ok = Array.isArray(t) ? t.length === 2
        : typeof t === 'string' ? true
        : t && typeof t === 'object' ? t.x != null && t.y != null : false;
      if (!ok) ctx.err(`${p}.to`, 'walk necesita "to": [x,y], {x,y} o el id de otra entidad.');
      if (typeof t === 'string' && !scope.entityIds.has(t) && !scope.hasHooks) {
        ctx.err(`${p}.to`, `"${t}" no es el id de ninguna entidad declarada.`);
      }
    }
    if (s.path != null) {
      if (!Array.isArray(s.points) || !s.points.length) {
        ctx.err(`${p}.points`, 'path necesita "points": array de {x,y} o [x,y].');
      }
      if (typeof s.path !== 'string') {
        ctx.err(`${p}.path`, 'debe ser el id (string) de una entidad o de un prop.');
      } else if (!scope.entityIds.has(s.path) && !(scope.propIds && scope.propIds.has(s.path))) {
        const known = [...scope.entityIds, ...(scope.propIds || [])];
        const msg = `"${s.path}" no es el id de ninguna entidad ni prop declarado (${list(known) || 'ninguno'}). Para mover un prop dale un "id" en la lista props.`;
        if (scope.hasHooks) ctx.warn(`${p}.path`, msg);
        else ctx.err(`${p}.path`, msg);
      }
    }
    if (s.music != null) {
      const m = s.music;
      if (m === 'stinger') {
        // ok: golpe musical cuantizado al siguiente tiempo fuerte de la grilla
      } else if (m && typeof m === 'object' && !Array.isArray(m)) {
        for (const k of Object.keys(m)) {
          if (!['volume', 'duration', 'mood'].includes(k)) {
            ctx.err(`${p}.music.${k}`, `clave desconocida en music. Válidas: volume (0..1.5, fracción del volumen base del mood), mood (cambio de mood con crossfade), duration (segundos del fade).`);
          }
        }
        if (m.mood != null && m.volume != null) {
          ctx.err(`${p}.music`, 'mood y volume no van en el mismo step: el cambio de mood arranca en el volumen base del nuevo mood; agacha o levanta con un step aparte.');
        } else if (m.mood != null) {
          if (typeof m.mood !== 'string' || !MUSIC_MOODS.includes(m.mood)) {
            ctx.err(`${p}.music.mood`, `"${m.mood}" no es un mood de música. Usa uno de: ${list(MUSIC_MOODS)}.`);
          }
        } else if (typeof m.volume !== 'number' || m.volume < 0 || m.volume > 1.5) {
          ctx.err(`${p}.music.volume`, 'volume es una FRACCIÓN del volumen base del mood: número entre 0 (silencio) y 1.5 (1 = volumen normal).');
        }
        if (m.duration != null && (typeof m.duration !== 'number' || m.duration <= 0)) {
          ctx.err(`${p}.music.duration`, 'duration del fade en segundos: número positivo.');
        }
      } else {
        ctx.err(`${p}.music`, 'music es { "volume": 0..1.5 } (fracción del volumen base), { "mood": "<mood>" } (cambio con crossfade) o el string "stinger" (golpe cuantizado a la grilla); duration opcional en los objetos.');
      }
      if (!scope.hasMusic) {
        ctx.warn(`${p}.music`, 'la escena no declara meta.music, así que este step será un no-op. Declara el mood en meta.music para que tenga efecto.');
      }
    }
    for (const k of ['say', 'think']) {
      if (s[k] != null) {
        if (typeof s.text !== 'string' || !s.text.trim()) ctx.err(`${p}.text`, `${k} necesita "text" con el diálogo.`);
        checkTextStyle(ctx, `${p}.text`, s.text);
      }
    }
    if (s.mood != null) {
      if (s.value == null) ctx.warn(`${p}.value`, 'mood sin "value" cae a neutral; probablemente falta el mood destino.');
      else if (!MOOD_KINDS.includes(s.value)) ctx.err(`${p}.value`, `"${s.value}" no es un mood. Usa uno de: ${list(MOOD_KINDS)}.`);
    }
    if (s.easing != null && !EASING_KINDS.includes(s.easing)) {
      ctx.err(`${p}.easing`, `"${s.easing}" no es un easing. Usa uno de: ${list(EASING_KINDS)}.`);
    }
    if (s.meter != null) {
      if (!scope.meterIds.has(s.meter)) ctx.err(`${p}.meter`, `"${s.meter}" no es el id de ningún meter declarado (${list(scope.meterIds) || 'ninguno'}).`);
      if (s.to == null) ctx.warn(`${p}.to`, 'meter sin "to" no cambia el valor.');
    }
    const toConsumers = ['walk', 'meter', 'tween', 'lookAt'].filter(k => s[k] != null);
    if (toConsumers.length > 1) {
      ctx.err(p, `un step no puede combinar ${toConsumers.join(' + ')}: todos leen "to". Sepáralos en steps distintos.`);
    }
    if (s.lookAt != null) {
      const t = s.to;
      if (t != null && typeof t !== 'string' && !(Array.isArray(t) && t.length === 2) && !(t && typeof t === 'object' && t.x != null && t.y != null)) {
        ctx.err(`${p}.to`, 'lookAt mira hacia "to": el id de otra entidad, un punto [x,y] o {x,y}. Sin "to" (o con null) suelta la mirada.');
      }
      if (typeof t === 'string' && !scope.entityIds.has(t) && !scope.hasHooks) {
        ctx.err(`${p}.to`, `"${t}" no es el id de ninguna entidad declarada (${list(scope.entityIds) || 'ninguna'}).`);
      }
    }
    if (s.tween != null) {
      if (typeof s.tween !== 'string') ctx.err(`${p}.tween`, 'tween es la clave de state a animar ("deuda"), "idEntidad.propiedad" ("alma._alpha"), "ambient.darkness", o un grupo de props ("type:tree.alpha", "tag:primavera.alpha").');
      else if (s.tween.includes('.')) {
        const id = s.tween.slice(0, s.tween.indexOf('.'));
        // Selectores de grupo: type:<tipo> (todos los props de ese type) y
        // tag:<tag> (props con esa etiqueta). No refieren un id puntual.
        if (id === 'ambient') {
          const key = s.tween.slice(s.tween.indexOf('.') + 1);
          if (key !== 'darkness' && key !== 'saturation') ctx.warn(`${p}.tween`, `"ambient.${key}" no es una clave animable documentada del ambiente; las conocidas son "ambient.darkness" y "ambient.saturation".`);
        } else if (id.startsWith('type:')) {
          const ty = id.slice(5);
          if (!PROP_KINDS.has(ty)) ctx.warn(`${p}.tween`, `"type:${ty}" no es un tipo de prop conocido (${list(PROP_KINDS)}); no coincidirá con ningún prop.`);
        } else if (id.startsWith('tag:')) {
          const tag = id.slice(4);
          const tagged = (config => (config.props || []).some(pr => pr && (pr.tag === tag || (Array.isArray(pr.tag) && pr.tag.includes(tag)))))(scope._config || {});
          if (scope._config && !tagged && !scope.hasHooks) ctx.warn(`${p}.tween`, `"tag:${tag}" no coincide con ningún prop: ninguno declara tag "${tag}".`);
        } else if (!scope.entityIds.has(id) && !(scope.propIds && scope.propIds.has(id))) {
          const msg = `"${id}" no es el id de ninguna entidad ni prop declarado (${list(scope.entityIds) || 'ninguna'}), ni "ambient", ni un selector "type:"/"tag:".`;
          if (scope.hasHooks) ctx.warn(`${p}.tween`, msg);
          else ctx.err(`${p}.tween`, msg);
        }
      }
      if (typeof s.to !== 'number') ctx.err(`${p}.to`, 'tween necesita "to" numérico (el valor destino).');
    }
    if (s.chart != null) {
      const seriesIds = scope.chartSeries && scope.chartSeries.get(s.chart);
      if (!seriesIds) {
        ctx.err(`${p}.chart`, `"${s.chart}" no es el id de ningún chart declarado (${list(scope.chartSeries ? scope.chartSeries.keys() : []) || 'ninguno'}).`);
      } else if (s.series != null && !seriesIds.has(s.series)) {
        ctx.err(`${p}.series`, `"${s.series}" no es una serie del chart "${s.chart}" (${list(seriesIds) || 'sin series'}).`);
      }
      const acts = ['show', 'hide', 'alpha', 'reveal'].filter(k => s[k] != null);
      if (!acts.length) ctx.err(p, 'el step chart necesita una acción: "show": true, "hide": true, "alpha": n, o "reveal": n (con "series" opcional).');
      if (s.reveal != null && (typeof s.reveal !== 'number' || s.reveal < 0 || s.reveal > 1)) {
        ctx.err(`${p}.reveal`, 'reveal es la fracción dibujada, un número entre 0 y 1.');
      }
      if (s.alpha != null && (typeof s.alpha !== 'number' || s.alpha < 0 || s.alpha > 1)) {
        ctx.err(`${p}.alpha`, 'alpha es la opacidad, un número entre 0 y 1.');
      }
    } else if (s.formula != null) {
      if (!scope.formulaIds || !scope.formulaIds.has(s.formula)) {
        ctx.err(`${p}.formula`, `"${s.formula}" no es el id de ninguna fórmula declarada (${list(scope.formulaIds || []) || 'ninguna'}). Declárala en la lista top-level "formulas".`);
      }
      const acts = ['show', 'hide', 'alpha'].filter(k => s[k] != null);
      if (!acts.length) ctx.err(p, 'el step formula necesita una acción: "show": true, "hide": true o "alpha": n (con "duration" opcional para el fade).');
      if (s.alpha != null && (typeof s.alpha !== 'number' || s.alpha < 0 || s.alpha > 1)) {
        ctx.err(`${p}.alpha`, 'alpha es la opacidad, un número entre 0 y 1.');
      }
      for (const k of ['series', 'reveal']) if (s[k] != null) ctx.err(`${p}.${k}`, `"${k}" es de "chart", no de "formula".`);
    } else if (s.annotation != null) {
      if (!scope.annotationIds || !scope.annotationIds.has(s.annotation)) {
        ctx.err(`${p}.annotation`, `"${s.annotation}" no es el id de ninguna anotación declarada (${list(scope.annotationIds || []) || 'ninguna'}). Declárala en la lista top-level "annotations".`);
      }
      const acts = ['show', 'hide', 'alpha'].filter(k => s[k] != null);
      if (!acts.length) ctx.err(p, 'el step annotation necesita una acción: "show": true, "hide": true o "alpha": n (con "duration" opcional para el fade).');
      if (s.alpha != null && (typeof s.alpha !== 'number' || s.alpha < 0 || s.alpha > 1)) {
        ctx.err(`${p}.alpha`, 'alpha es la opacidad, un número entre 0 y 1.');
      }
      for (const k of ['series', 'reveal']) if (s[k] != null) ctx.err(`${p}.${k}`, `"${k}" es de "chart", no de "annotation".`);
    } else if (s.diagram != null) {
      if (!scope.diagramIds || !scope.diagramIds.has(s.diagram)) {
        ctx.err(`${p}.diagram`, `"${s.diagram}" no es el id de ningún diagrama declarado (${list(scope.diagramIds || []) || 'ninguno'}). Decláralo en la lista top-level "diagrams".`);
      }
      const acts = ['show', 'hide', 'alpha', 'reveal'].filter(k => s[k] != null);
      if (!acts.length) ctx.err(p, 'el step diagram necesita una acción: "show": true, "hide": true, "alpha": n o "reveal": n (con "duration" opcional para el barrido).');
      for (const k of ['alpha', 'reveal']) if (s[k] != null && (typeof s[k] !== 'number' || s[k] < 0 || s[k] > 1)) ctx.err(`${p}.${k}`, `${k} es un número entre 0 y 1.`);
      if (s.series != null) ctx.err(`${p}.series`, '"series" es de "chart", no de "diagram".');
    } else {
      for (const k of ['show', 'hide', 'series', 'reveal']) {
        if (s[k] != null) ctx.err(`${p}.${k}`, `"${k}" solo tiene sentido junto a "chart", "formula", "annotation" o "diagram".`);
      }
    }
    if (s.focus != null) {
      const f = s.focus;
      if (f === 'off') {
        ctx.err(`${p}.focus`, 'para APAGAR el foco no uses "focus": "off"; repite el id enfocado con "off": true, por ejemplo { "focus": "ana", "off": true }.');
      } else if (typeof f === 'string') {
        const isChart = scope.chartSeries && scope.chartSeries.has(f);
        if (!scope.entityIds.has(f) && !(scope.propIds && scope.propIds.has(f)) && !isChart) {
          const known = [...scope.entityIds, ...(scope.propIds || []), ...(scope.chartSeries ? scope.chartSeries.keys() : [])];
          const msg = `"${f}" no es el id de ninguna entidad, prop ni chart declarado (${list(known) || 'ninguno'}). Para enfocar un prop o chart dale un "id"; para un punto usa "focus": [x, y].`;
          if (scope.hasHooks) ctx.warn(`${p}.focus`, msg + ' Si un hook lo spawnea en runtime, ignora esta advertencia.');
          else ctx.err(`${p}.focus`, msg);
        }
      } else if (Array.isArray(f)) {
        if (f.length !== 2 || f.some(n => typeof n !== 'number')) {
          ctx.err(`${p}.focus`, 'un foco puntual es [x, y] numérico en píxeles del mundo.');
        }
      } else {
        ctx.err(`${p}.focus`, 'focus es el id de una entidad (string) o un punto [x, y].');
      }
      if (s.radius != null && (typeof s.radius !== 'number' || s.radius <= 0)) {
        ctx.err(`${p}.radius`, 'radius es el radio del halo en píxeles (número positivo).');
      }
      if (s.color != null && !/^#/.test(s.color)) {
        ctx.warn(`${p}.color`, `"${s.color}" no es un color hex (#rrggbb): el halo necesita hex para degradar su alpha.`);
      }
    } else {
      for (const k of ['off', 'radius', 'color']) {
        if (s[k] != null) ctx.err(`${p}.${k}`, `"${k}" solo tiene sentido junto a "focus".`);
      }
    }
    if (s.weather != null) {
      const w = s.weather;
      if (w !== 'none' && w !== false && !PARTICLE_KINDS.includes(w)) {
        ctx.err(`${p}.weather`, `"${w}" no es un clima. Usa uno de: ${list(PARTICLE_KINDS)}, o "none" para detenerlo.`);
      }
      if (s.intensity != null && (typeof s.intensity !== 'number' || s.intensity <= 0)) {
        ctx.err(`${p}.intensity`, 'intensity es un número positivo (1 = normal).');
      }
    } else if (s.intensity != null) {
      ctx.err(`${p}.intensity`, '"intensity" solo tiene sentido junto a "weather".');
    }
    for (const k of ['showLabel', 'hideLabel']) {
      if (s[k] != null && !(scope.labelIds && scope.labelIds.has(s[k])) && !scope.hasHooks) {
        ctx.err(`${p}.${k}`, `"${s[k]}" no es el id de ningún label declarado (${list(scope.labelIds || []) || 'ninguno'}). Declara el label en la lista top-level "labels" con su "id".`);
      }
    }
    if (s.scene != null) {
      if (!scope.setIds || !scope.setIds.has(s.scene)) {
        ctx.err(`${p}.scene`, `"${s.scene}" no es el id de ningún set declarado (${list(scope.setIds || []) || 'ninguno'}). Declara la vista en la lista top-level "sets".`);
      }
      if (s.move != null) {
        if (typeof s.move !== 'object' || Array.isArray(s.move)) {
          ctx.err(`${p}.move`, 'move es un objeto { "idEntidad": [x, y] } que reubica entidades durante el negro.');
        } else {
          for (const [mid, pos] of Object.entries(s.move)) {
            if (!scope.entityIds.has(mid) && !scope.hasHooks) {
              ctx.err(`${p}.move.${mid}`, `"${mid}" no es el id de ninguna entidad declarada (${list(scope.entityIds) || 'ninguna'}).`);
            }
            if (!Array.isArray(pos) || pos.length !== 2 || pos.some(n => typeof n !== 'number')) {
              ctx.err(`${p}.move.${mid}`, 'la posición es [x, y] numérico en píxeles del mundo.');
            }
          }
        }
      }
    } else if (s.move != null) {
      ctx.err(`${p}.move`, '"move" solo tiene sentido junto a "scene": reubica entidades durante el fade a negro.');
    }
    if (s.goto != null && !labels.has(s.goto)) {
      ctx.err(`${p}.goto`, `no existe ningún step con "label": "${s.goto}".`);
    }
    if (s.tone != null && typeof s.tone !== 'number') ctx.err(`${p}.tone`, 'tone es la frecuencia en Hz (número).');
    if (s.sweep != null && (!Array.isArray(s.sweep) || s.sweep.length !== 2 || s.sweep.some(n => typeof n !== 'number'))) {
      ctx.err(`${p}.sweep`, 'sweep es [freqDesde, freqHasta] en Hz.');
    }
    if (s.particles != null) {
      if (typeof s.particles !== 'object' || s.particles.x == null || s.particles.y == null) {
        ctx.err(`${p}.particles`, 'particles necesita un objeto con x e y (más "preset" u opciones de fx.particles).');
      } else if (s.particles.preset != null && !PARTICLE_PRESETS.includes(s.particles.preset)) {
        ctx.err(`${p}.particles.preset`, `"${s.particles.preset}" no es un preset de partículas. Usa uno de: ${list(PARTICLE_PRESETS)}.`);
      }
    }
    if (s.floatNumber != null && (typeof s.floatNumber !== 'object' || s.floatNumber.x == null || s.floatNumber.y == null || s.floatNumber.text == null)) {
      ctx.err(`${p}.floatNumber`, 'floatNumber necesita {x, y, text}.');
    }
    if (s.camera != null) {
      const c = s.camera;
      const CAM_KEYS = ['reset', 'to', 'zoom', 'follow', 'shake', 'letterbox'];
      if (typeof c !== 'object' || Array.isArray(c)) {
        ctx.err(`${p}.camera`, 'camera es un objeto: { "to": "ana" | [x,y], "zoom": n, "follow": "ana" | false, "shake": n, "letterbox": bool, "reset": true }.');
      } else {
        for (const k of Object.keys(c)) {
          if (!CAM_KEYS.includes(k)) ctx.warn(`${p}.camera.${k}`, `clave desconocida. Conocidas: ${list(CAM_KEYS)}.`);
        }
        if (!CAM_KEYS.some(k => c[k] != null)) {
          ctx.err(`${p}.camera`, `necesita al menos una acción: ${list(CAM_KEYS)}.`);
        }
        if (c.to != null) {
          if (Array.isArray(c.to)) {
            if (c.to.length !== 2 || c.to.some(v => typeof v !== 'number')) ctx.err(`${p}.camera.to`, 'un destino puntual es [x, y] numérico.');
          } else if (typeof c.to === 'string') {
            if (!scope.entityIds.has(c.to) && !(scope.propIds && scope.propIds.has(c.to)) && !scope.hasHooks) {
              ctx.err(`${p}.camera.to`, `"${c.to}" no es el id de ninguna entidad ni prop declarado.`);
            }
          } else ctx.err(`${p}.camera.to`, 'to es [x, y] o el id de una entidad o prop.');
        }
        if (c.zoom != null) {
          if (typeof c.zoom !== 'number' || c.zoom <= 0) ctx.err(`${p}.camera.zoom`, 'zoom es un número positivo (1 = sin zoom).');
          else if (c.zoom < 0.5 || c.zoom > 2.5) ctx.warn(`${p}.camera.zoom`, `zoom ${c.zoom} es extremo; el rango cómodo es 0.5 a 2.5.`);
        }
        if (c.follow != null && c.follow !== false) {
          if (typeof c.follow !== 'string' || (!scope.entityIds.has(c.follow) && !scope.hasHooks)) {
            ctx.err(`${p}.camera.follow`, 'follow es el id de una entidad (o false para soltar). Los props no se siguen: usa "to".');
          }
        }
        if (c.shake != null && c.shake !== true && (typeof c.shake !== 'number' || c.shake <= 0 || c.shake > 30)) {
          ctx.err(`${p}.camera.shake`, 'shake es true (intensidad 8) o un número 1..30 (píxeles de sacudida).');
        }
        if (c.letterbox != null && typeof c.letterbox !== 'boolean') {
          ctx.err(`${p}.camera.letterbox`, 'letterbox es true (barras de cine) o false (quitarlas).');
        }
      }
    }
    if ('caption' in s) checkTextStyle(ctx, `${p}.caption`, s.caption);
    if (s.style != null) {
      if (!('caption' in s)) ctx.err(`${p}.style`, '"style" solo tiene sentido junto a "caption" (variante "title").');
      else if (s.style !== 'title') ctx.err(`${p}.style`, `"${s.style}" no es un estilo de caption. El único es "title" (banda de título en la parte superior; la caption normal va sin style).`);
    }
    for (const k of ['set', 'add', 'clamp']) {
      if (s[k] != null && (typeof s[k] !== 'object' || Array.isArray(s[k]))) ctx.err(`${p}.${k}`, `${k} es un objeto {clave: valor}.`);
    }
    if (s.add && typeof s.add === 'object') {
      for (const [k, v] of Object.entries(s.add)) {
        if (typeof v !== 'number') ctx.err(`${p}.add.${k}`, `add suma números y ${JSON.stringify(v)} no lo es (un string concatena en silencio).`);
      }
    }
    if (s.clamp && typeof s.clamp === 'object') {
      for (const [k, v] of Object.entries(s.clamp)) {
        if (!Array.isArray(v) || v.length !== 2 || v.some(n => typeof n !== 'number')) {
          ctx.err(`${p}.clamp.${k}`, 'clamp espera [min, max] numéricos.');
        }
      }
    }
    if (s.do != null) compiles(ctx, `${p}.do`, ['world', 'state', 's', 'e'], s.do);
    if (s.call != null) compiles(ctx, `${p}.call`, ['world', 'state', 's'], 'return (' + s.call + ');');
    for (const k of ['if', 'waitUntil']) {
      if (s[k] != null) compiles(ctx, `${p}.${k}`, ['world', 'state', 's'], 'return (' + s[k] + ');');
    }
    if (s.if != null) {
      if (s.then != null) vStepsBranch(ctx, s.then, `${p}.then`, scope, labels);
      if (s.else != null) vStepsBranch(ctx, s.else, `${p}.else`, scope, labels);
    }
    if (s.runScript != null) vStepsBranch(ctx, s.runScript, `${p}.runScript`, scope, labels);
    if (s.waitFor != null && s.waitFor !== 'arrive' && !(typeof s.waitFor === 'string' && s.waitFor.startsWith('arrive:'))) {
      ctx.err(`${p}.waitFor`, '"waitFor" acepta "arrive" o "arrive:<idEntidad>". Para predicados usa "waitUntil": "expr".');
    }
    if (typeof s.waitFor === 'string' && s.waitFor.startsWith('arrive:')) {
      const id = s.waitFor.slice(7);
      if (!scope.entityIds.has(id) && !(scope.propIds && scope.propIds.has(id)) && !scope.hasHooks) {
        ctx.err(`${p}.waitFor`, `"${id}" no es el id de ninguna entidad ni prop declarado.`);
      }
    }
  }

  function vStepsBranch(ctx, steps, p, scope, labels) {
    if (!Array.isArray(steps)) return ctx.err(p, 'debe ser un array de steps.');
    steps.forEach((s, i) => vStep(ctx, s, `${p}[${i}]`, scope, labels));
  }

  function vText(ctx, text) {
    if (typeof text !== 'object') return ctx.err('text', 'debe ser un objeto {lang: {title, body, references}}.');
    for (const [lang, t] of Object.entries(text)) {
      if (typeof t !== 'object') { ctx.err(`text.${lang}`, 'debe ser {title, body, references}.'); continue; }
      checkTextStyle(ctx, `text.${lang}.title`, t.title);
      if (typeof t.body === 'string') {
        ctx.warn(`text.${lang}.body`, 'es un string; lo correcto es un array de párrafos (["Primer párrafo.", "Segundo párrafo."]). El motor lo tolera, pero entrégalo como lista.');
        checkTextStyle(ctx, `text.${lang}.body`, t.body);
      } else if (Array.isArray(t.body)) {
        t.body.forEach((para, i) => checkTextStyle(ctx, `text.${lang}.body[${i}]`, para));
      }
      if (t.references != null && !Array.isArray(t.references)) ctx.err(`text.${lang}.references`, 'debe ser un array de referencias.');
      for (const [i, r] of (t.references || []).entries()) {
        if (typeof r !== 'object') { ctx.err(`text.${lang}.references[${i}]`, 'cada referencia es un objeto APA {authors, year, title, ...}.'); continue; }
        if (!r.authors || !r.title) ctx.warn(`text.${lang}.references[${i}]`, 'referencia sin authors o title.');
      }
    }
  }

  // Una "forma" (config.form) es el meta-vocabulario didáctico: el motor la
  // compila a steps con compileForm (misma fuente de verdad que usa world.js).
  // Validamos la forma en sí y luego corremos el guion COMPILADO por el mismo
  // vSteps de siempre, así un error de vocabulario o editorial se atrapa igual
  // que en un script a mano.
  function vForm(ctx, config) {
    const form = config.form;
    if (typeof form !== 'object' || Array.isArray(form)) {
      return ctx.err('form', `debe ser un objeto { "type": "...", ... }. Formas: ${list(FORM_TYPES)}.`);
    }
    if (!form.type) {
      return ctx.err('form.type', `falta el tipo de forma. Formas: ${list(FORM_TYPES)}.`);
    }
    if (!FORM_TYPES.includes(form.type)) {
      return ctx.err('form.type', `"${form.type}" no es una forma conocida. Formas: ${list(FORM_TYPES)}.`);
    }
    const entityIds = new Set((config.entities || []).map(e => e?.id).filter(Boolean));
    if (form.subject && !entityIds.has(form.subject)) {
      ctx.err('form.subject', `"${form.subject}" no es el id de ninguna entidad declarada (${list([...entityIds]) || 'ninguna'}). El viajero es una entidad de la lista "entities".`);
    }
    const { steps, errors } = compileForm(config);
    for (const e of errors) {
      const i = e.indexOf(': ');
      if (i > 0) ctx.err(e.slice(0, i), e.slice(i + 2));
      else ctx.err('form', e);
    }
    if (steps) {
      const scope = {
        entityIds,
        propIds: new Set((config.props || []).map(pr => pr?.id).filter(Boolean)),
        meterIds: new Set((config.meters || []).map(m => m?.id).filter(Boolean)),
        chartSeries: new Map((config.charts || []).filter(c => c?.id).map(c => [c.id, new Set((c.series || []).map(sr => sr?.id).filter(Boolean))])),
        setIds: new Set((Array.isArray(config.sets) ? config.sets : []).map(st => st?.id).filter(Boolean)),
        labelIds: new Set((config.labels || []).map(l => l?.id).filter(Boolean)),
        formulaIds: new Set((config.formulas || []).map(f => f?.id).filter(Boolean)),
        annotationIds: new Set((config.annotations || []).map(a => a?.id).filter(Boolean)),
        diagramIds: new Set((config.diagrams || []).map(d => d?.id).filter(Boolean)),
        _config: config,
        hasHooks: Object.values(config.hooks || {}).some(v => typeof v === 'string' && v.trim()),
        hasMusic: typeof config.meta?.music === 'string' && config.meta.music.trim() !== '',
      };
      vSteps(ctx, steps, 'form', scope);
    }
  }

  function validateScene(config) {
    const errors = [];
    const warnings = [];
    const ctx = {
      err: (path, msg) => errors.push(`${path}: ${msg}`),
      warn: (path, msg) => warnings.push(`${path}: ${msg}`),
    };
    if (!config || typeof config !== 'object') {
      ctx.err('(raíz)', 'la escena debe ser un objeto JSON.');
      return { errors, warnings };
    }
    for (const k of Object.keys(config)) {
      if (!TOP_KEYS.includes(k)) {
        const hint = k === 'scripts' ? ' El campo se llama "script" (singular).' : '';
        ctx.err(k, `clave top-level desconocida.${hint} Válidas: ${list(TOP_KEYS)}.`);
      }
    }
    vMeta(ctx, config.meta);
    vCanvas(ctx, config.canvas);
    const propEnv = {
      h: typeof config.canvas?.h === 'number' ? config.canvas.h : null,
      declarative: !Object.values(config.hooks || {}).some(v => typeof v === 'string' && v.trim()),
    };
    (config.entities || []).forEach((e, i) => vEntity(ctx, e, i));
    (config.props || []).forEach((pr, i) => vProp(ctx, pr, i, propEnv));
    (config.labels || []).forEach((l, i) => vLabel(ctx, l, i));
    (config.walls || []).forEach((w, i) => vRect(ctx, w, `walls[${i}]`));
    (config.zones || []).forEach((z, i) => vZone(ctx, z, i));
    if (config.ambient != null) vAmbient(ctx, config.ambient);
    if (config.hooks != null) vHooks(ctx, config.hooks);
    if (config.text != null) vText(ctx, config.text);
    if (config.hint != null) {
      const hints = typeof config.hint === 'string' ? { _: config.hint } : config.hint;
      if (typeof hints !== 'object') ctx.err('hint', 'debe ser un string o {lang: string}.');
      else for (const [k, v] of Object.entries(hints)) checkTextStyle(ctx, `hint${k === '_' ? '' : '.' + k}`, v);
    }
    (config.meters || []).forEach((m, i) => {
      if (!m || typeof m !== 'object' || !m.id) ctx.err(`meters[${i}].id`, 'cada meter necesita un id.');
      for (const k of Object.keys(m || {})) {
        if (!METER_KEYS.includes(k)) ctx.warn(`meters[${i}].${k}`, `clave desconocida. Conocidas: ${list(METER_KEYS)}.`);
      }
      if (m) checkTextStyle(ctx, `meters[${i}].label`, m.label);
      if (m && Array.isArray(m.color)) {
        m.color.forEach((st, j) => {
          if (!st || typeof st.at !== 'number' || st.at < 0 || st.at > 1) {
            ctx.err(`meters[${i}].color[${j}].at`, 'cada stop es { "at": 0..1, "color": "#hex" }; "at" es la fracción del valor donde rige ese color.');
          }
          if (!st || typeof st.color !== 'string' || !/^#/.test(st.color)) {
            ctx.err(`meters[${i}].color[${j}].color`, 'el color de un stop debe ser hex (#rrggbb): el motor interpola entre stops.');
          }
        });
        if (m.color.length < 2) {
          ctx.warn(`meters[${i}].color`, 'con un solo stop el color no vira; usa dos o más stops, o un hex fijo.');
        }
      } else if (m && m.color != null && !COLOR_RE.test(m.color)) {
        ctx.warn(`meters[${i}].color`, `"${m.color}" no parece un color CSS.`);
      }
    });
    (config.charts || []).forEach((c, i) => vChart(ctx, c, i));
    (config.formulas || []).forEach((f, i) => vFormula(ctx, f, i));
    const annotTargetIds = new Set([
      ...(config.entities || []).map(e => e?.id),
      ...(config.props || []).map(pr => pr?.id),
      ...(config.charts || []).map(c => c?.id),
    ].filter(Boolean));
    (config.annotations || []).forEach((a, i) => vAnnotation(ctx, a, i, annotTargetIds));
    (config.diagrams || []).forEach((d, i) => vDiagram(ctx, d, i, annotTargetIds));
    if (config.sets != null) {
      if (!Array.isArray(config.sets)) ctx.err('sets', 'debe ser un array de vistas { "id", "cx" }. La cámara arranca en la primera.');
      else {
        const seen = new Set();
        config.sets.forEach((st, i) => {
          const p = `sets[${i}]`;
          if (!st || typeof st !== 'object') return ctx.err(p, 'cada set es un objeto { "id": "aula", "cx": 400 }.');
          if (!st.id || typeof st.id !== 'string') ctx.err(`${p}.id`, 'falta el id (el step "scene" lo usa para cambiar de vista).');
          else if (seen.has(st.id)) ctx.err(`${p}.id`, `"${st.id}" está repetido: cada set necesita un id único.`);
          else seen.add(st.id);
          if (typeof st.cx !== 'number') ctx.err(`${p}.cx`, 'falta cx (centro horizontal de la vista, en píxeles del mundo).');
          for (const k of Object.keys(st)) {
            if (!SET_KEYS.includes(k)) ctx.warn(`${p}.${k}`, `clave desconocida. Conocidas: ${list(SET_KEYS)}.`);
          }
          for (const k of ['cy', 'zoom']) {
            if (st[k] != null && typeof st[k] !== 'number') ctx.err(`${p}.${k}`, `${k} debe ser un número.`);
          }
        });
      }
    }
    if (config.script != null) {
      const scope = {
        entityIds: new Set((config.entities || []).map(e => e?.id).filter(Boolean)),
        propIds: new Set((config.props || []).map(pr => pr?.id).filter(Boolean)),
        meterIds: new Set((config.meters || []).map(m => m?.id).filter(Boolean)),
        chartSeries: new Map((config.charts || []).filter(c => c?.id).map(c => [c.id, new Set((c.series || []).map(sr => sr?.id).filter(Boolean))])),
        setIds: new Set((Array.isArray(config.sets) ? config.sets : []).map(st => st?.id).filter(Boolean)),
        labelIds: new Set((config.labels || []).map(l => l?.id).filter(Boolean)),
        formulaIds: new Set((config.formulas || []).map(f => f?.id).filter(Boolean)),
        annotationIds: new Set((config.annotations || []).map(a => a?.id).filter(Boolean)),
        diagramIds: new Set((config.diagrams || []).map(d => d?.id).filter(Boolean)),
        _config: config,
        hasHooks: Object.values(config.hooks || {}).some(v => typeof v === 'string' && v.trim()),
        hasMusic: typeof config.meta?.music === 'string' && config.meta.music.trim() !== '',
      };
      vSteps(ctx, config.script, 'script', scope);
      if (Array.isArray(config.script) && config.script.some(s => s && s.loop === true && s.path == null)) {
        ctx.warn('script', 'el guion tiene "loop": true: la escena nunca termina, así que el motor nunca mostrará "Ver nuevamente". Quita el loop salvo que la escena sea deliberadamente ambiental.');
      }
      // Lint de dramaturgia musical: recorre el guion acumulando `wait`.
      // No valida vocabulario (eso ya pasó en vStep) sino calidad de uso:
      // stingers en ráfaga pierden el peso, y una música agachada que
      // nunca se restaura deja el cierre de la escena apagado.
      if (scope.hasMusic && Array.isArray(config.script)) {
        let t = 0;
        let lastStingerT = null;
        let lastVol = null;
        let lastVolStep = -1;
        config.script.forEach((s, i) => {
          if (s && typeof s.wait === 'number') t += s.wait;
          if (!s || s.music == null) return;
          if (s.music === 'stinger') {
            if (lastStingerT != null && t - lastStingerT < 3) {
              ctx.warn(`script[${i}].music`, `dos stingers a ${(t - lastStingerT).toFixed(1)} s uno del otro: en ráfaga pierden todo el peso dramático. Sepáralos al menos 3 s o deja uno solo.`);
            }
            lastStingerT = t;
          } else if (typeof s.music === 'object' && s.music.mood != null) {
            lastVol = null; // el mood nuevo arranca en su volumen base
          } else if (typeof s.music === 'object' && typeof s.music.volume === 'number') {
            lastVol = s.music.volume;
            lastVolStep = i;
          }
        });
        if (lastVol != null && lastVol < 0.9) {
          ctx.warn(`script[${lastVolStep}].music`, `el guion deja la música agachada (volume ${lastVol}) y no la restaura: el cierre de la escena queda apagado (el replay sí vuelve al volumen base). Termina cerca de volume 1 salvo intención deliberada.`);
        }
      }
    }
    if (config.form != null) vForm(ctx, config);
    // Definir hooks.onDraw REEMPLAZA el pase automático de learners del motor
    // (world.js): si el hook no los dibuja él mismo, el elenco entero desaparece
    // sin aviso mientras el guion, los globos y los name-labels siguen.
    const onDraw = config.hooks && typeof config.hooks.onDraw === 'string' ? config.hooks.onDraw : '';
    if (onDraw.trim() && (config.entities || []).length > 0) {
      // Cuenta como "dibuja el elenco" si: llama `.learner(` con cualquier
      // receptor (draw.learner, d.learner, world['draw'].learner), o el interno
      // _drawLearners, o pasa learners/entidades a drawSorted (drawSorted solo
      // con props NO dibuja el elenco, así que exige mención de learner/entit).
      const drawsLearners = /\.learner\s*\(/.test(onDraw)
        || /_drawLearners\b/.test(onDraw)
        || (/drawSorted/.test(onDraw) && /learner|entit/.test(onDraw));
      if (!drawsLearners) {
        ctx.warn('hooks.onDraw', `la escena declara ${(config.entities || []).length} entidad(es) pero onDraw no dibuja a los learners (no aparece draw.learner, drawSorted ni _drawLearners): definir onDraw APAGA el dibujo automático del elenco, así que los personajes quedarán invisibles. Dibújalos tú (p.ej. for (const e of world.entities) if (e.type==='learner') world.draw.learner(e)) o usa el hook onDrawOver para un overlay.`);
      }
    }
    checkMovement(ctx, config);
    checkReachability(ctx, config);
    checkDuplicateIds(ctx, config);
    checkTiming(ctx, config);
    return { errors, warnings };
  }

  return { validateScene };
}
