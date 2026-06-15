# noesis · especificación completa del motor

Documento de referencia exhaustivo de cómo funciona noesis-engine. Verificado
contra el código en `engine/` (la versión de imports que se cita abajo es
ilustrativa).

> Fuente de verdad operativa: `CLAUDE.md` (reglas de marca, voz, estándar de
> calidad) y `.claude/commands/noesis-scene.md` (referencia de API en prosa).
> Este documento las unifica como referencia técnica del motor.

---

## 1. Modelo mental

noesis es un **motor de animaciones narrativas embebibles**. Una "escena" es un
**archivo JSON declarativo** que describe un mundo 2D (un lienzo, props, personajes
llamados *learners*, zonas, etiquetas) más, opcionalmente, **hooks** (fragmentos de
JavaScript) que controlan el comportamiento cuadro a cuadro y la narrativa.

El JSON se renderiza con un **Web Component** `<noesis-scene>` (definido en
`engine/element.js`). No hay build ni dependencias: el motor se carga como ES module.

```
scene.json  ──►  <noesis-scene src="scene.json">  ──►  World (simulación + dibujo)  ──►  <canvas>
```

### Lo declarativo vs lo imperativo (clave para una UI)

| Capa | Qué es | Serializable | Apto para UI directa |
|------|--------|--------------|----------------------|
| `meta`, `text`, `hint`, `canvas`, `ambient`, `walls`, `zones`, `props`, `entities`, `labels` | Datos puros (JSON) | Sí | **Sí**: formularios, dropdowns, color pickers, drag en canvas |
| `hooks.*` (`onInit`, `onStep`, `onDraw`, `onClick`, `onReset`) | Strings de **JavaScript** compilados con `new Function` | Sí (como texto) | **No directamente**: requiere editor de código o generador |
| `runScript([...])` (dentro de `onInit`) | DSL de pasos narrativos (array de objetos) | Sí | **Parcialmente**: la mayoría de pasos son declarativos; ver §9.3 |

La consecuencia para la UI: **todo el "escenario" (layout, catálogo de elementos,
estilo) se puede editar con formularios/canvas**. La **narrativa** vive en hooks JS;
para no obligar a escribir código, conviene apoyarse en `runScript` (cuyos pasos son
casi todos datos) y, idealmente, agregar al motor un campo declarativo `script` que
el engine ejecute solo (ver §14, recomendación).

---

## 2. Anatomía de una escena: dos archivos

1. **`scenes/NN-slug.json`** — la escena (lo que edita la UI).
2. **`examples/scene-NN.html`** — un wrapper HTML mínimo que monta el componente:

```html
<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>noesis · slug</title></head>
<body>
  <noesis-scene src="../scenes/NN-slug.json" lang="es"></noesis-scene>
  <script type="module" src="../engine/noesis-engine.js?v=19"></script>
</body></html>
```

- El engine hace `fetch(src, { cache: 'no-store' })`: nunca cachea el JSON (importante:
  una UI puede reescribir el JSON y recargar para ver cambios al instante).
- Atributos del componente: `src` (ruta al JSON), `lang` (`es`/`en`), `layout`
  (`full` por defecto, muestra el texto editorial; `bare` para teaser embebido),
  `autoplay` (arranca sin esperar viewport/foco; solo para captura headless).

---

## 3. El archivo scene.json — esquema completo

Estructura de nivel superior:

```jsonc
{
  "meta":   { ... },          // identidad + música
  "text":   { "es": {...} },  // texto editorial (artículo bajo el lienzo)
  "hint":   { "es": "..." },  // microcopy inicial sobre el lienzo
  "hintDuration": 4,           // segundos que dura el hint
  "canvas": { ... },          // lienzo, piso, cielo, calidad
  "ambient":{ ... },          // tinte + partículas atmosféricas (opcional)
  "walls":  [ ... ],          // colisiones AABB (opcional)
  "zones":  [ ... ],          // regiones con efecto (opcional)
  "props":  [ ... ],          // objetos del mundo
  "entities":[ ... ],         // learners (personajes)
  "labels": [ ... ],          // overlays HTML (captions, botones)
  "hooks":  { ... }           // JS: onInit/onStep/onDraw/onClick/onReset
}
```

