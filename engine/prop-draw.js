// noesis-engine / prop-draw
// Per-prop draw functions + dispatch (drawProp). Animated/bespoke props
// have their own renderer; static props fall through to PROP_SPRITES.

import { PROP_SPRITES } from './prop-sprites.js?v=129';
import { mixColors } from './util.js?v=129';

// Compute a default collision box for a solid prop: the bottom 60% of the
// sprite, centered on prop.x. Authors can override with `solidBox: {x,y,w,h}`
// (coords relative to prop anchor: x=0 center, y=0 floor).
export function computeSolidBox(prop) {
  const s = prop.scale || 3;
  if (prop.solidBox) {
    prop._collision = {
      x: prop.x + prop.solidBox.x,
      y: prop.y + prop.solidBox.y,
      w: prop.solidBox.w,
      h: prop.solidBox.h,
    };
    return;
  }
  // Try to use the sprite to size the box.
  const def = PROP_SPRITES[prop.type];
  if (!def) return;
  const sw = def.rows[0].length;
  const sh = def.rows.length;
  const w = sw * s;
  const h = sh * s * 0.6;
  prop._collision = {
    x: prop.x - w / 2,
    y: prop.y - h,
    w, h,
  };
}

// Bird, butterfly, cloud: animated props with bespoke render and care.
export function drawButterfly(ctx, prop) {
  const s = prop.scale || 2;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const color = prop.color || '#ff4985';
  const color2 = prop.color2 || '#fbe9b8';
  const dark = '#1F2547';
  const t = prop._t || 0;
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= a;
  // Smooth 3-phase flap.
  const phase = (Math.sin(t * 7) + 1) * 0.5;
  const px = (gx, gy, gw, gh, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(cx + gx * s, cy + gy * s, gw * s, gh * s);
  };
  // Antennae (two thin curls).
  px(-1, -7, 1, 1, dark);
  px(1, -7, 1, 1, dark);
  // Head + body (vertical spine).
  px(0, -6, 1, 1, dark);   // head
  px(0, -5, 1, 4, dark);   // body
  px(0, -1, 1, 1, dark);   // tail tip

  if (phase > 0.66) {
    // Wings fully open: large diamond shape with accent dots.
    // Left wing upper.
    px(-3, -5, 2, 2, color);
    px(-4, -4, 1, 1, color);
    // Left wing lower.
    px(-3, -3, 2, 2, color);
    px(-2, -1, 1, 1, color);
    // Right wing upper.
    px(2, -5, 2, 2, color);
    px(4, -4, 1, 1, color);
    // Right wing lower.
    px(2, -3, 2, 2, color);
    px(2, -1, 1, 1, color);
    // Accent dots (cream highlights).
    px(-3, -4, 1, 1, color2);
    px(3, -4, 1, 1, color2);
    px(-2, -2, 1, 1, color2);
    px(3, -2, 1, 1, color2);
  } else if (phase > 0.33) {
    // Mid-flap: wings half open.
    px(-2, -5, 2, 2, color);
    px(-2, -3, 2, 2, color);
    px(1, -5, 2, 2, color);
    px(1, -3, 2, 2, color);
    px(-2, -4, 1, 1, color2);
    px(2, -4, 1, 1, color2);
  } else {
    // Closed: wings folded near body.
    px(-1, -5, 1, 2, color);
    px(-1, -3, 1, 2, color);
    px(1, -5, 1, 2, color);
    px(1, -3, 1, 2, color);
  }
  ctx.restore();
}

export function drawCloud(ctx, prop) {
  const s = prop.scale || 3;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const main = prop.color || 'rgba(255,255,255,0.95)';
  const highlight = 'rgba(255,255,255,1)';
  const shadow = 'rgba(220,225,240,0.85)';
  const px = (gx, gy, gw, gh, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(cx + gx * s, cy + gy * s, gw * s, gh * s);
  };
  // Bottom shadow strip (subtle).
  px(-5, 0, 11, 1, shadow);
  // Main body, layered for puffy silhouette.
  px(-5, -1, 11, 1, main);
  px(-6, -2, 13, 1, main);
  px(-5, -3, 12, 1, main);
  px(-4, -4, 9, 1, main);
  px(-3, -5, 7, 1, main);
  px(-1, -6, 3, 1, main);
  // Top highlights.
  px(-4, -4, 4, 1, highlight);
  px(-2, -5, 3, 1, highlight);
  px(-1, -6, 2, 1, highlight);
  // Right-side puff for asymmetry.
  px(3, -2, 2, 1, main);
  px(4, -3, 1, 1, main);
}

export function drawBird(ctx, prop) {
  const s = prop.scale || 2;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const color = prop.color || '#2c3454';
  const dark = '#1a2138';
  const belly = '#c9c2b2';
  const beak = prop.beakColor || '#F4AC1D';
  const eye = '#f4f6fa';
  const t = prop._t || 0;
  const flapPhase = (Math.sin(t * 12) + 1) * 0.5;   // 0..1
  const dir = (prop._birdDir == null ? 1 : prop._birdDir);
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= a;
  const px = (gx, gy, gw, gh, c) => {
    ctx.fillStyle = c;
    // Horizontal mirror if flying left.
    const sx = cx + (gx * dir) * s - (dir < 0 ? gw * s : 0);
    ctx.fillRect(sx, cy + gy * s, gw * s, gh * s);
  };
  // Tail: two feathers.
  px(-5, -4, 2, 1, dark);
  px(-5, -3, 1, 1, color);
  // Body with a light belly.
  px(-4, -3, 5, 1, color);
  px(-3, -2, 4, 1, color);
  px(-3, -1, 3, 1, belly);
  // Head: crown shade, then the eye over it.
  px(1, -4, 2, 2, color);
  px(1, -4, 2, 1, dark);
  px(2, -4, 1, 1, eye);
  // Beak: bright base, darker tip.
  px(3, -3, 1, 1, beak);
  px(4, -3, 1, 1, '#c8881a');
  // Wing (animated, dark over the body tone so each phase reads).
  if (flapPhase > 0.66) {
    px(-2, -6, 3, 1, dark);
    px(-2, -5, 2, 1, color);
  } else if (flapPhase > 0.33) {
    px(-3, -3, 4, 1, dark);
  } else {
    px(-2, -1, 2, 1, dark);
    px(-2, 0, 3, 1, dark);
  }
  ctx.restore();
}

export function drawFish(ctx, prop) {
  const s = prop.scale || 3;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const body = prop.color || '#F4AC1D';
  const dark = prop.color2 || '#a17a14';
  const belly = '#fbe9b8';
  const sclera = '#ffffff';
  const pupil = '#1F2547';
  const dir = prop._dir == null ? 1 : prop._dir;
  const t = prop._t || 0;
  const finOpen = Math.sin(t * 8) > 0;
  const px = (gx, gy, gw, gh, c) => {
    ctx.fillStyle = c;
    const sx = cx + (gx * dir) * s - (dir < 0 ? gw * s : 0);
    ctx.fillRect(sx, cy + gy * s, gw * s, gh * s);
  };
  // Tail (forked, animated open/closed)
  if (finOpen) {
    px(-6, -4, 1, 1, dark);
    px(-5, -3, 1, 1, body);
    px(-6, -2, 1, 2, dark);
    px(-5, -1, 1, 1, body);
    px(-6, 0, 1, 1, dark);
  } else {
    px(-5, -3, 1, 1, dark);
    px(-5, -2, 1, 2, body);
    px(-5, 0, 1, 1, dark);
  }
  // Dorsal fin (top)
  px(-2, -4, 3, 1, dark);
  px(-1, -5, 2, 1, dark);
  // Body (oval-ish)
  px(-4, -3, 6, 3, body);
  px(-3, -1, 5, 1, belly);
  // Side stripe / scales hint
  px(-2, -2, 3, 1, dark);
  px(0, -3, 1, 1, dark);
  // Ventral fin (bottom)
  px(-1, 0, 2, 1, dark);
  // Head
  px(2, -2, 1, 2, body);
  // Eye (white + pupil)
  px(1, -2, 1, 1, sclera);
  px(1, -2, 1, 1, pupil); // pupil overlay (small)
  // Mouth
  px(2, -1, 1, 1, dark);
}

export function drawRabbit(ctx, prop) {
  const s = prop.scale || 3;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const body = prop.color || '#d8a878';
  const dark = prop.color2 || '#a17a44';
  const innerEar = '#f4c4a4';
  const belly = '#fbe9b8';
  const tail = '#ffffff';
  const eye = '#1F2547';
  const nose = '#d12838';
  const dir = prop._dir == null ? 1 : prop._dir;
  const px = (gx, gy, gw, gh, c) => {
    ctx.fillStyle = c;
    const sx = cx + (gx * dir) * s - (dir < 0 ? gw * s : 0);
    ctx.fillRect(sx, cy + gy * s, gw * s, gh * s);
  };
  // Ears outer
  px(-2, -9, 1, 4, body);
  px(1, -9, 1, 4, body);
  // Ears inner (pink)
  px(-2, -8, 1, 2, innerEar);
  px(1, -8, 1, 2, innerEar);
  // Head top
  px(-1, -7, 2, 1, body);
  // Head main
  px(-2, -6, 4, 2, body);
  // Eye
  px(1, -5, 1, 1, eye);
  // Nose
  px(2, -5, 1, 1, nose);
  // Mouth shadow
  px(2, -4, 1, 1, dark);
  // Neck
  px(-1, -4, 3, 1, body);
  // Body (chubby)
  px(-3, -3, 5, 2, body);
  // Belly
  px(-2, -3, 4, 1, belly);
  // Fluffy tail
  px(-4, -2, 2, 2, tail);
  // Front legs
  px(0, -1, 1, 2, body);
  px(2, -1, 1, 2, body);
  // Back leg / paw
  px(-3, -1, 2, 1, body);
  // Paws darker
  px(0, 0, 1, 1, dark);
  px(2, 0, 1, 1, dark);
  px(-3, 0, 2, 1, dark);
}

export function drawTallGrass(ctx, prop) {
  const s = prop.scale || 3;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const main = prop.color || '#5b9a66';
  const dark = prop.color2 || '#3e6e47';
  const light = '#8fc09b';
  const bud = prop.budColor || '#fbe9b8';
  const t = prop._swayT || 0;
  const px = (gx, gy, gw, gh, c) => { ctx.fillStyle = c; ctx.fillRect(cx + gx * s, cy + gy * s, gw * s, gh * s); };
  // Cluster of 5 blades with varied heights, offsets, sway phases, and one bud each on the taller ones.
  const blades = [
    { x: -4, h: 4, phase: 0.0, bud: false },
    { x: -2, h: 6, phase: 0.6, bud: true },
    { x:  0, h: 8, phase: 1.2, bud: true },
    { x:  2, h: 5, phase: 0.3, bud: false },
    { x:  4, h: 7, phase: 0.9, bud: true },
  ];
  for (const b of blades) {
    for (let y = 0; y < b.h; y++) {
      const heightFrac = y / (b.h - 1 || 1);
      const offset = Math.round(Math.sin(t + b.phase) * heightFrac * 2.4);
      const c = y === 0 ? dark : (y >= b.h - 2 ? light : main);
      px(b.x + offset, -y - 1, 1, 1, c);
    }
    if (b.bud) {
      const offset = Math.round(Math.sin(t + b.phase) * 2.8);
      px(b.x + offset, -b.h - 1, 1, 1, bud);
    }
  }
}

