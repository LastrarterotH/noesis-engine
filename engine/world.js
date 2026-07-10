// noesis-engine / world
// World class: simulation state + tick + draw orchestration.
// Owns entities, camera, scripts, fx, bubbles, labels, ambient, audio handles.

import { mulberry32, ease, colorAlpha, mixColors, drawRichText, measureRichText, drawLabel, measureLabel, formatAPA, htmlToText } from './util.js?v=149';
import { compileHooks } from './hooks.js?v=149';
import { createAmbientSound } from './audio.js?v=149';
import { SKY_PRESETS } from './sky-presets.js?v=149';
import { computeSolidBox, drawProp } from './prop-draw.js?v=149';
import { PROP_NATURAL_SCALE, PROP_SPRITES, depthScale } from './prop-sprites.js?v=149';
import { Draw } from './draw.js?v=149';
import { initCamera, tickCamera } from './camera.js?v=149';
import { makeAmbientParticle, tickAmbient, drawAmbient } from './ambient.js?v=149';
import {
  runScript as _runScript, stopScripts as _stopScripts, tickScripts,
  evalScriptExpr, processScript, execScriptStep,
} from './scripts.js?v=149';
import { compileForm } from './forms.js?v=149';
import { drawFloor } from './floor.js?v=149';
import { tickAnimatedProps } from './animated-props.js?v=149';
import { initLearner, touchLearner, tickLearner } from './learner.js?v=149';
import { handleClick, togglePropInteraction } from './interaction.js?v=149';
import {
  createFxApi, spawnBubble, spawnParticles, tickFx, positionBubbles, drawFx,
} from './fx.js?v=149';

// Props que emiten luz solos cuando hay `ambient.darkness` (opt-out con
// `light: false` en el prop). `dy` ubica la fuente en celdas del sprite
// (la bombilla, la llama); `r` es el radio del haz en celdas.
const LIGHT_EMITTERS = {
  lamp:       { dy: -10, r: 16 },
  streetlamp: { dy: -10, r: 16 },
  candle:     { dy: -7,  r: 9 },
  bonfire:    { dy: -3,  r: 15 },
};