### 3.1 `meta`

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | string | slug único, ej. `10-deuda-cognitiva` |
| `number` | number | número de escena |
| `version` | string | versión libre, ej. `"0.6"` |
| `lang` | string[] | idiomas presentes, ej. `["es"]` |
| `music` | string? | mood musical (ver §10). Si está, aparece el botón ♪ |

### 3.2 `text` (artículo editorial; solo en `layout=full`)

```jsonc
"text": {
  "es": {
    "title": "Título sin punto final",
    "body": [ "Párrafo con <strong>énfasis</strong>, <em>cursiva</em>, <a href>, <code>." ],
    "references": [
      { "authors": "Apellido, A.", "year": 2024, "title": "...", "journal": "...",
        "volume": "12(3)", "pages": "45-60", "doi": "10.x", "publisher": "..." }
    ]
  }
}
```
Campos de referencia opcionales: `journal`/`publisher`, `volume`, `pages`, `doi`.

### 3.3 `canvas`

| Campo | Tipo | Default | Notas |
|-------|------|---------|-------|
| `w`, `h` | number | 600×300 | tamaño **lógico** en px (las coords de la escena son en este espacio) |
| `bg` | color CSS | `#0e1430` | color de fondo |
| `floor` | enum | `solid` | textura de piso (ver §6.1) |
| `sky` | enum \| color | — | color/preset de cielo (ver §6.2). Requerido para exteriores |
| `horizon` | 0..1 | — | fracción donde cielo encuentra piso; clipa el piso y limita la `y` de learners |
| `safeArea` | number \| {top,right,bottom,left} | 18 | margen seguro para anchors y clamp de burbujas |
| `ss` | number | **3** | supersampling del backing store (estándar de calidad; bajar a `2` si una escena pesa) |
| `ysort` | bool | true | ordena props por `(z, y)`; `false` para desactivar |
| `layers` | array | — | bandas de parallax de fondo: `{ color, top, bottom, parallax, gradient?, shapes? }` |

### 3.4 `ambient` (opcional)

```jsonc
"ambient": {
  "tint": "golden" | { "color": "#F4AC1D", "alpha": 0.06 } | [ { "t": 0, "preset": "day", "alpha": 0.3 }, ... ],
  "particles": "rain" | "snow" | "petals" | "leaves" | "fireflies" | "stars",
  "intensity": 1
}
```
`tint` admite preset (`day|dawn|dusk|night|golden|cool`), objeto `{color,alpha}` o
**keyframes** (interpola contra `world.t`).

### 3.5 `walls` y `zones`

```jsonc
"walls": [ { "x":0,"y":0,"w":720,"h":14, "color":"#...", "borderColor":"#..." } ]
"zones": [ { "id":"z1","x":100,"y":100,"w":80,"h":60, "label":"calma",
             "effect": { "mood":"happy", "reinforce":{"period":2}, "quiet":true, "sleep":true } } ]
```
Walls bloquean a los learners (colisión AABB). Zones afectan a quien entra.

### 3.6 `props` (objetos del mundo)

```jsonc
{ "type":"bookshelf", "x":95, "y":318, "scale":3,
  "z":0, "color":"#...", "color2":"#...", "solid":false,
  "solidBox":{ "x":0,"y":0,"w":0,"h":0 },
  "interactive":false, "state":"off", "open":false }
```

| Campo | Notas |
|-------|-------|
| `type` | uno del catálogo (§6.3) |
| `x`, `y` | coords (§5) |
| `scale` | tamaño del bloque pixel-art (default 3) |
| `z` | capa para y-sort |
| `color` / `color2` | solo props que lo aceptan (flower, planet, gem, building=muro/ventanas, etc.) |
| `solid` / `solidBox` | colisión; caja por defecto = 60% inferior del sprite |
| `interactive` + `state`/`open` | para `switch` (`on`/`off`) y `chest` (`open` bool) |

### 3.7 `entities` (learners / personajes)

```jsonc
{ "type":"learner", "id":"alma", "x":250, "y":300,
  "scale":4, "hero":true, "body":"#d8a878",
  "name":null, "accessory":"headband", "accessoryColor":"#5b8def",
  "mood":"neutral", "stage":0, "health":"normal",
  "sleepable":false, "greets":false, "solid":false,
  "behavior":null, "_alpha":1 }
```

