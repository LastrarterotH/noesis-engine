// noesis-engine / element
// <noesis-scene> custom element. Owns the canvas, loads scene config,
// instantiates World, runs the RAF loop, exposes labels via Shadow DOM.

import { escapeHtml, anchorTransform, formatAPA, richToHtml } from './util.js?v=115';
import { audioCtx, audioUnlock, getRecordingStream } from './audio.js?v=115';
import { World } from './world.js?v=115';

export class NoesisScene extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._raf = null;
    this._lastT = 0;
    this._visible = false;
  }

  connectedCallback() {
    this._mount();
  }

  disconnectedCallback() {
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._io) this._io.disconnect();
    if (this._onVisChange) document.removeEventListener('visibilitychange', this._onVisChange);
    if (this._onBlur) window.removeEventListener('blur', this._onBlur);
    if (this._onFocus) window.removeEventListener('focus', this._onFocus);
    // Hard cleanup: cancel timeouts, stop ambient sounds, suspend audio.
    if (this._recorder && this._recorder.state !== 'inactive') {
      try { this._recorder.stop(); } catch {}
    }
    if (this._world) {
      if (this._world._timeouts) {
        for (const id of this._world._timeouts) clearTimeout(id);
        this._world._timeouts.clear();
      }
      if (this._world._ambientSoundMap) {
        for (const [, snd] of this._world._ambientSoundMap) {
          try { snd.stop(0.4); } catch {}
        }
        this._world._ambientSoundMap.clear();
      }
      if (this._world._ambientMusic) {
        try { this._world._ambientMusic.stop(0.4); } catch {}
        this._world._ambientMusic = null;
      }
    }
    try { const ac = audioCtx(); if (ac && ac.state === 'running') ac.suspend(); } catch {}
  }

  async _mount() {
    const config = await this._readConfig();
    if (!config) {
      this.shadowRoot.innerHTML = `<div style="font:14px monospace;color:#a33;padding:12px">noesis-scene: no config found</div>`;
      return;
    }
    const w = config.canvas?.w || 600;
    const h = config.canvas?.h || 300;
    // Supersample the canvas backing store so canvas-drawn text stays crisp
    // when the (pixelated) canvas is scaled up. Scene coords stay logical
    // (w x h); World scales the context by this factor in runDraw.
    // Quality standard: 3x (800x450 -> 2400x1350). A scene can lower it with
    // canvas.ss (e.g. 2) if it renders heavy and drops frames.
    const SS = config.canvas?.ss ?? 3;
    const layout = this.getAttribute('layout') || 'full';
    const lang = this._pickLang(config);
    const textBlock = (layout === 'full') ? this._renderText(config, lang) : '';
    const hintText = (typeof config.hint === 'object' && config.hint !== null)
      ? (config.hint[lang] || config.hint.es || config.hint.en || '')
      : (config.hint || '');

    this.shadowRoot.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@1,9..144,400;1,9..144,500;1,9..144,600;1,9..144,700&display=swap');
        :host {
          display: block; max-width: 100%;
          --navy: #1F2547;
          --amber: #F4AC1D;
          --paper: #FBFAF6;
          --paper-warm: #F6F2E8;
          --slate: #6E7896;
          --line: #E8E2D2;
          color: var(--navy);
          font: 16px/1.65 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
          letter-spacing: -0.005em;
        }
        .text { max-width: 720px; margin: 0 auto 20px; }
        .text h2 {
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          font-size: 28px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15;
          margin: 0 0 14px; color: var(--navy);
        }
        .text h2 em { font-family: 'Fraunces', Georgia, serif; font-weight: 600; font-style: italic; }
        .text .scene-num {
          font: 600 11px/1 'Plus Jakarta Sans', system-ui, sans-serif;
          color: var(--amber); letter-spacing: 0.12em; text-transform: uppercase;
          margin-bottom: 10px;
        }
        .text p { margin: 14px 0; color: var(--navy); }
        .text p em { font-family: 'Fraunces', Georgia, serif; font-style: italic; color: var(--navy); }
        .text p strong { font-weight: 600; color: var(--navy); }
        .text .refs {
          margin-top: 22px; padding-top: 16px;
          font-size: 13px; line-height: 1.55; color: var(--slate);
          border-top: 1px solid var(--line);
        }
        .text .refs h3 {
          font: 600 10px/1 'Plus Jakarta Sans', system-ui, sans-serif;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--amber); margin: 0 0 10px;
        }
        .text .refs .ref { margin: 6px 0; }
        .text .refs em { font-family: 'Fraunces', Georgia, serif; font-style: italic; }
        .text .refs a { color: var(--amber); text-decoration: none; }
        .text .refs a:hover { text-decoration: underline; }
        .wrap { position: relative; width: 100%; max-width: 100%; }
        .stage { position: relative; width: 100%; aspect-ratio: ${w} / ${h}; --ui-scale: 1; }
        canvas {
          display: block; width: 100%; height: 100%;
          image-rendering: pixelated; image-rendering: crisp-edges;
          background: ${config.canvas?.bg || '#0e1430'};
          cursor: ${config.hooks?.onClick ? 'crosshair' : 'default'};
          border-radius: 6px;
        }
        .reset, .fs, .music, .rec {
          position: absolute; top: 10px;
          width: 26px; height: 26px;
          background: rgba(31, 37, 71, 0.7);
          border: 1px solid var(--amber);
          color: var(--amber);
          font: 600 15px/1 'Plus Jakarta Sans', system-ui, sans-serif;
          cursor: pointer; padding: 0;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.2s ease;
          border-radius: 4px;
        }
        .reset { right: 10px; }
        .fs    { right: 44px; }
        .music { right: 78px; font-size: 17px; }
        .rec   { right: 112px; font-size: 12px; }
        .music.active { background: var(--amber); color: var(--navy); }
        .rec.active   { background: #c44a3e; border-color: #c44a3e; color: #fbfaf6; animation: recpulse 1.4s ease-in-out infinite; }
        .fs:hover, .reset:hover, .music:hover, .rec:hover { background: var(--navy); }
        .music.active:hover { background: #e89a10; color: var(--navy); }
        .rec.active:hover { background: #a83a2e; }
        @keyframes recpulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(196,74,62,0.7); } 50% { box-shadow: 0 0 0 6px rgba(196,74,62,0); } }
        .wrap:fullscreen { background: var(--navy); display: flex; align-items: center; justify-content: center; width: 100vw; height: 100vh; }
        .wrap:fullscreen .stage { width: min(100vw, calc(100vh * ${w} / ${h})); height: min(100vh, calc(100vw * ${h} / ${w})); }
        .overlays { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
        .overlays .label {
          position: absolute;
          color: var(--paper);
          font: calc(13px * var(--ui-scale))/1.45 'Plus Jakarta Sans', system-ui, sans-serif;
          transition: opacity 0.5s ease;
        }
        .overlays .label.hidden { opacity: 0; pointer-events: none; }
        /* Notación matemática (subconjunto LaTeX, delimitado con $...$): variables
           en itálica, fracciones apiladas, operadores y relaciones con su espacio. */
        .math { font-family: 'Latin Modern Roman','Times New Roman','Cambria Math','STIX Two Text',serif; font-style: normal; white-space: nowrap; font-variant-numeric: lining-nums; font-feature-settings: 'lnum' 1, 'onum' 0; }
        .math i { font-style: italic; }
        .math .op { font-style: normal; margin: 0 0.18em 0 0.16em; }
        .math .rel { margin: 0 0.24em; }
        .math .frac { display: inline-flex; flex-direction: column; vertical-align: middle; text-align: center; padding: 0 3px; line-height: 1.05; font-size: 0.86em; }
        .math .frac > .fnum { padding: 0 5px 1px; border-bottom: 0.08em solid currentColor; }
        .math .frac > .fden { padding: 1px 5px 0; }
        .math .rad { border-top: 0.08em solid currentColor; padding: 0 2px; }
        .math .rad::before { content: '√'; margin: 0 1px 0 -2px; }
        /* Embedded (bare) scenes are teasers in a small host. Keep the dialogue
           (speech bubbles are clamped inside the canvas) and name labels, but
           constrain free caption labels so they wrap instead of overflowing,
           and drop the centered UI hint. */
        :host([layout="bare"]) .hint { display: none !important; }
        :host([layout="bare"]) .reset,
        :host([layout="bare"]) .fs,
        :host([layout="bare"]) .music,
        :host([layout="bare"]) .rec { display: none !important; }
        :host([layout="bare"]) .overlays .label {
          white-space: normal !important;
          max-width: 90% !important;
          overflow-wrap: anywhere;
        }
        :host([layout="bare"]) .overlays .bubble {
          white-space: normal !important;
          max-width: 78% !important;
          overflow-wrap: anywhere;
        }
        .overlays .bubble {
          position: absolute;
          background: var(--paper);
          color: var(--navy);
          border: 1.5px solid var(--navy);
          border-radius: calc(10px * var(--ui-scale));
          padding: calc(5px * var(--ui-scale)) calc(10px * var(--ui-scale));
          font: 500 calc(12px * var(--ui-scale))/1.35 'Plus Jakarta Sans', "Apple Color Emoji", "Segoe UI Emoji", system-ui, sans-serif;
          /* Wrap on any screen, not just bare. Cap width with a fixed pixel
             ceiling so long dialogue never falls off the edge and never
             stretches into ribbons of widely-spaced words. */
          white-space: normal !important;
          max-width: min(calc(420px * var(--ui-scale)), 78%) !important;
          overflow-wrap: break-word;
          text-align: left !important;
          text-align-last: left !important;
          word-spacing: normal !important;
          letter-spacing: 0 !important;
          box-shadow: 2px 2px 0 rgba(31,37,71,0.45);
          transition: opacity 0.35s ease;
          pointer-events: none;
        }
        .overlays .bubble::after {
          content: '';
          position: absolute;
          bottom: calc(-7px * var(--ui-scale)); left: calc(50% + var(--tail-shift, 0px));
          transform: translateX(-50%);
          width: calc(10px * var(--ui-scale)); height: calc(7px * var(--ui-scale));
          background: var(--paper);
          border-right: 1.5px solid var(--navy);
          border-bottom: 1.5px solid var(--navy);
          clip-path: polygon(0 0, 100% 0, 50% 100%);
        }
        .overlays .bubble.think {
          border-radius: 14px;
          font-family: 'Fraunces', Georgia, serif;
          font-style: italic;
        }
        /* Símbolos de expresión: emojis (❗ ❓), sin cursiva ni color de texto
           (el glifo emoji trae el suyo). */
        .overlays .bubble.symbol-exclaim,
        .overlays .bubble.symbol-wonder {
          padding: calc(3px * var(--ui-scale)) calc(8px * var(--ui-scale));
          font-style: normal; font-size: calc(16px * var(--ui-scale));
          line-height: 1.3;
        }
        .overlays .bubble .dots { display: inline-flex; gap: 2px; }
        .overlays .bubble .dots span {
          display: inline-block;
          animation: noesis-dots 1.1s ease-in-out infinite;
          opacity: 0.25;
        }
        .overlays .bubble .dots span:nth-child(2) { animation-delay: 0.18s; }
        .overlays .bubble .dots span:nth-child(3) { animation-delay: 0.36s; }
        @keyframes noesis-dots {
          0%, 60%, 100% { opacity: 0.25; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-2px); }
        }
        .overlays .name-label {
          position: absolute;
          /* Bajo el blob (positionBubbles ya ancla top bajo los pies): arriba
             está la zona de los globos de diálogo y se tapaban. */
          transform: translate(-50%, 0);
          font: 600 calc(10px * var(--ui-scale))/1 'Plus Jakarta Sans', system-ui, sans-serif;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--paper);
          background: rgba(31,37,71,0.78);
          padding: calc(3px * var(--ui-scale)) calc(8px * var(--ui-scale));
          border: 1px solid rgba(244,172,29,0.6);
          border-radius: 3px;
          pointer-events: none;
          white-space: nowrap;
        }
        .overlays .bubble.think::after {
          content: '';
          background: var(--paper);
          border: 1.5px solid var(--navy);
          border-radius: 50%;
          width: 5px; height: 5px;
          bottom: -10px; left: 40%;
          transform: none;
          clip-path: none;
          box-shadow:
            -6px 6px 0 -1px var(--paper),
            -6px 6px 0 0.5px var(--navy);
        }
        .hint {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          font: 600 calc(11px * var(--ui-scale))/1 'Plus Jakarta Sans', system-ui, sans-serif;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--paper);
          background: rgba(31, 37, 71, 0.88);
          padding: calc(10px * var(--ui-scale)) calc(18px * var(--ui-scale));
          border: 1px solid var(--amber);
          border-radius: 4px;
          pointer-events: none;
          transition: opacity 0.6s ease;
        }
        .hint.gone { opacity: 0; }
      </style>
      ${textBlock}
      <div class="wrap">
        <div class="stage">
          <canvas width="${w * SS}" height="${h * SS}"></canvas>
          <div class="overlays"></div>
          ${hintText ? `<div class="hint">${escapeHtml(hintText)}</div>` : ''}
        </div>
        <button class="rec" title="grabar como video webm" data-on="false">●</button>
        ${config.meta?.music ? `<button class="music" title="musica ambiental" data-on="false">♪</button>` : ''}
        <button class="fs" title="pantalla completa">⛶</button>
        <button class="reset" title="reset">↺</button>
      </div>
    `;

    const canvas = this.shadowRoot.querySelector('canvas');
    this._canvas = canvas;
    const hint = this.shadowRoot.querySelector('.hint');
    const resetBtn = this.shadowRoot.querySelector('.reset');
    const fsBtn = this.shadowRoot.querySelector('.fs');
    const musicBtn = this.shadowRoot.querySelector('.music');
    const recBtn = this.shadowRoot.querySelector('.rec');
    const wrap = this.shadowRoot.querySelector('.wrap');
    if (fsBtn && wrap) {
      fsBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (document.fullscreenElement) {
          document.exitFullscreen?.();
        } else {
          wrap.requestFullscreen?.();
        }
      });
    }

    this._world = new World(config, canvas, this);
    this._world._muted = this.hasAttribute('mute');
    this._world._musicMood = config.meta?.music || null;
    this._loadLogo(config);
    if (musicBtn) {
      musicBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const on = musicBtn.dataset.on === 'true';
        if (on) {
          if (this._world.fx?.ambientMusicStop) this._world.fx.ambientMusicStop();
          musicBtn.dataset.on = 'false';
          musicBtn.classList.remove('active');
        } else {
          if (this._world._musicMood && this._world.fx?.ambientMusic) {
            this._world.fx.ambientMusic(this._world._musicMood);
          }
          musicBtn.dataset.on = 'true';
          musicBtn.classList.add('active');
        }
      });
    }
    if (recBtn) {
      const stopRecorder = () => {
        if (this._recWatch) { clearInterval(this._recWatch); this._recWatch = null; }
        if (this._recTimeout) { clearTimeout(this._recTimeout); this._recTimeout = null; }
        if (this._recHardLimit) { clearTimeout(this._recHardLimit); this._recHardLimit = null; }
        if (this._recorder && this._recorder.state !== 'inactive') {
          try { this._recorder.stop(); } catch {}
        }
        this._recording = false;
        recBtn.dataset.on = 'false';
        recBtn.classList.remove('active');
        recBtn.title = 'grabar escena completa como video';
      };
      recBtn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const on = recBtn.dataset.on === 'true';
        if (on) { stopRecorder(); return; }
        try {
          audioUnlock();
          // Make webfonts available to the canvas API (shadow CSS only loads them
          // for the shadow DOM, but the recording canvas runs against document fonts).
          await this._ensureFontsLoaded();
          // Reset to start so the recording captures the full scene from t=0.
          if (this._world && this._world.reset) this._world.reset();
          // If the scene declares music and the user hasn't toggled it, turn it on
          // so the recording has audio. Restore prior state on stop is not needed:
          // the user can mute manually post-recording with the ♪ button.
          if (musicBtn && musicBtn.dataset.on !== 'true' && this._world._musicMood && this._world.fx?.ambientMusic) {
            this._world.fx.ambientMusic(this._world._musicMood);
            musicBtn.dataset.on = 'true';
            musicBtn.classList.add('active');
          }
          // Build an offscreen "composite" canvas that copies the main canvas
          // each frame AND rasterizes the HTML overlays (labels, bubbles, hint)
          // on top, so the recorded video shows the dialogue/captions too.
          this._initRecCanvas(canvas);
          this._recording = true;
          const videoStream = this._recCanvas.captureStream(60);
          const audioStream = getRecordingStream();
          const tracks = [...videoStream.getVideoTracks()];
          if (audioStream) tracks.push(...audioStream.getAudioTracks());
          const stream = new MediaStream(tracks);
          const candidates = [
            'video/webm; codecs=vp9,opus',
            'video/webm; codecs=vp8,opus',
            'video/webm',
          ];
          const mimeType = candidates.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m));
          const rec = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 24_000_000 } : { videoBitsPerSecond: 24_000_000 });
          const chunks = [];
          rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
          rec.onstop = () => {
            const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const sceneId = (config.meta?.id || 'noesis-scene');
            const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            a.download = `noesis-${sceneId}-${stamp}.webm`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 4000);
          };
          this._recorder = rec;
          rec.start(1000);
          recBtn.dataset.on = 'true';
          recBtn.classList.add('active');
          recBtn.title = 'detener grabacion ahora';
          // Watch for scene end (s.showReplay = true) to auto-stop. Give a small
          // tail so the final beat lands cleanly before cutting.
          this._recWatch = setInterval(() => {
            const st = this._world && this._world.state;
            if (st && st.showReplay && !this._recTimeout) {
              this._recTimeout = setTimeout(() => stopRecorder(), 700);
            }
          }, 200);
          // Hard limit so a runaway scene doesn't record forever.
          this._recHardLimit = setTimeout(() => stopRecorder(), 5 * 60 * 1000);
        } catch (err) {
          console.warn('noesis: no se pudo iniciar la grabación', err);
          recBtn.dataset.on = 'false';
        }
      });
    }
    this._world._hintEl = hint;
    this._world.setHint = (text, opts = {}) => {
      if (!hint) return;
      if (text == null || text === '') { hint.classList.add('gone'); return; }
      hint.textContent = text;
      hint.classList.remove('gone');
      const autoHide = opts.autoHide;
      if (typeof autoHide === 'number' && autoHide > 0) {
        clearTimeout(this._world._hintTimer);
        this._world._hintTimer = setTimeout(() => hint.classList.add('gone'), autoHide * 1000);
      }
    };
    this._buildLabels(config, lang);
    // Note: runInit is deferred until the scene first becomes visible
    // (see IntersectionObserver below). Same for the initial hint timer.
    const hintDur = config.hintDuration ?? 4;
    this._world.endScene = () => {
      if (this._world._ambientSoundMap) {
        for (const [, snd] of this._world._ambientSoundMap) snd.stop(1.5);
        this._world._ambientSoundMap.clear();
      }
      if (this._world._ambientMusic) {
        try { this._world._ambientMusic.stop(1.5); } catch {}
        this._world._ambientMusic = null;
      }
      this._world._sceneEnded = true;
    };

    canvas.addEventListener('click', (ev) => {
      if (!this._world._muted) audioUnlock();
      const rect = canvas.getBoundingClientRect();
      // Map client px -> logical world units (rect is CSS px; world.W/H are logical).
      const sx = this._world.W / rect.width;
      const sy = this._world.H / rect.height;
      const rawX = (ev.clientX - rect.left) * sx;
      const rawY = (ev.clientY - rect.top) * sy;
      // Convert from canvas (screen) coords to world coords via camera.
      const cam = this._world.camera;
      const x = cam.x + (rawX - this._world.W / 2 - cam.shakeX) / cam.zoom;
      const y = cam.y + (rawY - this._world.H / 2 - cam.shakeY) / cam.zoom;
      // Pasa también las coords de pantalla (rawX/rawY): los elementos del
      // HUD (botón de replay) viven en screen-space y con la cámara movida
      // las coords de mundo no les atinan.
      this._world.handleClick(x, y, rawX, rawY);
      if (hint) hint.classList.add('gone');
    });

    resetBtn.addEventListener('click', () => {
      this._world.reset();
      clearTimeout(this._world._hintTimer);
      if (hint) {
        hint.textContent = hintText;
        hint.classList.remove('gone');
        if (hintDur > 0) this._world._hintTimer = setTimeout(() => hint.classList.add('gone'), hintDur * 1000);
      }
    });

    // Pause/resume on focus. Three signals: viewport visibility (IO), tab
    // visibility (document.hidden), window focus (blur/focus). Active only
    // when ALL THREE are true. Scene does NOT start until first activation.
    this._initialized = false;
    this._inView = false;
    this._tabVisible = !document.hidden;
    this._winFocused = document.hasFocus();
    const force = this.hasAttribute('autoplay');
    const evalActive = () => {
      const wasActive = this._visible;
      const isActive = force || (this._inView && this._tabVisible && this._winFocused);
      this._visible = isActive;
      if (isActive && !wasActive) {
        if (!this._initialized) {
          this._world.runInit();
          this._initialized = true;
          if (hint && hintText && hintDur > 0) {
            this._world._hintTimer = setTimeout(() => hint.classList.add('gone'), hintDur * 1000);
          }
        }
        if (!this._world._muted) {
          try { const ac = audioCtx(); if (ac && ac.state === 'suspended') ac.resume(); } catch {}
        }
        if (!this._raf) this._start();
      } else if (!isActive && wasActive) {
        try { const ac = audioCtx(); if (ac && ac.state === 'running') ac.suspend(); } catch {}
      }
    };
    this._evalActive = evalActive;
    this._io = new IntersectionObserver((entries) => {
      this._inView = entries[0].isIntersecting;
      evalActive();
    }, { threshold: 0.25 });
    this._io.observe(this);
    // autoplay short-circuits all gating: arrange the scene immediately so
    // headless screenshots and embedded auto-loop demos don't wait on IO/focus.
    if (force) evalActive();
    this._onVisChange = () => { this._tabVisible = !document.hidden; evalActive(); };
    this._onBlur = () => { this._winFocused = false; evalActive(); };
    this._onFocus = () => { this._winFocused = document.hasFocus(); evalActive(); };
    document.addEventListener('visibilitychange', this._onVisChange);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('focus', this._onFocus);
  }

  _start() {
    this._lastT = performance.now();
    const tick = (now) => {
      if (!this._visible) { this._raf = null; return; }
      const dt = Math.min(0.05, (now - this._lastT) / 1000);
      this._lastT = now;
      this._world.runStep(dt);
      this._world.runDraw();
      if (this._recording) this._paintRecFrame();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  _buildLabels(config, lang) {
    const overlays = this.shadowRoot.querySelector('.overlays');
    // Persistent name labels for any learner that has a `name`.
    this._world._nameLabels = new Map();
    if (overlays) {
      for (const e of this._world.entities) {
        if (e.type === 'learner' && e.name) {
          const el = document.createElement('div');
          el.className = 'name-label';
          el.textContent = e.name;
          overlays.appendChild(el);
          this._world._nameLabels.set(e.id || e, { el, entity: e });
        }
      }
    }
    if (!overlays || !Array.isArray(config.labels)) { this._world._labels = new Map(); return; }
    const map = new Map();
    for (const spec of config.labels) {
      const el = document.createElement('div');
      el.className = 'label';
      const html = (typeof spec.html === 'object' && spec.html !== null)
        ? (spec.html[lang] || spec.html.es || spec.html.en || '')
        : (spec.html || spec.text || '');
      el.innerHTML = richToHtml(html);
      const x = (spec.x != null ? spec.x : 0) * 100;
      const y = (spec.y != null ? spec.y : 0) * 100;
      el.style.left = `${x}%`;
      el.style.top = `${y}%`;
      el.style.transform = anchorTransform(spec.anchor || 'top-left');
      if (spec.style) el.style.cssText += ';' + spec.style;
      if (spec.hidden) el.classList.add('hidden');
      overlays.appendChild(el);
      map.set(spec.id, el);
    }
    this._world._labels = map;
  }

  // -- recording: rasterize HTML overlays onto an offscreen canvas --
  async _ensureFontsLoaded() {
    if (this._fontsLoaded) return;
    // Mirror the shadow @import into the document so canvas API has the fonts.
    if (!document.querySelector('link[data-noesis-fonts]')) {
      const lnk = document.createElement('link');
      lnk.rel = 'stylesheet';
      lnk.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@1,9..144,400;1,9..144,500;1,9..144,600;1,9..144,700&display=swap';
      lnk.setAttribute('data-noesis-fonts', '');
      document.head.appendChild(lnk);
    }
    try { await document.fonts.ready; } catch {}
    this._fontsLoaded = true;
  }

  _initRecCanvas(mainCanvas) {
    if (this._recCanvas && this._recCanvas.width === mainCanvas.width && this._recCanvas.height === mainCanvas.height) return;
    const c = document.createElement('canvas');
    c.width = mainCanvas.width;
    c.height = mainCanvas.height;
    this._recCanvas = c;
    this._recCtx = c.getContext('2d');
  }

  _paintRecFrame() {
    if (!this._recCtx || !this._canvas) return;
    const ctx = this._recCtx;
    const W = this._recCanvas.width, H = this._recCanvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(this._canvas, 0, 0, W, H);
    const stage = this.shadowRoot.querySelector('.stage');
    if (!stage) return;
    const sr = stage.getBoundingClientRect();
    if (sr.width === 0) return;
    const sx = W / sr.width, sy = H / sr.height;
    const overlays = this.shadowRoot.querySelector('.overlays');
    if (overlays) {
      for (const el of overlays.children) {
        if (this._overlayHidden(el)) continue;
        this._paintOverlay(ctx, el, sr, sx, sy);
      }
    }
    const hintEl = this.shadowRoot.querySelector('.hint');
    if (hintEl && !this._overlayHidden(hintEl)) this._paintOverlay(ctx, hintEl, sr, sx, sy);
  }

  _overlayHidden(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return true;
    return parseFloat(cs.opacity) < 0.05;
  }

  _paintOverlay(ctx, el, sr, sx, sy) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const cs = getComputedStyle(el);
    const x = (r.left - sr.left) * sx;
    const y = (r.top - sr.top) * sy;
    const w = r.width * sx;
    const h = r.height * sy;
    const scale = (sx + sy) / 2;
    ctx.save();
    ctx.globalAlpha = parseFloat(cs.opacity);
    if (el.classList.contains('bubble')) {
      this._paintBubble(ctx, el, cs, x, y, w, h, scale);
    } else if (el.classList.contains('name-label')) {
      this._paintBoxedText(ctx, el, cs, x, y, w, h, scale, { bg: 'rgba(31,37,71,0.78)', border: 'rgba(244,172,29,0.6)', color: '#FBFAF6', radius: 3, padX: 8, padY: 3 });
    } else if (el.classList.contains('hint')) {
      this._paintBoxedText(ctx, el, cs, x, y, w, h, scale, { bg: 'rgba(31,37,71,0.88)', border: '#F4AC1D', color: '#FBFAF6', radius: 4, padX: 18, padY: 10 });
    } else {
      this._paintPlainLabel(ctx, el, cs, x, y, w, h, scale);
    }
    ctx.restore();
  }

  _fontFromStyle(cs, scale) {
    const fs = parseFloat(cs.fontSize) * scale;
    return `${cs.fontStyle} ${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
  }

  _wrapLines(ctx, text, maxW) {
    const words = text.split(/\s+/);
    const lines = [];
    let cur = '';
    for (const wd of words) {
      const trial = cur ? cur + ' ' + wd : wd;
      if (ctx.measureText(trial).width <= maxW) cur = trial;
      else { if (cur) lines.push(cur); cur = wd; }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  _paintBubble(ctx, el, cs, x, y, w, h, scale) {
    const text = (el.textContent || '').trim();
    const isSymbol = el.classList.contains('symbol-exclaim') || el.classList.contains('symbol-wonder');
    const padX = (isSymbol ? 10 : 10) * scale;
    const padY = (isSymbol ? 3 : 5) * scale;
    const radius = (el.classList.contains('think') ? 14 : 10) * scale;
    ctx.fillStyle = '#FBFAF6';
    ctx.strokeStyle = '#1F2547';
    ctx.lineWidth = 1.5 * scale;
    ctx.shadowColor = 'rgba(31,37,71,0.45)';
    ctx.shadowOffsetX = 2 * scale;
    ctx.shadowOffsetY = 2 * scale;
    this._roundRect(ctx, x, y, w, h, radius);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.stroke();
    // tail
    const tailW = 10 * scale, tailH = 7 * scale;
    const tailX = x + w / 2;
    const tailY = y + h;
    ctx.fillStyle = '#FBFAF6';
    ctx.beginPath();
    ctx.moveTo(tailX - tailW / 2, tailY);
    ctx.lineTo(tailX + tailW / 2, tailY);
    ctx.lineTo(tailX, tailY + tailH);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tailX - tailW / 2, tailY);
    ctx.lineTo(tailX, tailY + tailH);
    ctx.moveTo(tailX + tailW / 2, tailY);
    ctx.lineTo(tailX, tailY + tailH);
    ctx.stroke();
    // text
    ctx.fillStyle = isSymbol ? '#F4AC1D' : '#1F2547';
    ctx.font = this._fontFromStyle(cs, scale);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const innerX = x + padX;
    const innerW = w - padX * 2;
    const lineH = parseFloat(cs.fontSize) * 1.35 * scale;
    const lines = this._wrapLines(ctx, text, innerW);
    let ty = y + padY;
    for (const ln of lines) { ctx.fillText(ln, innerX, ty); ty += lineH; }
  }

  _paintBoxedText(ctx, el, cs, x, y, w, h, scale, opts) {
    const padX = opts.padX * scale, padY = opts.padY * scale;
    const radius = opts.radius * scale;
    ctx.fillStyle = opts.bg;
    ctx.strokeStyle = opts.border;
    ctx.lineWidth = 1 * scale;
    this._roundRect(ctx, x, y, w, h, radius);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = opts.color;
    ctx.font = this._fontFromStyle(cs, scale);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const text = (el.textContent || '').trim();
    const innerX = x + padX;
    const innerW = w - padX * 2;
    const lineH = parseFloat(cs.fontSize) * (parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) || 1.35) * scale;
    const lines = this._wrapLines(ctx, text, innerW);
    let ty = y + padY;
    for (const ln of lines) { ctx.fillText(ln, innerX, ty); ty += lineH; }
  }

  _paintPlainLabel(ctx, el, cs, x, y, w, h, scale) {
    const text = (el.textContent || '').trim();
    if (!text) return;
    ctx.fillStyle = cs.color || '#FBFAF6';
    ctx.font = this._fontFromStyle(cs, scale);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const lh = parseFloat(cs.fontSize) * 1.45 * scale;
    const lines = this._wrapLines(ctx, text, w);
    let ty = y;
    for (const ln of lines) { ctx.fillText(ln, x, ty); ty += lh; }
  }

  // Logo institucional opcional (co-branding, esquina inferior izquierda).
  // Fuente, por prioridad: atributo del embed `logo="<url>"` (lo natural para
  // una institución, una vez por página), o config `meta.logo` (string url u
  // objeto { src, height, opacity }). `logo-height` / `logo-opacity` ajustan
  // el atributo. La imagen se carga con crossOrigin anonymous: usa un data URI
  // o un host con CORS para que la grabación de video no se rompa. El motor la
  // dibuja en world._drawLogo cuando termina de cargar.
  _loadLogo(config) {
    const cfg = config?.meta?.logo ?? config?.canvas?.logo;
    const src = this.getAttribute('logo') || (typeof cfg === 'string' ? cfg : cfg?.src);
    if (!src || !this._world) return;
    const ha = parseFloat(this.getAttribute('logo-height'));
    const oa = parseFloat(this.getAttribute('logo-opacity'));
    const height = !isNaN(ha) ? ha : ((cfg && cfg.height) || 26);
    const opacity = !isNaN(oa) ? oa : (cfg && cfg.opacity != null ? cfg.opacity : 0.92);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { if (this._world) this._world._logo = { img, height, opacity }; };
    img.onerror = () => {};
    img.src = src;
  }

  _pickLang(config) {
    const attr = this.getAttribute('lang');
    if (attr) return attr;
    const docLang = (document.documentElement.getAttribute('lang') || 'es').slice(0, 2);
    const supported = config.text ? Object.keys(config.text) : ['es'];
    return supported.includes(docLang) ? docLang : supported[0];
  }

  _renderText(config, lang) {
    const t = config.text?.[lang];
    if (!t) return '';
    const sceneNum = config.meta?.number != null
      ? `<div class="scene-num">${this._t('scene', lang)} ${String(config.meta.number).padStart(2, '0')}</div>`
      : '';
    const title = t.title ? `<h2>${escapeHtml(t.title)}</h2>` : '';
    // body: array of paragraph strings; limited HTML (<strong>, <em>, <a>) passed
    // through. Tolerant: los LLM suelen entregar `body` como UN string con
    // varios <p>...</p> en vez de un array; sin esto, .map sobre un string
    // crashea el render. Un string que ya trae <p> se usa crudo; cualquier
    // otro string/ítem se envuelve en su propio <p>.
    const bodyArr = Array.isArray(t.body) ? t.body : (t.body ? [t.body] : []);
    const paragraphs = bodyArr.map(p => { const h = richToHtml(String(p)); return /^\s*<p[\s>]/i.test(h) ? h : `<p>${h}</p>`; }).join('');
    // references: array of structured APA objects
    const refs = (t.references || []).map(r => `<div class="ref">${formatAPA(r)}</div>`).join('');
    const refsBlock = refs
      ? `<div class="refs"><h3>${this._t('refs', lang)}</h3>${refs}</div>`
      : '';
    return `<div class="text">${sceneNum}${title}${paragraphs}${refsBlock}</div>`;
  }

  _t(key, lang) {
    const dict = {
      es: { scene: 'Escena', refs: 'Referencias' },
      en: { scene: 'Scene', refs: 'References' },
    };
    return (dict[lang] || dict.es)[key] || key;
  }

  async _readConfig() {
    const inline = this.querySelector('script[type="application/json"]');
    if (inline) {
      try { return JSON.parse(inline.textContent); }
      catch (err) { console.error('[noesis-scene] bad inline JSON', err); return null; }
    }
    const src = this.getAttribute('src');
    if (src) {
      try {
        // Bypass HTTP cache so JSON edits propagate without manual cache busting.
        // Scenes are small; the freshness guarantee is worth the re-fetch.
        const res = await fetch(src, { cache: 'no-store' });
        return await res.json();
      } catch (err) { console.error('[noesis-scene] failed to fetch', src, err); return null; }
    }
    const sceneId = this.getAttribute('data-scene');
    if (sceneId && window.noesisScenes && window.noesisScenes[sceneId]) {
      return window.noesisScenes[sceneId];
    }
    return null;
  }
}
