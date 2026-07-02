# noesis-engine

Engine para construir animaciones narrativas embebibles. Cada escena es un JSON en `scenes/NN-slug.json`, envuelta por un HTML mínimo en `examples/scene-NN.html`, y se renderiza vía el Web Component `<noesis-scene>` definido en `engine/noesis-engine.js`.

noesis es un **motor de animaciones explicativas nativo de Claude**. Cada escena es una pieza de pedagogía: algo que se VE ocurrir (la mecánica), con su texto académico al lado. No es un video ni una diapositiva, y no es un producto self-serve para usuarios no técnicos. Se usa a través de la skill `/noesis` (`~/.claude/skills/noesis/`): un autor con criterio, junto a Claude, dialoga el concepto, elige la mecánica que mejor lo encarna, construye la escena con el vocabulario del motor, la valida con `tools/validate.mjs` y la previsualiza. La calidad la pone el autor. El repo es open source para quien lo maneje desde el código. La visión completa está en `docs/noesis-vision.md`. El método de autoría (escribir primero un guion teatral y de ahí traducir al motor) está en `docs/guion-teatral.md`: es el punto de partida de toda escena nueva.
## Cómo previsualizar

El engine se sirve estático. Desde la raíz del proyecto:

```bash
python3 -m http.server 8765
```

Y abrir `http://localhost:8765/examples/scene-NN.html` en el navegador. **No tomes screenshots**: el usuario verifica visualmente, tú solo devuelves la URL.

El engine fetchea las escenas con `cache: 'no-store'` a propósito. Cualquier cambio en el loader debe preservar esto.

## Smoke test headless

```bash
node tools/smoke.mjs
```

Stubea canvas/DOM/window y corre el engine real sin navegador: por cada escena construye `World`, ejecuta `runInit` + 120 ticks de `runStep`/`runDraw`, simula un click, llama `reset()` y tickea de nuevo. Cualquier excepción es un FAIL. Caza los bugs silenciosos de ESM que `node --check` no ve (imports rotos, `this`/`world` mal traducidos, métodos inexistentes). Correrlo tras cualquier cambio al engine. No reemplaza la verificación visual: no mira píxeles, solo que nada explote.

## Validador de escenas

```bash
node tools/validate.mjs                    # todas las escenas
node tools/validate.mjs scenes/NN-x.json   # una o varias
```

Chequea cada JSON contra el vocabulario real del motor antes de correrlo: claves conocidas (top-level, canvas, entidades, props, labels, steps), enums (props, cielos, pisos, moods, accesorios, partículas, sonidos, música, easings, behaviors), coordenadas y anchors, labels en fracción 0..1, ids de entidades y meters referenciados por los steps, compilación de hooks y de expresiones `do`/`if`/`call`/`waitUntil`, y reglas editoriales (em-dashes y voseo en los textos). Los enums se importan o se escanean del código del motor en runtime, así el validador no se desincroniza al agregar props, cielos o moods. Los mensajes de error dicen qué se encontró y qué valores son válidos, pensados para que un LLM (o un humano) corrija solo. `smoke.mjs` lo corre automáticamente antes de tickear cada escena; los errores de vocabulario son FAIL aunque la escena "corra". Además chequea las **rutas** (`checkMovement`): rastrea las posiciones de las entidades a lo largo del guion y avisa (warning) cuando un `walk` haría que un learner atraviese a otro cuerpo en el trayecto, o cuando dos entidades arrancan solapadas.

## Verificación visual headless (shoot.mjs)

```bash
node tools/shoot.mjs <slug> <t1,t2,...>   # ej: node tools/shoot.mjs 01-netflix-prize 5,9,13
```

Renderiza UNA escena en varios timestamps a `/tmp/shot_NN.png` vía CDP (igual que `capture.mjs`: una sesión de Chrome, navega a `preview.html?s=slug`, screenshot en los tiempos pedidos, en tiempo real). Sirve para que el autor REVISE una escena él mismo (composición, foco, transiciones, capas) sin depender de que el usuario grabe un webm. Pre-requisito: server local arriba (`python3 -m http.server 8765`). Nota: glob vacío en zsh (`rm -f /tmp/shot_*.png` sin matches) aborta la cadena `&&`; borrar los archivos por nombre o sin `&&`.

## Cache busters (al editar el engine)

El engine se carga como árbol de ES modules y cada `import './x.js?v=N'` se cachea
por URL completa, query string incluido. Tras tocar CUALQUIER archivo de `engine/`
hay que bumpear el cache buster en TODOS los imports y wrappers, no solo en el
`<script>` de entrada, o el navegador sirve módulos viejos (y un Cmd+Shift+R no
limpia el module cache). Dos versiones distintas en el grafo cargan un módulo dos
veces y DUPLICAN su estado: bug sutil. Un comando lo unifica (macOS / BSD sed):

```bash
sed -i '' 's/?v=[a-zA-Z0-9-]*/?v=<nueva>/g' engine/*.js examples/*.html
grep -rho '?v=[0-9]*' engine examples | sort -u   # debe quedar UN solo valor
```

## Slash command

`/noesis-scene <descripción> [flags]` genera una escena nueva siguiendo todas las reglas de este documento. Definido en `.claude/commands/noesis-scene.md`. Solo aparece si Claude Code se lanza desde la raíz del proyecto.

## Mecánicas didácticas

Principio organizador: cada escena encarna UNA mecánica visual; el diálogo solo acompaña, nunca sustituye al fenómeno que se ve ocurrir. El catálogo de mecánicas es: el viajero, la población, el umbral, la convergencia, el antes/después, la disección, la analogía, la cadena (dominó) y la transformación en sitio (entropía/morph). Diferidas por solape: ensamblaje y propagación. El repertorio se construye deliberadamente alrededor de estas mecánicas, una escena a la vez; hoy existe `01-netflix-prize` como vara de calidad y ejemplo de referencia.

## Checklist de autoría

Reglas destiladas que el validador no siempre atrapa: son de calidad didáctica o de detalle semántico, no de vocabulario. Cada una es parte del estándar de autoría:

- **Muestra la demostración, no la narres.** Si la escena habla de un barco que flota y una moneda que se hunde, pon el `boat` y la `coin` y anímalos al agua; no dejes a los personajes reaccionando a algo invisible.
- **Los personajes actúan la mecánica.** Las reacciones (`mood`), `walk` y los FX son solo para learners; los props con vida (bird, fish...) no se dirigen. El narrador es `caption`, no un learner invisible.
- **`text.es.body` es un array de párrafos**, no un string con `<p>` (el engine tolera el string, pero el array es la forma correcta).
- **`ambient`, `charts` y `sets` son claves top-level**, no van anidadas dentro de `canvas`.
- **Apagar un foco** es `{ "focus": "<id>", "off": true }`, no `{ "focus": "off" }`. El foco acepta entidad, prop, punto o chart por id.
- **Movimiento vertical hacia el cielo**: marca `entity.skybound: true`, si no el clamp del horizonte (`learner.js`) clava a la entidad y el mecanismo falla en silencio.
- **Clima a mitad de escena**: el step `weather` (`{ "weather": "rain" }` o `{ "weather": "none" }`) arranca o detiene partículas; `ambient` es solo config top-level y la oscuridad dinámica va por `tween ambient.darkness`.
- **Charts**: `yFormat` es sufijo (`"$"` produce `5000$`), y hay que ajustar `yDomain` a los datos o la curva queda aplastada contra el piso y la `target` inalcanzable.
- **Sin signos de exclamación** en el texto editorial: `validate.js` lo avisa como warning.

