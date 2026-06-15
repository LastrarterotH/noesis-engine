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
};

export function createAmbientMusic(mood, volume) {
  const ac = audioCtx();
  if (!ac) return null;
  const preset = MUSIC_PRESETS[mood] || MUSIC_PRESETS.cosmic;
  const master = ac.createGain();
  master.gain.value = 0;
  master.connect(getMasterGain(ac));
  const delay = ac.createDelay(2);
  delay.delayTime.value = 0.42;
  const feedback = ac.createGain();
  feedback.gain.value = 0.32;
  const wet = ac.createGain();
  wet.gain.value = 0.4;
  delay.connect(feedback); feedback.connect(delay); delay.connect(wet); wet.connect(master);

  const cleanups = [];
  const timers = [];
  const chords = preset.chords || null;
  const baseChord = chords ? chords[0] : preset.freqs;
  let chordIdx = 0;

  // Nota corta con envolvente de pluck hacia un bus destino.
  const pluck = (dest, freq, type, dur, peak, attack) => {
    const o = ac.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ac.createGain();
    o.connect(g); g.connect(dest);
    const t0 = ac.currentTime + 0.02;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + (attack || 0.02));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.start(t0); o.stop(t0 + dur + 0.06);
  };

  // --- drone sostenido (acorde base, con vibrato + tremolo) ---
  const oscs = [];
  for (let i = 0; i < baseChord.length; i++) {
    const f = baseChord[i];
    const o = ac.createOscillator();
    o.type = preset.type;
    o.frequency.value = f;
    const g = ac.createGain();
    g.gain.value = 1 / baseChord.length;
    const lfo = ac.createOscillator();
    lfo.frequency.value = preset.beatRate * (0.7 + Math.random() * 0.6);
    const lfoDepth = ac.createGain();
    lfoDepth.gain.value = f * 0.004;
    lfo.connect(lfoDepth); lfoDepth.connect(o.frequency);
    const ampLfo = ac.createOscillator();
    ampLfo.frequency.value = preset.beatRate * (0.5 + Math.random() * 0.5);
    const ampDepth = ac.createGain();
    ampDepth.gain.value = 0.25 / baseChord.length;
    ampLfo.connect(ampDepth); ampDepth.connect(g.gain);
    o.connect(g); g.connect(master); g.connect(delay);
    o.start(); lfo.start(); ampLfo.start();
    oscs.push(o);
    cleanups.push(() => { try { o.stop(); lfo.stop(); ampLfo.stop(); } catch {} });
  }

  // --- progresion de acordes: re-afina el drone entre acordes ---
  if (chords && chords.length > 1) {
    timers.push(setInterval(() => {
      chordIdx = (chordIdx + 1) % chords.length;
      const ch = chords[chordIdx];
      const now = ac.currentTime;
      for (let i = 0; i < oscs.length; i++) oscs[i].frequency.setTargetAtTime(ch[i % ch.length], now, 0.7);
    }, (preset.chordDur || 7) * 1000));
  }

  // --- arpegio / movimiento melodico ---
  if (preset.arp) {
    const arpBus = ac.createGain(); arpBus.gain.value = 1;
    arpBus.connect(master); arpBus.connect(delay);
    let i = 0;
    timers.push(setInterval(() => {
      const ch = chords ? chords[chordIdx] : preset.freqs;
      const p = preset.arp[i % preset.arp.length];
      i++;
      // Humanizacion: silencios ocasionales (arpRest, default 10%) y dinamica
      // variable por nota, para que el patron no suene a secuenciador en bucle.
      if (Math.random() < (preset.arpRest ?? 0.1)) return;
      const vel = 0.7 + Math.random() * 0.5;
      pluck(arpBus, ch[p.v % ch.length] * (p.oct || 1), preset.arpType || 'sine', preset.arpDur || 0.6, (preset.arpVol || 0.06) * vel, 0.015);
    }, (preset.arpStep || 0.55) * 1000));
  }

  // --- pulso grave suave ---
  if (preset.pulse) {
    const pulseBus = ac.createGain(); pulseBus.gain.value = 1;
    pulseBus.connect(master);
    timers.push(setInterval(() => {
      const ch = chords ? chords[chordIdx] : preset.freqs;
      pluck(pulseBus, ch[0] / 2, 'sine', preset.pulseDur || 0.55, preset.pulseVol || 0.045, 0.008);
    }, (preset.pulseStep || 1.4) * 1000));
  }

  // --- capa electronica que crece con el tiempo ---
  if (preset.grow) {
    const elecBus = ac.createGain(); elecBus.gain.value = 0.0001;
    elecBus.connect(master); elecBus.connect(delay);
    elecBus.gain.setValueAtTime(0.0001, ac.currentTime);
    elecBus.gain.linearRampToValueAtTime(preset.elecVol || 0.05, ac.currentTime + (preset.growDur || 42));
    let i = 0;
    timers.push(setInterval(() => {
      const ch = chords ? chords[chordIdx] : preset.freqs;
      pluck(elecBus, ch[(i * 2 + 1) % ch.length] * 2, 'square', 0.22, 1.0, 0.004);
      i++;
    }, (preset.elecStep || 0.7) * 1000));
  }

  const targetVol = volume != null ? volume : preset.vol;
  master.gain.linearRampToValueAtTime(targetVol, ac.currentTime + 2.2);
  return {
    mood,
    setVolume(v) {
      const now = ac.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.linearRampToValueAtTime(v, now + 0.3);
    },
    stop(durationSec = 1.6) {
      const now = ac.currentTime;
      for (const id of timers) clearInterval(id);
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + durationSec);
      setTimeout(() => {
        for (const fn of cleanups) fn();
        try { master.disconnect(); } catch {}
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
