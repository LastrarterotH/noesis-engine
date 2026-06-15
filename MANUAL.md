# Manual de noesis-engine

Guía práctica para instalar, previsualizar, embeber y crear escenas con el motor.

noesis-engine es un motor ligero para construir animaciones narrativas embebibles que explican conceptos. Cada escena es un archivo JSON que se renderiza dentro de un Web Component `<noesis-scene>` (con Shadow DOM aislado), con pixel-art animado, sonido sintetizado, diálogo y su texto académico al lado. Sin build, sin npm, sin dependencias, sin tracking.

---

## 1. Requisitos

El motor no se compila ni se instala con un gestor de paquetes. Solo necesitas:

- Un navegador moderno (Chrome, Safari, Firefox, Edge).
- **Python 3** para servir los archivos en local (`python3 -m http.server`). Viene de fábrica en macOS.
- **Node.js** solo si vas a correr el smoke test o generar previews. No es necesario para usar el motor.
- **ffmpeg** (opcional) solo si vas a convertir grabaciones WebM a MP4.

Nada de esto incluye descargar dependencias: el motor son archivos estáticos de JavaScript.

---

## 2. Instalación

### Opción A: clonar el repositorio

```bash
git clone <url-del-repo> noesis-engine
cd noesis-engine
```

### Opción B: copiar la carpeta

Copia el directorio `noesis-engine/` completo a donde quieras. La pieza imprescindible es la carpeta `engine/`, que contiene el motor en módulos ES. Todo lo demás (escenas, ejemplos, catálogo) son contenido que puedes reemplazar.

### Estructura mínima para que funcione

```
tu-proyecto/
├── engine/                 # el motor (copialo entero, no quites archivos)
│   └── noesis-engine.js     # punto de entrada: registra <noesis-scene>
├── scenes/                 # tus escenas en JSON
│   └── 01-mi-escena.json
└── pagina.html             # donde embebes la escena
```

El motor se carga como módulo ES. Por eso **no se puede abrir con `file://`**: el navegador bloquea los imports de módulos desde el sistema de archivos. Siempre hay que servirlo por HTTP (ver siguiente sección).

---

## 3. Previsualizar en local

Desde la raíz del proyecto, levanta un servidor estático:

```bash
python3 -m http.server 8765
```

Y abre en el navegador:

- `http://localhost:8765/examples/scene-01.html` una escena con su texto académico al lado (por ahora solo la 01).

El motor carga las escenas con `cache: 'no-store'`, así que cualquier cambio al JSON se ve simplemente recargando la página. No hay que reiniciar el servidor.

> Si cambias un archivo del motor (carpeta `engine/`) y el navegador lo tiene cacheado, fuerza recarga dura (Cmd+Shift+R en macOS) o sube el `?v=N` que cuelga del `<script>`.

---

## 4. Embeber una escena en tu propia página

Dos líneas: cargar el motor y colocar el componente.

```html
<!-- 1. Carga el motor (un solo archivo, como módulo ES) -->
<script type="module" src="engine/noesis-engine.js"></script>

<!-- 2. Coloca una escena -->
<noesis-scene src="scenes/01-mi-escena.json" lang="es"></noesis-scene>
```

### Atributos del componente

| Atributo | Para qué sirve |
|---|---|
| `src` | Ruta al JSON de la escena. Obligatorio. |
| `lang` | Idioma del texto (`es`). |
| `layout="bare"` | Muestra solo el lienzo animado, sin el ensayo académico. Ideal para galerías y miniaturas. En este modo los textos de overlay se contienen para no desbordar contenedores chicos. |
| `mute` | Arranca con el audio desactivado. |
| `autoplay` | Bypasea los gates de viewport, pestaña visible y ventana enfocada, y arranca apenas se monta. Pensado para captura headless; no lo uses en producción. |
| `logo` | URL (o data URI) del logo institucional. Se dibuja en la esquina inferior IZQUIERDA, en co-branding con el wordmark «noesis.» de la derecha (que no se toca). Entra también en la grabación de video. Usa un host con CORS o un data URI, y un logo con contraste propio. |
| `logo-height` | Alto del logo en píxeles (default 26); el ancho se ajusta solo. |
| `logo-opacity` | Opacidad del logo, 0 a 1 (default 0.92). |

Ejemplo con logo institucional:

```html
<noesis-scene src="scenes/01-mi-escena.json" lang="es"
  logo="https://mi-institucion.edu/logo.svg" logo-height="28"></noesis-scene>
```

(El logo también puede ir en la config de la escena con `meta.logo`: un string URL o `{ "src": "...", "height": 28, "opacity": 0.9 }`. El atributo del embed tiene prioridad. Ver `examples/logo-demo.html`.)

### Comportamiento por defecto

Sin `autoplay`, el componente espera a estar en viewport, con la pestaña visible y la ventana enfocada antes de inicializar. Esto evita gastar CPU en escenas fuera de pantalla.

### Wrapper de ejemplo

Cada escena del catálogo tiene un wrapper mínimo en `examples/scene-NN.html`. Sirve de plantilla para tu propia página:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>mi escena</title>
</head>
<body>
  <noesis-scene src="scenes/01-mi-escena.json" lang="es"></noesis-scene>
  <script type="module" src="engine/noesis-engine.js"></script>