## Voz y copy

- Primera persona, observando el fenómeno. Sobria, gremial, iberoamericana.
- **Español latinoamericano neutro. Nunca voseo ni acento argentino.** Prohibido: «mirá», «fijate», «dale», «vos», «podés», «tenés», «armás», «observá», «de a una». Usar conjugación neutra: «mira», «fíjate», «puedes», «tienes», «observa»; para el plural, «ustedes» («miren», «juntan»). Esto vale para diálogos, hints y copy.
- **Sin em-dashes en ningún lado.** Usar comas, dos puntos, paréntesis. Los guiones son solo para rangos (`pp. 25-42`).
- Sin adjetivos de marketing (`innovador`, `revolucionario`, `único`). Sin signos de exclamación. Sin preguntas retóricas tipo "¿y si pensáramos esto distinto?".
- Diálogo de personajes con capitalización propia del español: mayúscula inicial, signos de apertura `¿` `¡`, acentos. Lo lowercase es para code panels y microcopy, no para voces.
- En cada término técnico: `<strong>nombre</strong>`, atribución a autor con año, metáfora propia del autor cuando exista en `<em>`. Honestidad sobre los límites del concepto.
- 4 a 8 párrafos cortos por escena.

## Paleta y tipografía (canónica)

**HUD / UI / texto editorial:**
- Navy `#1F2547` — cuerpos de texto, líneas estructurales.
- Ámbar `#F4AC1D` — small caps, divisores, callouts. Uso puntual.
- Papel `#FBFAF6` — fondos claros. **Nunca blanco puro.**
- Papel cálido `#F6F2E8` — callouts.
- Slate `#6E7896` — texto secundario, captions, referencias.
- Línea `#E8E2D2` — separadores.
- **Nunca negro puro.**

**Tipografía:** Plus Jakarta Sans (UI/body) + Fraunces italic (titulares y énfasis).

Nota: noesis podrá tener una identidad visual más definida en algún momento. Mientras tanto, esta paleta es la vigente para escenas y HUD.

**Mundo del canvas (más libre):**
- Fondo: navy oscuro `#0e1430` o verde pasto `#4f8a4f`.
- Estímulo / refuerzo: ámbar `#F4AC1D`.
- Frío / conceptual: azul `#5b8def` o `#22c4f8`.
- Vivo / experiencia: verde `#4f8a5e`.
- Problema: rojo `#a64a3e` o `#c44a3e`.
- Cuerpo de aprendices: melocotón cálido `#d8a878` o dorado `#e89a3a`.

## Reglas visuales del engine

**Wordmark "noesis." inalienable.** El engine estampa "noesis." (papel + punto ámbar) en la esquina inferior derecha de cada lienzo, en screen-space, después de todo lo demás. Vive en `world.js` (`_drawWatermark`), invocado en `runDraw()` tras `_drawAmbient`. Ninguna escena puede taparlo: no hay flag para desactivarlo y cualquier dibujo de la escena ocurre antes en el frame. Si necesitas mover el watermark o cambiar su estilo, edita `world.js`. Las páginas de ejemplo (`examples/scene-NN.html`) no llevan otra marca: la única identidad del lienzo es "noesis." del motor.

**Logo institucional opcional (co-branding).** Una institución puede sumar SU logo en la esquina inferior IZQUIERDA (no toca el wordmark "noesis." de la derecha, que sigue inalienable). Se declara en el EMBED (lo natural, una vez por página): `<noesis-scene src="..." logo="https://inst.edu/logo.svg" logo-height="28" logo-opacity="0.9">`, o en la config con `meta.logo` (string url u objeto `{ src, height, opacity }`). `element.js: _loadLogo` carga la imagen con `crossOrigin="anonymous"` (usa un data URI o un host con CORS, si no la grabación se rompería por canvas contaminado) y la deja en `world._logo`; `world.js: _drawLogo` la dibuja en screen-space bajo el watermark, así entra también en la grabación de video. La imagen debe tener contraste propio: un logo blanco sobre transparente se pierde en escenas de fondo claro. Demo: `examples/logo-demo.html` con `examples/sample-logo.svg`.

**Tiempo de gracia antes del replay.** Toda escena con botón "Ver nuevamente" debe esperar al menos 3 segundos adicionales entre el último cap/diálogo y `s.showReplay = true`. El usuario necesita leer el cierre antes de ver la opción de repetir. **Las escenas declarativas (con `script` top-level) no dibujan botón propio:** el motor detecta el fin del guion, espera los 3 s, muestra "Ver nuevamente" y resetea al click (`world.js: _tickReplay` + `_drawDeclarative`). El hit-test del botón usa coordenadas de PANTALLA (`interaction.js: handleClick` recibe mundo y pantalla por separado): el botón vive en screen-space y, con la cámara en un set lejano o con zoom, las coordenadas de mundo no le atinan. Un script con `loop: true` nunca termina, así que nunca muestra replay.

**Música ambiental opcional.** Cada escena puede declarar `meta.music` con uno de los moods soportados (`cosmic`, `melancholic`, `pastoral`, `epic`, `ancient`, `pedagogical`, `electronic`, `warm`, `joyful`, `tension`, `mystery`, `lullaby`, `solemn`, `urgent`, `march`, `tribal`, `groove`, `rock`, `mischief`, `symphonic`). Cuando está presente, el engine muestra un botón ♪ a la derecha del lienzo (junto a fullscreen y reset) y el usuario decide si la activa. La música es procedural (Web Audio sin archivos externos): drone armónico generado en `engine/audio.js: createAmbientMusic` con osciladores en **unison desafinado** (tres por voz, `preset.detune` en cents, default 7: el efecto ensemble; el vibrato del drone va a ±0.2% para no enterrar ese batido), LFOs, delay feedback, una **reverb de sala sintetizada** (la respuesta de impulso se genera en runtime como ruido estéreo con decaimiento exponencial; `preset.space` 0..1 gobierna tamaño de sala y nivel wet, 0 la apaga) y un **compresor suave en el bus de suma** que pega las capas (comprime a nivel de línea, ANTES de aplicar el volumen ambiental final: después de esa atenuación de ~-30 dB ningún umbral engancharía). Arranca silenciada por default. Para agregar moods nuevos, editar `MUSIC_PRESETS` en `audio.js`.

