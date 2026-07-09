// noesis-engine / fx
// Visual + audio effects subsystem: the `fx` trigger API exposed to scene
// hooks (say/think/mood/particles/camera/celebrate/die/...), speech-bubble DOM
// spawning, the particle/dialogue/bubble per-frame tick, on-screen bubble
// positioning, and canvas-space fx rendering. Operates on a `world` instance.
// World exposes the `fx` getter plus _spawnBubble/_spawnParticles/_tickFx/
// _positionBubbles/_drawFx as thin wrappers. The `fx` getter memoizes this api
// on world._fxApi, so it is built once per World (not rebuilt every access).

import { tone, sweep, createAmbientSound, createAmbientMusic, audio } from './audio.js?v=129';
import { richToHtml, drawLabel } from './util.js?v=129';

export function createFxApi(world) {
  const W = world;
  const sfx = (name) => { if (!W._muted && audio[name]) audio[name](); };
  const api = {};
  api.particles = (x, y, opts = {}) => W._spawnParticles(x, y, opts);
  api.surprise = (e, d = 0.5) => { if (e) { e._surpriseT = d; W._touchLearner(e); sfx('surprise'); } };
  api.reinforce = (e, d = 1.5) => {
    if (!e) return;
    e._reinforceT = d; e._lastReinforceT = W.t; W._touchLearner(e); sfx('reinforce');
    api.particles(e.x, e.y - 8, { color: 'rgb(244,172,29)', count: 12, speed: 75, duration: 1.4, size: 3 });
  };
  api.health = (e, h, dur = 0) => {
    if (!e) return;
    if (e._healthT <= 0) e._healthPrev = e.health || 'normal';
    e.health = h;
    e._healthT = dur;
  };
  api.flash = (e, d = 0.5) => {
    if (!e) return;
    e._flashT = d; W._touchLearner(e); sfx('flash');
    api.particles(e.x, e.y - 4, { color: 'rgb(248,237,229)', count: 10, speed: 95, duration: 1.1, gravity: -10, size: 3 });
  };
  api.wake = (e) => { W._touchLearner(e); sfx('wake'); };
  api.sleep = (e) => { if (e) { e._sleeping = true; e._lastTouchT = W.t - 999; } };
  api.lightPulse = (x, y, opts = {}) => {
    W._fx.push({
      type: 'lightPulse', x, y, age: 0,
      duration: opts.duration ?? 1.5,
      color: opts.color || 'rgb(251,233,184)',
      coreColor: opts.coreColor || 'rgb(255,250,230)',
      vx: opts.vx ?? 0,
      vy: opts.vy ?? 0,
      size: opts.size ?? 4,
      fadeAt: opts.fadeAt,
      fadeDur: opts.fadeDur ?? 0.35,
      label: opts.label || null,
      labelColor: opts.labelColor || 'rgb(255,240,180)',
      labelSize: opts.labelSize ?? 12,
      trail: [],
    });
  };
  api.packet = (x, y, label, opts = {}) => {
    W._fx.push({
      type: 'packet', x, y, label, age: 0,
      duration: opts.duration ?? 1.6,
      color: opts.color || 'rgb(244,172,29)',
      labelColor: opts.labelColor || opts.color || 'rgb(244,172,29)',
      vx: opts.vx ?? 0,
      vy: opts.vy ?? 0,
      gravity: opts.gravity ?? 0,
      spin: opts.spin ?? 0,
      rot: 0,
    });
  };
  api.floatNumber = (x, y, text, opts = {}) => {
    W._fx.push({
      type: 'floatNumber', x, y, text, age: 0,
      duration: opts.duration ?? 1.6,
      color: opts.color || 'rgb(244,172,29)',
      size: opts.size ?? 13,
      vx: opts.vx ?? 0,
      vy: opts.vy ?? -40,
      gravity: opts.gravity ?? 0,
    });
    if (opts.silent !== true) sfx('number');
  };
  api.transfer = (from, to, opts = {}) => {
    W._fx.push({
      type: 'transfer', from, to, age: 0,
      duration: opts.duration ?? 0.9,
    });
    sfx('transfer');
    // Achievement particles at the receiver position.
    if (to) api.particles(to.x, to.y - 6, { color: 'rgb(244,172,29)', count: 7, speed: 50, duration: 1.0 });
  };
  api.think = (entity, html, opts = {}) => { sfx('think'); W._touchLearner(entity); return W._spawnBubble(entity, html, { ...opts, kind: 'think' }); };
  api.say   = (entity, html, opts = {}) => { sfx('say');   W._touchLearner(entity); return W._spawnBubble(entity, html, { ...opts, kind: 'say' }); };
  api.exclaim = (entity, opts = {}) => { sfx('surprise'); W._touchLearner(entity); return W._spawnBubble(entity, '❗', { ...opts, kind: 'symbol-exclaim', duration: opts.duration ?? 1.0 }); };
  api.wonder  = (entity, opts = {}) => { sfx('think'); W._touchLearner(entity); return W._spawnBubble(entity, '❓', { ...opts, kind: 'symbol-wonder',  duration: opts.duration ?? 1.2 }); };
  api.mood = (entity, m, dur = 0) => {
    if (!entity) return;
    if (entity._moodT <= 0) entity._moodPrev = entity.mood || 'neutral';
    entity.mood = m;
    entity._moodT = dur;
    W._touchLearner(entity);
  };
  api.dialogue = (entity, messages, opts = {}) => {
    if (!entity || !Array.isArray(messages) || !messages.length) return null;
    W._touchLearner(entity);
    const id = ++W._dialogueId;
    W._dialogues.push({
      id, entity, messages, idx: 0,
      interval: opts.interval ?? 2.2,
      kind: opts.kind || 'say',
      onEnd: opts.onEnd || null,
      elapsed: 0,
      currentBubbleId: null,
    });
    return id;
  };
  api.cancelDialogue = (id) => {
    const d = W._dialogues.find(x => x.id === id);
    if (d && d.currentBubbleId !== null) {
      const b = W._bubbles.get(d.currentBubbleId);
      if (b) { b.el.remove(); W._bubbles.delete(d.currentBubbleId); }
    }
    W._dialogues = W._dialogues.filter(x => x.id !== id);
  };
  api.thinking = (entity, opts = {}) => {
    if (!entity) return null;
    sfx('think');
    return W._spawnBubble(entity, '<span class="dots"><span>·</span><span>·</span><span>·</span></span>', {
      kind: 'think', duration: opts.duration ?? 1.6,
    });
  };
  api.runScript = (steps, opts) => W.runScript(steps, opts);
  api.stopScripts = (id) => W.stopScripts(id);
  api.sequence = (steps) => {
    if (!Array.isArray(steps)) return;
    for (const step of steps) {
      const delay = Math.max(0, (step.at ?? 0) * 1000);
      setTimeout(() => { try { step.do?.(); } catch {} }, delay);
    }
  };
  api.die = (entity, opts = {}) => {
    if (!entity || entity._dying || entity._dead) return;
    entity._dying = true;
    entity._deathT = 0;
    entity._deathDur = opts.duration ?? 2.0;
    if (opts.onDeath) entity._onDeath = opts.onDeath;
    entity.vx = 0; entity.vy = 0;
    if (entity.behavior) entity.behavior = { type: 'stop' };
    if (!W._muted) sweep(440, 110, 0.9, { type: 'sine', vol: 0.10 });
    // Soul particles drifting upward.
    api.particles(entity.x, entity.y, { color: 'rgb(180,190,210)', count: 7, speed: 32, duration: 1.8, gravity: -28, spread: Math.PI });
    // Epitaph text rising slowly.
    const text = opts.epitaph ?? entity.epitaph ?? (entity.name ? entity.name + ' vivió' : 'vivió');
    W._fx.push({
      type: 'epitaph', x: entity.x, y: entity.y - 28,
      text, age: 0, duration: 3.2, size: 11,
    });
  };
  api.revive = (entity) => {
    if (!entity) return;
    entity._dying = false;
    entity._dead = false;
    entity._deathT = 0;
    entity._age = 0;
    entity._alpha = 0;
    entity._appearT = 0;
    entity._appearDur = 0.6;
    if (!W._muted) sweep(220, 660, 0.4, { vol: 0.10 });
    api.particles(entity.x, entity.y, { color: 'rgb(244,172,29)', count: 5, speed: 35, duration: 0.8, gravity: -15 });
  };
  api.appear = (entity, dur = 0.6) => {
    if (!entity) return;
    entity._alpha = 0;
    entity._appearT = 0;
    entity._appearDur = dur;
    entity._vanishDur = 0;
  };
  // followPath: send an entity along a list of waypoints. opts: speed (px/s,
  // constant) OR duration (s for the whole path) + easing ('easeInOut' etc.);
  // curve (smooth Catmull-Rom through points); loop; fromCurrent (false to
  // start at the first point instead of the entity's current position);
  // onArrive (callback when a non-looping path completes). Works with a script
  // `waitFor: 'arrive'`. points accept {x,y} or [x,y].
  api.followPath = (entity, points, opts = {}) => {
    if (!entity || !Array.isArray(points) || !points.length) return;
    entity.behavior = { type: 'followPath', points, ...opts };
  };
  api.tone = (freq, duration = 0.2, opts = {}) => {
    if (W._muted) return;
    tone(freq, duration, opts);
  };
  api.sweep = (from, to, duration = 0.3, opts = {}) => {
    if (W._muted) return;
    sweep(from, to, duration, opts);
  };
  api.ambientSound = (name, opts = {}) => {
    if (W._muted) return null;
    if (W._ambientSoundMap.has(name)) {
      if (opts.volume != null) W._ambientSoundMap.get(name).setVolume(opts.volume);
      return W._ambientSoundMap.get(name);
    }
    const s = createAmbientSound(name, opts.volume);
    if (s) W._ambientSoundMap.set(name, s);
    return s;
  };
  api.stopAmbientSound = (name, opts = {}) => {
    const fadeOut = opts.fadeOut ?? 1;
    if (name) {
      const s = W._ambientSoundMap.get(name);
      if (s) { s.stop(fadeOut); W._ambientSoundMap.delete(name); }
    } else {
      for (const [, s] of W._ambientSoundMap) s.stop(fadeOut);
      W._ambientSoundMap.clear();
    }
  };
  api.transitionTo = (x, y, opts = {}) => {
    const fadeOutMs = opts.fadeOutMs ?? 750;
    const holdMs    = opts.holdMs    ?? 100;
    W._transitionTarget = 1;
    const setTo = () => {
      W.camera.x = x; W.camera.y = y;
      W.camera.targetX = x; W.camera.targetY = y;
      if (opts.zoom != null) { W.camera.zoom = opts.zoom; W.camera.targetZoom = opts.zoom; }
      if (typeof opts.onTeleport === 'function') { try { opts.onTeleport(); } catch {} }
    };
    if (W.setTimeout) {
      W.setTimeout(setTo, fadeOutMs);
      W.setTimeout(() => { W._transitionTarget = 0; }, fadeOutMs + holdMs);
    } else {
      setTimeout(setTo, fadeOutMs);
      setTimeout(() => { W._transitionTarget = 0; }, fadeOutMs + holdMs);
    }
  };
  api.ambientMusic = (mood, opts = {}) => {
    if (W._muted) return null;
    if (W._ambientMusic) {
      if (W._ambientMusic.mood === mood) {
        if (opts.volume != null) W._ambientMusic.setVolume(opts.volume);
        return W._ambientMusic;
      }
      W._ambientMusic.stop(0.6);
    }
    const m = createAmbientMusic(mood, opts.volume);
    if (m) W._ambientMusic = m;
    return m;
  };
  api.ambientMusicStop = (opts = {}) => {
    const fadeOut = opts.fadeOut ?? 1.2;
    if (W._ambientMusic) { W._ambientMusic.stop(fadeOut); W._ambientMusic = null; }
  };
  // Música reactiva al guion (step `music`). `frac` es FRACCIÓN del volumen
  // base del mood (1 = normal, 0 = silencio, tope 1.5): el autor de la
  // escena no necesita conocer la mezcla interna. Si el usuario no activó ♪
  // no hay handle y ambas son no-ops silenciosos: la escena corre igual.
  api.ambientMusicVolume = (frac, dur) => {
    const m = W._ambientMusic;
    if (!m || m.baseVolume == null) return;
    const f = Math.max(0, Math.min(1.5, frac));
    m.setVolume(m.baseVolume * f, dur);
  };
  api.ambientMusicStinger = () => {
    const m = W._ambientMusic;
    if (m && m.stinger) m.stinger();
  };
  // Cambio de mood a MITAD de escena con crossfade (step music.mood): el
  // mood viejo se apaga en `dur` segundos mientras el nuevo entra con su
  // ramp propio (~2.2 s). Solo actúa si la música ya suena (el usuario
  // decide con ♪); el reset del replay vuelve al mood de meta.music.
  api.ambientMusicMood = (mood, dur = 1.5) => {
    const cur = W._ambientMusic;
    if (!cur || cur.mood === mood) return;
    cur.stop(dur);
    const m = createAmbientMusic(mood);
    if (m) W._ambientMusic = m;
  };
  api.cameraShake = (intensity = 8, duration = 0.4) => {
    const cam = W.camera;
    cam.shakeIntensity = intensity;
    cam.shakeT = duration;
    cam._shakeDur = duration;
  };
  api.cameraZoom = (zoom = 1, opts = {}) => {
    W.camera.targetZoom = zoom;
    if (opts.lerp != null) W.camera.lerpZoom = opts.lerp;
  };
  api.cameraPan = (x, y, opts = {}) => {
    W.camera.targetX = x;
    W.camera.targetY = y;
    if (opts.lerp != null) W.camera.lerpPan = opts.lerp;
  };
  api.cameraFollow = (entity, opts = {}) => {
    W.camera.follow = entity || null;
    if (opts.lerp != null) W.camera.lerpPan = opts.lerp;
  };
  api.cameraReset = (opts = {}) => {
    const cam = W.camera;
    cam.follow = null;
    cam.targetX = W.W / 2;
    cam.targetY = W.H / 2;
    cam.targetZoom = 1;
    if (opts.instant) {
      cam.x = cam.targetX; cam.y = cam.targetY; cam.zoom = cam.targetZoom;
    }
  };
  api.jump = (entity, opts = {}) => {
    if (!entity) return;
    entity._jumpT = 0;
    entity._jumpDur = opts.duration ?? 0.45;
  };
  api.celebrate = (entity, opts = {}) => {
    if (!entity) return;
    const dur = opts.duration ?? 2.0;
    api.mood(entity, 'happy', dur);
    api.jump(entity, { duration: 0.5 });
    entity._reinforceT = 1.4;
    // Confetti: amber + accents.
    api.particles(entity.x, entity.y - 10, { color: 'rgb(244,172,29)', count: 12, speed: 80, duration: 1.4, gravity: -6 });
    api.particles(entity.x, entity.y - 10, { color: 'rgb(255,73,133)', count: 4, speed: 70, duration: 1.4, gravity: -6 });
    api.particles(entity.x, entity.y - 10, { color: 'rgb(34,196,248)', count: 4, speed: 70, duration: 1.4, gravity: -6 });
    if (!W._muted) {
      tone(523.25, 0.16, { vol: 0.10 });
      setTimeout(() => tone(659.25, 0.16, { vol: 0.10 }), 90);
      setTimeout(() => tone(880,    0.28, { vol: 0.12 }), 180);
    }
    W._touchLearner(entity);
  };
  api.cry = (entity, opts = {}) => {
    if (!entity) return;
    const dur = opts.duration ?? 2.5;
    api.mood(entity, 'sad', dur);
    const eyeY = entity.y - 4;
    api.particles(entity.x - 6, eyeY, { color: 'rgb(91,141,239)', count: 3, speed: 14, duration: 1.5, gravity: 90, angle: Math.PI / 2, spread: 0.4, size: 2 });
    api.particles(entity.x + 6, eyeY, { color: 'rgb(91,141,239)', count: 3, speed: 14, duration: 1.5, gravity: 90, angle: Math.PI / 2, spread: 0.4, size: 2 });
    if (!W._muted) sweep(440, 220, 0.55, { vol: 0.09 });
  };
  api.achievement = (entity, points = 1) => {
    if (!entity) return;
    api.celebrate(entity);
    api.floatNumber(entity.x, entity.y - 32, '+' + points);
  };
  api.failure = (entity) => {
    if (!entity) return;
    api.cry(entity);
    api.wonder(entity, { duration: 1.2 });
  };
  api.vanish = (entity, dur = 0.6, onDone = null) => {
    if (!entity) return;
    entity._vanishT = 0;
    entity._vanishDur = dur;
    entity._appearDur = 0;
    entity._onVanish = onDone;
  };
  return api;
}

