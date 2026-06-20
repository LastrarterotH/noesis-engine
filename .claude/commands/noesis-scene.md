---
description: Generate a new noesis-engine scene from a description. Produces a `scenes/NN-slug.json` + `examples/scene-NN.html`, ready to view at http://localhost:8765/examples/scene-NN.html
---

# /noesis-scene

You are generating a new scene for **noesis-engine**, a narrative animation engine. Each scene is a JSON file at `scenes/NN-slug.json` rendered by a `<noesis-scene>` Web Component. This command writes the JSON and a thin HTML wrapper, then reports the URL.

## Input

El método de autoría de noesis es teatral: lo ideal es partir de un guion teatral
(la guía está en `docs/guion-teatral.md`) y traducirlo al vocabulario de abajo.
Si el usuario trae un guion, síguelo beat por beat; si no, dialógalo en ese
formato antes de construir.

The user invokes `/noesis-scene <description> [flags]`. Parse:

- **description** (required) — free text; may name a theory, an author, a vivid metaphor, or a scenario ("aula", "parque", "noche", etc.).
- `--autor "Apellido"` — anchor a specific author or source.
- `--referencias-min N` — require at least N APA references (default 3 for pedagogical scenes, 0 for non-pedagogical).
- `--canvas WxH` — canvas size in pixels (default 720x400).
- `--idiomas es,en` — language blocks to emit (default both).
- `--escenario indoor|outdoor` — biases the prop set and floor pattern.
- `--atmosfera day|dawn|dusk|night|petals|leaves|rain|snow|fireflies|stars` — preset for `ambient`.
- `--ruta PATH` — custom output path.
- `--pedagogica false` — skips theory and references (for atmospheric or playful scenes).

If the description is too vague, ask one clarifying question before generating.

## Steps you must follow

1. **Find next scene number.** `ls scenes/` and pick the next free NN. `scenes/` holds only the real pedagogical repertoire (01 currently).
2. **Choose a kebab-case slug** based on the central concept.
3. **Draft the text** (see voice rules below) in the requested languages.
4. **Draft the simulation**: pick entities, props, ambient, walls, zones, and hooks that incarnate the concept.
5. **Pre-flight check**: for each non-empty hook, run `node -e "new Function('world', 'dt', '...')"` with the right arg signature. Hooks must compile cleanly. Fix and re-check.
6. **Write `scenes/NN-slug.json`** with the full config.
7. **Write `examples/scene-NN.html`** using the template at the bottom of this doc.
8. **Confirm `python3 -m http.server 8765` is running** at the project root (`curl -s -o /dev/null -w "%{http_code}" http://localhost:8765/`). If not, start it in background.
9. **Report**: the JSON path, the embed snippet, and the URL `http://localhost:8765/examples/scene-NN.html`. Plus one or two lines on what to observe.

Do not take headless screenshots — the user verifies visually.

## scene.json shape