Para que la música tenga movimiento (no un drone plano), un preset puede declarar capas opt-in que `createAmbientMusic` interpreta: `chords` (array de acordes en Hz + `chordDur`: el drone se re-afina entre ellos), `arp` (patrón `{v,oct}` sobre el acorde actual + `arpStep`/`arpDur`/`arpVol`/`arpType` + `arpRest`, fracción 0..1 de silencios aleatorios; el arpegio además humaniza la dinámica por nota), `pulse` (latido grave suave + `pulseStep`/`pulseDur`/`pulseVol`), `grow` (capa electrónica con `elecStep`/`elecVol` cuyo volumen sube a lo largo de `growDur` segundos) y `drums` (batería sintetizada por patrón: un string donde `k` es bombo, `s` caja, `h` hat cerrado, `H` hat abierto, `t` tom grave y `.` silencio, un carácter por paso de `drumStep` segundos, con `drumVol` y fallos escasos vía `drumRest`; suena seca, sin delay, y en los moods que la llevan reemplaza al `pulse`). Groove humano encima de las capas rítmicas: `swing` (0..1, fracción del paso que se atrasan los pasos impares del arp y la batería; la grilla no se corre, solo el golpe a contratiempo), `drumAccent`/`arpAccent` (mapa cíclico DETERMINISTA de dinámica por paso, el 1 fuerte y los demás fantasma, más un ±10% humano; sin mapa, la dinámica es aleatoria como siempre) y `drumFill` + `fillEvery` (cada N compases, default 4, el compás entero cambia al patrón de relleno, un redoble o descarga, y vuelve: rompe la sensación de loop infinito). **Los VEINTE moods son miniaturas con progresión de acordes y capas propias** (cosmic deriva sin pulso, epic marcha y crece, ancient es modal con tambor lejano, pedagogical es deliberadamente discreto, joyful es festivo todo mayor, tension acecha con un tic que crece, mystery es lidio sin pulso que nunca resuelve, lullaby es una nana de caja de música, solemn dobla como himno de memoria, urgent es un ostinato de cuenta regresiva, march desfila con caja y bombo, tribal lleva toms rituales, groove un beat sereno con hats, rock un riff de sierra en menor armónica con doble bombo, mischief es el sneak cromático de cartoon con pizzicato burlón y symphonic despliega cuerdas de sierra con napolitana y timbales...): un preset nuevo no puede ser un drone de `freqs` fijas, cansa en escenas largas. Todas las capas rítmicas (arp, pulse, grow, drums) se agendan con lookahead sobre el reloj del AudioContext y comparten el origen de la grilla: cuando sus pasos son múltiplos (el riff 0.16 y la batería 0.16 de rock), van trabadas; el jitter de los timers del navegador nunca toca el tiempo, solo la dinámica se humaniza. La página interna `tools/music-test.html` audiciona todos los moods de un click (la lista `MOODS` de esa página se actualiza a mano al agregar uno), muestra qué versión del módulo cargó y trae un toggle de A/B que puentea reverb+compresor y aplana el unison en vivo (`handle.setFx`); usarla tras cualquier cambio de audio.

**Estándar de calidad (render + grabación).** El backing store del canvas se supersamplea a **3x** por defecto (una escena `800x450` se renderiza y graba a `2400x1350`). Se controla con `const SS = config.canvas?.ss ?? 3` en `element.js`; una escena puede bajarlo con `canvas.ss` (por ejemplo `2`) solo si pesa y pierde frames. La grabación usa `videoBitsPerSecond: 24_000_000` (24 Mbps) en el `MediaRecorder` de `element.js`. Para pasar el `.webm` a MP4 de alta calidad: `QUALITY=12 tools/webm-to-mp4.sh archivo.webm` (crf 12, audio AAC). No bajar este estándar sin razón: es la calidad base para los videos de noesis.

**Grabación de video.** Cada escena tiene un botón ● en la barra superior (junto a ♪ ⛶ ↺) que arranca una grabación nativa con `MediaRecorder` API. Un click: resetea la escena a t=0, activa la música si la escena la declara, empieza a grabar, y auto-detiene cuando `s.showReplay = true` (con ~700ms de cola). Un segundo click cancela y descarga lo grabado. La grabación combina el video del canvas (`captureStream(60)`) con el audio del engine, mezclado a través de un master gain en `audio.js`. Al detener descarga un `noesis-{id}-{timestamp}.webm`. El audio se enruta por `getMasterGain(ac)` para que `getRecordingStream()` pueda tomar una copia limpia sin afectar el playback. Mientras graba, el botón se pone rojo pulsante. Como `canvas.captureStream` solo ve el canvas, el engine mantiene un canvas auxiliar `_recCanvas` donde cada frame copia el main canvas y rasteriza los overlays HTML visibles (`.label`, `.bubble`, `.name-label`, `.hint`) con `ctx.fillText` + cajas redondeadas; sin esto, los textos no aparecen en el video. Para convertir el WebM a MP4 hay un helper en `tools/webm-to-mp4.sh` (requiere ffmpeg).

**Atributo `autoplay`.** Por defecto `<noesis-scene>` espera a estar en viewport + tab visible + ventana enfocada antes de inicializar (gates de `IntersectionObserver`, `visibilitychange`, `blur/focus`). El atributo `autoplay` bypasea los tres gates y arranca apenas se monta. Lo usa `tools/preview.html` para captura headless (donde `document.hasFocus()` retorna `false`); no debería aparecer en escenas embebidas en producción.

**Pipeline de previews.** Las imágenes en `previews/scene-NN.png` se generan con `node tools/capture.mjs` (o `node tools/capture.mjs 09` para una sola). El catálogo que las consumía ya no existe; hoy las usa `tools/og.html`. El tool lanza Chrome con `--remote-debugging-port` y conversa con él vía CDP nativo sobre WebSocket, **no usa `--virtual-time-budget`**, porque ese flag corta `requestAnimationFrame` y deja las escenas congeladas en el primer frame. Cada captura espera el `wait` declarado en la lista `SCENES` de `capture.mjs` en TIEMPO REAL, luego llama `Page.captureScreenshot`. Una escena nueva hay que sumarla a mano con su `wait`. Pre-requisito: el server local debe estar corriendo (`python3 -m http.server 8765`); `capture.mjs` lo valida al inicio y falla rápido si no responde. El tiempo total es real (la suma de los `wait`), del orden de un minuto por escena.

**Escenas outdoor (con cielo) requieren `canvas.sky` y `canvas.horizon`.** Un canvas con bg uniforme se lee como lienzo muerto. El engine clipea la textura del piso al área debajo del horizonte y restringe la `y` de los aprendices para que no caminen en el cielo (opt-out con `entity.skybound: true`).

**Aprendices siempre con pupilas.** `look: 'blank'` se reserva para un efecto narrativo justificado (un personaje cegado, declarado con `entity.look`, que manda sobre `lookAt`; lo usa la escena 11); fuera de ese caso, nunca. El engine ya hace que la mirada siga la dirección de movimiento.

**Mirada dirigida (`lookAt`).** Por defecto las pupilas siguen el vector de movimiento; quietas, miran al frente. Con `entity.lookAt` (id de otra entidad o un punto `{x, y}`) un blob quieto orienta la mirada hacia ahí, y se puede cambiar durante el guion con un `do` para que los personajes se miren entre sí o miren la acción (el movimiento manda sobre `lookAt`). Vive en `draw.js`. Da mucha vida: úsalo en escenas con varios personajes.

**`alpha` animable en todo prop y en las capas.** Además de los drawers bespoke que ya lo aplican (cat, pomegranate, wheat, wonderflower...), los props de **sprite** y las **capas de `canvas.layers`** respetan `alpha` (0..1). Se animan con `tween "id.alpha"` para que una flor brote o se marchite, o vía `do` + `world.tween` sobre el objeto de la capa (`canvas.layers`) para desvanecer el fondo entero (p.ej. al bajar al inframundo, que el prado deje de leerse). Declara un `alpha` inicial en el prop o la capa para que el tween tenga punto de partida.

