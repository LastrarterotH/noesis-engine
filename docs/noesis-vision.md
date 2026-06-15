# noesis — visión (definitiva, 2026-06-14)

> Reemplaza al northstar y al mvp-scope, que describían un producto SaaS BYOA
> ahora descartado. Este documento fija qué ES noesis y para quién.

## Qué es

**noesis es un motor de animaciones explicativas nativo de Claude.** Cada escena
es un JSON que el motor (`engine/`) renderiza como una pieza de pedagogía: algo
que se VE ocurrir (la mecánica), con el texto académico al lado. No es un video,
no es una diapositiva.

## Cómo se usa (la única modalidad)

A través de la skill `/noesis` (`~/.claude/skills/noesis/`). Un **autor** (una
persona con criterio, junto a Claude) dialoga el concepto, elige la mecánica que
mejor lo encarna, construye la escena con el vocabulario del motor, la valida con
`tools/validate.mjs`, corre el smoke test y la previsualiza en el navegador. El
resultado es la animación; el docente que la encarga aporta el concepto, no arma
el JSON.

La **calidad la pone el autor**, no un asistente foráneo improvisando un guion.
Esa es la diferencia con el camino anterior, y la razón de existir de la skill,
del validador y de las formas.

## Qué NO es (decidido el 2026-06-14)

- **No es self-serve para docentes no técnicos.** Se probó esa hipótesis (los
  tests BYOA, el constructor, el playground, el manual portable) y el flujo
  resultaba demasiado frágil: demasiados saltos de copia y pega, y una escena
  decente pide criterio de diseño que el promedio no improvisa. Una prueba 100%
  humana (entropía) salió "un PowerPoint muerto" aun con todo el conocimiento.
- **No es un SaaS.** El usuario decidió no invertir en un motor que no podía
  volverse SaaS, y en cambio fijarlo como motor que vive en Claude.
- **No hospeda modelos** ni depende de un LLM foráneo. El LLM es Claude, que ya
  tiene el motor, el validador y la skill a mano.

## Distribución

Open source en el repositorio, para quien sepa manejarlo desde el código y la
skill. Al que le sirva, bien; al que no, no es el público objetivo. Liberar el
repo en GitHub es coherente con esto y de costo bajo; queda como decisión aparte.

## Qué se conserva del trabajo anterior

- **El motor y el validador**: intactos, son el corazón.
- **Las nueve mecánicas** (el viajero, la población, el umbral, la convergencia,
  el antes/después, la disección, la analogía, la cadena, la transformación en
  sitio): el vocabulario de FORMAS didácticas. Viven en `CLAUDE.md`, en
  `.claude/commands/noesis-scene.md` y en el ejemplo de referencia
  (`scenes/01-netflix-prize`, la vara de calidad; el resto del repertorio se
  reconstruye tras el reinicio del 2026-06-14).
- **Las reglas ganadas en los tests** (mostrar-no-narrar, body como array, focus
  con `off: true`, sin signos de exclamación, la fórmula de tiempos, etc.): ahora
  son el checklist de autoría, no la espina de un manual portable.
- **Las formas** (`engine/forms.js`, 2026-06-14): el motor sabe expandir una
  mecánica declarada a su guion primitivo, garantizando la columna por
  construcción. Es autoría más rápida y a prueba de errores para el autor.