```json
{
  "meta": { "id": "slug", "number": 7, "version": "0.1", "lang": ["es", "en"] },
  "text": {
    "es": {
      "title": "Título sin punto final",
      "body": [
        "Párrafo 1. <strong>énfasis</strong>, <em>cursiva</em>, <a href='...'>enlaces</a>, <code>código inline</code> permitidos.",
        "Párrafo 2..."
      ],
      "references": [
        { "authors": "Apellido, A.", "year": 2024, "title": "Título", "journal": "Revista", "volume": "12(3)", "pages": "45-60", "doi": "10.1234/xyz" },
        { "authors": "Otro, B.", "year": 2010, "title": "Libro entero", "publisher": "Editorial" }
      ]
    },
    "en": { "title": "...", "body": [...], "references": [...] }
  },
  "hint": { "es": "instrucción inicial corta", "en": "short initial instruction" },
  "canvas": { "w": 720, "h": 400, "bg": "#0e1430", "floor": "grass" },
  "ambient": { "tint": "golden", "particles": "petals", "intensity": 1 },
  "walls":  [ { "x": 0, "y": 0, "w": 720, "h": 14 } ],
  "zones":  [ { "id": "z1", "x": 100, "y": 100, "w": 80, "h": 60, "label": "calma", "effect": { "mood": "happy" } } ],
  "props":  [ ... ],
  "labels": [ { "id": "btn-x", "html": "TEXTO", "x": 0.5, "y": 0.9, "anchor": "center", "style": "..." } ],
  "entities": [
    { "type": "learner", "id": "alma", "x": 0.5, "y": 0.5, "name": "Alma", "body": "#d8a878",
      "accessory": "scarf", "stage": 0, "mood": "neutral", "behavior": null,
      "sleepable": true, "greets": true }
  ],
  "hooks": {
    "onInit":  "/* args: world */",
    "onStep":  "/* args: world, dt */",
    "onDraw":  "/* args: world, ctx */",
    "onClick": "/* args: world, x, y, meta */",
    "onReset": "/* args: world */"
  }
}
```

Coords between 0 and 1 (entity, prop, wall, zone, label) get normalized to canvas pixels. **Labels are special: their `x`/`y` MUST be fractions 0..1.** The engine always does `x * 100` → `left: N%` (element.js ~L550), so a label with `x: 256` lands at `left: 25600%`, off-screen. Props/entities/walls/zones accept px (>=1) too; labels do not.

## Engine API reference

### `world` inside hooks

- `world.W`, `world.H` — canvas dimensions in pixels.
- `world.t` — seconds since scene start (or last reset).
- `world.frame` — integer frame counter.
- `world.entities` — array. Filter by `type === 'learner'` etc.
- `world.props`, `world.walls`, `world.zones` — world layer arrays (read-only mostly).
- `world.state` — free-form scratch object for scene-wide variables. Wiped on reset.
- `world.rng()` — seeded RNG returning [0, 1).
- `world.byId(id)` — find entity by id.
- `world.spawn(type, props)`, `world.spawnLearner(props)` — create at runtime.
- `world.remove(predicate)` — filter entities out.
- `world.showLabel(id)`, `world.hideLabel(id)`, `world.setLabel(id, html)` — toggle persistent labels.
- `world._labels` — Map of label id → DOM element (for wiring clicks).
- `world.host` — the `<noesis-scene>` element (has `.shadowRoot`).
- `world.draw.learner(entity, opts?)` — render a learner (with all internal state).
- `world.fx.*` — FX triggers (see full list below).
- `world.camera` — `{ x, y, zoom, targetX, targetY, targetZoom, follow, shakeT, shakeIntensity, ... }`.

### `world.fx` (FX triggers)

**On a learner:**
- `surprise(entity, duration?)` — eyes widen briefly + chirp.
- `reinforce(entity, duration?)` — golden halo pulses + 12 amber particles + warm chord.
- `flash(entity, duration?)` — bright cream burst + 10 cream particles.
- `mood(entity, mood, duration?)` — set mood with optional auto-revert.
- `health(entity, h, duration?)` — set health ('sick' / 'feverish' / 'frozen' / 'normal').
- `sleep(entity)` — force sleep. `wake(entity)` — refresh touch + light tone.
- `appear(entity, dur?)` — fade in. `vanish(entity, dur?, onDone?)` — fade out.
- `die(entity, opts?)` — life-cycle death. `revive(entity)` — back to life.
- `jump(entity, opts?)` — short sinusoidal arc.
- `celebrate(entity, opts?)` — mood happy + jump + halo + multi-color confetti + ascending chord.
- `cry(entity, opts?)` — mood sad + falling blue tears + descending sweep.
- `achievement(entity, points?)` — celebrate + floating "+N".
- `failure(entity)` — cry + "?" bubble.

