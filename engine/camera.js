// noesis-engine / camera
// 2D camera state: position, zoom, follow target, screen-shake. Operates on
// a `world` instance (needs world.W, world.H, world.rng); World owns the state
// and exposes _initCamera / _tickCamera as thin wrappers.

export function initCamera(world) {
  world.camera = {
    x: world.W / 2, y: world.H / 2, zoom: 1,
    targetX: world.W / 2, targetY: world.H / 2, targetZoom: 1,
    follow: null, lerpPan: 0.08, lerpZoom: 0.08,
    shakeT: 0, shakeIntensity: 0, shakeX: 0, shakeY: 0,
  };
}

export function tickCamera(world, dt) {
  const cam = world.camera;
  if (cam.follow) {
    cam.targetX = cam.follow.x;
    cam.targetY = cam.follow.y;
  }
  cam.x += (cam.targetX - cam.x) * cam.lerpPan;
  cam.y += (cam.targetY - cam.y) * cam.lerpPan;
  cam.zoom += (cam.targetZoom - cam.zoom) * cam.lerpZoom;
  if (cam.shakeT > 0) {
    cam.shakeT -= dt;
    if (cam.shakeT <= 0) {
      cam.shakeX = 0; cam.shakeY = 0;
    } else {
      const decay = Math.max(0, cam.shakeT / (cam._shakeDur || cam.shakeT));
      cam.shakeX = (world.rng() - 0.5) * 2 * cam.shakeIntensity * decay;
      cam.shakeY = (world.rng() - 0.5) * 2 * cam.shakeIntensity * decay;
    }
  }
}