**Bubbles dentro del canvas.** El engine clampa horizontalmente cada frame con `canvas.safeArea` (por defecto 18 px). Cualquier cambio al sistema de bubbles debe preservar esto. Además, `positionBubbles` hace una segunda pasada anti-solape: si dos globos visibles a la vez (dos personajes hablando, o un globo que entra mientras otro se desvanece) se montan, sube el segundo por encima del primero (`lift` vertical, la cola sigue apuntando al hablante). No quitar esa pasada: sin ella los diálogos simultáneos se tapan. El `lift` se interpola suave hacia su objetivo (`b._lift`, lerp 0.15): cuando un globo desaparece y el que estaba levantado ya no necesita subir, baja deslizándose, no de golpe. El apilado se calcula contra las posiciones OBJETIVO (no las animadas) para que el layout sea estable y no oscile. Además, las burbujas siempre hacen wrap (no `nowrap`): el CSS en `element.js` les pone `white-space: normal; max-width: 78%; overflow-wrap: break-word`. Un diálogo largo no puede perderse fuera del canvas. No revertir esto sin razón.

**Piso de tiempo de lectura.** Los `say`/`think` de texto plano tienen un piso de duración calculado por palabras (~1.2 s + 0.4 s por palabra, tope 7 s) en `fx.js: spawnBubble`. La `duration` explícita de la escena solo puede alargar, nunca dejar el texto ilegible. La fórmula de autoría correspondiente (duración 1.5 + 0.4 por palabra, `wait` = duración + 0.5) vive en el command `noesis-scene.md`.

**Nombres debajo del blob.** Los `name-label` se anclan BAJO los pies del personaje (media altura del sprite + margen, en `fx.js: positionBubbles`): la zona superior es de los globos de diálogo y se tapaban. No devolverlos arriba.

**Banda de subtítulos intocable (máxima).** El caption inferior se ancla en `H-18` y crece hacia arriba; el motor le reserva una banda al pie del lienzo y NINGÚN learner (ni su name-label, que cuelga bajo los pies) puede invadirla. `learner.js` define `CAPTION_BAND` (56) y `NAME_RESERVE` (20) y, tras el clamp del horizonte, fuerza en cada frame que la base de todo learner quede por encima de `H - CAPTION_BAND - NAME_RESERVE` (vale con o sin behavior); `fx.js` topa el name-label en `H - CAPTION_BAND` (mantener ese 56 en sintonía). Al componer, ubica a los personajes por encima de la banda; si falta aire, sube la altura del lienzo, no bajes el reserve.

**Nada de blobs enanos (máxima).** Los personajes secundarios (estudiantes, público, acompañantes) van del porte del protagonista: `hero: true` con scale comparable (5), no blobs chicos no-hero (scale 3-4), que se leen como enanos y no aportan. Tamaños menores se reservan solo para una mecánica de población/multitud explícita y deliberada.

**Globos sobre la cabeza, no sobre el centro.** Los bubbles (say/think/símbolos) se anclan a la cabeza del blob: `(e.x, e.y)` es el CENTRO del sprite, así que `positionBubbles` resta media altura (hero 11 celdas, minion 7) antes del offset del globo. Sin esa resta, el globo invade el cuerpo del personaje. Los símbolos de expresión son emojis (`exclaim` ❗, `wonder` ❓ en `fx.js`), no glifos tipográficos.

**Letter-spacing moderado.** Las small caps editoriales del engine (`.scene-num`, `.refs h3`, `.hint`, `.name-label`) usan `letter-spacing` entre `0.08em` y `0.12em`, no más. Letras demasiado separadas se leen mal en pantallas chicas y rompen el ritmo del texto.

**Props con detalle.** Cualquier prop nuevo debe matchear la riqueza de los existentes (plant, table, fountain): mínimo 3 tonos, con highlight y shadow, con carácter. Nada de minimalismos 5×6 planos.

**Sprites estáticos se rasterizan a caché.** `drawProp` no dibuja los sprites de `PROP_SPRITES` píxel a píxel cada frame: los rasteriza una vez a un canvas offscreen (clave tipo+escala+colores+densidad, donde densidad = supersampleo × zoom, en `prop-draw.js: _spriteRaster`) y cada frame es un `drawImage`. Mismo patrón que el caché del piso. Los props bespoke/animados (bird, bonfire, chest...) siguen dibujándose en vivo por su drawer propio. Al agregar claves de prop que cambien píxeles (un `color3`, un `variant`), hay que sumarlas a la clave del caché o los props compartirán raster.

**Sombra de contacto en learners.** El blob proyecta una elipse suave anclada al piso (`draw.js`, bloque `opts.shadow`), calculada con `cy` SIN bob ni salto: cuando el cuerpo se eleva (celebrate), la sombra se queda abajo y se encoge/aclara con la altura. No volver a la sombra de 1 píxel pegada al cuerpo: viajaba con el salto y mataba la ilusión de altura.

**Notación científica/matemática (subíndices y superíndices).** Todo el texto del motor soporta sintaxis tipo LaTeX: `_` subíndice y `^` superíndice, un carácter (`CO_2`, `x^2`) o varios entre llaves (`SO_4^{2-}`, `10^{-9}`). Vive en `util.js`: `parseScriptRuns` (tokeniza en runs normal/sub/sup), `richToHtml` (a `<sub>`/`<sup>`, consciente de etiquetas para no romper atributos como href) y `drawRichText`/`measureRichText` (render en canvas con tamaño 0.72x y offset de baseline). Aplicado en captions, título y labels de meter (canvas, `world.js`), en el body y los labels (HTML, `element.js`) y en las burbujas de diálogo (`fx.js`). Al agregar un sitio nuevo donde el motor pinte texto del autor, pásalo por estos helpers para que la notación funcione ahí también. Pendiente: ejes/labels de charts y zonas todavía usan `fillText` plano.

**Matemática estilo LaTeX sin dependencias.** Para ecuaciones formales (fracciones apiladas, raíces, griegas, operadores) hay un subconjunto de LaTeX delimitado con `$...$`, SIN traer KaTeX. `util.js: mathToHtml` parsea ese subconjunto a HTML (maneja llaves anidadas: `\frac{}{}`, `\sqrt{}`, `\Delta`...`\omega`, operadores `\ln \log \sin`..., relaciones `\le \ge \to \cdot \times \pm`...; las variables van en `<i>` itálica). `richToHtml` separa por `$` y manda los segmentos math a `mathToHtml` y el resto al sub/sup simple. Para el canvas (`drawRichText`/captions) `texToPlain` convierte `$...$` a texto plano legible (símbolos a Unicode, fracción inline `a/b`, dejando `_`/`^`): las fracciones APILADAS solo existen en HTML (labels/body). El estilo (variables itálicas, fracción con barra, dígitos lining, espaciado de operadores/relaciones) vive en el `<style>` del shadow root de `element.js` (`.math`, `.frac`, `.op`, `.rel`). Limitación: una ecuación LaTeX en un `label` no se rasteriza bien en la grabación de video (el overlay se copia como texto plano); para video, las fórmulas formales conviene tenerlas en captions (canvas).

**Tipografía del canvas = Plus Jakarta Sans.** Todo texto dibujado en canvas (meters, captions, título, charts, labels del toolkit de diagramas) antepone `"Plus Jakarta Sans"` a los fallbacks `ui-sans-serif, system-ui`. La fuente ya la carga el CSS de `element.js`, así el HUD del canvas y los overlays DOM comparten la marca. Excepción deliberada: los textos de zonas y `floatNumber` usan `ui-monospace` (son datos/código).

