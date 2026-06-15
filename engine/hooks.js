// noesis-engine / hooks
// Compiles user-provided hook source strings (from scene JSON) into Functions.

export const HOOK_NAMES = ['onInit', 'onStep', 'onDraw', 'onClick', 'onReset'];

export const HOOK_ARGS = {
  onInit:  ['world'],
  onStep:  ['world', 'dt'],
  onDraw:  ['world', 'ctx'],
  onClick: ['world', 'x', 'y', 'meta'],
  onReset: ['world'],
};

export function compileHooks(hooks) {
  const out = {};
  for (const name of HOOK_NAMES) {
    const src = hooks[name];
    if (!src || typeof src !== 'string') continue;
    try {
      out[name] = new Function(...HOOK_ARGS[name], src);
    } catch (err) {
      console.error(`[noesis-engine] failed to compile hook ${name}:`, err);
    }
  }
  return out;
}