| Campo | Tipo / valores | Notas |
|-------|----------------|-------|
| `id` | string | único; se busca con `world.byId(id)` |
| `x`, `y` | coords (§5) | |
| `scale` | number | 3 normal, 4 héroe |
| `hero` | bool | variante de blob más grande |
| `body` | color | melocotón `#d8a878` a dorado `#e89a3a` típico |
| `name` | string \| null | etiqueta sobre la cabeza |
| `accessory` | enum \| array | `hat \| scarf \| glasses \| headband \| bow \| pikachu` |
| `accessoryColor` | color | |
| `mood` | enum | `neutral \| happy \| sad \| confused \| tired \| angry` |
| `stage` | 0..4 | intensidad del aura |
| `health` | enum | `normal \| sick \| feverish \| frozen` |
| `ageRate`, `maxAge`, `epitaph`, `leaveTombstone` | | ciclo de vida/envejecimiento |
| `extinguishable`, `extinctionThreshold` | | desvanecimiento tipo Skinner |
| `imitates`, `lookAt` | entidad | imitación / mirada (la mirada ya sigue el movimiento por defecto) |
| `sleepable` | bool | `false` = nunca duerme (escenas guionadas) |
| `greets` | bool | `false` = nunca saluda solo |
| `solid` | bool | colisión con otros learners |
| `skybound` | bool | permite estar sobre el horizonte (voladores) |
| `behavior` | objeto \| null | ver §6.7; `null` = la escena maneja la física en `onStep` |
| `_alpha` | 0..1 | opacidad (para `appear`/`vanish`) |

**Regla de marca:** los learners siempre tienen pupilas. Nunca `look:'blank'`.

### 3.8 `labels` (overlays HTML, espacio-pantalla)

```jsonc
{ "id":"cap", "html":"texto" | {"es":"...","en":"..."},
  "x":0.5, "y":0.93, "anchor":"center", "style":"css...", "hidden":true }
```

- **`x`/`y` de labels son SIEMPRE fracción 0..1** (a diferencia de props/entities que
  aceptan px). El engine hace `left: x*100%`.
- `anchor`: `center`, `top`, `bottom`, `top-left`, `top-right`, etc.
- Se controlan desde hooks con `world.showLabel(id)`, `world.hideLabel(id)`,
  `world.setLabel(id, html)`.
- **Limitación importante para la UI**: el sistema de labels **no renderiza HTML
  anidado como tarjeta** (lo aplana a texto). Para tarjetas/callouts ricos, dibujar en
  `onDraw` con canvas (dibujar la tarjeta a mano en el hook).

### 3.9 `hooks` (JavaScript)

Cinco hooks, cada uno un **string de JS** que el engine compila con
`new Function(...args, body)`. Firmas (de `engine/hooks.js`):

| Hook | Args | Cuándo |
|------|------|--------|
| `onInit` | `(world)` | al montar y tras cada reset; setear estado, cablear labels, lanzar `runScript` |
| `onStep` | `(world, dt)` | cada frame; `dt` en segundos |
| `onDraw` | `(world, ctx)` | cada frame, después de piso/zonas/muros/props y antes de ambient/fx |
| `onClick` | `(world, x, y, meta)` | click; `(x,y)` en coords de mundo (post-cámara) |
| `onReset` | `(world)` | antes de re-ejecutar `onInit`; limpiar timeouts propios |

**Validación obligatoria** (la UI debe correr esto antes de guardar): cada hook no
vacío debe compilar. Pre-flight:
```js
new Function('world', onInitSource);  // etc., con las args correctas por hook
```

---

## 4. Ciclo de vida y runtime

`engine/element.js` (`NoesisScene`) monta el componente:
1. `fetch` del JSON (`cache:'no-store'`), crea `<canvas width=w*ss height=h*ss>`.
2. Instancia `World(config, canvas, host)` (`engine/world.js`).
3. **Gates de arranque**: por defecto espera a estar en viewport (`IntersectionObserver`),
   pestaña visible (`visibilitychange`) y ventana enfocada (`blur/focus`). `autoplay`
   los saltea.
4. Loop `requestAnimationFrame`: `runStep(dt)` → `runDraw()` cada frame.
5. `world.reset()` re-corre `onReset` y luego `onInit` (estado `world.state` se reinicia).