**La escena 01 es la vara de calidad.** `01-netflix-prize` (el Netflix Prize) es el estándar de calidad de noesis y el ejemplo canónico de cómo usar el motor. No se trata de clonar su forma sino de igualar su nivel en estos ejes: el elemento didáctico central es el protagonista y se ve evolucionar (no es decoración); el insight se encarna en cuerpos (se ve, no se narra); el momento clave se subraya en capas simultáneas (cámara + glow + sonido + viraje de luz + número flotante); el set tiene profundidad sin robar atención (parallax, props, elementos que ceden el plano); el cierre sintetiza visualmente; el `script` declarativo manda y `onDraw` se reserva para lo que el vocabulario declarativo no cubre; y el acabado no tiene costuras (empalmes exactos, paneles de respaldo, etiquetas sin colisiones). Antes de dar por buena una escena nueva, compararla contra la 01 en estos ejes.

**Tamaño natural de props.** Un prop sin `scale` explícito toma su tamaño natural por tipo (`PROP_NATURAL_SCALE` en `prop-sprites.js`), curado para que las proporciones salgan coherentes contra un aprendiz hero a scale 5 (~55 px): flor a la rodilla, mesa a la cintura, árbol al doble de la persona, edificio dominando. `scale` explícito siempre gana; se usa para intención (protagonismo, lejanía). Al agregar un prop nuevo al motor, darle su entrada en esa tabla.

**Catálogo ampliado del motor.** Pisos: `sand`, `water`, `snow`, `cobble`, `grid` (más solid/grass/tiles/wood/dots/earth). Cielos por nombre en `canvas.sky` (resueltos en `SKY_PRESETS`): sunset, space, underwater, mars, storm, overcast, aurora, además de day/dawn/dusk/night/golden/cool. Props nuevos: sun, moon, star, cactus, palm, crate, barrel, streetlamp, building, rocket, planet, gem, coin, balloon, coral, seaweed (varios aceptan `color`/`color2`). Familia de **símbolos didácticos**: lightbulb, hourglass, scale, magnifier, key, trophy, flag (color), flask (color = líquido), globe, scroll, gear, más mountain como paisaje. El prop **planet** acepta color de verdad: el sprite declara `shades` (rampa de sombras/luces derivada del `color` base con `mixColors` en `prop-draw.js: _spriteRaster`) además de `mainKey`/`secondaryKey`, así dos planetas con distinto `color` se ven distintos y no todos azules. Patrón reutilizable: cualquier sprite monocromo puede sumar `shades` para recolorearse entero. Los **cuerpos celestes** (`planet`, `sun`, `moon`) flotan lento por sí solos (`animated-props.js`), salvo que estén en un `path` (la Luna en órbita: el mover manda). Prop **domino** (bespoke `drawDomino`): ficha que se vuelca rotando sobre su base, con `fall` (0..1) hacia `dir` (el motor no tiene rotación general; el drawer la aplica local con `ctx.rotate`). El step `tween` ahora puede animar propiedades de un PROP por id (`{ "tween": "d1.fall", "to": 1 }`), no solo de entidades (resuelto en `scripts.js` y aceptado por el validador); así un efecto dominó real se arma volcando varias fichas en secuencia con `wait` entre cada una. El `reset` reconstruye los props desde el config (vía `_loadEntities`), así `fall` y cualquier propiedad de prop que la escena mute (incluido `disorder` del `field`) vuelven a su valor inicial en el replay: NO hace falta resetearlas a mano con un `do`. Prop **field** (bespoke `drawField`): campo de partículas que va del ORDEN al DESORDEN en sitio (entropía, mezcla, difusión, cambio de fase): cada celda interpola de su rejilla a un destino caótico determinista según `disorder` (0..1), animable con `tween "id.disorder"`; con `color2` la mitad izquierda y la derecha son especies distintas que se mezclan al desordenarse. Es la primitiva de "morph" de la mecánica de transformación en sitio. Claves: `w`, `h`, `cols`, `rows`, `disorder`, más `homeFrac` (el estado ordenado ocupa solo la fracción izquierda del ancho y el desorden esparce por TODO: modela un gas confinado que se expande) y `jitter` (tembleque base para que un gas se vea vivo aun ordenado; 0 = orden limpio). Reveal declarativo de texto: los steps `{ "showLabel": "id" }` / `{ "hideLabel": "id" }` muestran u ocultan un `label` (declarado con `"hidden": true`) durante el guion, para construir un panel de ecuaciones paso a paso (ver `scripts.js`; el validador chequea el id contra los labels declarados). Prop animado **pond** (bespoke `drawPond`): charco/laguna con ondas concéntricas y reflejo (`prop-draw.js: drawPond`, animado por `_t` en `animated-props.js`); acepta `color`. Cubre el agua LOCALIZADA en una escena de tierra (el mar entero es el piso `water`). Prop **cat** (bespoke `drawCat`, dibujado con formas vectoriales, no pixel): gato con tres poses (`pose`: `walk`/`curl`/`fall`), pelaje recoloreable con `color` (sombra, luz, panza y rayas se derivan de él), `dir` espeja, `alpha` 0..1 lo vuelve fantasma (para la doble exposición) y respiración suave en `curl`. Prop **vault** (bespoke `drawVault`): caja fuerte de frente en dos capas que el z-index intercala con otros props, `face: 'back'` (cavidad con manta y mecanismo en penumbra) y `face: 'front'` (marco opaco + puerta + volante); `glass` 0..1 vuelve la cara translúcida (corte de rayos X para ver el interior), `wheel` (radianes) gira el volante y `lift` (celdas) eleva la caja sobre una mesa con ruedas. Ambos nacieron para la escena 03 (el gato de Schrödinger). Familia para mitología/naturaleza (escena 05): **pomegranate** (bespoke `drawPomegranate`: granada partida con un anillo de seis semillas glossy; `seeds` 0..6 controla cuántas quedan, comerlas las quita una a una), **column** (sprite: columna del inframundo), **wheat** (bespoke `drawWheat`: espigas de trigo dorado con vaivén), **chasm** (bespoke `drawChasm`: grieta en la tierra con luz rojiza pulsante; `open` 0..1 la abre, animable con `tween "id.open"`), **wonderflower** (bespoke `drawWonderflower`: flor que cicla de color con resplandor) y **tree-bare** (bespoke `drawTreeBare`: árbol desnudo de invierno, ramas vectoriales con nieve; gemelo de `tree` para el cruce verde↔pelado por temporada vía `alpha`). Familia **IA / tecnología** (bespoke): **aiorb** (`drawAiOrb`: orbe de IA con anillo segmentado que rota, núcleo-lente que late y puntos en órbita; flota, no se apoya en el suelo), **notebook** (`drawNotebook`: cuaderno de espiral con tapa `color`, anillos metálicos y `glow` 0..1 para el resplandor al procesar), **genially** (`drawGenially`: logo de Genially, aro arcoíris segmentado, disco navy `color` y espiral blanca con punto; `spin` gira el aro, `glow` y `alpha`) y **basilisk** (`drawBasilisk`: criatura digital con `eye` 0..1 que modula su poder, chispas verde/cian y lluvia de código vía `animated-props.js`). Familia **cuentos de los Grimm** (bespoke, escena 11): **tower** (`drawTower`: torre de cuento con sillería en tres tonos, almenas, techo cónico y ventana arcada; `braid` 0..1 es la trenza dorada que cae del alféizar y ondea con `_t`, `glow` enciende la ventana, `color` tiñe la piedra), **oven** (`drawOven`: horno de ladrillo abovedado con boca de arco y lenguas de fuego animadas; `fire` o `glow` 0..1 las enciende junto al resplandor que sale por la boca), **candy-house** (`drawCandyHouse`: casa de pan de jengibre con glaseado, gumdrops en los aleros, piruletas, ventanas y humo de chimenea), **shoe** (`drawShoe`: zapatilla de tacón; `color` la tiñe, `glass` 0..1 la vuelve de cristal) y **mirror** (`drawMirror`: espejo mágico ovalado con marco dorado sobre un pie; `glow` 0..1 enciende el aura y un destello que recorre el cristal con `_t`). Las claves de prop `braid` y `fire` viven en `PROP_KEYS` del validador. Lista completa en `.claude/commands/noesis-scene.md`. Al agregar un prop nuevo: entrada en `PROP_NATURAL_SCALE`, lista cerrada del command `noesis-scene.md` y, si se apoya en el suelo, `FLOOR_PROPS` del validador.

