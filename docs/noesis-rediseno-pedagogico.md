# noesis — Mecánicas didácticas (catálogo)

> El **catálogo de mecánicas**: el vocabulario de FORMAS didácticas que organiza
> cada escena. El principio mecánica-primero (§0-§2) es la columna del proyecto.
> El documento describe las mecánicas; cada ejemplo se construye al autorar la
> escena (la vara de calidad es `scenes/01-netflix-prize`).

## 0. El principio

**Cada animación en noesis es una pieza de pedagogía, no un video.**

De ahí se deriva todo: una escena buena se construye alrededor de UNA mecánica
visual (algo que el estudiante VE ocurrir: viaja, crece, se mezcla, desaparece,
se acumula, se cruza). El diálogo y las captions acompañan lo que se ve; nunca
lo sustituyen. Una escena que se apoya en que dos personajes se expliquen el
concepto de viva voz es un PowerPoint muerto, aunque sea válida.

**Riqueza con función (no minimalismo, no decoración).** El ideal no es la escena más simple, es la escena donde cada elemento se gana su lugar (la vara es la escena 01, rica y en capas). Sumar sets, props y demás es bienvenido cuando PROFUNDIZA la mecánica: un antes/después ES un cambio de set; un viajero-proceso se enriquece si las etapas son props que el cuerpo atraviesa; una convergencia se ve dos veces si los cuerpos se acercan Y el gráfico se cruza. El test para cada elemento es uno solo: si lo quito, ¿la explicación pierde algo? Si no, es decoración, y la decoración es la misma muleta que el cabezón parlante o el gauge por costumbre. Quitar lo redundante y sumar lo que aporta son la misma regla.

**La barra (`meter`) NO es un adorno universal.** Es la representación natural de UNA mecánica (el umbral, una cantidad que cruza un punto) y poco más. Ponerle una barra a toda escena es una muleta nueva, tan mala como el cabezón parlante: distrae con un HUD abstracto cuando el concepto ya vive en los cuerpos (la gota que sube, las polillas que desaparecen). Regla: la mecánica se encarna en los CUERPOS y el movimiento; la barra solo entra cuando el concepto ES una cantidad. No la pongas por costumbre.

## 1. Qué se conserva (intacto)

- **El motor** (engine/): estable, completo, sin cambios salvo lo que pida una mecánica nueva.
- **El validador** (validate.js): se autoderiva del motor; se mantiene.
- **Las formas** (`engine/forms.js`): el motor sabe expandir una mecánica declarada a su guion primitivo.
- **El checklist de autoría**: restricciones que mantienen el nivel: body como array, ambient al nivel superior, focus-off con `"off": true`, sin signos de exclamación, la fórmula de tiempos, mostrar-no-narrar, skybound, personajes-vs-props, escala de gráficos.

## 2. El catálogo de mecánicas

El vocabulario de FORMAS DIDÁCTICAS, distinto del vocabulario del motor. Cada
mecánica: qué es, cuándo, cómo se encarna en el motor, qué conceptos sirve, y la
trampa (cómo NO caer en el cabezón parlante).

**Estado:** catálogo en 9 mecánicas (1 a 9); los ejemplos por mecánica se
construyen al autorar cada escena. La transformación en sitio (9) entró tras
construir su
primitiva de morph (el prop `field`); el ensamblaje y la propagación quedan
diferidos por solape (§2b).

**Política del catálogo:** el catálogo es una lista viva, pero crece
EMPÍRICAMENTE, no por especulación. Su valor está en ser chico, memorable y
distinto: nueve ya está en el borde de lo retenible. Dos cosas amplían la
cobertura sin sumar mecánicas: las mecánicas se COMBINAN (un viajero que termina
en un umbral, una convergencia mostrada con una disección), y muchos conceptos
son combinaciones, no formas nuevas. Una sola escena puede encadenar varias
mecánicas (por ejemplo viajero el calor, transformación en sitio una manta de
gases, umbral la temperatura, antes/después el mundo) en una explicación, con
sets, cámara (zoom/shake/letterbox), iluminación y partículas, cada recurso al
servicio de un acto: es el showcase de "todo el motor" sin caer en espectáculo.
Una mecánica nueva entra solo cuando hay a la vez (a) un concepto real que
ninguna de las actuales encarna bien y (b) un motor que la pueda mostrar. La
transformación en sitio (9) es el caso de manual de esto: entró recién cuando se
construyó su primitiva de "morph" (el prop `field`), no antes.

1. **El viajero** (un recorrido que transforma). Un solo cuerpo atraviesa etapas y cambia en el camino. Motor: `walk`/`path` + `caption` por etapa + `tween id.scale`/`mood`/barra. Sirve: ciclos, procesos, transformaciones, recorridos (ciclo del agua, digestión, un algoritmo, metamorfosis). Trampa: que el viajero hable en vez de viajar.

2. **La población** (una proporción que cambia ante los ojos). Varios cuerpos; algunos aparecen o desaparecen y una barra sigue el cambio. Motor: varios `learner` + `appear`/`vanish` + `meter`. Sirve: selección, competencia, contagio, extinción, muestreo. Trampa: narrar la estadística en vez de mostrar los cuerpos (a menudo la proporción se ve mejor en los cuerpos que en una barra).

