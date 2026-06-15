// noesis-engine / mood
// Pixel-art mood overlays (tears, hearts, blush, sweat, anger marks, sparkles).
// All functions take ctx + px-painter; no closure deps.

export function drawHeart(ctx, px, hx, hy) {
  px(hx, hy, 1, 1);
  px(hx + 2, hy, 1, 1);
  px(hx - 1, hy + 1, 5, 1);
  px(hx, hy + 2, 3, 1);
  px(hx + 1, hy + 3, 1, 1);
}

export function drawSparkle(ctx, px, sx, sy) {
  px(sx, sy, 1, 1);
  px(sx - 1, sy + 1, 3, 1);
  px(sx, sy + 2, 1, 1);
}

export function drawMoodOverlays(ctx, px, hero, eyeGY, eyeGX1, eyeGX2, mood, t, outlineDim) {
  const rightCol = outlineDim;
  const leftCol = -1;

  if (mood === 'sad') {
    // Two streaming tears, one per eye, with multiple drops cascading.
    for (let eye = 0; eye < 2; eye++) {
      const ex = eye === 0 ? eyeGX1 : eyeGX2;
      const tx = hero ? ex + (eye === 0 ? 0 : 1) : ex;
      for (let d = 0; d < 4; d++) {
        const phase = ((t * 0.85) + d * 0.25 + eye * 0.12) % 1;
        if (phase < 0.05) continue;
        const fall = Math.floor(phase * (hero ? 7 : 5));
        const ty = (hero ? eyeGY + 2 : eyeGY + 1) + fall;
        const alpha = (1 - phase) * 0.9;
        ctx.fillStyle = `rgba(140,200,245,${alpha.toFixed(2)})`;
        px(tx, ty, 1, 1);
        if (hero && phase > 0.4 && phase < 0.85) {
          ctx.fillStyle = `rgba(91,141,239,${(alpha * 0.5).toFixed(2)})`;
          px(tx, ty + 1, 1, 1);
        }
      }
    }
  } else if (mood === 'love') {
    // Three hearts floating upward at staggered phases.
    for (let i = 0; i < 3; i++) {
      const phase = ((t * 0.55) + i * 0.34) % 1;
      if (phase < 0.05) continue;
      const lifecycle = 1 - phase;
      const rise = Math.floor(phase * (hero ? 9 : 7));
      const sway = Math.sin(t * 2 + i * 1.7) * 1.5;
      const side = i % 2 === 0 ? -1 : 1;
      const hx = Math.round((hero ? (side > 0 ? rightCol : leftCol + 1) : (side > 0 ? rightCol : leftCol + 1)) + sway);
      const hy = (hero ? eyeGY - 1 : eyeGY - 2) - rise;
      const alpha = Math.min(1, lifecycle * 1.4);
      ctx.fillStyle = `rgba(244,73,141,${alpha.toFixed(2)})`;
      drawHeart(ctx, px, hx, hy);
    }
    // Pink tint on pupils.
    ctx.fillStyle = 'rgba(244,73,141,0.55)';
    px(eyeGX1, eyeGY + (hero ? 1 : 0), 1, 1);
    px(eyeGX2, eyeGY + (hero ? 1 : 0), 1, 1);
  } else if (mood === 'embarrassed') {
    // Soft pink blush emerging from cheeks.
    const pulse = 0.35 + Math.sin(t * 2.5) * 0.10;
    ctx.fillStyle = `rgba(244,73,141,${pulse.toFixed(2)})`;
    if (hero) {
      px(0, eyeGY + 2, 1, 1);
      px(1, eyeGY + 2, 1, 1);
      px(7, eyeGY + 2, 1, 1);
      px(8, eyeGY + 2, 1, 1);
    } else {
      px(-1, eyeGY + 1, 1, 1);
      px(0, eyeGY + 1, 1, 1);
      px(4, eyeGY + 1, 1, 1);
      px(5, eyeGY + 1, 1, 1);
    }
    // A few embarrassment lines above
    ctx.fillStyle = `rgba(140,140,150,${(pulse * 0.6).toFixed(2)})`;
    const wob = Math.sin(t * 4) * 1;
    px(Math.round((hero ? 2 : 1) + wob), hero ? -2 : -3, 1, 1);
    px(Math.round((hero ? 6 : 3) + wob), hero ? -2 : -3, 1, 1);
  } else if (mood === 'scared' || mood === 'shocked') {
    // Multiple sweat drops trickling on both sides.
    for (let i = 0; i < 3; i++) {
      const phase = ((t * 1.3) + i * 0.33) % 1;
      if (phase < 0.05) continue;
      const fall = Math.floor(phase * 4);
      const side = i % 2 === 0 ? -1 : 1;
      const sx = side < 0 ? leftCol : rightCol;
      const sy = (hero ? 1 : 0) + fall;
      const alpha = (1 - phase) * 0.95;
      ctx.fillStyle = `rgba(160,215,250,${alpha.toFixed(2)})`;
      px(sx, sy, 1, 1);
      if (phase > 0.3) {
        ctx.fillStyle = `rgba(91,141,239,${(alpha * 0.5).toFixed(2)})`;
        px(sx, sy + 1, 1, 1);
      }
    }
    // Jittery action lines around head (shocked vibration)
    if (mood === 'shocked') {
      const jit = Math.floor(t * 14) % 4;
      ctx.fillStyle = 'rgba(244,233,72,0.7)';
      px(hero ? -2 : -2, eyeGY + jit, 1, 1);
      px(hero ? rightCol + 1 : rightCol + 1, eyeGY + ((jit + 2) % 4), 1, 1);
    }
  } else if (mood === 'angry') {
    // Steam plumes rising from top of head.
    for (let i = 0; i < 3; i++) {
      const phase = ((t * 1.4) + i * 0.33) % 1;
      if (phase < 0.05) continue;
      const rise = Math.floor(phase * 6);
      const sway = Math.sin(t * 3 + i * 2) * 1.2;
      const sx = Math.round((hero ? 2 + i * 2 : 1 + i * 1.5) + sway);
      const sy = -2 - rise;
      const alpha = (1 - phase) * 0.55;
      ctx.fillStyle = `rgba(220,220,230,${alpha.toFixed(2)})`;
      px(sx, sy, 1, 1);
    }
    // Anger mark (anime # symbol) on temple, pulsing.
    const pulse = 0.85 + Math.sin(t * 6) * 0.15;
    ctx.fillStyle = `rgba(220,75,55,${pulse.toFixed(2)})`;
    const ax = hero ? 7 : 4;
    const ay = hero ? 0 : 0;
    px(ax, ay, 1, 1);
    px(ax + 1, ay + 1, 1, 1);
    px(ax, ay + 2, 1, 1);
    px(ax - 1, ay + 1, 1, 1);
    px(ax + 1, ay - 1, 1, 1);
    // Second anger mark on the other side for emphasis
    if (hero) {
      ctx.fillStyle = `rgba(220,75,55,${(pulse * 0.7).toFixed(2)})`;
      px(1, 0, 1, 1);
      px(2, 1, 1, 1);
      px(1, 2, 1, 1);
      px(0, 1, 1, 1);
    }
  } else if (mood === 'happy') {
    // Occasional sparkle stars orbiting the head.
    for (let i = 0; i < 3; i++) {
      const phase = ((t * 0.7) + i * 0.34) % 1;
      if (phase < 0.1 || phase > 0.9) continue;
      const lifecycle = Math.sin(phase * Math.PI);
      if (lifecycle < 0.2) continue;
      const angle = (t * 0.6 + i * 2.1) % (Math.PI * 2);
      const radius = hero ? 5.5 : 4;
      const cx = Math.round((outlineDim / 2 - 0.5) + Math.cos(angle) * radius);
      const cy = Math.round((eyeGY) + Math.sin(angle) * radius * 0.7);
      const alpha = lifecycle * 0.9;
      ctx.fillStyle = `rgba(244,172,29,${alpha.toFixed(2)})`;
      drawSparkle(ctx, px, cx, cy);
    }
  } else if (mood === 'determined') {
    // Intense focus lines radiating from the head (4 short dashes).
    const pulse = 0.6 + Math.sin(t * 3) * 0.2;
    ctx.fillStyle = `rgba(244,172,29,${pulse.toFixed(2)})`;
    px(leftCol - 1, eyeGY - 1, 1, 1);
    px(leftCol - 2, eyeGY, 1, 1);
    px(rightCol + 1, eyeGY - 1, 1, 1);
    px(rightCol + 2, eyeGY, 1, 1);
    px(Math.floor(outlineDim / 2), -2, 1, 1);
    px(Math.floor(outlineDim / 2) - 1, -3, 1, 1);
    px(Math.floor(outlineDim / 2) + 1, -3, 1, 1);
  } else if (mood === 'confused') {
    // Question mark dots floating above.
    const phase = (t * 1.2) % 1;
    const alpha = Math.sin(phase * Math.PI);
    ctx.fillStyle = `rgba(140,140,150,${(alpha * 0.85).toFixed(2)})`;
    const qx = hero ? rightCol : rightCol;
    const qy = (hero ? -3 : -4) + Math.floor(Math.sin(t * 2) * 1);
    px(qx, qy, 1, 1);
    px(qx + 1, qy, 1, 1);
    px(qx + 2, qy + 1, 1, 1);
    px(qx + 1, qy + 2, 1, 1);
    px(qx + 1, qy + 4, 1, 1);
  }
}