export class World {
  _initCamera() { initCamera(this); }
  _tickCamera(dt) { tickCamera(this, dt); }
  _makeAmbientParticle(kind, anywhere = false) { return makeAmbientParticle(this, kind, anywhere); }
  _tickAmbient(dt) { tickAmbient(this, dt); }
  _drawAmbient(ctx) { drawAmbient(this, ctx); }
  _drawWatermark(ctx) {
    ctx.save();
    const x = this.W - 14;
    const y = this.H - 12;
    ctx.font = '600 11px "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(10,12,22,0.85)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(244,172,29,0.95)';
    ctx.fillText('.', x, y);
    const dotW = ctx.measureText('.').width;
    ctx.fillStyle = 'rgba(251,250,246,0.78)';
    ctx.fillText('noesis', x - dotW, y);
    ctx.restore();
  }
  // Logo institucional opcional (co-branding) en la esquina inferior IZQUIERDA.
  // No toca el wordmark "noesis." (que sigue inalienable a la derecha). La
  // imagen la carga element.js y la deja en world._logo cuando está lista; se
  // dibuja en screen-space, así entra también en la grabación. Si la imagen es
  // cross-origin sin CORS no carga (crossOrigin anonymous), y aquí se omite, de
  // modo que nunca contamina el canvas ni rompe la grabación.
  _drawLogo(ctx) {
    const lg = this._logo;
    if (!lg || !lg.img || !lg.img.complete || !lg.img.naturalWidth) return;
    const h = lg.height || 26;
    const w = h * (lg.img.naturalWidth / lg.img.naturalHeight);
    const x = 14, y = this.H - 10 - h;
    ctx.save();
    ctx.globalAlpha = lg.opacity != null ? lg.opacity : 0.92;
    ctx.shadowColor = 'rgba(10,12,22,0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    try { ctx.drawImage(lg.img, x, y, w, h); } catch {}
    ctx.restore();
  }
  _drawFloor(ctx) { drawFloor(this, ctx); }
  runScript(steps, opts = {}) { return _runScript(this, steps, opts); }
  stopScripts(id) { return _stopScripts(this, id); }
  _tickScripts(dt) { tickScripts(this, dt); }
  _evalScriptExpr(expr) { return evalScriptExpr(this, expr); }
  _processScript(sc) { processScript(this, sc); }
  _execScriptStep(step, sc) { execScriptStep(this, step, sc); }
  _tickAnimatedProps(dt) { tickAnimatedProps(this, dt); }
  _initLearner(e) { initLearner(this, e); }
  _touchLearner(e) { touchLearner(this, e); }
  _tickLearner(e, dt) { tickLearner(this, e, dt); }
  handleClick(x, y, sx, sy) { handleClick(this, x, y, sx, sy); }
  _togglePropInteraction(p) { togglePropInteraction(this, p); }
  get fx() { return this._fxApi ??= createFxApi(this); }
  _spawnBubble(entity, html, opts) { return spawnBubble(this, entity, html, opts); }
  _spawnParticles(x, y, opts = {}) { return spawnParticles(this, x, y, opts); }
  _tickFx(dt) { tickFx(this, dt); }
  _positionBubbles() { positionBubbles(this); }
  _drawFx(ctx) { drawFx(this, ctx); }
  _tickTransition() {
    if (this._transitionScrim == null) { this._transitionScrim = 0; this._transitionTarget = 0; }
    const lerp = 0.08;
    this._transitionScrim += (this._transitionTarget - this._transitionScrim) * lerp;
  }
  _drawTransitionScrim(ctx) {
    if (!this._transitionScrim || this._transitionScrim < 0.02) return;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,' + Math.min(1, this._transitionScrim).toFixed(3) + ')';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.restore();
  }

  constructor(config, canvas, host) {
    this.config = config;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.host = host;
    // Logical coordinate space scenes author in (canvas.w/h). The canvas
    // backing store may be supersampled (canvas.width = W * _ss) for crisp
    // text; runDraw scales the context by _ss so logical coords map onto it.
    this.W = (config.canvas && config.canvas.w) || canvas.width;
    this.H = (config.canvas && config.canvas.h) || canvas.height;
    this._ss = canvas.width / this.W || 1;
    this.t = 0;
    this.frame = 0;
    this.entities = [];
    this.state = {};
    this.rng = mulberry32(config.seed || 1);
    this._compiled = compileHooks(config.hooks || {});
    this.draw = new Draw(this);
    this._initCamera();
    this._loadEntities();
  }

  // Resolve a coord that may be: number (>=1 = px, 0..1 = fraction of ref),
  // string anchor ("left+10", "right-20", "center", "top+5", "bottom-30"),
  // or undefined. axis is 'x' or 'y' (determines which side names are valid).
  _resolveCoord(val, ref, axis) {
    if (typeof val === 'number') {
      return (val >= 0 && val <= 1) ? val * ref : val;
    }
    if (typeof val !== 'string') return val;
    const safe = this._safeArea();
    const m = val.trim().match(/^([a-zA-Z]+)\s*([+\-])?\s*(\d+(?:\.\d+)?)?$/);
    if (!m) return val;
    const [, name, op, num] = m;
    const delta = num ? (op === '-' ? -1 : 1) * parseFloat(num) : 0;
    let base;
    if (axis === 'x') {
      if (name === 'left')   base = safe.left;
      else if (name === 'right')  base = ref - safe.right;
      else if (name === 'center') base = ref / 2;
      else return val;
    } else {
      if (name === 'top')    base = safe.top;
      else if (name === 'bottom') base = ref - safe.bottom;
      else if (name === 'middle' || name === 'center') base = ref / 2;
      else return val;
    }
    return base + delta;
  }

  _safeArea() {
    const sa = this.config.canvas?.safeArea;
    if (typeof sa === 'number') return { top: sa, right: sa, bottom: sa, left: sa };
    if (sa && typeof sa === 'object') {
      return {
        top:    sa.top    ?? 18,
        right:  sa.right  ?? 18,
        bottom: sa.bottom ?? 18,
        left:   sa.left   ?? 18,
      };
    }
    return { top: 18, right: 18, bottom: 18, left: 18 };
  }

  _loadEntities() {
    // Extensión horizontal del mundo. Sin sets, el mundo termina en W; con
    // sets, los learners viven también en las franjas de los sets lejanos
    // (el clamp de bounds de learner.js usa este borde, no W).
    this.worldRight = this.W;
    for (const st of (this.config.sets || [])) {
      if (st && typeof st.cx === 'number') {
        this.worldRight = Math.max(this.worldRight, st.cx + this.W / 2);
      }
    }
    const ents = this.config.entities || [];
    for (const e of ents) {
      const ent = { ...e };
      ent.x = this._resolveCoord(ent.x, this.W, 'x');
      ent.y = this._resolveCoord(ent.y, this.H, 'y');
      if (ent.type === 'learner') this._initLearner(ent);
      this.entities.push(ent);
    }
    // World layer: props, walls, zones. Coords can be fractional or anchor strings.
    const denormalize = (val, ref) => (typeof val === 'number' && val <= 1 && val >= 0) ? val * ref : val;
    const resolveX = (v) => this._resolveCoord(v, this.W, 'x');
    const resolveY = (v) => this._resolveCoord(v, this.H, 'y');
    this.props = (this.config.props || []).map(p => {
      const prop = {
        ...p,
        x: resolveX(p.x),
        y: resolveY(p.y),
        // Sin scale explícito, cada tipo toma su tamaño natural (proporciones
        // coherentes entre sí y con los aprendices). Ver PROP_NATURAL_SCALE.
        scale: p.scale || PROP_NATURAL_SCALE[p.type] || 3,
      };
      // Profundidad declarativa: `far` (0 = primer plano … 1 = horizonte) hace
      // DOS cosas coherentes de un tiro: encoge el tamaño aparente (lo lejano se
      // ve chico, factor `depthScale`) y lo manda a su capa (z automático, más
      // atrás cuanto más lejos). El autor pone el `scale` como el tamaño del
      // objeto DE CERCA (proporcional a su tamaño real, ver la tabla de escala de
      // referencia) y la profundidad hace el resto: un avión grande que vuela
      // lejos sale chico y por DETRÁS de los edificios, nunca diminuto y por
      // delante. `z` explícito, si se declara, gana sobre el z de la profundidad.
      // (Es `far`, no `depth`, porque `depth` ya es un parámetro de dibujo del
      // prop `pasture`.)
      if (p.far != null) {
        const d = Math.max(0, Math.min(1, p.far));
        prop.scale = prop.scale * depthScale(d);
        if (p.z == null) prop.z = -Math.round(d * 100);
      }
      if (prop.solid) computeSolidBox(prop);
      return prop;
    });
    this.walls = (this.config.walls || []).map(w => ({
      ...w,
      x: resolveX(w.x),
      y: resolveY(w.y),
      w: denormalize(w.w, this.W),
      h: denormalize(w.h, this.H),
    }));
    this.zones = (this.config.zones || []).map(z => ({
      ...z,
      x: resolveX(z.x),
      y: resolveY(z.y),
      w: denormalize(z.w, this.W),
      h: denormalize(z.h, this.H),
    }));
    this._fx = [];
    this._tweens = [];
    // Movers de props (step `path` sobre un prop con id): los props no tienen
    // behaviors de learner, así que el motor los avanza en _tickPropMovers.
    this._propMovers = [];
    this._bubbles = new Map();
    this._dialogues = [];
    this._dialogueId = 0;
    // Tracked timeouts: setTimeout calls registered here are cleared on reset.
    this._timeouts = this._timeouts || new Set();
    const W = this;
    // Barrido silencioso de la línea de tiempo: durante un seek/medición se
    // re-simula el guion en un bucle síncrono. Un setTimeout con delay real se
    // dispararía en wall-clock DESPUÉS del barrido, fuera de lugar; durante
    // `_seeking` se ejecutan inline (ver setTimeout más abajo) para que su
    // efecto quede ASENTADO en el estado final del seek. El resto lo maneja el
    // runner time-based.
    this._seeking = false;
    // Duración total del contenido (fin del guion 'main'), medida al arrancar
    // por measureDuration(). null = escena sin fin declarativo (hooks o loop):
    // solo pausa, sin barra scrubbable. OJO: _loadEntities corre en CADA reset()
    // y un seek hacia atrás llama reset(); `??=` preserva la duración ya medida
    // (no es estado de simulación, es metadata de la escena). Sin esto, retroceder
    // borraba la duración y la barra desaparecía para siempre.
    this._duration ??= null;
    this.setTimeout = (fn, ms) => {
      // Durante un barrido de seek/medición ejecutar el callback inline: colapsa
      // su efecto al instante del barrido, así una transición de escena
      // (transitionTo agenda el teleport de cámara y el fin del fade con
      // setTimeout) queda asentada en el estado final del seek en vez de dejar
      // la pantalla en negro con la cámara vieja. En play normal se agenda igual.
      if (W._seeking) { try { fn(); } catch (e) { console.warn('[noesis-scene] seek timeout error', e); } return -1; }
      const id = setTimeout(() => { W._timeouts.delete(id); try { fn(); } catch (e) { console.warn('[noesis-scene] timeout error', e); } }, ms);
      W._timeouts.add(id);
      return id;
    };
    this._greets = new Map();
    this._floorCache = null;
    // Ambient: tint + particle system (rain, snow, petals, leaves, fireflies).
    // Copia superficial: el step `tween` puede animar claves del ambient en
    // vivo (ej. "ambient.darkness" en un amanecer) y el reset debe volver a
    // los valores del JSON, no heredar la mutación.
    this._ambient = this.config.ambient ? { ...this.config.ambient } : null;
    this._ambientParticles = [];
    this._ambientSpawnAccum = 0;
    // Tear down previous ambient sounds if reloading entities (reset).
    if (this._ambientSoundMap) {
      for (const [, s] of this._ambientSoundMap) s.stop(0.2);
    }
    this._ambientSoundMap = new Map();
    // Start configured ambient sounds.
    if (this._ambient?.sound && !this._muted) {
      const list = Array.isArray(this._ambient.sound) ? this._ambient.sound : [this._ambient.sound];
      for (const name of list) {
        const sound = createAmbientSound(name, this._ambient.soundVolume);
        if (sound) this._ambientSoundMap.set(name, sound);
      }
    }
    if (this._ambient?.particles === 'fireflies' || this._ambient?.particles === 'stars') {
      // Pre-spawn a base population for ambient point sources.
      const target = this._ambient.particles === 'fireflies' ? 18 : 90;
      for (let i = 0; i < target; i++) {
        this._ambientParticles.push(this._makeAmbientParticle(this._ambient.particles, true));
      }
    }
  }

  showLabel(id) { const el = this._labels?.get(id); if (el) el.classList.remove('hidden'); }
  hideLabel(id) { const el = this._labels?.get(id); if (el) el.classList.add('hidden'); }
  setLabel(id, html) { const el = this._labels?.get(id); if (el) el.innerHTML = html; }

  spawn(type, props) {
    const ent = { type, ...props, id: 'e' + (this.frame) + '_' + this.entities.length };
    this.entities.push(ent);
    return ent;
  }

  spawnLearner(props = {}) {
    const ent = {
      type: 'learner',
      id: props.id || ('L' + this.frame + '_' + this.entities.length),
      x: props.x ?? this.W / 2,
      y: props.y ?? this.H / 2,
      scale: props.scale ?? 4,
      hero: props.hero ?? true,
      body: props.body || '#d8a878',
      name: props.name || null,
      accessory: props.accessory || null,
      behavior: props.behavior || { type: 'idleWander', amplitude: 18 },
      ...props,
    };
    if (ent.x <= 1 && ent.x >= 0) ent.x = ent.x * this.W;
    if (ent.y <= 1 && ent.y >= 0) ent.y = ent.y * this.H;
    this._initLearner(ent);
    this.entities.push(ent);
    return ent;
  }

  byId(id) { return this.entities.find(e => e.id === id) || null; }

  // tween: animate one or more numeric properties of `obj` over time.
  //   world.tween(obj, 'x', 100, opts)            single property
  //   world.tween(obj, { x: 100, y: 50 }, opts)   multiple properties
  // opts: duration (s, default 0.6), easing (see util.ease, default
  //   'easeInOut'), delay (s), onStart(obj), onUpdate(obj, u), onDone(obj).
  // `from` is captured when the tween actually starts (after any delay), so
  // chained tweens read the current value. Returns a handle with .cancel().
  // Cleared on scene reset.
  tween(obj, a, b, c) {
    let props, opts;
    if (typeof a === 'string') { props = [{ key: a, to: b }]; opts = c || {}; }
    else { props = Object.entries(a || {}).map(([key, to]) => ({ key, to })); opts = b || {}; }
    const t = {
      obj, props,
      duration: opts.duration ?? 0.6,
      easing: opts.easing ?? 'easeInOut',
      elapsed: -(opts.delay ?? 0),
      onStart: opts.onStart, onUpdate: opts.onUpdate, onDone: opts.onDone,
      _started: false, done: false,
      cancel() { this.done = true; },
    };
    this._tweens.push(t);
    return t;
  }

  // stopTweens: cancel all tweens (optionally only those targeting `obj`).
  stopTweens(obj) {
    if (!this._tweens) return;
    for (const t of this._tweens) if (!obj || t.obj === obj) t.done = true;
  }

  _tickTweens(dt) {
    if (!this._tweens || !this._tweens.length) return;
    for (const t of this._tweens) {
      if (t.done) continue;
      t.elapsed += dt;
      if (t.elapsed < 0) continue;
      if (!t._started) {
        t._started = true;
        for (const p of t.props) p.from = t.obj[p.key] ?? 0;
        if (t.onStart) try { t.onStart(t.obj); } catch {}
      }
      const p = t.duration <= 0 ? 1 : Math.min(1, t.elapsed / t.duration);
      const u = ease(p, t.easing);
      for (const pr of t.props) t.obj[pr.key] = pr.from + (pr.to - pr.from) * u;
      if (t.onUpdate) try { t.onUpdate(t.obj, u); } catch {}
      if (p >= 1) { t.done = true; if (t.onDone) try { t.onDone(t.obj); } catch {} }
    }
    this._tweens = this._tweens.filter(t => !t.done);
  }

  remove(pred) {
    this.entities = this.entities.filter(e => !pred(e));
  }

  // Mueve un prop por una polilínea de waypoints (objetos que viajan: globos,
  // sobres, pelotas). `opts`: speed (px/s) o duration (s) + easing; loop
  // repite desde el inicio (para que sea continuo, cerrar el camino); por
  // defecto arranca en la posición actual (fromCurrent). Un prop tiene un
  // solo mover a la vez. No usar sobre props auto-animados (butterfly, bird):
  // su tick pelearía con el mover frame a frame.
  movePropPath(prop, points, opts = {}) {
    const pts = [];
    if (opts.fromCurrent !== false) pts.push([prop.x, prop.y]);
    for (const pt of points || []) {
      pts.push(Array.isArray(pt) ? [pt[0], pt[1]] : [pt.x, pt.y]);
    }
    if (pts.length < 2) return null;
    const segs = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      segs.push(d); total += d;
    }
    if (!(total > 0)) return null;
    const mover = {
      prop, pts, segs, total,
      duration: opts.duration ?? total / (opts.speed || 70),
      easing: opts.easing, loop: !!opts.loop,
      elapsed: 0, done: false,
    };
    this._propMovers = (this._propMovers || []).filter(m => m.prop !== prop);
    this._propMovers.push(mover);
    return mover;
  }

  _tickPropMovers(dt) {
    if (!this._propMovers || !this._propMovers.length) return;
    for (const m of this._propMovers) {
      if (m.done) continue;
      m.elapsed += dt;
      let p = m.duration > 0 ? m.elapsed / m.duration : 1;
      if (p >= 1) {
        if (m.loop) { m.elapsed = m.elapsed % m.duration; p = m.elapsed / m.duration; }
        else { p = 1; m.done = true; }
      }
      const dist = ease(p, m.easing) * m.total;
      let acc = 0;
      for (let i = 0; i < m.segs.length; i++) {
        if (dist <= acc + m.segs[i] || i === m.segs.length - 1) {
          const u = m.segs[i] > 0 ? Math.max(0, Math.min(1, (dist - acc) / m.segs[i])) : 1;
          m.prop.x = m.pts[i][0] + (m.pts[i + 1][0] - m.pts[i][0]) * u;
          m.prop.y = m.pts[i][1] + (m.pts[i + 1][1] - m.pts[i][1]) * u;
          break;
        }
        acc += m.segs[i];
      }
    }
    this._propMovers = this._propMovers.filter(m => !m.done);
  }

  reset() {
    // Cancel scheduled timeouts so callbacks from the previous run
    // (e.g., packet receive confirmations) don't fire after reset.
    if (this._timeouts) {
      for (const id of this._timeouts) clearTimeout(id);
      this._timeouts.clear();
    }
    // Remove dialogue bubbles from the DOM so old text doesn't ghost
    // through into the next run.
    if (this._bubbles) {
      for (const [, b] of this._bubbles) { try { b.el.remove(); } catch {} }
      this._bubbles.clear();
    }
    if (this._dialogues) this._dialogues.length = 0;
    if (this._fx) this._fx.length = 0;
    if (this._tweens) this._tweens.length = 0;
    // La música (si el usuario la activó) sigue sonando en el replay, pero
    // vuelve a su estado base: un step `music` del guion pudo dejarla
    // agachada, en silencio o sonando en OTRO mood al terminar la corrida.
    if (this._ambientMusic) {
      if (this._musicMood && this._ambientMusic.mood !== this._musicMood) {
        this._ambientMusic.stop(0.8);
        this._ambientMusic = null;
        this.fx.ambientMusic(this._musicMood);
      } else if (this._ambientMusic.baseVolume != null) {
        this._ambientMusic.setVolume(this._ambientMusic.baseVolume, 0.8);
      }
    }
    this.entities = [];
    this.state = {};
    this.t = 0;
    this.frame = 0;
    // Re-siembra el RNG para que cada corrida (replay o seek de la línea de
    // tiempo) reproduzca EXACTAMENTE el mismo estado visual. Sin esto, un seek
    // hacia atrás reconstruye la escena con el RNG en otro punto y los props
    // auto-animados (nubes, pájaros) saltarían de posición.
    this.rng = mulberry32(this.config.seed || 1);
    // Restore camera defaults: otherwise a stale follow target (a now-removed
    // entity), zoom, pan, or in-flight shake leaks into the next run.
    this._initCamera();
    this._loadEntities();
    // Re-bind persistent name labels to the newly created entities (same id).
    if (this._nameLabels) {
      for (const [id, record] of this._nameLabels) {
        const fresh = this.entities.find(e => (e.id || e) === id);
        if (fresh) record.entity = fresh;
      }
    }
    this._scripts = [];
    this._initDeclarative();
    this._compiled.onReset && this._compiled.onReset(this);
    this._compiled.onInit && this._compiled.onInit(this);
    this._runDeclarativeScript();
  }

  runInit() {
    this._initDeclarative();
    this._compiled.onInit && this._compiled.onInit(this);
    this._runDeclarativeScript();
  }

  runStep(dt) {
    this.t += dt;
    this.frame++;
    // FPS smoothing (EMA, exposed for diagnostic overlays).
    const instantFps = dt > 0 ? 1 / dt : 60;
    this.fps = this.fps == null ? instantFps : (this.fps * 0.92 + instantFps * 0.08);
    // Engine-internal tick before user onStep so user code sees fresh state.
    for (const e of this.entities) {
      if (e.type === 'learner') this._tickLearner(e, dt);
    }
    this._tickFx(dt);
    this._tickAmbient(dt);
    this._tickAnimatedProps(dt);
    this._tickPropMovers(dt);
    this._tickCamera(dt);
    this._tickTweens(dt);
    this._tickScripts(dt);
    this._tickReplay();
    this._compiled.onStep && this._compiled.onStep(this, dt);
    this._positionBubbles();
  }

  // --- Línea de tiempo: seek por re-simulación determinista ---
  // La escena es una simulación reproducible (RNG sembrado en reset, runner de
  // scripts y tweens time-based). Para ir a un instante T se re-tickea en
  // silencio hasta world.t == T. Ir hacia ADELANTE continúa desde el estado
  // actual; ir hacia ATRÁS resetea y re-simula desde cero. El audio y los
  // timeouts de efecto se suprimen durante el barrido (ver `_seeking`).
  seek(targetT) {
    const dur = this._duration;
    targetT = Math.max(0, dur != null ? Math.min(targetT, dur) : targetT);
    if (targetT < this.t - 1e-4) this.reset();
    this._silentAdvance(targetT);
    this.runDraw();
  }

  // Avanza la simulación hasta targetT sin dibujar ni sonar. Paso fijo (1/60)
  // para que el barrido sea determinista e independiente del framerate.
  _silentAdvance(targetT) {
    const STEP = 1 / 60;
    const wasMuted = this._muted;
    this._muted = true;
    this._seeking = true;
    let guard = 0;
    while (this.t < targetT - 1e-6 && guard++ < 200000) {
      this.runStep(Math.min(STEP, targetT - this.t));
    }
    this._muted = wasMuted;
    this._seeking = false;
  }

  // Corre la escena en silencio hasta que el guion 'main' termina (mismo
  // criterio que _tickReplay) para conocer la duración del contenido, necesaria
  // para dibujar el scrubber. Devuelve segundos, o null si no termina dentro
  // del presupuesto (guiones con loop o escenas de solo-hooks). Deja la escena
  // reseteada en t=0, lista para el usuario.
  measureDuration() {
    if (!this._replay || !this._replay.armed) { this._duration = null; return null; }
    this.reset();
    const STEP = 1 / 60, MAX_T = 600;
    const wasMuted = this._muted;
    this._muted = true;
    this._seeking = true;
    let dur = null;
    while (this.t < MAX_T) {
      this.runStep(STEP);
      if (!(this._scripts && this._scripts.some(s => s.id === 'main'))) { dur = this.t; break; }
    }
    this._muted = wasMuted;
    this._seeking = false;
    this.reset();
    this._duration = dur;
    return dur;
  }

  runDraw() {
    const ctx = this.ctx;
    const cConf = this.config.canvas || {};
    // Reset + supersample transform: map logical (W x H) onto the larger
    // backing store so all drawing (text included) renders at higher density.
    ctx.setTransform(this._ss, 0, 0, this._ss, 0, 0);
    ctx.fillStyle = cConf.bg || '#0e1430';
    ctx.fillRect(0, 0, this.W, this.H);
    // Optional sky: paint upper region in `canvas.sky` color, with a soft
    // horizon haze transitioning into the ground bg. `canvas.sky` accepts a
    // named preset (SKY_PRESETS) or any CSS color.
    const skyColor = SKY_PRESETS[cConf.sky] || cConf.sky;
    if (skyColor) {
      const horizonFrac = cConf.horizon ?? 0.45;
      const horizonY = Math.round(this.H * horizonFrac);
      ctx.fillStyle = skyColor;
      ctx.fillRect(0, 0, this.W, horizonY);
      const hazeH = Math.min(28, Math.max(6, horizonY * 0.25));
      const grad = ctx.createLinearGradient(0, horizonY - hazeH, 0, horizonY + 4);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.75, 'rgba(0,0,0,0.18)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, horizonY - hazeH, this.W, hazeH + 4);
    }
    // Parallax layers: rendered after sky, before world. Each layer pans
    // horizontally with attenuated camera movement (parallax 0=static,
    // 1=full world). Useful for sky/mountains/forest depth illusion.
    const cam = this.camera;
    const layers = cConf.layers;
    if (Array.isArray(layers) && layers.length) {
      const frac = (v, ref) => (typeof v === 'number' && v >= 0 && v <= 1) ? v * ref : v;
      for (const L of layers) {
        if (!L) continue;
        const px = L.parallax ?? 0.5;
        const top = frac(L.top ?? 0, this.H);
        const bottom = frac(L.bottom ?? 1, this.H);
        const h = Math.max(0, bottom - top);
        ctx.save();
        // alpha animable por capa (para desvanecer el fondo, p.ej. al bajar al inframundo).
        if (L.alpha != null) ctx.globalAlpha *= Math.max(0, Math.min(1, L.alpha));
        ctx.translate((this.W / 2 - cam.x) * px + cam.shakeX * px, 0);
        if (L.color) {
          ctx.fillStyle = L.color;
          ctx.fillRect(-this.W, top, this.W * 3, h);
        }
        if (L.gradient && Array.isArray(L.gradient)) {
          const g = ctx.createLinearGradient(0, top, 0, bottom);
          for (const stop of L.gradient) g.addColorStop(stop.at ?? 0, stop.color);
          ctx.fillStyle = g;
          ctx.fillRect(-this.W, top, this.W * 3, h);
        }
        if (Array.isArray(L.shapes)) {
          for (const sh of L.shapes) {
            ctx.fillStyle = sh.color || '#000';
            const sx = frac(sh.x ?? 0, this.W);
            const sy = top + frac(sh.y ?? 0, h);
            const sw = frac(sh.w ?? 0.2, this.W);
            const shh = frac(sh.h ?? 0.2, h);
            if (sh.kind === 'hill') {
              ctx.beginPath();
              ctx.moveTo(sx - sw / 2, top + h);
              ctx.quadraticCurveTo(sx, sy, sx + sw / 2, top + h);
              ctx.closePath();
              ctx.fill();
            } else {
              ctx.fillRect(sx, sy, sw, shh);
            }
          }
        }
        ctx.restore();
      }
    }
    // Apply camera transform for world layer.
    ctx.save();
    ctx.translate(this.W / 2 + cam.shakeX, this.H / 2 + cam.shakeY);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);
    this._drawFloor(ctx);
    this._drawZones(ctx);
    this._drawWalls(ctx);
    this._drawProps(ctx);
    // Si la escena define onDraw, ella dibuja a los learners; si no (escena
    // declarativa, sin hooks), los dibuja el motor con y-sort.
    if (this._compiled.onDraw) this._compiled.onDraw(this, ctx);
    else this._drawLearners(ctx);
    this._drawFocuses(ctx);
    this._drawCharts(ctx);
    this._drawFormulas(ctx, false);   // fórmulas en espacio de mundo (push-in las agranda)
    this._drawAnnotations(ctx, false); // callouts en espacio de mundo (anclados a lo señalado)
    this._drawDiagrams(ctx, false);    // diagramas declarativos (nodos + edges + textos)
    this._drawFx(ctx);
    ctx.restore();
    // Iluminación: scrim de oscuridad perforado por los emisores, sobre el
    // mundo y bajo las partículas/HUD (las luciérnagas brillan en la noche).
    this._drawLighting(ctx);
    // Ambient (tint, particles) stays in screen space.
    this._drawAmbient(ctx);
    // Letterbox cinematográfico: sobre el mundo y el ambient, bajo el HUD
    // (las captions y el replay se dibujan encima de las barras).
    this._tickLetterbox();
    this._drawLetterbox(ctx);
    // Engine-level transition scrim (fade between sets). Sits above the
    // scene drawing but below the watermark, so "noesis." remains readable
    // during the black moment between sets.
    this._tickTransition();
    this._drawTransitionScrim(ctx);
    // Saturación: dessatura TODO el mundo ya dibujado (gris ↔ color) sin tocar
    // el HUD/captions/watermark, que se pintan después. `ambient.saturation` 0..1.
    this._drawSaturation(ctx);
    // Fórmulas con `screen: true`: callout HUD fijo (inmune a cámara/saturación).
    this._drawFormulas(ctx, true);
    // Anotaciones con `screen: true`: callout HUD fijo (inmune a cámara).
    this._drawAnnotations(ctx, true);
    // Diagramas con `screen: true`: HUD fijo (inmune a cámara).
    this._drawDiagrams(ctx, true);
    // Capa declarativa (captions + meters), en espacio-pantalla, bajo el watermark.
    this._drawDeclarative(ctx);
    // Logo institucional opcional (esquina inferior izquierda), bajo el watermark.
    this._drawLogo(ctx);
    // Watermark: always last, after everything else. Lives in screen space
    // and cannot be overridden by a scene — see CLAUDE.md.
    this._drawWatermark(ctx);
  }

  // --- Capa declarativa: elementos que el engine dibuja sin que la escena
  // escriba JS (escenas con `script`/`form` en vez de hooks).
  // Compila una serie declarada como FUNCIÓN (string en x) a un muestreador,
  // para no pre-muestrear decenas de puntos a mano (una parábola, un seno, una
  // exponencial). Inyecta las funciones de Math comunes sin el prefijo `Math.`
  // (exp, log, sin, pow...). Devuelve null si no compila (el validador ya avisa).
  _compileFn(expr) {
    try {
      const raw = new Function('x', 'exp', 'log', 'log10', 'log2', 'sin', 'cos', 'tan', 'sqrt', 'pow', 'abs', 'min', 'max', 'floor', 'round', 'PI', 'E', 'return (' + expr + ');');
      const M = Math;
      return (x) => { try { const v = raw(x, M.exp, M.log, M.log10, M.log2, M.sin, M.cos, M.tan, M.sqrt, M.pow, M.abs, M.min, M.max, M.floor, M.round, M.PI, M.E); return Number.isFinite(v) ? v : 0; } catch { return 0; } };
    } catch { return null; }
  }

  _initDeclarative() {
    this._caption = { text: '' };
    // Segundo slot de texto: el título de acto (banda superior). Independiente
    // de la caption; lo fija el step `caption` con `style: "title"`.
    this._title = { text: '' };
    // Focos declarativos (step `focus` de scripts.js): halos de luz pulsantes
    // sobre una entidad o un punto. Cada uno: { key, target, color, radius,
    // alpha (lo anima world.tween), phase }.
    this._focuses = [];
    // Replay declarativo: para escenas con `script` top-level el motor ofrece
    // "Ver nuevamente" solo, cuando el guion termina y tras el tiempo de
    // gracia de 3 s (regla de CLAUDE.md). Las escenas con hooks siguen
    // dibujando su propio botón; esto solo se arma con config.script.
    this._replay = {
      armed: (Array.isArray(this.config.script) && this.config.script.length > 0)
        || (this.config.form && typeof this.config.form === 'object'),
      doneAt: null, visible: false, box: null,
    };
    this._meters = (this.config.meters || []).map(m => ({
      id: m.id, label: m.label || '', x: m.x ?? 48, y: m.y ?? 46,
      w: m.w ?? 300, h: m.h ?? 16,
      // color: un hex fijo, o stops [{at, color}] que viran con el valor
      // (ej. ámbar abajo, rojo arriba). Se ordenan por `at` por las dudas.
      color: Array.isArray(m.color)
        ? m.color.slice().sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
        : (m.color || '#5b8def'),
      max: m.max ?? 1, value: m.value ?? 0, showValue: m.showValue !== false,
    }));
    this._meterById = {};
    for (const m of this._meters) this._meterById[m.id] = m;
    // Charts declarativos: gráficos (línea/barras) que el guion muestra y
    // revela con el step `chart`, sin JS. Se dibujan en espacio de mundo
    // (dentro de la cámara), así un push-in los agranda como en la escena 15.
    this._charts = (this.config.charts || []).map(c => ({
      id: c.id, type: c.type === 'bars' ? 'bars' : 'line',
      x: c.x ?? 60, y: c.y ?? 60, w: c.w ?? 300, h: c.h ?? 170,
      xDomain: c.xDomain || [0, 1], yDomain: c.yDomain || [0, 1],
      xScale: c.xScale === 'log' ? 'log' : undefined, yScale: c.yScale === 'log' ? 'log' : undefined,
      xTicks: c.xTicks, yTicks: c.yTicks,
      xLabel: c.xLabel, yLabel: c.yLabel,
      xFormat: c.xFormat || '', yFormat: c.yFormat || '',
      title: c.title || '', target: c.target || null,
      panel: c.panel !== false, alpha: c.alpha ?? 1,
      reveal: c.reveal ?? 1, gap: c.gap ?? 0.32, color: c.color || '#5b8def',
      values: (c.values || []).map(v => ({ ...v })),
      series: (c.series || []).map(sr => ({
        id: sr.id, color: sr.color || '#5b8def', width: sr.width ?? 2.5,
        fill: sr.fill || false, dash: sr.dash, dots: sr.dots,
        data: sr.data || [], reveal: sr.reveal ?? 1,
        fn: sr.fn ? this._compileFn(sr.fn) : null, head: sr.head || null,
      })),
    }));
    this._chartById = {};
    for (const c of this._charts) this._chartById[c.id] = c;
    // Fórmulas declarativas: ecuaciones apiladas (world.draw.math) que el guion
    // muestra/anima con el step `formula`, sin escribir onDraw. Se dibujan en
    // espacio de mundo por defecto (un push-in las agranda), o en pantalla con
    // `screen: true` (callout HUD fijo). `tex` es un string o un array de
    // segmentos { tex, color } que se dibujan en fila (para resaltar un
    // resultado en otro color). `panel` opcional dibuja una tarjeta de respaldo.
    this._formulas = (this.config.formulas || []).map(f => ({
      id: f.id,
      segs: (Array.isArray(f.tex) ? f.tex : [f.tex])
        .map(s => (typeof s === 'string' ? { tex: s } : s))
        .filter(s => s && s.tex),
      x: f.x ?? this.W / 2, y: f.y ?? 40,
      px: f.px ?? 22, color: f.color || '#f4e8c6', weight: f.weight || '600',
      family: f.family, align: f.align || 'center', valign: f.valign || 'middle',
      alpha: f.alpha ?? 1, screen: f.screen === true,
      panel: f.panel ? (typeof f.panel === 'object' ? f.panel : {}) : null,
    }));
    this._formulaById = {};
    for (const f of this._formulas) this._formulaById[f.id] = f;
    // Anotaciones/callouts declarativos: un chip de texto anclado a una
    // entidad, prop, chart o punto por una línea guía, que el guion revela con
    // el step `annotation`. Es la herramienta de la mecánica de disección
    // (nombrar cada parte señalándola) sin escribir onDraw. Se dibujan en
    // espacio de mundo por defecto (un push-in los agranda) o en pantalla con
    // `screen: true`. `text` respeta la notación (_/^ y $...$): se pinta con
    // drawLabel. `dx`/`dy` desplazan el chip desde el objetivo (pueden ser
    // negativos). `\n` en el texto hace varias líneas.
    this._annotations = (this.config.annotations || []).map(a => ({
      id: a.id,
      target: Array.isArray(a.target) ? { x: a.target[0], y: a.target[1] } : a.target,
      lines: String(a.text ?? '').split('\n'),
      dx: a.dx ?? 64, dy: a.dy ?? -48,
      px: a.px ?? 13, weight: a.weight || '600', align: a.align || 'left',
      color: a.color || '#F4AC1D', textColor: a.textColor || '#FBFAF6',
      bg: a.bg || 'rgba(31,37,71,0.94)',
      dot: a.dot !== false, head: a.head === true,
      alpha: a.alpha ?? 1, screen: a.screen === true,
    }));
    this._annotationById = {};
    for (const a of this._annotations) this._annotationById[a.id] = a;
    // Diagramas declarativos: flujos/grafos/mapas (nodos + conectores por id de
    // nodo + textos + panel de respaldo) que el guion muestra y revela sin
    // escribir onDraw. Es el envoltorio declarativo del toolkit de diagramas
    // (draw.node/connector/arrow): cero código de dibujo nuevo. Dos escalares
    // animables por el step `diagram`: `alpha` (opacidad del grupo, para el
    // cross-fade entre diagramas) y `reveal` (barrido escalonado: cada hijo
    // entra en su umbral `at` con ancho `fadeIn`). El `at` sin declarar se
    // reparte parejo en orden panel→nodos→edges→texts (cascada sin solaparse
    // con las dependencias). Reset-safe (se re-materializa del config).
    this._diagrams = (this.config.diagrams || []).map(d => {
      const nodes = (d.nodes || []).map(n => ({ ...n }));
      const edges = (d.edges || []).map(e => ({ ...e }));
      const texts = (d.texts || []).map(t => ({ ...t }));
      const panel = d.panel ? { ...d.panel } : null;
      const children = [...(panel ? [panel] : []), ...nodes, ...edges, ...texts];
      const N = children.length;
      children.forEach((c, i) => {
        if (c.at == null) c.at = N > 1 ? (i / (N - 1)) * 0.82 : 0;
        if (c.fadeIn == null) c.fadeIn = 0.15;
      });
      return {
        id: d.id, alpha: d.alpha ?? 1, reveal: d.reveal ?? 1,
        screen: d.screen === true, panel, nodes, edges, texts,
      };
    });
    this._diagramById = {};
    for (const d of this._diagrams) this._diagramById[d.id] = d;
    // Sets de cámara declarativos: vistas nombradas que el step `scene`
    // activa con fade a negro + teleport (fx.transitionTo). La cámara
    // arranca en el primer set de la lista.
    this._sets = (this.config.sets || []).map(st => ({
      id: st.id, cx: st.cx, cy: st.cy ?? this.H / 2, zoom: st.zoom,
    }));
    this._setById = {};
    for (const st of this._sets) this._setById[st.id] = st;
    // El set "actual" (lo actualiza el step `scene`): el camera reset
    // declarativo vuelve a su encuadre, no al del primer set.
    this._currentSet = this._sets.length ? this._sets[0] : null;
    if (this._sets.length) {
      const first = this._sets[0];
      this.camera.x = this.camera.targetX = first.cx;
      this.camera.y = this.camera.targetY = first.cy;
      if (first.zoom != null) this.camera.zoom = this.camera.targetZoom = first.zoom;
    }
    // Letterbox cinematográfico (step camera.letterbox): barras superior e
    // inferior con fade, en screen-space sobre el mundo y bajo el HUD.
    this._letterbox = 0;
    this._letterboxTarget = 0;
    // Scrim de transición de escena (fade a negro de transitionTo): limpiarlo
    // en cada reset para que un seek/replay no arranque con la pantalla a medio
    // fundir de una transición previa.
    this._transitionScrim = 0;
    this._transitionTarget = 0;
  }

  _tickLetterbox() {
    if (this._letterbox == null) { this._letterbox = 0; this._letterboxTarget = 0; }
    this._letterbox += ((this._letterboxTarget || 0) - this._letterbox) * 0.06;
  }

  _drawLetterbox(ctx) {
    if (!this._letterbox || this._letterbox < 0.02) return;
    const h = Math.round(this.H * 0.09 * Math.min(1, this._letterbox));
    ctx.save();
    ctx.fillStyle = '#06080f';
    ctx.fillRect(0, 0, this.W, h);
    ctx.fillRect(0, this.H - h, this.W, h);
    ctx.restore();
  }

  _drawCharts(ctx) {
    if (!this._charts || !this._charts.length) return;
    const UIQ = '"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, sans-serif';
    const fmt = (suffix) => (v) => {
      const r = Math.round(v * 10) / 10;
      return (Math.abs(r % 1) < 0.05 ? String(Math.round(r)) : String(r)) + (suffix || '');
    };
    for (const c of this._charts) {
      if (!c.alpha || c.alpha < 0.01) continue;
      ctx.save();
      ctx.globalAlpha *= Math.min(1, c.alpha);
      if (c.panel) {
        ctx.fillStyle = 'rgba(9,12,27,0.62)';
        this._declRrect(ctx, c.x - 26, c.y - 28, c.w + 50, c.h + 56, 12); ctx.fill();
        ctx.strokeStyle = 'rgba(110,120,150,0.30)'; ctx.lineWidth = 1;
        this._declRrect(ctx, c.x - 26, c.y - 28, c.w + 50, c.h + 56, 12); ctx.stroke();
      }
      if (c.title) {
        ctx.fillStyle = '#d4dbeb'; ctx.font = '600 11px ' + UIQ;
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        drawLabel(ctx, String(c.title).toUpperCase(), c.x - 12, c.y - 12);
      }
      const f = this.draw.axes(c.x, c.y, c.w, c.h, {
        xDomain: c.xDomain, yDomain: c.yDomain, xScale: c.xScale, yScale: c.yScale,
        xTicks: c.xTicks, yTicks: c.yTicks,
        xLabel: c.xLabel, yLabel: c.yLabel,
        xFormat: fmt(c.xFormat), yFormat: fmt(c.yFormat),
        color: 'rgba(232,226,210,0.45)', labelColor: '#9aa3bd',
      });
      if (c.target && typeof c.target.y === 'number') {
        this.draw.plot(f, [[c.xDomain[0], c.target.y], [c.xDomain[1], c.target.y]], {
          color: c.target.color || '#c44a3e', dash: [5, 4], width: 1.5,
        });
        if (c.target.label) {
          const py = f.map(c.xDomain[0], c.target.y).y;   // via map: correcto también en escala log
          ctx.fillStyle = c.target.color || '#c44a3e'; ctx.font = '600 10px ' + UIQ;
          ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
          drawLabel(ctx, c.target.label, c.x + 8, py + 14);
        }
      }
      if (c.type === 'bars') {
        this.draw.bars(f, c.values, {
          reveal: Math.max(0, Math.min(1, c.reveal)),
          labels: true, labelColor: '#9aa3bd', color: c.color, gap: c.gap,
        });
      } else {
        for (const sr of c.series) {
          this.draw.plot(f, sr.fn || sr.data, {
            color: sr.color, width: sr.width, dash: sr.dash, dots: sr.dots,
            reveal: Math.max(0, Math.min(1, sr.reveal)), fill: sr.fill, head: sr.head,
          });
        }
      }
      ctx.restore();
    }
  }

  // Fórmulas declarativas (world.draw.math sin onDraw). `screen` selecciona la
  // pasada: false = espacio de mundo (dentro de la cámara), true = pantalla.
  _drawFormulas(ctx, screen) {
    if (!this._formulas || !this._formulas.length) return;
    const UIQ = '"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, sans-serif';
    for (const f of this._formulas) {
      if (!!f.screen !== !!screen) continue;
      if (f.alpha < 0.01 || !f.segs.length) continue;
      const fam = f.family || UIQ;
      const baseOpts = { px: f.px, weight: f.weight, family: fam };
      const gap = f.px * 0.5;
      // Mide cada segmento; la fila comparte baseline (ascenso/descenso máximos).
      let asc = 0, desc = 0;
      const ms = f.segs.map(s => {
        const m = this.draw.measureMath(s.tex, baseOpts);
        asc = Math.max(asc, m.ascent); desc = Math.max(desc, m.descent);
        return m;
      });
      const totalW = ms.reduce((a, m) => a + m.w, 0) + gap * (f.segs.length - 1);
      const height = asc + desc;
      const left = f.align === 'center' ? f.x - totalW / 2 : f.align === 'right' ? f.x - totalW : f.x;
      const baseline = f.valign === 'middle' ? f.y + (asc - desc) / 2
        : f.valign === 'top' ? f.y + asc : f.valign === 'bottom' ? f.y - desc : f.y;
      const top = baseline - asc;
      ctx.save();
      ctx.globalAlpha *= Math.min(1, f.alpha);
      if (f.panel) {
        const p = f.panel, pad = p.pad ?? 18, titleH = p.title ? 22 : 0, r = p.radius ?? 12;
        const bx = left - pad, by = top - pad - titleH, bw = totalW + pad * 2, bh = height + pad * 2 + titleH;
        ctx.fillStyle = p.bg || 'rgba(31,37,71,0.93)';
        this._declRrect(ctx, bx, by, bw, bh, r); ctx.fill();
        if (p.border !== false) {
          ctx.strokeStyle = typeof p.border === 'string' ? p.border : 'rgba(244,172,29,0.30)';
          ctx.lineWidth = 1; this._declRrect(ctx, bx, by, bw, bh, r); ctx.stroke();
        }
        if (p.title) {
          ctx.fillStyle = p.titleColor || '#c9d2e6';
          ctx.font = '600 10px ' + fam; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
          try { ctx.letterSpacing = '1.5px'; } catch {}
          ctx.fillText(String(p.title).toUpperCase(), left + totalW / 2, by + 15);
          try { ctx.letterSpacing = '0px'; } catch {}
        }
      }
      let cx = left;
      for (let k = 0; k < f.segs.length; k++) {
        this.draw.math(cx, baseline, f.segs[k].tex, { ...baseOpts, color: f.segs[k].color || f.color, align: 'left', valign: 'baseline' });
        cx += ms[k].w + gap;
      }
      ctx.restore();
    }
  }

  // Anotaciones/callouts declarativos: un chip de texto + una línea guía hacia
  // un objetivo (entidad / prop / chart / punto). Reusa `_focusPoint` para
  // resolver el objetivo (y respeta su ocultamiento: una entidad `vanish`-eada
  // no recibe callout). El texto respeta la notación (drawLabel). `screen`
  // separa los callouts de mundo (bajo la cámara) de los de HUD fijo.
  _drawAnnotations(ctx, screen) {
    if (!this._annotations || !this._annotations.length) return;
    const UIQ = '"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, sans-serif';
    for (const a of this._annotations) {
      if (!!a.screen !== !!screen) continue;
      if (a.alpha < 0.01 || !a.lines.length) continue;
      const pt = this._focusPoint({ target: a.target });
      if (!pt) continue;
      // Los ids (entidad/prop/chart) traen radio: la guía se recorta al borde
      // del cuerpo. Un punto [x,y] no: la guía llega al punto exacto.
      const isId = typeof a.target === 'string';
      const tx = pt.x, ty = pt.y, tr = isId ? (pt.r || 0) : 0;
      ctx.save();
      ctx.globalAlpha *= Math.min(1, a.alpha);
      // Medir el chip (varias líneas: el ancho es el máximo, con notación).
      ctx.font = `${a.weight} ${a.px}px ${UIQ}`;
      const lineH = a.px * 1.34;
      let tw = 0;
      for (const ln of a.lines) tw = Math.max(tw, measureLabel(ctx, ln));
      const padX = 10, padY = 7;
      const bw = tw + padX * 2, bh = a.lines.length * lineH + padY * 2;
      // El chip se centra en objetivo + (dx, dy).
      const ccx = tx + a.dx, ccy = ty + a.dy;
      const bx = ccx - bw / 2, by = ccy - bh / 2;
      // Salida de la guía: el borde del chip que mira al objetivo (ray-box).
      const ex = tx - ccx, ey = ty - ccy;
      let sx = ccx, sy = ccy;
      if (Math.abs(ex) > 1e-3 || Math.abs(ey) > 1e-3) {
        const t = Math.min(
          Math.abs(ex) > 1e-3 ? (bw / 2) / Math.abs(ex) : Infinity,
          Math.abs(ey) > 1e-3 ? (bh / 2) / Math.abs(ey) : Infinity);
        sx = ccx + ex * t; sy = ccy + ey * t;
      }
      // Fin de la guía: en el borde del objetivo (recorte por su radio).
      const dlen = Math.hypot(tx - sx, ty - sy) || 1;
      const ux = (tx - sx) / dlen, uy = (ty - sy) / dlen;
      const endX = tx - ux * tr, endY = ty - uy * tr;
      // Línea guía + punto (o punta de flecha) en el objetivo.
      ctx.strokeStyle = a.color; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(endX, endY); ctx.stroke();
      if (a.head) {
        this.draw._arrowhead(endX, endY, Math.atan2(endY - sy, endX - sx), 7, a.color);
      } else if (a.dot) {
        ctx.fillStyle = a.color;
        ctx.beginPath(); ctx.arc(endX, endY, 3, 0, Math.PI * 2); ctx.fill();
      }
      // Chip (tarjeta redondeada con borde en el color de la anotación).
      this._declRrect(ctx, bx, by, bw, bh, 7); ctx.fillStyle = a.bg; ctx.fill();
      ctx.strokeStyle = a.color; ctx.lineWidth = 1.5;
      this._declRrect(ctx, bx, by, bw, bh, 7); ctx.stroke();
      // Texto con notación, línea a línea.
      ctx.fillStyle = a.textColor;
      ctx.font = `${a.weight} ${a.px}px ${UIQ}`;
      ctx.textBaseline = 'middle'; ctx.textAlign = a.align;
      const textX = a.align === 'center' ? ccx : a.align === 'right' ? bx + bw - padX : bx + padX;
      for (let i = 0; i < a.lines.length; i++) {
        drawLabel(ctx, a.lines[i], textX, by + padY + lineH * (i + 0.5));
      }
      ctx.restore();
    }
  }

  // Diagramas declarativos: envoltorio del toolkit draw.node/connector/arrow.
  // Dibuja el panel de respaldo, los nodos (guardando su geometría por id), los
  // edges (conectando anclas de nodo por id, con auto-side o `fromSide`/`toSide`)
  // y los textos. La opacidad de grupo (`alpha`) y el barrido (`reveal` + `at`)
  // se aplican por multiplicación de globalAlpha, así el reveal escalona los
  // hijos sin tocar el `alpha` absoluto de node/connector. `screen` separa los
  // de mundo (bajo la cámara) de los de HUD fijo.
  _drawDiagrams(ctx, screen) {
    if (!this._diagrams || !this._diagrams.length) return;
    const UIQ = '"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, sans-serif';
    const childAlpha = (c, reveal) => {
      const at = c.at || 0, fi = c.fadeIn || 0.15;
      return fi > 0 ? Math.max(0, Math.min(1, (reveal - at) / fi)) : (reveal >= at ? 1 : 0);
    };
    const nodePos = (n) => {
      if (n.target != null) {
        const pt = this._focusPoint({ target: Array.isArray(n.target) ? { x: n.target[0], y: n.target[1] } : n.target });
        if (!pt) return null;
        return { x: pt.x - (n.w || 90) / 2, y: pt.y - (n.h || 40) / 2 };
      }
      return { x: n.x ?? 0, y: n.y ?? 0 };
    };
    const autoSide = (g, o) => {
      const dx = o.x - g.x, dy = o.y - g.y;
      if (Math.abs(dx) * g.h >= Math.abs(dy) * g.w) return dx >= 0 ? g.right : g.left;
      return dy >= 0 ? g.bottom : g.top;
    };
    for (const d of this._diagrams) {
      if (!!d.screen !== !!screen) continue;
      if (d.alpha < 0.01) continue;
      const rv = d.reveal ?? 1;
      ctx.save();
      ctx.globalAlpha *= Math.min(1, d.alpha);
      // Panel de respaldo: bbox de los nodos + pad, o x/y/w/h explícitos.
      if (d.panel) {
        const p = d.panel, pca = childAlpha(p, rv);
        if (pca > 0.001) {
          let bx, by, bw, bh;
          if (p.x != null && p.w != null) { bx = p.x; by = p.y ?? 0; bw = p.w; bh = p.h ?? 0; }
          else {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const n of d.nodes) {
              const pos = nodePos(n); if (!pos) continue;
              minX = Math.min(minX, pos.x); minY = Math.min(minY, pos.y);
              maxX = Math.max(maxX, pos.x + (n.w || 90)); maxY = Math.max(maxY, pos.y + (n.h || 40));
            }
            const pad = p.pad ?? 16, titleH = p.title ? 20 : 0;
            bx = minX - pad; by = minY - pad - titleH;
            bw = (maxX - minX) + pad * 2; bh = (maxY - minY) + pad * 2 + titleH;
          }
          if (isFinite(bx) && isFinite(bw) && bw > 0) {
            ctx.save(); ctx.globalAlpha *= pca;
            this._declRrect(ctx, bx, by, bw, bh, p.radius ?? 14);
            ctx.fillStyle = p.fill || 'rgba(12,16,32,0.82)'; ctx.fill();
            if (p.stroke !== false) {
              ctx.strokeStyle = typeof p.stroke === 'string' ? p.stroke : 'rgba(110,120,150,0.30)';
              ctx.lineWidth = p.strokeWidth ?? 1;
              this._declRrect(ctx, bx, by, bw, bh, p.radius ?? 14); ctx.stroke();
            }
            if (p.title) {
              ctx.fillStyle = p.titleColor || '#F4AC1D';
              ctx.font = '600 10px ' + UIQ; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
              try { ctx.letterSpacing = '1.5px'; } catch {}
              ctx.fillText(String(p.title).toUpperCase(), bx + 14, by + 18);
              try { ctx.letterSpacing = '0px'; } catch {}
            }
            ctx.restore();
          }
        }
      }
      // Nodos: draw.node dibuja la caja y devuelve sus anclas de borde por id.
      const geom = {};
      for (const n of d.nodes) {
        const pos = nodePos(n); if (!pos) continue;
        let font = n.font;
        if (!font && (n.px || n.weight)) font = `${n.weight || '600'} ${n.px || 12}px ${UIQ}`;
        ctx.save(); ctx.globalAlpha *= childAlpha(n, rv);
        geom[n.id] = this.draw.node(pos.x, pos.y, n.w || 90, n.h || 40, {
          fill: n.fill, stroke: n.stroke, strokeWidth: n.strokeWidth, radius: n.radius,
          label: n.label, labelColor: n.labelColor, font,
        });
        ctx.restore();
      }
      // Edges: conectan anclas de nodo por id (o un punto/entidad libre).
      for (const e of d.edges) {
        const ga = geom[e.from], gb = geom[e.to];
        const centerOf = (ref, g) => {
          if (g) return { x: g.x, y: g.y };
          if (Array.isArray(ref)) return { x: ref[0], y: ref[1] };
          const pt = this._focusPoint({ target: ref });
          return pt ? { x: pt.x, y: pt.y, r: pt.r } : null;
        };
        const ca = centerOf(e.from, ga), cb = centerOf(e.to, gb);
        if (!ca || !cb) continue;
        const anchor = (g, side, center, other) => {
          if (g) return (side && g[side]) ? g[side] : autoSide(g, other);
          return center;
        };
        const A = anchor(ga, e.fromSide, ca, cb), B = anchor(gb, e.toSide, cb, ca);
        const eca = childAlpha(e, rv);
        if (eca < 0.001) continue;
        ctx.save(); ctx.globalAlpha *= eca;
        this.draw.connector(A, B, {
          color: e.color, width: e.width, dash: e.dash, curve: e.curve,
          head: e.head, both: e.both, label: e.label, labelColor: e.labelColor,
          labelBg: e.labelBg, gap: e.gap ?? 2,
        });
        ctx.restore();
      }
      // Textos sueltos (con notación _/^ y $...$ vía drawLabel).
      for (const t of d.texts) {
        const tca = childAlpha(t, rv);
        if (tca < 0.001) continue;
        ctx.save(); ctx.globalAlpha *= tca;
        ctx.font = t.font || `${t.weight || '600'} ${t.px || 13}px ${UIQ}`;
        ctx.textAlign = t.align || 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = t.color || '#1F2547';
        drawLabel(ctx, String(t.text ?? ''), t.x ?? 0, t.y ?? 0);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  // Resuelve el punto y radio de un foco: entidad por id (centro visual del
  // frame, con bob y salto), prop por id (media altura del sprite) o punto
  // [x, y]. Compartido por _drawFocuses y _drawLighting.
  _focusPoint(f) {
    let x, y, r = f.radius;
    if (typeof f.target === 'string') {
      const e = this.byId(f.target);
      if (e) {
        if (e._alpha != null && e._alpha < 0.05) return null;
        x = e.x; y = e._cyDrawn ?? e.y;
        if (!r) r = Math.max(34, (e.scale || 4) * 11);
      } else if (this._chartById && this._chartById[f.target]) {
        // Foco/push-in sobre un chart declarativo: su centro en mundo.
        const c = this._chartById[f.target];
        x = c.x + c.w / 2; y = c.y + c.h / 2;
        if (!r) r = Math.max(c.w, c.h) * 0.62;
      } else {
        const p = this.props.find(pr => pr.id === f.target);
        if (!p) return null;
        const def = PROP_SPRITES[p.type];
        const s = p.scale || 3;
        if (def) {
          // Sprite anclado abajo-centro: el centro visual queda a media
          // altura del sprite sobre la base.
          x = p.x; y = p.y - (def.rows.length * s) / 2;
          if (!r) r = Math.max(34, Math.max(def.rows[0].length, def.rows.length) * s * 0.62);
        } else {
          // Props bespoke: si el drawer publicó su centro visual (drawPond),
          // úsalo, así el foco cae en el cuerpo del prop y no en su base.
          x = p.x;
          y = p._fcy != null ? p._fcy : p.y;
          if (!r) r = p._fr != null ? p._fr * 1.45 : 40;
        }
      }
    } else if (f.target) {
      x = f.target.x; y = f.target.y;
      if (!r) r = 44;
    }
    if (x == null || y == null) return null;
    return { x, y, r };
  }

  // Focos declarativos: halo radial pulsante + anillo tenue, en espacio de
  // mundo (un push-in de cámara lo agranda con su objetivo). Composición
  // 'lighter': el foco suma luz sobre lo que señala, no lo tapa.
  _drawFocuses(ctx) {
    if (!this._focuses || !this._focuses.length) return;
    for (const f of this._focuses) {
      if (!f.alpha || f.alpha < 0.02) continue;
      const pt = this._focusPoint(f);
      if (!pt) continue;
      const { x, y, r } = pt;
      const beat = Math.sin(this.t * 4 + (f.phase || 0));
      const rr = r * (1 + 0.09 * beat);
      const a = f.alpha * (0.86 + 0.14 * beat);
      const col = f.color || '#F4AC1D';
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const grad = ctx.createRadialGradient(x, y, rr * 0.12, x, y, rr);
      grad.addColorStop(0, colorAlpha(col, 0.40 * a));
      grad.addColorStop(0.55, colorAlpha(col, 0.18 * a));
      grad.addColorStop(1, colorAlpha(col, 0));
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = colorAlpha(col, 0.30 * a);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, rr * 0.94, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  // --- Iluminación declarativa --------------------------------------------
  // `ambient.darkness` (0..1) cubre el mundo con un scrim de noche y los
  // emisores perforan la oscuridad: props que emiten solos (LIGHT_EMITTERS),
  // cualquier prop con `light` declarado, y los focos activos del guion.
  // Se compone en screen-space sobre el mundo y bajo el HUD/partículas, así
  // las luciérnagas y los textos no se oscurecen. El scrim se arma en un
  // canvas offscreen a resolución lógica (gradientes suaves no necesitan 3x).
  _drawLighting(ctx) {
    const amb = this._ambient;
    const darkness = Math.max(0, Math.min(0.92, amb?.darkness || 0));
    if (darkness < 0.02) return;
    if (!this._lightCanvas) {
      try { this._lightCanvas = document.createElement('canvas'); } catch { return; }
    }
    const lc = this._lightCanvas;
    if (lc.width !== this.W || lc.height !== this.H) { lc.width = this.W; lc.height = this.H; }
    const c = lc.getContext('2d');
    if (!c) return;
    if (c.setTransform) c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, this.W, this.H);
    c.fillStyle = colorAlpha(amb.darknessColor || '#070a18', darkness);
    c.fillRect(0, 0, this.W, this.H);
    // Cada emisor borra oscuridad con un gradiente radial (pleno al centro).
    const cam = this.camera;
    const punch = (wx, wy, r, strength = 1) => {
      if (!(r > 0)) return;
      const sx = (wx - cam.x) * cam.zoom + this.W / 2 + cam.shakeX;
      const sy = (wy - cam.y) * cam.zoom + this.H / 2 + cam.shakeY;
      const sr = r * cam.zoom;
      const k = Math.max(0, Math.min(1, strength));
      const g = c.createRadialGradient(sx, sy, sr * 0.08, sx, sy, sr);
      g.addColorStop(0, 'rgba(0,0,0,' + k.toFixed(3) + ')');
      g.addColorStop(0.55, 'rgba(0,0,0,' + (k * 0.55).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalCompositeOperation = 'destination-out';
      c.fillStyle = g;
      c.beginPath(); c.arc(sx, sy, sr, 0, Math.PI * 2); c.fill();
    };
    for (const p of this.props) {
      if (p.light === false) continue;
      const auto = LIGHT_EMITTERS[p.type];
      if (!auto && !p.light) continue;
      const conf = (p.light && typeof p.light === 'object') ? p.light : null;
      const s = p.scale || 3;
      // Sin offset propio, el emisor queda en el centro visual del sprite.
      const def = PROP_SPRITES[p.type];
      const ex = p.x;
      const ey = auto ? p.y + auto.dy * s : (def ? p.y - (def.rows.length * s) / 2 : p.y);
      punch(ex, ey, conf?.radius ?? (auto ? auto.r * s : 60), conf?.strength ?? 1);
    }
    for (const f of (this._focuses || [])) {
      if (!f.alpha || f.alpha < 0.02) continue;
      const pt = this._focusPoint(f);
      if (pt) punch(pt.x, pt.y, pt.r * 1.7, f.alpha);
    }
    ctx.save();
    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(lc, 0, 0, this.W, this.H);
    ctx.imageSmoothingEnabled = prevSmooth;
    ctx.restore();
  }

  // `ambient.saturation` (0..1): 1 = color pleno (default, sin costo), 0 =
  // escala de grises. A diferencia de `_drawLighting`, no compone un velo: re-
  // procesa los píxeles ya dibujados con ctx.filter = 'saturate()'. Toma un
  // snapshot del frame en un canvas offscreen (a resolución de dispositivo, sin
  // perder el supersampleo), limpia el backing store y lo redibuja saturado.
  // Se anima con `tween "ambient.saturation"` y el reset lo restaura solo
  // (world._ambient se reconstruye de config.ambient). Es la primitiva de la
  // mecánica "el color como información que los hechos no contienen".
  _drawSaturation(ctx) {
    const amb = this._ambient;
    const sat = (amb && amb.saturation != null) ? amb.saturation : 1;
    if (sat >= 0.999) return;
    const cv = this.canvas;                        // el elemento real (backing store)
    const dw = cv && cv.width, dh = cv && cv.height;
    if (!(dw > 0 && dh > 0)) return;
    if (!this._satCanvas) {
      try { this._satCanvas = document.createElement('canvas'); } catch { return; }
    }
    const sc = this._satCanvas;
    if (sc.width !== dw || sc.height !== dh) { sc.width = dw; sc.height = dh; }
    const c = sc.getContext('2d');
    if (!c) return;
    if (c.setTransform) c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, dw, dh);
    c.drawImage(cv, 0, 0);                          // snapshot del frame en color
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);            // trabajar en píxeles de dispositivo
    ctx.clearRect(0, 0, dw, dh);
    ctx.filter = 'saturate(' + Math.max(0, Math.min(1, sat)).toFixed(3) + ')';
    ctx.drawImage(sc, 0, 0);
    ctx.filter = 'none';
    ctx.restore();                                 // restaura el supersample transform
  }

  _runDeclarativeScript() {
    // Una "forma" (config.form) se compila a steps primitivos y manda el guion;
    // si además hay un config.script de autor, se concatena después (la forma
    // garantiza la mecánica, el autor agrega su floritura). El resultado es un
    // guion 'main' normal: replay, grabación y todo lo demás funcionan igual.
    const compiled = compileForm(this.config);
    const steps = [
      ...(compiled.steps || []),
      ...(Array.isArray(this.config.script) ? this.config.script : []),
    ];
    if (steps.length) this.runScript(steps, { id: 'main' });
  }

  // El guion 'main' (config.script) terminó: tras 3 s de gracia, mostrar el
  // replay. `state.showReplay = true` es el contrato existente que también
  // detiene la grabación de video (element.js).
  _tickReplay() {
    const r = this._replay;
    if (!r || !r.armed || r.visible) return;
    const running = this._scripts && this._scripts.some(s => s.id === 'main');
    if (running) { r.doneAt = null; return; }
    if (r.doneAt == null) { r.doneAt = this.t; return; }
    if (this.t - r.doneAt >= 3) {
      r.visible = true;
      this.state.showReplay = true;
    }
  }

  _drawLearners(ctx) {
    const ls = this.entities.filter(e => e.type === 'learner' && (e._alpha == null || e._alpha > 0.02));
    ls.sort((a, b) => (a.y || 0) - (b.y || 0));
    for (const e of ls) this.draw.learner(e);
  }

  _declRrect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  // Color de un meter para una fracción 0..1: hex fijo, o interpolación
  // entre stops [{at, color}] (la barra vira según su valor).
  _meterColor(m, frac) {
    const c = m.color;
    if (!Array.isArray(c) || !c.length) return c;
    if (frac <= (c[0].at ?? 0)) return c[0].color;
    for (let i = 1; i < c.length; i++) {
      const a = c[i - 1], b = c[i];
      if (frac <= (b.at ?? 1)) {
        const span = ((b.at ?? 1) - (a.at ?? 0)) || 1;
        return mixColors(a.color, b.color, (frac - (a.at ?? 0)) / span);
      }
    }
    return c[c.length - 1].color;
  }

  _drawDeclarative(ctx) {
    const UIQ = '"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, sans-serif';
    if (this._meters && this._meters.length) {
      for (const m of this._meters) {
        const frac = m.max ? Math.max(0, Math.min(1, m.value / m.max)) : 0;
        ctx.fillStyle = 'rgba(110,120,150,0.16)';
        this._declRrect(ctx, m.x, m.y, m.w, m.h, m.h / 2); ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(232,226,210,0.22)';
        this._declRrect(ctx, m.x, m.y, m.w, m.h, m.h / 2); ctx.stroke();
        const fw = frac * m.w;
        if (fw > 0.5) { ctx.fillStyle = this._meterColor(m, frac); this._declRrect(ctx, m.x, m.y, Math.max(m.h, fw), m.h, m.h / 2); ctx.fill(); }
        ctx.textBaseline = 'alphabetic';
        if (m.label) {
          ctx.fillStyle = '#9aa3bd'; ctx.textAlign = 'left';
          drawRichText(ctx, String(m.label).toUpperCase(), m.x, m.y - 8, { px: 11, weight: '600', family: UIQ, align: 'left' });
        }
        if (m.showValue) {
          ctx.fillStyle = '#d4dbeb'; ctx.font = '700 12px ' + UIQ; ctx.textAlign = 'right';
          ctx.fillText(Math.round(frac * 100) + '%', m.x + m.w, m.y - 8);
        }
      }
    }
    // Título de acto: banda superior centrada, uppercase con tracking suave,
    // papel cálido sobre sombra (el estilo de las cards de título que las
    // escenas 08 y 14 dibujaban a mano).
    const title = this._title && this._title.text;
    if (title) {
      ctx.save();
      ctx.font = '600 17px ' + UIQ;
      ctx.letterSpacing = '1px';
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const txt = String(title).toUpperCase();
      // Dodge: si el título centrado pisa el bloque de algún meter (barra +
      // su label arriba), baja hasta quedar debajo. Medido con el ancho real
      // del texto, así nunca se tocan sin importar la config de la escena.
      const tw = measureRichText(ctx, txt, { px: 17, weight: '600', family: UIQ });
      const tx0 = this.W / 2 - tw / 2 - 14, tx1 = this.W / 2 + tw / 2 + 14;
      let ty = 40;
      for (const m of (this._meters || [])) {
        const mTop = m.y - 22, mBot = m.y + m.h;
        if (tx1 > m.x && tx0 < m.x + m.w && ty > mTop && ty - 17 < mBot) {
          ty = mBot + 26;
        }
      }
      ctx.shadowColor = 'rgba(10,12,22,0.95)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 1;
      ctx.fillStyle = '#f4e8c6';
      drawRichText(ctx, txt, this.W / 2, ty, { px: 17, weight: '600', family: UIQ, align: 'center' });
      ctx.restore();
    }
    const r = this._replay;
    // Referencias (APA) como tarjeta de cierre: se dibujan EN el canvas cuando
    // aparece "Ver nuevamente", así entran también en la grabación. Toman el
    // bloque `text` del config (idioma `es` por defecto).
    const txd = this.config.text ? (this.config.text.es || this.config.text[Object.keys(this.config.text)[0]]) : null;
    const refsArr = (txd && Array.isArray(txd.references)) ? txd.references : [];
    const showRefsCard = !!(r && r.visible && refsArr.length);

    const cap = this._caption && this._caption.text;
    if (cap && !showRefsCard) {
      ctx.save();
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      const capFont = { px: 14, weight: '500', family: UIQ };
      const maxW = Math.min(680, this.W - 60);
      const words = String(cap).split(' ');
      const lines = []; let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (measureRichText(ctx, test, capFont) > maxW && line) { lines.push(line); line = w; }
        else line = test;
      }
      if (line) lines.push(line);
      const lh = 20;
      let y = this.H - 18 - (lines.length - 1) * lh;
      ctx.shadowColor = 'rgba(10,12,22,0.95)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 1;
      ctx.fillStyle = '#eef1f6';
      for (const ln of lines) { drawRichText(ctx, ln, this.W / 2, y, { ...capFont, align: 'center' }); y += lh; }
      ctx.restore();
    }
    if (r && r.visible) {
      const bw = 200, bh = 40;
      let by = this.H - 112;
      if (showRefsCard) {
        ctx.save();
        ctx.textBaseline = 'alphabetic';
        const refFont = { px: 13, weight: '500', family: UIQ };
        const maxW = Math.min(600, this.W - 110);
        const refLines = []; let totalLines = 0;
        for (const rf of refsArr) {
          const txt = htmlToText(formatAPA(rf));
          const words = txt.split(' ');
          const ls = []; let line = '';
          for (const w of words) {
            const test = line ? line + ' ' + w : w;
            if (measureRichText(ctx, test, refFont) > maxW && line) { ls.push(line); line = w; }
            else line = test;
          }
          if (line) ls.push(line);
          refLines.push(ls); totalLines += ls.length;
        }
        const lh = 19, headH = 20, padX = 22, padTop = 15, padBot = 16, gap = 9;
        const cardH = padTop + headH + totalLines * lh + (refLines.length - 1) * gap + padBot;
        const cardW = maxW + padX * 2;
        const cardX = Math.round(this.W / 2 - cardW / 2);
        by = this.H - 22 - bh;
        const cardTop = Math.round(by - 16 - cardH);
        this._declRrect(ctx, cardX, cardTop, cardW, cardH, 12);
        ctx.fillStyle = 'rgba(246,242,232,0.97)'; ctx.fill();
        this._declRrect(ctx, cardX, cardTop, cardW, cardH, 12);
        ctx.strokeStyle = 'rgba(31,37,71,0.18)'; ctx.lineWidth = 1; ctx.stroke();
        let yy = cardTop + padTop + 9;
        ctx.fillStyle = '#c8901a'; ctx.font = '600 11px ' + UIQ; ctx.textAlign = 'left';
        try { ctx.letterSpacing = '2px'; } catch (e) {}
        ctx.fillText('REFERENCIAS', cardX + padX, yy);
        try { ctx.letterSpacing = '0px'; } catch (e) {}
        yy += headH;
        ctx.fillStyle = '#3a4063';
        for (const ls of refLines) {
          for (const ln of ls) { drawRichText(ctx, ln, cardX + padX, yy, { ...refFont, align: 'left' }); yy += lh; }
          yy += gap;
        }
        ctx.restore();
      }
      const bx = this.W / 2 - bw / 2;
      r.box = { x: bx, y: by, w: bw, h: bh };
      ctx.fillStyle = 'rgba(251,250,246,0.96)';
      this._declRrect(ctx, bx, by, bw, bh, bh / 2); ctx.fill();
      ctx.fillStyle = '#1F2547'; ctx.font = '600 14px ' + UIQ;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('↺  Ver nuevamente', this.W / 2, by + bh / 2 + 1);
    }
  }

  _drawZones(ctx) {
    for (const z of this.zones) {
      const fill = z.color || 'rgba(244,172,29,0.08)';
      ctx.fillStyle = fill;
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = (z.borderColor || 'rgba(244,172,29,0.30)');
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(z.x + 0.5, z.y + 0.5, z.w - 1, z.h - 1);
      ctx.setLineDash([]);
      if (z.label) {
        ctx.fillStyle = 'rgba(244,172,29,0.75)';
        ctx.font = '600 9px ui-monospace, "SF Mono", Menlo, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        drawLabel(ctx, String(z.label).toUpperCase(), z.x + 6, z.y + 6);
      }
    }
  }

  _drawWalls(ctx) {
    for (const w of this.walls) {
      ctx.fillStyle = w.color || 'rgba(31,37,71,0.95)';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = w.borderColor || 'rgba(110,120,150,0.45)';
      ctx.lineWidth = 1;
      ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
    }
  }

  _drawProps(ctx) {
    const sort = this.config.canvas?.ysort !== false;
    const list = sort
      ? this.props.slice().sort((a, b) => ((a.z || 0) - (b.z || 0)) || (a.y - b.y))
      : this.props;
    // El prado (pasture) es cobertura de suelo: hay que recortarlo a la región
    // bajo el horizonte en espacio-PANTALLA, igual que la textura del piso. El
    // cielo se pinta en espacio-pantalla, así que un push-in de cámara hacia
    // abajo subiría el prado a la franja del cielo si no se recorta. El resto
    // de los props no se tocan (un árbol o una nube sí viven sobre el horizonte).
    const cConf = this.config.canvas || {};
    const horizonY = cConf.sky ? Math.round(this.H * (cConf.horizon ?? 0.45)) : 0;
    for (const p of list) {
      if (p.type === 'pasture' && horizonY > 0) {
        const t = ctx.getTransform();
        ctx.save();
        ctx.setTransform(this._ss, 0, 0, this._ss, 0, 0);
        ctx.beginPath();
        ctx.rect(0, horizonY, this.W, this.H - horizonY);
        ctx.clip();
        ctx.setTransform(t);
        drawProp(ctx, p);
        ctx.restore();
      } else {
        drawProp(ctx, p);
      }
    }
  }

  // Mixed Y-sort helper for onDraw. Pass an array of:
  //   { kind: 'prop', ref }                    → drawn via drawProp
  //   { kind: 'learner', entity, opts }        → drawn via world.draw.learner
  //   { kind: 'fn', y, z, draw }               → arbitrary draw(ctx) sorted by (z,y)
  // Sorted by (z||0, y) ascending; ties: lower y first (farther → behind).
  drawSorted(items) {
    const ctx = this.ctx;
    const sorted = items.slice().sort((a, b) => {
      const az = a.z ?? a.ref?.z ?? a.entity?.z ?? 0;
      const bz = b.z ?? b.ref?.z ?? b.entity?.z ?? 0;
      if (az !== bz) return az - bz;
      const ay = a.y ?? a.ref?.y ?? a.entity?.y ?? 0;
      const by = b.y ?? b.ref?.y ?? b.entity?.y ?? 0;
      return ay - by;
    });
    for (const it of sorted) {
      if (it.kind === 'prop' && it.ref) drawProp(ctx, it.ref);
      else if (it.kind === 'learner' && it.entity) this.draw.learner(it.entity, it.opts || {});
      else if (it.kind === 'fn' && typeof it.draw === 'function') it.draw(ctx);
    }
  }

}