export function drawSwitch(ctx, prop) {
  const s = prop.scale || 4;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const post = '#5a4022';
  const postLight = '#8b6a3f';
  const boxDark = '#1f2129';
  const boxMid = '#3a3f55';
  const boxLight = '#5a6075';
  const on = prop.state === 'on';
  const lever = on ? '#F4AC1D' : '#8a93ab';
  const leverDark = on ? '#a17a14' : '#3a3f55';
  const bulb = on ? '#F4AC1D' : '#3a3f55';
  const bulbHi = on ? '#fbe9b8' : '#5a6075';
  const px = (gx, gy, gw, gh, c) => { ctx.fillStyle = c; ctx.fillRect(cx + gx * s, cy + gy * s, gw * s, gh * s); };
  // Mounting pole
  px(-1, 0, 2, 1, post);
  px(0, -1, 1, 1, post);
  // Bulb above box (lit indicator)
  px(-1, -10, 2, 1, bulb);
  px(-2, -9, 4, 2, bulb);
  px(-1, -7, 2, 1, bulb);
  px(-1, -9, 2, 1, bulbHi);  // highlight
  // Box frame outer
  px(-3, -6, 6, 5, boxDark);
  // Box body
  px(-2, -5, 4, 3, boxMid);
  // Box panel inset
  px(-2, -5, 4, 1, boxLight);
  // Lever
  if (on) {
    // tilted up-right
    px(0, -5, 1, 1, lever);
    px(1, -4, 1, 1, lever);
    px(1, -3, 1, 1, leverDark);
  } else {
    // tilted down-left
    px(-1, -3, 1, 1, leverDark);
    px(-1, -4, 1, 1, lever);
    px(0, -4, 1, 1, lever);
  }
  // Lever knob
  px(on ? 1 : -1, on ? -4 : -4, 1, 1, bulbHi);
  // Halo if on
  if (on) {
    const grad = ctx.createRadialGradient(cx, cy - s * 9, 0, cx, cy - s * 9, s * 9);
    grad.addColorStop(0, 'rgba(244,172,29,0.50)');
    grad.addColorStop(1, 'rgba(244,172,29,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy - s * 9, s * 9, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawChest(ctx, prop) {
  const s = prop.scale || 4;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const wood = prop.color || '#8b6a3f';
  const woodHi = '#a17a44';
  const woodMid = '#7a5e35';
  const dark = '#5a4022';
  const darker = '#3a2a18';
  const iron = '#1F2547';
  const ironHi = '#3a3f55';
  const gold = '#F4AC1D';
  const goldLight = '#fbe9b8';
  const gem = '#d12838';
  const gemBlue = '#22c4f8';
  const open = !!prop.open;
  const px = (gx, gy, gw, gh, c) => { ctx.fillStyle = c; ctx.fillRect(cx + gx * s, cy + gy * s, gw * s, gh * s); };

  if (open) {
    // Open lid tilted back (above body)
    px(-5, -11, 10, 1, darker);
    px(-5, -10, 10, 1, wood);
    px(-5, -9, 10, 1, woodHi);
    px(-5, -8, 10, 1, woodMid);
    // Iron corners on lid
    px(-5, -10, 1, 3, iron);
    px(4, -10, 1, 3, iron);
    // Iron band lid bottom
    px(-5, -7, 10, 1, ironHi);
    // Treasure inside (3 colors, layered)
    px(-4, -6, 8, 1, gold);
    px(-3, -5, 6, 1, goldLight);
    px(-1, -5, 2, 1, gem);     // ruby
    px(2, -5, 1, 1, gemBlue);  // sapphire
    // Sparkle dots
    px(0, -7, 1, 1, '#ffffff');
    px(-2, -6, 1, 1, '#ffffff');
    // Chest base body
    px(-5, -4, 10, 4, wood);
    px(-5, -4, 10, 1, woodHi);
    px(-5, -2, 10, 1, woodMid);
    px(-5, 0, 10, 1, darker);
    // Iron corners body
    px(-5, -4, 1, 4, iron);
    px(4, -4, 1, 4, iron);
    // Bottom band
    px(-5, -1, 10, 1, ironHi);
    // Halo glow rising
    const grad = ctx.createRadialGradient(cx, cy - s * 6, 0, cx, cy - s * 6, s * 12);
    grad.addColorStop(0, 'rgba(244,172,29,0.45)');
    grad.addColorStop(1, 'rgba(244,172,29,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy - s * 6, s * 12, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Lid
    px(-5, -8, 10, 3, wood);
    px(-5, -8, 10, 1, woodHi);     // top highlight
    px(-5, -6, 10, 1, woodMid);    // shadow inside lid
    // Lid iron corners
    px(-5, -8, 1, 3, iron);
    px(4, -8, 1, 3, iron);
    // Iron band where lid meets body
    px(-5, -5, 10, 1, iron);
    // Body
    px(-5, -4, 10, 4, wood);
    px(-5, -4, 10, 1, woodHi);     // top highlight
    px(-5, -2, 10, 1, woodMid);    // plank line
    px(-5, 0, 10, 1, darker);      // shadow
    // Body iron corners
    px(-5, -4, 1, 4, iron);
    px(4, -4, 1, 4, iron);
    // Bottom band
    px(-5, -1, 10, 1, ironHi);
    // Lock plate
    px(-1, -7, 3, 4, gold);
    px(-1, -7, 3, 1, goldLight);   // lock highlight
    px(0, -5, 1, 1, darker);       // keyhole
    px(0, -4, 1, 1, darker);
  }
}

export function drawBonfire(ctx, prop) {
  const s = prop.scale || 4;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  const _ga = ctx.globalAlpha; ctx.globalAlpha = _ga * a;
  const log = '#5a4022';
  const logRing = '#7a5530';
  const logHi = '#a17a44';
  const logKnot = '#3a2a18';
  const emberHot = '#F4AC1D';
  const emberCool = '#c44a3e';
  const f1 = '#ff6f3f';     // base orange-red
  const f2 = '#F4AC1D';     // mid yellow
  const f3 = '#fbe9b8';     // tip cream
  const t = prop._flameT || 0;
  const flicker = (Math.sin(t) + 1) * 0.5;
  const flicker2 = (Math.sin(t * 1.7 + 1) + 1) * 0.5;
  const px = (gx, gy, gw, gh, c) => { ctx.fillStyle = c; ctx.fillRect(cx + gx * s, cy + gy * s, gw * s, gh * s); };

  // Big radial halo (two layers)
  const grad = ctx.createRadialGradient(cx, cy - 5 * s, 0, cx, cy - 5 * s, s * 20);
  grad.addColorStop(0, `rgba(244,172,29,${(0.35 + flicker * 0.10).toFixed(2)})`);
  grad.addColorStop(0.45, `rgba(244,172,29,${(0.16 + flicker * 0.06).toFixed(2)})`);
  grad.addColorStop(1, 'rgba(244,172,29,0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy - 5 * s, s * 20, 0, Math.PI * 2); ctx.fill();

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(cx - 6 * s, cy, 12 * s, s);

  // Log 1 (horizontal, longer, behind)
  px(-5, -1, 10, 2, log);
  px(-5, -1, 10, 1, logHi);          // top highlight
  px(-4, 0, 8, 1, logRing);          // bottom shadow
  // Log 1 end rings (knot circles)
  px(-5, -1, 1, 2, logKnot);
  px(4, -1, 1, 2, logKnot);
  // Grain marks on Log 1
  px(-2, 0, 1, 1, logRing);
  px(1, 0, 1, 1, logRing);

  // Log 2 (shorter, on top, crossed)
  px(-3, -3, 6, 2, log);
  px(-3, -3, 6, 1, logHi);
  px(-3, -3, 1, 2, logKnot);         // end ring
  px(2, -3, 1, 2, logKnot);          // end ring

  // Embers (hot bed under flame)
  px(-2, -4, 4, 1, emberCool);
  px(-1, -4, 2, 1, emberHot);

  // Flame layers
  // Outer (orange-red) — base
  px(-2, -5, 4, 1, f1);
  px(-2, -6, 4, 1, f1);
  px(-1, -7, 3, 1, f1);
  px(-1, -8, 2, 1, f1);
  // Mid (yellow)
  px(-1, -5, 2, 1, f2);
  px(-1, -6, 2, 1, f2);
  px(0, -7, 1, 1, f2);
  // Inner core (cream)
  px(0, -5, 1, 1, f3);
  px(0, -6, 1, 1, f3);
  // Tip varies with flicker
  if (flicker > 0.45) {
    px(0, -9, 1, 1, f1);
    px(0, -8, 1, 1, f2);
  }
  if (flicker > 0.75) {
    px(0, -10, 1, 1, f1);
  }
  // Side tongues (asymmetric, second sine)
  if (flicker2 > 0.5) {
    px(-3, -6, 1, 1, f1);
  }
  if (flicker2 < 0.5) {
    px(2, -7, 1, 1, f1);
  }
  ctx.globalAlpha = _ga;
}

export function drawBee(ctx, prop) {
  const s = prop.scale || 3;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const yellow = prop.color || '#F4AC1D';
  const yellowHi = '#fbe9b8';
  const dark = '#1F2547';
  const wing = 'rgba(255,255,255,0.80)';
  const wingHi = 'rgba(255,255,255,1)';
  const eye = '#000000';
  const dir = prop._dir == null ? 1 : prop._dir;
  const t = prop._t || 0;
  const wingsUp = Math.sin(t * 28) > 0;
  const px = (gx, gy, gw, gh, c) => {
    ctx.fillStyle = c;
    const sx = cx + (gx * dir) * s - (dir < 0 ? gw * s : 0);
    ctx.fillRect(sx, cy + gy * s, gw * s, gh * s);
  };
  // Wings (4 wings: 2 upper big, 2 lower small)
  if (wingsUp) {
    // Upper wings (extended up and out)
    px(-2, -5, 3, 1, wing);
    px(0, -5, 3, 1, wing);
    px(-1, -4, 1, 1, wingHi);
    px(1, -4, 1, 1, wingHi);
  } else {
    // Wings down-back
    px(-3, -3, 3, 1, wing);
    px(1, -3, 3, 1, wing);
    px(-2, -2, 1, 1, wingHi);
    px(2, -2, 1, 1, wingHi);
  }
  // Stinger (back, dark spike)
  px(-3, -2, 1, 1, dark);
  // Body abdomen (3 cells with 2 stripes)
  px(-2, -2, 1, 1, yellow);
  px(-1, -2, 1, 1, dark);     // stripe 1
  px(0, -2, 1, 1, yellow);
  px(1, -2, 1, 1, dark);      // stripe 2
  // Body bottom
  px(-2, -1, 1, 1, yellowHi);
  px(-1, -1, 1, 1, dark);
  px(0, -1, 1, 1, yellowHi);
  px(1, -1, 1, 1, dark);
  // Head (round, dark)
  px(2, -3, 2, 1, dark);
  px(2, -2, 2, 1, dark);
  // Eye (bright dot)
  px(3, -2, 1, 1, eye);
  // Antennae
  px(2, -4, 1, 1, dark);
  px(3, -5, 1, 1, dark);
}

export function drawFrog(ctx, prop) {
  const s = prop.scale || 3;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  const _ga = ctx.globalAlpha; ctx.globalAlpha = _ga * a;
  const body = prop.color || '#5b9a66';
  const bodyHi = '#7eb78a';
  const dark = '#3e6e47';
  const belly = '#bfd49a';
  const sclera = '#ffffff';
  const pupil = '#1F2547';
  const blinking = prop._blinkOpen === false;
  const px = (gx, gy, gw, gh, c) => { ctx.fillStyle = c; ctx.fillRect(cx + gx * s, cy + gy * s, gw * s, gh * s); };

  // Shadow underneath
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(cx - 4 * s, cy, 8 * s, s);

  // Eye bumps (raised, top of head)
  // Left eye bump
  px(-4, -6, 2, 1, body);
  px(-4, -5, 2, 1, body);
  // Right eye bump
  px(2, -6, 2, 1, body);
  px(2, -5, 2, 1, body);

  // Eye whites or blink line
  if (blinking) {
    px(-4, -5, 2, 1, pupil);
    px(2, -5, 2, 1, pupil);
  } else {
    px(-4, -5, 2, 1, sclera);
    px(2, -5, 2, 1, sclera);
    // Pupils (inner, looking forward)
    px(-3, -5, 1, 1, pupil);
    px(2, -5, 1, 1, pupil);
  }

  // Head + body (wide, rounded)
  px(-3, -4, 6, 1, body);
  px(-3, -4, 6, 1, bodyHi);     // top highlight
  px(-4, -3, 8, 1, body);
  px(-4, -2, 8, 2, body);

  // Belly accent
  px(-2, -2, 4, 1, belly);
  px(-2, -1, 4, 1, belly);

  // Mouth (wide smile)
  px(-2, -3, 4, 1, dark);

  // Nostrils
  px(-1, -4, 1, 1, dark);
  px(1, -4, 1, 1, dark);

  // Front legs (folded against body)
  px(-4, -1, 1, 1, dark);
  px(3, -1, 1, 1, dark);

  // Hind feet (webbed, 3 toes each)
  px(-5, 0, 2, 1, body);
  px(3, 0, 2, 1, body);
  // Toe lines
  px(-5, 0, 1, 1, dark);
  px(-3, 0, 1, 1, dark);
  px(3, 0, 1, 1, dark);
  px(5, 0, 1, 1, dark);
  ctx.globalAlpha = _ga;
}

export function drawSwing(ctx, prop) {
  const s = prop.scale || 3;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const t = prop._swayT || 0;
  const sway = Math.sin(t) * 10;
  const rope = '#5a4022';
  const ropeHi = '#8b6a3f';
  const ropeKnot = '#3a2a18';
  const seat = '#8b6a3f';
  const seatHi = '#b18950';
  const seatDark = '#5a4022';
  const bar = '#5a4022';
  const barHi = '#a17a44';
  const post = '#3a2a18';
  // Lateral posts (the swing frame)
  const barY = cy - 16 * s;
  ctx.fillStyle = post;
  ctx.fillRect(cx - 9 * s, barY - s, s * 1.2, s * 18);
  ctx.fillRect(cx + 8 * s, barY - s, s * 1.2, s * 18);
  // Top horizontal beam
  ctx.fillStyle = bar;
  ctx.fillRect(cx - 9 * s, barY, 18 * s, s * 1.6);
  ctx.fillStyle = barHi;
  ctx.fillRect(cx - 9 * s, barY, 18 * s, Math.max(1, s * 0.4));   // highlight on top
  // Bracket marks on beam
  ctx.fillStyle = post;
  ctx.fillRect(cx - 5 * s, barY + s * 1.6, s * 0.6, s * 0.5);
  ctx.fillRect(cx + 4 * s, barY + s * 1.6, s * 0.6, s * 0.5);
  // Ropes
  ctx.strokeStyle = rope;
  ctx.lineWidth = Math.max(2, s * 0.6);
  ctx.beginPath();
  ctx.moveTo(cx - 4 * s, barY + s * 2);
  ctx.lineTo(cx - 4 * s + sway, cy - s * 1.5);
  ctx.moveTo(cx + 4 * s, barY + s * 2);
  ctx.lineTo(cx + 4 * s + sway, cy - s * 1.5);
  ctx.stroke();
  // Rope highlights (thin parallel line)
  ctx.strokeStyle = ropeHi;
  ctx.lineWidth = Math.max(1, s * 0.2);
  ctx.beginPath();
  ctx.moveTo(cx - 4 * s + s * 0.25, barY + s * 2);
  ctx.lineTo(cx - 4 * s + sway + s * 0.25, cy - s * 1.5);
  ctx.moveTo(cx + 4 * s + s * 0.25, barY + s * 2);
  ctx.lineTo(cx + 4 * s + sway + s * 0.25, cy - s * 1.5);
  ctx.stroke();
  // Rope knots at seat
  ctx.fillStyle = ropeKnot;
  ctx.fillRect(cx - 4 * s - s * 0.5 + sway, cy - s * 1.5, s, s);
  ctx.fillRect(cx + 4 * s - s * 0.5 + sway, cy - s * 1.5, s, s);
  // Seat (swaying)
  ctx.fillStyle = seat;
  ctx.fillRect(cx - 5 * s + sway, cy - s * 1.2, 10 * s, s * 1.5);
  ctx.fillStyle = seatHi;
  ctx.fillRect(cx - 5 * s + sway, cy - s * 1.2, 10 * s, Math.max(1, s * 0.4));
  ctx.fillStyle = seatDark;
  ctx.fillRect(cx - 5 * s + sway, cy + s * 0.1, 10 * s, Math.max(1, s * 0.25));
  // Plank lines on seat
  ctx.fillStyle = seatDark;
  ctx.fillRect(cx - 2 * s + sway, cy - s * 1.2, Math.max(1, s * 0.25), s * 1.4);
  ctx.fillRect(cx + 1.5 * s + sway, cy - s * 1.2, Math.max(1, s * 0.25), s * 1.4);
}

export function drawClock(ctx, prop) {
  const s = prop.scale || 4;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y - 5 * s);
  const navy = '#1F2547';
  const paper = '#fbe9b8';
  const paperHi = '#fefdf8';
  const amber = '#F4AC1D';
  const frame = '#5a4022';
  const frameHi = '#8b6a3f';
  const t = performance.now() / 1000;
  const px = (gx, gy, gw, gh, c) => { ctx.fillStyle = c; ctx.fillRect(cx + gx * s, cy + gy * s, gw * s, gh * s); };
  // Wooden frame outer ring
  for (let r = -6; r <= 5; r++) {
    for (let c = -6; c <= 5; c++) {
      const d = Math.sqrt((r + 0.5) * (r + 0.5) + (c + 0.5) * (c + 0.5));
      if (d >= 5.0 && d <= 6.0) px(c, r, 1, 1, frame);
      if (d >= 5.0 && d < 5.4 && r < 0) px(c, r, 1, 1, frameHi);
    }
  }
  // Face background (inner circle)
  for (let r = -5; r <= 4; r++) {
    for (let c = -5; c <= 4; c++) {
      const d = Math.sqrt((r + 0.5) * (r + 0.5) + (c + 0.5) * (c + 0.5));
      if (d < 5.0) px(c, r, 1, 1, paper);
    }
  }
  // Subtle highlight on upper-left of face
  px(-3, -3, 2, 1, paperHi);
  // Hour markers at 12, 3, 6, 9 (bold)
  px(-1, -5, 2, 1, navy);  // 12
  px(4, 0, 1, 1, navy);    // 3
  px(-1, 4, 2, 1, navy);   // 6
  px(-5, 0, 1, 1, navy);   // 9
  // Minor tick marks (1, 2, 4, 5, 7, 8, 10, 11)
  const ticks = [[-2, -4], [2, -4], [4, -2], [4, 2], [2, 4], [-2, 4], [-4, 2], [-4, -2]];
  for (const [gc, gr] of ticks) {
    ctx.fillStyle = navy;
    ctx.fillRect(cx + gc * s + s * 0.3, cy + gr * s + s * 0.3, s * 0.4, s * 0.4);
  }
  // Hands
  const minuteAngle = (t * 0.7) % (Math.PI * 2) - Math.PI / 2;
  const hourAngle = (t * 0.06) % (Math.PI * 2) - Math.PI / 2;
  ctx.strokeStyle = navy;
  ctx.lineCap = 'square';
  // Hour hand (thicker, shorter)
  ctx.lineWidth = Math.max(2, s * 0.45);
  ctx.beginPath();
  ctx.moveTo(cx + s / 2, cy + s / 2);
  ctx.lineTo(cx + s / 2 + Math.cos(hourAngle) * 2.6 * s, cy + s / 2 + Math.sin(hourAngle) * 2.6 * s);
  ctx.stroke();
  // Minute hand (thinner, longer)
  ctx.lineWidth = Math.max(1, s * 0.3);
  ctx.beginPath();
  ctx.moveTo(cx + s / 2, cy + s / 2);
  ctx.lineTo(cx + s / 2 + Math.cos(minuteAngle) * 3.8 * s, cy + s / 2 + Math.sin(minuteAngle) * 3.8 * s);
  ctx.stroke();
  // Center pivot
  ctx.fillStyle = amber;
  ctx.fillRect(cx - s * 0.3, cy - s * 0.3, s * 1.6, s * 1.6);
  ctx.fillStyle = navy;
  ctx.fillRect(cx + s * 0.3, cy + s * 0.3, s * 0.5, s * 0.5);
}

export function drawBell(ctx, prop) {
  const s = prop.scale || 3;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const brass = prop.color || '#F4AC1D';
  const brassHi = '#fbe9b8';
  const brassPale = '#fff3c9';
  const brassMid = '#d49612';
  const brassDark = '#a17a14';
  const brassDeep = '#6e5008';
  const stand = '#5a4022';
  const standHi = '#8b6a3f';
  const standDark = '#3a2818';
  const navy = '#1F2547';
  const wobble = prop._ringT > 0 ? Math.sin(prop._ringT * 32) * 1 : 0;
  const px = (gx, gy, gw, gh, c) => { ctx.fillStyle = c; ctx.fillRect(cx + (gx + wobble) * s, cy + gy * s, gw * s, gh * s); };

  // Loop on top (the handle ring)
  px(-1, -10, 1, 1, brassDark);
  px(0, -10, 1, 1, brassMid);
  px(1, -10, 1, 1, brassDark);
  px(-1, -9, 3, 1, brassDeep);
  // Loop sides
  px(0, -8, 1, 1, brassMid);

  // Dome top
  px(-2, -7, 5, 1, brassMid);
  // Body row 1
  px(-3, -6, 7, 1, brass);
  px(-3, -6, 2, 1, brassHi);
  px(-3, -6, 1, 1, brassPale);
  px(3, -6, 1, 1, brassDark);
  // Body row 2
  px(-3, -5, 7, 1, brass);
  px(-3, -5, 1, 1, brassHi);
  px(3, -5, 1, 1, brassDark);
  // Body row 3 (widest)
  px(-3, -4, 7, 1, brass);
  px(-3, -4, 1, 1, brassMid);
  px(3, -4, 1, 1, brassDark);
  // Body row 4
  px(-3, -3, 7, 1, brass);
  px(3, -3, 1, 1, brassDark);
  // Mouth lip (darker rim)
  px(-3, -2, 7, 1, brassDeep);
  px(-3, -2, 1, 1, brassDark);
  // Clapper visible inside the mouth
  px(0, -1, 1, 1, navy);

  // Stand: 3-tier base for weight
  px(-4, -1, 9, 1, stand);
  px(-4, -1, 9, 1, standHi);
  px(-4, 0, 9, 1, stand);
  px(-5, 0, 1, 1, standDark);
  px(4, 0, 1, 1, standDark);
  // Decorative cap
  px(-3, -1, 1, 1, standHi);
  px(2, -1, 1, 1, standDark);

  // Ring animation: vibration sparkles on both sides
  if (prop._ringT > 0) {
    ctx.fillStyle = 'rgba(251,233,184,0.85)';
    const t = prop._ringT;
    const off = Math.sin(t * 28) * 3;
    ctx.fillRect(cx - 5 * s + off, cy - 5 * s, s, s);
    ctx.fillRect(cx + 5 * s - off, cy - 5 * s, s, s);
    ctx.fillStyle = 'rgba(244,172,29,0.7)';
    ctx.fillRect(cx - 6 * s, cy - 7 * s + off * 0.5, s, s);
    ctx.fillRect(cx + 6 * s, cy - 7 * s - off * 0.5, s, s);
  }
}

// --- Caché de rasterizado de sprites estáticos -------------------------------
// Clave: tipo + escala + colores + densidad. Los sprites son inmutables por
// clave, así que el caché es global y solo se poda por tamaño (FIFO).
const SPRITE_RASTER_CACHE = new Map();
const SPRITE_RASTER_MAX = 256;

// Densidad efectiva del contexto (píxeles de device por píxel lógico):
// supersampleo (3x) × zoom de cámara. Redondeada hacia arriba para que el
// raster nunca quede por debajo de la resolución de destino.
function _ctxDensity(ctx) {
  if (typeof ctx.getTransform === 'function') {
    const t = ctx.getTransform();
    if (t && typeof t.a === 'number') {
      return Math.min(6, Math.max(1, Math.ceil(Math.hypot(t.a, t.b))));
    }
  }
  return 3;
}

function _spriteRaster(prop, def, s, density) {
  const key = prop.type + '|' + s + '|' + (prop.color || '') + '|' + (prop.color2 || '') + '|' + density;
  const hit = SPRITE_RASTER_CACHE.get(key);
  if (hit !== undefined) return hit;
  const rows = def.rows;
  const h = rows.length;
  const w = rows[0].length;
  let raster = null;
  try {
    const off = document.createElement('canvas');
    off.width = Math.max(1, Math.ceil(w * s * density));
    off.height = Math.max(1, Math.ceil(h * s * density));
    const c = off.getContext('2d');
    c.scale(density, density);
    const palette = { ...def.palette };
    if (prop.color && def.mainKey) palette[def.mainKey] = prop.color;
    if (prop.color2 && def.secondaryKey) palette[def.secondaryKey] = prop.color2;
    // Sprites con `shades`: derivan su rampa de sombras/luces del `color` base,
    // así un prop monocromo (planet) cambia de color DE VERDAD y no solo en su
    // tono principal. Cada entrada es key -> [hacia, cantidad] para mixColors.
    if (prop.color && def.shades) {
      for (const k in def.shades) {
        const [toward, amt] = def.shades[k];
        palette[k] = mixColors(prop.color, toward, amt);
      }
    }
    let lastColor = null;
    for (let r = 0; r < h; r++) {
      const row = rows[r];
      for (let col = 0; col < w; col++) {
        const ch = row[col];
        if (ch === '.') continue;
        const color = palette[ch];
        if (!color) continue;
        if (color !== lastColor) { c.fillStyle = color; lastColor = color; }
        c.fillRect(col * s, r * s, s, s);
      }
    }
    raster = off;
  } catch { raster = null; }
  if (SPRITE_RASTER_CACHE.size >= SPRITE_RASTER_MAX) {
    SPRITE_RASTER_CACHE.delete(SPRITE_RASTER_CACHE.keys().next().value);
  }
  SPRITE_RASTER_CACHE.set(key, raster);
  return raster;
}

// Pond: charco/laguna localizada. Elipse de agua aplanada (perspectiva) con
// tres tonos de profundidad, borde húmedo, reflejo de cielo arriba y ondas
// concéntricas que se expanden y desvanecen. (x, y) es la base (borde frontal).
export function drawPond(ctx, prop) {
  const s = prop.scale || 3.5;
  const u = s * 0.42;            // sub-celda: bloques finos para que el agua no se vea tosca
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const t = prop._t || 0;
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  const _ga = ctx.globalAlpha; ctx.globalAlpha = _ga * a;
  const deep = prop.color || '#2f6f93';
  const mid = '#4a93bd';
  const lite = '#7cc1de';
  const rim = '#244f66';
  const foam = '#cdeaf3';
  const RX = 16, RY = 7.6;       // en sub-celdas (mismo tamaño total que antes)
  const ecy = -RY;              // centro de la elipse, en sub-celdas sobre la base
  // Tile sin costuras: cada celda llega justo hasta el borde de la siguiente.
  const px = (gx, gy, c) => {
    ctx.fillStyle = c;
    const x0 = Math.round(cx + gx * u), x1 = Math.round(cx + (gx + 1) * u);
    const y0 = Math.round(cy + gy * u), y1 = Math.round(cy + (gy + 1) * u);
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  };
  // Cuerpo de agua: tono por profundidad (centro hondo, borde claro, orilla húmeda).
  for (let gy = -Math.ceil(RY * 2) - 1; gy <= 0; gy++) {
    for (let gx = -RX - 1; gx <= RX + 1; gx++) {
      const nx = gx / RX, ny = (gy - ecy) / RY;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      let c = d > 0.88 ? rim : (d > 0.55 ? mid : deep);
      // Reflejo del cielo: banda clara en la mitad superior del charco.
      if (ny < -0.12 && ny > -0.72 && d < 0.8) c = lite;
      px(gx, gy, c);
    }
  }
  // Glints que derivan suave sobre la superficie.
  const g1 = Math.round(Math.sin(t * 0.8) * 3);
  px(-5 + g1, -Math.round(RY) - 1, foam);
  px(6 + Math.round(Math.sin(t * 0.8 + 2) * 3), -Math.round(RY), foam);
  // Ondas concéntricas: anillos que crecen y se desvanecen.
  ctx.save();
  for (const ph of [0, 2.1, 4.2]) {
    const prog = (((t * 0.45 + ph) % 6.283) / 6.283);
    const rr = 0.18 + prog * 0.8;
    const alpha = (1 - prog) * 0.45;
    if (alpha < 0.05) continue;
    ctx.globalAlpha = _ga * a * alpha;
    for (let gy = -Math.ceil(RY * 2) - 1; gy <= 0; gy++) {
      for (let gx = -RX - 1; gx <= RX + 1; gx++) {
        const nx = gx / RX, ny = (gy - ecy) / RY;
        const d = Math.sqrt(nx * nx + ny * ny);
        if (d <= 1 && Math.abs(d - rr) < 0.06) px(gx, gy, foam);
      }
    }
  }
  ctx.restore();
  ctx.globalAlpha = _ga;
  // Publica el centro visual y el radio para que el foco (focus) caiga
  // centrado en el agua, no en la base del prop.
  prop._fcy = cy + ecy * u;
  prop._fr = RX * u;
}

// Domino: ficha que se vuelca. (x, y) es la base, que es el pivote del giro.
// `fall` (0..1) la inclina hacia `dir` (1 = cae a la derecha, default) hasta
// ~84 grados, así una se derriba sobre la siguiente (efecto dominó). El motor
// no tiene rotación general: este drawer la aplica localmente con ctx.rotate.
export function drawDomino(ctx, prop) {
  const s = prop.scale || 3;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const dir = prop.dir == null ? 1 : prop.dir;
  const fall = Math.max(0, Math.min(1, prop.fall || 0));
  const face = prop.color || '#f1ead8';
  const faceHi = '#fffdf6';
  const faceSh = '#d6cdb6';
  const edge = '#2c2c38';
  const pip = '#2c2c38';
  const ang = dir * fall * 1.47;       // hasta ~84 grados
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  const px = (gx, gy, gw, gh, c) => { ctx.fillStyle = c; ctx.fillRect(gx * s, gy * s, gw * s, gh * s); };
  // Silueta/borde oscuro (la ficha es 7 celdas de ancho x 18 de alto).
  px(-3, -18, 7, 18, edge);
  // Cara clara, con luz a la izquierda y sombra a la derecha (volumen).
  px(-2, -17, 5, 16, face);
  px(-2, -17, 1, 16, faceHi);
  px(2, -17, 1, 16, faceSh);
  // Línea divisoria central de la ficha.
  px(-2, -10, 5, 1, edge);
  // Puntos (pips): tres arriba, dos abajo.
  px(-1, -15, 1, 1, pip);
  px(1, -14, 1, 1, pip);
  px(0, -12, 1, 1, pip);
  px(-1, -7, 1, 1, pip);
  px(1, -5, 1, 1, pip);
  ctx.restore();
}

// Field: campo de partículas que va del ORDEN al DESORDEN en sitio (entropía,
// mezcla, transformación en sitio). Cada celda tiene una casa ordenada (rejilla)
// y un destino caótico determinista (hash del índice); `disorder` (0..1)
// interpola entre ambos y agrega un jitter creciente. Con color2, la mitad
// izquierda es color y la derecha color2: al desordenarse, los dos se mezclan
// (dos gases). El motor no animaba "sustancia"; este es el morph que faltaba.
export function drawField(ctx, prop) {
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const W = prop.w || 240;
  const H = prop.h || 160;
  const cols = prop.cols || 12;
  const rows = prop.rows || 8;
  const d = Math.max(0, Math.min(1, prop.disorder || 0));
  const c1 = prop.color || '#5b8def';
  const c2 = prop.color2 || c1;
  const t = prop._t || 0;
  const dot = Math.max(2, Math.round((prop.scale || 1) * 4));
  // homeFrac: el estado ORDENADO ocupa solo la fracción izquierda del ancho
  // (1 = todo). El desorden esparce por TODO el ancho: sirve para la expansión
  // de un gas confinado que llena el recipiente. jitter: tembleque base para
  // que un gas se vea vivo aun ordenado (0 = orden limpio, p.ej. la entropía).
  const hf = prop.homeFrac == null ? 1 : Math.max(0.08, Math.min(1, prop.homeFrac));
  const baseJit = prop.jitter || 0;
  const left = cx - W / 2, top = cy - H / 2;
  const dx = (W * hf) / cols, dy = H / rows;
  const hash = (n) => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const homeX = left + (c + 0.5) * dx;
      const homeY = top + (r + 0.5) * dy;
      const scatX = left + 3 + hash(i * 2 + 1) * (W - 6);
      const scatY = top + 3 + hash(i * 2 + 2) * (H - 6);
      const jit = baseJit + d * 2.2;
      const jx = Math.sin(t * 1.6 + i) * jit;
      const jy = Math.cos(t * 1.9 + i * 1.3) * jit;
      const x = homeX + (scatX - homeX) * d + jx;
      const y = homeY + (scatY - homeY) * d + jy;
      ctx.fillStyle = (c < cols / 2) ? c1 : c2;
      ctx.fillRect(Math.round(x - dot / 2), Math.round(y - dot / 2), dot, dot);
    }
  }
}

// Cat: gato bespoke dibujado con formas suaves (curvas, no píxeles) para que
// tenga carácter. Tres poses, (x, y) es la base (el piso bajo el gato).
//  - 'walk': de perfil, sobre cuatro patas, cola en alto, ojos abiertos.
//  - 'curl': enroscado durmiendo, ojos cerrados, respiración suave.
//  - 'fall': tendido de lado, patas estiradas, quieto.
// `color` recolorea el pelaje (sombra, luz, panza y rayas se derivan de él);
// `dir` espeja en horizontal; `alpha` (0..1) lo vuelve fantasma, para la doble
// exposición de la superposición. Toda la geometría está en unidades de `s`,
// con la y hacia arriba en negativo desde la base.
export function drawCat(ctx, prop) {
  const pose = prop.pose || 'walk';
  const s = prop.scale || 3;
  const dir = prop.dir == null ? 1 : prop.dir;
  const fur = prop.color || '#8893a8';
  const furD = mixColors(fur, '#000000', 0.46);
  const furM = mixColors(fur, '#000000', 0.22);
  const furL = mixColors(fur, '#ffffff', 0.34);
  const belly = mixColors(fur, '#ffffff', 0.58);
  const stripe = mixColors(fur, '#000000', 0.30);
  const earIn = '#e0a3ab', nose = '#c4727d', eyeC = furD;
  const eyeOpen = '#8ec07c', pupil = '#1b2230';
  const whisker = 'rgba(246,248,252,0.66)';
  const t = prop._t || 0;
  const breath = pose === 'curl' ? (Math.sin(t * 1.4) * 0.5 + 0.5) : 0;
  const TAU = Math.PI * 2;
  const E = (x, y, rx, ry, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x * s, y * s, rx * s, ry * s, 0, 0, TAU); ctx.fill(); };
  const tri = (ax, ay, bx, by, cx2, cy2, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(ax * s, ay * s); ctx.lineTo(bx * s, by * s); ctx.lineTo(cx2 * s, cy2 * s); ctx.closePath(); ctx.fill(); };
  const line = (x1, y1, x2, y2, c, w) => { ctx.strokeStyle = c; ctx.lineWidth = Math.max(0.6, w * s); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1 * s, y1 * s); ctx.lineTo(x2 * s, y2 * s); ctx.stroke(); };
  const curve = (x1, y1, cx1, cy1, x2, y2, c, w) => { ctx.strokeStyle = c; ctx.lineWidth = Math.max(0.6, w * s); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1 * s, y1 * s); ctx.quadraticCurveTo(cx1 * s, cy1 * s, x2 * s, y2 * s); ctx.stroke(); };
  // Ojo cerrado feliz: un arco que abre hacia abajo (forma de U suave).
  const shut = (x, y, r, c, w) => { ctx.strokeStyle = c; ctx.lineWidth = Math.max(0.6, w * s); ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x * s, y * s, r * s, Math.PI * 0.16, Math.PI * 0.84); ctx.stroke(); };

  ctx.save();
  ctx.globalAlpha *= Math.max(0, Math.min(1, prop.alpha == null ? 1 : prop.alpha));
  // Sombra de contacto en el piso.
  const shW = pose === 'walk' ? 5.0 : (pose === 'fall' ? 6.4 : 5.6);
  ctx.fillStyle = 'rgba(8,10,22,0.26)';
  ctx.beginPath();
  ctx.ellipse(prop.x, prop.y - s * 0.2, shW * s, s * 0.95, 0, 0, TAU);
  ctx.fill();

  ctx.translate(prop.x, prop.y);
  ctx.scale(dir, 1);

  if (pose === 'curl') {
    const bo = breath * 0.28, br = breath * 0.12;
    // Silueta oscura de fondo (da el contorno).
    E(0.3, -2.7, 5.7, 3.2, furD);
    E(-3.2, -4.0, 2.95, 2.75, furD);
    // Cola enroscando por el frente.
    curve(4.8, -3.0, 6.9, -0.1, -3.0, -0.9, furD, 2.3);
    curve(4.8, -3.0, 6.4, -0.3, -2.8, -1.0, fur, 1.4);
    line(5.6, -2.2, 5.2, -3.0, stripe, 0.5); line(6.0, -1.0, 5.4, -1.4, stripe, 0.5);
    // Cuerpo (con respiración: el lomo sube y se expande apenas).
    E(0.3, -2.5, 5.4, 2.9, furM);
    E(0.1, -2.95 - bo, 5.2, 2.6 + br, fur);
    E(-0.6, -3.7 - bo, 3.8, 1.6, furL);
    E(0.4, -1.6, 4.3, 1.4, belly);
    // Rayas atigradas sobre el lomo.
    for (const k of [-2.4, -1.0, 0.4, 1.8]) curve(k, -5.0 - bo, k + 0.2, -4.4 - bo, k + 0.1, -3.9 - bo, stripe, 0.5);
    // Cabeza.
    E(-3.2, -4.0, 2.6, 2.4, fur);
    E(-3.8, -4.6, 1.5, 1.1, furL);
    // Orejas.
    tri(-4.9, -5.4, -4.3, -6.9, -3.4, -5.6, furD); tri(-4.8, -5.4, -4.3, -6.7, -3.5, -5.6, fur); tri(-4.5, -5.7, -4.25, -6.3, -3.85, -5.75, earIn);
    tri(-3.0, -5.6, -2.4, -7.0, -1.6, -5.5, furD); tri(-2.95, -5.6, -2.4, -6.8, -1.7, -5.5, fur); tri(-2.7, -5.8, -2.45, -6.4, -2.05, -5.75, earIn);
    // Ojos cerrados, nariz, boca.
    shut(-3.85, -4.05, 0.6, eyeC, 0.34); shut(-2.5, -4.05, 0.6, eyeC, 0.34);
    tri(-3.45, -3.35, -2.95, -3.35, -3.2, -2.95, nose);
    curve(-3.2, -2.95, -3.55, -2.65, -3.85, -2.85, eyeC, 0.24); curve(-3.2, -2.95, -2.85, -2.65, -2.55, -2.85, eyeC, 0.24);
    // Bigotes.
    line(-2.95, -3.2, -0.7, -3.7, whisker, 0.16); line(-2.95, -3.0, -0.8, -3.0, whisker, 0.16);
    line(-3.5, -3.2, -5.7, -3.7, whisker, 0.16); line(-3.5, -3.0, -5.7, -3.1, whisker, 0.16);
    // Patita recogida al frente.
    E(-1.4, -0.9, 1.3, 0.7, furM); E(-1.4, -1.0, 1.2, 0.55, furL);
  } else if (pose === 'fall') {
    // Tendido de lado, cabeza a la izquierda, patas y cola estiradas. Quieto.
    curve(4.8, -1.6, 7.3, -1.4, 8.7, -0.5, furD, 1.8); curve(4.8, -1.6, 7.0, -1.4, 8.4, -0.6, fur, 1.05);
    // Patas estiradas hacia el frente.
    line(0.0, -1.5, 1.3, -0.2, furM, 0.95); E(1.3, -0.2, 0.5, 0.3, furM);
    line(1.2, -1.6, 3.2, -0.2, furM, 0.95); E(3.2, -0.2, 0.55, 0.32, furM);
    line(2.2, -1.5, 4.4, -0.3, fur, 1.0); E(4.4, -0.3, 0.6, 0.34, furM);
    // Cuerpo largo y bajo.
    E(0.4, -1.7, 5.4, 1.85, furD);
    E(0.4, -1.7, 5.2, 1.65, fur);
    E(0.2, -2.3, 3.6, 0.85, furM);
    E(0.6, -1.05, 4.2, 0.9, belly);
    for (const k of [-1.6, -0.2, 1.2, 2.6]) line(k, -3.0, k + 0.1, -2.3, stripe, 0.42);
    // Cabeza apoyada.
    E(-4.4, -1.5, 2.1, 1.95, furD);
    E(-4.4, -1.5, 1.9, 1.75, fur);
    E(-4.85, -2.0, 1.05, 0.8, furL);
    tri(-5.6, -2.7, -5.25, -4.0, -4.45, -2.85, furD); tri(-5.5, -2.7, -5.25, -3.8, -4.55, -2.85, fur); tri(-5.25, -2.95, -5.1, -3.5, -4.8, -2.95, earIn);
    tri(-3.9, -2.85, -3.35, -3.8, -2.95, -2.65, furD); tri(-3.85, -2.85, -3.4, -3.6, -3.05, -2.65, fur);
    shut(-5.0, -1.45, 0.5, eyeC, 0.3); shut(-3.75, -1.4, 0.46, eyeC, 0.3);
    tri(-6.15, -1.15, -5.7, -1.15, -5.95, -0.8, nose);
    line(-5.6, -1.25, -7.5, -1.05, whisker, 0.15); line(-5.6, -1.05, -7.5, -0.7, whisker, 0.15);
  } else {
    // 'walk': de perfil, mirando a la derecha (dir lo espeja).
    // Cola en alto, curvada (gato contento).
    curve(-4.0, -2.6, -6.7, -4.9, -4.7, -6.3, furD, 2.0); curve(-4.0, -2.6, -6.4, -4.8, -4.6, -6.1, fur, 1.2);
    line(-5.7, -5.2, -5.1, -5.5, stripe, 0.42); line(-6.1, -4.0, -5.5, -4.2, stripe, 0.42);
    // Patas traseras (más lejos, en sombra).
    line(-2.6, -1.8, -2.9, -0.2, furM, 1.0); E(-2.9, -0.2, 0.7, 0.4, furM);
    line(2.4, -1.8, 2.7, -0.2, furM, 1.0); E(2.7, -0.2, 0.7, 0.4, furM);
    // Cuerpo.
    E(0, -3.2, 4.6, 2.4, furD);
    E(0, -3.2, 4.4, 2.2, fur);
    E(-0.3, -3.9, 3.4, 1.3, furL);
    E(0.2, -2.4, 3.8, 1.3, belly);
    for (const k of [-2.0, -0.6, 0.8]) line(k, -5.2, k + 0.1, -4.4, stripe, 0.45);
    // Patas delanteras (en primer plano).
    line(-1.4, -1.7, -1.2, -0.1, fur, 1.15); E(-1.2, -0.1, 0.8, 0.45, furM);
    line(3.2, -1.7, 3.4, -0.1, fur, 1.15); E(3.4, -0.1, 0.8, 0.45, furM);
    // Cabeza.
    E(4.6, -4.0, 2.4, 2.2, furD);
    E(4.6, -4.0, 2.2, 2.0, fur);
    E(4.2, -4.5, 1.3, 0.95, furL);
    tri(3.0, -5.4, 3.2, -6.9, 4.1, -5.6, furD); tri(3.1, -5.4, 3.25, -6.7, 4.0, -5.6, fur); tri(3.4, -5.65, 3.5, -6.3, 3.85, -5.7, earIn);
    tri(5.0, -5.5, 5.6, -6.8, 6.0, -5.4, furD); tri(5.05, -5.5, 5.55, -6.6, 5.9, -5.4, fur); tri(5.35, -5.6, 5.6, -6.2, 5.8, -5.5, earIn);
    // Hocico, ojo abierto, nariz, bigotes.
    E(5.7, -3.3, 1.5, 1.1, furL);
    E(5.3, -4.2, 0.55, 0.7, '#fbfdff'); E(5.5, -4.2, 0.34, 0.6, eyeOpen); E(5.62, -4.2, 0.15, 0.42, pupil);
    tri(6.5, -3.5, 6.95, -3.5, 6.72, -3.05, nose);
    curve(6.72, -3.05, 6.4, -2.8, 6.0, -2.95, eyeC, 0.2);
    line(6.4, -3.5, 8.7, -4.0, whisker, 0.16); line(6.5, -3.3, 8.8, -3.3, whisker, 0.16); line(6.4, -3.1, 8.6, -2.7, whisker, 0.16);
  }
  ctx.restore();
}

