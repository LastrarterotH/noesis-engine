# Changelog

Bitácora del proyecto. Las entradas más recientes van arriba. Formato libre,
inspirado en [Keep a Changelog](https://keepachangelog.com/), adaptado al
ritmo del proyecto.

## 2026-06-14 · Reinicio del repertorio (solo queda la 01)

### Decisión
- Se borran las escenas **02-12** para reconstruir el repertorio desde cero,
  ahora que noesis es un motor nativo de Claude (sin intermediario self-serve:
  ver entrada del pivote, abajo). Los ejemplos viejos se habían hecho en parte
  bajo la hipótesis BYOA; rehacerlos deliberadamente bajo la modalidad nueva
  evita arrastrar los mismos caminos.
- **`01-netflix-prize` se mantiene** como la vara de calidad y el ejemplo de
  referencia de cómo usar el motor. Es la única escena del repertorio por ahora.
- Recuperables por git si hiciera falta.

### Borrado
- `scenes/02-12.json` (11 escenas) y sus wrappers `examples/scene-02..12.html`.
- El **muestrario** completo: el directorio `muestrario/` (`muestrario.json` +
  `muestrario.html`) y su generador `tools/gen-muestrario.mjs`. El motor no tenía
  ninguna dependencia funcional de él (era catálogo visual de referencia, no
  repertorio); se va para dejar el repo mínimo de cara a reconstruir las escenas.
- `validate` y `smoke` siguen en verde corriendo solo la 01.

### Docs
- Se limpiaron las referencias a las escenas borradas y al muestrario en
  `CLAUDE.md`, `README.md`, `MANUAL.md`, `docs/noesis-vision.md`,
  `docs/noesis-spec.md`, `docs/noesis-rediseno-pedagogico.md` y el command
  `/noesis-scene`: la documentación del motor y el catálogo de mecánicas se
  conservan, pero ya no citan ejemplos canónicos por archivo ni el muestrario.
  La única escena referenciada es la 01. Este CHANGELOG conserva las entradas
  históricas tal cual (es bitácora, no estado vigente).

## 2026-06-14 · Pivote: noesis es un motor nativo de Claude

### Decisión
- Se descarta la modalidad **self-serve BYOA** (docente no técnico + su propio
  chatbot + playground). El flujo tenía demasiados saltos de copia y pega y una
  escena decente pide criterio de diseño que el promedio no improvisa (una
  prueba 100% humana de entropía salió "un PowerPoint muerto").
- noesis pasa a ser **un motor de animaciones explicativas que vive en Claude y
  se usa a través de la skill `/noesis`**. La calidad la pone un autor (humano +
  Claude). Open source para quien lo maneje desde el repo. Visión en
  `docs/noesis-vision.md`.

### Retirado
- `constructor.html`, `playground.html`, `manual-para-generar-escenas.md`
  (el aparato BYOA: armaban el encargo y validaban JSON de un LLM foráneo).
- `docs/noesis-northstar.md`, `docs/noesis-mvp-scope.md`,
  `docs/noesis-declarative-gap.md` (charters y análisis del SaaS).
- Recuperables por git. Su valor (mecánicas, reglas de los tests, ejemplos) ya
  vive en `CLAUDE.md`, el command y la skill.

### Engine — Formas (`engine/forms.js`)
- El motor ahora **sabe expandir una mecánica declarada a su guion primitivo**.
  Una "forma" (`config.form`) encarna la columna de una mecánica: el autor da el
  contenido por etapa y el motor garantiza el arco, los tiempos de lectura y la
  espina de mostrar-no-narrar, por construcción.
- Primera forma: **`viajero`** (mecánica 1). Compila a steps de `walk`/`path` +
  `caption` + `focus`/`mood`/`weather`/`particles` con waits calculados. Rechaza
  una forma sin viaje real ("es un cabezón parlante"): la regla de oro de los
  tests ahora es imposible de violar.
- Fuente única de verdad usada por el motor (`world.js`) y el validador
  (`validate.js`, que valida el guion COMPILADO con el `vSteps` de siempre).
  `form` es clave top-level. (Se probó con un fixture del ciclo del agua que
  luego se retiró en la limpieza; la próxima escena de viajero real la ejercita.)
- Cache buster a `?v=63`.

### Limpieza del repositorio y publicación
- `scenes/` queda con SOLO el repertorio real (`01-12`). Se borraron los fixtures
  demo (`90-93`), los scratch de prueba (`95-97`) y el de forma (`98`): el motor
  no depende de escenas-demo (su cobertura sale del repertorio real y del
  muestrario), y las features viven en los docs.
- El **muestrario** salió de `scenes/` a su propio directorio `muestrario/`
  (`muestrario.json` + `muestrario.html`), generado por `tools/gen-muestrario.mjs`.
  Es catálogo de referencia, no parte del repertorio; el smoke lo sigue corriendo.
- `LICENSE` MIT añadido y **repo publicado en GitHub (público)**.

## 2026-06-01 · Sistema de tweens

### Engine
- `world.tween(obj, prop, destino, opts)` (y variante multi-propiedad
  `world.tween(obj, {x,y}, opts)`): anima valores numéricos, gestionado por
  el loop. `opts`: `duration`, `easing` (9 curvas), `delay`,
  `onStart/onUpdate/onDone`. `from` se captura al arrancar; devuelve handle
  con `.cancel()`. `world.stopTweens(obj?)` cancela; se limpian en reset.
- Easing centralizado en `util.js: ease`, compartido con `followPath`.
- Documentado en `CLAUDE.md`. Cache buster a `?v=17`.

### Escena 13
- Banda "tweens": tres marcadores en ping-pong con easings distintos
  (`linear`, `easeInOut`, `easeOutBack`) para comparar el timing.

## 2026-06-01 · Movimiento por camino (followPath)

### Engine
- Nuevo behavior `followPath` (`learner.js`): una entidad recorre una lista
  de waypoints. `speed` constante o `duration` + `easing`
  (`easeIn/easeOut/easeInOut`); `curve` suaviza con spline Catmull-Rom;
  `loop`, `fromCurrent`, `onArrive`. Mueve inyectando la velocidad que
  aterriza en el siguiente punto, así siguen aplicando límites del mundo,
  mirada y bob de caminata.
- Helper `world.fx.followPath(entity, points, opts)` y step de script
  `{ path, points, speed|duration, easing, curve, loop }`.
- `waitFor: 'arrive'` ahora espera a `walkTo` y a `followPath`.
- Documentado en `CLAUDE.md`. Cache buster a `?v=16`.

### Escena 13
- Banda "movimiento": un blob recorre un camino curvo en bucle, con la
  trayectoria dibujada. Referencia visual del behavior.

## 2026-06-01 · Primitivas de gráfico en el motor

### Engine
- Helpers de gráfico en `world.draw` (desde `onDraw`), para plots de
  matemática, física y datos:
  - `axes(x,y,w,h,opts)`: marco 2D; devuelve un frame con `map(dataX,dataY)`
    para convertir datos a píxeles. Ticks con formato, `xLabel/yLabel`, opción
    `grid` y `frame` (caja vs ejes en L). Ejes en el cero si está en el dominio.
  - `plot(frame,data,opts)`: función muestreada o array de puntos; `fill`
    (área), `dots` (marcadores) y `reveal` (0..1) para animar el trazo.
  - `bars(frame,values,opts)`: barras etiquetadas con `reveal`.
  - `gridlines(frame,{x,y,color})`: cuadrícula de fondo (también `grid:true`
    en `axes`).
  - `scatter(frame,points,opts)`: nube de puntos sin línea.
  - `area(frame,upper,lower,opts)`: relleno entre dos series.
  - `stackedBars(frame,groups,opts)`: barras apiladas o agrupadas (`grouped`).
  - `pie(cx,cy,r,values,opts)`: circular o dona (`innerR`) con % opcional.
- Defaults en paleta de marca, todo overrideable. Documentado en `CLAUDE.md`.
- Cache buster del grafo unificado a `?v=15`.

### Escena 13
- Banda "gráficos" ampliada a grilla 3×2: sin x (grid+fill+reveal animado),
  barras etiquetadas, dona con %, scatter, área entre curvas, barras apiladas.
  Referencia visual viva de las primitivas.

## 2026-06-01 · Toolkit de diagramas en el motor

### Engine
- Helpers de diagrama en `world.draw` (invocables desde `onDraw`), para
  flujos, grafos, redes, líneas de tiempo y vectores, en lugar de dibujar
  flechas a mano con `moveTo/lineTo`:
  - `rrect(x,y,w,h,r)`: path de rect redondeado compartido (cada escena lo
    redefinía en su hook).
  - `arrow(x1,y1,x2,y2,opts)`: línea con punta (`color`, `width`, `alpha`,
    `dash`, `head`, `both`, `curve`).
  - `connector(from,to,opts)`: flecha entre puntos o entidades, recorta los
    extremos al borde de cada nodo y admite `label` con chip de fondo.
  - `node(x,y,w,h,opts)`: caja-nodo con relleno/borde/label; devuelve anclas
    de borde (`top/bottom/left/right`) para encadenar conectores.
- Defaults en paleta de marca, todo overrideable. Documentado en `CLAUDE.md`.
- Cache buster del grafo de módulos unificado a `?v=13`.

### Escena 13
- Nueva banda "diagramas" en el muestrario: referencia visual viva del
  toolkit (pipeline de nodos con conectores etiquetados, lazo de
  realimentación curvo, flecha de doble punta, conector entre blobs que
  recorta al borde de cada uno).

## 2026-06-01 · Escena 13: muestrario visual del motor

### Escenas (nuevas)
- **13 · Muestrario** (Referencia). Una sola grilla con todo el catálogo
  que el motor sabe dibujar: 13 cielos (color base real de `SKY_PRESETS`),
  11 pisos (texturas representativas de `floor.js`), 36 props agrupados
  por familia (sprites estáticos + animados, dibujados vivos desde el
  array `props`), 10 moods y 6 accesorios (vía `world.draw.learner` en
  posiciones de grilla). No es narrativa: hoja de referencia estática,
  sin música ni replay. Generada con `tools/gen-muestrario.mjs`.

## 2026-05-31 · Refactor de transiciones + capturas reales del catálogo

### Engine
- `world.fx.transitionTo(x, y, opts)`: helper del engine que orquesta
  fade a negro, teleport de cámara y fade in. Usa un scrim propio
  (`world._transitionScrim`) que vive entre el ambient y el watermark, así
  el wordmark "noesis." queda legible durante el negro.
- Escenas 07 y 08 dejan de duplicar la lógica de transición y delegan al
  engine.
- Cache busters unificados a `?v=7` en el grafo de módulos completo.

### Catálogo
- Previews PNG reales capturados por escena con `tools/capture.mjs` (Chrome
  headless + `--virtual-time-budget`, espera curada por escena). Reemplazan
  los placeholders SVG.
- `tools/preview.html`: wrapper mínimo `layout="bare"` que el script de
  captura consume con `?s=<slug>`.

## 2026-05-30 · Cierre del catálogo de 8 escenas + reglas fundacionales

### Escenas (nuevas)
- **03 · Diabolus in musica** (Música). Tritono y su prohibición sacra.
- **04 · Modelo MDA** (Pedagogía). Mecánicas, Dinámicas, Estéticas
  (Hunicke, LeBlanc, Zubek 2004) aplicado a un mini videojuego de física.
- **05 · Fuera de juego** (Deporte). Regla 11 de IFAB con campo a canvas
  completo, 10 blobs y línea del penúltimo defensor calculada dinámicamente.
- **06 · Tetraktys pitagórica** (Filosofía). Pitágoras y cuatro discípulos
  alrededor de los diez puntos. Cuerdas con razones 1:1, 2:1, 3:2, 4:3 y
  juramento conservado por Jámblico.
- **07 · Día D** (Historia). Película corta en seis sets (sala de mapas,
  paracaidistas, lanchas, Omaha, Pointe du Hoc, bocage) con cámara que
  pasa entre ellos. Lancha LCVP, búnker con muzzle flash, Rangers en
  acantilado, jeep, vacas, iglesia normanda.
- **08 · Big Bang** (Cosmología). Seis eras (singularidad, inflación,
  recombinación, primeras estrellas, galaxias, hoy). Distintos tipos de
  galaxia, nebulosas con filamentos, cosmic web, Tierra con luna en
  órbita y flechas de expansión.

### Engine
- Watermark `noesis.` inalienable: dibujado en `world.js` después del
  frame; ninguna escena puede taparlo.
- Música ambiental procedural: `createAmbientMusic(mood)` en `audio.js`
  con siete moods (`cosmic`, `melancholic`, `pastoral`, `epic`, `ancient`,
  `pedagogical`, `electronic`). Cada escena la declara con `meta.music`.
  Botón `♪` en el UI; default off. Sin archivos externos.
- Tiempo de gracia obligatorio (~3 s) antes del botón "Ver nuevamente".
- Burbujas con wrap forzado: `max-width: min(420px, 78%)`, `text-align:
  left`, `letter-spacing: 0`, `word-spacing: normal`. Aplicados también
  como inline styles desde `fx.js` para ganar cualquier herencia
  inesperada.
- Letter-spacing moderado: `0.12em` en small caps editoriales,
  `0.08em` en hint y name-label.

### Catálogo y branding
- Previews estáticos (SVG placeholder primero, después PNG real).
- `index.html` y `landing.html` actualizados a 8 escenas publicadas.

### Convenciones
- `CLAUDE.md` y `.claude/commands/noesis-scene.md` documentan watermark,
  tiempo de gracia, reglas de wrap, letter-spacing y declaración de
  `meta.music`.

## 2026-05-29 y antes · Reconstrucción del engine

- Engine descompuesto en módulos ES (`world`, `element`, `draw`, `mood`,
  `accessories`, `prop-draw`, `prop-sprites`, `sky-presets`, `audio`,
  `hooks`, `util`, `camera`, `ambient`, `scripts`, `floor`,
  `animated-props`, `learner`, `interaction`, `fx`).
- Smoke test headless (`tools/smoke.mjs`): construye `World`, ejecuta
  120 ticks, simula click + reset; falla ante cualquier excepción.
- Supersampling del canvas para texto nítido al escalar.
- Escenas históricas reescritas a la base actual: 01 Transformers, 02
  Solipsismo.
- `index.html` (catálogo) y `landing.html` con look estilo Apple.

Para detalle granular ver `git log`.