export function spawnBubble(world, entity, html, opts) {
  const overlays = world.host?.shadowRoot?.querySelector('.overlays');
  if (!overlays) return null;
  // Notación científica (CO_2, x^2): convierte a <sub>/<sup>. Si el diálogo no
  // trae marcas, queda igual (y sigue siendo texto plano para el typewriter).
  if (typeof html === 'string') html = richToHtml(html);
  const id = 'b' + world.frame + '_' + Math.floor(world.rng() * 1e6);
  const el = document.createElement('div');
  el.className = 'bubble ' + (opts.kind === 'think' ? 'think' : 'say');
  el.style.position = 'absolute';
  el.style.transform = 'translate(-50%, calc(-100% - 18px))';
  el.style.opacity = '0';
  // Inline styles: keep dialogue inside the canvas and prevent any inherited
  // justify/letter-spacing from breaking word and digit spacing.
  el.style.maxWidth = 'min(420px, 78%)';
  el.style.whiteSpace = 'normal';
  el.style.overflowWrap = 'break-word';
  el.style.textAlign = 'left';
  el.style.textAlignLast = 'left';
  el.style.wordSpacing = 'normal';
  el.style.letterSpacing = '0';
  el.style.fontVariantNumeric = 'normal';
  overlays.appendChild(el);
  // Typewriter mode: enabled by default for textual say/think bubbles
  // with plain-text content (no markup). Symbol bubbles, HTML-rich
  // bubbles, and explicit opt-outs render instantly.
  const isPlainText = typeof html === 'string' && !/[<&]/.test(html);
  const isText = opts.kind === 'say' || opts.kind === 'think';
  const tw = (opts.typewriter ?? (isPlainText && isText));
  const cps = opts.cps ?? 30;
  let duration = opts.duration ?? 2.2;
  // Piso de tiempo de LECTURA: ningún diálogo puede durar menos de lo que
  // toma leerlo (~0.4 s por palabra más el arranque). La duración explícita
  // de la escena solo puede alargarlo, nunca acortarlo por debajo del piso.
  if (isText && isPlainText) {
    const words = html.trim().split(/\s+/).length;
    const readTime = Math.min(7, 1.2 + 0.4 * words);
    if (duration < readTime) duration = readTime;
  }
  if (tw && isPlainText) {
    const typeTime = html.length / cps;
    if (duration < typeTime + 1.0) duration = typeTime + 1.4;
    el.textContent = '';
  } else {
    el.innerHTML = html;
  }
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  const record = {
    el, entity, age: 0, duration,
    typewriter: (tw && isPlainText) ? { full: html, revealed: 0, accum: 0, cps, lastTickIdx: -1 } : null,
  };
  world._bubbles.set(id, record);
  return id;
}

