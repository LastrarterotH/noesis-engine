/* ============================================================
   noesis · landing — coreografía
   GSAP + ScrollTrigger + Lenis. Sin build. El punto ámbar cose todo.
   Setup de UNA sola vez (no matchMedia, que re-ejecuta al resize).
   ============================================================ */
(function () {
  'use strict';

  var loaderEl = document.querySelector('[data-loader]');
  function killLoader() { if (loaderEl) { loaderEl.dataset.done = '1'; loaderEl.style.display = 'none'; } }

  if (typeof window.gsap === 'undefined') { document.documentElement.classList.remove('has-js'); killLoader(); return; }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { killLoader(); return; }

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- glifos de las mecánicas ---------- */
  function mk(parent, cls, css) { var d = document.createElement('span'); if (cls) d.className = cls; if (css) d.style.cssText = css; parent.appendChild(d); return d; }
  function stageOf(el) { return mk(el, '', 'position:absolute;left:50%;top:0;width:92px;height:56px;transform:translateX(-50%)'); }

  var glyphBuilders = {
    viajero: function (s) {
      mk(s, 'g-line', 'left:8px;top:27px;width:76px;height:2px;border-radius:2px');
      var d = mk(s, 'g-dot is-amber', 'left:4px;top:22px;width:11px;height:11px');
      gsap.fromTo(d, { x: 0 }, { x: 70, duration: 1.7, ease: 'power1.inOut', repeat: -1, yoyo: true });
    },
    poblacion: function (s) {
      var pts = [[46,28],[30,18],[62,18],[24,38],[68,38],[38,40],[54,16]], els = [];
      pts.forEach(function (p) { els.push(mk(s, 'g-dot', 'left:' + (p[0]-4) + 'px;top:' + (p[1]-4) + 'px;width:8px;height:8px')); });
      els[0].className = 'g-dot is-amber';
      gsap.timeline({ repeat: -1, repeatDelay: 0.7 })
        .from(els.slice(1), { scale: 0, transformOrigin: 'center', duration: 0.5, ease: 'back.out(2)', stagger: 0.12 })
        .to(els.slice(1), { scale: 0, duration: 0.4, ease: 'power2.in', stagger: 0.05 }, '+=0.6');
    },
    umbral: function (s) {
      mk(s, 'g-line', 'left:14px;top:20px;width:64px;height:2px;border-radius:2px');
      var b = mk(s, 'g-bar', 'left:42px;bottom:6px;width:9px;height:8px;border-radius:2px;transform-origin:bottom');
      gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 0.3 })
        .to(b, { height: 34, duration: 0.9, ease: 'power2.inOut' })
        .set(b, { className: 'g-bar is-amber' }, 0.62);
    },
    convergencia: function (s) {
      var pts = [[12,12],[80,14],[18,44],[78,44],[14,28],[82,30]], els = [];
      pts.forEach(function (p) { els.push(mk(s, 'g-dot', 'left:' + (p[0]-4) + 'px;top:' + (p[1]-4) + 'px;width:8px;height:8px')); });
      var center = mk(s, 'g-dot is-amber', 'left:42px;top:24px;width:9px;height:9px;opacity:0');
      gsap.timeline({ repeat: -1, repeatDelay: 0.6 })
        .to(els, { left: 42, top: 24, duration: 0.9, ease: 'power2.in' })
        .to(center, { opacity: 1, duration: 0.2 }, '-=0.2')
        .to(els, { opacity: 0, duration: 0.2 }, '<')
        .to(center, { opacity: 0, duration: 0.3 }, '+=0.5')
        .set(els, { clearProps: 'left,top,opacity' });
    },
    antesdespues: function (s) {
      mk(s, '', 'position:absolute;left:18px;top:18px;width:56px;height:20px;border-radius:4px;background:var(--line)');
      var fill = mk(s, '', 'position:absolute;left:18px;top:18px;width:0;height:20px;border-radius:4px;background:var(--amber)');
      var div = mk(s, '', 'position:absolute;left:18px;top:14px;width:2px;height:28px;background:var(--navy)');
      gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 0.4 })
        .to(fill, { width: 56, duration: 1.0, ease: 'power2.inOut' }, 0)
        .to(div, { left: 72, duration: 1.0, ease: 'power2.inOut' }, 0);
    },
    diseccion: function (s) {
      var a = mk(s, 'g-bar', 'left:38px;top:18px;width:16px;height:6px;border-radius:2px');
      var b = mk(s, 'g-bar is-amber', 'left:38px;top:25px;width:16px;height:6px;border-radius:2px');
      var c = mk(s, 'g-bar', 'left:38px;top:32px;width:16px;height:6px;border-radius:2px');
      gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 0.4 })
        .to(a, { x: -22, duration: 0.8, ease: 'power2.inOut' }, 0)
        .to(c, { x: 22, duration: 0.8, ease: 'power2.inOut' }, 0)
        .to(b, { x: 0, duration: 0.8 }, 0);
    },
    analogia: function (s) {
      var d1 = mk(s, 'g-dot', 'left:14px;top:24px;width:11px;height:11px;border-radius:999px');
      var d2 = mk(s, 'g-dot is-amber', 'left:67px;top:24px;width:11px;height:11px;border-radius:3px');
      var bridge = mk(s, '', 'position:absolute;left:28px;top:28px;width:0;height:2px;background:var(--amber);transform-origin:left');
      gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 0.5 })
        .to(bridge, { width: 38, duration: 0.7, ease: 'power2.inOut' })
        .to(d1, { x: 8, duration: 0.7, ease: 'power2.inOut' }, '<')
        .to(d2, { x: -8, borderRadius: '999px', duration: 0.7, ease: 'power2.inOut' }, '<');
    },
    cadena: function (s) {
      var bars = [], i;
      for (i = 0; i < 5; i++) bars.push(mk(s, (i === 4 ? 'g-bar is-amber' : 'g-bar'), 'left:' + (20 + i * 14) + 'px;top:20px;width:5px;height:22px;border-radius:1px;transform-origin:bottom right'));
      gsap.timeline({ repeat: -1, repeatDelay: 0.8 })
        .to(bars, { rotation: 72, duration: 0.32, ease: 'power2.in', stagger: 0.13 })
        .to(bars, { rotation: 0, duration: 0.4, ease: 'power2.out', stagger: 0.05 }, '+=0.5');
    },
    transformacion: function (s) {
      var els = [], r, c;
      for (r = 0; r < 3; r++) for (c = 0; c < 3; c++) els.push(mk(s, (r === 1 && c === 1 ? 'g-dot is-amber' : 'g-dot'), 'left:' + (30 + c * 16) + 'px;top:' + (12 + r * 16) + 'px;width:7px;height:7px'));
      var tl = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 0.5 });
      els.forEach(function (e) { tl.to(e, { x: gsap.utils.random(-16, 16), y: gsap.utils.random(-10, 10), duration: 1.1, ease: 'power1.inOut' }, 0); });
    }
  };
  document.querySelectorAll('[data-glyph]').forEach(function (el) {
    var b = glyphBuilders[el.getAttribute('data-glyph')]; if (b) b(stageOf(el));
  });

  /* ---------- Lenis ---------- */
  var lenis = null;
  if (typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ duration: 1.1, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); } });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    lenis.scrollTo(0, { immediate: true });
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (id && id.length > 1) { e.preventDefault(); lenis.scrollTo(id, { offset: -60, duration: 1.2 }); }
      });
    });
  }
  window.scrollTo(0, 0);

  /* ---------- cursor (oculto hasta el primer movimiento; oculta el nativo solo si corre) ---------- */
  var cursor = document.querySelector('[data-cursor]');
  if (cursor && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.documentElement.classList.add('cursor-on');
    var xTo = gsap.quickTo(cursor, 'x', { duration: 0.5, ease: 'power3' });
    var yTo = gsap.quickTo(cursor, 'y', { duration: 0.5, ease: 'power3' });
    var cursorShown = false;
    window.addEventListener('mousemove', function (e) {
      if (!cursorShown) { cursorShown = true; gsap.set(cursor, { x: e.clientX, y: e.clientY }); gsap.to(cursor, { opacity: 1, duration: 0.3 }); }
      xTo(e.clientX); yTo(e.clientY);
    });
    window.addEventListener('mouseleave', function () { gsap.to(cursor, { opacity: 0, duration: 0.25 }); });
    window.addEventListener('mouseenter', function () { if (cursorShown) gsap.to(cursor, { opacity: 1, duration: 0.25 }); });
    document.querySelectorAll('[data-hover], a, button, .scene-card, .mech').forEach(function (el) {
      el.addEventListener('mouseenter', function () { cursor.classList.add('is-hover'); });
      el.addEventListener('mouseleave', function () { cursor.classList.remove('is-hover'); });
    });
  } else if (cursor) { cursor.style.display = 'none'; }

  /* ---------- hero (C): caos -> orden ---------- */
  var heroTl = gsap.timeline({ paused: true });
  heroTl
    .from('.hero-wm .ch:not(.ch--dot)', {
      opacity: 0,
      x: function () { return gsap.utils.random(-window.innerWidth * 0.34, window.innerWidth * 0.34); },
      y: function () { return gsap.utils.random(-window.innerHeight * 0.30, window.innerHeight * 0.30); },
      rotation: function () { return gsap.utils.random(-75, 75); },
      scale: function () { return gsap.utils.random(0.4, 1.7); },
      duration: 1.2, ease: 'power3.out', stagger: { each: 0.05, from: 'random' }
    })
    .from('.hero-wm .ch--dot', { opacity: 0, scale: 0, duration: 0.6, ease: 'back.out(2.4)' }, '-=0.2')
    .fromTo('.hero-headline', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.75, ease: 'power3.out' }, '-=0.05')
    .fromTo('.hero-sub', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, '-=0.45');

  /* ---------- loader -> hero ---------- */
  var countEl = document.querySelector('[data-loader-count]');
  var counter = { v: 0 };
  gsap.timeline({ onComplete: function () { killLoader(); heroTl.play(); } })
    .to(counter, { v: 100, duration: 0.9, ease: 'power2.inOut', onUpdate: function () { if (countEl) countEl.textContent = Math.round(counter.v); } })
    .to('.loader-mark, .loader-count, .crop', { opacity: 0, duration: 0.4, ease: 'power2.in' }, '+=0.1')
    .to(loaderEl, { yPercent: -100, duration: 0.9, ease: 'power4.inOut', onStart: function () { if (loaderEl) loaderEl.dataset.done = '1'; } }, '-=0.05');

  /* ---------- hero cede a la escena viva ---------- */
  gsap.to('.hero-scene', { opacity: 1, y: 0, scale: 1, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: '.hero-scene', start: 'top 80%' } });
  gsap.to('.hero-type', { yPercent: -8, opacity: 0.5, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 } });

  /* ---------- reveals ---------- */
  gsap.utils.toArray('[data-reveal]').forEach(function (el) {
    gsap.to(el, { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 86%' } });
  });
  gsap.utils.toArray('[data-fade]').forEach(function (el) {
    gsap.to(el, { opacity: 1, duration: 0.9, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
  });
  gsap.utils.toArray('[data-stagger]').forEach(function (grid) {
    gsap.fromTo(Array.prototype.slice.call(grid.children),
      { opacity: 0, y: 36, scale: 0.9 },
      { opacity: 1, y: 0, scale: 1, duration: 0.72, ease: 'back.out(1.4)', clearProps: 'transform',
        stagger: { each: 0.055, grid: 'auto', from: 'start' },
        scrollTrigger: { trigger: grid, start: 'top 80%' } });
  });

  /* ---------- límites BLUEPRINT: la negación se CONSTRUYE atada al scroll (scrubbed):
       guías que se trazan, manijas que encajan, el marco, el mito, el tachazo, la regla, la
       nota y un contador de criterio. Las guías marchan y las manijas laten SIEMPRE (CSS).
       Sin pin ni swaps: cada bloque scrubea en su propia franja, nada se solapa. ---------- */
  gsap.utils.toArray('[data-bp]').forEach(function (spec) {
    var guides  = spec.querySelectorAll('.bp-guide');
    var frame   = spec.querySelector('.bp-frame');
    var handles = spec.querySelectorAll('.bp-h');
    var tag     = spec.querySelector('.bp-tag');
    var readout = spec.querySelector('.bp-readout');
    var myth    = spec.querySelector('.bp-myth');
    var slash   = spec.querySelector('.slash');
    var ruler   = spec.querySelector('.bp-ruler');
    var note    = spec.querySelector('.bp-note');

    gsap.timeline({ defaults: { ease: 'power2.out' }, scrollTrigger: { trigger: spec, start: 'top 85%', end: 'top 32%', scrub: 0.6 } })
      .fromTo(guides,  { scaleX: 0, scaleY: 0, opacity: 0 }, { scaleX: 1, scaleY: 1, opacity: 1, duration: 0.8 }, 0)     // se trazan las guías
      .fromTo(frame,   { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: 0.7 }, 0.1)                        // aparece el marco
      .fromTo(handles, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(2.2)', stagger: 0.05 }, 0.28) // encajan las manijas
      .fromTo(tag,     { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.5 }, 0.3)
      .fromTo(readout, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.3)
      .fromTo(myth,    { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6 }, 0.5)
      .fromTo(slash,   { width: 0 }, { width: '100%', duration: 0.7, ease: 'power2.in',
        onUpdate: function () { if (readout) readout.textContent = String(Math.round(this.progress() * 100)).padStart(3, '0'); } }, 0.95) // tachazo + contador
      .fromTo(ruler,   { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.95)
      .fromTo(note,    { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6 }, 1.2);
  });

  /* ---------- bookend ---------- */
  gsap.fromTo('.cierre-wm .ch',
    { opacity: 0, y: 30, scale: 0.6, rotation: function () { return gsap.utils.random(-45, 45); } },
    { opacity: 1, y: 0, scale: 1, rotation: 0, duration: 0.8, ease: 'power3.out', stagger: { each: 0.05, from: 'random' }, scrollTrigger: { trigger: '.cierre-wm', start: 'top 84%' } });

  ScrollTrigger.create({ start: 'top -90', end: 99999, toggleClass: { targets: '.topbar', className: 'is-stuck' } });
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });

})();