Detalles de render (`runDraw`):
- Contexto escalado por `_ss` (= `canvas.width / W`) → se dibuja en coords lógicas.
- Orden: layers/parallax → **transformada de cámara** → piso → zonas → muros → props
  → `onDraw` → fx → (fin cámara) → ambient → watermark "noesis." (screen-space).
- **`onDraw` ocurre DENTRO de la transformada de cámara.** Para dibujar HUD fijo a
  pantalla hay que deshacer la cámara (patrón: guardar el encuadre y restaurarlo en `onDraw`).
- **Watermark "noesis." inalienable**: estampado en screen-space al final; no se puede
  tapar desde la escena.

---

## 5. Coordenadas y anchors

En `props`, `walls`, `zones`, `entities`:
- Número `0..1` → fracción del canvas (de `W` para x, `H` para y).
- Número `>= 1` → píxeles.
- String anchor: `"left+10"`, `"right-20"`, `"center"`, `"top+5"`, `"bottom-30"`
  (respeta `safeArea`).

**Excepción:** `labels` solo aceptan fracción `0..1`.

---

## 6. Catálogos (enumeraciones para dropdowns de la UI)

### 6.1 Pisos (`canvas.floor`)
`solid` · `grass` · `tiles` · `wood` · `dots` · `earth` · `sand` · `water` · `snow` · `cobble` · `grid`

### 6.2 Cielos (`canvas.sky`, preset o color CSS)
`day` · `dawn` · `dusk` · `night` · `golden` · `cool` · `storm` · `sunset` · `overcast` · `space` · `underwater` · `mars` · `aurora`

### 6.3 Props (catálogo `PROP_SPRITES`)
**Estáticos pixel-art:** `table`, `chair`, `blackboard`, `lamp`, `candle`, `book`,
`bookshelf`, `door`, `sign`, `rug`, `tree`, `plant`, `bush`, `flower`, `mushroom`,
`rock`, `fountain`, `bench`, `boat`, `lighthouse`, `pedestal`, `cactus`, `palm`,
`coral`, `seaweed`, `building`, `streetlamp`, `crate`, `barrel`, `sun`, `moon`,
`star`, `planet`, `rocket`, `gem`, `coin`, `balloon`, `pokeball`.
**Animados (drawer propio, se mueven solos):** `cloud`, `bird`, `fish`, `rabbit`,
`butterfly`, `bee`, `frog`, `swing`, `clock`, `candle`, `bonfire`, `bell`, `lamp`,
`streetlamp`.
**Interactivos (click, requieren `interactive:true`):** `switch` (`state:'on'|'off'`),
`chest` (`open: bool`).
Varios aceptan `color` (y `building` también `color2`).

### 6.4 Accesorios de learner (`accessory`)
`hat` · `scarf` · `glasses` · `headband` · `bow` · `pikachu`

### 6.5 Moods (`mood`)
`neutral` · `happy` · `sad` · `confused` · `tired` · `angry`

### 6.6 Partículas ambientales (`ambient.particles`)
`rain` · `snow` · `petals` · `leaves` · `fireflies` · `stars`

### 6.7 Behaviors de learner (`entity.behavior`)
```js
{ type:'walkTo', target:{x,y}, speed:60, threshold:4, minDistance:0, onArrive:fn }
{ type:'fleeFrom', source:{x,y}, speed:80 }
{ type:'idleWander', amplitude:18 }
{ type:'patrolBetween', points:[{x,y},...], speed:55, threshold:6 }
{ type:'followEntity', target:entity, distance:40, speed:60 }
{ type:'followPath', points:[...], speed|duration, easing, curve, loop }
{ type:'stop' }
null  // la escena maneja la física en onStep (set vx/vy/x/y)
```

### 6.8 Easings (tweens / followPath)
`linear` · `easeIn` · `easeOut` · `easeInOut` · `easeInCubic` · `easeOutCubic` · `easeInOutCubic` · `easeOutBack` · `easeOutElastic`

---

## 7. API imperativa (`world.*`) — para hooks

Métodos públicos de `World` (de `engine/world.js`):