// Presets del step `particles` (escenas declarativas): recetas con nombre
// sobre spawnParticles, para que el generador no calibre física a mano.
// Las claves explícitas del step siempre ganan sobre el preset. El validador
// escanea este bloque (buildVocab), así la lista nunca se desincroniza.
export const PARTICLE_PRESETS = {
  smoke:    { count: 9, color: 'rgb(150,158,180)', speed: 24, duration: 2.4, gravity: -26, spread: 0.9, size: 4 },
  sparks:   { count: 14, color: 'rgb(244,172,29)', speed: 95, duration: 1.0, gravity: 60, spread: Math.PI * 2, size: 2 },
  burst:    { count: 18, color: 'rgb(248,237,229)', speed: 120, duration: 0.8, gravity: 0, spread: Math.PI * 2, size: 3 },
  dataflow: { count: 12, color: 'rgb(91,141,239)', speed: 55, duration: 1.6, gravity: -40, spread: 0.7, size: 2 },
};

export function spawnParticles(world, x, y, opts = {}) {
  if (opts.preset && PARTICLE_PRESETS[opts.preset]) {
    opts = { ...PARTICLE_PRESETS[opts.preset], ...opts };
  }
  const count = opts.count ?? 6;
  const speed = opts.speed ?? 55;
  const duration = opts.duration ?? 1.2;
  const gravity = opts.gravity ?? -18;
  const size = opts.size ?? 3;
  const spread = opts.spread ?? Math.PI * 2;
  const baseAngle = opts.angle ?? -Math.PI / 2;
  const color = opts.color || 'rgb(244,172,29)';
  for (let i = 0; i < count; i++) {
    const angle = baseAngle + (world.rng() - 0.5) * spread;
    const sp = speed * (0.55 + world.rng() * 0.7);
    world._fx.push({
      type: 'particle', x, y, age: 0, duration,
      vx: Math.cos(angle) * sp,
      vy: Math.sin(angle) * sp,
      gravity, color, size,
    });
  }
}