**Speech and thought (also touch the speaker so they don't fall asleep):**
- `say(entity, html, opts?)` — speech bubble (Plus Jakarta Sans).
- `think(entity, html, opts?)` — thought bubble (Fraunces italic with dot-trail tail).
- `exclaim(entity, opts?)` — "!" bubble.
- `wonder(entity, opts?)` — "?" bubble.
- `thinking(entity, opts?)` — "..." animated dots bubble.
- `dialogue(entity, [msg1, msg2, ...], { interval, kind, onEnd })` — sequence of bubbles. Returns id; `cancelDialogue(id)` aborts.

**Spatial / world:**
- `transfer(from, to, opts?)` — golden dotted pulse line from → to + 7 amber particles on receiver.
- `floatNumber(x, y, text, opts?)` — text rises and fades.
- `particles(x, y, { count, color, speed, duration, gravity, spread, size })` — generic particle burst.
- `sequence([{ at, do }, ...])` — schedule callbacks with relative timing in seconds.

**Audio (arbitrary tones):**
- `tone(freq, duration?, { type, vol, attack })` — single tone with envelope.
- `sweep(from, to, duration?, { type, vol })` — pitch sweep.

Use for bells, alarms, knocks, beeps, custom musical cues inside scene hooks.

**Script timeline (`world.runScript`):**

For sequential narrative (walk → wait → say → walk → ...) prefer `world.runScript([...])` over nested `setTimeout`. Steps process in order, blocking on `wait`, `waitFor`, or `waitUntil`.

```js
world.runScript([
  { say: 'beto', text: 'Voy a la campana' },
  { wait: 1 },
  { walk: 'beto', to: [235, 380], speed: 80 },
  { waitFor: 'arrive' },
  { tone: 1320, dur: 0.45 },
  { exclaim: 'beto' },
  { wait: 1 },
  { walk: 'beto', to: [600, 290] },
  { waitFor: 'arrive' },
  { do: 's.dropFood();' },
  { add: { score: 1 } }
], { id: 'main-loop' });
```

Step keys (one primary action per step; combine multiple keys if they should fire on the same tick):

- `wait: <sec>` — block N seconds (blocking).
- `waitFor: 'arrive'` — block until the last `walk` entity reaches its target (blocking).
- `waitFor: 'arrive:beto'` — same but explicit entity id (blocking).
- `waitUntil: '<expr>'` — block until JS expression is truthy, evaluated each tick. Scope: `world`, `state`, `s` (blocking).
- `walk: <id>, to: [x,y] | <otherId>, speed?: 70` — set walkTo behavior.
- `stop: <id>` — set behavior to stop.
- `say: <id>, text: '...', duration?: 2.5` / `think: <id>, text: ..., duration?` — bubble.
- `exclaim: <id>` / `surprise: <id>` / `wonder: <id>` / `flash: <id>` / `reinforce: <id>`.
- `mood: <id>, value: 'happy', duration?: 1.4`.
- `tone: <freq>, dur?, opts?` / `sweep: [from, to], dur?, opts?`.
- `particles: { x, y, color, count, ... }` / `floatNumber: { x, y, text }`.
- `set: { key: value }` — assign to `world.state[key]`.
- `add: { key: delta }` — additive (numbers only).
- `clamp: { key: [min, max] }` — clamp `state.key`.
- `tween: '<key>' | '<id>.<prop>', to: <num>, duration?: 0.6, easing?: 'easeInOut'` — animate a `world.state` key (`'deuda'`) or an entity property by id (`'alma._alpha'`) without JS. Don't combine with `walk`/`meter` in the same step (all read `to`).
- `chart: '<id>', show?: true | hide?: true | alpha?: <0..1>, reveal?: <0..1>, series?: '<seriesId>', duration?, easing?` — declarative charts: show/hide a top-level `charts` entry and reveal its line series (or its bars, without `series`) at the right beat. Charts draw in world space (camera push-in magnifies them). See scene 91 for the fixture.
- `do: '<js code>'` — escape hatch, scope: `world`, `state`, `s`, `e` (last walked entity).
- `call: '<expr>'` — eval expression, if it returns a function, invoke it.
- `runScript: [...]` — start a nested script concurrently.
- `label: 'name'` then `goto: 'name'` for jumps. `loop: true` restarts. `end: true` stops the script. `if: 'expr', then: [...], else: [...]` inlines a conditional branch.

Concurrent scripts allowed. Pass `{ id: 'name' }` so a fresh call replaces a previous one. `world.stopScripts(id?)` cancels by id (or all).

**Declarative replay (top-level `script`):** when the scene declares a top-level `script` array (instead of running scripts from hooks), the engine handles the replay button by itself: 3 s after the script ends it shows "Ver nuevamente", sets `state.showReplay = true` (which also stops a video recording) and resets the scene on click. Don't draw a replay button in declarative scenes. A `loop: true` script never ends, so it never shows replay.

**Camera:**
- `cameraFollow(entity, opts?)` — follow with lerp. `cameraFollow(null)` to stop.
- `cameraZoom(level, opts?)` — smooth zoom transition.
- `cameraPan(x, y, opts?)` — smooth pan to point.
- `cameraShake(intensity, duration)` — shake with decay.
- `cameraReset({ instant? })` — return to default.

### Entity (learner) properties

```
id, x, y                       coords (0-1 fractional or pixels)
scale: 4                        pixel block size (3 default, 4 hero)
hero: true                      bigger blob variant
body: '#d8a878'                 main body color
name: 'Alma'                    floating name label (small caps over head)
accessory: 'hat'                hat | scarf | glasses | headband | bow (or array)
accessoryColor: '#1F2547'       override accessory color
mood: 'neutral'                 neutral | happy | sad | confused | tired
stage: 0                        0..4, drives aura intensity
health: 'normal'                normal | sick | feverish | frozen
ageRate: 0                      years per second
maxAge: null                    auto-die at this age
epitaph: '...'                  custom death message
leaveTombstone: true            show tombstone after death
extinguishable: false           opt-in to Skinner-style fade
extinctionThreshold: 8          s without reinforce before fade
imitates: otherEntity           copies target's mood periodically
lookAt: id | {x,y}              blob quieto mira a esa entidad o punto (el movimiento manda; cámbialo con `do`)
sleepable: true                 false = never sleep (scripted scenes)
greets: true                    false = never auto-greet
solid: true                     false = no collision with other learners
behavior: { type, ... }         see Behaviors below
```

### Behaviors

```js
{ type: 'walkTo',         target: { x, y }, speed: 60, threshold: 4, minDistance: 0, onArrive: fn }
{ type: 'fleeFrom',       source: { x, y }, speed: 80 }
{ type: 'idleWander',     amplitude: 18 }
{ type: 'patrolBetween',  points: [{x,y},{x,y}, ...], speed: 55, threshold: 6 }
{ type: 'followEntity',   target: entity, distance: 40, speed: 60 }
{ type: 'stop' }
behavior: null                  scene-owned physics (set vx/vy/x/y in onStep yourself)
```

If `behavior` is set, engine auto-applies velocity, bounces off canvas edges, separates from other solid learners, and pushes out of walls and solid props. If `null`, scene's onStep owns the physics.

### Props (full catalog)

**Indoor**: `table`, `chair`, `blackboard`, `lamp`, `candle`, `book`, `door`, `sign`, `rug`, `rug-stripes`, `rug-medallion`, `rug-checker`.

**Outdoor / natural**: `tree`, `plant`, `bush`, `flower` (color configurable), `flower-cluster`, `mushroom`, `path-tile`, `rock`, `fountain`, `bench`, `tall-grass`.

**Animated (auto-moving)**: `butterfly` (color configurable, flutters in figure-8), `cloud` (drifts right, wraps), `bird` (flies across, flaps), `fish` (swims in figure-8), `rabbit` (hops).

**Interactive (click to toggle)**: `switch` (state: 'on' | 'off'), `chest` (open: true | false). Both require `interactive: true`.

**Celestial / espacio**: `sun`, `moon`, `star`, `planet` (color y color2: el cuerpo recolorea entero, no solo un tono), `rocket`. (Colocar arriba del horizonte en escenas con cielo.) `planet`/`sun`/`moon` flotan solos despacio; para una órbita, anima la Luna con un `path` en loop.

**Bioma / urbano**: `cactus`, `palm`, `coral` (color), `seaweed`, `building` (color = muro, color2 = ventanas), `streetlamp`, `crate`, `barrel`.

**Juego / recompensa**: `gem` (color), `coin`, `balloon` (color), `domino` (ficha que se vuelca: `fall` 0..1 la inclina hacia `dir`, animable con `tween "id.fall"`; para un efecto dominó, vuelca varias en secuencia con `wait` entre cada una). Todos pixel-art escalables con `scale`; los marcados con (color) respetan `prop.color` (y `building` también `prop.color2`).

**Símbolos didácticos**: `lightbulb`, `hourglass`, `scale`, `magnifier`, `key`, `trophy`, `flag` (color), `flask` (color = líquido), `globe`, `scroll`, `gear`; paisaje: `mountain`.

**Notación científica/matemática**: en cualquier texto (captions, diálogos, título, body, labels) usa `_` para subíndice y `^` para superíndice: `CO_2`, `H_2O`, `x^2`, `m^3`, o varios caracteres entre llaves: `SO_4^{2-}`, `10^{-9}`, `E = mc^2`. Nunca escribas «CO2» plano. Para una ecuación con notación LaTeX completa (fracciones apiladas, raíces, griegas, operadores) envuélvela en `$...$` y usa el subconjunto LaTeX (`\frac{}{}`, `\sqrt{}`, `\Delta`, `\ln`, `\le`, `\to`, `\cdot`...): `$\Delta S = nR\ln\frac{V_f}{V_i} > 0$`. Lo natural es ponerla en un `label` y revelarla con `showLabel`.

**Conceptual / morph**: `field` (campo de partículas orden→desorden: `w`, `h`, `cols`, `rows`, `color`/`color2`, y `disorder` 0..1 animable con `tween "id.disorder"`; opcionales `homeFrac` = el orden ocupa solo esa fracción izquierda y el desorden esparce por todo, para un gas confinado que se expande, y `jitter` = tembleque base de gas). Para entropía, mezcla, difusión, cambio de fase, expansión libre. El desorden se ve en las partículas: no le pongas una barra.

**Personajes / escena (bespoke, dibujados en vivo)**: `cat` (gato con formas suaves, no pixel: `pose` `walk`/`curl`/`fall`, `color` recolorea el pelaje entero, `dir` espeja, `alpha` 0..1 lo vuelve fantasma para doble exposición, respira en `curl`) y `vault` (caja fuerte de frente en dos capas que el z-index intercala con otros props: `face` `back`/`front`, `glass` 0..1 vuelve la cara translúcida para ver el interior, `wheel` en radianes gira el volante, `lift` en celdas la eleva sobre una mesa con ruedas, `color` tiñe el metal).

**Mitología / naturaleza (bespoke salvo donde se indica)**: `pomegranate` (granada partida con anillo de seis semillas glossy; `seeds` 0..6, comerlas las quita una a una), `column` (sprite: columna de inframundo), `wheat` (espigas de trigo dorado con vaivén), `chasm` (grieta en la tierra con luz rojiza pulsante; `open` 0..1, animable con `tween "id.open"`), `wonderflower` (flor que cicla de color con resplandor) y `tree-bare` (árbol desnudo de invierno con nieve; gemelo de `tree`, se cruza con él vía `alpha` por temporada).

**IA / tecnología (bespoke)**: `aiorb` (orbe de IA: anillo segmentado que rota, núcleo-lente que late y puntos en órbita; `color`, `alpha`; flota, no se apoya en el suelo), `notebook` (cuaderno de espiral: tapa con `color`, anillos metálicos y etiqueta; `glow` 0..1 para el resplandor cuando la IA procesa), `genially` (logo de Genially: aro arcoíris, disco navy y espiral blanca con punto; `color` tiñe el disco, `spin` en radianes gira el aro, `glow` 0..1, `alpha`) y `basilisk` (criatura digital: `eye` 0..1 modula su poder, emite chispas verde/cian y lluvia de código).

**`alpha` en sprites y capas**: además de los bespoke, los props de sprite y las `canvas.layers` aceptan `alpha` (0..1), animable con `tween "id.alpha"` (flores que brotan/marchitan) o, para una capa de fondo, con un `do` que tweenee el objeto de `canvas.layers`. Declara un `alpha` inicial para que el tween tenga origen.

**Notación paso a paso**: declara `labels` con `"hidden": true` y revélalos en el guion con `{ "showLabel": "id" }` / `{ "hideLabel": "id" }`, para construir un panel de fórmulas a un lado mientras la animación corre (con la notación `_`/`^`: `ΔS = nR ln(V_f / V_i) > 0`).

**Tamaño natural**: un prop SIN `scale` toma su default por tipo (`PROP_NATURAL_SCALE` en `prop-sprites.js`), proporcionado contra un learner hero a scale 5 (flor pequeña, mesa a la cintura, árbol al doble de la persona). Omite `scale` salvo intención deliberada (protagonismo, lejanía).

**Solidity**: any prop can have `solid: true`. Default collision box is the bottom 60% of the sprite. Override with `solidBox: { x, y, w, h }` (coords relative to prop anchor: x=0 is horizontal center, y=0 is the floor).

### Floor patterns (`canvas.floor`)

`solid` (none) | `grass` (verde vivo con blades + flores hint) | `tiles` (rejilla sutil) | `wood` (tablones) | `dots` (puntos esparcidos) | `earth` (tierra cálida con tufts de pasto y guijarros) | `sand` (granos + dunas suaves) | `water` (olas + reflejos) | `snow` (chispas frías) | `cobble` (adoquines de piedra) | `grid` (rejilla neón sci-fi).

El piso es un overlay de textura sobre `canvas.bg`: conviene elegir un `bg` acorde (por ejemplo `bg` arena para `sand`, azul para `water`).

### Sky and horizon (outdoor scenes)

**Outdoor scenes MUST set sky + horizon**, otherwise the canvas looks dead. Indoor scenes skip these.

```json
"canvas": {
  "w": 760, "h": 460,
  "bg": "#3d2a18",         // ground color
  "floor": "earth",
  "sky": "#c47850",         // sky color (REQUIRED for outdoor)
  "horizon": 0.42           // fraction 0-1 where sky meets ground
}
```

`canvas.sky` acepta un nombre de preset (se resuelve en el engine vía `SKY_PRESETS`) o cualquier color CSS:
- `day` `#7fa8c8` · `dawn` `#e8a888` · `dusk` `#c47850` · `night` `#1a2a4a` · `golden` `#d8a868` · `cool` `#5a708a`
- `storm` `#5f6b78` · `sunset` `#e0683c` · `overcast` `#97a3b0` · `space` `#0a0f24` · `underwater` `#11617a` · `mars` `#b9633c` · `aurora` `#163a4a`

Position rules:
- Sky props (cloud, bird, sun, stars): `y` ABOVE horizon (smaller than `horizon * H`)
- Ground props (tree, blob, flower, bench): `y` AT OR BELOW horizon
- The engine clips floor textures to the ground region automatically.
- The engine auto-constrains every learner's `y` to be at or below the horizon (learners cannot walk in the sky). Opt-out with `entity.skybound: true` for flying characters (rare).

### Ambient

```js
"ambient": {
  "tint": "day|dawn|dusk|night|golden|cool" | { "color": "#xxx", "alpha": 0.3 },
  "particles": "rain|snow|petals|leaves|fireflies|stars",
  "saturation": 0,
  "intensity": 1
}
```

- `saturation` (0..1, default 1): satura TODO el mundo dibujado. `0` = escala de grises, `1` = color pleno; el HUD (captions, watermark) queda siempre en color. Animar con `{ "tween": "ambient.saturation", "to": 1, "duration": 2.4, "easing": "easeInOutCubic" }` para un viraje gris→color en un momento. Es la mecánica del color como experiencia que los hechos no contienen (ver escena 02). No la dejes a medio camino de forma permanente: el valor está en el viraje.

### Walls and zones

Walls: `{ x, y, w, h, color?, borderColor? }`. Block learner movement (AABB).

Zones: `{ id, x, y, w, h, label?, color?, borderColor?, effect?: { mood?, reinforce?: {period}, quiet?, sleep? } }`. Affect learners that step inside.

### Labels

```json
{ "id": "x", "html": "TEXT" | { "es": "...", "en": "..." },
  "x": 0.5, "y": 0.9, "anchor": "top-left|top-right|center|...",
  "style": "css-string",
  "hidden": false }
```

To make a clickable button, set `pointer-events:auto; cursor:pointer;` in style and wire in onInit:

```js
const el = world._labels?.get('btn-x');
if (el) el.addEventListener('click', e => { e.stopPropagation(); /* action */ });
```

### Hook signatures

- `onInit(world)` — once at mount and after each reset. Set state, wire labels, schedule timeouts.
- `onStep(world, dt)` — every frame. dt in seconds.
- `onDraw(world, ctx)` — every frame after engine draws floor/zones/walls/props but before ambient + fx. Typically iterates entities calling `world.draw.learner(e)`.
- `onClick(world, x, y, meta)` — on canvas click. `(x, y)` are world coords (post-camera). `meta.consumed` is true if click already hit an interactive prop.
- `onReset(world)` — before re-running onInit. Clear any timeouts you set.

For scripted scenes that use `setTimeout`, store ids on `world._sceneTimeouts` so onReset can clear them.

### Replay button: tiempo de gracia obligatorio

Toda escena con botón "Ver nuevamente" debe insertar al menos 3 segundos extra de `{ wait: 3 }` entre el último cap/diálogo y `s.showReplay = true`. El usuario necesita tiempo de lectura antes de ver la opción de repetir.

### Wordmark "noesis." del engine

El engine estampa "noesis." en la esquina inferior derecha de cada lienzo (ver `world.js: _drawWatermark`). No intentes ocultarlo, taparlo ni reposicionarlo desde la escena: vive en screen-space tras todo el render. Si la escena necesita usar esa esquina del canvas, mover el contenido de la escena, no el watermark.

### Banda de subtítulos y tamaño de personajes (máximas)

**La banda inferior es de los subtítulos.** El motor reserva una franja al pie del lienzo para los captions e impide que cualquier learner (y su name-label) la invada: `learner.js` clampa la base de todo learner por encima de `H - CAPTION_BAND - NAME_RESERVE` (56 + 20). Al componer, ubica a los personajes bien por encima del borde inferior; si la escena necesita más aire, sube `canvas.h`, nunca metas personajes en la banda. El motor lo fuerza igual, pero authoring correcto evita que te los suba de golpe.

**Nada de blobs enanos.** Los personajes secundarios (estudiantes, público, acompañantes) van del porte del protagonista: `hero: true` con scale comparable (5). Nada de blobs chicos no-hero (scale 3-4): se leen como enanos. Tamaños menores solo para una mecánica de población/multitud deliberada.

## Style and palette (brand-aligned)

**HUD / UI / text overlays — strict editorial palette:**
- Navy `#1F2547` — body text, structural lines, dark UI backgrounds.
- Ámbar `#F4AC1D` — small caps labels, dividers, callouts, links. Punctual use only.
- Papel `#FBFAF6` — light backgrounds (never `#FFFFFF`).
- Papel cálido `#F6F2E8` — callout/card backgrounds.
- Slate `#6E7896` — secondary text, captions, references.
- Línea `#E8E2D2` — separators.
- Never pure white or pure black. Never em dashes (use commas, colons, parentheses).

**Canvas world — freedom with harmony:**
- Default bg: navy-tinted dark `#0e1430` or grass green `#4f8a4f`.
- Stimulus / reinforcement: ámbar `#F4AC1D`.
- Cool / concept: blue `#5b8def` or `#22c4f8`.
- Living / experience: green `#4f8a5e`.
- Problem: red `#a64a3e` or `#c44a3e`.
- Learner body: warm peach `#d8a878` to dorado `#e89a3a`.

## Voice rules for the prose

- First person, observing the phenomenon. Sober, argumentative, gremial, iberoamericana.
- **Neutral Latin American Spanish. Never voseo or Argentine accent.** Banned: «mirá», «fijate», «dale», «vos», «podés», «tenés», «armás», «observá». Use «mira», «fíjate», «puedes», «tienes», «observa»; for plural, «ustedes». Applies to dialogue, hints, and copy.
- For each technical term: `<strong>name</strong>`, attribute to author with year, offer author's own metaphor in `<em>` ("yo lo llamo *el resplandor que despierta la mirada*").
- Be honest about limits: "X did not posit a single event; what they described is..."
- Do not invent citations. If you're unsure of a reference, drop the claim or ask the user.
- **No em dashes anywhere.** Use commas, colons, parentheses. Hyphens only for ranges (`pp. 25-42`).
- No marketing adjectives ("innovador", "revolucionario", "único"). No exclamation marks. No rhetorical questions of the "¿y si pensáramos esto distinto?" type.
- Avoid the patterns brand §7.4 prohibits: negación-afirmación ("no es X, sino Y"), regla de tres retórica, apertura tripartita, falso dilema binario, remate sentencioso.
- 4 to 8 short paragraphs per scene.

## examples/scene-NN.html template

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>noesis-engine · {{title}}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@1,9..144,400;1,9..144,500;1,9..144,600;1,9..144,700&display=swap" rel="stylesheet">
<style>
  body { margin: 0; background: #FBFAF6; color: #1F2547;
    font: 16px/1.65 'Plus Jakarta Sans', system-ui, sans-serif; }
  .page { max-width: 800px; margin: 0 auto; padding: 56px 24px 96px; }
  .wordmark { font: 600 12px/1 'Plus Jakarta Sans', system-ui, sans-serif;
    letter-spacing: 0.22em; color: #6E7896; text-transform: uppercase; margin-bottom: 40px; }
</style>
</head>
<body>
<div class="page">
  <div class="wordmark">noesis-engine · escena NN · {{slug}}</div>
  <noesis-scene src="../scenes/NN-slug.json" lang="es"></noesis-scene>
</div>
<script src="../engine/noesis-engine.js?v=NN-1"></script>
</body>
</html>
```

The cache-buster version (`?v=...`) should be unique per scene so the browser fetches a fresh engine bytecode bundle when the user reloads.

## Output format when reporting back

```
✦ scene NN written to scenes/NN-slug.json
✦ html at examples/scene-NN.html
✦ url: http://localhost:8765/examples/scene-NN.html
✦ embed: <noesis-scene src="scenes/NN-slug.json" lang="es"></noesis-scene>

Qué observar: <una o dos líneas sobre la mecánica de la escena>.
```

That's all. Write tight, working JSON. Compile-check hooks. Confirm the URL.
