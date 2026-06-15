// noesis-engine / validate (CLI)
// Wrapper de Node sobre el núcleo del validador (engine/validate.js): lee las
// fuentes del motor con fs para construir el vocabulario y expone el CLI.
// El mismo núcleo puede correr en el navegador leyendo las fuentes con fetch.
//
// Uso:  node tools/validate.mjs                  # todas las escenas
//       node tools/validate.mjs scenes/NN-x.json # una o varias
// Sale con código 1 si hay errores. Las advertencias no fallan.
//
// También exporta validateScene(config) para smoke.mjs u otros tools.

import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename, resolve } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const { buildVocab, createValidator } = await import(join(ROOT, 'engine', 'validate.js'));

const vocab = buildVocab((f) => readFileSync(join(ROOT, 'engine', f), 'utf8'));
const { validateScene } = createValidator(vocab);
export { validateScene };

// --- CLI ----------------------------------------------------------------------

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
if (isMain) {
  const args = process.argv.slice(2);
  const files = args.length
    ? args.map(a => resolve(process.cwd(), a))
    : readdirSync(join(ROOT, 'scenes')).filter(f => f.endsWith('.json')).sort().map(f => join(ROOT, 'scenes', f));
  let bad = 0;
  for (const file of files) {
    let config;
    try {
      config = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      console.log(`FAIL  ${basename(file)}`);
      console.log(`      ✗ JSON inválido: ${e.message}`);
      bad++;
      continue;
    }
    const { errors, warnings } = validateScene(config);
    const tag = errors.length ? 'FAIL ' : 'OK   ';
    const extra = warnings.length ? `  (${warnings.length} advertencia${warnings.length > 1 ? 's' : ''})` : '';
    console.log(`${tag} ${basename(file)}${extra}`);
    for (const e of errors) console.log(`      ✗ ${e}`);
    for (const w of warnings) console.log(`      ⚠ ${w}`);
    if (errors.length) bad++;
  }
  console.log(`\n${files.length - bad}/${files.length} escenas válidas${bad ? `, ${bad} con errores` : ''}.`);
  process.exit(bad ? 1 : 0);
}
