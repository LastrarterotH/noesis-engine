# noesis-engine

Engine ligero para construir **animaciones narrativas embebibles** que explican conceptos. Cada escena es un archivo JSON que se renderiza dentro de un Web Component `<noesis-scene>` (Shadow DOM aislado), con pixel-art animado, sonido sintetizado, diálogo y su texto académico al lado.

Conceptos que se ven, no que se memorizan. Sin build, sin npm, sin dependencias, sin tracking.

## Cómo se incrusta

```html
<!-- 1. Carga el engine (un solo archivo, como módulo ES) -->
<script type="module" src="engine/noesis-engine.js"></script>

<!-- 2. Incrusta una escena -->
<noesis-scene src="scenes/01-netflix-prize.json" lang="es"></noesis-scene>
```

Atributos útiles del componente:

- `src` ruta al JSON de la escena.
- `lang` idioma del texto (`es`).
- `layout="bare"` muestra solo el lienzo animado (sin el ensayo académico): ideal para galerías y miniaturas. En este modo los textos de overlay se contienen para no desbordar contenedores chicos.
- `mute` desactiva el audio.

## Cómo previsualizar

El engine se sirve estático. Desde la raíz del proyecto:

```bash
python3 -m http.server 8765
```

Y abrir:

- `http://localhost:8765/examples/scene-NN.html` una escena con su texto académico (por ahora solo `scene-01`).

El engine carga las escenas con `cache: 'no-store'`, así que cualquier cambio al JSON se ve al recargar.

## Probar

Smoke test headless: corre el engine real en Node con stubs de canvas/DOM, construye cada escena, la tickea, simula un clic y un reset, y falla ante cualquier excepción. Caza los bugs silenciosos de ES modules que `node --check` no ve.

```bash
node tools/smoke.mjs
```

No reemplaza la verificación visual: confirma que nada explote, no mira píxeles.

## Crear una escena

Una escena vive en `scenes/NN-slug.json`: configuración del lienzo, entidades, props, texto académico y hooks (`onInit`, `onStep`, `onDraw`, `onClick`, `onReset`) como cadenas de JS que el engine compila a funciones.

Las convenciones completas (voz, paleta, reglas visuales, coordenadas, anclas) están en [`CLAUDE.md`](CLAUDE.md). El comando `/noesis-scene` (en `.claude/commands/`) genera escenas siguiendo esas reglas.

Pre-flight: cada hook no vacío debe compilar con `new Function(...args, src)`, y conviene correr `node tools/smoke.mjs`.

## Estructura

```
noesis-engine/
├── engine/                 # el motor, en módulos ES (sin build)
│   ├── noesis-engine.js     # entry: registra <noesis-scene>
│   ├── element.js           # custom element, loop RAF, loader
│   ├── world.js             # simulación: tick + orquestación de dibujo
│   ├── draw.js / mood.js / accessories.js   # dibujo de learners
│   ├── prop-draw.js / prop-sprites.js       # props
│   ├── camera.js / ambient.js / scripts.js / forms.js / floor.js
│   ├── animated-props.js / learner.js / interaction.js / fx.js
│   ├── audio.js / sky-presets.js / hooks.js / validate.js / util.js
├── scenes/NN-slug.json     # repertorio real (config + texto + hooks)
├── examples/scene-NN.html  # wrapper por escena
├── tools/                  # smoke.mjs, validate.mjs, ...
├── docs/                   # noesis-vision (charter), spec, rediseno-pedagogico
├── MANUAL.md               # manual práctico de uso
├── .claude/commands/       # /noesis-scene
└── CLAUDE.md               # convenciones de autoría
```

El engine se carga como módulo ES (`<script type="module">`). Sin build, sin dependencias.

## Repertorio

El repertorio real vive en `scenes/` (`01` por ahora: el repertorio se reinició para reconstruirlo bajo la modalidad Claude-nativa), cada escena construida deliberadamente alrededor de UNA mecánica visual (un viajero, una población, un umbral, una convergencia...).

## Cómo se usa

noesis es un motor nativo de Claude: las escenas se construyen dialogando el concepto con Claude (la skill `/noesis` o el comando `/noesis-scene`), que las arma con el vocabulario del motor, las valida con `tools/validate.mjs` y las previsualiza. No es un producto self-serve para usuarios no técnicos. Visión completa en [`docs/noesis-vision.md`](docs/noesis-vision.md).