export function tickFx(world, dt) {
  // Advance active dialogues.
  for (const d of [...world._dialogues]) {
    if (d.idx >= d.messages.length) {
      world._dialogues = world._dialogues.filter(x => x !== d);
      if (d.onEnd) try { d.onEnd(); } catch {}
      continue;
    }
    if (d.currentBubbleId === null) {
      d.currentBubbleId = world._spawnBubble(d.entity, d.messages[d.idx], {
        kind: d.kind,
        duration: d.interval + 0.5,
      });
      if (!world._muted && audio[d.kind === 'think' ? 'think' : 'say']) {
        audio[d.kind === 'think' ? 'think' : 'say']();
      }
      world._touchLearner(d.entity);
      d.elapsed = 0;
    }
    d.elapsed += dt;
    if (d.elapsed >= d.interval) {
      const b = world._bubbles.get(d.currentBubbleId);
      if (b) { b.el.remove(); world._bubbles.delete(d.currentBubbleId); }
      d.idx++;
      d.currentBubbleId = null;
    }
  }
  for (const fx of world._fx) {
    fx.age += dt;
    if (fx.type === 'floatNumber') {
      fx.x += (fx.vx || 0) * dt;
      fx.y += (fx.vy != null ? fx.vy : -40) * dt;
      if (fx.gravity) fx.vy = (fx.vy != null ? fx.vy : 0) + fx.gravity * dt;
    }
    if (fx.type === 'packet') {
      fx.x += (fx.vx || 0) * dt;
      fx.y += (fx.vy || 0) * dt;
      if (fx.gravity) fx.vy = (fx.vy || 0) + fx.gravity * dt;
      if (fx.spin) fx.rot = (fx.rot || 0) + fx.spin * dt;
    }
    if (fx.type === 'lightPulse') {
      fx.x += (fx.vx || 0) * dt;
      fx.y += (fx.vy || 0) * dt;
      fx.trail.push({ x: fx.x, y: fx.y });
      if (fx.trail.length > 8) fx.trail.shift();
    }
    if (fx.type === 'epitaph')    fx.y -= 14 * dt;
    if (fx.type === 'particle') {
      fx.x += fx.vx * dt;
      fx.y += fx.vy * dt;
      fx.vy += (fx.gravity || 0) * dt;
    }
  }
  // Remove expired bubble DOM nodes.
  for (const [id, b] of world._bubbles) {
    b.age += dt;
    // Typewriter: reveal characters incrementally with subtle ticks.
    if (b.typewriter && b.typewriter.revealed < b.typewriter.full.length) {
      const tw = b.typewriter;
      tw.accum += dt * tw.cps;
      while (tw.accum >= 1 && tw.revealed < tw.full.length) {
        tw.accum -= 1;
        tw.revealed++;
        const ch = tw.full[tw.revealed - 1];
        b.el.textContent = tw.full.slice(0, tw.revealed);
        // Soft tick every 2 visible letters; skip spaces/punctuation.
        const tickable = ch && !/[\s,.!?;:¡¿\-]/.test(ch);
        if (tickable && !world._muted && (tw.revealed - tw.lastTickIdx) >= 3) {
          tw.lastTickIdx = tw.revealed;
          const baseFreq = b.entity?.id === 'oak' ? 1400 : (b.entity?.id === 'pikachu' ? 2200 : 1750);
          tone(baseFreq + (world.rng() - 0.5) * 200, 0.016, { vol: 0.018, type: 'triangle', attack: 0.001 });
        }
      }
    }
    if (b.age >= b.duration) {
      b.el.remove();
      world._bubbles.delete(id);
    } else if (b.age > b.duration - 0.4) {
      b.el.style.opacity = String(Math.max(0, (b.duration - b.age) / 0.4));
    }
  }
  // In-place compaction: avoid allocating a fresh array every frame.
  let w = 0;
  for (let r = 0; r < world._fx.length; r++) {
    const fx = world._fx[r];
    if (fx.age < fx.duration) {
      if (w !== r) world._fx[w] = fx;
      w++;
    }
  }
  world._fx.length = w;
}

