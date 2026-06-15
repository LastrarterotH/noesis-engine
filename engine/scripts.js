// noesis-engine / scripts
// Declarative step-sequence runner: walk/say/think/mood/fx steps, labels,
// goto/loop, conditional branches, waits (time, arrive, predicate) and inline
// JS via `do`/`call`. Operates on a `world` instance (needs world._scripts,
// world.t, world.state, world.byId, world.fx). World owns the state and exposes
// runScript/stopScripts/_tickScripts/_evalScriptExpr/_processScript/
// _execScriptStep as thin wrappers.

export function runScript(world, steps, opts = {}) {
  if (!Array.isArray(steps) || !steps.length) return null;
  if (!world._scripts) world._scripts = [];
  if (opts.id) world._scripts = world._scripts.filter(s => s.id !== opts.id);
  if (opts.stopOthers) world._scripts = [];
  const script = {
    id: opts.id || null, steps, i: 0,
    waitUntil: 0, waitForArrive: null, waitPredicate: null,
    done: false, _lastEntity: null, labels: {},
  };
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].label) script.labels[steps[i].label] = i;
  }
  world._scripts.push(script);
  return script;
}

export function stopScripts(world, id) {
  if (!world._scripts) return;
  if (id) world._scripts = world._scripts.filter(s => s.id !== id);
  else world._scripts = [];
}

export function tickScripts(world, dt) {
  if (!world._scripts || !world._scripts.length) return;
  for (const s of world._scripts) processScript(world, s);
  world._scripts = world._scripts.filter(s => !s.done);
}

export function evalScriptExpr(world, expr) {
  try {
    const fn = new Function('world', 'state', 's', 'return (' + expr + ');');
    return fn(world, world.state, world.state);
  } catch (err) { console.warn('script expr error:', expr, err); return undefined; }
}

export function processScript(world, sc) {
  if (sc.done) return;
  if (world.t < sc.waitUntil) return;
  if (sc.waitForArrive) {
    const e = world.byId(sc.waitForArrive);
    if (e && e.behavior && (e.behavior.type === 'walkTo' || e.behavior.type === 'followPath')) return;
    // También se espera a un prop en viaje (movePropPath); los loops no
    // terminan nunca, así que no se esperan.
    if (!e && world._propMovers && world._propMovers.some(m => m.prop.id === sc.waitForArrive && !m.done && !m.loop)) return;
    sc.waitForArrive = null;
  }
  if (sc.waitPredicate) {
    if (!evalScriptExpr(world, sc.waitPredicate)) return;
    sc.waitPredicate = null;
  }
  let guard = 0;
  while (sc.i < sc.steps.length && guard++ < 256) {
    const step = sc.steps[sc.i++];
    if (step.label != null) continue;
    if (step.goto != null) {
      const idx = sc.labels[step.goto];
      if (idx != null) sc.i = idx + 1;
      continue;
    }
    // `loop` solo reinicia el guion cuando es un step de control puro: en un
    // step `path`, `loop` es del camino (repetir la polilínea), no del guion.
    if (step.loop && step.path == null) { sc.i = 0; continue; }
    if (step.end === true) { sc.done = true; return; }
    if (step.if != null) {
      const truthy = !!evalScriptExpr(world, step.if);
      const branch = truthy ? step.then : step.else;
      if (Array.isArray(branch) && branch.length) {
        sc.steps.splice(sc.i, 0, ...branch);
        // Injecting branch steps shifts every later step; keep label
        // targets pointing at the right steps so goto/loop still work.
        for (const k in sc.labels) {
          if (sc.labels[k] >= sc.i) sc.labels[k] += branch.length;
        }
      }
      continue;
    }
    execScriptStep(world, step, sc);
    if (step.wait != null) { sc.waitUntil = world.t + step.wait; return; }
    if (step.waitFor === 'arrive') { sc.waitForArrive = sc._lastEntity; return; }
    if (typeof step.waitFor === 'string' && step.waitFor.startsWith('arrive:')) {
      sc.waitForArrive = step.waitFor.slice(7); return;
    }
    if (step.waitUntil) { sc.waitPredicate = step.waitUntil; return; }
  }
  if (sc.i >= sc.steps.length) sc.done = true;
}

