// noesis-engine / learner
// Learner entity lifecycle and per-frame simulation: timer/state init, the
// touch (wake) signal, and the full tick (blink, behaviors, world bounds,
// horizon clamp, separation, auto-greet, wall/prop collision, zone effects,
// fx timers, appear/vanish, aging/death, imitation, sleep). Operates on a
// `world` instance; World exposes _initLearner/_touchLearner/_tickLearner as
// thin wrappers.

// Máxima de noesis: la banda inferior del lienzo es de los subtítulos. Ningún
// learner (ni su name-label, que cuelga bajo los pies) puede invadirla. El
// El caption VISUAL se dibuja en H-40 (subido para dejar una franja al pie para
// la barra de avance/scrubber), pero CAPTION_BAND se MANTIENE en 56: de esta
// banda depende la ALCANZABILIDAD de los `walk` (learner.js clampa el pie a
// H-CAPTION_BAND-NAME_RESERVE = H-76). Subirla volvería inalcanzables destinos
// que quedan en la franja y colgaría el guion. Con 56, el pie (H-76) queda
// apenas por encima del tope de una caption de 2 líneas (~H-74): no se pisan.
export const CAPTION_BAND = 56;   // alto reservado para el caption (hasta 2 líneas)
export const NAME_RESERVE = 20;   // alto del name-label que cuelga bajo los pies

