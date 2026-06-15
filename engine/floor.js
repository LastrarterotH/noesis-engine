// noesis-engine / floor
// Ground texture renderer: pre-renders the floor pattern (grass, tiles, wood,
// dots, earth, sand, water, snow, cobble, grid) once into an offscreen canvas
// cached on world._floorCache, clipped below the horizon when there is a sky.
// Operates on a `world` instance (needs world.config, world.W, world.H,
// world._floorCache); World exposes _drawFloor as a thin wrapper and owns the
// cache invalidation (world._floorCache = null on reload).

import { mulberry32 } from './util.js?v=63';

export function drawFloor(world, ctx) {
  const kind = world.config.canvas?.floor;
  if (!kind || kind === 'solid') return;
  const cConf = world.config.canvas || {};
  const horizonY = cConf.sky ? Math.round(world.H * (cConf.horizon ?? 0.45)) : 0;
  if (!world._floorCache) {
    // Pre-render the floor pattern once into an offscreen canvas.
    const off = document.createElement('canvas');
    off.width = world.W; off.height = world.H;
    const c = off.getContext('2d');
    c.imageSmoothingEnabled = false;
    // Clip pattern generation to the ground region (below horizonY).
    if (horizonY > 0) {
      c.beginPath();
      c.rect(0, horizonY, world.W, world.H - horizonY);
      c.clip();
    }
    if (kind === 'grass') {
      const seed = mulberry32(42);
      // Subtle darker variation across the field for depth.
      c.fillStyle = 'rgba(20,55,25,0.18)';
      const m = Math.floor(world.W * world.H / 80);
      for (let i = 0; i < m; i++) {
        c.fillRect(Math.floor(seed() * world.W), Math.floor(seed() * world.H), 2, 1);
      }
      // Dense darker green grass blades (1×2 verticals).
      c.fillStyle = 'rgba(40,95,50,0.55)';
      const n = Math.floor(world.W * world.H / 60);
      for (let i = 0; i < n; i++) {
        c.fillRect(Math.floor(seed() * world.W), Math.floor(seed() * world.H), 1, 2);
      }
      // Sparser bright highlights.
      c.fillStyle = 'rgba(190,230,140,0.55)';
      const k = Math.floor(world.W * world.H / 250);
      for (let i = 0; i < k; i++) {
        c.fillRect(Math.floor(seed() * world.W), Math.floor(seed() * world.H), 1, 1);
      }
      // Occasional tiny flower hints in random colors.
      const flowerHints = ['rgba(255,73,133,0.7)', 'rgba(244,172,29,0.7)', 'rgba(91,141,239,0.7)', 'rgba(251,233,184,0.7)'];
      const f = Math.floor(world.W * world.H / 1100);
      for (let i = 0; i < f; i++) {
        c.fillStyle = flowerHints[Math.floor(seed() * flowerHints.length)];
        c.fillRect(Math.floor(seed() * world.W), Math.floor(seed() * world.H), 2, 2);
      }
    } else if (kind === 'tiles') {
      c.strokeStyle = 'rgba(255,255,255,0.05)';
      c.lineWidth = 1;
      const step = 28;
      for (let x = step; x < world.W; x += step) {
        c.beginPath(); c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, world.H); c.stroke();
      }
      for (let y = step; y < world.H; y += step) {
        c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(world.W, y + 0.5); c.stroke();
      }
    } else if (kind === 'wood') {
      for (let y = 0; y < world.H; y += 10) {
        c.fillStyle = (Math.floor(y / 10) % 2 === 0) ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)';
        c.fillRect(0, y, world.W, 10);
      }
    } else if (kind === 'dots') {
      const seed = mulberry32(7);
      c.fillStyle = 'rgba(255,255,255,0.06)';
      const step = 18;
      for (let y = step; y < world.H; y += step) {
        for (let x = step; x < world.W; x += step) {
          c.fillRect(x + (seed() * 2 | 0), y + (seed() * 2 | 0), 1, 1);
        }
      }
    } else if (kind === 'earth') {
      const seed = mulberry32(13);
      // Warm dark patches for depth.
      c.fillStyle = 'rgba(50,30,15,0.30)';
      const n1 = Math.floor(world.W * world.H / 90);
      for (let i = 0; i < n1; i++) {
        c.fillRect(Math.floor(seed() * world.W), Math.floor(seed() * world.H), 2, 1);
      }
      // Tiny grass tufts (sparse green hints).
      c.fillStyle = 'rgba(80,140,80,0.45)';
      const n2 = Math.floor(world.W * world.H / 200);
      for (let i = 0; i < n2; i++) {
        c.fillRect(Math.floor(seed() * world.W), Math.floor(seed() * world.H), 1, 2);
      }
      // Small stones / pebbles.
      c.fillStyle = 'rgba(120,110,90,0.55)';
      const n3 = Math.floor(world.W * world.H / 600);
      for (let i = 0; i < n3; i++) {
        c.fillRect(Math.floor(seed() * world.W), Math.floor(seed() * world.H), 2, 2);
      }
    } else if (kind === 'sand') {
      const seed = mulberry32(21);
      c.fillStyle = 'rgba(120,90,45,0.16)';
      const n1 = Math.floor(world.W * world.H / 70);
      for (let i = 0; i < n1; i++) c.fillRect(Math.floor(seed() * world.W), Math.floor(seed() * world.H), 2, 1);
      c.fillStyle = 'rgba(255,240,200,0.30)';
      const n2 = Math.floor(world.W * world.H / 130);
      for (let i = 0; i < n2; i++) c.fillRect(Math.floor(seed() * world.W), Math.floor(seed() * world.H), 1, 1);
      c.strokeStyle = 'rgba(150,115,60,0.12)'; c.lineWidth = 1;
      for (let y = (horizonY || 0) + 10; y < world.H; y += 16) {
        c.beginPath();
        for (let x = 0; x <= world.W; x += 8) c.lineTo(x, y + Math.sin(x * 0.05 + y) * 2);
        c.stroke();
      }
    } else if (kind === 'water') {
      c.strokeStyle = 'rgba(255,255,255,0.10)'; c.lineWidth = 1;
      for (let y = (horizonY || 0) + 6; y < world.H; y += 10) {
        c.beginPath();
        for (let x = 0; x <= world.W; x += 6) c.lineTo(x, y + Math.sin(x * 0.08 + y * 0.3) * 2);
        c.stroke();
      }
      c.fillStyle = 'rgba(120,200,230,0.10)';
      const seed = mulberry32(31);
      const n = Math.floor(world.W * world.H / 260);
      for (let i = 0; i < n; i++) c.fillRect(Math.floor(seed() * world.W), Math.floor(seed() * world.H), 3, 1);
    } else if (kind === 'snow') {
      const seed = mulberry32(53);
      c.fillStyle = 'rgba(150,170,210,0.16)';
      const n1 = Math.floor(world.W * world.H / 120);
      for (let i = 0; i < n1; i++) c.fillRect(Math.floor(seed() * world.W), Math.floor(seed() * world.H), 3, 1);
      c.fillStyle = 'rgba(255,255,255,0.55)';
      const n2 = Math.floor(world.W * world.H / 300);
      for (let i = 0; i < n2; i++) c.fillRect(Math.floor(seed() * world.W), Math.floor(seed() * world.H), 1, 1);
    } else if (kind === 'cobble') {
      const seed = mulberry32(67);
      const step = 22;
      c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 1;
      for (let y = (horizonY || 0); y < world.H; y += step) {
        const off2 = (Math.floor(y / step) % 2) * (step / 2);
        for (let x = -step; x < world.W; x += step) c.strokeRect(x + off2 + 1, y + 1, step - 2, step - 2);
      }
      c.fillStyle = 'rgba(255,255,255,0.05)';
      const n = Math.floor(world.W * world.H / 200);
      for (let i = 0; i < n; i++) c.fillRect(Math.floor(seed() * world.W), Math.floor(seed() * world.H), 1, 1);
    } else if (kind === 'grid') {
      c.strokeStyle = 'rgba(90,200,230,0.18)'; c.lineWidth = 1;
      const step = 26;
      for (let x = step; x < world.W; x += step) { c.beginPath(); c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, world.H); c.stroke(); }
      for (let y = step; y < world.H; y += step) { c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(world.W, y + 0.5); c.stroke(); }
      c.fillStyle = 'rgba(90,200,230,0.5)';
      for (let x = step; x < world.W; x += step) for (let y = step; y < world.H; y += step) c.fillRect(x, y, 1, 1);
    }
    world._floorCache = off;
  }
  // El cache mide W en coords de mundo 0..W. En escenas multi-set la cámara
  // viaja más allá: se tilea horizontalmente para cubrir la vista actual.
  const cam = world.camera || { x: world.W / 2, zoom: 1 };
  const halfView = world.W / 2 / (cam.zoom || 1) + 2;
  const x0 = Math.floor((cam.x - halfView) / world.W) * world.W;
  const x1 = cam.x + halfView;
  for (let x = x0; x < x1; x += world.W) ctx.drawImage(world._floorCache, x, 0);
}
