// noesis-engine / audio
// Shared AudioContext, lazily created on first user gesture (canvas click).
// Each fx trigger plays a short envelope-shaped tone. Mute per element via
// the `mute` attribute on <noesis-scene>.

let _ac = null;
let _masterGain = null;
let _recordingDest = null;

export function audioCtx() {
  if (_ac) return _ac;
  try { _ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  return _ac;
}

export function audioUnlock() {
  const ac = audioCtx();
  if (ac && ac.state === 'suspended') ac.resume();
}

// Master gain routed to speakers. All scene audio (tones, sweeps, ambient
// sounds, ambient music) connects here instead of ac.destination, so we can
// tee the audio into a MediaStreamAudioDestinationNode for screen recording
// without disturbing playback.
export function getMasterGain(ac) {
  if (_masterGain) return _masterGain;
  ac = ac || audioCtx();
  if (!ac) return null;
  _masterGain = ac.createGain();
  _masterGain.gain.value = 1;
  _masterGain.connect(ac.destination);
  return _masterGain;
}

// Returns a MediaStream carrying the master audio mix. Lazy-created and
// fanned out from the master gain so that activating recording does not
// duplicate routing or compete with the speaker output.
export function getRecordingStream() {
  const ac = audioCtx();
  if (!ac) return null;
  const master = getMasterGain(ac);
  if (!master) return null;
  if (!_recordingDest) {
    _recordingDest = ac.createMediaStreamDestination();
    master.connect(_recordingDest);
  }
  return _recordingDest.stream;
}

export function tone(freq, dur, opts = {}) {
  const ac = audioCtx();
  if (!ac) return;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = opts.type || 'sine';
  o.frequency.value = freq;
  o.connect(g); g.connect(getMasterGain(ac));
  const now = ac.currentTime;
  const vol = opts.vol ?? 0.15;
  const attack = opts.attack ?? 0.008;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(vol, now + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.start(now);
  o.stop(now + dur + 0.05);
}

export function sweep(from, to, dur, opts = {}) {
  const ac = audioCtx();
  if (!ac) return;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = opts.type || 'sine';
  o.frequency.setValueAtTime(from, ac.currentTime);
  o.frequency.exponentialRampToValueAtTime(to, ac.currentTime + dur);
  o.connect(g); g.connect(getMasterGain(ac));
  const vol = opts.vol ?? 0.13;
  g.gain.setValueAtTime(0, ac.currentTime);
  g.gain.linearRampToValueAtTime(vol, ac.currentTime + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  o.start();
  o.stop(ac.currentTime + dur + 0.05);
}

// --- Procedural ambient sounds -----------------------------------------

function createNoiseBuffer(ac, durationSec = 2, brown = false) {
  const length = Math.floor(ac.sampleRate * durationSec);
  const buf = ac.createBuffer(1, length, ac.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buf;
}

export function createAmbientSound(type, volume) {
  const ac = audioCtx();
  if (!ac) return null;
  const master = ac.createGain();
  master.gain.value = 0;
  master.connect(getMasterGain(ac));
  const cleanups = [];
  let alive = true;

  if (type === 'wind') {
    const noise = ac.createBufferSource();
    noise.buffer = createNoiseBuffer(ac, 3, true);
    noise.loop = true;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 550;
    lp.Q.value = 0.6;
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.10;
    const lfoDepth = ac.createGain();
    lfoDepth.gain.value = 220;
    lfo.connect(lfoDepth); lfoDepth.connect(lp.frequency);
    noise.connect(lp); lp.connect(master);
    noise.start(); lfo.start();
    cleanups.push(() => { try { noise.stop(); lfo.stop(); } catch {} });
  }
  else if (type === 'rain') {
    const noise = ac.createBufferSource();
    noise.buffer = createNoiseBuffer(ac, 2);
    noise.loop = true;
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 6500;
    const mod = ac.createGain();
    mod.gain.value = 1;
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.4;
    const lfoDepth = ac.createGain();
    lfoDepth.gain.value = 0.15;
    lfo.connect(lfoDepth); lfoDepth.connect(mod.gain);
    noise.connect(hp); hp.connect(lp); lp.connect(mod); mod.connect(master);
    noise.start(); lfo.start();
    cleanups.push(() => { try { noise.stop(); lfo.stop(); } catch {} });
  }
  else if (type === 'crickets') {
    const noise = ac.createBufferSource();
    noise.buffer = createNoiseBuffer(ac, 2);
    noise.loop = true;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 4600;
    bp.Q.value = 40;
    const env = ac.createGain();
    env.gain.value = 0.5;
    const lfo = ac.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 6.5;
    const lfoDepth = ac.createGain();
    lfoDepth.gain.value = 0.45;
    lfo.connect(lfoDepth); lfoDepth.connect(env.gain);
    noise.connect(bp); bp.connect(env); env.connect(master);
    noise.start(); lfo.start();
    cleanups.push(() => { try { noise.stop(); lfo.stop(); } catch {} });
  }
  else if (type === 'birds') {
    const chirp = () => {
      if (!alive) return;
      const o = ac.createOscillator();
      const g = ac.createGain();
      const base = 1200 + Math.random() * 1600;
      o.type = 'sine';
      o.frequency.setValueAtTime(base, ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(base * (1 + Math.random() * 0.4), ac.currentTime + 0.08);
      g.gain.setValueAtTime(0, ac.currentTime);
      g.gain.linearRampToValueAtTime(0.10, ac.currentTime + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.18);
      o.connect(g); g.connect(master);
      o.start();
      o.stop(ac.currentTime + 0.22);
      setTimeout(() => { if (alive) chirp(); }, 600 + Math.random() * 2400);
    };
    setTimeout(chirp, 400 + Math.random() * 800);
  }
  else if (type === 'fire') {
    const noise = ac.createBufferSource();
    noise.buffer = createNoiseBuffer(ac, 2, true);
    noise.loop = true;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    noise.connect(lp); lp.connect(master);
    noise.start();
    cleanups.push(() => { try { noise.stop(); } catch {} });
    const crackle = () => {
      if (!alive) return;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = 220 + Math.random() * 600;
      g.gain.setValueAtTime(0.10, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.06);
      o.connect(g); g.connect(master);
      o.start();
      o.stop(ac.currentTime + 0.08);
      setTimeout(crackle, 180 + Math.random() * 700);
    };
    crackle();
  }
  else if (type === 'water') {
    const noise = ac.createBufferSource();
    noise.buffer = createNoiseBuffer(ac, 2);
    noise.loop = true;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1200;
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.6;
    const lfoDepth = ac.createGain();
    lfoDepth.gain.value = 400;
    lfo.connect(lfoDepth); lfoDepth.connect(lp.frequency);
    noise.connect(lp); lp.connect(master);
    noise.start(); lfo.start();
    cleanups.push(() => { try { noise.stop(); lfo.stop(); } catch {} });
  }
  else if (type === 'ocean') {
    const noise = ac.createBufferSource();
    noise.buffer = createNoiseBuffer(ac, 4, true);
    noise.loop = true;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    const env = ac.createGain();
    env.gain.value = 0.6;
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoDepth = ac.createGain();
    lfoDepth.gain.value = 0.5;
    lfo.connect(lfoDepth); lfoDepth.connect(env.gain);
    noise.connect(lp); lp.connect(env); env.connect(master);
    noise.start(); lfo.start();
    cleanups.push(() => { try { noise.stop(); lfo.stop(); } catch {} });
  }

  // Fade in.
  const targetVol = volume != null ? volume : 0.12;
  const now0 = ac.currentTime;
  master.gain.linearRampToValueAtTime(targetVol, now0 + 1.5);

  return {
    type,
    setVolume(v) {
      const now = ac.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.linearRampToValueAtTime(v, now + 0.3);
    },
    stop(durationSec = 1.0) {
      const now = ac.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + durationSec);
      setTimeout(() => {
        alive = false;
        for (const fn of cleanups) fn();
        try { master.disconnect(); } catch {}
      }, (durationSec + 0.05) * 1000);
    },
  };
}

// --- Ambient music ------------------------------------------------------
// Procedural drone music per "mood". No external audio files: each preset is
// a small chord of sine/triangle oscillators with very slow LFOs modulating
// pitch and amplitude, plus a feedback delay for a sense of space. Designed
// to live underneath the scene narration without competing with it.

// Cada mood es una miniatura con movimiento real: progresion de acordes que
// re-afina el drone, arpegio humanizado (silencios y dinamica variable) y
// pulso cuando el caracter lo pide. Un preset sin estas capas suena a drone
// plano y cansa en escenas largas: no volver a eso.
const MUSIC_PRESETS = {
  // Espacial y lentisimo: acordes abiertos que derivan, campanitas escasas
  // arriba, sin pulso (el espacio no tiene latido). Am - Fmaj7 - C - Em.
  cosmic: {
    space: 0.6,
    type: 'sine', vol: 0.045, beatRate: 0.04,
    chords: [
      [55.00, 110.00, 164.81, 220.00],
      [87.31, 130.81, 174.61, 261.63],
      [65.41, 130.81, 196.00, 261.63],
      [82.41, 123.47, 164.81, 246.94],
    ],
    chordDur: 9,
    arp: [ { v: 3, oct: 2 }, { v: 2, oct: 2 }, { v: 3, oct: 1 }, { v: 1, oct: 2 } ],
    arpType: 'sine', arpStep: 1.1, arpDur: 1.6, arpVol: 0.12, arpRest: 0.2,
  },
  // Tristeza serena: Am - F - Dm - E, arpegio que baja, latido lento.
  melancholic: {
    space: 0.45,
    type: 'triangle', vol: 0.05, beatRate: 0.06,
    chords: [
      [110.00, 164.81, 220.00, 261.63],
      [87.31, 174.61, 220.00, 261.63],
      [73.42, 146.83, 220.00, 293.66],
      [82.41, 164.81, 207.65, 246.94],
    ],
    chordDur: 8,
    arp: [ { v: 3, oct: 1 }, { v: 2, oct: 1 }, { v: 1, oct: 1 }, { v: 2, oct: 1 }, { v: 0, oct: 2 }, { v: 1, oct: 1 } ],
    arpType: 'triangle', arpStep: 0.7, arpDur: 0.9, arpVol: 0.15,
    pulse: true, pulseStep: 1.9, pulseDur: 0.7, pulseVol: 0.18,
  },
  // Campo y manana: C - F - Am - G, arpegio saltarin, pulso ligero.
  pastoral: {
    space: 0.3,
    type: 'sine', vol: 0.04, beatRate: 0.05,
    chords: [
      [130.81, 196.00, 261.63, 329.63],
      [174.61, 220.00, 261.63, 349.23],
      [110.00, 164.81, 220.00, 329.63],
      [98.00, 196.00, 246.94, 293.66],
    ],
    chordDur: 6.5,
    arp: [ { v: 0, oct: 2 }, { v: 2, oct: 1 }, { v: 3, oct: 1 }, { v: 1, oct: 2 }, { v: 2, oct: 1 }, { v: 3, oct: 2 } ],
    arpType: 'sine', arpStep: 0.45, arpDur: 0.55, arpVol: 0.17,
    pulse: true, pulseStep: 1.3, pulseDur: 0.5, pulseVol: 0.16,
  },
  // Gesta en menor: Dm - Bb - F - C grave, pulso marcado, capa que crece.
  epic: {
    space: 0.5,
    type: 'sine', vol: 0.055, beatRate: 0.07,
    chords: [
      [73.42, 110.00, 146.83, 220.00],
      [58.27, 116.54, 174.61, 233.08],
      [87.31, 130.81, 174.61, 261.63],
      [65.41, 130.81, 196.00, 261.63],
    ],
    chordDur: 7,
    arp: [ { v: 0, oct: 2 }, { v: 2, oct: 1 }, { v: 1, oct: 2 }, { v: 3, oct: 1 } ],
    arpType: 'sine', arpStep: 0.6, arpDur: 0.8, arpVol: 0.16,
    pulse: true, pulseStep: 0.95, pulseDur: 0.55, pulseVol: 0.3,
    grow: true, growDur: 38, elecStep: 0.65, elecVol: 0.12,
  },
  // Modal sin terceras (quintas doricas), tambor lejano, frases escasas.
  ancient: {
    space: 0.55,
    type: 'triangle', vol: 0.045, beatRate: 0.05,
    chords: [
      [73.42, 110.00, 146.83, 220.00],
      [65.41, 98.00, 130.81, 196.00],
      [73.42, 146.83, 220.00, 293.66],
      [98.00, 146.83, 196.00, 293.66],
    ],
    chordDur: 8.5,
    arp: [ { v: 1, oct: 2 }, { v: 3, oct: 1 }, { v: 2, oct: 2 }, { v: 0, oct: 2 } ],
    arpType: 'triangle', arpStep: 0.9, arpDur: 1.1, arpVol: 0.13, arpRest: 0.18,
    pulse: true, pulseStep: 2.3, pulseDur: 0.9, pulseVol: 0.22,
  },
  // Neutro y discreto para explicar: C - G/B - Am - F, sin pulso, arpegio
  // minimo. No debe competir con la voz de la escena.
  pedagogical: {
    space: 0.2, detune: 3,
    type: 'sine', vol: 0.035, beatRate: 0.06,
    chords: [
      [130.81, 196.00, 261.63, 329.63],
      [123.47, 196.00, 246.94, 293.66],
      [110.00, 164.81, 261.63, 329.63],
      [174.61, 220.00, 261.63, 349.23],
    ],
    chordDur: 7,
    arp: [ { v: 2, oct: 2 }, { v: 0, oct: 2 }, { v: 3, oct: 1 }, { v: 1, oct: 2 } ],
    arpType: 'sine', arpStep: 0.8, arpDur: 0.7, arpVol: 0.11, arpRest: 0.15,
  },
  // Sintetico con groove: Am - G - F - G, secuencia rapida, pulso firme,
  // capa que sube. El mas ritmico del catalogo.
  electronic: {
    space: 0.12,
    type: 'square', vol: 0.025, beatRate: 0.10,
    chords: [
      [110.00, 164.81, 220.00, 261.63],
      [98.00, 146.83, 196.00, 246.94],
      [87.31, 130.81, 174.61, 220.00],
      [98.00, 146.83, 196.00, 293.66],
    ],
    chordDur: 5.5,
    arp: [ { v: 0, oct: 2 }, { v: 2, oct: 2 }, { v: 1, oct: 2 }, { v: 3, oct: 1 }, { v: 2, oct: 2 }, { v: 0, oct: 3 } ],
    arpType: 'square', arpStep: 0.35, arpDur: 0.3, arpVol: 0.12,
    pulse: true, pulseStep: 0.7, pulseDur: 0.35, pulseVol: 0.26,
    grow: true, growDur: 30, elecStep: 0.5, elecVol: 0.14,
  },
  // Calida que crece: pad templado con progresion de acordes, arpegio tenue,
  // pulso suave y una capa electronica que sube de a poco (F - Dm - Bb - C).
  warm: {
    space: 0.35, detune: 9,
    type: 'triangle', vol: 0.05, beatRate: 0.05,
    chords: [
      [174.61, 220.00, 261.63, 349.23],
      [146.83, 220.00, 293.66, 349.23],
      [174.61, 233.08, 293.66, 349.23],
      [196.00, 261.63, 329.63, 392.00],
    ],
    chordDur: 7,
    arp: [ { v: 0, oct: 2 }, { v: 2, oct: 1 }, { v: 1, oct: 2 }, { v: 3, oct: 1 }, { v: 2, oct: 2 }, { v: 1, oct: 1 } ],
    arpType: 'sine', arpStep: 0.55, arpDur: 0.7, arpVol: 0.2,
    pulse: true, pulseStep: 1.4, pulseDur: 0.6, pulseVol: 0.22,
    grow: true, growDur: 42, elecStep: 0.7, elecVol: 0.16,
  },
  // Festiva y brillante: progresion toda mayor (C - F - G - C), registro alto,
  // arpegio rapido y saltarin, pulso con rebote y capa que crece a la fiesta.
  joyful: {
    space: 0.25,
    type: 'triangle', vol: 0.055, beatRate: 0.06,
    chords: [
      [130.81, 261.63, 329.63, 392.00],
      [174.61, 349.23, 440.00, 523.25],
      [196.00, 392.00, 493.88, 587.33],
      [130.81, 261.63, 392.00, 523.25],
    ],
    chordDur: 4.0,
    arp: [ { v: 1, oct: 1 }, { v: 2, oct: 1 }, { v: 3, oct: 1 }, { v: 1, oct: 2 }, { v: 3, oct: 1 }, { v: 2, oct: 1 } ],
    arpType: 'triangle', arpStep: 0.26, arpDur: 0.3, arpVol: 0.24, arpRest: 0.06,
    pulse: true, pulseStep: 0.8, pulseDur: 0.3, pulseVol: 0.22,
    grow: true, growDur: 28, elecStep: 0.5, elecVol: 0.13,
  },
  // Suspenso: la amenaza ronda pero no llega. Am - Bb con tritono - F#dim - E,
  // gotas escasas arriba, golpe grave muy espaciado y un tic que se acerca.
  tension: {
    space: 0.4,
    type: 'triangle', vol: 0.045, beatRate: 0.09,
    chords: [
      [110.00, 164.81, 220.00, 261.63],
      [116.54, 164.81, 233.08, 293.66],
      [92.50, 130.81, 185.00, 220.00],
      [82.41, 123.47, 164.81, 207.65],
    ],
    chordDur: 8,
    arp: [ { v: 2, oct: 2 }, { v: 3, oct: 1 }, { v: 0, oct: 2 }, { v: 1, oct: 1 } ],
    arpType: 'triangle', arpStep: 1.25, arpDur: 1.5, arpVol: 0.11, arpRest: 0.35,
    pulse: true, pulseStep: 2.6, pulseDur: 0.8, pulseVol: 0.24,
    grow: true, growDur: 48, elecStep: 1.05, elecVol: 0.10,
  },
  // Enigma que no resuelve: lidio y mediantes cromáticas (Cmaj7#11 - Abmaj7 -
  // Em add9 - D con tritono), frases ascendentes que preguntan, sin pulso.
  mystery: {
    space: 0.55,
    type: 'sine', vol: 0.045, beatRate: 0.05,
    chords: [
      [130.81, 164.81, 246.94, 369.99],
      [103.83, 155.56, 196.00, 261.63],
      [164.81, 196.00, 246.94, 369.99],
      [146.83, 207.65, 261.63, 329.63],
    ],
    chordDur: 10,
    arp: [ { v: 0, oct: 2 }, { v: 1, oct: 2 }, { v: 3, oct: 1 }, { v: 2, oct: 2 }, { v: 3, oct: 2 } ],
    arpType: 'sine', arpStep: 1.0, arpDur: 1.4, arpVol: 0.11, arpRest: 0.3,
  },
  // Nana de caja de música: C - Am - F - G7, púas agudas que resuenan en
  // patrón de vals, mecer de cuna grave. Para cuentos y cierres suaves.
  lullaby: {
    space: 0.35,
    type: 'sine', vol: 0.045, beatRate: 0.04,
    chords: [
      [130.81, 196.00, 261.63, 329.63],
      [110.00, 164.81, 220.00, 261.63],
      [174.61, 220.00, 261.63, 349.23],
      [196.00, 246.94, 293.66, 349.23],
    ],
    chordDur: 6,
    arp: [ { v: 1, oct: 2 }, { v: 3, oct: 2 }, { v: 2, oct: 2 }, { v: 1, oct: 2 }, { v: 0, oct: 4 }, { v: 3, oct: 2 } ],
    arpType: 'triangle', arpStep: 0.55, arpDur: 1.3, arpVol: 0.15, arpRest: 0.1,
    pulse: true, pulseStep: 1.65, pulseDur: 0.9, pulseVol: 0.12,
  },
  // Ceremonial y memoria: himno coral Dm - Bb - Gm - A, campanas lejanas
  // muy espaciadas, campana grave que dobla. Para historia, duelo, tributo.
  solemn: {
    space: 0.65,
    type: 'sine', vol: 0.05, beatRate: 0.04,
    chords: [
      [146.83, 220.00, 293.66, 349.23],
      [116.54, 174.61, 233.08, 293.66],
      [98.00, 146.83, 196.00, 233.08],
      [110.00, 164.81, 220.00, 277.18],
    ],
    chordDur: 9.5,
    arp: [ { v: 3, oct: 1 }, { v: 0, oct: 2 }, { v: 2, oct: 1 }, { v: 1, oct: 2 } ],
    arpType: 'triangle', arpStep: 1.7, arpDur: 2.2, arpVol: 0.10, arpRest: 0.3,
    pulse: true, pulseStep: 3.4, pulseDur: 1.5, pulseVol: 0.2,
  },
  // Cuenta regresiva: Em - C - D - Bm que empuja, ostinato de nota repetida,
  // tic-tac firme y una capa que aprieta. Para carreras, plazos, umbrales.
  urgent: {
    space: 0.1,
    type: 'triangle', vol: 0.04, beatRate: 0.10,
    chords: [
      [82.41, 164.81, 196.00, 246.94],
      [65.41, 130.81, 196.00, 329.63],
      [73.42, 146.83, 220.00, 369.99],
      [123.47, 185.00, 246.94, 293.66],
    ],
    chordDur: 4.5,
    arp: [ { v: 2, oct: 2 }, { v: 2, oct: 2 }, { v: 3, oct: 2 }, { v: 2, oct: 2 }, { v: 1, oct: 4 }, { v: 3, oct: 2 } ],
    arpType: 'triangle', arpStep: 0.24, arpDur: 0.28, arpVol: 0.13, arpRest: 0.04,
    pulse: true, pulseStep: 0.55, pulseDur: 0.28, pulseVol: 0.24,
    grow: true, growDur: 26, elecStep: 0.5, elecVol: 0.11,
  },
  // Marcha civil: F - C - Dm - Bb, caja y bombo a paso firme, fanfarria breve
  // arriba. La batería reemplaza al pulse. Para desfiles, gestas colectivas,
  // procesos que avanzan paso a paso.
  march: {
    space: 0.3,
    type: 'triangle', vol: 0.045, beatRate: 0.06,
    chords: [
      [174.61, 220.00, 261.63, 349.23],
      [130.81, 196.00, 261.63, 329.63],
      [146.83, 220.00, 293.66, 349.23],
      [116.54, 174.61, 233.08, 293.66],
    ],
    chordDur: 8,
    arp: [ { v: 2, oct: 2 }, { v: 3, oct: 2 }, { v: 1, oct: 2 }, { v: 0, oct: 2 }, { v: 3, oct: 1 }, { v: 1, oct: 2 } ],
    arpType: 'triangle', arpStep: 0.5, arpDur: 0.5, arpVol: 0.14, arpRest: 0.12,
    drums: 'k.hs..h.k.hs..ss', drumStep: 0.25, drumVol: 0.5,
  },
  // Tambores rituales: quintas dóricas sobre Re (sin terceras, como ancient),
  // toms graves en patrón ancestral y hats como semillas. El pariente rítmico
  // de ancient. Para ritos, orígenes, lo comunitario.
  tribal: {
    space: 0.45,
    type: 'triangle', vol: 0.045, beatRate: 0.05,
    chords: [
      [73.42, 110.00, 146.83, 220.00],
      [65.41, 98.00, 130.81, 196.00],
      [87.31, 130.81, 174.61, 261.63],
      [98.00, 146.83, 196.00, 293.66],
    ],
    chordDur: 9.6,
    arp: [ { v: 3, oct: 2 }, { v: 2, oct: 2 }, { v: 3, oct: 1 }, { v: 1, oct: 2 } ],
    arpType: 'triangle', arpStep: 0.9, arpDur: 1.2, arpVol: 0.12, arpRest: 0.3,
    drums: 't..t..tt..t..th.', drumStep: 0.3, drumVol: 0.55,
  },
  // Beat sereno: Am7 - Fmaj7 - Cmaj7 - G, bombo suave, hats en corcheas y
  // caja relajada sobre un pad sine. Para tecnología cotidiana, datos,
  // procesos modernos que fluyen.
  groove: {
    space: 0.15,
    type: 'sine', vol: 0.045, beatRate: 0.07,
    chords: [
      [110.00, 196.00, 261.63, 329.63],
      [87.31, 174.61, 220.00, 329.63],
      [130.81, 196.00, 246.94, 329.63],
      [98.00, 196.00, 246.94, 293.66],
    ],
    chordDur: 7.7,
    arp: [ { v: 1, oct: 2 }, { v: 2, oct: 2 }, { v: 3, oct: 1 }, { v: 2, oct: 2 }, { v: 1, oct: 2 }, { v: 3, oct: 2 } ],
    arpType: 'sine', arpStep: 0.48, arpDur: 0.6, arpVol: 0.13, arpRest: 0.15,
    drums: 'k.h.s.h.k.hks.hH', drumStep: 0.24, drumVol: 0.45,
  },
  // Rock de arena, alla Muse: menor armónica Em - C - Am - B, riff de bajo
  // en sierra que bombea semicorcheas (nota repetida + salto), batería
  // directa con doble bombo y una capa square que sube al clímax. El riff
  // (0.16) y la batería (0.16) comparten grilla: van trabados. El acorde
  // dura 5.12 s = exactamente 2 compases del patrón.
  rock: {
    space: 0.18, detune: 10,
    type: 'sawtooth', vol: 0.035, beatRate: 0.08,
    chords: [
      [82.41, 123.47, 196.00, 246.94],
      [98.00, 130.81, 164.81, 261.63],
      [110.00, 130.81, 164.81, 220.00],
      [123.47, 155.56, 185.00, 246.94],
    ],
    chordDur: 5.12,
    arp: [ { v: 0, oct: 1 }, { v: 0, oct: 1 }, { v: 1, oct: 1 }, { v: 0, oct: 1 }, { v: 2, oct: 1 }, { v: 1, oct: 1 }, { v: 3, oct: 1 }, { v: 1, oct: 1 } ],
    arpType: 'sawtooth', arpStep: 0.16, arpDur: 0.18, arpVol: 0.10, arpRest: 0.02,
    drums: 'k.h.s.h.kkh.s.hH', drumStep: 0.16, drumVol: 0.5,
    grow: true, growDur: 30, elecStep: 0.32, elecVol: 0.12,
  },
  // Burlona: el sneak de cartoon. Bajo cromático C6 - C#dim7 - Dm6 - G7,
  // pizzicato staccato con huecos cómplices y el arpegio citando la burla
  // infantil (sol - mi - la - sol - mi). Batería en puntas de pie.
  mischief: {
    space: 0.12,
    type: 'triangle', vol: 0.035, beatRate: 0.07,
    chords: [
      [130.81, 164.81, 196.00, 220.00],
      [138.59, 164.81, 196.00, 233.08],
      [146.83, 174.61, 220.00, 246.94],
      [123.47, 146.83, 174.61, 196.00],
    ],
    chordDur: 4.8,
    arp: [ { v: 2, oct: 2 }, { v: 1, oct: 2 }, { v: 3, oct: 2 }, { v: 2, oct: 2 }, { v: 1, oct: 2 }, { v: 0, oct: 1 } ],
    arpType: 'triangle', arpStep: 0.3, arpDur: 0.22, arpVol: 0.18, arpRest: 0.15,
    drums: 'k..h..s...hh..s.', drumStep: 0.3, drumVol: 0.35,
  },
  // Operática / sinfónica: cuerdas de sierra en Do menor con sexta
  // napolitana (Cm - Ab - Db - G, el bajo cae en tritono Db->G), melodía
  // legato que planea con saltos amplios y timbales con redoble al cierre.
  symphonic: {
    space: 0.7, detune: 12,
    type: 'sawtooth', vol: 0.03, beatRate: 0.05,
    chords: [
      [65.41, 130.81, 196.00, 311.13],
      [103.83, 155.56, 207.65, 261.63],
      [69.30, 138.59, 174.61, 277.18],
      [98.00, 146.83, 196.00, 246.94],
    ],
    chordDur: 10.24,
    arp: [ { v: 3, oct: 2 }, { v: 2, oct: 2 }, { v: 1, oct: 4 }, { v: 3, oct: 2 }, { v: 0, oct: 4 }, { v: 2, oct: 2 } ],
    arpType: 'triangle', arpStep: 0.85, arpDur: 1.6, arpVol: 0.13, arpRest: 0.12,
    drums: 'tH......t.....tt', drumStep: 0.32, drumVol: 0.5,
  },
};

export function createAmbientMusic(mood, volume) {
  const ac = audioCtx();
  if (!ac) return null;
  const preset = MUSIC_PRESETS[mood] || MUSIC_PRESETS.cosmic;
  const cleanups = [];
  const timers = [];
  // `master` es el bus de SUMA a nivel de línea (gain 1): el compresor y
  // la reverb procesan AQUÍ, donde hay señal de verdad. El volumen
  // ambiental final vive en `out` (ramp, setVolume y fade de stop): si el
  // compresor colgara después de esa atenuación (~-30 dB), su umbral de
  // -24 dB jamás engancharía y sería un adorno. Orden: capas → master →
  // comp (+ reverb en paralelo) → out → master del motor.
  const master = ac.createGain();
  master.gain.value = 1;
  const out = ac.createGain();
  out.gain.value = 0;
  out.connect(getMasterGain(ac));
  cleanups.push(() => { try { out.disconnect(); } catch {} });

  // Compresor suave: pega las capas entre sí y evita que un golpe de
  // percusión tape al arpegio o al drone.
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -24;
  comp.knee.value = 24;
  comp.ratio.value = 3;
  comp.attack.value = 0.015;
  comp.release.value = 0.25;
  comp.connect(out);
  master.connect(comp);
  cleanups.push(() => { try { comp.disconnect(); master.disconnect(); } catch {} });

  // Reverb de SALA sin archivos: la respuesta de impulso se sintetiza en
  // runtime (ruido estéreo con decaimiento exponencial escrito a un
  // AudioBuffer). `preset.space` (0..1) gobierna tamaño de sala y nivel
  // wet; 0 = sala muerta (sin convolver). La cola va al compresor en
  // paralelo con la señal seca, y al parar la música muere sola con el
  // fade del master.
  const space = Math.max(0, Math.min(1, preset.space ?? 0.25));
  let verb = null;
  if (space > 0) {
    const irDur = 1.2 + space * 3.0;
    const irLen = Math.floor(ac.sampleRate * irDur);
    const ir = ac.createBuffer(2, irLen, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.2 + (1 - space) * 1.5);
    }
    verb = ac.createConvolver();
    verb.buffer = ir;
    const verbGain = ac.createGain();
    verbGain.gain.value = 0.25 + space * 0.55;
    master.connect(verb); verb.connect(verbGain); verbGain.connect(comp);
    cleanups.push(() => { try { verb.disconnect(); verbGain.disconnect(); } catch {} });
  }

  // El delay clásico queda como eco rítmico, con menos wet que antes: la
  // sensación de sala ahora la pone la reverb (antes el 0.4 de eco hacía
  // de "sala" y enmascaraba cualquier reverb que se sumara encima).
  const delay = ac.createDelay(2);
  delay.delayTime.value = 0.42;
  const feedback = ac.createGain();
  feedback.gain.value = 0.32;
  const wet = ac.createGain();
  wet.gain.value = 0.32;
  delay.connect(feedback); feedback.connect(delay); delay.connect(wet); wet.connect(master);
  const chords = preset.chords || null;
  const baseChord = chords ? chords[0] : preset.freqs;
  let chordIdx = 0;

  // Nota corta con envolvente de pluck hacia un bus destino. `when` opcional:
  // tiempo exacto en el reloj del AudioContext (lo pasan las capas rítmicas).
  const pluck = (dest, freq, type, dur, peak, attack, when) => {
    const o = ac.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ac.createGain();
    o.connect(g); g.connect(dest);
    const t0 = when != null ? when : ac.currentTime + 0.02;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + (attack || 0.02));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.start(t0); o.stop(t0 + dur + 0.06);
  };

  // Scheduler con lookahead, compartido por TODAS las capas rítmicas (arp,
  // pulse, grow, drums): el setInterval solo empuja una ventana de 250 ms y
  // el instante exacto de cada evento lo fija el reloj del AudioContext (los
  // timers del navegador tienen un jitter de 10-50 ms, audible en cualquier
  // patrón rítmico). Todas las capas arrancan su grilla en el mismo origen,
  // así arp y batería quedan encajados cuando sus pasos son múltiplos. Si el
  // tab se durmió, los pasos perdidos se saltan sin sonar (nada de ráfagas).
  const gridStart = ac.currentTime + 0.1;
  const schedule = (stepSec, fn) => {
    let i = 0;
    let nextT = gridStart;
    timers.push(setInterval(() => {
      while (nextT < ac.currentTime) { nextT += stepSec; i++; }
      while (nextT < ac.currentTime + 0.25) { fn(i, nextT); i++; nextT += stepSec; }
    }, 100));
  };

  // --- kit de percusión sintetizada (sin archivos, como todo lo demás) ---
  // Bombo: seno con caída de tono. Caja: ruido bandpass + cuerpo corto.
  // Hat: ruido highpass brevísimo (abierto = decae más). Tom: seno grave.
  let noiseBuf = null;
  const noiseSrc = () => {
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.5), ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ac.createBufferSource(); src.buffer = noiseBuf; return src;
  };
  // Cada voz recibe su tiempo exacto t0 en el reloj del AudioContext: la
  // percusión no tolera el jitter de los timers del navegador.
  const kick = (dest, vel, t0) => {
    const o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(160, t0);
    o.frequency.exponentialRampToValueAtTime(50, t0 + 0.10);
    const g = ac.createGain();
    g.gain.setValueAtTime(vel, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
    o.connect(g); g.connect(dest);
    o.start(t0); o.stop(t0 + 0.3);
    // Click de ataque: sin él, el barrido grave desaparece en parlantes chicos.
    const c = ac.createOscillator(); c.type = 'triangle'; c.frequency.value = 900;
    const cg = ac.createGain();
    cg.gain.setValueAtTime(vel * 0.35, t0);
    cg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.025);
    c.connect(cg); cg.connect(dest);
    c.start(t0); c.stop(t0 + 0.05);
  };
  const snare = (dest, vel, t0) => {
    const n = noiseSrc();
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.8;
    const g = ac.createGain();
    g.gain.setValueAtTime(vel, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    n.connect(bp); bp.connect(g); g.connect(dest);
    n.start(t0); n.stop(t0 + 0.2);
    const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = 190;
    const og = ac.createGain();
    og.gain.setValueAtTime(vel * 0.6, t0);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
    o.connect(og); og.connect(dest);
    o.start(t0); o.stop(t0 + 0.12);
  };
  const hat = (dest, vel, open, t0) => {
    const n = noiseSrc();
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6500;
    const g = ac.createGain();
    const dur = open ? 0.22 : 0.05;
    g.gain.setValueAtTime(vel, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    n.connect(hp); hp.connect(g); g.connect(dest);
    n.start(t0); n.stop(t0 + dur + 0.03);
  };
  const tom = (dest, vel, t0) => {
    const o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(110, t0);
    o.frequency.exponentialRampToValueAtTime(70, t0 + 0.18);
    const g = ac.createGain();
    g.gain.setValueAtTime(vel, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
    o.connect(g); g.connect(dest);
    o.start(t0); o.stop(t0 + 0.4);
  };

  // --- drone sostenido (acorde base, con vibrato + tremolo) ---
  // Unison: cada voz del acorde son TRES osciladores desafinados ±detune
  // cents (`preset.detune`, default 7): el efecto ensemble que separa un
  // pad sintético plano de una sección cálida. El vibrato y el tremolo se
  // comparten por voz, así la voz respira como un solo instrumento; el
  // batido entre los tres desafinados pone el chorus.
  const UNISON = [0, 1, -1];
  const det = preset.detune ?? 7;
  const voiceOscs = [];
  for (let i = 0; i < baseChord.length; i++) {
    const f = baseChord[i];
    const g = ac.createGain();
    g.gain.value = 1 / (baseChord.length * 2);
    const lfo = ac.createOscillator();
    lfo.frequency.value = preset.beatRate * (0.7 + Math.random() * 0.6);
    const lfoDepth = ac.createGain();
    // Vibrato a la mitad de lo histórico (±0.2%): con ±0.4% el wobble
    // enterraba el batido del unison y el ensemble no se percibía.
    lfoDepth.gain.value = f * 0.002;
    lfo.connect(lfoDepth);
    const ampLfo = ac.createOscillator();
    ampLfo.frequency.value = preset.beatRate * (0.5 + Math.random() * 0.5);
    const ampDepth = ac.createGain();
    ampDepth.gain.value = g.gain.value * 0.25;
    ampLfo.connect(ampDepth); ampDepth.connect(g.gain);
    g.connect(master); g.connect(delay);
    const voice = [];
    for (const u of UNISON) {
      const o = ac.createOscillator();
      o.type = preset.type;
      o.frequency.value = f;
      o.detune.value = det * u;
      lfoDepth.connect(o.frequency);
      o.connect(g);
      o.start();
      voice.push(o);
      cleanups.push(() => { try { o.stop(); } catch {} });
    }
    lfo.start(); ampLfo.start();
    voiceOscs.push(voice);
    cleanups.push(() => { try { lfo.stop(); ampLfo.stop(); } catch {} });
  }

  // --- progresion de acordes: re-afina el drone entre acordes ---
  // (los tres osciladores del unison viajan juntos; el detune en cents es
  // relativo, así que se conserva solo)
  if (chords && chords.length > 1) {
    timers.push(setInterval(() => {
      chordIdx = (chordIdx + 1) % chords.length;
      const ch = chords[chordIdx];
      const now = ac.currentTime;
      for (let i = 0; i < voiceOscs.length; i++) {
        const f = ch[i % ch.length];
        for (const o of voiceOscs[i]) o.frequency.setTargetAtTime(f, now, 0.7);
      }
    }, (preset.chordDur || 7) * 1000));
  }

  // --- arpegio / movimiento melodico ---
  if (preset.arp) {
    const arpBus = ac.createGain(); arpBus.gain.value = 1;
    arpBus.connect(master); arpBus.connect(delay);
    schedule(preset.arpStep || 0.55, (i, t0) => {
      const ch = chords ? chords[chordIdx] : preset.freqs;
      const p = preset.arp[i % preset.arp.length];
      // Humanizacion: silencios ocasionales (arpRest, default 10%) y dinamica
      // variable por nota, para que el patron no suene a secuenciador en bucle.
      // La dinamica varia; el tiempo va clavado a la grilla.
      if (Math.random() < (preset.arpRest ?? 0.1)) return;
      const vel = 0.7 + Math.random() * 0.5;
      pluck(arpBus, ch[p.v % ch.length] * (p.oct || 1), preset.arpType || 'sine', preset.arpDur || 0.6, (preset.arpVol || 0.06) * vel, 0.015, t0);
    });
  }

  // --- pulso grave suave ---
  if (preset.pulse) {
    const pulseBus = ac.createGain(); pulseBus.gain.value = 1;
    pulseBus.connect(master);
    schedule(preset.pulseStep || 1.4, (i, t0) => {
      const ch = chords ? chords[chordIdx] : preset.freqs;
      pluck(pulseBus, ch[0] / 2, 'sine', preset.pulseDur || 0.55, preset.pulseVol || 0.045, 0.008, t0);
    });
  }

  // --- capa electronica que crece con el tiempo ---
  if (preset.grow) {
    const elecBus = ac.createGain(); elecBus.gain.value = 0.0001;
    elecBus.connect(master); elecBus.connect(delay);
    elecBus.gain.setValueAtTime(0.0001, ac.currentTime);
    elecBus.gain.linearRampToValueAtTime(preset.elecVol || 0.05, ac.currentTime + (preset.growDur || 42));
    schedule(preset.elecStep || 0.7, (i, t0) => {
      const ch = chords ? chords[chordIdx] : preset.freqs;
      pluck(elecBus, ch[(i * 2 + 1) % ch.length] * 2, 'square', 0.22, 1.0, 0.004, t0);
    });
  }

  // --- batería por patrón: 'k' bombo, 's' caja, 'h' hat, 'H' hat abierto,
  // 't' tom, '.' silencio; un carácter por paso de drumStep segundos.
  // Va seca al master (sin delay: la percusión con eco se emborrona) y se
  // humaniza por golpe SOLO en velocidad (drumRest = fallos escasos); el
  // tiempo lo pone el scheduler de lookahead, como en todas las capas.
  if (preset.drums) {
    const drumBus = ac.createGain(); drumBus.gain.value = 1;
    drumBus.connect(master);
    const pat = preset.drums;
    schedule(preset.drumStep || 0.25, (i, t0) => {
      const c = pat[i % pat.length];
      if (c === '.') return;
      if (Math.random() < (preset.drumRest ?? 0.04)) return;
      const vel = (preset.drumVol || 0.5) * (0.8 + Math.random() * 0.4);
      if (c === 'k') kick(drumBus, vel, t0);
      else if (c === 's') snare(drumBus, vel * 0.85, t0);
      else if (c === 'h') hat(drumBus, vel * 0.55, false, t0);
      else if (c === 'H') hat(drumBus, vel * 0.55, true, t0);
      else if (c === 't') tom(drumBus, vel, t0);
    });
  }

  const targetVol = volume != null ? volume : preset.vol;
  out.gain.linearRampToValueAtTime(targetVol, ac.currentTime + 2.2);
  return {
    mood,
    setVolume(v) {
      const now = ac.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.linearRampToValueAtTime(v, now + 0.3);
    },
    // A/B en vivo del procesamiento nuevo (lo usa tools/music-test.html):
    // false puentea compresor y reverb (master directo a out) y aplana el
    // unison (detune 0 en todos los osciladores del drone); true restaura.
    setFx(on) {
      try { master.disconnect(); } catch {}
      if (on) {
        master.connect(comp);
        if (verb) master.connect(verb);
      } else {
        master.connect(out);
      }
      for (const voice of voiceOscs) voice.forEach((o, j) => { o.detune.value = on ? det * UNISON[j] : 0; });
    },
    stop(durationSec = 1.6) {
      const now = ac.currentTime;
      for (const id of timers) clearInterval(id);
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.linearRampToValueAtTime(0, now + durationSec);
      setTimeout(() => {
        for (const fn of cleanups) fn();
        try { out.disconnect(); } catch {}
      }, (durationSec + 0.05) * 1000);
    },
  };
}

// Named fx dispatcher, accessed by string key from engine sfx()/say hooks.
export const audio = {
  surprise: () => { tone(880, 0.10, { type: 'triangle', vol: 0.12 }); setTimeout(() => tone(1180, 0.09, { type: 'triangle', vol: 0.10 }), 70); },
  reinforce: () => { tone(523.25, 0.55, { vol: 0.10 }); tone(659.25, 0.55, { vol: 0.09 }); tone(783.99, 0.55, { vol: 0.08 }); },
  flash:    () => tone(1320, 0.18, { vol: 0.16, attack: 0.003 }),
  transfer: () => sweep(440, 880, 0.45, { vol: 0.12 }),
  wake:     () => sweep(220, 440, 0.25, { vol: 0.10 }),
  think:    () => tone(660, 0.08, { type: 'triangle', vol: 0.07 }),
  say:      () => tone(520, 0.10, { type: 'triangle', vol: 0.08 }),
  number:   () => tone(1760, 0.06, { vol: 0.06, attack: 0.002 }),
};
