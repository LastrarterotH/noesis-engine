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

import { PROP_SPRITES } from './prop-sprites.js?v=112';
import { SKY_PRESETS } from './sky-presets.js?v=112';
import { HOOK_NAMES, HOOK_ARGS } from './hooks.js?v=112';
import { compileForm, FORM_TYPES } from './forms.js?v=112';

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
  'tower', 'oven', 'candy-house', 'shoe', 'mirror', 'wall',
]);

const LABEL_ANCHORS = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];
const HEALTH_KINDS = ['normal', 'sick', 'feverish', 'frozen'];
const ZONE_EFFECTS = ['mood', 'reinforce', 'quiet', 'sleep'];

const TOP_KEYS = ['meta', 'text', 'hint', 'hintDuration', 'canvas', 'entities', 'props', 'labels', 'walls', 'zones', 'ambient', 'hooks', 'script', 'meters', 'charts', 'sets', 'seed', 'form'];
const SET_KEYS = ['id', 'cx', 'cy', 'zoom'];
const CHART_KEYS = ['id', 'type', 'x', 'y', 'w', 'h', 'xDomain', 'yDomain', 'xTicks', 'yTicks', 'xLabel', 'yLabel', 'xFormat', 'yFormat', 'title', 'target', 'panel', 'alpha', 'reveal', 'gap', 'color', 'series', 'values'];
const SERIES_KEYS = ['id', 'color', 'width', 'fill', 'dash', 'dots', 'data', 'reveal'];
const CANVAS_KEYS = ['w', 'h', 'bg', 'ss', 'sky', 'horizon', 'floor', 'safeArea', 'ysort', 'layers'];
const ENTITY_KEYS = ['id', 'type', 'x', 'y', 'name', 'body', 'color2', 'scale', 'hero', 'mood', 'accessory', 'accessoryColor', 'behavior', 'look', 'lookAt', 'health', 'extinguishable', 'extinctionThreshold', 'ageRate', 'maxAge', 'skybound', 'greets', 'sleepable', 'solid', 'stage'];
const PROP_KEYS = ['type', 'id', 'x', 'y', 'scale', 'color', 'color2', 'beakColor', 'interactive', 'solid', 'solidBox', 'z', 'dir', 'state', 'open', 'label', 'light', 'fall', 'w', 'h', 'cols', 'rows', 'disorder', 'homeFrac', 'jitter', 'pose', 'alpha', 'glass', 'wheel', 'face', 'lift', 'seeds', 'eye', 'glow', 'spin', 'wear', 'depth', 'panels', 'crank', 'braid', 'fire'];
const LABEL_KEYS = ['id', 'html', 'text', 'x', 'y', 'anchor', 'style', 'hidden'];
const METER_KEYS = ['id', 'label', 'x', 'y', 'w', 'h', 'color', 'max', 'value', 'showValue'];
// Un step puede combinar varias acciones; esto es la unión de claves que
// scripts.js lee de verdad (control + acciones + modificadores).
const STEP_KEYS = [
  'label', 'goto', 'loop', 'end', 'if', 'then', 'else', 'wait', 'waitFor', 'waitUntil',
  'walk', 'to', 'speed', 'path', 'points', 'duration', 'easing', 'curve', 'fromCurrent',
  'stop', 'say', 'think', 'text', 'exclaim', 'surprise', 'wonder', 'mood', 'value',
  'flash', 'reinforce', 'tone', 'dur', 'opts', 'sweep', 'particles', 'floatNumber',
  'celebrate', 'cry', 'thinking', 'appear', 'vanish', 'camera', 'caption', 'meter',
  'tween', 'chart', 'show', 'hide', 'alpha', 'series', 'reveal',
  'focus', 'off', 'radius', 'color', 'style', 'scene', 'move', 'weather', 'intensity',
  'showLabel', 'hideLabel', 'music',
  'set', 'add', 'clamp', 'do', 'call', 'runScript', 'runScriptOpts',
];
const STEP_ENTITY_REFS = ['walk', 'stop', 'say', 'think', 'exclaim', 'surprise', 'wonder', 'mood', 'flash', 'reinforce', 'celebrate', 'cry', 'thinking', 'appear', 'vanish'];

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
        if (!Array.isArray(sr.data) || !sr.data.length || sr.data.some(pt => !Array.isArray(pt) || pt.length !== 2 || pt.some(n => typeof n !== 'number'))) {
          ctx.err(`${sp}.data`, 'data es un array de puntos [x, y] numéricos, ej. [[2006, 0], [2007, 5]].');
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
          if (!['volume', 'duration'].includes(k)) {
            ctx.err(`${p}.music.${k}`, `clave desconocida en music. Válidas: volume (0..1.5, fracción del volumen base del mood), duration (segundos del fade, default 1.2).`);
          }
        }
        if (typeof m.volume !== 'number' || m.volume < 0 || m.volume > 1.5) {
          ctx.err(`${p}.music.volume`, 'volume es una FRACCIÓN del volumen base del mood: número entre 0 (silencio) y 1.5 (1 = volumen normal).');
        }
        if (m.duration != null && (typeof m.duration !== 'number' || m.duration <= 0)) {
          ctx.err(`${p}.music.duration`, 'duration del fade en segundos: número positivo (default 1.2).');
        }
      } else {
        ctx.err(`${p}.music`, 'music es { "volume": 0..1.5, "duration"?: segundos } (agacha o levanta la música ambiental) o el string "stinger" (golpe musical cuantizado a la grilla).');
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
    const toConsumers = ['walk', 'meter', 'tween'].filter(k => s[k] != null);
    if (toConsumers.length > 1) {
      ctx.err(p, `un step no puede combinar ${toConsumers.join(' + ')}: los tres leen "to". Sepáralos en steps distintos.`);
    }
    if (s.tween != null) {
      if (typeof s.tween !== 'string') ctx.err(`${p}.tween`, 'tween es la clave de state a animar ("deuda"), "idEntidad.propiedad" ("alma._alpha") o "ambient.darkness".');
      else if (s.tween.includes('.')) {
        const id = s.tween.slice(0, s.tween.indexOf('.'));
        if (id === 'ambient') {
          const key = s.tween.slice(s.tween.indexOf('.') + 1);
          if (key !== 'darkness' && key !== 'saturation') ctx.warn(`${p}.tween`, `"ambient.${key}" no es una clave animable documentada del ambiente; las conocidas son "ambient.darkness" y "ambient.saturation".`);
        } else if (!scope.entityIds.has(id) && !(scope.propIds && scope.propIds.has(id))) {
          const msg = `"${id}" no es el id de ninguna entidad ni prop declarado (${list(scope.entityIds) || 'ninguna'}), ni el prefijo "ambient".`;
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
    } else {
      for (const k of ['show', 'hide', 'series', 'reveal']) {
        if (s[k] != null) ctx.err(`${p}.${k}`, `"${k}" solo tiene sentido junto a "chart": "<id>".`);
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
        hasHooks: Object.values(config.hooks || {}).some(v => typeof v === 'string' && v.trim()),
        hasMusic: typeof config.meta?.music === 'string' && config.meta.music.trim() !== '',
      };
      vSteps(ctx, config.script, 'script', scope);
      if (Array.isArray(config.script) && config.script.some(s => s && s.loop === true && s.path == null)) {
        ctx.warn('script', 'el guion tiene "loop": true: la escena nunca termina, así que el motor nunca mostrará "Ver nuevamente". Quita el loop salvo que la escena sea deliberadamente ambiental.');
      }
    }
    if (config.form != null) vForm(ctx, config);
    checkMovement(ctx, config);
    return { errors, warnings };
  }

  return { validateScene };
}
