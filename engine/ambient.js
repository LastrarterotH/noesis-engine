// noesis-engine / ambient
// Ambient atmosphere: weather/point-source particles (rain, snow, petals,
// leaves, fireflies, stars) plus the time-of-day tint overlay. Operates on a
// `world` instance (needs world.rng, world.W, world.H, world.t, world._ambient,
// world._ambientParticles, world._ambientSpawnAccum); World owns the state and
// exposes _makeAmbientParticle / _tickAmbient / _drawAmbient as thin wrappers.

import { mixColors } from './util.js?v=74';

export function makeAmbientParticle(world, kind, anywhere = false) {
  const r = world.rng();
  const r2 = world.rng();
  if (kind === 'rain') {
    return { kind, x: r * (world.W + 50) - 25, y: anywhere ? r2 * world.H : -10, vx: -30, vy: 280 + r2 * 80, age: 0, life: 5, sway: 0 };
  }
  if (kind === 'snow') {
    return { kind, x: r * world.W, y: anywhere ? r2 * world.H : -8, vx: 0, vy: 28 + r2 * 14, age: r2 * 6, life: 30, sway: r * Math.PI * 2 };
  }
  if (kind === 'petals') {
    const colors = ['rgba(255,73,133,0.85)', 'rgba(252,57,138,0.75)', 'rgba(251,233,184,0.85)', 'rgba(244,172,29,0.75)'];
    return { kind, x: r * world.W, y: anywhere ? r2 * world.H : -8, vx: 10, vy: 32 + r2 * 14, age: r2 * 6, life: 30, sway: r * Math.PI * 2, color: colors[(r * colors.length) | 0] };
  }
  if (kind === 'leaves') {
    const colors = ['rgba(244,172,29,0.8)', 'rgba(196,74,62,0.8)', 'rgba(91,154,102,0.8)', 'rgba(177,137,80,0.8)'];
    return { kind, x: r * world.W, y: anywhere ? r2 * world.H : -8, vx: 12, vy: 26 + r2 * 10, age: r2 * 6, life: 30, sway: r * Math.PI * 2, color: colors[(r * colors.length) | 0] };
  }
  if (kind === 'fireflies') {
    return { kind, x: r * world.W, y: r2 * world.H, vx: 0, vy: 0, age: r2 * 4, life: 999, sway: r * Math.PI * 2, pulse: r2 * Math.PI * 2 };
  }
  if (kind === 'stars') {
    return { kind, x: r * world.W, y: r2 * world.H * 0.65, vx: 0, vy: 0, age: r2 * 5, life: 999, pulse: r2 * Math.PI * 2, bright: 0.4 + r * 0.6 };
  }
  return null;
}

export function tickAmbient(world, dt) {
  if (!world._ambient) return;
  const kind = world._ambient.particles;
  const intensity = world._ambient.intensity ?? 1;
  const spawnRates = { rain: 100, snow: 22, petals: 9, leaves: 6 };
  // El spawn se apaga cuando no hay clima activo (kind null tras `weather:
  // none`), pero el avance y la limpieza de las partículas que ya existen
  // SIEMPRE corren: si no, al detener el clima las gotas se congelan en el
  // aire en vez de seguir cayendo y desaparecer.
  if (kind && spawnRates[kind]) {
    world._ambientSpawnAccum += spawnRates[kind] * intensity * dt;
    while (world._ambientSpawnAccum >= 1) {
      world._ambientSpawnAccum -= 1;
      world._ambientParticles.push(makeAmbientParticle(world, kind));
    }
  }
  if (!world._ambientParticles.length) return;
  const W = world.W, H = world.H;
  for (const p of world._ambientParticles) {
    p.age += dt;
    if (p.kind === 'snow' || p.kind === 'petals' || p.kind === 'leaves') {
      p.sway += dt * (p.kind === 'snow' ? 0.8 : 0.6);
      p.x += (p.vx + Math.sin(p.sway) * (p.kind === 'petals' ? 30 : p.kind === 'leaves' ? 22 : 18)) * dt;
      p.y += p.vy * dt;
    } else if (p.kind === 'rain') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    } else if (p.kind === 'fireflies') {
      p.sway += dt;
      p.pulse += dt * 1.6;
      p.x += Math.sin(p.sway * 0.7) * 12 * dt;
      p.y += Math.cos(p.sway * 0.5) * 8 * dt;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H * 0.7; if (p.y > H) p.y = 0;
    } else if (p.kind === 'stars') {
      p.pulse += dt * 1.2;
    }
  }
  let w2 = 0;
  for (let r = 0; r < world._ambientParticles.length; r++) {
    const p = world._ambientParticles[r];
    if (p.y < H + 20 && p.age < p.life) {
      if (w2 !== r) world._ambientParticles[w2] = p;
      w2++;
    }
  }
  world._ambientParticles.length = w2;
}