</body>
</html>
```

---

## 5. Controles de la escena

Cada escena trae una barra de botones a la derecha del lienzo:

- **↺ Reset.** Reinicia la escena a t=0.
- **⛶ Pantalla completa.**
- **♪ Música.** Solo aparece si la escena declara `meta.music`. Arranca silenciada: el usuario decide si la activa. La música es procedural (Web Audio, sin archivos externos).
- **● Grabar.** Graba la escena con la API `MediaRecorder`. Un clic resetea a t=0, activa la música si la escena la declara, y empieza a grabar; auto-detiene cuando termina la escena y descarga un archivo `noesis-{id}-{timestamp}.webm`. Un segundo clic mientras graba cancela y descarga lo que llevaba. Para convertir el WebM a MP4 hay un helper en `tools/webm-to-mp4.sh` (requiere ffmpeg).

El motor estampa el wordmark "noesis." en la esquina inferior derecha de cada lienzo. No se puede desactivar.

---

## 6. Crear una escena nueva

Una escena vive en `scenes/NN-slug.json`. Contiene:

- **Configuración del lienzo** (`canvas`): tamaño, cielo, piso, capas, safe areas.
- **Entidades, props y zonas**: lo que se dibuja y se mueve.
- **Texto académico**: el ensayo que acompaña a la animación.
- **Hooks**: `onInit`, `onStep`, `onDraw`, `onClick`, `onReset`, escritos como cadenas de JavaScript que el motor compila a funciones.

### Camino recomendado: el comando `/noesis-scene`

Si abres Claude Code desde la raíz del proyecto, tienes disponible el comando:

```
/noesis-scene <descripción del concepto> [flags]
```

Genera una escena nueva siguiendo todas las convenciones de voz, paleta y reglas visuales. Está definido en `.claude/commands/noesis-scene.md`. Es la vía más rápida y la que respeta las reglas sin que tengas que memorizarlas.

### Camino manual

1. `ls scenes/` para escoger el próximo número `NN` libre.
2. Slug en kebab-case basado en el concepto central (`scenes/02-mi-concepto.json`).
3. Escribe el texto académico siguiendo la voz de marca (ver `CLAUDE.md`). No inventes citas.
4. Define el lienzo, las entidades y los hooks.
5. Crea un wrapper `examples/scene-02.html` copiando uno existente y ajustando el `src`.
6. Abre `http://localhost:8765/examples/scene-02.html` y verifica visualmente.

Las convenciones completas (voz, paleta, coordenadas, anclas, toolkit de diagramas y gráficos, tweens, movimiento por camino) están documentadas en **`CLAUDE.md`**. Ese archivo es la referencia de autoría; este manual es la guía de instalación y uso.

### Pre-flight antes de dar por buena una escena

Cada hook no vacío debe compilar con `new Function(...args, src)`. Comprobación rápida:

```bash
node -e "const j=require('./scenes/NN-slug.json'); for(const k of ['onInit','onStep','onDraw','onClick','onReset']){ const a={onInit:['world'],onStep:['world','dt'],onDraw:['world','ctx'],onClick:['world','x','y','meta'],onReset:['world']}[k]; const s=j.hooks[k]||''; if(!s){console.log(k,'EMPTY');continue;} try{new Function(...a,s);console.log(k,'OK');}catch(e){console.log(k,'FAIL',e.message);} }"
```

---

## 7. Probar (smoke test headless)

```bash
node tools/smoke.mjs
```

Stubea canvas, DOM y window y corre el motor real sin navegador. Por cada escena construye el `World`, ejecuta el init más 120 ticks, simula un clic, llama a `reset()` y vuelve a tickear. Cualquier excepción es un FAIL. Caza los bugs silenciosos de módulos ES que `node --check` no detecta (imports rotos, métodos inexistentes).

No reemplaza la verificación visual: confirma que nada explote, no mira píxeles.

---

## 8. Generar las imágenes del catálogo (opcional)

Las miniaturas en `previews/scene-NN.png` se generan con:

```bash
# requiere el servidor local corriendo en el puerto 8765
node tools/capture.mjs        # todas las escenas
node tools/capture.mjs 09     # una sola
```

Lanza Chrome con depuración remota y conversa por CDP. Pre-requisito: el servidor local debe estar arriba (`python3 -m http.server 8765`); el tool lo valida al inicio. El proceso completo tarda varios minutos.

---

## 9. Resumen de comandos

```bash
# Servir en local
python3 -m http.server 8765

# Smoke test del motor
node tools/smoke.mjs

# Validar los hooks de una escena
node -e "..."   # ver sección 6

# Regenerar previews del catálogo
node tools/capture.mjs

# Convertir una grabación a MP4
bash tools/webm-to-mp4.sh archivo.webm
```

---

## 10. Dónde mirar después

- **`README.md`** vista general del proyecto y catálogo de escenas publicadas.
- **`CLAUDE.md`** convenciones completas de autoría: voz, paleta, reglas visuales, toolkit de diagramas y gráficos, tweens, movimiento por camino, coordenadas y anclas.
- **`CHANGELOG.md`** historial de cambios del motor.