// Vault: caja fuerte metálica vista de frente, en dos capas que el z-index
// intercala con los gatos. `face: 'back'` dibuja la cavidad (manta, cuencos y,
// en penumbra al fondo, el mecanismo: contador, frasco de veneno y martillo);
// `face: 'front'` dibuja el marco metálico (siempre opaco) y, sobre él, la
// puerta y el volante. La puerta se dibuja con opacidad 1 - `glass`: con glass
// alto la cara se vuelve translúcida (corte de rayos X) y se ven los gatos del
// fondo. `wheel` (radianes) gira el volante. `color` tiñe el metal.
export function drawVault(ctx, prop) {
  const s = prop.scale || 3.5;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);            // piso (donde apoyan las ruedas)
  const lift = prop.lift || 0;              // celdas que la caja sube sobre el piso (mesa con ruedas)
  const by = Math.round(cy - lift * s);     // base de la caja
  const face = prop.face || 'front';
  const metal = prop.color || '#6E7896';
  // La geometría de la caja se ancla a `by`; la mesa va de `by` al piso `cy`.
  const px = (gx, gy, gw, gh, c) => { ctx.fillStyle = c; ctx.fillRect(cx + gx * s, by + gy * s, Math.ceil(gw * s) + 1, Math.ceil(gh * s) + 1); };

  if (face === 'back') {
    // Mesa con ruedas que sostiene la caja en alto (solo si lift > 0).
    if (lift > 0) {
      const TAU = Math.PI * 2;
      const tw = 17;
      const top = by + 1.4 * s;
      const legBot = cy - 1.9 * s;
      const legX = [-tw / 2 + 2.2, tw / 2 - 2.2];
      // Tablero.
      ctx.fillStyle = '#2f2615'; ctx.fillRect(cx - (tw / 2) * s, top + 1.8 * s, tw * s, 0.7 * s);
      ctx.fillStyle = '#4a3a24'; ctx.fillRect(cx - (tw / 2) * s, top, tw * s, 2.0 * s);
      ctx.fillStyle = '#6a533a'; ctx.fillRect(cx - (tw / 2) * s, top, tw * s, 0.6 * s);
      // Patas y travesaño.
      for (const lx of legX) {
        ctx.fillStyle = '#39414f'; ctx.fillRect(cx + lx * s - 0.5 * s, top + 2 * s, 1.0 * s, legBot - (top + 2 * s));
        ctx.fillStyle = '#262d3a'; ctx.fillRect(cx + lx * s + 0.2 * s, top + 2 * s, 0.32 * s, legBot - (top + 2 * s));
      }
      ctx.fillStyle = '#39414f'; ctx.fillRect(cx + legX[0] * s, (top + legBot) / 2, (legX[1] - legX[0]) * s, 0.7 * s);
      // Ruedas.
      for (const lx of legX) {
        const wxx = cx + lx * s, wyy = cy - 1.0 * s;
        ctx.fillStyle = '#1c2230'; ctx.beginPath(); ctx.arc(wxx, wyy, 1.4 * s, 0, TAU); ctx.fill();
        ctx.fillStyle = '#39414f'; ctx.beginPath(); ctx.arc(wxx, wyy, 0.7 * s, 0, TAU); ctx.fill();
        ctx.fillStyle = '#5a6478'; ctx.beginPath(); ctx.arc(wxx, wyy, 0.28 * s, 0, TAU); ctx.fill();
      }
    }
    const cavity = '#0a0d1a';
    // Cavidad y pared trasera (un punto más clara arriba para dar profundidad).
    px(-7, -16, 14, 13, cavity);
    px(-7, -16, 14, 2, '#141a30');
    // Mecanismo siniestro al fondo, en penumbra (presente, no protagonista).
    px(-6, -15, 3, 2, '#39414f');           // contador Geiger
    px(-5, -14, 1, 1, '#caa23a');           // su lucecita, apagada
    px(-1, -15, 2, 3, '#2c4738');           // frasco de veneno (vidrio)
    px(-1, -13, 2, 1, '#3f6f4f');           // veneno
    px(3, -15, 1, 3, '#5a4733');            // mango del martillo
    px(2, -13, 3, 1, '#5a6378');            // cabeza del martillo
    // Cojín / manta al fondo de la caja.
    px(-6, -5, 12, 2, '#6e5536');
    px(-6, -5, 12, 1, '#8a6f48');
    px(-6, -3, 12, 1, '#4a3a24');
    // Dos cuencos: agua (izquierda) y comida (derecha).
    px(-6, -4, 3, 1, '#566072'); px(-5, -4, 1, 1, '#3f8fb0');
    px(3, -4, 3, 1, '#566072'); px(4, -4, 1, 1, '#6e4a28');
    return;
  }

  // face === 'front'
  const mTop = mixColors(metal, '#ffffff', 0.32);
  const mMid = mixColors(metal, '#ffffff', 0.12);
  const mDark = mixColors(metal, '#000000', 0.34);
  const mDeep = mixColors(metal, '#000000', 0.55);
  const glass = Math.max(0, Math.min(1, prop.glass || 0));
  const doorA = 1 - glass;

  // Puerta + volante: opacidad 1 - glass (se vuelve translúcida en rayos X).
  ctx.save();
  ctx.globalAlpha *= Math.max(0, doorA);
  const dBody = mixColors(metal, '#000000', 0.12);
  px(-7, -16, 14, 13, dBody);
  px(-7, -16, 14, 1, mTop);                 // luz superior de la puerta
  px(-7, -4, 14, 1, mDeep);                 // sombra inferior
  // Vetas horizontales del metal cepillado.
  for (let gy = -14; gy <= -6; gy += 3) px(-6, gy, 12, 0.3, mDark);
  // Junta vertical central (doble hoja).
  ctx.fillStyle = mDeep;
  ctx.fillRect(cx - s * 0.2, by - 16 * s, Math.max(1, s * 0.4), 12 * s);
  // Volante central, girable.
  const wheel = prop.wheel || 0;
  ctx.save();
  ctx.translate(cx, by - 9.5 * s);
  ctx.rotate(wheel);
  ctx.lineCap = 'round';
  ctx.strokeStyle = mDeep; ctx.lineWidth = Math.max(2, s * 0.8);
  ctx.beginPath(); ctx.arc(0, 0, 4.2 * s, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = mTop; ctx.lineWidth = Math.max(1, s * 0.4);
  ctx.beginPath(); ctx.arc(0, 0, 4.2 * s, -1.1, 1.2); ctx.stroke();
  ctx.strokeStyle = mMid; ctx.lineWidth = Math.max(2, s * 0.6);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 3.9 * s, Math.sin(a) * 3.9 * s); ctx.stroke(); }
  ctx.fillStyle = '#F4AC1D'; ctx.beginPath(); ctx.arc(0, 0, 1.2 * s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.restore();

  // Marco metálico exterior, siempre opaco (la silueta de la caja persiste).
  px(-11, -19, 22, 3, metal); px(-11, -19, 22, 1, mTop); px(-11, -17, 22, 1, mDark);   // dintel
  px(-11, -2, 22, 2, metal); px(-11, -2, 22, 1, mMid); px(-11, 0, 22, 1, mDeep);        // base
  px(-11, -19, 4, 21, metal); px(-11, -19, 1, 21, mTop); px(-8, -19, 1, 21, mDark);     // jamba izq
  px(7, -19, 4, 21, metal); px(7, -19, 1, 21, mMid); px(10, -19, 1, 21, mDeep);         // jamba der
  // Remaches en las esquinas.
  for (const [rx, ry] of [[-10, -18], [9, -18], [-10, -1], [9, -1]]) px(rx, ry, 1, 1, mDeep);
}

