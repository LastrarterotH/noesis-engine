// noesis-engine / interaction
// Pointer handling: a click wakes every learner, routes to an interactive prop
// when the hit lands on one, emits a sparkle, then calls the scene's onClick
// hook. Operates on a `world` instance (needs world.entities, world.props,
// world._touchLearner, world._spawnParticles, world._compiled, world._muted).
// World exposes handleClick / _togglePropInteraction as thin wrappers.

import { PROP_SPRITES } from './prop-sprites.js?v=89';
import { tone } from './audio.js?v=89';

// Interactive props drawn procedurally (not in PROP_SPRITES) need explicit
// click bounds in grid units, matching their drawn extent in prop-draw.js:
// `w` = total width centered on p.x; `top`/`bottom` = cells above/below p.y.
const PROC_HITBOX = {
  switch: { w: 6, top: 10, bottom: 1 },  // bulb up to -10, pole down to +1
  chest:  { w: 10, top: 11, bottom: 1 }, // open lid up to -11, base down to +1
};

export function handleClick(world, x, y, sx, sy) {
  // Declarative replay button: if visible and the click lands inside, reset
  // the scene (same contract as the hand-drawn buttons in hook scenes).
  // The button is drawn in SCREEN space, so the hit-test uses the screen
  // coords (sx, sy): with the camera on a far set or zoomed, the world
  // coords (x, y) never match the box. Fallback to world coords for callers
  // that don't pass screen coords (old hooks, smoke test).
  const hx = sx ?? x, hy = sy ?? y;
  const r = world._replay;
  if (r && r.visible && r.box && hx >= r.box.x && hx <= r.box.x + r.box.w && hy >= r.box.y && hy <= r.box.y + r.box.h) {
    world.reset();
    return;
  }
  // A click wakes every learner; the scene's onClick may also fire fx triggers.
  for (const e of world.entities) {
    if (e.type === 'learner') world._touchLearner(e);
  }
  // Route to interactive prop if click lands on one.
  let consumed = false;
  for (const p of world.props) {
    if (!p.interactive) continue;
    const def = PROP_SPRITES[p.type];
    const s = p.scale || 3;
    let sw, sh, x0, y0;
    if (def) {
      // Sprite prop: anchored bottom-center, sized by its pixel grid.
      sw = def.rows[0].length * s;
      sh = def.rows.length * s;
      x0 = p.x - sw / 2;
      y0 = p.y - sh;
    } else {
      // Procedurally-drawn prop: use its explicit hitbox (or a 6×6 default).
      const hb = PROC_HITBOX[p.type] || { w: 6, top: 6, bottom: 0 };
      sw = hb.w * s;
      sh = (hb.top + hb.bottom) * s;
      x0 = p.x - sw / 2;
      y0 = p.y - hb.top * s;
    }
    if (x >= x0 && x <= x0 + sw && y >= y0 && y <= y0 + sh) {
      togglePropInteraction(world, p);
      consumed = true;
      break;
    }
  }
  // Click feedback: a small amber sparkle radiating from the click point.
  world._spawnParticles(x, y, { color: 'rgb(244,172,29)', count: 8, speed: 70, duration: 0.55, gravity: 0, spread: Math.PI * 2, size: 3 });
  world._compiled.onClick && world._compiled.onClick(world, x, y, { consumed });
}

export function togglePropInteraction(world, p) {
  if (p.type === 'switch') {
    p.state = p.state === 'on' ? 'off' : 'on';
    if (!world._muted) tone(p.state === 'on' ? 900 : 600, 0.06, { type: 'square', vol: 0.10 });
  } else if (p.type === 'chest') {
    if (!p.open) {
      p.open = true;
      world._spawnParticles(p.x, p.y - 16, { count: 14, color: 'rgb(244,172,29)', speed: 90, duration: 1.5, gravity: -15, spread: Math.PI });
      if (!world._muted) {
        tone(523.25, 0.12, { vol: 0.10 });
        setTimeout(() => tone(659.25, 0.12, { vol: 0.10 }), 80);
        setTimeout(() => tone(880, 0.22, { vol: 0.12 }), 170);
      }
    } else {
      p.open = false;
      if (!world._muted) tone(440, 0.10, { vol: 0.08 });
    }
  }
}
