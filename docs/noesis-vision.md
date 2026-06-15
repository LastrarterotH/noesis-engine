# noesis — visión

## Qué es

**noesis es un motor de animaciones explicativas nativo de Claude.** Cada escena
es un JSON que el motor (`engine/`) renderiza como una pieza de pedagogía: algo
que se VE ocurrir (la mecánica), con el texto académico al lado. No es un video,
no es una diapositiva.

## Cómo se usa

A través de la skill `/noesis` (`~/.claude/skills/noesis/`). Un **autor** (una
persona con criterio, junto a Claude) dialoga el concepto, elige la mecánica que
mejor lo encarna, construye la escena con el vocabulario del motor, la valida con
`tools/validate.mjs`, corre el smoke test y la previsualiza en el navegador. El
resultado es la animación; quien encarga la escena aporta el concepto, no arma el
JSON. La calidad la pone el autor.

No es un producto self-serve para usuarios no técnicos: una escena decente pide
criterio de diseño y conocimiento del motor.

## Distribución

Open source en el repositorio, para quien sepa manejarlo desde el código y la
skill.

## Qué sostiene la calidad

- **El motor y el validador**: son el corazón. El validador se autoderiva del
  motor, así no se desincroniza al agregar props, cielos o moods.
- **Las nueve mecánicas didácticas** (el viajero, la población, el umbral, la
  convergencia, el antes/después, la disección, la analogía, la cadena, la
  transformación en sitio): el vocabulario de FORMAS que organiza cada escena.
  Viven en `CLAUDE.md`, en `.claude/commands/noesis-scene.md` y en el ejemplo de
  referencia (`scenes/01-netflix-prize`, la vara de calidad).
- **El checklist de autoría** (mostrar-no-narrar, body como array, focus con
  `off: true`, sin signos de exclamación, la fórmula de tiempos): las
  restricciones que mantienen el nivel.
- **Las formas** (`engine/forms.js`): el motor sabe expandir una mecánica
  declarada a su guion primitivo, garantizando la columna por construcción.