// Wheat: espigas de trigo dorado con grano y vaivén suave (como tall-grass,
// pero con cabeza de grano). `color` tiñe la caña. (x, y) es la base.
export function drawWheat(ctx, prop) {
  const s = prop.scale || 3;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const stalk = prop.color || '#c8962e';
  const stalkD = '#9a6f1e';
  const grain = '#e8c24a';
  const grainHi = '#fbe9a8';
  const t = prop._swayT || 0;
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= a;
  const px = (gx, gy, gw, gh, c) => { ctx.fillStyle = c; ctx.fillRect(cx + gx * s, cy + gy * s, gw * s, gh * s); };
  const blades = [
    { x: -4, h: 7, phase: 0.0 },
    { x: -2, h: 9, phase: 0.6 },
    { x: 0, h: 11, phase: 1.2 },
    { x: 2, h: 8, phase: 0.3 },
    { x: 4, h: 10, phase: 0.9 },
  ];
  for (const b of blades) {
    for (let y = 0; y < b.h; y++) {
      const heightFrac = y / (b.h - 1 || 1);
      const offset = Math.round(Math.sin(t + b.phase) * heightFrac * 2.2);
      px(b.x + offset, -y - 1, 1, 1, y === 0 ? stalkD : stalk);
    }
    const off = Math.round(Math.sin(t + b.phase) * 2.6);
    const gx = b.x + off, gy = -b.h - 1;
    px(gx, gy - 1, 1, 1, grainHi);
    px(gx, gy, 1, 1, grainHi);
    px(gx - 1, gy + 1, 1, 1, grain);
    px(gx, gy + 1, 1, 1, grain);
    px(gx + 1, gy + 1, 1, 1, grain);
    px(gx, gy + 2, 1, 1, grain);
  }
  ctx.restore();
}

