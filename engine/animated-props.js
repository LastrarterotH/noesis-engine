// noesis-engine / animated-props
// Per-frame motion for self-animating props (butterfly, cloud, fish, rabbit,
// tall-grass, bonfire, bee, frog, swing, clock, bird, y el flote lento de los
// cuerpos celestes planet/sun/moon). Mutates each prop's
// position/animation state in place. Operates on a `world` instance (needs
// world.props, world.rng, world._fx, world.W). World exposes _tickAnimatedProps
// as a thin wrapper.

// Franja (set) de origen de un prop: en mundos multi-set, los props animados
// que viajan (cloud, rabbit, bird) deambulan dentro de su franja de W px en
// vez de volar de regreso al primer set.
function strip(world, x) {
  const i = Math.max(0, Math.floor(x / world.W));
  return [i * world.W, (i + 1) * world.W];
}

export function tickAnimatedProps(world, dt) {
  for (const p of world.props) {
    if (p.type === 'butterfly') {
      if (p._anchorX == null) {
        p._anchorX = p.x; p._anchorY = p.y;
        p._t = world.rng() * Math.PI * 2;
        p._amp = 14 + world.rng() * 10;
        p._ampY = 8 + world.rng() * 6;
        p._speed = 1.0 + world.rng() * 0.6;
      }
      p._t += dt * p._speed;
      p.x = p._anchorX + Math.sin(p._t * 1.6) * p._amp;
      p.y = p._anchorY + Math.sin(p._t) * p._ampY;
    } else if (p.type === 'cloud') {
      if (p._cloudSpeed == null) {
        p._cloudSpeed = 6 + world.rng() * 10;
        p._anchorY = p.y;
        [p._stripL, p._stripR] = strip(world, p.x);
      }
      p.x += p._cloudSpeed * dt;
      if (p.x > p._stripR + 80) p.x = p._stripL - 80;
    } else if (p.type === 'fish') {
      if (p._anchorX == null) {
        p._anchorX = p.x; p._anchorY = p.y;
        p._t = world.rng() * Math.PI * 2;
        p._amp = 24 + world.rng() * 14;
        p._ampY = 6 + world.rng() * 4;
        p._speed = 0.7 + world.rng() * 0.4;
      }
      p._t += dt * p._speed;
      p.x = p._anchorX + Math.sin(p._t) * p._amp;
      p.y = p._anchorY + Math.sin(p._t * 2) * p._ampY;
      p._dir = Math.cos(p._t) > 0 ? 1 : -1;
    } else if (p.type === 'rabbit') {
      if (p._hopT == null) {
        p._anchorY = p.y;
        p._hopT = world.rng() * 2.5;
        p._dir = world.rng() > 0.5 ? 1 : -1;
        p._hopSpeed = 18 + world.rng() * 10;
        [p._stripL, p._stripR] = strip(world, p.x);
      }
      p._hopT += dt;
      const cycle = 1.6;
      const phase = (p._hopT % cycle) / cycle;
      // Hop arc: up for first 0.35 of cycle, otherwise resting.
      if (phase < 0.35) {
        const a = phase / 0.35;
        p.y = p._anchorY - Math.sin(a * Math.PI) * 8;
        p.x += p._hopSpeed * p._dir * dt;
      } else {
        p.y = p._anchorY;
      }
      // Wall bounce + occasional direction flip.
      if (p.x < p._stripL + 40 || p.x > p._stripR - 40) p._dir = -p._dir;
      if (world.rng() < 0.0008) p._dir = -p._dir;
    } else if (p.type === 'pond') {
      if (p._t == null) p._t = world.rng() * Math.PI * 2;
      p._t += dt * 1.6;
    } else if (p.type === 'tall-grass') {
      if (p._swayT == null) p._swayT = world.rng() * Math.PI * 2;
      p._swayT += dt * 1.2;
    } else if (p.type === 'bonfire') {
      if (p._flameT == null) {
        p._flameT = world.rng() * Math.PI * 2;
        p._nextSpark = 0;
      }
      p._flameT += dt * 4;
      p._nextSpark -= dt;
      if (p._nextSpark <= 0) {
        world._fx.push({
          type: 'particle', x: p.x + (world.rng() - 0.5) * 8, y: p.y - 18,
          vx: (world.rng() - 0.5) * 12, vy: -30 - world.rng() * 25,
          gravity: -10, age: 0, duration: 0.9 + world.rng() * 0.4,
          size: 2, color: 'rgb(244,172,29)',
        });
        p._nextSpark = 0.08 + world.rng() * 0.12;
      }
    } else if (p.type === 'bee') {
      if (p._anchorX == null) {
        p._anchorX = p.x; p._anchorY = p.y;
        p._t = world.rng() * Math.PI * 2;
        p._amp = 16 + world.rng() * 12;
        p._ampY = 10 + world.rng() * 6;
        p._speed = 1.6 + world.rng() * 0.8;
      }
      p._t += dt * p._speed;
      p.x = p._anchorX + Math.sin(p._t * 1.3) * p._amp;
      p.y = p._anchorY + Math.cos(p._t) * p._ampY;
      p._dir = Math.cos(p._t * 1.3) > 0 ? 1 : -1;
    } else if (p.type === 'frog') {
      if (p._hopT == null) {
        p._anchorY = p.y;
        p._hopT = world.rng() * 5;
        p._blinkT = world.rng() * 4;
        p._blinkOpen = true;
        p._nextBlink = 3 + world.rng() * 5;
      }
      p._hopT += dt;
      p._blinkT += dt;
      // Blink
      if (p._blinkT >= p._nextBlink && p._blinkT < p._nextBlink + 0.12) {
        p._blinkOpen = false;
      } else if (p._blinkT >= p._nextBlink + 0.12) {
        p._blinkOpen = true;
        p._blinkT = 0;
        p._nextBlink = 3 + world.rng() * 5;
      }
      // Occasional small hop
      const cycle = 6;
      const phase = (p._hopT % cycle) / cycle;
      if (phase < 0.18) {
        const a = phase / 0.18;
        p.y = p._anchorY - Math.sin(a * Math.PI) * 5;
      } else {
        p.y = p._anchorY;
      }
    } else if (p.type === 'swing') {
      if (p._swayT == null) p._swayT = world.rng() * Math.PI * 2;
      p._swayT += dt * 1.0;
    } else if (p.type === 'clock') {
      // No state needed; render uses performance.now()
    } else if (p.type === 'planet' || p.type === 'sun' || p.type === 'moon') {
      // Cuerpos celestes: flote lento en el espacio (vida sin fiesta), con fase
      // y ritmo propios por cuerpo para que no se muevan en bloque. Si el prop
      // está en un path (p.ej. la Luna en órbita), el mover manda y no flotamos
      // para no pelear con él.
      const moving = world._propMovers && world._propMovers.some(m => m.prop === p && !m.done);
      if (!moving) {
        if (p._floatT == null) {
          p._anchorX = p.x; p._anchorY = p.y;
          p._floatT = world.rng() * Math.PI * 2;
          p._floatAmpX = 1.0 + world.rng() * 1.4;
          p._floatAmpY = 1.8 + world.rng() * 1.8;
          p._floatSpeed = 0.35 + world.rng() * 0.45;
        }
        p._floatT += dt * p._floatSpeed;
        p.x = p._anchorX + Math.sin(p._floatT * 0.7) * p._floatAmpX;
        p.y = p._anchorY + Math.sin(p._floatT) * p._floatAmpY;
      }
    } else if (p.type === 'field') {
      // Solo avanza el reloj: el jitter del desorden lo lee el drawer.
      if (p._t == null) p._t = 0;
      p._t += dt;
    } else if (p.type === 'cat') {
      // Solo avanza el reloj: el drawer lo usa para la respiración (pose curl).
      if (p._t == null) p._t = world.rng() * Math.PI * 2;
      p._t += dt;
    } else if (p.type === 'wheat') {
      // Vaivén de las espigas (igual que tall-grass).
      if (p._swayT == null) p._swayT = world.rng() * Math.PI * 2;
      p._swayT += dt * 1.1;
    } else if (p.type === 'chasm') {
      // Reloj para el latido del resplandor.
      if (p._t == null) p._t = world.rng() * Math.PI * 2;
      p._t += dt;
    } else if (p.type === 'wonderflower') {
      // Reloj para el ciclo de color y el pulso del resplandor.
      if (p._t == null) p._t = world.rng() * Math.PI * 2;
      p._t += dt;
    } else if (p.type === 'aiorb') {
      // Reloj para la rotación del anillo y el pulso del núcleo.
      if (p._t == null) p._t = world.rng() * Math.PI * 2;
      p._t += dt;
    } else if (p.type === 'notebook') {
      // Reloj para el pulso del resplandor cuando la IA procesa.
      if (p._t == null) p._t = world.rng() * Math.PI * 2;
      p._t += dt;
    } else if (p.type === 'basilisk') {
      // Reloj para la ondulación del cuerpo y el pulso del ojo.
      if (p._t == null) { p._t = world.rng() * Math.PI * 2; p._nextSpark = 0; }
      p._t += dt;
      // Chispas digitales (verde/cian) que emanan del cuerpo: más cuando el ojo
      // tiene poder (eye), nada cuando se apaga.
      const eyeP = p.eye == null ? 1 : p.eye;
      p._nextSpark -= dt;
      if (eyeP > 0.05 && p._nextSpark <= 0 && world._fx) {
        const sc = p.scale || 6;
        world._fx.push({
          type: 'particle',
          x: p.x + (world.rng() - 0.5) * 9 * sc * 0.7,
          y: p.y - (5 + world.rng() * 21) * sc,
          vx: (world.rng() - 0.5) * 16,
          vy: -16 - world.rng() * 26,
          gravity: 8, age: 0, duration: 0.7 + world.rng() * 0.6,
          size: 2,
          color: world.rng() < 0.5 ? 'rgb(120,255,170)' : 'rgb(120,210,255)',
        });
        p._nextSpark = (0.04 + world.rng() * 0.07) / Math.max(0.2, eyeP);
      }
    } else if (p.type === 'pasture') {
      // Reloj para el vaivén de la hierba.
      if (p._swayT == null) p._swayT = world.rng() * Math.PI * 2;
      p._swayT += dt * 1.1;
    } else if (p.type === 'sheep') {
      // Reloj para la respiración suave del lomo.
      if (p._t == null) p._t = world.rng() * Math.PI * 2;
      p._t += dt;
    } else if (p.type === 'bird') {
      if (p._birdSpeed == null) {
        p._birdSpeed = 60 + world.rng() * 50;
        p._birdDir = p.dir ?? (world.rng() > 0.5 ? 1 : -1);
        p._anchorY = p.y;
        p._t = world.rng() * Math.PI * 2;
        [p._stripL, p._stripR] = strip(world, p.x);
      }
      p._t += dt * 8;
      p.x += p._birdSpeed * p._birdDir * dt;
      p.y = p._anchorY + Math.sin(p._t) * 4;
      if (p._birdDir > 0 && p.x > p._stripR + 40) p.x = p._stripL - 40;
      if (p._birdDir < 0 && p.x < p._stripL - 40) p.x = p._stripR + 40;
    }
  }
}
