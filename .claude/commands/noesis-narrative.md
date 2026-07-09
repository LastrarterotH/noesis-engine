# /noesis-narrative

Capa de planificación narrativa para construir o iterar una escena de noesis.
Se apoya sobre `CLAUDE.md` y `.claude/commands/noesis-scene.md`. No los reemplaza.

## Antes de empezar

Lee siempre, en este orden:

1. `CLAUDE.md`: voz, paleta, reglas visuales, capacidades y estructura del repo.
2. `.claude/commands/noesis-scene.md`: API de escenas (hooks, `world.*`, props, scripts, cámara, tweens, followPath).

Una escena a la vez. No adelantes varias ni las des por buenas sin el visto bueno de Luis.

## Modelo mental

La escena es un cuadro de un cuento animado. No es un escenario con actores ejecutando acciones, es un mundo donde pasa una historia. Se planifica en dos carriles que se arman juntos:

- **Guion**: los beats de la historia.
- **Ambientación**: el mundo donde ocurre.

## El loop

1. **Premisa.** Dialoga con Luis el concepto: objetivo (didáctico o atmosférico), pregunta dramática, quién quiere qué. Una escena a la vez.

2. **Planifica el cuadro.**
   - *Guion*: ordena la escena en beats. Cada beat cumple una condición: alguien hace algo, eso cambia un estado, y otro personaje reacciona. Un beat con un personaje actuando solo, sin respuesta, se reescribe.
   - *Ambientación*: define el mundo del cuadro. Fondo, profundidad, atmósfera, props de ambiente.

3. **Props bajo demanda.** Cuando el guion o la ambientación piden un prop que no existe, créalo siguiendo las reglas del motor (mínimo tres tonos, highlight, sombra, carácter), hazle pre-flight y regístralo. Luego vuelve al cuadro.

4. **Montaje.** Escribe `scenes/NN-slug.json`. Rutea cada acción por un cuerpo (caminar, llegar, actuar, volver). Viste el mundo. Nada se gatilla flotando.

5. **Gate mecánico (corre solo).** Cada hook compila con `new Function(...)`. Corre `node tools/smoke.mjs`. Si algo falla, corrige y vuelve al montaje, sin molestar a Luis.

6. **Gate narrativo (lo juzga Luis).** Levanta el server (`python3 -m http.server 8765`), abre la escena tú mismo (`open http://localhost:8765/examples/scene-NN.html`) y entrega la URL. Luis la mira y la juzga contra la rúbrica. Si falta cuento o mundo, recibe una nota concreta y reentra en el paso 2. No tomes screenshots ni capturas headless; la verificación visual es de Luis.

7. **Cierre.** Con el visto bueno, reporta ruta del JSON, snippet de embed, URL y una o dos líneas de qué observar. Destila lo que funcionó en la sección **Aprendizajes**, para que la próxima escena arranque más arriba.

## Regla de props

Usa los props que la escena necesite para adornarse, con un solo filtro: que cada adorno sirva a la narrativa del cuadro, sea por la acción (un beat lo usa) o por el mundo (viste la atmósfera del cuento). Sin tope numérico. El adorno que no aporta ni a la historia ni al mundo queda fuera. La dosis final la decide el ojo de Luis en el gate narrativo.

## Rúbrica del gate narrativo

- **Pregunta dramática**: la escena plantea algo que el espectador quiere ver resuelto.
- **Interacción real**: al menos un beat donde la acción de un personaje provoca la reacción de otro.
- **Causalidad encadenada**: cada beat cambia el estado del que depende el siguiente.
- **Props con rol**: cada prop sirve a la historia o al mundo; fuera el que no sirve a ninguno.
- **Mundo habitado**: el cuadro se lee como un lugar, con fondo, profundidad y atmósfera.
- **Cierre con resolución** y tiempo de gracia (al menos 3 s) antes del replay.

## Aprendizajes

Se llena al cerrar cada escena. Anota patrones que funcionaron: tipos de beat que dieron buena interacción, recursos de ambientación que dieron mundo, soluciones de props con carácter.

### Escena 09 · El mito de la caverna en la era de la IA (10/10)

Mecánica: "el viajero" con el viraje `saturation` gris→color como literal "ver el sol".

- **Caverna = saturación, no oscuridad.** Para un mundo-de-sombras gris, apóyate en `ambient.saturation` (gris→color), NO en `darkness`. Un `darkness` alto (0.4+) pone un velo casi negro sobre TODO (el `onDraw` y los props se dibujan ANTES del scrim de luz en `world.js`, la oscuridad los apaga) y el lienzo se lee vacío. Caverna legible = `darkness` suave (~0.14) + `saturation` baja (~0.18); el contraste lo hace el viraje a color.
- **Beat de interacción (regreso trágico).** La acción de proto ("afuera hay color, esto son sombras") provoca el rechazo de los otros ("estás tapando la pared"), que no se dan vuelta. Acción → reacción real, y es la parte más resonante del mito. El arco "sale y vuelve" pegó más que un final solo ascendente.
- **Clímax que ganó el 10/10: subrayar en capas SIMULTÁNEAS** (como la 01). El momento de salir lo hicieron juntos: color rápido (easeOut) + `focus` cálido del sol + acorde ASCENDENTE (sweep + tonos que suben 659→988) + push-in de cámara + reacción CORPORAL escalada (`surprise` → caminar hacia la luz → `fx.jump` vía `do` → `mood happy`). La sorpresa la actúa el cuerpo, no solo los ojos. Un `surprise` suelto se sentía plano (8/10); las capas lo subieron a 10.
- **Vida con función para el "mundo vivo".** Mariposas en figura-8 + `weather: "petals"` que arranca al cruzar el umbral y se apaga (`weather: "none"`) al volver. Aire vivo frente a la pantalla muerta, no confeti decorativo.
- **Pantalla de sombras sin prop.** Un muro-pantalla con un flujo de siluetas a la deriva (que ecoan cosas reales: un pájaro, un árbol) se hace en `onDraw` (contenido dinámico), no como prop estático. Recuerda: con `onDraw` propio TÚ dibujas los learners (`world.draw.learner`), si no desaparecen (`world.js:566`).
- **Sets + contraste de ambiente.** Dos sets comparten piso/cielo/ambient; el contraste caverna↔exterior se logra animando `ambient` (darkness/saturation) en la transición `scene` (fade a negro = el túnel oscuro entre la caverna y la luz), no con pisos distintos.
- **GOTCHA que costó una iteración: los gates headless no prueban el wrapper HTML.** `validate`, `smoke` y un repro de `ctx` estricto prueban el JSON + el motor, NUNCA el `examples/scene-NN.html`. Un wrapper sin `type="module"` no registra el custom element y NO dibuja nada (solo el wordmark de la página): `SyntaxError: Cannot use import statement outside a module`. Verifica siempre el render real (consola del navegador). La plantilla del command `noesis-scene.md` ya quedó corregida (`type="module"` + cache-buster unificado `?v=94`, no por-escena).