export function positionBubbles(world) {
  const cam = world.camera || { x: world.W / 2, y: world.H / 2, zoom: 1, shakeX: 0, shakeY: 0 };
  const screenXPct = (ex) => (((ex - cam.x) * cam.zoom + world.W / 2 + cam.shakeX) / world.W) * 100;
  const screenYPct = (ey) => (((ey - cam.y) * cam.zoom + world.H / 2 + cam.shakeY) / world.H) * 100;
  // Cache the wrap rect once per frame to avoid layout thrash.
  const wrap = world.host?.shadowRoot?.querySelector('.wrap');
  const wrapRect = wrap?.getBoundingClientRect();
  // HTML overlays (labels, bubbles, name-labels, hint) use px font/padding, so
  // they don't grow when the canvas is scaled up (fullscreen). Publish a
  // --ui-scale on .overlays = displayed canvas width / base width, so the CSS
  // can scale text proportionally. Clamp to >=1: only grow (fullscreen), never
  // shrink small embeds below their current size. .stage width tracks the
  // displayed canvas (letterboxed in fullscreen), unlike .wrap (full viewport).
  const stageEl = world.host?.shadowRoot?.querySelector('.stage');
  if (stageEl) {
    const sw = stageEl.getBoundingClientRect().width;
    const uiScale = sw > 0 ? Math.max(1, sw / world.W) : 1;
    stageEl.style.setProperty('--ui-scale', uiScale.toFixed(4));
  }
  // Margin in screen pixels = (visual wall thickness in canvas px + small buffer) × scale.
  // Keeps bubbles clear of the painted in-canvas walls regardless of zoom level.
  const scale = wrapRect ? wrapRect.width / world.W : 1;
  const safe = world._safeArea();
  const marginLeftPx = Math.round(safe.left * scale);
  const marginRightPx = Math.round(safe.right * scale);
  // Transform de un globo: ancla arriba-centro (-100% - 18px sobre la cabeza),
  // con `shift` horizontal (clamp al canvas) y `lift` vertical (anti-solape).
  const bubbleTransform = (shift, lift) =>
    `translate(calc(-50% + ${Math.round(shift)}px), calc(-100% - ${18 + Math.round(lift)}px))`;

  const placed = [];   // globos ya posicionados este frame, para el anti-solape
  for (const [, b] of world._bubbles) {
    const e = b.entity;
    if (!e) continue;
    // El globo se ancla a la CABEZA del blob, no a su centro: (e.x, e.y) es
    // el centro del sprite, así que se resta media altura (hero 11 celdas,
    // minion 7) para que el globo flote sobre el personaje, no encima de él.
    const halfH = ((e.hero !== false ? 11 : 7) * (e.scale || 4)) / 2;
    b.el.style.left = `${screenXPct(e.x)}%`;
    b.el.style.top = `${screenYPct(e.y - halfH)}%`;
    // Reset transform before measuring so the bounding rect reflects the
    // new anchor position, not last frame's clamped offset.
    b.el.style.transform = bubbleTransform(0, 0);
    if (wrapRect) {
      const elRect = b.el.getBoundingClientRect();
      let shift = 0;
      if (elRect.left < wrapRect.left + marginLeftPx) shift = (wrapRect.left + marginLeftPx) - elRect.left;
      else if (elRect.right > wrapRect.right - marginRightPx) shift = (wrapRect.right - marginRightPx) - elRect.right;
      // Anti-solape: si dos personajes hablan a la vez (o un globo entra
      // mientras otro se desvanece), las cajas se montan. Se sube este globo
      // por encima de los ya colocados con los que choca, manteniendo la cola
      // apuntando al hablante (el globo solo sube, no se mueve de lado).
      // El apilado se calcula contra las posiciones OBJETIVO de los ya
      // colocados (layout estable), no contra su posición animada.
      let targetLift = 0;
      const left = elRect.left + shift, right = elRect.right + shift;
      const gap = 6 * scale;
      let guard = 0;
      while (guard++ < 24) {
        let bumped = false;
        for (const p of placed) {
          const overlapX = left < p.right - 2 && right > p.left + 2;
          const top = elRect.top - targetLift, bottom = elRect.bottom - targetLift;
          const overlapY = top < p.bottom - 2 && bottom > p.top + 2;
          if (overlapX && overlapY) {
            targetLift += (bottom - p.top) + gap;
            bumped = true;
          }
        }
        if (!bumped) break;
      }
      // Suavizado: el desplazamiento hacia la nueva altura se interpola, no
      // salta. En el primer frame del globo arranca ya en su objetivo (no
      // sube desde abajo al aparecer); después persigue el objetivo.
      if (b._lift == null) b._lift = targetLift;
      else {
        const d = targetLift - b._lift;
        b._lift = Math.abs(d) < 0.5 ? targetLift : b._lift + d * 0.15;
      }
      const lift = b._lift;
      // Keep the tail pointing at the speaker: the bubble box shifts to stay
      // inside the canvas, so the ::after triangle compensates in the opposite
      // direction (clamped short of the rounded corners).
      let tail = 0;
      if (shift !== 0) {
        const maxTail = Math.max(0, elRect.width / 2 - 16);
        tail = Math.max(-maxTail, Math.min(maxTail, -shift));
      }
      b.el.style.transform = bubbleTransform(shift, lift);
      b.el.style.setProperty('--tail-shift', `${Math.round(tail)}px`);
      // Las posiciones objetivo alimentan el apilado de los siguientes globos.
      placed.push({ left, right, top: elRect.top - targetLift, bottom: elRect.bottom - targetLift });
    }
  }
  if (world._nameLabels) {
    for (const [, n] of world._nameLabels) {
      const e = n.entity;
      if (!e) continue;
      // El nombre vive DEBAJO del blob: arriba está la zona de los globos de
      // diálogo y se tapaban. Media altura del sprite (hero 11 celdas, minion
      // 7) más un margen corto, con tope DURO por encima de la banda de
      // subtítulos (máxima de noesis): el nombre nunca cae sobre el caption.
      // El 56 es CAPTION_BAND de learner.js; mantener en sintonía.
      const half = ((e.hero !== false ? 11 : 7) * (e.scale || 4)) / 2;
      const ny = Math.min(e.y + half + 4, world.H - 56);
      n.el.style.left = `${screenXPct(e.x)}%`;
      n.el.style.top = `${screenYPct(ny)}%`;
      n.el.style.opacity = e._sleeping ? '0.35' : String(e._alpha ?? 1);
    }
  }
}