| Método | Qué hace |
|--------|----------|
| `world.W`, `world.H` | dimensiones lógicas |
| `world.t`, `world.frame` | tiempo (s) y contador de frames |
| `world.entities`, `world.props`, `world.walls`, `world.zones` | arrays del mundo |
| `world.state` | objeto scratch de la escena (se borra en reset) |
| `world.rng()` | RNG sembrado [0,1) |
| `world.byId(id)` | buscar entidad |
| `world.spawn(type, props)`, `world.spawnLearner(props)` | crear en runtime |
| `world.remove(predicate)` | filtrar entidades |
| `world.showLabel(id)`, `world.hideLabel(id)`, `world.setLabel(id, html)` | labels |
| `world.tween(obj, prop, dest, opts)` / `world.tween(obj, {a,b}, opts)` | animar valores |
| `world.stopTweens(obj?)` | cancelar tweens |
| `world.runScript(steps, opts)` / `world.stopScripts(id?)` | timeline (§9) |
| `world.drawSorted(items)` | dibujo con y-sort mixto props+learners |
| `world.reset()` | reinicia la escena |
| `world.draw.*` | primitivas de dibujo (§11) |
| `world.fx.*` | efectos (§8) |
| `world.camera` | `{ x, y, zoom, targetX, targetY, targetZoom, follow, shakeX, shakeY }` |
| `world.host` | el elemento `<noesis-scene>` |

---

## 8. `world.fx.*` — efectos (lista completa)

De `engine/fx.js` (`createFxApi`):

**Sobre un learner:** `surprise` · `reinforce` · `flash` · `mood(e,mood,dur)` ·
`health(e,h,dur)` · `sleep` · `wake` · `appear(e,dur)` · `vanish(e,dur,onDone)` ·
`die(e,opts)` · `revive` · `jump(e,opts)` · `celebrate(e,opts)` · `cry(e,opts)` ·
`achievement(e,points)` · `failure(e)` · `lightPulse`.

**Habla y pensamiento:** `say(e,html,opts)` · `think(e,html,opts)` · `exclaim` ·
`wonder` · `thinking` · `dialogue(e,[msgs],{interval,kind,onEnd})` · `cancelDialogue(id)`.

**Espacial / mundo:** `transfer(from,to,opts)` (línea punteada ámbar + partículas;
`from`/`to` aceptan `{x,y}` o entidad) · `packet` · `floatNumber(x,y,text,opts)` ·
`particles(x,y,{count,color,speed,duration,gravity,spread,size})` ·
`sequence([{at,do}])` · `followPath(e,points,opts)`.

**Cámara:** `cameraFollow(e,opts)` · `cameraZoom(z,opts)` · `cameraPan(x,y,opts)` ·
`cameraShake(intensity,dur)` · `cameraReset({instant})`.

**Audio:** `tone(freq,dur,{type,vol,attack})` · `sweep(from,to,dur,{type,vol})` ·
`ambientSound`/`stopAmbientSound` · `ambientMusic`/`ambientMusicStop`.

**Transición / script:** `transitionTo` · `runScript` · `stopScripts`.

---

## 9. `runScript` — timeline narrativo

`world.runScript(steps, { id })`: ejecuta pasos en orden; los pasos bloqueantes
(`wait`, `waitFor`, `waitUntil`) pausan la secuencia. Pasar `{ id }` reemplaza un
script previo del mismo id. `world.stopScripts(id?)` cancela.

### 9.1 Ejemplo
```js
world.runScript([
  { say:'beto', text:'Voy a la campana', duration:2.5 },
  { wait:1 },
  { walk:'beto', to:[235,380], speed:80 },
  { waitFor:'arrive' },
  { tone:1320, dur:0.45 },
  { mood:'beto', value:'happy', duration:1.4 },
  { set:{ score:0 } }, { add:{ score:1 } },
  { do:"world.fx.celebrate(world.byId('beto'));" }
], { id:'main' });
```

### 9.2 Pasos disponibles (de `engine/scripts.js`)
**Tiempo/flujo:** `wait:<s>` · `waitFor:'arrive'|'arrive:id'` · `waitUntil:'<expr>'` ·
`label:'x'` + `goto:'x'` · `loop:true` · `end:true` · `if:'expr', then:[...], else:[...]`.
**Movimiento:** `walk:<id>, to:[x,y]|<id>, speed?` · `stop:<id>` ·
`path:<id>, points:[...], speed|duration, easing, curve, loop, fromCurrent`.
**Expresión/burbujas:** `say` · `think` (con `text`, `duration?`) · `exclaim` ·
`surprise` · `wonder` · `flash` · `reinforce` · `mood:<id>, value, duration?`.
**Audio:** `tone:<freq>, dur?, opts?` · `sweep:[from,to], dur?, opts?`.
**Efectos:** `particles:{...}` · `floatNumber:{...}`.
**Estado:** `set:{k:v}` · `add:{k:delta}` · `clamp:{k:[min,max]}`.
**Escape a JS:** `do:'<js>'` (scope: `world`, `state`/`s`, `e`=última entidad) ·
`call:'<expr>'` · `runScript:[...]` (anidado).