export function execScriptStep(world, step, sc) {
  const fx = world.fx; const W = world;
  let lastE = null;
  if (step.walk) {
    const e = world.byId(step.walk);
    if (e) {
      const t = step.to;
      let tx, ty;
      if (Array.isArray(t)) { tx = t[0]; ty = t[1]; }
      else if (typeof t === 'string') { const other = world.byId(t); if (other) { tx = other.x; ty = other.y; } }
      else if (t && typeof t === 'object') { tx = t.x; ty = t.y; }
      if (tx != null && ty != null) {
        e.behavior = { type: 'walkTo', target: { x: tx, y: ty }, speed: step.speed || 70 };
        sc._lastEntity = step.walk; lastE = e;
      }
    }
  }
  if (step.path) {
    const e = world.byId(step.path);
    if (e && Array.isArray(step.points)) {
      e.behavior = {
        type: 'followPath', points: step.points,
        speed: step.speed, duration: step.duration, easing: step.easing,
        curve: step.curve, loop: step.loop, fromCurrent: step.fromCurrent,
      };
      sc._lastEntity = step.path; lastE = e;
    } else if (!e && Array.isArray(step.points)) {
      // Props con id también viajan (sobres, pelotas, globos): los mueve el
      // mover del motor, porque no tienen behaviors de learner.
      const p = world.props.find(pr => pr.id === step.path);
      if (p) {
        world.movePropPath(p, step.points, {
          speed: step.speed, duration: step.duration, easing: step.easing,
          loop: step.loop, fromCurrent: step.fromCurrent,
        });
        sc._lastEntity = step.path;
      }
    }
  }
  if (step.stop) { const e = world.byId(step.stop); if (e) e.behavior = { type: 'stop' }; }
  if (step.say) { const e = world.byId(step.say); if (e) fx.say(e, step.text || '', { duration: step.duration ?? 2.5 }); }
  if (step.think) { const e = world.byId(step.think); if (e) fx.think(e, step.text || '', { duration: step.duration ?? 2.5 }); }
  if (step.exclaim) fx.exclaim(world.byId(step.exclaim));
  if (step.surprise) fx.surprise(world.byId(step.surprise));
  if (step.wonder) fx.wonder(world.byId(step.wonder));
  if (step.mood) { const e = world.byId(step.mood); if (e) fx.mood(e, step.value || 'neutral', step.duration ?? 1.4); }
  if (step.flash) fx.flash(world.byId(step.flash));
  if (step.reinforce) fx.reinforce(world.byId(step.reinforce));
  if (step.tone != null) fx.tone(step.tone, step.dur ?? 0.4, step.opts || {});
  if (step.sweep) fx.sweep(step.sweep[0], step.sweep[1], step.dur ?? 0.3, step.opts || {});
  if (step.particles) fx.particles(step.particles.x, step.particles.y, step.particles);
  if (step.floatNumber) fx.floatNumber(step.floatNumber.x, step.floatNumber.y, step.floatNumber.text, step.floatNumber);
  // --- Pasos declarativos (escenas sin JS): reacciones, camara, caption, meter ---
  if (step.celebrate) fx.celebrate(world.byId(step.celebrate));
  if (step.cry) fx.cry(world.byId(step.cry));
  if (step.thinking) fx.thinking(world.byId(step.thinking));
  if (step.appear) fx.appear(world.byId(step.appear), step.duration);
  if (step.vanish) fx.vanish(world.byId(step.vanish), step.duration);
  if (step.scene) {
    // Cambio de set: fade a negro + teleport de cámara + fade in (~1.5 s).
    // Regla del proyecto: la transición entre sets es SIEMPRE este fade,
    // nunca paneo lateral. `move` opcional reubica entidades durante el
    // negro, para que entren ya posicionadas en el set nuevo.
    const st = world._setById && world._setById[step.scene];
    if (st) {
      world._currentSet = st;
      world.fx.transitionTo(st.cx, st.cy, {
        zoom: st.zoom,
        onTeleport: () => {
          if (step.move && typeof step.move === 'object') {
            for (const [mid, pos] of Object.entries(step.move)) {
              const e = world.byId(mid);
              if (e && Array.isArray(pos)) { e.x = pos[0]; e.y = pos[1]; e.behavior = null; }
            }
          }
        },
      });
    }
  }
  if (step.camera) {
    const c = step.camera;
    if (c.reset) {
      // En escenas con sets, reset vuelve al encuadre del set ACTUAL (el
      // guion ya viajó); sin sets, al centro del canvas. Suelta el follow y,
      // salvo orden explícita en el mismo step, apaga el letterbox.
      world.camera.follow = null;
      const home = world._currentSet;
      if (home) {
        world.camera.targetX = home.cx;
        world.camera.targetY = home.cy;
        world.camera.targetZoom = home.zoom ?? 1;
      } else {
        fx.cameraReset();
      }
      if (c.letterbox == null) world._letterboxTarget = 0;
    } else {
      if (c.zoom != null) fx.cameraZoom(c.zoom);
      if (Array.isArray(c.to)) fx.cameraPan(c.to[0], c.to[1]);
      else if (typeof c.to === 'string') {
        // Push-in a una entidad o prop por id: centra en su centro visual.
        const pt = world._focusPoint ? world._focusPoint({ target: c.to }) : null;
        if (pt) fx.cameraPan(pt.x, pt.y);
      }
      if (c.follow === false) world.camera.follow = null;
      else if (typeof c.follow === 'string') {
        const fe = world.byId(c.follow);
        if (fe) fx.cameraFollow(fe);
      }
      if (c.shake) fx.cameraShake(c.shake === true ? 8 : c.shake, 0.5);
    }
    if (c.letterbox != null) world._letterboxTarget = c.letterbox ? 1 : 0;
  }
  if ('caption' in step) {
    // Dos slots independientes: la caption de narrador (pie del lienzo) y el
    // título de acto (banda superior, `style: "title"`). Cada uno se borra
    // con su propio { caption: "" }.
    const slot = step.style === 'title' ? world._title : world._caption;
    if (slot) slot.text = step.caption || '';
  }
  if (step.meter) {
    const m = world._meterById && world._meterById[step.meter];
    if (m) {
      const to = step.to != null ? step.to : m.value;
      if (step.duration) world.tween(m, 'value', to, { duration: step.duration, easing: step.easing || 'easeOutCubic' });
      else m.value = to;
    }
  }
  if (step.chart) {
    // Step de gráficos declarativos: mostrar/ocultar el chart y revelar sus
    // series (o las barras) en el momento justo, con tween opcional.
    const c = world._chartById && world._chartById[step.chart];
    if (c) {
      const ease = step.easing || 'easeInOut';
      const tw = (obj, key, to2) => step.duration
        ? world.tween(obj, key, to2, { duration: step.duration, easing: ease })
        : (obj[key] = to2);
      if (step.show === true) tw(c, 'alpha', 1);
      if (step.hide === true) tw(c, 'alpha', 0);
      if (typeof step.alpha === 'number') tw(c, 'alpha', step.alpha);
      if (step.series != null) {
        const sr = (c.series || []).find(x => x.id === step.series);
        if (sr && typeof step.reveal === 'number') tw(sr, 'reveal', step.reveal);
      } else if (typeof step.reveal === 'number') {
        tw(c, 'reveal', step.reveal);
      }
    }
  }
  if (step.weather != null) {
    // Clima en vivo: arranca o detiene partículas de ambiente a mitad de
    // escena (la tormenta que arrecia, la nieve que empieza, la lluvia que
    // amaina). tickAmbient consulta world._ambient.particles cada frame, así
    // el cambio surte efecto al instante. "none"/false detiene el spawn (las
    // partículas que quedan caen solas).
    const amb = world._ambient || (world._ambient = {});
    const w = step.weather;
    if (w === 'none' || w === false) {
      amb.particles = null;
    } else {
      amb.particles = w;
      if (step.intensity != null) amb.intensity = step.intensity;
      // fireflies/stars son fuentes puntuales: necesitan población base.
      if ((w === 'fireflies' || w === 'stars') && world._makeAmbientParticle) {
        const target = w === 'fireflies' ? 18 : 90;
        const have = (world._ambientParticles || []).filter(p => p.kind === w).length;
        for (let i = have; i < target; i++) {
          world._ambientParticles.push(world._makeAmbientParticle(w, true));
        }
      }
    }
  }
  if (step.showLabel != null) world.showLabel(step.showLabel);
  if (step.hideLabel != null) world.hideLabel(step.hideLabel);
  if (step.focus != null) {
    // Foco declarativo: un halo de luz pulsante sobre una entidad (la sigue)
    // o sobre un punto del mundo. `off: true` lo apaga con fade. El dibujo
    // vive en world.js: _drawFocuses; el estado se limpia en cada reset.
    if (!world._focuses) world._focuses = [];
    const fkey = Array.isArray(step.focus) ? step.focus.join(',') : String(step.focus);
    const fdur = step.duration ?? 0.5;
    const existing = world._focuses.find(x => x.key === fkey);
    if (step.off) {
      if (existing) {
        world.tween(existing, 'alpha', 0, {
          duration: fdur, easing: 'easeInOut',
          onDone: () => { world._focuses = world._focuses.filter(x => x !== existing); },
        });
      }
    } else {
      const f = existing || { key: fkey, alpha: 0, phase: world._focuses.length * 1.7 };
      if (!existing) world._focuses.push(f);
      f.target = Array.isArray(step.focus) ? { x: step.focus[0], y: step.focus[1] } : step.focus;
      if (step.color) f.color = step.color;
      if (step.radius) f.radius = step.radius;
      world.tween(f, 'alpha', 1, { duration: fdur, easing: 'easeInOut' });
    }
  }
  if (step.tween) {
    // Tween declarativo: anima una clave de world.state ("deuda") o una
    // propiedad de una entidad por id con punto ("alma._alpha") sin JS.
    const tpath = String(step.tween);
    const tdot = tpath.indexOf('.');
    let tobj = world.state, tkey = tpath;
    if (tdot > 0) {
      const thead = tpath.slice(0, tdot);
      // "ambient.darkness" anima el ambiente vivo (amaneceres, anocheceres);
      // cualquier otro prefijo es el id de una entidad.
      tobj = thead === 'ambient'
        ? (world._ambient || (world._ambient = {}))
        : (world.byId(thead) || (world.props && world.props.find(pp => pp.id === thead)) || null);
      tkey = tpath.slice(tdot + 1);
    }
    if (tobj && typeof step.to === 'number') {
      world.tween(tobj, tkey, step.to, { duration: step.duration ?? 0.6, easing: step.easing || 'easeInOut' });
    }
  }
  if (step.set) for (const [k, v] of Object.entries(step.set)) world.state[k] = v;
  if (step.add) for (const [k, v] of Object.entries(step.add)) world.state[k] = (world.state[k] || 0) + v;
  if (step.clamp) for (const [k, r] of Object.entries(step.clamp)) world.state[k] = Math.max(r[0], Math.min(r[1], world.state[k] || 0));
  if (step.do) {
    try {
      const fn = new Function('world', 'state', 's', 'e', step.do);
      fn(world, world.state, world.state, lastE);
    } catch (err) { console.warn('script.do error:', step.do, err); }
  }
  if (step.call) {
    const v = evalScriptExpr(world, step.call);
    if (typeof v === 'function') { try { v(); } catch (err) { console.warn('script.call error:', err); } }
  }
  if (step.runScript) runScript(world, step.runScript, step.runScriptOpts || {});
}
