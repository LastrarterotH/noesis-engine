# Guion teatral didáctico: cómo escribir el insumo de una escena

Esta guía es para la persona que va a crear una escena de noesis. El motor no
se alimenta de una lista de datos ni de un esquema: se alimenta de un **guion
teatral**. Antes de tocar el JSON, se escribe la escena como una pieza de teatro,
y de ahí se traduce al vocabulario del motor (ver el apéndice A).

El objetivo no es explicar el tema como una clase. El objetivo es que quien mira
**experimente** el concepto a través de una historia, y que al final lo haya
entendido sin sentir que leyó una explicación académica.

## Principio fundamental

Nunca te limites a decir qué hacen los personajes. Describe, todo el tiempo:

- El entorno y el paisaje.
- La iluminación.
- Los sonidos y los silencios.
- El clima y la atmósfera.
- Los objetos y sus transformaciones.
- Cómo reacciona el mundo.
- Las emociones visibles y los movimientos.

El escenario se comporta como un personaje más. Quien lee el guion debe poder
ver la escena completa aunque nunca la haya visto.

## Estructura

**Título.** Representa el concepto central con claridad: "El gato de Schrödinger",
"Perséfone y el origen de las estaciones", "Mary y el color imposible", "La nave
de Teseo".

**Personajes.** Preséntalos con una línea cada uno. El narrador es uno más, no el
dueño de la obra.

**Escenas numeradas.** Cada una es una etapa lógica del concepto: presentación
del mundo, aparición del conflicto, desarrollo, punto de inflexión, resolución,
reflexión final. Una escena por etapa, no una por frase.

## Reglas

**Inmersión.** Antes de que alguien hable, describe lo que ocurre en el escenario.
No escribas "Mary entra al laboratorio". Escribe: las luces revelan una
habitación completamente blanca, las paredes blancas, el suelo blanco, los
muebles blancos, ni una sola mancha de color, y Mary sentada frente a una mesa
de libros.

**Transformación.** El entorno cambia cuando cambia la historia. No basta con
"Deméter estaba triste": las flores pierden color, los árboles sueltan sus hojas,
los pájaros se van, los campos se secan. La naturaleza refleja su dolor.

**Continuidad visual.** El escenario nunca desaparece entre escenas: siempre hay
una transición. La luz se enfría, la niebla cubre el suelo, las flores se apagan
de a poco, las columnas del inframundo emergen lentamente. El mundo evoluciona,
no salta de golpe.

**Los sentidos.** Apóyate en estímulos concretos: color, sombra, movimiento,
tamaño, distancia; viento, ecos, golpes, silencios, música; frío, calor,
vibración; lluvia, niebla, nieve, polvo, luz. (Cómo se vuelven imagen y sonido en
el motor, en el apéndice B.)

**El conflicto es una pregunta.** Todo concepto se convierte en una tensión.
"¿Puede algo estar vivo y muerto a la vez?" "¿Puede conocerse una experiencia sin
vivirla?" "¿Puede alguien pertenecer a dos mundos?" "¿En qué momento algo deja de
ser lo que era?". Esa pregunta la formula un personaje, no el texto académico.

**Primero ocurre, después se nombra.** No expliques la teoría de entrada: hazla
pasar. No digas "la superposición es estar en varios estados a la vez": muestra
las dos realidades coexistiendo, los dos desenlaces a la vez, y recién entonces
deja que los personajes reflexionen.

**El narrador** introduce lo necesario, guía las transiciones y plantea las
preguntas. Complementa lo que ya se ve; no lo sustituye.

**Ritmo.** Alterna descripción visual, acción, diálogo y reflexión. Evita los
bloques largos de explicación y los diálogos demasiado expositivos. La idea se
descubre mirando.

## Apéndice A: de la acotación al motor

Escribe libre, pero sabiendo en qué se convierte cada acotación. El motor de
noesis sabe hacer esto:

| Acotación teatral | En el motor |
|---|---|
| Entorno, paisaje, set | `canvas` (cielo, piso, color), `layers` (parallax), props |
| Iluminación, apagar las luces, revelar algo | `ambient.darkness`, `focus` |
| El color que llega o se va | `ambient.saturation` (color pleno a gris) |
| Clima: lluvia, nieve, hojas, pétalos, luciérnagas | step `weather` |
| Sonidos, golpes, una nota, música de fondo | `tone` / `sweep`, `meta.music` |
| Temblor, sacudida | `camera: { shake }` |
| Acercarse, encuadrar un detalle | `camera: { to, zoom }` |
| Algo que brota, se marchita, aparece o se desvanece | `tween` de `alpha` o de una propiedad, `appear` / `vanish` |
| Personajes que actúan | learners que caminan, hablan y encarnan la mecánica |
| Dos estados a la vez (superposición, doble exposición) | dos props o entidades superpuestos con `alpha` |

La referencia completa del vocabulario está en `.claude/commands/noesis-scene.md`
y en `CLAUDE.md`.

## Apéndice B: las fronteras del motor

noesis es un mundo **visual y sonoro**, no táctil ni olfativo. Lo que la spec
pide describir con todos los sentidos hay que volverlo imagen o sonido:

- El frío no se siente: se pinta (azul, escarcha, nieve, luz fría).
- La vibración no se siente: es una sacudida de cámara.
- No hay olores ni texturas reales: se sugieren con lo que se ve.

Y hay reglas de la casa que conviene tener desde el guion, porque condicionan la
puesta en escena:

- La banda inferior del lienzo es de los subtítulos: los personajes no la
  invaden (van por encima).
- Los personajes secundarios (público, acompañantes) van del porte del
  protagonista, no como figuras diminutas.
- Sin em-dash en ningún texto (comas, dos puntos, paréntesis).
- Las preguntas retóricas van en boca de un personaje, no en el texto editorial,
  que se mantiene en afirmaciones.
- Paleta y tipografía de marca para el HUD y los textos.

## Apéndice C: el final

La spec pide cerrar con una pregunta abierta, y para los misterios que de verdad
siguen abiertos es lo correcto: el gato de Schrödinger, el cuarto de Mary, la
nave de Teseo terminan con la pregunta intacta en la mente de quien mira.

Pero noesis es didáctico y honesto. Cuando el tema **sí tiene respuesta**, el
cierre debe entregar esa verdad y, además, dejar la resonancia. Las estaciones
ocurren por la inclinación del eje terrestre, no por la pena de una diosa: la
escena lo dice, y aun así guarda lo que el mito nombró bien (la ausencia, la
espera, el reencuentro). El TPACK integra tres saberes: la escena lo demuestra, y
cierra con la pregunta que le toca al docente. Verdad y pregunta, no solo
pregunta.

## Escala

Una escena de noesis es un arco de unos dos a tres minutos. Un guion de muchos
cuadros no se construye literal: se destila a su columna vertebral, conservando
los momentos que hacen ver el concepto. Mejor pocos beats encarnados que muchos
apurados.

## El flujo

1. Escribe el guion teatral siguiendo esta guía.
2. Pásaselo a noesis (a través de la skill `/noesis`): se dialoga, se destila a su
   columna, se traduce al vocabulario del motor y se construye la escena.
3. Se valida, se previsualiza y se itera sobre lo que se ve.

El guion es donde el autor pone la intención y la calidad. El motor solo la
ejecuta.