// Catmull-Rom spline sampler: densify control points into a smooth polyline
// that passes through every control point. Used by the followPath behavior.
function sampleSpline(P, perSeg) {
  if (P.length < 3) return P.slice();
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || P[i + 1];
    for (let j = 0; j < perSeg; j++) {
      const t = j / perSeg, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(P[P.length - 1]);
  return out;
}

// Easing for path progress (only applies when followPath has a `duration`).
function easePath(p, kind) {
  if (kind === 'easeIn') return p * p;
  if (kind === 'easeOut') return 1 - (1 - p) * (1 - p);
  if (kind === 'easeInOut' || kind === true) return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  return p;
}

export function initLearner(world, e) {
  e.vx = e.vx || 0;
  e.vy = e.vy || 0;
  e._blinkT = world.rng() * 4;
  e._nextBlink = 3 + world.rng() * 4;
  e._blinkOpen = true;
  e._walkPhase = 0;
  e._wandOffset = world.rng() * Math.PI * 2;
  e._breathT = world.rng() * Math.PI * 2;
  e._surpriseT = 0;
  e._reinforceT = 0;
  e._flashT = 0;
  e._lastTouchT = 0;
  e._sleeping = false;
  e._nextZ = 0;
  // Mood + appearance.
  e.mood = e.mood || 'neutral';   // neutral | happy | sad | confused | tired
  e._moodT = 0;
  e._moodPrev = 'neutral';
  // Identity.
  e.name = e.name || null;
  e.accessory = e.accessory || null; // 'hat' | null (extensible)
  // Look reference (another entity); takes precedence over motion-based look.
  e.lookAt = e.lookAt || null;
  // Alpha + fade timers.
  e._alpha = e._alpha ?? 1;
  e._appearT = 0; e._appearDur = 0;
  e._vanishT = 0; e._vanishDur = 0;
  e._onVanish = null;
  // Health, extinction, aging, imitation.
  e.health = e.health || 'normal';      // 'normal' | 'sick' | 'feverish' | 'frozen'
  e._healthT = 0;
  e._healthPrev = 'normal';
  e.extinguishable = !!e.extinguishable;
  e._lastReinforceT = e.extinguishable ? world.t : null;
  e.extinctionThreshold = e.extinctionThreshold ?? 8;   // s without reinforce → start fading
  e.ageRate = e.ageRate || 0;           // years per second
  e._age = e._age || 0;
  e.maxAge = e.maxAge || null;          // years at which _age triggers dying
  e._dying = false;
  e._deathT = 0;
  e._deathDur = 2.0;
  e._dead = false;
  e._onDeath = null;
  e.imitates = e.imitates || null;
  e._imitateNext = 0;
  // Jump animation timers (used by celebrate and any explicit jump).
  e._jumpT = 0;
  e._jumpDur = 0;
}

export function touchLearner(world, e) {
  if (!e) return;
  e._lastTouchT = world.t;
  e._sleeping = false;
}

export function tickLearner(world, e, dt) {
  // Blink timer: idle 3-7s, eyes closed ~120ms.
  e._blinkT += dt;
  if (e._blinkT >= e._nextBlink && e._blinkT < e._nextBlink + 0.12) {
    e._blinkOpen = false;
  } else if (e._blinkT >= e._nextBlink + 0.12) {
    e._blinkOpen = true;
    e._blinkT = 0;
    e._nextBlink = 3 + world.rng() * 4;
  }
  // Sleeping learner: stop all motion regardless of behavior.
  if (e._sleeping) {
    e.vx = 0; e.vy = 0;
  } else if (e.behavior) {
    const b = e.behavior;
    if (b.type === 'walkTo' && b.target) {
      const dx = b.target.x - e.x, dy = b.target.y - e.y;
      const d = Math.hypot(dx, dy);
      // minDistance: stop short of the target (useful when target is another blob);
      // threshold: stop on top of the target (default 4 px for ground points).
      const stopAt = b.minDistance ?? b.threshold ?? 4;
      if (d < stopAt) {
        e.vx = 0; e.vy = 0;
        if (b.onArrive) try { b.onArrive(e, world); } catch {}
        e.behavior = null;
      } else {
        const sp = b.speed ?? 60;
        e.vx = dx / d * sp;
        e.vy = dy / d * sp;
      }
    } else if (b.type === 'followPath' && Array.isArray(b.points) && b.points.length >= 1) {
      // Traverse a list of waypoints once (or loop). `curve` smooths through
      // them (Catmull-Rom); `duration` + `easing` time the whole path, else
      // `speed` is constant. Position is driven by injecting the velocity that
      // lands on the next point, so bounds/collision still apply.
      if (!b._path) {
        let pts = b.points.map(p => Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y });
        if (b.fromCurrent !== false) pts = [{ x: e.x, y: e.y }, ...pts];
        if (b.curve && pts.length >= 3) pts = sampleSpline(pts, b.samples ?? 16);
        const cum = [0]; let total = 0;
        for (let i = 1; i < pts.length; i++) { total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); cum.push(total); }
        b._path = pts; b._cum = cum; b._total = total || 1; b._elapsed = 0; b._dist = 0;
      }
      const cum = b._cum, P = b._path;
      const pointAt = (dist) => {
        if (dist <= 0) return P[0];
        if (dist >= b._total) return P[P.length - 1];
        let i = 1; while (i < cum.length && cum[i] < dist) i++;
        const seg = (cum[i] - cum[i - 1]) || 1, f = (dist - cum[i - 1]) / seg;
        return { x: P[i - 1].x + (P[i].x - P[i - 1].x) * f, y: P[i - 1].y + (P[i].y - P[i - 1].y) * f };
      };
      let targetDist;
      if (b.duration) {
        b._elapsed += dt;
        const p = Math.min(1, b._elapsed / b.duration);
        targetDist = easePath(p, b.easing) * b._total;
      } else {
        b._dist += (b.speed ?? 60) * dt;
        targetDist = Math.min(b._dist, b._total);
      }
      const arrived = targetDist >= b._total - 0.001;
      const pos = pointAt(targetDist);
      const idt = dt || 1 / 60;
      e.vx = (pos.x - e.x) / idt;
      e.vy = (pos.y - e.y) / idt;
      if (arrived) {
        if (b.loop) { b._elapsed = 0; b._dist = 0; e.x = P[0].x; e.y = P[0].y; e.vx = 0; e.vy = 0; }
        else { if (b.onArrive) try { b.onArrive(e, world); } catch {} e.behavior = null; }
      }
    } else if (b.type === 'fleeFrom' && b.source) {
      const dx = e.x - b.source.x, dy = e.y - b.source.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = b.speed ?? 80;
      e.vx = dx / d * sp;
      e.vy = dy / d * sp;
    } else if (b.type === 'patrolBetween' && Array.isArray(b.points) && b.points.length >= 2) {
      if (b._idx == null) b._idx = 0;
      const target = b.points[b._idx];
      const dx = target.x - e.x, dy = target.y - e.y;
      const d = Math.hypot(dx, dy);
      const stopAt = b.threshold ?? 6;
      if (d < stopAt) {
        b._idx = (b._idx + 1) % b.points.length;
        e.vx = 0; e.vy = 0;
      } else {
        const sp = b.speed ?? 55;
        e.vx = dx / d * sp;
        e.vy = dy / d * sp;
      }
    } else if (b.type === 'followEntity' && b.target) {
      const dx = b.target.x - e.x, dy = b.target.y - e.y;
      const d = Math.hypot(dx, dy);
      const desired = b.distance ?? 40;
      const sp = b.speed ?? 60;
      if (d > desired + 6) {
        e.vx = dx / d * sp;
        e.vy = dy / d * sp;
      } else if (d < desired - 6 && d > 0.001) {
        e.vx = -dx / d * sp * 0.5;
        e.vy = -dy / d * sp * 0.5;
      } else {
        e.vx *= 0.85; e.vy *= 0.85;
      }
    } else if (b.type === 'idleWander') {
      const amp = b.amplitude ?? 20;
      e.vx = Math.sin(world.t * 0.7 + e._wandOffset) * amp;
      e.vy = Math.cos(world.t * 0.55 + e._wandOffset) * amp * 0.7;
    } else if (b.type === 'stop') {
      e.vx = 0; e.vy = 0;
    }
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    const margin = (e.scale || 3) * 6;
    // El borde derecho del mundo es worldRight (W, o más allá si hay sets):
    // un learner teleportado a un set lejano no debe rebotar de regreso.
    const right = world.worldRight ?? world.W;
    if (e.x < margin) { e.x = margin; if (e.vx < 0) e.vx = -e.vx; }
    if (e.x > right - margin) { e.x = right - margin; if (e.vx > 0) e.vx = -e.vx; }
    if (e.y < margin) { e.y = margin; if (e.vy < 0) e.vy = -e.vy; }
    if (e.y > world.H - margin) { e.y = world.H - margin; if (e.vy > 0) e.vy = -e.vy; }
  }
  // Horizon constraint: if the scene has a sky region, keep learners on
  // the ground side (center below horizonY). Allows the head to peek up.
  const cfg = world.config.canvas || {};
  if (cfg.sky != null && e.skybound !== true) {
    const horizonY = Math.round(world.H * (cfg.horizon ?? 0.45));
    if (e.y < horizonY) {
      e.y = horizonY;
      if (e.vy < 0) e.vy = -e.vy * 0.4;
    }
  }
  // Máxima: el cuerpo y el name-label quedan SIEMPRE por encima de la banda de
  // subtítulos. Vale para todo learner, tenga o no behavior. (e.y es el centro;
  // los pies están a media altura del sprite por debajo.)
  {
    const half = ((e.hero !== false ? 11 : 7) * (e.scale || 4)) / 2;
    const footMax = world.H - CAPTION_BAND - NAME_RESERVE;
    if (e.y + half > footMax) { e.y = footMax - half; if (e.vy > 0) e.vy = 0; }
  }
  // Collision / separation: push e away from any overlapping learner.
  // Default ON for all learners; opt-out per entity with `solid: false`.
  if (e.solid !== false && !e._dead) {
    const rE = (e.scale || 3) * ((e.hero ? 9 : 5) / 2);
    for (const other of world.entities) {
      if (other === e || other.type !== 'learner' || other.solid === false || other._dead) continue;
      const rO = (other.scale || 3) * ((other.hero ? 9 : 5) / 2);
      const dx = e.x - other.x, dy = e.y - other.y;
      const d = Math.hypot(dx, dy);
      const minD = rE + rO + 2;
      if (d < minD && d > 0.001) {
        const push = (minD - d) * 0.5;
        const ux = dx / d, uy = dy / d;
        e.x += ux * push;
        e.y += uy * push;
      }
    }
  }
  // Auto-greet on encounter: when two awake idleWander learners come
  // within range and haven't greeted recently, both pop an exclamation.
  if (!e._sleeping && !e._dying && !e._dead && e.behavior?.type === 'idleWander' && e.greets !== false) {
    const greetD = (e.scale || 3) * 7;
    for (const other of world.entities) {
      if (other === e || other.type !== 'learner') continue;
      if (other._sleeping || other.behavior?.type !== 'idleWander' || other.greets === false) continue;
      if ((e.id || '') >= (other.id || '')) continue; // run once per pair
      const dx = e.x - other.x, dy = e.y - other.y;
      const greetD2 = greetD * greetD;
      if (dx * dx + dy * dy < greetD2) {
        const key = (e.id || '') + '|' + (other.id || '');
        const last = world._greets.get(key) || -999;
        if (world.t - last >= 6) {
          world._greets.set(key, world.t);
          world.fx.exclaim(e);
          world.fx.exclaim(other);
        }
      }
    }
  }
  // Wall + solid-prop collision: AABB push-out toward the side with smallest overlap.
  if (e.solid !== false && !e._dead) {
    const rE = (e.scale || 3) * ((e.hero ? 9 : 5) / 2);
    const boxes = [];
    for (const w of world.walls) boxes.push(w);
    for (const p of world.props) if (p._collision) boxes.push(p._collision);
    for (const w of boxes) {
      if (e.x + rE <= w.x || e.x - rE >= w.x + w.w) continue;
      if (e.y + rE <= w.y || e.y - rE >= w.y + w.h) continue;
      const dL = (e.x + rE) - w.x;
      const dR = (w.x + w.w) - (e.x - rE);
      const dT = (e.y + rE) - w.y;
      const dB = (w.y + w.h) - (e.y - rE);
      const m = Math.min(dL, dR, dT, dB);
      if (m === dL)      { e.x = w.x - rE; if (e.vx > 0) e.vx = -e.vx * 0.4; }
      else if (m === dR) { e.x = w.x + w.w + rE; if (e.vx < 0) e.vx = -e.vx * 0.4; }
      else if (m === dT) { e.y = w.y - rE; if (e.vy > 0) e.vy = -e.vy * 0.4; }
      else               { e.y = w.y + w.h + rE; if (e.vy < 0) e.vy = -e.vy * 0.4; }
    }
  }
  // Zone effects: while a learner is inside a zone, apply its effect.
  if (world.zones.length && !e._dead && !e._sleeping) {
    for (const z of world.zones) {
      const inside = e.x >= z.x && e.x <= z.x + z.w && e.y >= z.y && e.y <= z.y + z.h;
      if (!inside) continue;
      const fx = z.effect || {};
      if (fx.mood && e.mood !== fx.mood && e._moodT <= 0) {
        world.fx.mood(e, fx.mood, 1.4);
      }
      if (fx.reinforce) {
        const period = fx.reinforce.period ?? 4;
        if (!e._zoneReinforceT || world.t - e._zoneReinforceT >= period) {
          world.fx.reinforce(e);
          e._zoneReinforceT = world.t;
        }
      }
      if (fx.quiet) e.greets = false;
      if (fx.sleep) world.fx.sleep(e);
    }
  }
  // Walk phase advances with speed magnitude.
  const speed = Math.hypot(e.vx || 0, e.vy || 0);
  e._walkPhase += speed * dt * 0.18;
  // FX timers count down.
  if (e._surpriseT > 0) e._surpriseT = Math.max(0, e._surpriseT - dt);
  if (e._reinforceT > 0) e._reinforceT = Math.max(0, e._reinforceT - dt);
  if (e._flashT > 0) e._flashT = Math.max(0, e._flashT - dt);
  // Mood timer (auto-revert).
  if (e._moodT > 0) {
    e._moodT -= dt;
    if (e._moodT <= 0) e.mood = e._moodPrev || 'neutral';
  }
  // Appear / vanish.
  if (e._appearDur > 0) {
    e._appearT += dt;
    e._alpha = Math.min(1, e._appearT / e._appearDur);
    if (e._appearT >= e._appearDur) e._appearDur = 0;
  }
  if (e._vanishDur > 0) {
    e._vanishT += dt;
    e._alpha = Math.max(0, 1 - e._vanishT / e._vanishDur);
    if (e._vanishT >= e._vanishDur) {
      e._vanishDur = 0;
      if (e._onVanish) try { e._onVanish(e, world); } catch {}
      e._onVanish = null;
    }
  }
  // Idle breathing: advance phase while awake and slow.
  if (!e._sleeping && speed < 6) {
    e._breathT += dt * 1.4;
  }
  // Jump animation.
  if (e._jumpDur > 0 && e._jumpT < e._jumpDur) {
    e._jumpT += dt;
    if (e._jumpT >= e._jumpDur) {
      e._jumpT = 0;
      e._jumpDur = 0;
    }
  }
  // Aging accumulates.
  if (e.ageRate > 0 && !e._dying && !e._dead) {
    e._age += e.ageRate * dt;
  }
  // Death trigger by age. Routed through fx.die so particles + epitaph fire.
  if (e.maxAge && !e._dying && !e._dead && e._age >= e.maxAge) {
    world.fx.die(e);
  }
  // Dying fade-out.
  if (e._dying && !e._dead) {
    e._deathT += dt;
    e._alpha = Math.max(0, 1 - e._deathT / (e._deathDur || 2.0));
    if (e._deathT >= (e._deathDur || 2.0)) {
      e._dead = true;
      e._alpha = 0;
      if (e._onDeath) try { e._onDeath(e, world); } catch {}
    }
  }
  // Health timer (auto-revert if duration was set).
  if (e._healthT > 0) {
    e._healthT -= dt;
    if (e._healthT <= 0) e.health = e._healthPrev || 'normal';
  }
  // Imitation: every ~1.5-3 s, copy target's mood if it differs.
  if (e.imitates && typeof e.imitates === 'object') {
    if (world.t >= e._imitateNext) {
      const target = e.imitates;
      if (target.mood && target.mood !== e.mood) {
        world.fx.mood(e, target.mood, 2.5);
      }
      e._imitateNext = world.t + 1.5 + world.rng() * 1.5;
    }
  }
  // Sleep after 15 s without a touch (any fx call or click).
  // Opt out per entity with `sleepable: false` (used in scripted scenes).
  // Declarative scenes (top-level config.script) never auto-sleep: a long
  // narrated scene without clicks would put the cast to sleep mid-story.
  // Explicit `sleepable: true` opts back in.
  const idleFor = world.t - e._lastTouchT;
  const declarative = world._replay && world._replay.armed;
  if (!e._sleeping && e.sleepable !== false && (e.sleepable === true || !declarative) && idleFor >= 15) {
    e._sleeping = true;
    e._nextZ = 0;
  }
  if (e._sleeping) {
    e._nextZ -= dt;
    if (e._nextZ <= 0) {
      world._fx.push({
        type: 'floatNumber',
        x: e.x + 8, y: e.y - (e.hero ? 22 : 14),
        text: 'z', age: 0, duration: 2.4,
        color: 'rgb(110,120,150)', size: 11,
      });
      e._nextZ = 2.2 + world.rng() * 0.8;
    }
  }
}