### 9.3 Para la UI
Casi todos los pasos son **datos puros serializables** (un timeline visual puede
emitirlos sin escribir JS). Los únicos no-declarativos son `do:` y `call:` (escotilla
a JS). Una UI puede: (a) ofrecer un timeline con los pasos declarativos, y (b) un
editor de código solo para `do:`/`call:` y los hooks.

---

## 10. Audio y música

Música procedural (Web Audio, sin archivos) en `engine/audio.js`. Se activa con
`meta.music = <mood>` y el botón ♪.

**Moods:** `cosmic` · `melancholic` · `pastoral` · `epic` · `ancient` · `pedagogical` ·
`electronic` · `warm`.

Un preset (`MUSIC_PRESETS`) puede declarar **capas de movimiento** (opt-in):
- `chords` (acordes en Hz) + `chordDur`: progresión (el drone se re-afina).
- `arp` (`[{v,oct}]`) + `arpStep`/`arpDur`/`arpVol`/`arpType`: arpegio/melodía.
- `pulse` + `pulseStep`/`pulseDur`/`pulseVol`: latido grave.
- `grow` + `elecStep`/`elecVol`/`growDur`: capa que crece en el tiempo.
`warm` es la referencia. Presets sin estas claves = drone simple.

---

## 11. `world.draw.*` — primitivas de dibujo (en `onDraw`)

De `engine/draw.js` (`class Draw`):
- **Personaje:** `learner(entity, opts?)`.
- **Geometría:** `rrect(x,y,w,h,r)`.
- **Diagramas:** `arrow(x1,y1,x2,y2,opts)` · `connector(from,to,opts)` ·
  `node(x,y,w,h,opts)`.
- **Gráficos:** `axes(x,y,w,h,opts)` (devuelve `frame` con `map()`) · `plot(frame,data,opts)` ·
  `bars(frame,values,opts)` · `stackedBars` · `scatter` · `area` · `pie` · `gridlines`.

---

## 12. Tweens y movimiento por camino

- `world.tween(obj, 'prop', destino, opts)` o `world.tween(obj, {x,y}, opts)`.
  `opts`: `duration` (s), `easing` (§6.8), `delay`, `onStart/onUpdate/onDone`.
  Devuelve handle con `.cancel()`. Se limpian en cada reset.
- `world.fx.followPath(entity, points, opts)` o behavior `followPath` o step `path`.

---

## 13. Grabación y estándar de calidad

- Botón ● graba con `MediaRecorder`: resetea a t=0, activa música si la hay, graba el
  canvas (`captureStream(60)`) + audio, y auto-detiene en `s.showReplay = true`.
- **Estándar de calidad:** supersampling `ss = 3` por defecto (`800×450` → render/graba
  a `2400×1350`); bitrate `24 Mbps`. Una escena puede bajar `canvas.ss` si pierde frames.
- WebM → MP4 alta calidad: `QUALITY=12 tools/webm-to-mp4.sh archivo.webm` (requiere ffmpeg).

---

## 14. Guía para construir la UI (editor de escenas)

### 14.1 Estructura sugerida
1. **Lienzo de edición (WYSIWYG):** monta un `<noesis-scene>` en vivo + una capa de
   edición encima para arrastrar/seleccionar props, entities, zones, walls y labels.
   Mapear arrastre a `x/y`; resize a `scale`/`w/h`.
2. **Panel de propiedades** del elemento seleccionado: formularios tipados a partir del
   esquema (§3), con **dropdowns** desde los catálogos (§6) y **color pickers**.
3. **Panel de canvas/atmósfera:** `bg`, `floor`, `sky`, `horizon`, `ambient`, `ss`.
4. **Timeline narrativo:** editor visual de `runScript` (§9.3) con los pasos
   declarativos; bloques arrastrables (walk, say, wait, mood, tone, set...).