### Escena 10 · El fuera de juego: la línea y el instante (aprobada)

Mecánica: el umbral (la línea de fuera de juego) + el instante del pase, con arco de **revisión de VAR**. Cancha cenital con blobs parados.

- **LECCIÓN MÁS CARA (el pozo del arco).** Un solo elemento puede pelearse con el encuadre y arruinar una escena que ya funcionaba. La cancha es cenital ortográfica (las marcas son planas) pero los personajes son blobs parados (vista lateral): ese híbrido va bien para jugadores y líneas, pero el ARCO es justo el elemento que obliga a elegir un punto de vista, y cualquier arco "con volumen" (red 3D, perspectiva, fuga) choca. Iteré ~8 versiones del arco a ciegas y quemé la paciencia del autor. **La salida correcta no era dibujar mejor el arco, era BAJARLO al nivel de las demás marcas de cancha** (línea de meta + dos postes como punto, plano, sin red ni volumen). Regla destilada: cuando un elemento pelea con la perspectiva establecida, no lo persigas con más detalle, simplifícalo hasta que sea una marca más. Y huele el pozo temprano.
- **MÉTODO QUE DESTRABÓ TODO: capturarme yo los bugs visuales.** Mientras iteraba "a ciegas" ajustando coordenadas sin ver el resultado, fallaba una y otra vez. El giro fue **renderizar yo y mirar**: vía Chrome MCP, `el._visible=true` + un bucle de `runStep/runDraw` para avanzar el guion a un frame concreto (e incluso forzar estado, p.ej. `state.lineOn=1`), `scroll` al canvas, `screenshot` y `zoom`. Para BUGS DE DIBUJO (geometría, proporción, perspectiva), esto NO viola "la verificación visual es de Luis": no estoy juzgando la escena, estoy depurando mi propio dibujo. El gate narrativo/estético sigue siendo del autor; pero no lo gastes a él como visor de bugs mecánicos.
- **Explorar el espacio de diseño en un lienzo de prueba.** Para decisiones visuales con muchas variantes (cómo dibujar el arco), un HTML scratch que pinta 6 variantes lado a lado y una sola captura comparativa rinde mucho más que iterar la escena entera N veces. (Borrar el scratch al cerrar.)
- **Mecánica de offside en cenital.** El eje X = "distancia al arco" (lo único que mide el offside), así la línea de fuera de juego es VERTICAL en el penúltimo defensor y el eje Y = carriles a lo ancho. Para que el delantero "pase" al defensor sin encimarse (mismo suelo), separa sus carriles en Y y dibuja con y-sort (`world.draw.learner` ordenado por `y`): el atacante pasa por delante. El validador avisa del cruce de cuerpos (warning de `checkMovement`).
- **Arco de VAR (drama + didáctica).** Gol → festejo → "revisión" (letterbox + leve desaturación = modo replay) → **rewind al instante del pase** con un `do` que snap-ea posiciones (no animar el retroceso, cortar como un replay) → trazar la línea → veredicto. El rewind ENSEÑA el detalle clave (la posición se mide cuando sale el pase). Acción→reacción: la bandera del juez provoca la frustración del delantero y el alivio del defensor.
- **Tribuna viva = blobs propios, no "monitos".** El público convence cuando son blobs con cuerpo + ojos (como los jugadores, dibujados con `rrect` + pupilas) rebotando con fase por columna y SALTANDO en el gol (un `hype` tweenable 0→1). Puntitos planos se leen "tico/barato".
- **Composición armónica = centrar en el eje del campo.** Arco, área y arquero centrados en `midY = (fieldTop + nearLine)/2`; los jugadores straddleando ese eje (defensa apenas arriba, ataque apenas abajo). Descentrar el arco hacia un lado rompe la armonía y el autor lo nota.
- **Sin cielo, el césped llena todo.** `floor.js:15`: el piso se recorta a `horizon..H` SOLO si hay `canvas.sky`; **sin `sky`, el césped llena 0..H** (y `learner.js:224`: sin `sky` tampoco hay clamp de horizonte, así el guardalíneas puede ir a la banda, fuera del campo). Quitar el cielo resolvió "abajo no se completa la cancha" + "ocupa toda la pantalla" de un solo cambio.
- **Copy con humor en la voz de la escena (no en el body).** La unidad de medida del adelanto se nombró "1 Pirulete" (a pedido del autor): los chistes/guiños van en captions y chips de la escena; el texto académico (`body`) se mantiene sobrio ("por un margen mínimo").