// Chasm: grieta en la tierra con luz del inframundo. (x, y) es el punto en el
// suelo. `open` (0..1) la abre (animable con tween "id.open"); el resplandor
// late con `_t`. La mecánica del rapto: la tierra se abre y algo emerge.
export function drawChasm(ctx, prop) {
  const s = prop.scale || 4;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const open = Math.max(0, Math.min(1, prop.open == null ? 1 : prop.open));
  if (open < 0.02) return;
  const t = prop._t || 0;
  const hw = open * 15 * s;
  const hh = open * 3.2 * s;
  const pulse = 0.55 + 0.45 * Math.sin(t * 3);
  ctx.save();
  const g = ctx.createRadialGradient(cx, cy - hh * 0.3, 0, cx, cy, hw * 1.5);
  g.addColorStop(0, 'rgba(240,120,50,' + (0.55 * pulse * open).toFixed(3) + ')');
  g.addColorStop(0.45, 'rgba(190,50,35,' + (0.30 * open).toFixed(3) + ')');
  g.addColorStop(1, 'rgba(120,20,20,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(cx, cy, hw * 1.5, hh * 2.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0b0712';
  ctx.beginPath(); ctx.ellipse(cx, cy, hw, hh, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(235,95,45,' + (0.5 + 0.4 * pulse).toFixed(2) + ')';
  ctx.beginPath(); ctx.ellipse(cx, cy, hw * 0.6, hh * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,205,130,' + (0.4 * pulse).toFixed(2) + ')';
  ctx.beginPath(); ctx.ellipse(cx, cy, hw * 0.28, hh * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1422';
  const n = Math.max(4, Math.round(open * 9));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const ex = cx + Math.cos(a) * hw * 0.92;
    const ey = cy + Math.sin(a) * hh * 0.92;
    const up = Math.sin(a) < 0 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(ex - s * 0.8, ey);
    ctx.lineTo(ex, ey + up * s * 1.4);
    ctx.lineTo(ex + s * 0.8, ey);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// Wonderflower: la flor imposible. Pétalos que emiten luz y ciclan de color
// (rojo, dorado, púrpura, azul) con `_t`. (x, y) es la base del tallo.
export function drawWonderflower(ctx, prop) {
  const s = prop.scale || 3;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const t = prop._t || 0;
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= a;
  const colors = ['#e0445f', '#F4AC1D', '#9a5bd0', '#4f8fe0'];
  const ph = ((t * 0.6) % colors.length + colors.length) % colors.length;
  const i0 = Math.floor(ph), i1 = (i0 + 1) % colors.length, f = ph - i0;
  const col = mixColors(colors[i0], colors[i1], f);
  const colL = mixColors(col, '#ffffff', 0.4);
  const stem = '#3e7a4b';
  const headY = cy - 8 * s;
  const pulse = 0.6 + 0.4 * Math.sin(t * 2.4);
  const px = (gx, gy, gw, gh, c) => { ctx.fillStyle = c; ctx.fillRect(cx + gx * s, cy + gy * s, gw * s, gh * s); };
  ctx.save();
  ctx.globalAlpha = 0.32 * pulse;
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(cx, headY, 7 * s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  px(-0.5, -8, 1, 8, stem);
  px(-2.5, -5, 2, 1, stem);
  px(0.6, -4, 2, 1, stem);
  ctx.save();
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2;
    const pxp = cx + Math.cos(a) * 2.6 * s, pyp = headY + Math.sin(a) * 2.6 * s;
    ctx.fillStyle = (k % 2) ? col : colL;
    ctx.beginPath(); ctx.ellipse(pxp, pyp, 1.5 * s, 1.0 * s, a, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = mixColors(col, '#000000', 0.25);
  ctx.beginPath(); ctx.arc(cx, headY, 1.7 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fbe9a8';
  ctx.beginPath(); ctx.arc(cx, headY, 0.8 * s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Pomegranate: granada partida que muestra un anillo de semillas glossy. `seeds`
// (0..6) controla cuántas quedan: comerlas las quita una a una. `color` tiñe la
// cáscara; `alpha` la desvanece. (x, y) es la base.
export function drawPomegranate(ctx, prop) {
  const s = prop.scale || 2;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  const seeds = prop.seeds == null ? 6 : prop.seeds;
  const rind = prop.color || '#a8323a';
  const rindD = mixColors(rind, '#000000', 0.40);
  const rindHi = mixColors(rind, '#ffffff', 0.28);
  const flesh = '#f3cdd2';
  const seedC = '#d83a58';
  const seedHi = '#ff9fb0';
  const calyx = mixColors(rind, '#000000', 0.22);
  const TAU = Math.PI * 2;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = 'rgba(8,10,22,0.25)';
  ctx.beginPath(); ctx.ellipse(cx, cy, 5.2 * s, 1.5 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = rindD; ctx.beginPath(); ctx.ellipse(cx, cy - 4.4 * s, 5.0 * s, 5.0 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = rind; ctx.beginPath(); ctx.ellipse(cx, cy - 4.6 * s, 4.5 * s, 4.6 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = rindHi; ctx.beginPath(); ctx.ellipse(cx - 1.8 * s, cy - 6.4 * s, 1.4 * s, 1.0 * s, -0.5, 0, TAU); ctx.fill();
  ctx.fillStyle = calyx;
  for (const dx of [-1.1, 0, 1.1]) {
    ctx.beginPath();
    ctx.moveTo(cx + (dx - 0.5) * s, cy - 9.0 * s);
    ctx.lineTo(cx + dx * s, cy - 10.5 * s);
    ctx.lineTo(cx + (dx + 0.5) * s, cy - 9.0 * s);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = flesh; ctx.beginPath(); ctx.ellipse(cx, cy - 5.2 * s, 3.4 * s, 2.7 * s, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = mixColors(flesh, '#a8323a', 0.4); ctx.lineWidth = Math.max(1, s * 0.4);
  ctx.beginPath(); ctx.ellipse(cx, cy - 5.2 * s, 3.4 * s, 2.7 * s, 0, 0, TAU); ctx.stroke();
  const n = Math.max(0, Math.min(6, Math.ceil(seeds)));
  for (let i = 0; i < 6; i++) {
    if (i >= n) continue;
    const ang = -Math.PI / 2 + i * TAU / 6;
    const sx = cx + Math.cos(ang) * 1.95 * s;
    const sy = cy - 5.2 * s + Math.sin(ang) * 1.5 * s;
    ctx.fillStyle = seedC; ctx.beginPath(); ctx.ellipse(sx, sy, 0.95 * s, 1.15 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = seedHi; ctx.beginPath(); ctx.arc(sx - 0.32 * s, sy - 0.38 * s, 0.34 * s, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// Tree-bare: árbol desnudo de invierno, ramas vectoriales que se bifurcan, con
// nieve en las puntas. Gemelo del prop `tree` para el cruce verde↔pelado por
// temporada. `color` tiñe la corteza; `alpha` lo desvanece. (x, y) es la base.
export function drawTreeBare(ctx, prop) {
  const s = prop.scale || 3.5;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  const bark = prop.color || '#6a5236';
  const snow = '#e8f1fb';
  const TAU = Math.PI * 2;
  ctx.save();
  ctx.globalAlpha *= a;
  // Sombra de contacto.
  ctx.fillStyle = 'rgba(8,10,22,0.22)';
  ctx.beginPath(); ctx.ellipse(cx, cy, 4 * s, 1.1 * s, 0, 0, TAU); ctx.fill();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = bark;
  const branch = function (x, y, ang, len, w, depth) {
    const x2 = x + Math.cos(ang) * len;
    const y2 = y + Math.sin(ang) * len;
    ctx.lineWidth = Math.max(1, w);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    if (depth <= 0) {
      ctx.fillStyle = snow;
      ctx.beginPath(); ctx.arc(x2, y2, Math.max(1.2, w * 0.9), 0, TAU); ctx.fill();
      ctx.strokeStyle = bark;
      return;
    }
    branch(x2, y2, ang - (0.34 + 0.06 * depth), len * 0.76, w * 0.66, depth - 1);
    branch(x2, y2, ang + (0.34 + 0.06 * depth), len * 0.76, w * 0.66, depth - 1);
    if (depth >= 2) branch(x2, y2, ang - 0.04, len * 0.6, w * 0.5, depth - 1);
  };
  branch(cx, cy, -Math.PI / 2, 9 * s, 2.3 * s, 3);
  ctx.restore();
}

// Basilisk: serpiente-máquina imponente que se eleva, con un ojo central que
// resplandece (la mirada). La mecánica de la escena 06: `scale` la hace crecer,
// `alpha` la disuelve y `eye` (0..1) controla la intensidad del ojo y su glare.
// "Crece con la creencia, se disuelve con la razón." (x, y) es la base.
export function drawBasilisk(ctx, prop) {
  const s = prop.scale || 6;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  const eye = Math.max(0, Math.min(1, prop.eye == null ? 1 : prop.eye));
  const t = prop._t || 0;
  const body = prop.color || '#171430';
  const bodyHi = mixColors(body, '#8fb0ff', 0.5);
  const rim = mixColors(body, '#9fc0ff', 0.7);
  const bodyD = mixColors(body, '#000000', 0.55);
  const fleck = mixColors(body, '#7a5fb0', 0.5);
  const eyeCol = '#ff7a3c';
  const eyeHot = '#ffe3b0';
  const TAU = Math.PI * 2;
  const N = 11;
  const H = 27 * s;
  const sway = Math.sin(t * 0.8) * 0.05;
  const pt = (p) => ({ x: Math.sin(p * Math.PI * 1.5) * 5.2 * s * (1 - p * 0.35), y: -p * H });
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(cx, cy);
  ctx.rotate(sway);
  // Aura de pavor (crece con el ojo).
  const aura = ctx.createRadialGradient(0, -H * 0.62, 0, 0, -H * 0.62, 17 * s);
  aura.addColorStop(0, 'rgba(120,40,160,' + (0.20 * eye).toFixed(3) + ')');
  aura.addColorStop(1, 'rgba(120,40,160,0)');
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(0, -H * 0.62, 17 * s, 0, TAU); ctx.fill();
  // Sombra de contacto.
  ctx.fillStyle = 'rgba(6,4,12,0.35)';
  ctx.beginPath(); ctx.ellipse(0, 0, 6 * s, 1.6 * s, 0, 0, TAU); ctx.fill();
  // Cuerpo: serpiente que se eleva (segmentos de base ancha a cabeza angosta).
  for (let i = 0; i <= N; i++) {
    const p = i / N;
    const q = pt(p);
    const r = (5.6 - p * 4.2) * s;
    ctx.fillStyle = bodyD;
    ctx.beginPath(); ctx.ellipse(q.x, q.y, r + s * 0.5, r * 1.12 + s * 0.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(q.x, q.y, r, r * 1.12, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = bodyHi;
    ctx.beginPath(); ctx.ellipse(q.x - r * 0.5, q.y - r * 0.2, r * 0.4, r * 0.72, 0, 0, TAU); ctx.fill();
    // Borde luminoso frío para que la silueta resalte sobre la penumbra.
    ctx.strokeStyle = rim; ctx.lineWidth = Math.max(1, s * 0.3);
    ctx.beginPath(); ctx.ellipse(q.x, q.y, r, r * 1.12, 0, 0, TAU); ctx.stroke();
    if (i % 2 === 0) { ctx.fillStyle = fleck; ctx.beginPath(); ctx.arc(q.x + r * 0.2, q.y, r * 0.18, 0, TAU); ctx.fill(); }
  }
  // Lluvia de código (piel digital, matrix): dashes verdes que caen por el
  // cuerpo, intensidad por `eye`, se apagan al disolverse.
  if (eye > 0.05) {
    for (let c = 0; c < 6; c++) {
      const cp = 0.12 + c * 0.15;
      const q = pt(cp);
      const r = (5.6 - cp * 4.2) * s;
      const colX = q.x + ((c % 3) - 1) * r * 0.5;
      const span = r * 2.0;
      const flow = ((t * 0.8 + c * 0.37) % 1 + 1) % 1;
      for (let k = 0; k < 3; k++) {
        const f = (flow + k / 3) % 1;
        const yy = q.y - r + f * span;
        ctx.fillStyle = 'rgba(130,255,180,' + (0.55 * eye * (1 - f)).toFixed(2) + ')';
        ctx.fillRect(colX, yy, Math.max(1, s * 0.35), Math.max(2, s * 0.85));
      }
    }
  }
  // Cresta de púas.
  ctx.fillStyle = fleck;
  for (let i = 5; i <= N - 1; i++) {
    const p = i / N, q = pt(p), r = (5.6 - p * 4.2) * s;
    ctx.beginPath();
    ctx.moveTo(q.x - r * 0.2, q.y - r);
    ctx.lineTo(q.x, q.y - r - 1.4 * s);
    ctx.lineTo(q.x + r * 0.5, q.y - r * 0.6);
    ctx.closePath(); ctx.fill();
  }
  // Cabeza (cuña angular hacia la derecha).
  const head = pt(1);
  ctx.fillStyle = bodyD;
  ctx.beginPath();
  ctx.moveTo(head.x - 3.2 * s, head.y + 1.6 * s);
  ctx.lineTo(head.x - 1.6 * s, head.y - 3.0 * s);
  ctx.lineTo(head.x + 4.8 * s, head.y - 1.3 * s);
  ctx.lineTo(head.x + 1.4 * s, head.y + 2.4 * s);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(head.x - 2.7 * s, head.y + 1.2 * s);
  ctx.lineTo(head.x - 1.2 * s, head.y - 2.5 * s);
  ctx.lineTo(head.x + 4.2 * s, head.y - 1.2 * s);
  ctx.lineTo(head.x + 1.1 * s, head.y + 2.0 * s);
  ctx.closePath(); ctx.fill();
  // Ceja/cresta sobre el ojo (mirada amenazante).
  ctx.fillStyle = fleck;
  ctx.beginPath();
  ctx.moveTo(head.x - 0.6 * s, head.y - 2.0 * s);
  ctx.lineTo(head.x + 2.6 * s, head.y - 1.6 * s);
  ctx.lineTo(head.x + 2.2 * s, head.y - 0.8 * s);
  ctx.lineTo(head.x - 0.4 * s, head.y - 1.2 * s);
  ctx.closePath(); ctx.fill();
  // Ojo: glare + iris + pupila vertical.
  const ex = head.x + 1.0 * s, ey = head.y - 0.4 * s;
  if (eye > 0.02) {
    const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 11 * s * (0.5 + eye));
    g.addColorStop(0, 'rgba(255,150,70,' + (0.65 * eye).toFixed(3) + ')');
    g.addColorStop(0.5, 'rgba(255,90,40,' + (0.26 * eye).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(255,90,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(ex, ey, 11 * s * (0.5 + eye), 0, TAU); ctx.fill();
  }
  const pulse = 0.85 + 0.15 * Math.sin(t * 4);
  ctx.fillStyle = eyeCol;
  ctx.beginPath(); ctx.ellipse(ex, ey, 1.9 * s, 2.4 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = eyeHot;
  ctx.beginPath(); ctx.ellipse(ex, ey, 1.3 * s * pulse, 1.7 * s * pulse, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#1a0a08';
  ctx.beginPath(); ctx.ellipse(ex, ey, 0.42 * s, 1.85 * s, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

// AiOrb: un orbe de IA. Anillo segmentado que rota, núcleo que late, puntos en
// órbita y un iris tipo lente. `color` lo tiñe, `alpha` lo desvanece, `_t`
// anima. Flota (no se apoya en el piso). Reutilizable como "una IA" en escena.
export function drawAiOrb(ctx, prop) {
  const s = prop.scale || 3;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  const t = prop._t || 0;
  const col = prop.color || '#4fd0e0';
  const colD = mixColors(col, '#000000', 0.45);
  const colHot = mixColors(col, '#ffffff', 0.55);
  const TAU = Math.PI * 2;
  const pulse = 0.85 + 0.15 * Math.sin(t * 3);
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(cx, cy);
  // Resplandor.
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 6 * s);
  g.addColorStop(0, mixColors(col, '#ffffff', 0.2));
  g.addColorStop(1, 'rgba(79,208,224,0)');
  ctx.save(); ctx.globalAlpha *= 0.3 * pulse; ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, 6 * s, 0, TAU); ctx.fill(); ctx.restore();
  // Anillo exterior.
  ctx.strokeStyle = colD; ctx.lineWidth = Math.max(1, s * 0.4);
  ctx.beginPath(); ctx.arc(0, 0, 3.0 * s, 0, TAU); ctx.stroke();
  // Anillo segmentado que rota.
  ctx.save(); ctx.rotate(t * 0.7);
  ctx.strokeStyle = colHot; ctx.lineWidth = Math.max(1, s * 0.5);
  for (let k = 0; k < 6; k++) {
    const a0 = k * TAU / 6 + 0.15;
    ctx.beginPath(); ctx.arc(0, 0, 3.7 * s, a0, a0 + 0.55); ctx.stroke();
  }
  ctx.restore();
  // Puntos en órbita.
  ctx.save(); ctx.rotate(-t * 0.9);
  ctx.fillStyle = colHot;
  for (let k = 0; k < 3; k++) {
    const ang = k * TAU / 3;
    ctx.beginPath(); ctx.arc(Math.cos(ang) * 4.4 * s, Math.sin(ang) * 4.4 * s, 0.5 * s, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // Núcleo (lente) con iris.
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, 2.0 * s, 0, TAU); ctx.fill();
  ctx.fillStyle = colD; ctx.beginPath(); ctx.arc(0, 0, 1.5 * s, 0, TAU); ctx.fill();
  ctx.strokeStyle = colHot; ctx.lineWidth = Math.max(1, s * 0.25);
  for (let k = 0; k < 6; k++) {
    const ang = k * TAU / 6 + t * 0.3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * 0.7 * s, Math.sin(ang) * 0.7 * s);
    ctx.lineTo(Math.cos(ang) * 1.4 * s, Math.sin(ang) * 1.4 * s);
    ctx.stroke();
  }
  ctx.fillStyle = colHot; ctx.beginPath(); ctx.arc(0, 0, 0.7 * s * pulse, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-0.3 * s, -0.3 * s, 0.28 * s, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawNotebook(ctx, prop) {
  const s = prop.scale || 3;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  const TAU = Math.PI * 2;
  const cover = prop.color || '#3a5a8c';
  const coverD = mixColors(cover, '#000000', 0.42);
  const coverL = mixColors(cover, '#ffffff', 0.30);
  const paper = '#f3ead5';
  const paperSh = mixColors(paper, '#000000', 0.16);
  const ink = mixColors(cover, '#ffffff', 0.55);
  const metal = '#c7ccd6';
  const metalD = '#8b909c';
  const glow = prop.glow == null ? 0 : Math.max(0, Math.min(1, prop.glow));
  const t = prop._t || 0;
  const hw = 5.6 * s, hh = 7.0 * s, r = 1.1 * s;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(cx, cy);
  // Resplandor cuando la IA procesa (glow 0..1): halo ámbar/cian.
  if (glow > 0.01) {
    const pulse = 0.78 + 0.22 * Math.sin(t * 3);
    const g = ctx.createRadialGradient(0, 0, hw * 0.4, 0, 0, hw * 2.6);
    g.addColorStop(0, `rgba(79,208,224,${0.32 * glow * pulse})`);
    g.addColorStop(1, 'rgba(79,208,224,0)');
    ctx.save(); ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, hw * 2.6, 0, TAU); ctx.fill(); ctx.restore();
  }
  // Sombra de contacto.
  ctx.save(); ctx.globalAlpha *= 0.26; ctx.fillStyle = '#000000';
  ctx.beginPath(); ctx.ellipse(0.6 * s, hh + 1.0 * s, hw * 1.05, 1.5 * s, 0, 0, TAU); ctx.fill(); ctx.restore();
  // Pila de páginas (canto derecho, levemente desplazado).
  ctx.fillStyle = paperSh;
  ctx.beginPath(); ctx.roundRect(-hw + 1.2 * s, -hh + 0.7 * s, hw * 2, hh * 2, r); ctx.fill();
  ctx.fillStyle = paper;
  ctx.beginPath(); ctx.roundRect(-hw + 0.7 * s, -hh + 0.4 * s, hw * 2 - 0.2 * s, hh * 2 - 0.2 * s, r); ctx.fill();
  // Tapa.
  ctx.fillStyle = cover;
  ctx.beginPath(); ctx.roundRect(-hw, -hh, hw * 2, hh * 2, r); ctx.fill();
  // Sombra interna inferior y brillo superior de la tapa.
  ctx.save(); ctx.globalAlpha *= 0.5; ctx.fillStyle = coverD;
  ctx.beginPath(); ctx.roundRect(-hw, hh - 2.2 * s, hw * 2, 2.2 * s, r); ctx.fill(); ctx.restore();
  ctx.save(); ctx.globalAlpha *= 0.5; ctx.fillStyle = coverL;
  ctx.beginPath(); ctx.roundRect(-hw + 0.6 * s, -hh + 0.5 * s, hw * 2 - 1.2 * s, 1.1 * s, r * 0.6); ctx.fill(); ctx.restore();
  // Etiqueta de título sobre la tapa.
  const lw = hw * 1.5, lh = hh * 0.62;
  ctx.fillStyle = paper;
  ctx.beginPath(); ctx.roundRect(-lw / 2 + 0.8 * s, -hh + 1.8 * s, lw, lh, 0.5 * s); ctx.fill();
  ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, 0.18 * s);
  for (let i = 0; i < 3; i++) {
    const ly = -hh + 2.7 * s + i * 1.0 * s;
    ctx.globalAlpha *= 1;
    ctx.beginPath();
    ctx.moveTo(-lw / 2 + 1.8 * s, ly);
    ctx.lineTo(lw / 2 - (i === 2 ? 2.6 * s : 0.8 * s), ly);
    ctx.stroke();
  }
  // Espiral metálica en el canto izquierdo.
  const rings = 7;
  for (let k = 0; k < rings; k++) {
    const ry = -hh + 1.0 * s + (k + 0.5) * (hh * 2 - 2.0 * s) / rings;
    ctx.strokeStyle = metalD; ctx.lineWidth = Math.max(1.4, 0.5 * s);
    ctx.beginPath(); ctx.ellipse(-hw, ry, 1.3 * s, 0.55 * s, 0, Math.PI * 0.15, Math.PI * 1.35); ctx.stroke();
    ctx.strokeStyle = metal; ctx.lineWidth = Math.max(1, 0.28 * s);
    ctx.beginPath(); ctx.ellipse(-hw - 0.15 * s, ry - 0.12 * s, 1.3 * s, 0.55 * s, 0, Math.PI * 0.2, Math.PI * 1.1); ctx.stroke();
  }
  // Marca / elástico vertical hacia la derecha.
  ctx.fillStyle = mixColors(cover, '#000000', 0.2);
  ctx.beginPath(); ctx.roundRect(hw - 2.2 * s, -hh, 0.9 * s, hh * 2, 0); ctx.fill();
  ctx.restore();
}

export function drawGenially(ctx, prop) {
  const s = prop.scale || 3;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  const TAU = Math.PI * 2;
  const D2R = Math.PI / 180;
  const R = 9 * s;
  const navy = prop.color || '#0d1b2e';
  const ringStart = -Math.PI / 2 + (prop.spin || 0);
  // Rampa arcoíris (sentido del logo: cálidos arriba, fríos abajo).
  const stops = ['#f6b53a', '#ff7eb3', '#ff5e7e', '#c850c0', '#7b6cff', '#4f9dff', '#3ddc97', '#bfe06a'];
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(cx, cy);
  // Halo opcional cuando glow > 0.
  const glow = prop.glow == null ? 0 : Math.max(0, Math.min(1, prop.glow));
  if (glow > 0.01) {
    const g = ctx.createRadialGradient(0, 0, R * 0.6, 0, 0, R * 1.5);
    g.addColorStop(0, `rgba(255,126,179,${0.35 * glow})`);
    g.addColorStop(1, 'rgba(255,126,179,0)');
    ctx.save(); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 1.5, 0, TAU); ctx.fill(); ctx.restore();
  }
  // Sombra suave para despegar de cualquier fondo.
  const sh = ctx.createRadialGradient(0, R * 0.12, R * 0.6, 0, R * 0.12, R * 1.28);
  sh.addColorStop(0, 'rgba(10,15,30,0.26)');
  sh.addColorStop(1, 'rgba(10,15,30,0)');
  ctx.save(); ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, R * 0.12, R * 1.28, 0, TAU); ctx.fill(); ctx.restore();
  // Aro arcoíris. Con conic-gradient queda perfecto y sin costuras; si el
  // navegador no lo soporta, se cae al método por segmentos de arco.
  ctx.save();
  if (typeof ctx.createConicGradient === 'function') {
    const cg = ctx.createConicGradient(ringStart, 0, 0);
    for (let i = 0; i < stops.length; i++) cg.addColorStop(i / stops.length, stops[i]);
    cg.addColorStop(1, stops[0]);
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU, false);
    ctx.arc(0, 0, R * 0.80, 0, TAU, true);
    ctx.fill();
  } else {
    const N = 180, rRing = R * 0.90;
    ctx.lineCap = 'butt'; ctx.lineWidth = R * 0.21;
    for (let k = 0; k < N; k++) {
      const f = k / N, seg = f * stops.length, i = Math.floor(seg) % stops.length, t = seg - Math.floor(seg);
      ctx.strokeStyle = mixColors(stops[i], stops[(i + 1) % stops.length], t);
      ctx.beginPath(); ctx.arc(0, 0, rRing, ringStart + f * TAU, ringStart + (k + 1.45) / N * TAU); ctx.stroke();
    }
  }
  ctx.restore();
  // Disco navy con leve volumen.
  const gd = ctx.createRadialGradient(-R * 0.22, -R * 0.22, R * 0.08, 0, 0, R * 0.82);
  gd.addColorStop(0, mixColors(navy, '#ffffff', 0.10));
  gd.addColorStop(1, navy);
  ctx.fillStyle = gd;
  ctx.beginPath(); ctx.arc(0, 0, R * 0.80, 0, TAU); ctx.fill();
  // Espiral blanca (la "C"/e de Genially): anillo grueso CIRCULAR con la boca a la
  // derecha, INCLINADO (la punta superior sube hacia la 1 en punto y la inferior
  // baja hacia las 3-4). Es una rotación rígida: la curva de arriba sigue siendo
  // el espejo de la de abajo, solo que ladeada como en el logo.
  const rR = R * 0.48, wR = R * 0.21;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = wR; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, rR, 17 * D2R, 307 * D2R, false); // C ladeada ~18° en antihorario
  ctx.stroke();
  // Punto (el ojo), abajo a la derecha del centro.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(rR * 0.31, rR * 0.11, wR * 0.60, 0, TAU); ctx.fill();
  ctx.restore();
}

// Pasture: el prado común, protagonista de la tragedia de los comunes. Un manto
// de hierba con tréboles, ranúnculos y dientes de león sobre una banda de suelo.
// `wear` (0..1) lo agota: los claros de tierra nacen en el centro (donde más
// pisa el rebaño) y crecen hacia los bordes hasta fusionarse; las flores se
// cierran y desaparecen conforme su mata muere. Animable con tween "id.wear".
// El verde que falta deja ver el piso `earth` de la escena. `w` ancho, `depth`
// fondo (px), `color` el verde base, `_swayT` el vaivén. (x, y) = borde frontal.
export function drawPasture(ctx, prop) {
  const s = prop.scale || 3;
  const cx = Math.round(prop.x);
  const baseY = Math.round(prop.y);
  const w = prop.w || 600;
  const depth = prop.depth || 78;
  const wear = Math.max(0, Math.min(1, prop.wear == null ? 0 : prop.wear));
  const t = prop._swayT || 0;
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  // Verdes y flores.
  const gDark = mixColors(prop.color || '#5f9e57', '#1f3a23', 0.45);
  const gMid = prop.color || '#5f9e57';
  const gLite = mixColors(prop.color || '#5f9e57', '#d8e89a', 0.5);
  const dry = '#9c8a4e';                 // hierba reseca al borde de morir
  const dirt = '#6b4a2e';                // mota de tierra en el claro
  const ranunc = '#F4AC1D';              // ranúnculo (amarillo)
  const dande = '#f6e27a';               // diente de león
  const trebol = '#e9efd6';              // trébol (blanco verdoso)
  // Hash determinista por celda (mismo patrón siempre, sin Math.random).
  const hash = (i, j) => {
    const v = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  const left = cx - w / 2;
  const stepX = 15;                      // separación de matas (px)
  const stepY = 13;
  const cols = Math.floor(w / stepX);
  const rows = Math.max(2, Math.floor(depth / stepY));
  ctx.save();
  ctx.globalAlpha *= a;
  for (let j = 0; j < rows; j++) {
    // Perspectiva suave: las filas del fondo (j chico) van más arriba y un
    // pelín más pequeñas y juntas que las del frente.
    const rowFrac = j / (rows - 1 || 1);            // 0 fondo .. 1 frente
    const py = baseY - depth + rowFrac * depth;
    const persp = 0.74 + 0.26 * rowFrac;            // tamaño por profundidad
    for (let i = 0; i < cols; i++) {
      const h0 = hash(i, j);
      const h1 = hash(i + 31, j + 17);
      const jitterX = (h0 - 0.5) * stepX * 0.9;
      const jitterY = (h1 - 0.5) * stepY * 0.7;
      const gx = left + (i + 0.5) * stepX + jitterX;
      const gy = py + jitterY;
      // Distancia normalizada al centro del prado: el desgaste avanza desde
      // el centro (más pisoteado) hacia los bordes. Mezclo el radio con ruido
      // para que el borde del claro sea orgánico y los parches se fusionen.
      const nx = (gx - cx) / (w / 2);                 // -1..1
      const ny = (rowFrac - 0.62) / 0.62;             // frente pisa más
      const radial = Math.min(1, Math.sqrt(nx * nx * 0.85 + ny * ny * 0.5));
      const death = radial * 0.62 + h0 * 0.38;        // umbral de muerte 0..1
      const blade = persp * s;
      if (wear >= death) {
        // Mata muerta: claro de tierra. Casi siempre transparente (se ve el
        // piso earth); de vez en cuando una brizna reseca o una mota de tierra
        // para que el erial no quede liso.
        if (h1 < 0.16) {
          ctx.fillStyle = dry;
          ctx.fillRect(Math.round(gx), Math.round(gy - blade), Math.max(1, Math.round(blade * 0.7)), Math.max(1, Math.round(blade)));
        } else if (h1 > 0.9) {
          ctx.fillStyle = dirt;
          ctx.fillRect(Math.round(gx - blade * 0.4), Math.round(gy - blade * 0.4), Math.max(1, Math.round(blade * 0.9)), Math.max(1, Math.round(blade * 0.5)));
        }
        continue;
      }
      // Mata viva: penacho en tres tonos (base, cuerpo, punta) con la punta
      // inclinada por el viento. Tres rects para que el prado entero no pese.
      const sway = Math.sin(t + (i + j) * 0.6) * blade * 0.55;
      const tall = (1.5 + h1 * 1.3) * blade;          // altura del penacho
      ctx.fillStyle = gDark;
      ctx.fillRect(Math.round(gx - blade * 0.75), Math.round(gy - blade * 0.5), Math.max(1, Math.round(blade * 1.5)), Math.max(1, Math.round(blade * 0.6)));
      ctx.fillStyle = gMid;
      ctx.fillRect(Math.round(gx - blade * 0.5), Math.round(gy - tall), Math.max(1, Math.round(blade)), Math.max(1, Math.round(tall)));
      ctx.fillStyle = gLite;
      ctx.fillRect(Math.round(gx - blade * 0.4 + sway), Math.round(gy - tall), Math.max(1, Math.round(blade * 0.8)), Math.max(1, Math.round(blade * 0.7)));
      // Flor: una fracción de las matas. Se cierra (capullo) cuando su muerte
      // se acerca al desgaste actual, y desaparece al morir (arriba, continue).
      if (h0 > 0.72) {
        const fx = Math.round(gx + sway * 0.5);
        const fy = Math.round(gy - tall - blade * 0.4);
        const closing = (death - wear) < 0.12;       // a punto de morir: capullo
        const kind = h1 < 0.4 ? ranunc : (h1 < 0.72 ? dande : trebol);
        if (closing) {
          // Capullo cerrado (verde con punta del color).
          ctx.fillStyle = gDark;
          ctx.fillRect(fx, fy, Math.max(1, Math.round(blade * 0.8)), Math.max(1, Math.round(blade * 1.1)));
          ctx.fillStyle = kind;
          ctx.fillRect(fx, fy, Math.max(1, Math.round(blade * 0.8)), Math.max(1, Math.round(blade * 0.4)));
        } else {
          // Flor abierta: corola + corazón.
          const r = blade * 0.62;
          ctx.fillStyle = kind;
          ctx.fillRect(fx - Math.round(r), fy - Math.round(r), Math.max(1, Math.round(r * 2)), Math.max(1, Math.round(r * 2)));
          ctx.fillStyle = kind === trebol ? '#c7d6a0' : '#b9791a';
          ctx.fillRect(fx - Math.round(r * 0.3), fy - Math.round(r * 0.3), Math.max(1, Math.round(r * 0.7)), Math.max(1, Math.round(r * 0.7)));
        }
      }
    }
  }
  ctx.restore();
}

// Sheep: oveja del rebaño común. Cuerpo de lana en tres tonos con textura de
// vellón, cabeza oscura, orejas y cuatro patas. `color` tiñe la lana, `dir`
// espeja, y `_t` da una respiración suave. (x, y) = los pies.
export function drawSheep(ctx, prop) {
  const s = prop.scale || 3;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const wool = prop.color || '#ece4d3';
  const woolHi = mixColors(wool, '#ffffff', 0.4);
  const woolSh = mixColors(wool, '#6e5f44', 0.4);
  const face = '#3b3328';
  const faceHi = '#52483a';
  const hoof = '#241e16';
  const eye = '#0e0a06';
  const dir = prop._dir == null ? (prop.dir || 1) : prop._dir;
  const t = prop._t || 0;
  const breath = Math.sin(t * 1.6) * 0.5;          // sube/baja del lomo, sutil
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= a;
  const px = (gx, gy, gw, gh, c) => {
    ctx.fillStyle = c;
    const sx = cx + (gx * dir) * s - (dir < 0 ? gw * s : 0);
    ctx.fillRect(sx, cy + (gy + breath * (gy < -1 ? 1 : 0)) * s, gw * s, gh * s);
  };
  // Sombra de contacto.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(cx - 5 * s, cy - s * 0.2, 10 * s, s * 0.7);
  // Patas (cuatro, oscuras con pezuña).
  px(-3, -2, 1, 2, face); px(-3, 0, 1, 1, hoof);
  px(-1, -2, 1, 2, face); px(-1, 0, 1, 1, hoof);
  px(2, -2, 1, 2, face);  px(2, 0, 1, 1, hoof);
  px(4, -2, 1, 2, face);  px(4, 0, 1, 1, hoof);
  // Cuerpo de lana (volumen redondeado).
  px(-4, -5, 8, 1, wool);
  px(-5, -6, 9, 1, wool);
  px(-5, -7, 8, 1, wool);
  px(-4, -8, 6, 1, wool);
  px(-4, -4, 8, 2, woolSh);          // panza en sombra
  // Textura de vellón: rizos de luz y sombra salpicados.
  px(-4, -7, 1, 1, woolHi); px(-1, -8, 1, 1, woolHi); px(2, -7, 1, 1, woolHi);
  px(-3, -6, 1, 1, woolHi); px(0, -6, 1, 1, woolHi); px(3, -6, 1, 1, woolHi);
  px(-2, -5, 1, 1, woolSh); px(1, -5, 1, 1, woolSh); px(-4, -6, 1, 1, woolSh);
  // Cola corta (lana).
  px(-6, -6, 1, 2, wool); px(-6, -6, 1, 1, woolHi);
  // Cabeza oscura inclinada al pasto (al frente, lado +dir).
  px(4, -7, 3, 1, face);
  px(4, -6, 4, 2, face);
  px(5, -7, 2, 1, faceHi);            // frente con luz
  px(7, -5, 1, 1, face);              // hocico
  // Oreja.
  px(4, -8, 1, 1, face); px(3, -7, 1, 1, faceHi);
  // Ojo.
  px(6, -6, 1, 1, eye);
  ctx.restore();
}

// Fence: la primera cerca, símbolo del cierre (la regla que los pastores se
// dan). Postes de madera y dos travesaños con veta, sombra y luz. `panels`
// (gaps entre postes), `color` la madera. (x, y) = base, centrada en x.
export function drawFence(ctx, prop) {
  const s = prop.scale || 3.5;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const panels = Math.max(1, Math.round(prop.panels || 3));
  const wood = prop.color || '#9a6f3e';
  const woodHi = mixColors(wood, '#e7c98f', 0.5);
  const woodSh = mixColors(wood, '#3a2814', 0.55);
  const grain = mixColors(wood, '#3a2814', 0.3);
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  const panelW = 7;                       // ancho de cada vano en celdas
  const totalCells = panels * panelW;
  const left = cx - (totalCells / 2) * s;
  const postH = 9;                        // alto del poste en celdas
  const rect = (gx, gy, gw, gh, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(left + gx * s), Math.round(cy + gy * s), Math.round(gw * s), Math.round(gh * s));
  };
  ctx.save();
  ctx.globalAlpha *= a;
  // Sombra al pie.
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(Math.round(left - s), Math.round(cy - s * 0.3), Math.round((totalCells + 2) * s), Math.round(s * 0.8));
  // Travesaños (dos), detrás de los postes.
  for (const ry of [-6, -3]) {
    rect(0, ry, totalCells, 1, wood);
    rect(0, ry, totalCells, 0.35, woodHi);          // luz arriba
    rect(0, ry + 0.7, totalCells, 0.3, woodSh);      // sombra abajo
    // Vetas cada par de celdas.
    for (let g = 2; g < totalCells; g += 3) rect(g, ry + 0.2, 0.25, 0.6, grain);
  }
  // Postes (en cada extremo de vano).
  for (let p = 0; p <= panels; p++) {
    const gx = p * panelW;
    rect(gx, -postH, 1, postH, wood);
    rect(gx, -postH, 0.4, postH, woodHi);            // canto iluminado
    rect(gx + 0.7, -postH, 0.3, postH, woodSh);       // canto en sombra
    rect(gx, -postH, 1, 0.5, woodHi);                 // tope
    rect(gx - 0.15, -postH - 0.4, 1.3, 0.5, woodSh);  // capuchón
  }
  ctx.restore();
}

// Turtle: la tortuga de la paradoja de Zenón. Caparazón en domo con escudos,
// piel verde-amarilla, cuatro patas y una cabeza que asoma y se mece con `_t`.
// `color` tiñe el caparazón, `dir` espeja (1 mira a la derecha), `alpha`. La
// lentitud es del guion (se mueve por tween de x), no del drawer. (x, y) = pies.
export function drawTurtle(ctx, prop) {
  const s = prop.scale || 2.8;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const shell = prop.color || '#6f8f4a';
  const shellHi = mixColors(shell, '#e6e89a', 0.5);
  const shellMid = mixColors(shell, '#dfe08e', 0.22);
  const shellDk = mixColors(shell, '#2c3a1c', 0.5);
  const scute = mixColors(shell, '#222c14', 0.7);     // líneas entre escudos
  const skin = mixColors(shell, '#d6c06a', 0.6);       // piel amarillo-verdosa
  const skinHi = mixColors(skin, '#ffffff', 0.3);
  const skinDk = mixColors(skin, '#3a3018', 0.45);
  const eye = '#15100a';
  const dir = prop._dir == null ? (prop.dir || 1) : prop._dir;
  const t = prop._t || 0;
  const headOut = (Math.sin(t * 1.2) * 0.5 + 0.5);     // 0..1 cabeza asomando
  const legPhase = Math.sin(t * 2.0);                   // balanceo de patas
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= a;
  const px = (gx, gy, gw, gh, c) => {
    ctx.fillStyle = c;
    const sx = cx + (gx * dir) * s - (dir < 0 ? gw * s : 0);
    ctx.fillRect(sx, cy + gy * s, gw * s, gh * s);
  };
  // Sombra de contacto.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(cx - 6 * s, cy - s * 0.2, 12 * s, s * 0.7);
  // Patas traseras y delanteras (oscuras, con leve balanceo).
  const lp = Math.round(legPhase * 0.5);
  px(-5, -2, 1.4, 2, skin);  px(-5, 0 + 0, 1.4, 0.6, skinDk);            // trasera lejana
  px(-3.4 + lp * 0.2, -2, 1.4, 2, skin); px(-3.4 + lp * 0.2, 0, 1.4, 0.6, skinDk);
  px(2, -2, 1.4, 2, skin);   px(2, 0, 1.4, 0.6, skinDk);
  px(3.7 - lp * 0.2, -2, 1.5, 2, skinHi); px(3.7 - lp * 0.2, 0, 1.5, 0.6, skinDk); // delantera
  // Cola corta atrás (lado -dir).
  px(-6.4, -3.2, 1.2, 1, skin);
  px(-6.8, -3.0, 0.6, 0.8, skinDk);
  // Cabeza al frente (lado +dir), asomando segun headOut, con cuello.
  const hx = 4.6 + headOut * 1.4;
  px(hx - 0.4, -4.4, 1.6, 1.8, skin);                  // cuello/cabeza
  px(hx + 0.5, -4.4, 1.4, 1.6, skin);                  // morro
  px(hx + 0.4, -4.5, 1.3, 0.7, skinHi);                // luz sobre la cabeza
  px(hx + 1.7, -3.7, 0.5, 0.5, skinDk);                // punta del hocico
  px(hx + 0.9, -3.9, 0.7, 0.7, eye);                   // ojo
  px(hx + 1.0, -4.0, 0.3, 0.3, '#fdfdf5');             // brillo del ojo
  // Caparazón: domo en cuatro tonos con borde, cúpula y escudos.
  px(-5.2, -4.2, 10.4, 1.2, shellDk);                  // reborde inferior (marginales)
  px(-5.0, -5.2, 10.0, 1.1, shell);
  px(-4.4, -6.2, 8.8, 1.1, shellMid);
  px(-3.4, -7.1, 6.8, 1.0, shell);
  px(-2.2, -7.9, 4.4, 1.0, shellHi);                   // cúpula con luz
  px(-1.0, -8.4, 2.0, 0.7, shellHi);
  // Escudos del caparazón (líneas oscuras radiales + costuras).
  px(-0.2, -8.3, 0.45, 4.0, scute);                    // costura central
  px(-3.0, -6.6, 0.4, 2.3, scute);
  px(2.6, -6.6, 0.4, 2.3, scute);
  px(-4.2, -5.1, 0.4, 1.0, scute);
  px(3.8, -5.1, 0.4, 1.0, scute);
  px(-2.0, -7.6, 2.0, 0.4, scute);                     // arco superior
  px(0.2, -7.6, 1.9, 0.4, scute);
  // Pequeño highlight especular en la cúpula.
  px(-1.6, -7.7, 0.8, 0.5, mixColors(shellHi, '#ffffff', 0.45));
  ctx.restore();
}

// Grinder: la moledora. Caja pesada de hierro con embudo en la boca de arriba,
// manivela al costado, dos engranajes que muerden al frente y una ranura de
// salida abajo. (x, y) es la base (apoya en el suelo). `color` tiñe el hierro
// (las luces y sombras se derivan de él con mixColors); `crank` (radianes) gira
// la manivela y los engranajes; `glow` (0..1) enciende la luz interna que se
// filtra por la boca, las junturas y la ranura; `alpha` la desvanece. Nace para
// la escena del trueque: una respuesta sale por la ranura, y la luz de quien
// preguntó entra por ella. La luz proyectada al mundo la pone un `focus` o un
// `light` de la escena (en oscuridad el glow propio solo se ve dentro del haz).
export function drawGrinder(ctx, prop) {
  const s = prop.scale || 4;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);            // piso (donde apoyan las patas)
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  const TAU = Math.PI * 2;
  const metal = prop.color || '#41506e';
  const mTop  = mixColors(metal, '#ffffff', 0.30);
  const mMid  = mixColors(metal, '#ffffff', 0.12);
  const mDark = mixColors(metal, '#000000', 0.34);
  const mDeep = mixColors(metal, '#000000', 0.56);
  const mouth = '#0a0d18';
  const amber = '#F4AC1D';
  const crank = prop.crank || 0;
  const glow = prop.glow == null ? 0 : Math.max(0, Math.min(1, prop.glow));
  const t = prop._t || 0;
  const pulse = 0.80 + 0.20 * Math.sin(t * 5);
  const gA = glow * pulse;                   // intensidad efectiva del encendido
  const lit = glow > 0.30;
  const px = (gx, gy, gw, gh, c) => { ctx.fillStyle = c; ctx.fillRect(cx + gx * s, cy + gy * s, Math.ceil(gw * s) + 1, Math.ceil(gh * s) + 1); };

  ctx.save();
  ctx.globalAlpha *= a;

  // Sombra de contacto en el piso.
  ctx.save();
  ctx.globalAlpha *= 0.32;
  ctx.fillStyle = '#04050c';
  ctx.beginPath(); ctx.ellipse(cx, cy, 9.4 * s, 1.7 * s, 0, 0, TAU); ctx.fill();
  ctx.restore();

  // Halo cálido cuando se enciende (la luz de las tripas).
  if (glow > 0.01) {
    const g = ctx.createRadialGradient(cx, cy - 7 * s, 1 * s, cx, cy - 7 * s, 17 * s);
    g.addColorStop(0, `rgba(244,172,29,${(0.42 * gA).toFixed(3)})`);
    g.addColorStop(0.5, `rgba(244,172,29,${(0.16 * gA).toFixed(3)})`);
    g.addColorStop(1, 'rgba(244,172,29,0)');
    ctx.save(); ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy - 7 * s, 17 * s, 0, TAU); ctx.fill(); ctx.restore();
  }

  // --- Patas ---
  px(-7, -1.7, 2.6, 1.9, mDeep);
  px(4.4, -1.7, 2.6, 1.9, mDeep);
  px(-7, -1.7, 2.6, 0.5, mDark);
  px(4.4, -1.7, 2.6, 0.5, mDark);

  // --- Cuerpo: caja de hierro con biseles ---
  px(-8, -13.5, 16, 12, mDark);              // silueta/base
  px(-7.4, -13, 14.8, 11, metal);            // cara
  px(-7.4, -13, 14.8, 0.8, mTop);            // luz superior
  px(-7.4, -3.2, 14.8, 0.9, mDeep);          // sombra inferior
  px(-7.4, -13, 0.9, 11, mTop);              // bisel izquierdo (luz)
  px(6.5, -13, 0.9, 11, mDeep);              // bisel derecho (sombra)
  // Vetas del metal cepillado (en las franjas laterales, fuera de la cavidad).
  for (let gy = -11; gy <= -5; gy += 2) { px(-6.6, gy, 1.6, 0.26, mDark); px(5.0, gy, 1.6, 0.26, mDark); }
  // Junturas que filtran luz cuando se enciende.
  if (glow > 0.01) {
    ctx.save(); ctx.globalAlpha *= Math.min(1, gA);
    px(-7.4, -7.0, 14.8, 0.2, amber);
    px(-7.4, -10.4, 14.8, 0.16, amber);
    ctx.restore();
  }

  // --- Embudo en la boca de arriba (trapecio que se ensancha hacia arriba) ---
  for (let i = 0; i < 6; i++) {
    const yy = -13.4 - i;                     // de la boca del cuerpo hacia arriba
    const f = i / 5;
    const hw = 3.4 + f * 3.4;                  // medio ancho: 3.4 abajo .. 6.8 arriba
    px(-hw, yy, hw * 2, 1.06, i === 5 ? mTop : (i % 2 ? mMid : metal));
    const mw = hw - 0.95;                      // boca oscura interior
    px(-mw, yy, mw * 2, 1.06, mouth);
  }
  px(-6.9, -19.4, 13.8, 0.7, mTop);           // labio superior con luz
  px(-6.9, -19.4, 0.7, 0.9, mTop);
  px(6.2, -19.4, 0.7, 0.9, mDeep);
  if (glow > 0.01) {                           // la boca brilla al moler
    ctx.save(); ctx.globalAlpha *= Math.min(1, gA);
    const gm = ctx.createLinearGradient(0, cy - 19 * s, 0, cy - 13 * s);
    gm.addColorStop(0, 'rgba(244,172,29,0)');
    gm.addColorStop(1, 'rgba(255,243,201,0.85)');
    ctx.fillStyle = gm;
    ctx.fillRect(cx - 3.0 * s, cy - 16.5 * s, 6.0 * s, 3.5 * s);
    ctx.restore();
  }

  // --- Cavidad de engranajes (ventana al interior) ---
  ctx.fillStyle = mouth;
  ctx.beginPath(); ctx.roundRect(cx - 5.2 * s, cy - 11.6 * s, 10.4 * s, 6.4 * s, 1.1 * s); ctx.fill();
  if (glow > 0.01) {
    ctx.save(); ctx.globalAlpha *= Math.min(1, gA);
    const gc = ctx.createRadialGradient(cx, cy - 8.4 * s, 0.5 * s, cx, cy - 8.4 * s, 6 * s);
    gc.addColorStop(0, 'rgba(255,243,201,0.92)');
    gc.addColorStop(0.6, 'rgba(244,172,29,0.45)');
    gc.addColorStop(1, 'rgba(244,172,29,0)');
    ctx.fillStyle = gc;
    ctx.beginPath(); ctx.roundRect(cx - 5.2 * s, cy - 11.6 * s, 10.4 * s, 6.4 * s, 1.1 * s); ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = mDeep; ctx.lineWidth = Math.max(1, s * 0.3);
  ctx.beginPath(); ctx.roundRect(cx - 5.2 * s, cy - 11.6 * s, 10.4 * s, 6.4 * s, 1.1 * s); ctx.stroke();

  // Dos engranajes que muerden (giran con la manivela, en sentidos opuestos).
  const gear = (gx, gy, rCells, teeth, ang) => {
    const ox = cx + gx * s, oy = cy + gy * s, r = rCells * s;
    ctx.save(); ctx.translate(ox, oy); ctx.rotate(ang);
    ctx.fillStyle = mDeep;
    const tw = r * 0.40, tl = r * 0.34;
    for (let k = 0; k < teeth; k++) { ctx.save(); ctx.rotate(k * TAU / teeth); ctx.fillRect(-tw / 2, -r - tl * 0.55, tw, tl); ctx.restore(); }
    ctx.fillStyle = mMid; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.fillStyle = mDark; ctx.beginPath(); ctx.arc(0, 0, r * 0.60, 0, TAU); ctx.fill();
    ctx.strokeStyle = mTop; ctx.lineWidth = Math.max(1, s * 0.22);
    for (let k = 0; k < 4; k++) { const aa = k * Math.PI / 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(aa) * r * 0.52, Math.sin(aa) * r * 0.52); ctx.stroke(); }
    ctx.fillStyle = lit ? amber : mTop; ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, TAU); ctx.fill();
    ctx.restore();
  };
  gear(-2.2, -8.4, 2.7, 9, crank);
  gear(2.1, -7.2, 1.9, 8, -crank * 1.42);

  // --- Ranura de salida + bandeja al frente ---
  px(-4.2, -3.6, 8.4, 1.0, mouth);
  px(-4.2, -3.6, 8.4, 0.28, mDeep);
  px(-4.8, -2.7, 9.6, 0.8, mDark);            // labio/bandeja que sobresale
  px(-4.8, -2.7, 9.6, 0.3, mMid);
  if (glow > 0.01) {
    ctx.save(); ctx.globalAlpha *= Math.min(1, gA);
    px(-3.8, -3.5, 7.6, 0.7, amber);
    ctx.restore();
  }

  // Remaches en las esquinas del cuerpo.
  for (const [rx, ry] of [[-7.0, -12.6], [6.3, -12.6], [-7.0, -3.4], [6.3, -3.4]]) px(rx, ry, 0.7, 0.7, mDeep);

  // --- Manivela girable al costado derecho ---
  px(6.4, -9.2, 1.8, 2.6, mDark);             // placa de montaje
  px(6.4, -9.2, 1.8, 0.5, mMid);
  ctx.save();
  ctx.translate(cx + 8.4 * s, cy - 8.0 * s);  // pivote del eje
  ctx.rotate(crank);
  ctx.lineCap = 'round';
  ctx.strokeStyle = mDeep; ctx.lineWidth = Math.max(2, s * 0.6);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -3.6 * s); ctx.stroke();   // brazo radial
  ctx.strokeStyle = mMid; ctx.lineWidth = Math.max(1, s * 0.28);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -3.6 * s); ctx.stroke();
  ctx.strokeStyle = mDeep; ctx.lineWidth = Math.max(2, s * 0.72);
  ctx.beginPath(); ctx.moveTo(0, -3.6 * s); ctx.lineTo(2.4 * s, -3.6 * s); ctx.stroke();   // empuñadura
  ctx.fillStyle = lit ? amber : mTop; ctx.beginPath(); ctx.arc(2.4 * s, -3.6 * s, 0.72 * s, 0, TAU); ctx.fill();
  ctx.fillStyle = mDark; ctx.beginPath(); ctx.arc(0, 0, 1.05 * s, 0, TAU); ctx.fill();      // cubo del eje
  ctx.fillStyle = mTop; ctx.beginPath(); ctx.arc(0, 0, 0.4 * s, 0, TAU); ctx.fill();
  ctx.restore();

  ctx.restore();
}

// Tower: la torre de cuento (Rapunzel). Sillería en tres tonos con almenas y una
// ventana arcada en lo alto; `braid` (0..1) es la trenza dorada que cae del
// alféizar (1 hasta el pie, 0 cortada), ondeando con `_t`; `glow` enciende la
// ventana. `color` tiñe la piedra, `alpha` la desvanece. (x, y) es la base.
export function drawTower(ctx, prop) {
  const s = prop.scale || 3.5;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  const t = prop._t || 0;
  const braid = prop.braid == null ? 1 : Math.max(0, Math.min(1, prop.braid));
  const glow = prop.glow == null ? 0 : Math.max(0, Math.min(1, prop.glow));
  const stone = prop.color || '#9aa3b0';
  const stoneD = mixColors(stone, '#1b2030', 0.42);
  const stoneL = mixColors(stone, '#ffffff', 0.30);
  const mortar = mixColors(stone, '#1b2030', 0.6);
  const roof = '#9a3a44';
  const roofD = mixColors(roof, '#000000', 0.32);
  const gold = '#e8c34a';
  const goldD = mixColors(gold, '#7a4a10', 0.5);
  const goldL = mixColors(gold, '#ffffff', 0.4);
  const TAU = Math.PI * 2;
  const HW = 3.2 * s;
  const shaftTop = cy - 19 * s;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = 'rgba(8,10,22,0.24)';
  ctx.beginPath(); ctx.ellipse(cx, cy, HW * 1.5, 1.4 * s, 0, 0, TAU); ctx.fill();
  // Shaft (stone) with light/shadow sides.
  ctx.fillStyle = stoneD; ctx.fillRect(cx - HW, shaftTop, HW * 2, cy - shaftTop);
  ctx.fillStyle = stone;  ctx.fillRect(cx - HW, shaftTop, HW * 1.45, cy - shaftTop);
  ctx.fillStyle = stoneL; ctx.fillRect(cx - HW, shaftTop, HW * 0.5, cy - shaftTop);
  // Masonry courses (staggered).
  ctx.strokeStyle = mortar; ctx.lineWidth = Math.max(1, s * 0.16);
  for (let i = 1; i * 2.4 * s < (cy - shaftTop); i++) {
    const yy = shaftTop + i * 2.4 * s;
    ctx.beginPath(); ctx.moveTo(cx - HW, yy); ctx.lineTo(cx + HW, yy); ctx.stroke();
    const off = (i % 2) ? HW * 0.5 : -HW * 0.5;
    ctx.beginPath(); ctx.moveTo(cx + off, yy); ctx.lineTo(cx + off, yy + 2.4 * s); ctx.stroke();
  }
  // Battlements (crenellations) at the top.
  ctx.fillStyle = stoneD; ctx.fillRect(cx - HW - 0.4 * s, shaftTop - 0.4 * s, HW * 2 + 0.8 * s, 0.8 * s);
  ctx.fillStyle = stone;
  for (let k = -2; k <= 2; k++) ctx.fillRect(cx + k * 1.4 * s - 0.55 * s, shaftTop - 2 * s, 1.1 * s, 1.8 * s);
  // Pointed roof above the battlements.
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(cx - HW - 0.8 * s, shaftTop - 1.9 * s);
  ctx.lineTo(cx, shaftTop - 7.5 * s);
  ctx.lineTo(cx + HW + 0.8 * s, shaftTop - 1.9 * s);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = roofD;
  ctx.beginPath();
  ctx.moveTo(cx + 0.4 * s, shaftTop - 1.9 * s);
  ctx.lineTo(cx, shaftTop - 7.5 * s);
  ctx.lineTo(cx + HW + 0.8 * s, shaftTop - 1.9 * s);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = gold; ctx.beginPath(); ctx.arc(cx, shaftTop - 7.7 * s, 0.6 * s, 0, TAU); ctx.fill();
  // Arched window high on the shaft.
  const winY = shaftTop + 3 * s, winW = 1.7 * s, winH = 2.6 * s;
  ctx.fillStyle = mortar;
  ctx.beginPath();
  ctx.moveTo(cx - winW, winY + winH); ctx.lineTo(cx - winW, winY);
  ctx.arc(cx, winY, winW, Math.PI, 0); ctx.lineTo(cx + winW, winY + winH);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = glow > 0.02 ? mixColors('#3a2a44', '#ffd98a', glow) : '#241c2e';
  ctx.beginPath();
  ctx.moveTo(cx - winW * 0.66, winY + winH * 0.9); ctx.lineTo(cx - winW * 0.66, winY);
  ctx.arc(cx, winY, winW * 0.66, Math.PI, 0); ctx.lineTo(cx + winW * 0.66, winY + winH * 0.9);
  ctx.closePath(); ctx.fill();
  if (glow > 0.02) {
    ctx.save();
    ctx.globalAlpha = ctx.globalAlpha * glow;
    const g = ctx.createRadialGradient(cx, winY + winH * 0.3, 0, cx, winY + winH * 0.3, 6 * s);
    g.addColorStop(0, 'rgba(255,210,130,0.5)'); g.addColorStop(1, 'rgba(255,210,130,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, winY + winH * 0.3, 6 * s, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // Braid: golden hair spilling from the sill, gently waving.
  if (braid > 0.02) {
    const sillY = winY + winH;
    const len = braid * (cy - sillY - 0.5 * s);
    const segs = 14;
    ctx.lineCap = 'round';
    for (let strand = 0; strand < 3; strand++) {
      ctx.strokeStyle = strand === 1 ? goldL : (strand === 0 ? gold : goldD);
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath();
      for (let i = 0; i <= segs; i++) {
        const fr = i / segs;
        const yy = sillY + fr * len;
        const wob = Math.sin(t * 1.2 + fr * 6 + strand * 2) * 0.7 * s * fr;
        const xx = cx + wob + (strand - 1) * 0.7 * s * (1 - fr * 0.3);
        if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }
    ctx.fillStyle = goldL;
    for (let i = 2; i < segs; i += 3) {
      const fr = i / segs, yy = sillY + fr * len;
      const wob = Math.sin(t * 1.2 + fr * 6 + 2) * 0.7 * s * fr;
      ctx.beginPath(); ctx.arc(cx + wob, yy, 0.85 * s, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

// Oven: el horno de la bruja (Hansel y Gretel). Bóveda de ladrillo en tres tonos
// con boca de arco; `fire` (o `glow`, 0..1) enciende lenguas de fuego y el
// resplandor que sale por la boca, animadas con `_t`. (x, y) es la base.
export function drawOven(ctx, prop) {
  const s = prop.scale || 3.2;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  const t = prop._t || 0;
  const fireRaw = prop.fire == null ? (prop.glow == null ? 0 : prop.glow) : prop.fire;
  const f = Math.max(0, Math.min(1, fireRaw));
  const brick = prop.color || '#7a4a36';
  const brickD = mixColors(brick, '#000000', 0.4);
  const brickL = mixColors(brick, '#ffb070', 0.28);
  const mortar = mixColors(brick, '#000000', 0.6);
  const TAU = Math.PI * 2;
  const HW = 6 * s, H = 9 * s;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = 'rgba(8,10,22,0.26)';
  ctx.beginPath(); ctx.ellipse(cx, cy, HW * 1.15, 1.6 * s, 0, 0, TAU); ctx.fill();
  // Body (arched dome).
  ctx.fillStyle = brick;
  ctx.beginPath();
  ctx.moveTo(cx - HW, cy);
  ctx.lineTo(cx - HW, cy - 6 * s);
  ctx.quadraticCurveTo(cx - HW, cy - H, cx, cy - H);
  ctx.quadraticCurveTo(cx + HW, cy - H, cx + HW, cy - 6 * s);
  ctx.lineTo(cx + HW, cy);
  ctx.closePath(); ctx.fill();
  // Left light band.
  ctx.fillStyle = brickL;
  ctx.beginPath();
  ctx.moveTo(cx - HW, cy);
  ctx.lineTo(cx - HW, cy - 6 * s);
  ctx.quadraticCurveTo(cx - HW, cy - H, cx - 1.5 * s, cy - H + 0.4 * s);
  ctx.lineTo(cx - 2.8 * s, cy);
  ctx.closePath(); ctx.fill();
  // Brick courses.
  ctx.strokeStyle = mortar; ctx.lineWidth = Math.max(1, s * 0.16);
  for (let i = 1; i <= 4; i++) {
    const yy = cy - i * 1.7 * s;
    ctx.beginPath(); ctx.moveTo(cx - HW + 0.4 * s, yy); ctx.lineTo(cx + HW - 0.4 * s, yy); ctx.stroke();
  }
  ctx.fillStyle = brickD; ctx.fillRect(cx - HW, cy - 0.7 * s, HW * 2, 0.7 * s);
  // Mouth (arched opening).
  const mw = 3.4 * s, my = cy - 0.6 * s, mTop = my - 4.6 * s;
  ctx.fillStyle = '#150a08';
  ctx.beginPath();
  ctx.moveTo(cx - mw, my); ctx.lineTo(cx - mw, mTop + mw);
  ctx.arc(cx, mTop + mw, mw, Math.PI, 0); ctx.lineTo(cx + mw, my);
  ctx.closePath(); ctx.fill();
  // Flames inside the mouth.
  if (f > 0.02) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - mw, my); ctx.lineTo(cx - mw, mTop + mw);
    ctx.arc(cx, mTop + mw, mw, Math.PI, 0); ctx.lineTo(cx + mw, my);
    ctx.closePath(); ctx.clip();
    const cols = ['#a61f1f', '#e0561c', '#f4a01d', '#ffe08a'];
    for (let i = 0; i < 6; i++) {
      const bx = cx - mw * 0.78 + (i / 5) * mw * 1.56;
      const flick = Math.sin(t * 8 + i * 1.9) * 0.5 + 0.5;
      const hgt = (2.4 * s + 3.2 * s * f) * (0.55 + 0.45 * flick);
      for (let l = 0; l < cols.length; l++) {
        const sc = 1 - l * 0.2;
        const wfl = mw * 0.42 * sc;
        ctx.fillStyle = cols[l];
        ctx.beginPath();
        ctx.moveTo(bx - wfl, my);
        ctx.quadraticCurveTo(bx - wfl * 0.4, my - hgt * sc * 0.5, bx, my - hgt * sc);
        ctx.quadraticCurveTo(bx + wfl * 0.4, my - hgt * sc * 0.5, bx + wfl, my);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = ctx.globalAlpha * f;
    const g = ctx.createRadialGradient(cx, my - 1.8 * s, 0, cx, my - 1.8 * s, mw * 2.4);
    g.addColorStop(0, 'rgba(255,150,40,0.5)'); g.addColorStop(1, 'rgba(255,150,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, my - 1.8 * s, mw * 2.4, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // Chimney.
  ctx.fillStyle = brickD; ctx.fillRect(cx + 2.6 * s, cy - H - 1.8 * s, 1.8 * s, 2.4 * s);
  ctx.fillStyle = brick;  ctx.fillRect(cx + 2.6 * s, cy - H - 1.8 * s, 0.8 * s, 2.4 * s);
  ctx.restore();
}

// Candy house: la casa de pan de jengibre (Hansel y Gretel). Paredes de jengibre
// con glaseado, techo a dos aguas con escamas y caramelos, puerta de chocolate,
// piruletas y ventanas. `_t` da humo a la chimenea. (x, y) es la base.
export function drawCandyHouse(ctx, prop) {
  const s = prop.scale || 3;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  const t = prop._t || 0;
  const ginger = prop.color || '#a86a36';
  const gingerD = mixColors(ginger, '#000000', 0.35);
  const gingerL = mixColors(ginger, '#ffd9a0', 0.32);
  const icing = '#fbf3e4';
  const choco = '#5a3420';
  const TAU = Math.PI * 2;
  const HW = 7 * s, WH = 7 * s, wallTop = cy - WH;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = 'rgba(8,10,22,0.24)';
  ctx.beginPath(); ctx.ellipse(cx, cy, HW * 1.2, 1.5 * s, 0, 0, TAU); ctx.fill();
  // Walls.
  ctx.fillStyle = gingerD; ctx.fillRect(cx - HW, wallTop, HW * 2, WH);
  ctx.fillStyle = ginger;  ctx.fillRect(cx - HW, wallTop, HW * 1.5, WH);
  ctx.fillStyle = gingerL; ctx.fillRect(cx - HW, wallTop, HW * 0.5, WH);
  // Icing drips along the wall top.
  ctx.fillStyle = icing;
  for (let i = -3; i <= 3; i++) {
    const dx = cx + i * (HW * 2 / 7);
    const drp = 0.8 * s + ((i + 3) % 3) * 0.5 * s, w7 = HW / 7;
    ctx.beginPath();
    ctx.moveTo(dx - w7, wallTop); ctx.lineTo(dx + w7, wallTop);
    ctx.lineTo(dx + w7, wallTop + drp); ctx.arc(dx, wallTop + drp, w7, 0, Math.PI);
    ctx.closePath(); ctx.fill();
  }
  // Gable roof (chocolate).
  const peak = wallTop - 5.5 * s, eaveX = HW + 1.2 * s;
  ctx.fillStyle = choco;
  ctx.beginPath();
  ctx.moveTo(cx - eaveX, wallTop + 0.4 * s); ctx.lineTo(cx, peak); ctx.lineTo(cx + eaveX, wallTop + 0.4 * s);
  ctx.closePath(); ctx.fill();
  // Icing scallops on the roof (rows of arcs that narrow toward the peak).
  ctx.fillStyle = icing;
  for (let row = 0; row < 4; row++) {
    const ry = wallTop - row * 1.25 * s;
    const half = eaveX * (1 - row / 4.3);
    for (let xx = cx - half; xx < cx + half - 0.2 * s; xx += 1.5 * s) {
      ctx.beginPath(); ctx.arc(xx + 0.75 * s, ry, 0.75 * s, Math.PI, 0); ctx.fill();
    }
  }
  // Gumdrops along the eaves.
  const candyCols = ['#e0445f', '#4f8fe0', '#5fae5f', '#F4AC1D', '#9a5bd0'];
  for (let i = 0; i < 5; i++) {
    const fr = i / 4, gx = cx - eaveX + fr * eaveX * 2;
    const gy = (wallTop + 0.4 * s) + (peak - wallTop - 0.4 * s) * (1 - Math.abs(gx - cx) / eaveX) - 0.6 * s;
    ctx.fillStyle = candyCols[i];
    ctx.beginPath(); ctx.arc(gx, gy, 0.9 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(gx - 0.3 * s, gy - 0.3 * s, 0.32 * s, 0, TAU); ctx.fill();
  }
  // Windows with icing frames.
  for (const sx of [-1, 1]) {
    const wx = cx + sx * 4 * s, wy = wallTop + 2.6 * s;
    ctx.fillStyle = '#f4d98a'; ctx.fillRect(wx - 1.2 * s, wy - 1.2 * s, 2.4 * s, 2.4 * s);
    ctx.strokeStyle = icing; ctx.lineWidth = Math.max(1, 0.3 * s);
    ctx.strokeRect(wx - 1.2 * s, wy - 1.2 * s, 2.4 * s, 2.4 * s);
    ctx.beginPath(); ctx.moveTo(wx, wy - 1.2 * s); ctx.lineTo(wx, wy + 1.2 * s);
    ctx.moveTo(wx - 1.2 * s, wy); ctx.lineTo(wx + 1.2 * s, wy); ctx.stroke();
  }
  // Door (chocolate, arched) with icing trim.
  const dw = 1.9 * s, dTop = cy - 3.6 * s;
  ctx.fillStyle = choco;
  ctx.beginPath();
  ctx.moveTo(cx - dw, cy); ctx.lineTo(cx - dw, dTop + dw);
  ctx.arc(cx, dTop + dw, dw, Math.PI, 0); ctx.lineTo(cx + dw, cy);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = icing; ctx.lineWidth = Math.max(1, 0.32 * s);
  ctx.beginPath();
  ctx.moveTo(cx - dw, cy); ctx.lineTo(cx - dw, dTop + dw);
  ctx.arc(cx, dTop + dw, dw, Math.PI, 0); ctx.lineTo(cx + dw, cy);
  ctx.stroke();
  ctx.fillStyle = '#F4AC1D'; ctx.beginPath(); ctx.arc(cx + dw * 0.5, cy - 1.8 * s, 0.3 * s, 0, TAU); ctx.fill();
  // Lollipops flanking the door.
  for (const sx of [-1, 1]) {
    const lx = cx + sx * (dw + 1.7 * s);
    ctx.strokeStyle = '#f3ead8'; ctx.lineWidth = 0.5 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(lx, cy); ctx.lineTo(lx, cy - 3 * s); ctx.stroke();
    ctx.fillStyle = sx < 0 ? '#e0445f' : '#4f8fe0';
    ctx.beginPath(); ctx.arc(lx, cy - 3.6 * s, 1.1 * s, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fbf3e4'; ctx.lineWidth = 0.3 * s;
    ctx.beginPath(); ctx.arc(lx, cy - 3.6 * s, 0.6 * s, t + sx, t + sx + 4.2); ctx.stroke();
  }
  // Chimney + drifting smoke.
  const chx = cx + 3 * s, chy = peak + 2.2 * s;
  ctx.fillStyle = choco; ctx.fillRect(chx - 0.8 * s, chy - 2.4 * s, 1.6 * s, 2.4 * s);
  ctx.fillStyle = icing; ctx.fillRect(chx - 0.95 * s, chy - 2.6 * s, 1.9 * s, 0.5 * s);
  ctx.fillStyle = '#d8d2c4';
  for (let i = 0; i < 3; i++) {
    const pf = (t * 0.4 + i / 3) % 1;
    ctx.save();
    ctx.globalAlpha = ctx.globalAlpha * 0.4 * (1 - pf);
    ctx.beginPath(); ctx.arc(chx + Math.sin(pf * 6) * s, chy - 2.6 * s - pf * 5 * s, (0.5 + pf * 1.2) * s, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// Shoe: el zapato del baile (Cenicienta). Zapatilla de tacón estilizada; `color`
// la tiñe (oro, o rojo cuando la sangre la llena), `glass` (0..1) la vuelve
// translúcida (la de cristal), `alpha`. (x, y) es la base.
export function drawShoe(ctx, prop) {
  const s = prop.scale || 2.2;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  const glass = prop.glass == null ? 0 : Math.max(0, Math.min(1, prop.glass));
  const base = prop.color || '#e8c34a';
  const baseD = mixColors(base, '#000000', 0.35);
  const baseL = mixColors(base, '#ffffff', 0.45);
  const TAU = Math.PI * 2;
  ctx.save();
  ctx.globalAlpha *= a * (glass > 0.5 ? 0.72 : 1);
  ctx.fillStyle = 'rgba(8,10,22,0.22)';
  ctx.beginPath(); ctx.ellipse(cx, cy, 4.2 * s, 1.0 * s, 0, 0, TAU); ctx.fill();
  // Heel.
  ctx.fillStyle = baseD;
  ctx.beginPath();
  ctx.moveTo(cx + 2.0 * s, cy - 0.4 * s); ctx.lineTo(cx + 3.0 * s, cy);
  ctx.lineTo(cx + 2.5 * s, cy); ctx.lineTo(cx + 1.7 * s, cy - 0.4 * s);
  ctx.closePath(); ctx.fill();
  // Body (a curved pump).
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.moveTo(cx - 3.4 * s, cy - 0.5 * s);
  ctx.quadraticCurveTo(cx - 3.9 * s, cy - 1.7 * s, cx - 2.6 * s, cy - 2.0 * s);
  ctx.quadraticCurveTo(cx - 0.6 * s, cy - 2.3 * s, cx + 0.6 * s, cy - 3.4 * s);
  ctx.quadraticCurveTo(cx + 1.2 * s, cy - 4.0 * s, cx + 2.0 * s, cy - 3.3 * s);
  ctx.quadraticCurveTo(cx + 2.5 * s, cy - 1.9 * s, cx + 2.2 * s, cy - 0.5 * s);
  ctx.closePath(); ctx.fill();
  // Inner topline shadow.
  ctx.fillStyle = baseD;
  ctx.beginPath();
  ctx.moveTo(cx + 0.7 * s, cy - 3.2 * s);
  ctx.quadraticCurveTo(cx + 1.2 * s, cy - 3.7 * s, cx + 1.9 * s, cy - 3.2 * s);
  ctx.quadraticCurveTo(cx + 1.2 * s, cy - 2.7 * s, cx + 0.7 * s, cy - 3.2 * s);
  ctx.closePath(); ctx.fill();
  // Specular highlight.
  ctx.fillStyle = baseL;
  ctx.beginPath(); ctx.ellipse(cx - 1.5 * s, cy - 1.4 * s, 0.9 * s, 0.42 * s, -0.4, 0, TAU); ctx.fill();
  if (glass > 0.3) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(cx - 0.3 * s, cy - 2.1 * s, 0.45 * s, 1.0 * s, -0.5, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// Mirror: el espejo mágico (Blancanieves). Óvalo reflectante con marco dorado
// sobre un pie; `glow` (0..1) enciende el aura mágica y un destello que recorre
// el cristal con `_t`. `color` tiñe el marco, `alpha` lo desvanece. (x, y) base.
export function drawMirror(ctx, prop) {
  const s = prop.scale || 3;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  const t = prop._t || 0;
  const glow = prop.glow == null ? 0 : Math.max(0, Math.min(1, prop.glow));
  const gold = prop.color || '#d8a850';
  const goldD = mixColors(gold, '#5a3a10', 0.5);
  const goldL = mixColors(gold, '#ffffff', 0.45);
  const TAU = Math.PI * 2;
  const ovY = cy - 9 * s, rx = 4.2 * s, ry = 5.6 * s;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = 'rgba(8,10,22,0.22)';
  ctx.beginPath(); ctx.ellipse(cx, cy, 3.4 * s, 1.0 * s, 0, 0, TAU); ctx.fill();
  // Stand.
  ctx.fillStyle = goldD;
  ctx.beginPath();
  ctx.moveTo(cx - 0.7 * s, ovY + ry * 0.7); ctx.lineTo(cx - 2.4 * s, cy);
  ctx.lineTo(cx + 2.4 * s, cy); ctx.lineTo(cx + 0.7 * s, ovY + ry * 0.7);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = gold; ctx.fillRect(cx - 2.7 * s, cy - 0.6 * s, 5.4 * s, 0.6 * s);
  // Magic aura.
  if (glow > 0.02) {
    ctx.save();
    ctx.globalAlpha = ctx.globalAlpha * glow;
    const g = ctx.createRadialGradient(cx, ovY, rx * 0.3, cx, ovY, rx * 2.2);
    g.addColorStop(0, 'rgba(150,210,255,0.45)'); g.addColorStop(1, 'rgba(150,210,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, ovY, rx * 2.2, ry * 1.8, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // Frame.
  ctx.fillStyle = goldD; ctx.beginPath(); ctx.ellipse(cx, ovY, rx + 0.9 * s, ry + 0.9 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = gold;  ctx.beginPath(); ctx.ellipse(cx, ovY, rx + 0.5 * s, ry + 0.5 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = goldL;
  ctx.beginPath(); ctx.ellipse(cx, ovY, rx + 0.5 * s, ry + 0.5 * s, 0, Math.PI * 0.95, Math.PI * 1.5); ctx.lineTo(cx, ovY); ctx.closePath(); ctx.fill();
  // Glass.
  const dark = glow > 0.02 ? mixColors('#2a3a52', '#bfe0ff', glow * 0.6) : '#33405a';
  const gl = ctx.createLinearGradient(cx - rx, ovY - ry, cx + rx, ovY + ry);
  gl.addColorStop(0, mixColors(dark, '#ffffff', 0.25));
  gl.addColorStop(0.5, dark);
  gl.addColorStop(1, mixColors(dark, '#000000', 0.2));
  ctx.fillStyle = gl;
  ctx.beginPath(); ctx.ellipse(cx, ovY, rx, ry, 0, 0, TAU); ctx.fill();
  // Moving sheen.
  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx, ovY, rx, ry, 0, 0, TAU); ctx.clip();
  ctx.globalAlpha = ctx.globalAlpha * 0.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.1 * s;
  const sh = Math.sin(t * 0.8) * rx;
  ctx.beginPath(); ctx.moveTo(cx + sh - 1.4 * s, ovY - ry); ctx.lineTo(cx + sh + 1.4 * s, ovY + ry); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// Dove: paloma blanca de alas que baten (`_t`). No se traslada sola: se mueve con
// `tween` de x/y o `path` (como la tortuga), para coreografiar un descenso. `dir`
// la espeja, `color` tiñe el plumaje, `alpha` la desvanece. (x, y) es el centro.
export function drawDove(ctx, prop) {
  const s = prop.scale || 2.5;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  const t = prop._t || 0;
  const dir = prop.dir || 1;
  const body = prop.color || '#f4f6fb';
  const shade = mixColors(body, '#9aa6c0', 0.5);
  const beak = '#e8a838';
  const eyeC = '#26304a';
  const TAU = Math.PI * 2;
  const flap = Math.sin(t * 10);
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(cx, cy);
  ctx.scale(dir, 1);
  // Body.
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, 0, 3.2 * s, 2.2 * s, -0.15, 0, TAU); ctx.fill();
  ctx.fillStyle = shade;
  ctx.beginPath(); ctx.ellipse(0.3 * s, 0.9 * s, 2.5 * s, 1.3 * s, -0.1, 0, TAU); ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(-0.2 * s, -0.4 * s, 3.0 * s, 1.8 * s, -0.15, 0, TAU); ctx.fill();
  // Tail.
  ctx.beginPath();
  ctx.moveTo(-2.6 * s, -0.2 * s);
  ctx.lineTo(-5.2 * s, -1.2 * s + flap * 0.4 * s);
  ctx.lineTo(-5.0 * s, 0.7 * s + flap * 0.4 * s);
  ctx.closePath(); ctx.fill();
  // Head.
  ctx.beginPath(); ctx.arc(2.6 * s, -1.5 * s, 1.5 * s, 0, TAU); ctx.fill();
  // Beak.
  ctx.fillStyle = beak;
  ctx.beginPath();
  ctx.moveTo(3.9 * s, -1.7 * s); ctx.lineTo(5.3 * s, -1.3 * s); ctx.lineTo(3.9 * s, -1.0 * s);
  ctx.closePath(); ctx.fill();
  // Eye.
  ctx.fillStyle = eyeC;
  ctx.beginPath(); ctx.arc(3.0 * s, -1.8 * s, 0.42 * s, 0, TAU); ctx.fill();
  // Wing (flapping around the shoulder).
  ctx.save();
  ctx.translate(0.2 * s, -0.7 * s);
  ctx.rotate(flap * 0.6 - 0.2);
  ctx.fillStyle = mixColors(body, '#ffffff', 0.3);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-1.5 * s, -3.4 * s, 1.4 * s, -4.0 * s);
  ctx.quadraticCurveTo(2.6 * s, -2.0 * s, 1.2 * s, 0);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = shade; ctx.lineWidth = 0.3 * s;
  ctx.beginPath(); ctx.moveTo(0.6 * s, -0.4 * s); ctx.lineTo(1.3 * s, -3.0 * s); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// Wall: muro de piedra del castillo (la pared contra la que se estrella la rana
// en El Rey Rana). Sillería en tres tonos con cornisa y una saetera. `color`
// tiñe la piedra, `alpha` la desvanece. (x, y) es la base.
export function drawWall(ctx, prop) {
  const s = prop.scale || 4;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  const stone = prop.color || '#9aa3b0';
  const stoneD = mixColors(stone, '#1b2030', 0.42);
  const stoneL = mixColors(stone, '#ffffff', 0.26);
  const mortar = mixColors(stone, '#1b2030', 0.6);
  const TAU = Math.PI * 2;
  const HW = 4.5 * s, H = 13 * s, top = cy - H;
  ctx.save();
  ctx.globalAlpha *= a;
  // Contact shadow.
  ctx.fillStyle = 'rgba(8,10,22,0.24)';
  ctx.beginPath(); ctx.ellipse(cx, cy, HW * 1.2, 1.3 * s, 0, 0, TAU); ctx.fill();
  // Body with light/shadow sides.
  ctx.fillStyle = stoneD; ctx.fillRect(cx - HW, top, HW * 2, H);
  ctx.fillStyle = stone;  ctx.fillRect(cx - HW, top, HW * 1.58, H);
  ctx.fillStyle = stoneL; ctx.fillRect(cx - HW, top, HW * 0.42, H);
  // Masonry: horizontal courses + staggered vertical joints.
  ctx.strokeStyle = mortar; ctx.lineWidth = Math.max(1, s * 0.16);
  const courseH = 2.2 * s;
  let row = 0;
  for (let yy = top + courseH; yy < cy - 1; yy += courseH, row++) {
    ctx.beginPath(); ctx.moveTo(cx - HW, yy); ctx.lineTo(cx + HW, yy); ctx.stroke();
    const off = (row % 2) ? HW * 0.5 : -HW * 0.5;
    ctx.beginPath(); ctx.moveTo(cx + off, yy - courseH); ctx.lineTo(cx + off, yy); ctx.stroke();
    const off2 = (row % 2) ? -HW * 0.5 : HW * 0.5;
    ctx.beginPath(); ctx.moveTo(cx + off2, yy - courseH); ctx.lineTo(cx + off2, yy); ctx.stroke();
  }
  // Coping stone (top course, slightly wider).
  ctx.fillStyle = stoneD; ctx.fillRect(cx - HW - 0.7 * s, top - 1.5 * s, HW * 2 + 1.4 * s, 1.7 * s);
  ctx.fillStyle = mixColors(stone, '#ffffff', 0.14); ctx.fillRect(cx - HW - 0.7 * s, top - 1.5 * s, HW * 2 + 1.4 * s, 0.5 * s);
  // Arrow-slit (saetera).
  ctx.fillStyle = '#16121f';
  ctx.fillRect(cx - 0.55 * s, top + 3 * s, 1.1 * s, 4.2 * s);
  ctx.fillStyle = mortar;
  ctx.fillRect(cx - 0.95 * s, top + 2.6 * s, 1.9 * s, 0.5 * s);
  ctx.restore();
}

// Tome: libro de cuentos abierto y grande (el cierre de la escena 11). Dos
// páginas crema con renglones y una tapa de `color`; un marcapáginas que se mece
// (`_t`) y un acento que muta con `glow` (0..1): de una mancha de sangre (lo
// crudo) a un corazón dorado con destellos y resplandor cálido (lo dulce).
// `label` rotula la edición (año) bajo el libro. `alpha`. (x, y) es la base.
export function drawTome(ctx, prop) {
  const s = prop.scale || 4;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  const t = prop._t || 0;
  const glow = prop.glow == null ? 0 : Math.max(0, Math.min(1, prop.glow));
  const cover = prop.color || '#7a2e34';
  const coverD = mixColors(cover, '#000000', 0.4);
  const page = '#f2ead6';
  const pageHi = '#fbf6e8';
  const pageSh = '#d6c9ac';
  const ink = '#8a7c5e';
  const TAU = Math.PI * 2;
  const HW = 9 * s, H = 10 * s;
  const topOut = cy - H, topMid = cy - H + 2.4 * s;
  const botOut = cy - 1.6 * s, botMid = cy;
  ctx.save();
  ctx.globalAlpha *= a;
  // Sweet warm glow aura behind the book.
  if (glow > 0.02) {
    ctx.save();
    ctx.globalAlpha = ctx.globalAlpha * glow * 0.85;
    const g = ctx.createRadialGradient(cx, cy - H * 0.45, 2 * s, cx, cy - H * 0.45, HW * 1.8);
    g.addColorStop(0, 'rgba(255,208,120,0.55)'); g.addColorStop(1, 'rgba(255,208,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(cx, cy - H * 0.45, HW * 1.8, H * 1.05, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  const leaf = (sign, fill, ext) => {
    const hw = HW + ext;
    ctx.beginPath();
    ctx.moveTo(cx, topMid - ext * 0.4);
    ctx.quadraticCurveTo(cx + sign * hw * 0.5, topOut - ext * 0.7 - 0.4 * s, cx + sign * hw, topOut - ext * 0.3);
    ctx.lineTo(cx + sign * hw, botOut + ext * 0.4);
    ctx.quadraticCurveTo(cx + sign * hw * 0.5, botMid + 0.8 * s + ext * 0.4, cx, botMid + ext * 0.4);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
  };
  // Soft floating shadow.
  ctx.save();
  ctx.globalAlpha = ctx.globalAlpha * 0.18;
  ctx.fillStyle = '#0a0c18';
  ctx.beginPath(); ctx.ellipse(cx, cy + 1.4 * s, HW * 0.95, 1.4 * s, 0, 0, TAU); ctx.fill();
  ctx.restore();
  // Cover (binding peeks around the pages).
  leaf(-1, coverD, 1.5 * s); leaf(1, coverD, 1.5 * s);
  leaf(-1, cover, 0.9 * s);  leaf(1, cover, 0.9 * s);
  // Pages.
  leaf(-1, page, 0); leaf(1, page, 0);
  ctx.save(); ctx.globalAlpha = ctx.globalAlpha * 0.4; leaf(-1, pageHi, -1.4 * s); ctx.restore();
  // Gutter shadow.
  ctx.strokeStyle = pageSh; ctx.lineWidth = Math.max(1, s * 0.55);
  ctx.beginPath(); ctx.moveTo(cx, topMid); ctx.lineTo(cx, botMid - 0.3 * s); ctx.stroke();
  // Text lines on both pages.
  ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, s * 0.16);
  for (let i = 0; i < 5; i++) {
    const fy = topMid + (1.6 + i * 1.4) * s;
    ctx.beginPath(); ctx.moveTo(cx - HW * 0.74, fy + 0.5 * s); ctx.lineTo(cx - HW * 0.16, fy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + HW * 0.16, fy); ctx.lineTo(cx + HW * 0.74, fy + 0.5 * s); ctx.stroke();
  }
  // Blood stain (crude), fades out as glow rises.
  const stainA = 1 - glow;
  if (stainA > 0.02) {
    ctx.save();
    ctx.globalAlpha = ctx.globalAlpha * stainA;
    ctx.fillStyle = '#8c1f24';
    const sx = cx + HW * 0.4, sy = topMid + 4.4 * s;
    ctx.beginPath(); ctx.ellipse(sx, sy, 1.9 * s, 1.4 * s, 0.3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(sx - 1.5 * s, sy + 0.7 * s, 0.6 * s, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(sx + 1.3 * s, sy - 0.8 * s, 0.45 * s, 0, TAU); ctx.fill();
    ctx.fillRect(sx - 0.2 * s, sy + 0.5 * s, 0.45 * s, 2.0 * s);
    ctx.restore();
  }
  // Sweet golden heart + sparkles, fades in with glow.
  if (glow > 0.02) {
    ctx.save();
    ctx.globalAlpha = ctx.globalAlpha * glow;
    const hx = cx + HW * 0.38, hy = topMid + 4.2 * s, hs = 1.4 * s;
    ctx.fillStyle = '#e8b43a';
    ctx.beginPath();
    ctx.moveTo(hx, hy + hs * 0.9);
    ctx.bezierCurveTo(hx - hs * 1.3, hy - hs * 0.2, hx - hs * 0.5, hy - hs * 1.1, hx, hy - hs * 0.3);
    ctx.bezierCurveTo(hx + hs * 0.5, hy - hs * 1.1, hx + hs * 1.3, hy - hs * 0.2, hx, hy + hs * 0.9);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff2c8';
    for (let k = 0; k < 4; k++) {
      const tw = Math.sin(t * 3 + k * 1.7) * 0.5 + 0.5;
      const spx = cx + (k % 2 ? 1 : -1) * HW * (0.3 + 0.12 * k);
      const spy = topMid + (1.5 + k * 1.5) * s;
      ctx.beginPath(); ctx.arc(spx, spy, (0.3 + 0.4 * tw) * s, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  // Bookmark ribbon (sways with _t).
  const sway = Math.sin(t * 1.6) * 0.8 * s;
  ctx.fillStyle = glow > 0.5 ? '#e0b04a' : '#b0444e';
  ctx.beginPath();
  ctx.moveTo(cx - 0.7 * s, topMid + 0.2 * s);
  ctx.lineTo(cx + 0.7 * s, topMid + 0.2 * s);
  ctx.lineTo(cx + 0.7 * s + sway, topMid + 4.6 * s);
  ctx.lineTo(cx - 0.7 * s + sway, topMid + 4.6 * s);
  ctx.closePath(); ctx.fill();
  // Edition label under the book (papel sobre fondo apagado, con sombra).
  if (prop.label) {
    ctx.font = '700 ' + Math.round(2.8 * s) + 'px "Plus Jakarta Sans", ui-sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(12,14,28,0.55)';
    ctx.fillText(String(prop.label), cx + 1, cy + 2.4 * s + 1);
    ctx.fillStyle = '#f3ecdc';
    ctx.fillText(String(prop.label), cx, cy + 2.4 * s);
  }
  ctx.restore();
}

export function drawProp(ctx, prop) {
  if (prop.type === 'tome') return drawTome(ctx, prop);
  if (prop.type === 'wall') return drawWall(ctx, prop);
  if (prop.type === 'dove') return drawDove(ctx, prop);
  if (prop.type === 'tower') return drawTower(ctx, prop);
  if (prop.type === 'oven') return drawOven(ctx, prop);
  if (prop.type === 'candy-house') return drawCandyHouse(ctx, prop);
  if (prop.type === 'shoe') return drawShoe(ctx, prop);
  if (prop.type === 'mirror') return drawMirror(ctx, prop);
  if (prop.type === 'grinder') return drawGrinder(ctx, prop);
  if (prop.type === 'turtle') return drawTurtle(ctx, prop);
  if (prop.type === 'pasture') return drawPasture(ctx, prop);
  if (prop.type === 'sheep') return drawSheep(ctx, prop);
  if (prop.type === 'fence') return drawFence(ctx, prop);
  if (prop.type === 'genially') return drawGenially(ctx, prop);
  if (prop.type === 'notebook') return drawNotebook(ctx, prop);
  if (prop.type === 'cat') return drawCat(ctx, prop);
  if (prop.type === 'vault') return drawVault(ctx, prop);
  if (prop.type === 'aiorb') return drawAiOrb(ctx, prop);
  if (prop.type === 'basilisk') return drawBasilisk(ctx, prop);
  if (prop.type === 'tree-bare') return drawTreeBare(ctx, prop);
  if (prop.type === 'pomegranate') return drawPomegranate(ctx, prop);
  if (prop.type === 'wheat') return drawWheat(ctx, prop);
  if (prop.type === 'chasm') return drawChasm(ctx, prop);
  if (prop.type === 'wonderflower') return drawWonderflower(ctx, prop);
  if (prop.type === 'pond') return drawPond(ctx, prop);
  if (prop.type === 'field') return drawField(ctx, prop);
  if (prop.type === 'domino') return drawDomino(ctx, prop);
  if (prop.type === 'bell') return drawBell(ctx, prop);
  if (prop.type === 'butterfly') return drawButterfly(ctx, prop);
  if (prop.type === 'cloud') return drawCloud(ctx, prop);
  if (prop.type === 'bird') return drawBird(ctx, prop);
  if (prop.type === 'fish') return drawFish(ctx, prop);
  if (prop.type === 'rabbit') return drawRabbit(ctx, prop);
  if (prop.type === 'tall-grass') return drawTallGrass(ctx, prop);
  if (prop.type === 'switch') return drawSwitch(ctx, prop);
  if (prop.type === 'chest') return drawChest(ctx, prop);
  if (prop.type === 'bonfire') return drawBonfire(ctx, prop);
  if (prop.type === 'bee') return drawBee(ctx, prop);
  if (prop.type === 'frog') return drawFrog(ctx, prop);
  if (prop.type === 'swing') return drawSwing(ctx, prop);
  if (prop.type === 'clock') return drawClock(ctx, prop);
  if (prop.type === 'virus') return drawVirus(ctx, prop);
  const def = PROP_SPRITES[prop.type];
  if (!def) return;
  // alpha animable también para sprites (flores que brotan/marchitan, etc.).
  const spriteA = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (spriteA <= 0.01) return;
  const _prevGA = ctx.globalAlpha;
  if (spriteA < 1) ctx.globalAlpha = _prevGA * spriteA;
  const s = prop.scale || 3;
  const rows = def.rows;
  const h = rows.length;
  const w = rows[0].length;
  const x0 = Math.round(prop.x - (w / 2) * s);
  const y0 = Math.round(prop.y - h * s);
  // Los sprites estáticos se rasterizan UNA vez a un canvas offscreen (a la
  // densidad efectiva del contexto: supersampleo × zoom) y cada frame es un
  // solo drawImage, en vez de cientos de fillRect por prop. Mismo patrón que
  // el caché del piso (floor.js). Los props con animación o estado (bird,
  // bonfire, chest...) salen arriba por su drawer propio y no pasan por aquí.
  const density = _ctxDensity(ctx);
  const raster = _spriteRaster(prop, def, s, density);
  if (raster) {
    // El raster va a densidad >= destino: el leve downscale se suaviza para
    // igualar el antialias que daba fillRect directo.
    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(raster, x0, y0, w * s, h * s);
    ctx.imageSmoothingEnabled = prevSmooth;
  } else {
    // Fallback sin caché (canvas offscreen no disponible): dibujo directo.
    const palette = { ...def.palette };
    if (prop.color && def.mainKey) palette[def.mainKey] = prop.color;
    if (prop.color2 && def.secondaryKey) palette[def.secondaryKey] = prop.color2;
    // Sprites con `shades`: derivan su rampa de sombras/luces del `color` base,
    // así un prop monocromo (planet) cambia de color DE VERDAD y no solo en su
    // tono principal. Cada entrada es key -> [hacia, cantidad] para mixColors.
    if (prop.color && def.shades) {
      for (const k in def.shades) {
        const [toward, amt] = def.shades[k];
        palette[k] = mixColors(prop.color, toward, amt);
      }
    }
    let lastColor = null;
    for (let r = 0; r < h; r++) {
      const row = rows[r];
      for (let c = 0; c < w; c++) {
        const ch = row[c];
        if (ch === '.') continue;
        const color = palette[ch];
        if (!color) continue;
        if (color !== lastColor) { ctx.fillStyle = color; lastColor = color; }
        ctx.fillRect(x0 + c * s, y0 + r * s, s, s);
      }
    }
  }
  ctx.globalAlpha = _prevGA;
  // Lamp halo: warm radial glow around the bulb (also streetlamp).
  if (prop.type === 'lamp' || prop.type === 'streetlamp') {
    const bx = prop.x;
    const by = prop.y - 10 * s;
    const grad = ctx.createRadialGradient(bx, by, s, bx, by, s * 16);
    grad.addColorStop(0, 'rgba(244,172,29,0.22)');
    grad.addColorStop(1, 'rgba(244,172,29,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bx, by, s * 16, 0, Math.PI * 2);
    ctx.fill();
  }
  // Candle flame flicker (subtle).
  if (prop.type === 'candle') {
    const flickerY = prop.y - 7 * s;
    const flicker = Math.sin(performance.now() * 0.006) * 0.05;
    const grad = ctx.createRadialGradient(prop.x, flickerY, 0, prop.x, flickerY, s * 4);
    grad.addColorStop(0, `rgba(244,172,29,${(0.30 + flicker).toFixed(2)})`);
    grad.addColorStop(1, 'rgba(244,172,29,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(prop.x, flickerY, s * 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Virus (patógeno): cápside central con corona de spikes que rota sola y una
// cápside que late. Ícono del contagio. FLOTA (translate al centro, sin sombra
// de contacto). `color` tiñe la cápside, `glow` 0..1 enciende un halo rojizo de
// contagio, `alpha` para aparecer/desvanecer. La corona es el emblema del
// coronavirus: tallos radiales con una bolita en la punta.
export function drawVirus(ctx, prop) {
  const s = prop.scale || 2.6;
  const cx = Math.round(prop.x);
  const cy = Math.round(prop.y);
  const a = prop.alpha == null ? 1 : Math.max(0, Math.min(1, prop.alpha));
  if (a <= 0.01) return;
  const t = prop._t || 0;
  const glow = prop.glow == null ? 0 : Math.max(0, Math.min(1, prop.glow));
  const col = prop.color || '#c9463a';
  const colD = mixColors(col, '#000000', 0.45);
  const colL = mixColors(col, '#ffffff', 0.5);
  const TAU = Math.PI * 2;
  const pulse = 0.9 + 0.1 * Math.sin(t * 3);
  const R = 2.3 * s * pulse;            // radio de la cápside
  const spikeLen = 1.2 * s;
  const SPIKES = 12;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(cx, cy);
  // Halo de contagio (glow): aura rojiza que late.
  if (glow > 0.02) {
    ctx.save();
    ctx.globalAlpha = ctx.globalAlpha * glow * (0.6 + 0.4 * Math.sin(t * 2.4));
    const g = ctx.createRadialGradient(0, 0, R * 0.4, 0, 0, R * 3.2);
    g.addColorStop(0, mixColors(col, '#ffffff', 0.1));
    g.addColorStop(1, 'rgba(201,70,58,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, R * 3.2, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // Corona de spikes que rota (tallo + bolita en la punta).
  ctx.save();
  ctx.rotate(t * 0.5);
  for (let k = 0; k < SPIKES; k++) {
    const ang = k * TAU / SPIKES;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    ctx.strokeStyle = colD;
    ctx.lineWidth = Math.max(1, s * 0.42);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(dx * R * 0.92, dy * R * 0.92);
    ctx.lineTo(dx * (R + spikeLen), dy * (R + spikeLen));
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(dx * (R + spikeLen), dy * (R + spikeLen), 0.55 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = colL;
    ctx.beginPath();
    ctx.arc(dx * (R + spikeLen) - 0.15 * s, dy * (R + spikeLen) - 0.15 * s, 0.22 * s, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // Cápside: sombra, cuerpo, highlight superior.
  ctx.fillStyle = colD;
  ctx.beginPath(); ctx.arc(0, 0, R + 0.5 * s, 0, TAU); ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
  ctx.fillStyle = colL;
  ctx.beginPath();
  ctx.ellipse(-0.5 * s, -0.6 * s, R * 0.55, R * 0.42, -0.5, 0, TAU);
  ctx.fill();
  // Material genético interno: pequeños receptores que giran al revés.
  ctx.save();
  ctx.rotate(-t * 0.35);
  ctx.fillStyle = colD;
  for (let k = 0; k < 5; k++) {
    const ang = k * TAU / 5 + 0.4;
    const rr = R * 0.5;
    ctx.beginPath();
    ctx.arc(Math.cos(ang) * rr, Math.sin(ang) * rr, 0.32 * s, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = mixColors(col, '#000000', 0.25);
  ctx.beginPath(); ctx.arc(0, 0, 0.5 * s, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.restore();
}
