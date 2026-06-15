// noesis-engine / forms
// Compila una "forma de explicación" declarativa al guion de steps primitivos
// que el motor ya sabe correr. Una forma encarna la COLUMNA de una mecánica
// didáctica (su arco, sus tiempos, su espina de mostrar-no-narrar); el autor
// solo aporta el contenido de cada etapa, no la coreografía. Así el motor
// "sabe de qué formas explicar" con independencia del concepto, y deja de
// depender de que el LLM rearme la mecánica a mano cada vez.
//
// Fuente única de verdad: la consume el motor (world.js) para correr la escena
// y el validador (validate.js) para chequear el guion resultante con el mismo
// vocabulario de siempre. Puro: corre en Node y en el navegador, sin deps.

export const FORM_TYPES = ['viajero'];

function words(s) {
  return String(s || '').trim().split(/\s+/).filter(Boolean).length;
}

// Piso de tiempo de lectura por caption, alineado con la fórmula del manual y
// con fx.js (spawnBubble): ~1.0 s + 0.35 s por palabra, acotado a [2.4, 6.5].
// Garantiza que ninguna etapa pase tan rápido que no se alcance a leer.
function readSecs(text) {
  const t = 1.0 + 0.35 * words(text);
  return Math.max(2.4, Math.min(6.5, +t.toFixed(2)));
}

// Entrada única. Devuelve { steps, errors }: steps null si no hay forma o si
// la forma no compila (con errores accionables, estilo validador).
export function compileForm(config) {
  const form = config && config.form;
  if (!form || typeof form !== 'object') return { steps: null, errors: [] };
  if (form.type === 'viajero') return compileViajero(form);
  return {
    steps: null,
    errors: [`form.type: "${form.type}" no es una forma conocida. Formas: ${FORM_TYPES.join(', ')}.`],
  };
}

// LA FORMA "VIAJERO" (mecánica 1): un solo cuerpo atraviesa etapas ordenadas y
// cambia en el camino. La columna que la forma garantiza: hay SIEMPRE un cuerpo
// que viaja (no se puede degenerar en cabezones parlantes), cada etapa se NOMBRA
// con su caption en el momento justo, y el tiempo de lectura nunca se pisa.
//
// El autor declara:
//   subject  id de la entidad que viaja (existe en `entities`).
//   title    título de acto opcional.
//   intro    caption de apertura que sitúa la escena.
//   stages[] etapas del recorrido, cada una:
//     caption   (requerido) nombra la etapa.
//     at:[x,y]  destino del viaje (omitir = la etapa transcurre en el sitio).
//     travel    segundos del viaje hasta `at` (con `at`).
//     easing    curva del viaje.
//     via       waypoints intermedios opcionales antes de `at`.
//     focus     true = halo de luz sobre el viajero durante la etapa.
//     mood      mood del viajero en la etapa.
//     weather   arranca/detiene clima ("rain"/"snow"/.../"none").
//     dwell     segundos extra de permanencia, sobre el tiempo de lectura.
//     arrive    floritura al llegar: { particles, tone, reinforce }.
//   outro    caption de cierre que sintetiza.
function compileViajero(form) {
  const errors = [];
  const subject = form.subject;
  const stages = Array.isArray(form.stages) ? form.stages : [];
  if (!subject || typeof subject !== 'string') {
    errors.push('form.subject: el viajero necesita el id de la entidad que viaja.');
  }
  if (stages.length < 2) {
    errors.push('form.stages: el viajero necesita al menos 2 etapas (un recorrido que transforma; con una sola, no hay viaje).');
  }
  const travels = stages.filter(st => st && Array.isArray(st.at) && typeof st.travel === 'number');
  if (stages.length >= 2 && travels.length < 1) {
    errors.push('form.stages: ninguna etapa tiene "at" + "travel": el viajero nunca se mueve. Al menos una etapa debe llevarlo a un punto nuevo, si no es un cabezón parlante.');
  }
  if (errors.length) return { steps: null, errors };

  const S = [];
  S.push({ wait: 0.6 });                                   // gracia de apertura
  if (form.title) S.push({ caption: form.title, style: 'title' });
  if (form.intro) { S.push({ caption: form.intro }); S.push({ wait: readSecs(form.intro) }); }

  for (const st of stages) {
    const cap = st.caption || '';
    const read = readSecs(cap);
    const dwell = typeof st.dwell === 'number' ? st.dwell : 0;
    const at = st.at;
    const moves = Array.isArray(at) && typeof st.travel === 'number';

    S.push({ caption: cap });
    if (st.weather != null) S.push({ weather: st.weather });
    if (st.focus) S.push({ focus: subject });

    if (moves) {
      // fromCurrent (default) antepone la posición actual del viajero; solo
      // declaramos waypoints intermedios + destino.
      const pts = [];
      if (Array.isArray(st.via)) for (const v of st.via) pts.push(v);
      pts.push(at);
      S.push({ path: subject, points: pts, duration: st.travel, easing: st.easing || 'easeInOut' });
      S.push({ waitFor: 'arrive' });
    }

    if (st.mood) S.push({ mood: subject, value: st.mood, duration: 1 });

    if (st.arrive && typeof st.arrive === 'object') {
      const a = st.arrive;
      if (a.particles && moves) S.push({ particles: { preset: a.particles, x: at[0], y: at[1] } });
      if (typeof a.tone === 'number') S.push({ tone: a.tone, dur: 0.16 });
      if (a.reinforce) S.push({ reinforce: subject });
    }

    if (st.focus) S.push({ focus: subject, off: true });

    // Si hubo viaje, el caption se leyó mientras el cuerpo se movía: solo
    // sumamos lo que falte de lectura. Si fue en sitio, el tiempo completo.
    const tail = moves ? Math.max(0.4, read - st.travel) : read;
    S.push({ wait: +(tail + dwell).toFixed(2) });
  }

  if (form.outro) { S.push({ caption: form.outro }); S.push({ wait: readSecs(form.outro) }); }
  return { steps: S, errors: [] };
}