export function drawAmbient(world, ctx) {
  if (!world._ambient) return;
  // Particles drawn under the tint so the tint affects them subtly.
  for (const p of world._ambientParticles) {
    if (p.kind === 'rain') {
      ctx.strokeStyle = 'rgba(180,210,240,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - 3, p.y + 8);
      ctx.stroke();
    } else if (p.kind === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.fillRect(Math.round(p.x + Math.sin(p.sway) * 20), Math.round(p.y), 2, 2);
    } else if (p.kind === 'petals' || p.kind === 'leaves') {
      ctx.fillStyle = p.color;
      const drift = Math.sin(p.sway) * (p.kind === 'petals' ? 30 : 22);
      ctx.fillRect(Math.round(p.x + drift), Math.round(p.y), p.kind === 'leaves' ? 3 : 2, 2);
    } else if (p.kind === 'fireflies') {
      const alpha = 0.4 + 0.5 * Math.sin(p.pulse);
      ctx.fillStyle = `rgba(244,196,48,${alpha.toFixed(2)})`;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
      // Soft glow
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 6);
      grad.addColorStop(0, `rgba(244,196,48,${(alpha * 0.3).toFixed(2)})`);
      grad.addColorStop(1, 'rgba(244,196,48,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'stars') {
      const twinkle = 0.5 + 0.5 * Math.sin(p.pulse);
      ctx.fillStyle = `rgba(255,255,255,${(p.bright * twinkle).toFixed(2)})`;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
  }
  // Tint overlay (applied after particles for unified atmosphere).
  const TINTS = {
    day:    null,
    dawn:   { color: '#ffb48c', alpha: 0.18 },
    dusk:   { color: '#ff785a', alpha: 0.22 },
    night:  { color: '#0e1a3a', alpha: 0.45 },
    golden: { color: '#F4AC1D', alpha: 0.14 },
    cool:   { color: '#5b8def', alpha: 0.12 },
  };
  const resolveTint = (v) => {
    if (!v) return null;
    if (typeof v === 'string') return TINTS[v] || null;
    if (typeof v === 'object') {
      if (v.preset) return TINTS[v.preset] || null;
      return v;
    }
    return null;
  };
  let tintSpec = null;
  const tintVal = world._ambient.tint;
  if (Array.isArray(tintVal) && tintVal.length) {
    // Keyframe interpolation by world time.
    const frames = tintVal;
    let a = frames[0], b = frames[frames.length - 1];
    if (world.t <= frames[0].t) {
      tintSpec = resolveTint(frames[0]);
    } else if (world.t >= frames[frames.length - 1].t) {
      tintSpec = resolveTint(frames[frames.length - 1]);
    } else {
      for (let i = 0; i < frames.length - 1; i++) {
        if (world.t >= frames[i].t && world.t <= frames[i + 1].t) {
          a = frames[i]; b = frames[i + 1]; break;
        }
      }
      const span = Math.max(0.0001, b.t - a.t);
      const k = (world.t - a.t) / span;
      const sa = resolveTint(a) || { color: '#000', alpha: 0 };
      const sb = resolveTint(b) || { color: '#000', alpha: 0 };
      tintSpec = {
        color: mixColors(sa.color, sb.color, k),
        alpha: (sa.alpha ?? 0) * (1 - k) + (sb.alpha ?? 0) * k,
      };
    }
  } else {
    tintSpec = resolveTint(tintVal);
  }
  if (tintSpec) {
    ctx.fillStyle = tintSpec.color;
    const prevA = ctx.globalAlpha;
    ctx.globalAlpha = prevA * (tintSpec.alpha ?? 0.3);
    ctx.fillRect(0, 0, world.W, world.H);
    ctx.globalAlpha = prevA;
  }
}
