// noesis-engine / draw
// Pixel-art draw primitives: learner blob, eye geometry, mood-routing,
// accessories overlay. Instantiated once per World.

import { mixColors, drawMath, measureMath as _measureMath } from './util.js?v=122';
import { drawMoodOverlays } from './mood.js?v=122';
import { drawAccessories } from './accessories.js?v=122';

export class Draw {
  constructor(world) { this.world = world; }

  /*
   * learner: round blob with two eyes. Pixels are drawn as scaled blocks.
   * opts:
   *   scale         pixel block size, default 3
   *   hero          true → 9×9 outline / 7×7 body / 2×2 eyes; false → 5×5/3×3/1×1
   *   body          fill color (default warm peach #d8a878)
   *   outline       outline color (default #0e1408)
   *   eye           eye whites color (default #f0f0d0)
   *   pupil         pupil color (default #0e1408)
   *   look          {x, y} direction the eyes look toward, in world coords
   *   shadow        soft contact-shadow ellipse at ground level (default true)
   *   attentionTo   {x, y} draw a dotted golden line from blob to target
   */
  learner(cxOrEntity, cyOrOpts, maybeOpts) {
    // Two call styles:
    //   learner(entity, opts?)            uses entity.x/y and internal FX state
    //   learner(cx, cy, opts?)            raw position; opts can carry FX flags
    let entity = null, cx, cy, opts;
    if (typeof cxOrEntity === 'object' && cxOrEntity !== null && 'x' in cxOrEntity) {
      entity = cxOrEntity;
      opts = cyOrOpts || {};
      cx = entity.x;
      cy = entity.y;
    } else {
      cx = cxOrEntity;
      cy = cyOrOpts;
      opts = maybeOpts || {};
    }
    const ctx = this.world.ctx;
    const s = opts.scale || entity?.scale || 3;
    const hero = opts.hero ?? entity?.hero ?? false;
    const outline = opts.outline || '#0e1408';
    let body = opts.body || entity?.body || '#d8a878';
    if (entity) {
      // Health tints.
      if (entity.health === 'sick')        body = mixColors(body, '#30802a', 0.45);
      else if (entity.health === 'feverish') body = mixColors(body, '#c44a3e', 0.40);
      else if (entity.health === 'frozen')   body = mixColors(body, '#5b8def', 0.42);
      // Extinction fade toward gray after no reinforcement for a while.
      if (entity.extinguishable && entity._lastReinforceT != null) {
        const since = this.world.t - entity._lastReinforceT;
        const over = since - (entity.extinctionThreshold || 8);
        if (over > 0) {
          const fade = Math.min(0.55, over / 20);
          body = mixColors(body, '#5a5a5a', fade);
        }
      }
      // Aging fade toward gray after _age accumulates.
      if (entity.ageRate > 0 && entity._age > 0) {
        const refAge = entity.maxAge || 60;
        const aged = Math.min(0.55, entity._age / refAge * 0.55);
        body = mixColors(body, '#777777', aged);
      }
      // Dying: heavy gray on top.
      if (entity._dying) {
        body = mixColors(body, '#3a3a3a', 0.65);
      }
    }
    const eye = opts.eye || '#f0f0d0';
    const pupil = opts.pupil || '#0e1408';
    const outlineDim = hero ? 9 : 5;

    const accessory = opts.accessory ?? entity?.accessory ?? null;
    // Alpha (appear / vanish).
    const alpha = entity?._alpha ?? 1;
    // Tombstone: draw a small marker where a dead learner used to live.
    // Opt-out per entity with `leaveTombstone: false`.
    if (entity?._dead && entity.leaveTombstone !== false) {
      const sT = entity.scale || 3;
      const heroT = !!entity.hero;
      const dim = heroT ? 9 : 5;
      const x0T = Math.round(cx - (dim * sT) / 2);
      const y0T = Math.round(cy - (dim * sT) / 2);
      const pxT = (gx, gy, gw, gh) => ctx.fillRect(x0T + gx * sT, y0T + gy * sT, gw * sT, gh * sT);
      const prevA = ctx.globalAlpha;
      ctx.globalAlpha = prevA * 0.85;
      ctx.fillStyle = '#6E7896';
      if (heroT) {
        pxT(3, 1, 3, 1);
        pxT(2, 2, 5, 6);
        pxT(1, 8, 7, 1);
        ctx.fillStyle = '#3a3f55';
        pxT(4, 3, 1, 2);
      } else {
        pxT(1, 0, 3, 1);
        pxT(0, 1, 5, 3);
      }
      ctx.globalAlpha = prevA;
      return;
    }
    if (alpha <= 0.01) return;
    const prevAlpha = ctx.globalAlpha;
    if (alpha < 1) ctx.globalAlpha = prevAlpha * alpha;

    // Mirada declarada por la entidad (efecto narrativo): `entity.look = 'blank'`
    // suprime las pupilas y deja solo la esclerótica (un personaje cegado), y
    // manda sobre el motion/lookAt de abajo. Vale también un vector {x, y}.
    if (opts.look == null && entity && entity.look != null) {
      opts = { ...opts, look: entity.look };
    }
    // Gaze rule: eyes follow the blob's motion vector. If moving, both
    // pupils point in the direction of motion. If not moving, idle.
    // `opts.look = 'blank'` still suppresses pupils for narrative effect.
    const LOOK_MIN_MOTION = 4;    // px/sec; below this the blob is "not moving"
    if (!opts.look && entity) {
      const sp = Math.hypot(entity.vx || 0, entity.vy || 0);
      if (sp >= LOOK_MIN_MOTION) {
        opts = { ...opts, look: { x: entity.vx, y: entity.vy } };
      }
    }
    // Mirada dirigida: si el blob está quieto y tiene `lookAt` (id de otra
    // entidad o un punto {x, y}), las pupilas apuntan hacia ahí. Permite que los
    // personajes se miren entre sí o miren la acción sin moverse. El movimiento
    // manda sobre lookAt (arriba); lookAt manda sobre la mirada idle.
    if (!opts.look && entity && entity.lookAt != null) {
      let tx = null, ty = null;
      if (typeof entity.lookAt === 'string') {
        const tgt = this.world.byId(entity.lookAt);
        if (tgt) { tx = tgt.x; ty = tgt.y; }
      } else if (typeof entity.lookAt === 'object') {
        tx = entity.lookAt.x; ty = entity.lookAt.y;
      }
      if (tx != null && ty != null) opts = { ...opts, look: { x: tx - entity.x, y: ty - entity.y } };
    }

    // Walk bob: vertical wave when entity is moving.
    let bobOffset = 0;
    if (entity && opts.walkBob !== false) {
      const speed = Math.hypot(entity.vx || 0, entity.vy || 0);
      if (speed > 4) {
        const amp = Math.min(2, speed * 0.03) * s;
        bobOffset = Math.sin(entity._walkPhase || 0) * amp;
      } else if (!entity._sleeping) {
        // Idle breathing: subtle vertical drift when standing still and awake.
        bobOffset = Math.sin(entity._breathT || 0) * 0.35 * s;
      }
    }
    // Jump arc: half-sine over the duration, lifts the body up.
    let jumpOffset = 0;
    if (entity && entity._jumpDur > 0 && entity._jumpT < entity._jumpDur) {
      const phase = entity._jumpT / entity._jumpDur;
      jumpOffset = -Math.sin(phase * Math.PI) * (s * 2.5);
    }
    const cyDrawn = cy + bobOffset + jumpOffset;
    // El centro visual de este frame (con bob y salto): lo leen los efectos
    // que siguen al cuerpo dibujado, no a la coordenada lógica (los focos).
    if (entity) entity._cyDrawn = cyDrawn;

    const x0 = Math.round(cx - (outlineDim * s) / 2);
    const y0 = Math.round(cyDrawn - (outlineDim * s) / 2);
    const px = (gx, gy, gw, gh) => ctx.fillRect(x0 + gx * s, y0 + gy * s, gw * s, gh * s);

    // Stage aura (entity.stage: 0..4 → halos concéntricos pulsantes).
    // Stage 0 / null = no aura. Stages 1-4 grow in radius, alpha, and pulse.
    const stage = opts.stage ?? entity?.stage ?? 0;
    if (stage > 0) {
      const baseR = outlineDim * s * 0.55;
      const radius = baseR + stage * outlineDim * s * 0.22;
      const breath = stage >= 3 ? (Math.sin(this.world.t * (1.2 + stage * 0.4)) + 1) * 0.5 : 0.5;
      const intensity = stage / 4;
      ctx.fillStyle = `rgba(244,172,29,${(intensity * 0.10).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(cx, cyDrawn, radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(244,172,29,${(intensity * 0.16).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(cx, cyDrawn, radius * 0.7, 0, Math.PI * 2); ctx.fill();
      if (stage >= 3) {
        const pulseR = radius * (1.08 + breath * 0.22);
        ctx.fillStyle = `rgba(244,172,29,${(intensity * breath * 0.14).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(cx, cyDrawn, pulseR, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Reinforce halo (golden pulsing ring around the blob).
    const reinforceT = opts.halo ?? entity?._reinforceT ?? 0;
    if (reinforceT > 0) {
      const phase = 1 - reinforceT / 1.5;
      const radius = outlineDim * s * (0.7 + phase * 0.4);
      const alpha = (1 - phase) * 0.55;
      ctx.fillStyle = `rgba(244,172,29,${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cx, cyDrawn, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Flash burst (bright cream circle when learning).
    const flashT = opts.flash ?? entity?._flashT ?? 0;
    if (flashT > 0) {
      const phase = 1 - flashT / 0.5;
      const radius = outlineDim * s * (0.5 + phase * 0.8);
      const alpha = (1 - phase) * 0.7;
      ctx.fillStyle = `rgba(248,237,229,${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cx, cyDrawn, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    if (opts.shadow !== false) {
      // Sombra de contacto: elipse suave anclada al PISO (cy sin bob ni
      // salto). Cuando el cuerpo se eleva, la sombra se queda abajo y se
      // encoge y aclara con la altura: eso es lo que vende el salto.
      const groundY = cy + (outlineDim * s) / 2 + s * 0.4;
      const lift = Math.max(0, cy - cyDrawn);
      const k = Math.max(0.45, 1 - lift / (s * 6));
      ctx.save();
      ctx.fillStyle = `rgba(10,12,22,${(0.28 * k).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(cx, groundY, outlineDim * s * 0.38 * k, Math.max(1.5, s * 0.85 * k), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = outline;
    if (hero) {
      px(2, 0, 5, 1);
      px(1, 1, 7, 1);
      px(0, 2, 9, 5);
      px(1, 7, 7, 1);
      px(2, 8, 5, 1);
    } else {
      px(1, 0, 3, 1);
      px(0, 1, 5, 3);
      px(1, 4, 3, 1);
    }

    ctx.fillStyle = body;
    if (hero) {
      px(2, 1, 5, 1);
      px(1, 2, 7, 5);
      px(2, 7, 5, 1);
    } else {
      px(1, 1, 3, 3);
    }

    const eyeGY = hero ? 3 : 2;
    const eyeGX1 = hero ? 2 : 1;
    const eyeGX2 = hero ? 6 : 3;
    let eyeSz = hero ? 2 : 1;
    const blinking = opts.blink ?? (entity ? (!entity._blinkOpen || entity._sleeping || entity._dying) : false);
    const surpriseT = opts.surprise ? 0.5 : (entity?._surpriseT ?? 0);
    const surprised = surpriseT > 0;
    const mood = opts.mood ?? entity?.mood ?? 'neutral';

    // Mood-driven eye rendering. Only changes the SHAPE of the eyes
    // (closed curves / drooping eyelids). Pupil direction is always
    // driven by motion below. `confused` does NOT override the eye
    // shape — use `world.fx.wonder(entity)` for the "?" indicator.
    const moodOverridesEyes = (mood === 'happy' || mood === 'sad' || mood === 'tired');
    if (!blinking && moodOverridesEyes) {
      ctx.fillStyle = pupil;
      if (mood === 'happy') {
        // Eyes closed in upward arc ^^.
        // Hero: ^ shape per eye using 3 px (corners low, middle high).
        if (hero) {
          // Left eye ^ : two pixels low at gy+1, one pixel high at gy.
          px(eyeGX1, eyeGY + 1, 1, 1);
          px(eyeGX1 + 1, eyeGY, 1, 1);
          px(eyeGX2, eyeGY, 1, 1);
          px(eyeGX2 + 1, eyeGY + 1, 1, 1);
        } else {
          // 1x1 eyes: single pixel each, slight upward tick (just use pupil dot).
          px(eyeGX1, eyeGY, 1, 1);
          px(eyeGX2, eyeGY, 1, 1);
        }
      } else if (mood === 'sad') {
        // Eyes drooping in downward arc.
        if (hero) {
          px(eyeGX1, eyeGY, 1, 1);
          px(eyeGX1 + 1, eyeGY + 1, 1, 1);
          px(eyeGX2, eyeGY + 1, 1, 1);
          px(eyeGX2 + 1, eyeGY, 1, 1);
        } else {
          px(eyeGX1, eyeGY, 1, 1);
          px(eyeGX2, eyeGY, 1, 1);
        }
      } else if (mood === 'confused') {
        // "Uhh?" pose: both pupils glancing up in parallel (same column).
        ctx.fillStyle = eye;
        px(eyeGX1, eyeGY, eyeSz, eyeSz);
        px(eyeGX2, eyeGY, eyeSz, eyeSz);
        ctx.fillStyle = pupil;
        if (hero) {
          px(eyeGX1, eyeGY, 1, 1);
          px(eyeGX2, eyeGY, 1, 1);
        } else {
          px(eyeGX1, eyeGY, 1, 1);
          px(eyeGX2, eyeGY, 1, 1);
        }
      } else if (mood === 'tired') {
        // Heavy eyelids: horizontal line at top of eye + pupil at bottom.
        if (hero) {
          ctx.fillRect(x0 + eyeGX1 * s, y0 + eyeGY * s, eyeSz * s, Math.max(1, Math.floor(s * 0.5)));
          ctx.fillRect(x0 + eyeGX2 * s, y0 + eyeGY * s, eyeSz * s, Math.max(1, Math.floor(s * 0.5)));
          px(eyeGX1, eyeGY + 1, 1, 1);
          px(eyeGX2 + 1, eyeGY + 1, 1, 1);
        } else {
          ctx.fillRect(x0 + eyeGX1 * s, y0 + eyeGY * s, s, Math.max(1, Math.floor(s / 3)));
          ctx.fillRect(x0 + eyeGX2 * s, y0 + eyeGY * s, s, Math.max(1, Math.floor(s / 3)));
        }
      }
      // Skip normal eye+pupil branches by jumping to attentionTo/accessory.
      if (opts.attentionTo) {
        // (handled below in the next block; but we need to fall through there)
      }
      drawMoodOverlays(ctx, px, hero, eyeGY, eyeGX1, eyeGX2, mood, this.world.t, outlineDim);
      drawAccessories(this, ctx, px, hero, eyeGY, accessory, { ...opts, accessoryColor: opts.accessoryColor || entity?.accessoryColor, body });
      if (alpha < 1) ctx.globalAlpha = prevAlpha;
      return;
    }

    if (blinking) {
      // Closed eyes: draw a thin horizontal line at the eye's vertical center.
      ctx.fillStyle = pupil;
      if (hero) {
        ctx.fillRect(x0 + eyeGX1 * s, y0 + (eyeGY + 1) * s, eyeSz * s, Math.max(1, Math.floor(s * 0.5)));
        ctx.fillRect(x0 + eyeGX2 * s, y0 + (eyeGY + 1) * s, eyeSz * s, Math.max(1, Math.floor(s * 0.5)));
      } else {
        ctx.fillRect(x0 + eyeGX1 * s, y0 + eyeGY * s + Math.floor(s / 3), s, Math.max(1, Math.floor(s / 3)));
        ctx.fillRect(x0 + eyeGX2 * s, y0 + eyeGY * s + Math.floor(s / 3), s, Math.max(1, Math.floor(s / 3)));
      }
      // Skip pupil rendering this frame.
      // Attention line still draws below.
    } else {
      // Surprised: enlarge eye whites by 1 grid pixel upward.
      if (surprised && hero) {
        ctx.fillStyle = eye;
        // Extend each 2x2 eye by 1px upward → 2x3.
        px(eyeGX1, eyeGY - 1, eyeSz, eyeSz + 1);
        px(eyeGX2, eyeGY - 1, eyeSz, eyeSz + 1);
      } else {
        ctx.fillStyle = eye;
        px(eyeGX1, eyeGY, eyeSz, eyeSz);
        px(eyeGX2, eyeGY, eyeSz, eyeSz);
      }
    }

    // Pupils. opts.look:
    //   {x, y}        attentional shift toward that vector
    //   null / undef  forward gaze default
    //   'blank'       no pupils (narrative effect: gaze not yet bound)
    // Vectors below LOOK_MIN render as forward gaze so the pupil never
    // ends up flush against the outline at a corner of the eye.
    const LOOK_MIN = 8;
    const drawForward = () => {
      // Idle / neutral gaze. Always both pupils at the SAME relative
      // position inside each eye (parallel gaze). Bottom-left default.
      ctx.fillStyle = pupil;
      if (hero) {
        px(eyeGX1, eyeGY + 1, 1, 1);
        px(eyeGX2, eyeGY + 1, 1, 1);
      } else {
        px(eyeGX1, eyeGY, 1, 1);
        px(eyeGX2, eyeGY, 1, 1);
      }
    };
    if (blinking) {
      // Skip pupil rendering this frame.
    } else if (opts.look === 'blank') {
      // no pupils
    } else if (opts.look && Math.hypot(opts.look.x, opts.look.y) >= LOOK_MIN) {
      const d = Math.hypot(opts.look.x, opts.look.y);
      const dx = opts.look.x / d, dy = opts.look.y / d;
      ctx.fillStyle = pupil;
      if (hero) {
        // Parallel gaze: BOTH pupils at the same relative position in
        // each eye. This is what "two eyes pointing the same way" needs
        // in a 2×2 grid. Different offsets per eye produce cross-eye.
        const ox = dx > 0.15 ? 1 : 0;
        const oy = dy > 0.25 ? 1 : (dy < -0.25 ? 0 : 1);
        px(eyeGX1 + ox, eyeGY + oy, 1, 1);
        px(eyeGX2 + ox, eyeGY + oy, 1, 1);
      } else {
        const ox = dx > 0.3 ? 1 : (dx < -0.3 ? -1 : 0);
        const oy = dy > 0.3 ? 1 : (dy < -0.3 ? -1 : 0);
        if (ox !== 0 || oy !== 0) {
          px(eyeGX1 + ox, eyeGY + oy, 1, 1);
          px(eyeGX2 + ox, eyeGY + oy, 1, 1);
        } else {
          px(eyeGX1, eyeGY, 1, 1);
          px(eyeGX2, eyeGY, 1, 1);
        }
      }
    } else {
      drawForward();
    }

    if (opts.attentionTo) {
      const tx = opts.attentionTo.x, ty = opts.attentionTo.y;
      const ddx = tx - cx, ddy = ty - cy;
      const dist = Math.hypot(ddx, ddy);
      if (dist > 4 * s) {
        const step = 3 * s;
        const steps = Math.max(2, Math.floor(dist / step));
        const pulse = 0.55 + 0.25 * Math.sin(this.world.t * 4);
        ctx.fillStyle = `rgba(255,220,130,${pulse.toFixed(2)})`;
        for (let i = 1; i < steps; i++) {
          if (i % 2 === 0) continue;
          const t = i / steps;
          ctx.fillRect(Math.round(cx + ddx * t), Math.round(cy + ddy * t), s, s);
        }
      }
    }

    drawMoodOverlays(ctx, px, hero, eyeGY, eyeGX1, eyeGX2, mood, this.world.t, outlineDim);

    // Accessory (drawn after body and eyes so it sits on top).
    // Accepts string or array to stack. Supported (legible at hero scale):
    // hat, scarf, glasses, headband, bow, pikachu.
    drawAccessories(this, ctx, px, hero, eyeGY, accessory, { ...opts, accessoryColor: opts.accessoryColor || entity?.accessoryColor, body });

    if (alpha < 1) ctx.globalAlpha = prevAlpha;
  }

  /* ---------------------------------------------------------------------
   * Diagram toolkit. Draw-time helpers for didactic diagrams (flows, graphs,
   * neural nets, timelines, force vectors). Call from onDraw via world.draw.*.
   * Defaults use the canonical palette; every option is overridable.
   * ------------------------------------------------------------------- */

  // Shared rounded-rect path on world.ctx (scenes used to redefine this in
  // every hook). Leaves the path open so the caller fills/strokes it.
  rrect(x, y, w, h, r = 6) {
    const ctx = this.world.ctx;
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    return ctx;
  }

  // Resolve a point spec to {x, y, r}. Accepts {x,y[,r]}, an entity (uses
  // .x/.y and derives a radius from .scale/.hero), or null.
  _pt(p) {
    if (p == null || typeof p.x !== 'number' || typeof p.y !== 'number') return null;
    let r = p.r;
    if (r == null) r = p.scale ? p.scale * (p.hero ? 4.5 : 2.5) : 0;
    return { x: p.x, y: p.y, r };
  }

  // Small filled triangular arrowhead at (x,y) pointing along `angle`.
  _arrowhead(x, y, angle, size, color) {
    const ctx = this.world.ctx;
    const spread = 0.45;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - size * Math.cos(angle - spread), y - size * Math.sin(angle - spread));
    ctx.lineTo(x - size * Math.cos(angle + spread), y - size * Math.sin(angle + spread));
    ctx.closePath();
    ctx.fill();
  }

  // arrow: a line from (x1,y1) to (x2,y2) with an arrowhead at the end.
  // opts: color, width, alpha, dash (true | [on,off]), head (px; 0 = none),
  //       both (double-headed), curve (perpendicular bend in px; +right/-left).
  arrow(x1, y1, x2, y2, opts = {}) {
    const ctx = this.world.ctx;
    const color = opts.color || '#6E7896';
    const width = opts.width ?? 2;
    const head = opts.head ?? 8;
    const curve = opts.curve || 0;
    ctx.save();
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (opts.dash) ctx.setLineDash(Array.isArray(opts.dash) ? opts.dash : [5, 4]);
    let endAngle, startAngle;
    if (curve) {
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
      const cxp = mx - (dy / len) * curve, cyp = my + (dx / len) * curve;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cxp, cyp, x2, y2); ctx.stroke();
      endAngle = Math.atan2(y2 - cyp, x2 - cxp);
      startAngle = Math.atan2(y1 - cyp, x1 - cxp);
    } else {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      endAngle = Math.atan2(y2 - y1, x2 - x1);
      startAngle = Math.atan2(y1 - y2, x1 - x2);
    }
    ctx.setLineDash([]);
    if (head > 0) {
      this._arrowhead(x2, y2, endAngle, head, color);
      if (opts.both) this._arrowhead(x1, y1, startAngle, head, color);
    }
    ctx.restore();
  }

  // connector: an arrow between two points/entities, with endpoints trimmed to
  // each node's radius so the arrow meets the edge (not the center), plus an
  // optional label (chip-backed for legibility) on the path.
  // from/to: {x,y[,r]} or entity. opts: arrow opts + { label, labelColor,
  // labelBg (false to disable chip), font, gap (extra edge trim, default 4) }.
  connector(from, to, opts = {}) {
    const a = this._pt(from), b = this._pt(to);
    if (!a || !b) return;
    const gap = opts.gap ?? 4;
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const x1 = a.x + ux * (a.r + gap), y1 = a.y + uy * (a.r + gap);
    const x2 = b.x - ux * (b.r + gap), y2 = b.y - uy * (b.r + gap);
    this.arrow(x1, y1, x2, y2, opts);
    if (opts.label != null && opts.label !== '') {
      const ctx = this.world.ctx;
      const curve = opts.curve || 0;
      let mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      if (curve) { mx -= uy * curve * 0.5; my += ux * curve * 0.5; }
      ctx.save();
      ctx.font = opts.font || '600 12px "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (opts.labelBg !== false) {
        const tw = ctx.measureText(String(opts.label)).width;
        const padX = 5, h = 16;
        this.rrect(mx - tw / 2 - padX, my - h / 2, tw + padX * 2, h, 5);
        ctx.fillStyle = opts.labelBg || 'rgba(20,22,40,0.82)'; ctx.fill();
      }
      ctx.fillStyle = opts.labelColor || '#eef1f6';
      ctx.fillText(String(opts.label), mx, my + 0.5);
      ctx.restore();
    }
  }

  // node: a rounded-rect diagram box with fill/stroke and optional centered
  // label. Returns its geometry + edge anchors so connectors can target it:
  // { x, y (center), w, h, r, top, bottom, left, right }.
  // opts: fill, stroke (false to skip, or color), strokeWidth, radius, alpha,
  //       label, labelColor, font.
  node(x, y, w, h, opts = {}) {
    const ctx = this.world.ctx;
    const r = opts.radius ?? 8;
    ctx.save();
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    this.rrect(x, y, w, h, r);
    ctx.fillStyle = opts.fill || '#F6F2E8'; ctx.fill();
    if (opts.stroke !== false) {
      this.rrect(x + 0.5, y + 0.5, w - 1, h - 1, r);
      ctx.strokeStyle = typeof opts.stroke === 'string' ? opts.stroke : '#E8E2D2';
      ctx.lineWidth = opts.strokeWidth ?? 1.5; ctx.stroke();
    }
    if (opts.label != null && opts.label !== '') {
      ctx.font = opts.font || '600 13px "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = opts.labelColor || '#1F2547';
      ctx.fillText(String(opts.label), x + w / 2, y + h / 2 + 0.5);
    }
    ctx.restore();
    const cx = x + w / 2, cy = y + h / 2;
    return {
      x: cx, y: cy, w, h, r: Math.min(w, h) / 2,
      top: { x: cx, y }, bottom: { x: cx, y: y + h },
      left: { x, y: cy }, right: { x: x + w, y: cy },
    };
  }

  /* ---------------------------------------------------------------------
   * Chart primitives. Draw-time helpers for plots (math, physics, data).
   * Call from onDraw via world.draw.*. axes() returns a frame whose map()
   * converts data coords to pixels; pass that frame to plot()/bars().
   * ------------------------------------------------------------------- */

  // axes: a 2D plot frame. (x,y) is the TOP-LEFT of the plot area; w,h its
  // size. Returns { x, y, w, h, xDomain, yDomain, map(dataX,dataY) }.
  // opts: xDomain/yDomain ([min,max], default [0,1]); color; labelColor; font;
  //   axis (false to skip); frame (true → full box instead of L-shaped axes);
  //   xTicks/yTicks (count | array of data values); tickLen; xFormat/yFormat
  //   (value→string); xLabel/yLabel.
  axes(x, y, w, h, opts = {}) {
    const ctx = this.world.ctx;
    const xD = opts.xDomain || [0, 1];
    const yD = opts.yDomain || [0, 1];
    const color = opts.color || '#6E7896';
    const labelColor = opts.labelColor || '#c5cbdb';
    const font = opts.font || '500 11px "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, sans-serif';
    const map = (dx, dy) => ({
      x: x + ((dx - xD[0]) / ((xD[1] - xD[0]) || 1)) * w,
      y: y + h - ((dy - yD[0]) / ((yD[1] - yD[0]) || 1)) * h,
    });
    const ax = (xD[0] <= 0 && xD[1] >= 0) ? map(0, 0).x : x;        // y-axis x-position
    const ay = (yD[0] <= 0 && yD[1] >= 0) ? map(0, 0).y : y + h;    // x-axis y-position
    const tickLen = opts.tickLen ?? 4;
    const ticksOf = (spec, D) => Array.isArray(spec) ? spec
      : (typeof spec === 'number' ? Array.from({ length: spec + 1 }, (_, i) => D[0] + (D[1] - D[0]) * i / spec) : []);
    const frame = { x, y, w, h, xDomain: xD, yDomain: yD, map };
    const xticks = ticksOf(opts.xTicks, xD);
    const yticks = ticksOf(opts.yTicks, yD);
    // Background gridlines first (behind axes + data).
    if (opts.grid) this.gridlines(frame, { x: xticks, y: yticks, color: typeof opts.grid === 'string' ? opts.grid : undefined });
    if (opts.axis !== false) {
      if (opts.frame) {
        ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h); ctx.restore();
      } else {
        this.arrow(x, ay, x + w + 6, ay, { color, width: 1.5, head: 6 });   // x-axis →
        this.arrow(ax, y + h, ax, y - 6, { color, width: 1.5, head: 6 });   // y-axis ↑
      }
    }
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = labelColor; ctx.lineWidth = 1; ctx.font = font;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const tv of xticks) {
      const p = map(tv, 0), py = opts.frame ? y + h : ay;
      ctx.beginPath(); ctx.moveTo(p.x, py - tickLen); ctx.lineTo(p.x, py + tickLen); ctx.stroke();
      const t = opts.xFormat ? opts.xFormat(tv) : String(Math.round(tv * 100) / 100);
      if (t !== '') ctx.fillText(t, p.x, py + tickLen + 2);
    }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (const tv of yticks) {
      const p = map(0, tv), px2 = opts.frame ? x : ax;
      ctx.beginPath(); ctx.moveTo(px2 - tickLen, p.y); ctx.lineTo(px2 + tickLen, p.y); ctx.stroke();
      const t = opts.yFormat ? opts.yFormat(tv) : String(Math.round(tv * 100) / 100);
      if (t !== '') ctx.fillText(t, px2 - tickLen - 3, p.y);
    }
    ctx.fillStyle = labelColor;
    if (opts.xLabel) { ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText(opts.xLabel, x + w, ay + tickLen + 14); }
    if (opts.yLabel) { ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(opts.yLabel, ax + 6, y - 4); }
    ctx.restore();
    return frame;
  }

  // gridlines: faint background grid on a frame. opts.x / opts.y are arrays of
  // data values where lines are drawn (vertical for x, horizontal for y);
  // opts.color overrides the default faint slate.
  gridlines(frame, opts = {}) {
    const ctx = this.world.ctx;
    const color = opts.color || 'rgba(110,120,150,0.16)';
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    for (const vx of (opts.x || [])) {
      const p = frame.map(vx, 0);
      ctx.beginPath(); ctx.moveTo(p.x, frame.y); ctx.lineTo(p.x, frame.y + frame.h); ctx.stroke();
    }
    for (const vy of (opts.y || [])) {
      const p = frame.map(0, vy);
      ctx.beginPath(); ctx.moveTo(frame.x, p.y); ctx.lineTo(frame.x + frame.w, p.y); ctx.stroke();
    }
    ctx.restore();
  }

  // plot: draw data on a frame. `data` is an array of [x,y] points (data
  // coords) or a function fx→fy sampled across the frame's xDomain.
  // opts: color, width, dash, samples (for fn, default 64), reveal (0..1
  //   fraction of the path drawn, for animation), fill (true | rgba: area to
  //   the baseline), baseline (data-y), dots (marker radius; 0 = none), dotColor.
  plot(frame, data, opts = {}) {
    const ctx = this.world.ctx;
    const color = opts.color || '#5b8def';
    let pts;
    if (typeof data === 'function') {
      const n = opts.samples ?? 64, x0 = frame.xDomain[0], x1 = frame.xDomain[1];
      pts = Array.from({ length: n + 1 }, (_, i) => { const dx = x0 + (x1 - x0) * i / n; return [dx, data(dx)]; });
    } else pts = data;
    if (!pts || !pts.length) return;
    const cut = Math.max(0, Math.min(1, opts.reveal ?? 1));
    const last = Math.max(1, Math.round(pts.length * cut));
    const P = pts.slice(0, last).map(([dx, dy]) => frame.map(dx, dy));
    ctx.save();
    if (opts.fill && P.length > 1) {
      const base = opts.baseline ?? (frame.yDomain[0] <= 0 && frame.yDomain[1] >= 0 ? 0 : frame.yDomain[0]);
      const by = frame.map(0, base).y;
      ctx.beginPath(); ctx.moveTo(P[0].x, by);
      for (const p of P) ctx.lineTo(p.x, p.y);
      ctx.lineTo(P[P.length - 1].x, by); ctx.closePath();
      ctx.fillStyle = opts.fill === true ? 'rgba(91,141,239,0.18)' : opts.fill; ctx.fill();
    }
    ctx.strokeStyle = color; ctx.lineWidth = opts.width ?? 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (opts.dash) ctx.setLineDash(Array.isArray(opts.dash) ? opts.dash : [5, 4]);
    ctx.beginPath(); P.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
    ctx.setLineDash([]);
    if (opts.dots) { ctx.fillStyle = opts.dotColor || color; for (const p of P) { ctx.beginPath(); ctx.arc(p.x, p.y, opts.dots, 0, Math.PI * 2); ctx.fill(); } }
    ctx.restore();
  }

  // bars: a bar chart on a frame. `values` is an array of numbers or
  // {value,label,color}. Bars are evenly spaced across the frame width and
  // rise from the baseline. opts: color, gap (0..1 spacing fraction, default
  //   0.3), reveal (0..1 height fraction, for animation), baseline (data-y),
  //   labels (bool), labelColor, font.
  bars(frame, values, opts = {}) {
    const ctx = this.world.ctx;
    if (!values || !values.length) return;
    const gap = opts.gap ?? 0.3, n = values.length, slot = frame.w / n, bw = slot * (1 - gap);
    const base = opts.baseline ?? (frame.yDomain[0] <= 0 && frame.yDomain[1] >= 0 ? 0 : frame.yDomain[0]);
    const by = frame.map(0, base).y;
    const reveal = Math.max(0, Math.min(1, opts.reveal ?? 1));
    ctx.save();
    ctx.font = opts.font || '500 11px "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, sans-serif';
    values.forEach((v, i) => {
      const val = typeof v === 'object' ? v.value : v;
      const col = (typeof v === 'object' && v.color) || opts.color || '#F4AC1D';
      const cx = frame.x + slot * (i + 0.5);
      const top = frame.map(0, base + (val - base) * reveal).y;
      this.rrect(cx - bw / 2, Math.min(by, top), bw, Math.abs(top - by), Math.min(4, bw / 4));
      ctx.fillStyle = col; ctx.fill();
      if (opts.labels && typeof v === 'object' && v.label != null) {
        ctx.fillStyle = opts.labelColor || '#c5cbdb'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(String(v.label), cx, by + 4);
      }
    });
    ctx.restore();
  }

  // scatter: a cloud of point markers on a frame (no connecting line).
  // `points` is an array of [x,y] or {x,y[,r][,color]} (data coords).
  // opts: color, r (default 3), shape ('circle' | 'square'), alpha.
  scatter(frame, points, opts = {}) {
    const ctx = this.world.ctx;
    if (!points || !points.length) return;
    const baseR = opts.r ?? 3, baseColor = opts.color || '#5b8def', shape = opts.shape || 'circle';
    ctx.save();
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    for (const pt of points) {
      const dx = Array.isArray(pt) ? pt[0] : pt.x;
      const dy = Array.isArray(pt) ? pt[1] : pt.y;
      const r = (!Array.isArray(pt) && pt.r) || baseR;
      const p = frame.map(dx, dy);
      ctx.fillStyle = (!Array.isArray(pt) && pt.color) || baseColor;
      if (shape === 'square') ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      else { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }

  // area: fill the band between two series on a frame. `upper` and `lower` are
  // each an array of [x,y] points, a function fx→fy, or a constant data-y.
  // `lower` defaults to the frame baseline (0 if in range, else yDomain min).
  // opts: fill (rgba), stroke (color of the upper edge; false to skip), width,
  //   samples (for functions, default 64).
  area(frame, upper, lower, opts = {}) {
    const ctx = this.world.ctx;
    const n = opts.samples ?? 64, [x0, x1] = frame.xDomain;
    const baseY = (frame.yDomain[0] <= 0 && frame.yDomain[1] >= 0) ? 0 : frame.yDomain[0];
    const sample = (s, i, dx) => typeof s === 'function' ? s(dx)
      : (Array.isArray(s) ? (Array.isArray(s[i]) ? s[i][1] : s[i]) : (s == null ? baseY : s));
    const len = Array.isArray(upper) ? upper.length : n + 1;
    const xAt = (i) => Array.isArray(upper) && Array.isArray(upper[i]) ? upper[i][0] : x0 + (x1 - x0) * i / (len - 1);
    const top = [], bot = [];
    for (let i = 0; i < len; i++) {
      const dx = xAt(i);
      top.push(frame.map(dx, sample(upper, i, dx)));
      bot.push(frame.map(dx, sample(lower, i, dx)));
    }
    ctx.save();
    ctx.beginPath();
    top.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i].x, bot[i].y);
    ctx.closePath();
    ctx.fillStyle = opts.fill || 'rgba(91,141,239,0.20)'; ctx.fill();
    if (opts.stroke !== false) {
      ctx.strokeStyle = typeof opts.stroke === 'string' ? opts.stroke : '#5b8def';
      ctx.lineWidth = opts.width ?? 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); top.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
    }
    ctx.restore();
  }

  // stackedBars: stacked (or grouped) bar chart on a frame. `groups` is an
  // array of { label, values:[v0,v1,...] }; each value is a stacked segment.
  // Segment i is colored by opts.colors[i]. opts: colors (array), gap (0..1,
  //   default 0.34), reveal (0..1, animates height), labels (bool), labelColor,
  //   font, grouped (true → side-by-side bars instead of stacked).
  stackedBars(frame, groups, opts = {}) {
    const ctx = this.world.ctx;
    if (!groups || !groups.length) return;
    const palette = opts.colors || ['#F4AC1D', '#5b8def', '#4f8a5e', '#a64a3e', '#6E7896'];
    const gap = opts.gap ?? 0.34, n = groups.length, slot = frame.w / n, bw = slot * (1 - gap);
    const by = frame.map(0, 0).y;
    const reveal = Math.max(0, Math.min(1, opts.reveal ?? 1));
    const segN = Math.max(...groups.map(g => g.values.length));
    ctx.save();
    ctx.font = opts.font || '500 11px "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, sans-serif';
    groups.forEach((g, gi) => {
      const cx = frame.x + slot * (gi + 0.5);
      if (opts.grouped) {
        const sub = bw / g.values.length;
        g.values.forEach((v, si) => {
          const x0 = cx - bw / 2 + sub * si;
          const top = frame.map(0, v * reveal).y;
          this.rrect(x0 + 1, Math.min(by, top), sub - 2, Math.abs(top - by), Math.min(3, sub / 4));
          ctx.fillStyle = palette[si % palette.length]; ctx.fill();
        });
      } else {
        let acc = 0;
        g.values.forEach((v, si) => {
          const y0 = frame.map(0, (acc + v) * reveal).y;
          const y1 = frame.map(0, acc * reveal).y;
          this.rrect(cx - bw / 2, Math.min(y0, y1), bw, Math.abs(y1 - y0), 0);
          ctx.fillStyle = palette[si % palette.length]; ctx.fill();
          acc += v;
        });
      }
      if (opts.labels && g.label != null) {
        ctx.fillStyle = opts.labelColor || '#c5cbdb'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(String(g.label), cx, by + 4);
      }
    });
    ctx.restore();
  }

  // pie: a pie or donut chart centered at (cx,cy) with radius r. `values` is an
  // array of numbers or {value,label,color}. opts: innerR (donut hole radius;
  //   0 = full pie), colors (palette), startAngle (rad, default -PI/2 = top),
  //   labels (bool → percentage labels on slices), stroke (gap color between
  //   slices), strokeWidth, labelColor, font.
  pie(cx, cy, r, values, opts = {}) {
    const ctx = this.world.ctx;
    if (!values || !values.length) return;
    const palette = opts.colors || ['#F4AC1D', '#5b8def', '#4f8a5e', '#a64a3e', '#6E7896', '#d8a878'];
    const nums = values.map(v => typeof v === 'object' ? v.value : v);
    const total = nums.reduce((a, b) => a + b, 0) || 1;
    const innerR = opts.innerR ?? 0;
    let a0 = opts.startAngle ?? -Math.PI / 2;
    ctx.save();
    ctx.font = opts.font || '600 11px "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, sans-serif';
    values.forEach((v, i) => {
      const val = typeof v === 'object' ? v.value : v;
      const a1 = a0 + (val / total) * Math.PI * 2;
      const col = (typeof v === 'object' && v.color) || palette[i % palette.length];
      ctx.beginPath();
      if (innerR > 0) {
        ctx.arc(cx, cy, r, a0, a1); ctx.arc(cx, cy, innerR, a1, a0, true); ctx.closePath();
      } else {
        ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a0, a1); ctx.closePath();
      }
      ctx.fillStyle = col; ctx.fill();
      if (opts.stroke !== false) { ctx.strokeStyle = typeof opts.stroke === 'string' ? opts.stroke : '#11162c'; ctx.lineWidth = opts.strokeWidth ?? 2; ctx.stroke(); }
      if (opts.labels) {
        const mid = (a0 + a1) / 2, lr = innerR > 0 ? (innerR + r) / 2 : r * 0.62;
        const pct = Math.round((val / total) * 100);
        if (pct >= 5) {
          ctx.fillStyle = opts.labelColor || '#11162c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(pct + '%', cx + Math.cos(mid) * lr, cy + Math.sin(mid) * lr);
        }
      }
      a0 = a1;
    });
    ctx.restore();
  }

  // math: render a stacked LaTeX-subset formula on the canvas (real vertical
  // fractions, roots, sub/superscripts, symbols), unlike drawRichText/captions
  // which flatten $\frac{a}{b}$ to inline "a/b". (x,y) anchors per opts.align
  // (left|center|right) and opts.valign (baseline|middle|top|bottom, default
  // baseline). opts: px (16), color (default current fillStyle), weight, family,
  // alpha, align, valign. Returns { w, ascent, descent, height, x, baseline } so
  // callers can position adjacent parts (e.g. a highlighted result in another
  // color). Accepts the tex with or without surrounding `$`. See util.js.
  math(x, y, tex, opts = {}) {
    return drawMath(this.world.ctx, tex, x, y, opts);
  }

  // measureMath: layout-measure a formula without drawing. Returns
  // { w, ascent, descent, height }. Use to size a panel or center a derivation.
  measureMath(tex, opts = {}) {
    return _measureMath(this.world.ctx, tex, opts);
  }
}