5. **Editor de código (avanzado):** para `hooks` y pasos `do:`/`call:`, con un editor
   tipo Monaco y autocompletado del API de §7–§12.
6. **Texto editorial:** formulario para `title`, `body[]`, `references[]`.
7. **Preview en vivo:** reescribir el JSON y re-montar/recargar el componente (el engine
   usa `cache:'no-store'`, así que basta reasignar `src` o re-crear el elemento).
8. **Export:** descargar `scenes/NN-slug.json` + generar el wrapper HTML (§2).

### 14.2 Validación (la UI debe correrla antes de guardar)
- **Hooks compilan:** `new Function(...args, src)` por hook (args de §3.9).
- **Labels:** `x/y` en `0..1`.
- **Coords coherentes**, ids únicos, `accessory`/`mood`/`floor`/`sky`/prop `type` dentro
  de los catálogos.
- **Smoke headless** (opcional pero recomendado): `node tools/smoke.mjs` stubea DOM y
  corre el engine real (init + 120 ticks + click + reset). Caza errores que `node --check`
  no ve.

### 14.3 Recomendación de motor para hacer la UI 100% visual
Hoy la narrativa vive en `hooks.onInit` (JS) que llama a `world.runScript([...])`. Para
que una UI pueda producir narrativa **sin escribir JS**, conviene agregar al engine un
campo declarativo de nivel superior, por ejemplo `scene.script` (array de pasos de §9.2)
que el motor ejecute automáticamente en `onInit`. Así:
- La UI emite `script` como datos puros (timeline visual) y solo cae a `hooks`/`do:`
  para casos avanzados.
- Compatibilidad: si `scene.script` existe, el engine hace `world.runScript(scene.script,{id:'main'})`
  tras `onInit`; las escenas actuales no se ven afectadas.

### 14.4 Qué NO debe romper la UI (invariantes del engine)
- Fetch de escenas con `cache:'no-store'`.
- Burbujas clampeadas dentro del canvas (`safeArea`).
- Watermark "noesis." intacto (no taparlo).
- Learners siempre con pupilas (nunca `look:'blank'`).
- Reglas de marca/voz (paleta canónica, sin em-dashes, español neutro): ver `CLAUDE.md`.

---

## 15. Apéndice: escena mínima

```json
{
  "meta": { "id": "demo", "number": 0, "version": "0.1", "lang": ["es"] },
  "canvas": { "w": 800, "h": 450, "bg": "#3c463a", "floor": "wood", "horizon": 0.6 },
  "props": [ { "type": "plant", "x": 700, "y": 360, "scale": 3 } ],
  "entities": [
    { "type": "learner", "id": "a", "x": 200, "y": 320, "scale": 4, "body": "#d8a878",
      "accessory": "headband", "sleepable": false, "behavior": null }
  ],
  "labels": [ { "id": "cap", "html": "", "x": 0.5, "y": 0.9, "anchor": "center",
    "style": "color:#eef1f6;font:500 14px ui-sans-serif;text-align:center;", "hidden": true } ],
  "hooks": {
    "onInit": "world.runScript([{ do:\"world.showLabel('cap'); world.setLabel('cap','Hola');\" },{ wait:1 },{ walk:'a', to:[500,320], speed:80 },{ waitFor:'arrive' },{ do:\"world.fx.celebrate(world.byId('a'));\" }], { id:'main' });",
    "onStep": "",
    "onDraw": "for (const e of world.entities) if (e.type==='learner') world.draw.learner(e);",
    "onClick": "",
    "onReset": "const a=world.byId('a'); if(a){a.x=200;a.y=320;a.behavior=null;} world.hideLabel&&world.hideLabel('cap');"
  }
}
```

---

### Mapa de módulos del engine (referencia)
`element.js` (web component, loop, grabación) · `world.js` (simulación + draw) ·
`draw.js` (primitivas) · `mood.js` (caras) · `accessories.js` · `prop-draw.js` +
`prop-sprites.js` (props) · `sky-presets.js` · `floor.js` · `ambient.js` ·
`camera.js` · `scripts.js` (runScript) · `learner.js` (behaviors) ·
`animated-props.js` · `interaction.js` (click) · `fx.js` (efectos) · `audio.js`
(sonido/música) · `hooks.js` (compilación) · `util.js` (color/rng/ease/APA).