**Toolkit de diagramas.** Para diagramas didácticos (flujos, grafos, redes, líneas de tiempo, vectores) el motor expone helpers de dibujo en `world.draw`, invocables desde `onDraw`. Defaults en paleta de marca, todo overrideable. No vuelvas a redibujar flechas a mano con `moveTo/lineTo`:
- `world.draw.rrect(x, y, w, h, r)`: traza el path de un rectángulo redondeado en `world.ctx` (lo deja abierto para que tú hagas `fill`/`stroke`). Reemplaza el `rrect` que cada escena redefinía.
- `world.draw.arrow(x1, y1, x2, y2, opts)`: línea con punta. `opts`: `color`, `width`, `alpha`, `dash` (`true` o `[on,off]`), `head` (px; `0` sin punta), `both` (doble punta), `curve` (curvatura perpendicular en px; signo = lado).
- `world.draw.connector(from, to, opts)`: flecha entre dos puntos o entidades; recorta los extremos al radio de cada nodo (toca el borde, no el centro) y admite `label` (con chip de fondo para legibilidad). `from`/`to` aceptan `{x,y[,r]}` o una entidad (deriva el radio de `scale`/`hero`). `opts`: los de `arrow` más `label`, `labelColor`, `labelBg` (`false` para quitar el chip), `font`, `gap` (recorte extra, default 4).
- `world.draw.node(x, y, w, h, opts)`: caja-nodo redondeada con relleno/borde y `label` centrado. Devuelve geometría y anclas de borde `{ x, y (centro), w, h, r, top, bottom, left, right }` para que los `connector` apunten a sus lados. `opts`: `fill`, `stroke` (`false` o color), `strokeWidth`, `radius`, `alpha`, `label`, `labelColor`, `font`.

**Primitivas de gráfico.** Para plots didácticos (matemática, física, datos) el motor expone helpers en `world.draw`, invocables desde `onDraw`:
- `world.draw.axes(x, y, w, h, opts)`: marco 2D de coordenadas. `(x,y)` es la esquina superior izquierda del área de plot; `w,h` su tamaño. Devuelve un frame `{ x, y, w, h, xDomain, yDomain, map(dataX, dataY) }` cuyo `map()` convierte coordenadas de datos a píxeles; ese frame se pasa a `plot`/`bars`. `opts`: `xDomain`/`yDomain` (`[min,max]`, default `[0,1]`), `color`, `labelColor`, `font`, `axis` (`false` para omitir), `frame` (`true` → caja completa en vez de ejes en L), `xTicks`/`yTicks` (cantidad o array de valores), `tickLen`, `xFormat`/`yFormat` (valor→texto), `xLabel`/`yLabel`. Los ejes se ubican en el cero si está dentro del dominio, si no en el borde.
- `world.draw.plot(frame, data, opts)`: dibuja datos sobre un frame. `data` es un array de puntos `[x,y]` (en datos) o una función `fx→fy` muestreada sobre `xDomain`. `opts`: `color`, `width`, `dash`, `samples` (para función, default 64), `reveal` (0..1, fracción del trazo dibujada, para animar), `fill` (`true` o rgba: área hasta la baseline), `baseline`, `dots` (radio de marcador), `dotColor`.
- `world.draw.bars(frame, values, opts)`: barras sobre un frame. `values` es un array de números o `{value,label,color}`. Se reparten parejas a lo ancho y suben desde la baseline. `opts`: `color`, `gap` (0..1, default 0.3), `reveal` (0..1, para animar la altura), `baseline`, `labels` (bool), `labelColor`, `font`.

**Charts declarativos.** Las mismas primitivas, sin JS: un bloque `charts` top-level (`id`, `type: 'line' | 'bars'`, posición, dominios, `title`, `target` con línea de meta punteada, `series` con `data` `[x,y]` y `reveal`, o `values` para barras) y el step `chart` del guion (`show`/`hide`/`alpha` y `reveal` con `series` opcional, todos tweenables con `duration` + `easing`). Se dibujan en espacio de mundo (un push-in de cámara los agranda, como en la escena 01) y se re-ocultan en cada reset. Es el camino para que las escenas declarativas tengan gráficos sin JS; el Netflix Prize (escena 01) los usa. Detalle de autoría en el command `noesis-scene.md`.

**Foco declarativo.** El step `focus` del guion enciende un halo de luz pulsante (gradiente radial + anillo, composición `lighter`) sobre una entidad por id, sobre un prop por id, o sobre un punto `[x, y]` del mundo; `off: true` lo apaga con fade. El halo queda centrado en lo dibujado: en entidades sigue el centro visual del frame (`_cyDrawn`, con bob y salto incluidos) y en props de sprite se centra a media altura sobre la base (los bespoke tipo butterfly/bird ya se dibujan en torno a su `(x, y)`). Opcionales: `color` (hex; default ámbar `#F4AC1D`) y `radius` (default derivado del `scale` y el sprite del objetivo, 44 px para puntos).

**Cámara declarativa completa.** El step `camera` expone todo el rango del módulo de cámara: `to` (punto `[x,y]` o id de entidad/prop: push-in a su centro visual vía `_focusPoint`), `zoom`, `follow` (id de entidad; `false` suelta), `shake` (true = 8 px, o número 1..30), `letterbox` (barras de cine con fade, screen-space sobre el mundo y bajo el HUD, `world.js: _drawLetterbox`) y `reset`. En escenas con sets, `reset` vuelve al encuadre del set ACTUAL (`world._currentSet`, actualizado por el step `scene`), no al del primero; también suelta el follow y apaga el letterbox salvo orden explícita en el mismo step. El rango completo (corte entre sets, push-in, follow, letterbox) está documentado en el command `noesis-scene.md`.

**Presets de partículas y props que viajan.** El step `particles` acepta `preset` (`smoke`, `sparks`, `burst`, `dataflow`; definidos en `fx.js: PARTICLE_PRESETS`, el validador los escanea con buildVocab): receta completa de física y color, con las claves explícitas del step ganando sobre el preset. Y el step `path` funciona también sobre un prop con `id`: el motor lo avanza por la polilínea con `world.movePropPath` + `_tickPropMovers` (speed o duration+easing, `loop`, `fromCurrent`), porque los props no tienen behaviors de learner. `waitFor: "arrive:<idProp>"` espera a un prop en viaje (los `loop` no se esperan: no terminan). No usar `path` sobre props auto-animados (butterfly, bird, cloud...): su tick pelea con el mover.