3. **El umbral** (una acumulación que cruza un punto y desata algo). Una barra se llena hacia un `target` y, al cruzarlo, el mundo reacciona visiblemente. Motor: `meter` + consecuencia (`mood`, `particles`, `camera`). Sirve: puntos de quiebre, masa crítica, saturación, la gota que colma. Trampa: que la barra suba sin consecuencia que se vea. Aquí la barra SÍ va, porque el concepto es una cantidad.

4. **La convergencia** (dos fuerzas que se encuentran). Dos curvas que se cruzan o dos cuerpos que llegan al mismo punto, y se marca el encuentro. Motor: `chart` con dos series, o dos `learner` que caminan a un punto, + `focus`/`particles` en el cruce. Sirve: equilibrios, oferta y demanda, dos teorías, tensiones que se resuelven. Trampa: el gráfico como decoración mientras dos personajes lo explican. La convergencia se ve dos veces si los cuerpos se acercan Y el gráfico se cruza.

5. **El antes y el después** (el mismo lugar transformado). Dos `sets` con fade entre ellos muestran el cambio. Motor: `sets` + step `scene`. Sirve: cambios históricos, ambientales, de estado (revolución industrial, deforestación). Trampa: contar el cambio en vez de cortar al "después". Base técnica: los `sets` declarativos del motor.

6. **La disección** (las partes de un todo). Un objeto central se revela parte por parte, nombrando cada una a su tiempo. Motor: un cuerpo o un conjunto de props que forman el todo + `focus` que se mueve de parte en parte (o a un punto `[x,y]`) + una `caption` que nombra cada parte. Sirve: anatomía, la estructura de una célula, las partes de una máquina, las partes de una oración. Trampa: enumerar las partes con texto en vez de señalarlas una a una con el foco; y querer "etiquetas flotantes" precisas (no hay diagrama con etiquetas: se usa foco + caption, así que conviene que las partes sean cuerpos o props separados). La composición no está MUERTA: tiene vida con función (los cuerpos flotan despacio, las partes respiran), no decoración. "Quieta" en la disección significa que las partes no se reordenan, no que no respiren.

7. **La analogía** (lo conocido explica lo nuevo). Dos sistemas LADO A LADO, en simultáneo, que se comportan igual: el familiar a la izquierda, el abstracto a la derecha, moviéndose en sincronía. Motor: dos grupos de cuerpos/props en las dos mitades del lienzo (NO `sets`, que son secuenciales), animados en paralelo (dos `path`, dos `meter`), con un divisor o el título nombrando cada lado. Sirve: la electricidad como flujo de agua, el átomo como sistema solar, un concepto abstracto vía uno cotidiano. Trampa: explicar la analogía de palabra en vez de mostrar que ambos lados hacen lo mismo a la vez.

8. **La cadena (el dominó)** (una acción dispara la siguiente). Varios cuerpos que se gatillan en secuencia: A actúa, B reacciona, C reacciona. Motor: pasos ordenados con `waitFor`, donde la acción de un cuerpo (un `walk` que llega, un `mood`, un `particles`) precede y motiva la reacción del siguiente; opcional un "disparador" que recorre la fila con `path`. El prop `domino` se inclina con `tween "id.fall"`, una tras otra. Sirve: causa y efecto, reacciones en cadena, reflejos, consecuencias, propagación de un impulso. Trampa: narrar la cadena en vez de ver cada eslabón dispararse; la caída visible ES la mecánica, no un blob que se asusta.

9. **La transformación en sitio** (un cuerpo que cambia su sustancia sin moverse). Un campo de partículas pasa del ORDEN al DESORDEN ante los ojos. Motor: el prop `field` (con `color`/`color2`, mitad y mitad para dos especies) y su `disorder` (0..1) animado con `tween "id.disorder"`. Sirve: entropía, mezcla, difusión, cambio de fase, oxidación, irreversibilidad (la flecha del tiempo). Trampa: narrar el cambio, o ponerle una barra; el desorden se ve en las partículas, no en un HUD.

## 2b. Mecánicas diferidas (por solape, no entran por ahora)

- **La construcción / el ensamblaje** (piezas que se unen en un todo): se roza con la convergencia (cuerpos que llegan a un punto). Se reevalúa si aparece un caso que no calce.
- **La propagación / la onda** (algo se expande desde un foco): se roza con la población (contagio) y con la cadena (un impulso que se transmite). Se reevalúa más adelante.

## 3. Preguntas abiertas

- ¿Qué mecánicas candidatas (§2b) entran al catálogo y cuáles se descartan por solape? Se decide empíricamente, cuando un concepto real no calce en ninguna de las nueve.
- ¿La transformación en sitio justificó una primitiva de motor (el prop `field`)? Sí; fue el único toque al motor que el rediseño pidió por una mecánica nueva. La regla queda: una mecánica nueva entra solo cuando el motor la puede mostrar.