export function drawFx(world, ctx) {
  for (const fx of world._fx) {
    if (fx.type === 'floatNumber') {
      const a = Math.max(0, 1 - fx.age / fx.duration);
      ctx.fillStyle = fx.color.replace(')', `,${a.toFixed(2)})`).replace('rgb(', 'rgba(');
      ctx.font = `600 ${fx.size || 13}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      drawLabel(ctx, fx.text, fx.x, fx.y);   // notación _/^ (ej. "10^{9}") en la cifra
    } else if (fx.type === 'lightPulse') {
      // Beam of light: glowing dot with halo + fading trail.
      let a = Math.max(0, 1 - fx.age / fx.duration);
      if (fx.fadeAt != null && fx.age > fx.fadeAt) {
        const fadeProgress = Math.min(1, (fx.age - fx.fadeAt) / (fx.fadeDur || 0.35));
        a *= (1 - fadeProgress);
      }
      if (a > 0.001) {
        // Trail: fading older positions
        for (let i = 0; i < fx.trail.length; i++) {
          const t = fx.trail[i];
          const ta = a * (i / fx.trail.length) * 0.55;
          ctx.fillStyle = fx.color.replace('rgb(', 'rgba(').replace(')', `,${ta.toFixed(3)})`);
          ctx.beginPath();
          ctx.arc(t.x, t.y, fx.size * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
        // Outer halo
        ctx.fillStyle = fx.color.replace('rgb(', 'rgba(').replace(')', `,${(a * 0.35).toFixed(3)})`);
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.size * 2.8, 0, Math.PI * 2);
        ctx.fill();
        // Mid glow
        ctx.fillStyle = fx.color.replace('rgb(', 'rgba(').replace(')', `,${(a * 0.7).toFixed(3)})`);
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.size * 1.5, 0, Math.PI * 2);
        ctx.fill();
        // Hot core
        ctx.fillStyle = fx.coreColor.replace('rgb(', 'rgba(').replace(')', `,${a.toFixed(3)})`);
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
        // Data label trailing below the orb
        if (fx.label) {
          ctx.fillStyle = fx.labelColor.replace('rgb(', 'rgba(').replace(')', `,${a.toFixed(3)})`);
          ctx.font = `600 ${fx.labelSize || 12}px ui-monospace, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(fx.label, fx.x, fx.y + fx.size * 3 + 2);
        }
      }
    } else if (fx.type === 'packet') {
      // Paper plane pixel-art rendering + label below.
      const a = Math.max(0, 1 - Math.pow(fx.age / fx.duration, 1.8));
      const col = fx.color.replace(')', `,${a.toFixed(2)})`).replace('rgb(', 'rgba(');
      const shadow = `rgba(0,0,0,${(a * 0.25).toFixed(2)})`;
      const facing = fx.vx >= 0 ? 1 : -1;
      ctx.save();
      ctx.translate(Math.round(fx.x), Math.round(fx.y));
      if (fx.rot) ctx.rotate(fx.rot);
      ctx.scale(facing, 1);
      // Pixel-art paper plane (anchored at center). Each pixel = 2.
      const p = 2;
      const px = (gx, gy, gw, gh, c) => { ctx.fillStyle = c; ctx.fillRect(gx * p, gy * p, gw * p, gh * p); };
      // Outline / shadow
      px(-4, 0, 8, 1, shadow);
      // Body (triangle-ish)
      px(-4, -2, 1, 1, col);
      px(-4, -1, 2, 1, col);
      px(-4, 0, 3, 1, col);
      px(-4, 1, 4, 1, col);
      px(-4, 2, 1, 1, col);
      px(-3, 0, 5, 1, col);
      px(-2, -1, 4, 1, col);
      px(-1, -2, 3, 1, col);
      px(0, -3, 2, 1, col);
      px(1, -4, 1, 1, col);
      px(2, -3, 1, 1, col);
      px(3, -2, 1, 1, col);
      // Fold lines (slightly darker)
      const darker = fx.color.replace(')', `,${(a * 0.5).toFixed(2)})`).replace('rgb(', 'rgba(');
      px(-3, 0, 4, 1, darker);
      px(-2, 1, 3, 1, darker);
      ctx.restore();
      // Label trailing behind (no flip)
      if (fx.label) {
        ctx.fillStyle = fx.labelColor.replace(')', `,${a.toFixed(2)})`).replace('rgb(', 'rgba(');
        ctx.font = '600 10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(fx.label, Math.round(fx.x), Math.round(fx.y) + 8);
      }
    } else if (fx.type === 'epitaph') {
      const t = fx.age / fx.duration;
      const a = Math.max(0, 1 - Math.pow(t, 1.5));
      ctx.fillStyle = `rgba(110,120,150,${a.toFixed(2)})`;
      ctx.font = `italic 600 ${fx.size || 11}px 'Fraunces', Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fx.text, fx.x, fx.y);
    } else if (fx.type === 'particle') {
      const t = fx.age / fx.duration;
      const a = Math.max(0, 1 - t);
      const base = fx.color;
      let rgba;
      if (base.startsWith('rgba')) {
        rgba = base.replace(/[\d.]+\)$/, a.toFixed(2) + ')');
      } else if (base.startsWith('rgb(')) {
        rgba = base.replace('rgb(', 'rgba(').replace(')', ',' + a.toFixed(2) + ')');
      } else {
        rgba = base;
      }
      ctx.fillStyle = rgba;
      ctx.fillRect(Math.round(fx.x), Math.round(fx.y), fx.size || 2, fx.size || 2);
    } else if (fx.type === 'transfer') {
      const from = fx.from, to = fx.to;
      if (!from || !to) continue;
      const dx = to.x - from.x, dy = to.y - from.y;
      const dist = Math.hypot(dx, dy);
      const steps = Math.max(2, Math.floor(dist / 6));
      const pulse = 0.5 + 0.4 * Math.sin(world.t * 6);
      const a = Math.min(1, Math.max(0, fx.age < 0.2 ? fx.age / 0.2 : (fx.duration - fx.age) / 0.3));
      ctx.fillStyle = `rgba(244,172,29,${(pulse * a).toFixed(2)})`;
      for (let i = 1; i < steps; i++) {
        if (i % 2 === 0) continue;
        const tt = i / steps;
        ctx.fillRect(Math.round(from.x + dx * tt) - 1, Math.round(from.y + dy * tt) - 1, 3, 3);
      }
    }
  }
}