**Sets de cámara declarativos.** Lista top-level `sets` (`{ id, cx, cy?, zoom? }`): vistas nombradas sobre un mundo ancho repartido en franjas de 800 px (set 1 en 0..800 con cx 400, set 2 en 800..1600 con cx 1200). La cámara arranca en el primer set (`world.js: _initDeclarative`). El step `{ "scene": "<id>", "move": { "<idEntidad>": [x, y] } }` transiciona con el patrón canónico fade a negro + teleport + fade in (~1.5 s, vía `fx.transitionTo`); `move` reubica entidades durante el negro. **Nunca pan lateral ni zoom+fade entre sets** (lo primero parece slideshow, lo segundo sobre-actúa): la regla de transición del proyecto vive ahora también en el vocabulario declarativo. El piso se tilea horizontalmente según la vista de la cámara (`floor.js: drawFloor`), así los sets más allá de x=W tienen piso. El mundo jugable también se extiende: `world.worldRight` (calculado de los sets en `_loadEntities`) reemplaza a `W` como borde derecho en el clamp de bounds de `learner.js` (sin esto, un learner teleportado a un set lejano rebota de regreso, queda fuera de cámara y congela cualquier `waitFor: "arrive"`), y los props animados que viajan (cloud, rabbit, bird) deambulan dentro de su franja de origen (`animated-props.js: strip`). Todos los sets comparten cielo, piso y ambient. La mecánica del antes/después (un corte entre dos sets) los usa. Autoría en el command `noesis-scene.md`.

**Iluminación declarativa.** `ambient.darkness` (0..1) cubre el mundo con un scrim de noche (`darknessColor`, hex, default `#070a18`) que los emisores perforan con gradientes radiales (`world.js: _drawLighting`, compuesto en screen-space sobre el mundo y bajo partículas/HUD, así las luciérnagas y los textos no se oscurecen). Emisores: los props de `LIGHT_EMITTERS` (lamp, streetlamp, candle, bonfire) emiten solos con la fuente en su bombilla/llama (opt-out con `light: false`); cualquier prop emite con `light: true` o `light: { radius, strength }`; y los `focus` activos del guion también perforan (revelar algo en la noche). El amanecer/anochecer se anima con el step `{ "tween": "ambient.darkness", "to": ... }`; el motor copia `config.ambient` al cargar para que el reset restaure los valores del JSON. Autoría y ejemplo de amanecer/anochecer en el command `noesis-scene.md`.

**Saturación declarativa (gris ↔ color).** `ambient.saturation` (0..1; default 1, sin costo) controla la saturación de TODO el mundo dibujado: 1 = color pleno, 0 = escala de grises. A diferencia de `darkness`, no compone un velo: `world.js: _drawSaturation` toma un snapshot del frame en un canvas offscreen y lo redibuja con `ctx.filter = 'saturate()'` en screen-space, sobre el mundo y bajo el HUD (captions y watermark quedan siempre en color). Se anima con el step `{ "tween": "ambient.saturation", "to": 1, "duration": ... }` y el reset la restaura (el motor copia `config.ambient` al cargar). Es la primitiva de la mecánica del **color como información que los hechos no contienen**: un mundo gris que estalla en color en un momento (ver escena 02, el cuarto de Mary; sirve también para daltonismo, la llegada del cine en color, ver de un modo nuevo). No abusar: un mundo a medio saturar de forma permanente cansa, el valor está en el VIRAJE, no en un filtro de fondo.

**Meters con color dinámico y título de acto.** Un meter declara `color` como hex fijo o como stops `[{ "at": 0, "color": "#c44a3e" }, { "at": 1, "color": "#4f8a5e" }]`: la barra interpola el color según su fracción de valor (`world.js: _meterColor`, vía `mixColors`; los stops deben ser hex). Y el step `caption` acepta `style: "title"`: un segundo slot de texto en la banda superior (uppercase centrado, papel cálido `#f4e8c6`, el estilo de las cards de título) que convive con la caption del narrador; cada slot se borra con su propio `{ "caption": "" }`. El título se auto-esquiva: si su ancho real medido pisa el bloque de un meter (barra + label), baja por debajo de esa barra; aun así, conviene meter de `w` 200 y título corto para que compartan la banda. El meter es la forma natural de la mecánica del umbral; autoría en el command `noesis-scene.md`. Generaliza el glow de énfasis que las escenas de autor hacían a mano (oráculo, dispenser, lupa). Se dibuja en espacio de mundo tras los learners y antes de los charts (`world.js: _drawFocuses`); el estado vive en `world._focuses` y se limpia en cada reset. Pueden coexistir varios focos (uno por objetivo). Lo usan los focos del guion en el repertorio; autoría en el command `noesis-scene.md`.

## Tweens (animar valores)

Para animar cualquier valor numérico sin hacer lerp a mano cada frame, el motor tiene un sistema de tweens gestionado por el loop:
- `world.tween(obj, 'prop', destino, opts)`: anima una propiedad.
- `world.tween(obj, { x: 100, y: 50 }, opts)`: anima varias a la vez.

Desde un `script` declarativo, el step `tween` hace lo mismo sin JS: `{ "tween": "deuda", "to": 1, "duration": 2, "easing": "easeOutCubic" }` anima una clave de `world.state`, y `{ "tween": "alma._alpha", "to": 0.4 }` una propiedad de una entidad por id. No combinar con `walk`/`meter` en el mismo step (los tres leen `to`).

`opts`: `duration` (s, default 0.6), `easing` (`'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic' | 'easeOutBack' | 'easeOutElastic'`, default `'easeInOut'`), `delay` (s), `onStart(obj)`, `onUpdate(obj, u)`, `onDone(obj)`. El `from` se captura cuando el tween realmente arranca (después del `delay`), así los tweens encadenados leen el valor actual. Devuelve un handle con `.cancel()`. `world.stopTweens(obj?)` cancela todos (o los de un objeto). Se limpian en cada reset de la escena. Para ping-pong, re-disparar en `onDone`. El easing vive en `util.js: ease` (compartido con followPath).

## Movimiento por camino (followPath)

Para coreografías ricas sin scriptear posiciones frame a frame, una entidad puede recorrer una lista de waypoints con el behavior `followPath`. Se fija por hook, por helper o por step de script:
- Helper: `world.fx.followPath(entity, points, opts)`.
- Behavior directo: `entity.behavior = { type: 'followPath', points, ...opts }`.
- Step de script: `{ path: '<id>', points: [...], speed|duration, easing, curve, loop }`.

`points` acepta `{x,y}` o `[x,y]` (coordenadas en píxeles). `opts`:
- `speed` (px/s, constante) **o** `duration` (segundos para todo el camino) + `easing` (`'linear' | 'easeIn' | 'easeOut' | 'easeInOut'`). El easing solo aplica con `duration`.
- `curve`: suaviza el paso por los waypoints con una spline Catmull-Rom (densifica con `samples`, default 16 por segmento).
- `loop`: repite el camino en bucle (para que sea continuo, que el primer y último punto coincidan).
- `fromCurrent`: por defecto el camino arranca en la posición actual de la entidad; `false` lo arranca en el primer waypoint.
- `onArrive(e, world)`: callback al completar un camino no-bucle (y la entidad vuelve a `behavior = null`).

La posición se mueve inyectando la velocidad que aterriza en el siguiente punto, así siguen aplicando los límites del mundo, la mirada (los ojos siguen el vector de movimiento) y el bob de caminata. Un script con `waitFor: 'arrive'` espera tanto a `walkTo` como a `followPath`.

