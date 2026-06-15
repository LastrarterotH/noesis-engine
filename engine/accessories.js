// noesis-engine / accessories
// Pixel-art accessories drawn on top of learners (hat, scarf, glasses, headband, pikachu, bow).

export function drawAccessories(draw, ctx, px, hero, eyeGY, accessory, opts) {
  const accessories = Array.isArray(accessory) ? accessory : (accessory ? [accessory] : []);
  for (const acc of accessories) {
    if (acc === 'hat') {
      ctx.fillStyle = opts.accessoryColor || '#1F2547';
      if (hero) {
        px(2, -1, 5, 1);
        px(3, -2, 3, 1);
        px(4, -3, 1, 1);
      } else {
        px(1, -1, 3, 1);
        px(2, -2, 1, 1);
      }
    } else if (acc === 'scarf') {
      ctx.fillStyle = opts.accessoryColor || '#a64a3e';
      if (hero) {
        px(1, 8, 7, 1);
        px(2, 9, 5, 1);
        px(6, 9, 2, 2);
      } else {
        px(0, 4, 5, 1);
      }
    } else if (acc === 'glasses') {
      // 4×4 frame around each 2×2 eye, with a bridge across.
      ctx.fillStyle = opts.accessoryColor || '#1F2547';
      if (hero) {
        // Left frame (gx 1-4, gy 2-5).
        px(1, 2, 4, 1);   // top
        px(1, 5, 4, 1);   // bottom
        px(1, 3, 1, 2);   // left side
        px(4, 3, 1, 2);   // right side
        // Right frame (gx 5-8, gy 2-5).
        px(5, 2, 4, 1);
        px(5, 5, 4, 1);
        px(5, 3, 1, 2);
        px(8, 3, 1, 2);
      } else {
        px(0, 1, 1, 1);
        px(2, 1, 1, 1);
        px(4, 1, 1, 1);
      }
    } else if (acc === 'headband') {
      // Horizontal stripe across the brow, just above eyes.
      ctx.fillStyle = opts.accessoryColor || '#F4AC1D';
      if (hero) {
        px(0, eyeGY - 1, 9, 1);
      } else {
        px(0, eyeGY - 1, 5, 1);
      }
    } else if (acc === 'pikachu') {
      const yellow = opts.body || '#F4AC1D';
      const yellowDeep = '#c88c10';
      const earDark = '#8a5810';
      const tip = '#1F2547';
      const cheek = '#d85040';
      const cheekHi = '#f08070';
      const stripe = '#9a6818';
      if (hero) {
        // Left ear (tall, leaning out)
        ctx.fillStyle = yellow;
        px(0, -2, 2, 3);
        px(-1, -1, 1, 2);
        ctx.fillStyle = earDark;
        px(1, -1, 1, 2);
        px(0, 1, 1, 1);
        ctx.fillStyle = tip;
        px(0, -3, 2, 1);
        px(-1, -2, 1, 1);
        // Right ear (mirror)
        ctx.fillStyle = yellow;
        px(7, -2, 2, 3);
        px(9, -1, 1, 2);
        ctx.fillStyle = earDark;
        px(7, -1, 1, 2);
        px(8, 1, 1, 1);
        ctx.fillStyle = tip;
        px(7, -3, 2, 1);
        px(9, -2, 1, 1);
        // Back stripes (across upper back)
        ctx.fillStyle = stripe;
        px(2, 1, 1, 1);
        px(4, 1, 1, 1);
        px(6, 1, 1, 1);
        // Cheek circles (left)
        ctx.fillStyle = cheek;
        px(-1, 4, 2, 2);
        ctx.fillStyle = cheekHi;
        px(0, 4, 1, 1);
        ctx.fillStyle = '#a02020';
        px(-1, 5, 1, 1);
        // Cheek circles (right)
        ctx.fillStyle = cheek;
        px(8, 4, 2, 2);
        ctx.fillStyle = cheekHi;
        px(8, 4, 1, 1);
        ctx.fillStyle = '#a02020';
        px(9, 5, 1, 1);
        // Lightning tail (right side, zigzag)
        ctx.fillStyle = yellow;
        px(9, 6, 1, 1);
        px(10, 5, 2, 1);
        px(11, 4, 1, 1);
        px(11, 3, 2, 1);
        px(12, 2, 1, 1);
        ctx.fillStyle = yellowDeep;
        px(9, 7, 1, 1);
        px(11, 5, 1, 1);
        px(12, 3, 1, 1);
        ctx.fillStyle = earDark;
        px(9, 7, 1, 1);
      } else {
        // Non-hero (5x5 grid, eyeGY=2)
        // Left ear
        ctx.fillStyle = yellow;
        px(-1, -2, 1, 2);
        px(0, -2, 1, 3);
        ctx.fillStyle = earDark;
        px(0, 0, 1, 1);
        ctx.fillStyle = tip;
        px(-1, -3, 1, 1);
        px(0, -3, 1, 1);
        // Right ear
        ctx.fillStyle = yellow;
        px(5, -2, 1, 2);
        px(4, -2, 1, 3);
        ctx.fillStyle = earDark;
        px(4, 0, 1, 1);
        ctx.fillStyle = tip;
        px(4, -3, 1, 1);
        px(5, -3, 1, 1);
        // Back stripes
        ctx.fillStyle = stripe;
        px(1, 0, 1, 1);
        px(3, 0, 1, 1);
        // Cheeks
        ctx.fillStyle = cheek;
        px(-1, 3, 1, 1);
        px(0, 3, 1, 1);
        px(4, 3, 1, 1);
        px(5, 3, 1, 1);
        ctx.fillStyle = cheekHi;
        px(0, 3, 1, 1);
        px(4, 3, 1, 1);
        // Lightning tail (right side, zigzag)
        ctx.fillStyle = yellow;
        px(5, 2, 1, 1);
        px(6, 1, 1, 1);
        px(6, 0, 1, 1);
        px(7, -1, 1, 1);
        ctx.fillStyle = yellowDeep;
        px(7, 0, 1, 1);
        ctx.fillStyle = earDark;
        px(7, -2, 1, 1);
      }
    } else if (acc === 'bow') {
      // Small 3-pixel bow on top of head, slightly right of center.
      ctx.fillStyle = opts.accessoryColor || '#F4AC1D';
      if (hero) {
        // Two wings + center knot
        px(5, -1, 1, 2);
        px(7, -1, 1, 2);
        px(6, 0, 1, 1);
      } else {
        px(3, -1, 1, 1);
        px(4, -1, 1, 1);
      }
    }
  }
}