## Humanizar acciones abstractas

Si una acción puede ejecutarla un cuerpo, ruteala por uno: caminar → llegar → actuar → volver. Nada de triggers flotantes ni efectos que aparecen sin causa visible. Esto vale tanto para FX como para cambios de estado.

## Coordenadas y anchors

Coordenadas en `props`, `walls`, `zones`, `entities`:
- Número `0..1` → fracción del canvas.
- Número `>=1` → píxeles.
- String anchor (en `x`, `y`): `"left+10"`, `"right-20"`, `"center"`, `"top+5"`, `"bottom-30"`. Resuelve respetando `canvas.safeArea`.

**Excepción: los `labels` (overlay HTML) SOLO aceptan fracción `0..1`.** El engine siempre hace `x * 100` y lo aplica como `left: N%` (ver `element.js`, ~L550). Un label con `x: 256` queda en `left: 25600%`, fuera de pantalla. Para alinear un label con algo dibujado en píxeles, conviene dividir por `canvas.w` / `canvas.h`.

## Capacidades de layout (incorporadas v0.2)

- **Y-sort + z-index.** Props se ordenan por `(z, y)`. Opt-out con `canvas.ysort: false`. Helper para mezclar props + learners + funciones: `world.drawSorted([...])`.
- **Parallax.** `canvas.layers: [{ color, top, bottom, parallax, gradient?, shapes? }]`. `parallax: 0` estático, `1` mundo. `shapes` admite `{ kind: 'hill' | rect, ... }`.
- **Tint animado.** `ambient.tint` puede ser keyframes: `[{ t, preset | color, alpha }]`. Interpola color y alpha contra `world.t`.
- **Safe areas.** `canvas.safeArea: 24` o `{top,right,bottom,left}`.

## Estructura del repo

```
noesis-engine/
├── engine/
│   ├── noesis-engine.js   # entry: registra <noesis-scene>, ~40 ln
│   ├── element.js         # NoesisScene HTMLElement (custom element, RAF, loader, CSS de overlays)
│   ├── world.js           # World: simulación, tick, draw orchestration
│   ├── learner.js         # ciclo de vida y tick por frame de cada aprendiz (blink, behaviors, bounds)
│   ├── draw.js            # Draw primitives (learner blob, mood routing)
│   ├── mood.js            # overlays de cara (tears, hearts, sparkles, etc)
│   ├── accessories.js     # hat, scarf, glasses, headband, pikachu, bow
│   ├── prop-draw.js       # drawProp + per-prop drawers
│   ├── prop-sprites.js    # PROP_SPRITES (datos)
│   ├── animated-props.js  # movimiento por frame de props auto-animados (butterfly, fish, bonfire...)
│   ├── floor.js           # texturas de piso pre-renderizadas a canvas offscreen
│   ├── sky-presets.js     # SKY_PRESETS (datos)
│   ├── ambient.js         # partículas de clima/atmósfera (rain, snow, fireflies...) + tint
│   ├── fx.js              # API fx para hooks (say/think/mood/particles/...), bubbles DOM, --ui-scale
│   ├── scripts.js         # runner declarativo de steps (walk/say/goto/waits/branches)
│   ├── forms.js           # compila una "forma" (mecánica declarada) a steps del runner
│   ├── camera.js          # cámara 2D: posición, zoom, follow, shake
│   ├── interaction.js     # puntero: wake de aprendices, props interactivos, onClick
│   ├── audio.js           # AudioContext, tone/sweep, ambient, música procedural, fx dispatch
│   ├── hooks.js           # HOOK_NAMES, HOOK_ARGS, compileHooks
│   ├── validate.js        # núcleo del validador (puro: corre en Node y navegador)
│   └── util.js            # mixColors, ease, mulberry32, escapeHtml, anchorTransform, formatAPA
├── scenes/NN-slug.json    # config + texto académico + hooks JS como strings
├── examples/scene-NN.html # wrapper mínimo por escena (carga el engine con type="module")
├── previews/              # PNGs generados por tools/capture.mjs (los usa tools/og.html)
├── tools/                 # smoke.mjs, capture.mjs, shoot.mjs, webm-to-mp4.sh, og.html, preview.html
├── docs/                  # noesis-vision (charter), rediseno-pedagogico, spec
├── MANUAL.md              # manual práctico: instalar, embeber, crear escenas
├── .claude/commands/      # /noesis-scene
└── CLAUDE.md              # este archivo
```

El engine se carga como ES module (`<script type="module" src="../engine/noesis-engine.js">`). Sin build, sin deps.

## Estándar de entrega visual

Antes de dar por terminada una escena (además de compararla contra la 01, ver arriba):

- **Riqueza pictórica, no esquema.** Cada elemento dibujado (props, vehículos, terreno, cielo, mar) lleva al menos sombra + cuerpo + highlight, más textura/marcas, una micro-animación y contexto alrededor. Un rectángulo plano con outline está mal; la vara es la 01.
- **Vida con función.** Si la escena se siente muerta, se arregla con el movimiento propio del fenómeno (órbita, flote, flujo, deriva), nunca con chispas/confeti decorativos. "Quieto" significa que las partes no se reordenan, no que no respiren.
- **Los personajes actúan la mecánica.** Los blobs no son solo narradores: encarnan el fenómeno (jugadores, demostrador, auditorio reactivo, o traen las piezas caminando). Coherente con "mostrar, no narrar" y con "humanizar acciones abstractas".
- **Revisión de artefactos.** Releer cada `fill`/`stroke`/`arc` y nombrar en una palabra qué representa; si no sale la palabra, es un artefacto y se borra. Cazar fantasmas, halos descentrados y alphas fuera de rango (halo 0.15-0.35, sombra 0.3-0.5) antes de entregar.
- **Cross-check de colores.** Recorrer contraste fondo/figura, coherencia con la paleta canónica (arriba) y color clash entre vecinos antes de cerrar; reportar al usuario, en una línea, que el cross-check se hizo.

## Forma de trabajo

- **Al usuario, español latinoamericano neutro** (tú-form: «puedes», «tienes», «dime», «mira»). Nunca voseo ni marca argentina, en TODA la conversación (no solo en el copy de las escenas).
- **Trabajo acotado.** Si algo ya funciona, propón el cambio grande y su costo ANTES de ejecutarlo; prefiere lo mínimo viable salvo que se pida lo contrario.
- **Los pasos interactivos son del usuario.** Si algo requiere login o una acción manual, dilo y entrega el comando; no instales herramientas ni sondees estado para "adelantar".
- **Tras crear o editar una escena, devuelve su URL** (`http://localhost:8765/examples/scene-NN.html`) para que el usuario la vea. No tomes screenshots: el usuario verifica visualmente.

## Antes de escribir una escena nueva

1. `ls scenes/` para escoger el próximo NN libre. El repertorio es correlativo desde 01. `scenes/` contiene SOLO el repertorio real (escenas pedagógicas).
2. Slug en kebab-case basado en el concepto central.
3. Texto académico siguiendo voz arriba. No inventar citas.
4. Pre-flight: `node tools/validate.mjs scenes/NN-slug.json` (compila los hooks y chequea enums, coordenadas, ids y reglas editoriales contra el vocabulario real del motor).
5. Confirmar que el server local esté arriba.
6. Reportar: ruta del JSON, snippet embed, URL, y una o dos líneas sobre qué observar.
