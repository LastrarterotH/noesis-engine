// noesis-engine / util
// Color, RNG, HTML, anchor helpers. Pure functions, no engine state.

// --- Notación científica/matemática --------------------------------------
// Sintaxis tipo LaTeX para subíndices y superíndices, válida en TODO el texto
// (captions, título, meters dibujados en canvas; body, burbujas y labels en
// HTML). `_` = subíndice, `^` = superíndice; un solo carácter (`CO_2`, `x^2`)
// o varios entre llaves (`SO_4^{2-}`, `10^{-9}`). Así el motor puede escribir
// CO₂, H₂O, m², E = mc², 10⁻⁹ sin depender de glifos Unicode sueltos.

// Parte un string en runs { t: texto, s: 0 normal | -1 subíndice | 1 superíndice }.
export function parseScriptRuns(str) {
  const runs = [];
  const s = String(str);
  let buf = '';
  const flush = (txt, sc) => { if (txt) runs.push({ t: txt, s: sc }); };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if ((ch === '_' || ch === '^') && i + 1 < s.length && s[i + 1] !== ' ') {
      const sc = ch === '_' ? -1 : 1;
      let frag;
      if (s[i + 1] === '{') {
        const end = s.indexOf('}', i + 2);
        if (end === -1) { buf += ch; continue; }   // sin cierre: literal
        frag = s.slice(i + 2, end);
        i = end;
      } else {
        frag = s[i + 1];
        i += 1;
      }
      flush(buf, 0); buf = '';
      flush(frag, sc);
    } else {
      buf += ch;
    }
  }
  flush(buf, 0);
  return runs;
}

// --- Subconjunto de LaTeX (sin dependencias) -----------------------------
// Para notación matemática "de verdad" (fracciones apiladas, raíces, símbolos,
// variables en itálica) sin traer KaTeX. Se delimita con `$...$` dentro de
// cualquier texto: fuera de los `$` el texto es normal (con `_`/`^` simples).
// Cubre lo que pide enseñar STEM intro: \frac, \sqrt, sub/superíndices,
// griegas y operadores/relaciones comunes. Renderiza a HTML (labels, body) y a
// texto plano legible para el canvas (captions).

const TEX_SYM = {
  Delta: 'Δ', Gamma: 'Γ', Theta: 'Θ', Lambda: 'Λ', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω', Pi: 'Π',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ',
  tau: 'τ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓', ast: '∗', star: '⋆',
  to: '→', rightarrow: '→', Rightarrow: '⇒', leftarrow: '←', Leftarrow: '⇐', leftrightarrow: '↔', mapsto: '↦', uparrow: '↑', downarrow: '↓',
  leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', equiv: '≡', sim: '∼', simeq: '≃', cong: '≅', propto: '∝',
  infty: '∞', partial: '∂', nabla: '∇', forall: '∀', exists: '∃', in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆', cup: '∪', cap: '∩', emptyset: '∅',
  sum: '∑', prod: '∏', int: '∫', oint: '∮', sqrt: '√', angle: '∠', perp: '⊥', parallel: '∥',
  ldots: '…', cdots: '⋯', dots: '…', langle: '⟨', rangle: '⟩', hbar: 'ℏ', ell: 'ℓ', circ: '∘', degree: '°', prime: '′',
  quad: ' ', qquad: '  ', ',': ' ', ';': ' ', '!': '', ' ': ' ',
};
const TEX_OPS = new Set(['ln', 'log', 'lg', 'exp', 'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'sinh', 'cosh', 'tanh', 'lim', 'max', 'min', 'sup', 'inf', 'det', 'gcd', 'mod', 'arg', 'dim', 'deg', 'Pr']);
// Comandos que son relaciones o binops: llevan espacio propio a los lados.
const TEX_REL = new Set(['cdot', 'times', 'div', 'pm', 'mp', 'to', 'rightarrow', 'Rightarrow', 'leftarrow', 'Leftarrow', 'leftrightarrow', 'mapsto', 'leq', 'le', 'geq', 'ge', 'neq', 'ne', 'approx', 'equiv', 'sim', 'simeq', 'cong', 'propto', 'in', 'notin', 'subset', 'subseteq', 'cup', 'cap']);
// Comandos que consumen un grupo {...}: tras ellos NO se absorbe el espacio
// siguiente (que es un espacio real de la expresión, no el que cierra el nombre).
const ARG_CMDS = new Set(['frac', 'dfrac', 'tfrac', 'sqrt', 'text', 'mathrm', 'operatorname']);
const escM = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Renderiza un string LaTeX (sin los `$`) a HTML. Maneja llaves anidadas.
export function mathToHtml(tex) {
  const s = String(tex);
  let i = 0;
  const readGroup = () => {
    i++; const start = i; let depth = 1;
    while (i < s.length && depth > 0) { const c = s[i]; if (c === '{') depth++; else if (c === '}') { depth--; if (!depth) break; } i++; }
    const inner = s.slice(start, i); i++; return mathToHtml(inner);
  };
  const readArg = () => {
    if (s[i] === '{') return readGroup();
    if (s[i] === '\\') { let j = i + 1; while (j < s.length && /[A-Za-z]/.test(s[j])) j++; const n = s.slice(i + 1, j); i = j; return cmd(n); }
    const ch = s[i] || ''; i++; return /[A-Za-z]/.test(ch) ? `<i>${escM(ch)}</i>` : escM(ch);
  };
  const cmd = (name) => {
    if (name === 'frac' || name === 'dfrac' || name === 'tfrac') { const a = readArg(); const b = readArg(); return `<span class="frac"><span class="fnum">${a}</span><span class="fden">${b}</span></span>`; }
    if (name === 'sqrt') { const a = readArg(); return `<span class="rad">${a}</span>`; }
    if (name === 'text' || name === 'mathrm' || name === 'operatorname') { const a = readArg(); return `<span class="up">${a}</span>`; }
    if (TEX_OPS.has(name)) return `<span class="op">${name}</span>`;
    if (TEX_REL.has(name)) return `<span class="rel">${TEX_SYM[name]}</span>`;
    if (name in TEX_SYM) return TEX_SYM[name];
    return escM(name);
  };
  let out = '';
  while (i < s.length) {
    const ch = s[i];
    if (ch === '\\') {
      i++; let j = i; while (j < s.length && /[A-Za-z]/.test(s[j])) j++;
      const name = s.slice(i, j);
      if (name) { i = j; out += cmd(name); if (!ARG_CMDS.has(name) && s[i] === ' ') i++; } else { out += escM(s[i] || ''); i++; }
    } else if (ch === '_' || ch === '^') {
      i++; const arg = readArg(); out += ch === '_' ? `<sub>${arg}</sub>` : `<sup>${arg}</sup>`;
    } else if (ch === '{') { out += readGroup(); }
    else if (ch === '}') { i++; }
    else if (/[A-Za-z]/.test(ch)) { out += `<i>${escM(ch)}</i>`; i++; }
    else { out += escM(ch); i++; }
  }
  return out;
}

// Versión texto plano para el canvas (captions): símbolos a Unicode, fracción
// inline a "a/b", y deja `_`/`^` para que drawRichText haga sub/superíndices.
function mathToPlain(tex) {
  const s = String(tex);
  let i = 0;
  const readGroupRaw = () => { i++; const start = i; let depth = 1; while (i < s.length && depth > 0) { const c = s[i]; if (c === '{') depth++; else if (c === '}') { depth--; if (!depth) break; } i++; } const inner = s.slice(start, i); i++; return mathToPlain(inner); };
  const readArgRaw = () => { if (s[i] === '{') return readGroupRaw(); if (s[i] === '\\') { let j = i + 1; while (j < s.length && /[A-Za-z]/.test(s[j])) j++; const n = s.slice(i + 1, j); i = j; return cmdRaw(n); } const ch = s[i] || ''; i++; return ch; };
  const needsParen = (t) => /[ +\-/·×]/.test(t);
  const cmdRaw = (name) => {
    if (name === 'frac' || name === 'dfrac' || name === 'tfrac') { let a = readArgRaw(); let b = readArgRaw(); if (needsParen(a)) a = '(' + a + ')'; if (needsParen(b)) b = '(' + b + ')'; return a + '/' + b; }
    if (name === 'sqrt') return '√' + readArgRaw();
    if (name === 'text' || name === 'mathrm' || name === 'operatorname') return readArgRaw();
    if (TEX_OPS.has(name)) return ` ${name} `;
    if (TEX_REL.has(name)) return ` ${TEX_SYM[name]} `;
    if (name in TEX_SYM) return TEX_SYM[name];
    return name;
  };
  let out = '';
  while (i < s.length) {
    const ch = s[i];
    if (ch === '\\') { i++; let j = i; while (j < s.length && /[A-Za-z]/.test(s[j])) j++; const name = s.slice(i, j); if (name) { i = j; out += cmdRaw(name); if (!ARG_CMDS.has(name) && s[i] === ' ') i++; } else { out += s[i] || ''; i++; } }
    else if (ch === '{' ) { out += readGroupRaw(); }
    else if (ch === '}') { i++; }
    else { out += ch; i++; }
  }
  return out.replace(/[ \t]{2,}/g, ' ');
}

// Reemplaza los segmentos `$...$` de un string por texto plano matemático
// (para el canvas). Lo que está fuera de `$` queda igual.
export function texToPlain(str) {
  const parts = String(str).split('$');
  return parts.map((p, idx) => idx % 2 === 1 ? mathToPlain(p) : p).join('');
}

// Convierte a HTML: los `$...$` con el subconjunto LaTeX; el resto con `_`/`^`
// simples, consciente de etiquetas (no rompe el HTML del body ni atributos).
export function richToHtml(str) {
  const parts = String(str).split('$');
  return parts.map((p, idx) => idx % 2 === 1 ? `<span class="math">${mathToHtml(p)}</span>` : richSubSup(p)).join('');
}

function richSubSup(str) {
  return String(str).replace(/(<[^>]*>)|([^<]+)/g, (_m, tag, text) => {
    if (tag) return tag;
    return text
      .replace(/([_^])\{([^}]*)\}/g, (_x, op, c) => op === '_' ? `<sub>${c}</sub>` : `<sup>${c}</sup>`)
      .replace(/([_^])(\S)/g, (_x, op, c) => op === '_' ? `<sub>${c}</sub>` : `<sup>${c}</sup>`);
  });
}

// Mide el ancho de un string con notación, en el ctx dado.
export function measureRichText(ctx, str, opts = {}) {
  return _richRuns(ctx, parseScriptRuns(texToPlain(str)), opts).w;
}

// Dibuja un string con notación. `align`: left|center|right. Respeta el
// fillStyle/shadow ya seteados; cambia ctx.font por run y lo deja en el base.
export function drawRichText(ctx, str, x, y, opts = {}) {
  const runs = parseScriptRuns(texToPlain(str));
  const m = _richRuns(ctx, runs, opts);
  const align = opts.align || 'left';
  let cx = align === 'center' ? x - m.w / 2 : align === 'right' ? x - m.w : x;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  const px = opts.px || 14;
  for (let k = 0; k < runs.length; k++) {
    ctx.font = m.fonts[k];
    const dy = runs[k].s === -1 ? px * 0.16 : runs[k].s === 1 ? -px * 0.34 : 0;
    ctx.fillText(runs[k].t, cx, y + dy);
    cx += m.widths[k];
  }
  ctx.textAlign = prevAlign;
  return m.w;
}

function _richRuns(ctx, runs, opts) {
  const px = opts.px || 14, weight = opts.weight || '500', family = opts.family || 'sans-serif';
  const sub = opts.subScale || 0.72;
  const fonts = [], widths = [];
  let w = 0;
  for (const r of runs) {
    const rpx = r.s ? Math.round(px * sub) : px;
    const font = weight + ' ' + rpx + 'px ' + family;
    ctx.font = font;
    const rw = ctx.measureText(r.t).width || 0;
    fonts.push(font); widths.push(rw); w += rw;
  }
  return { w, fonts, widths };
}

// --- Notación matemática APILADA en el canvas ----------------------------
// Motor de layout de cajas mínimo (sin KaTeX) para dibujar fórmulas en
// notación vertical REAL sobre el lienzo. Cubre: fracción apilada (num sobre
// den con barra), raíz con índice n-ésimo (\sqrt[n]{}), sub/superíndices
// (combinables), símbolos del subconjunto LaTeX, operadores grandes con límites
// (\sum \prod \int \oint \bigcup... apilados; \int laterales), operadores tipo
// límite (\lim \max \min \sup \inf \gcd \det), delimitadores auto-escalables
// (\left( \right), \left[ \left\{ \left| ...) y entornos de matriz/caso
// (\begin{matrix|pmatrix|bmatrix|vmatrix|Bmatrix|cases}...\end{}), más espacios
// (\, \; \quad). A diferencia de `drawRichText`/`texToPlain` (que aplanan
// `\frac{a}{b}` a "a/b" inline), esto arma un árbol de cajas { w, a (ascenso),
// d (descenso), draw(ctx, x, y) } con y = baseline, mide cada una y la pinta
// centrada en su baseline (los operadores grandes, delimitadores y matrices se
// centran en el eje matemático). El color sale del fillStyle/strokeStyle que
// fija `drawMath` (barras/matriz con fillRect y glifos; radical con stroke), así
// toda la fórmula va en un tono. Para auditar todos los constructos de un
// vistazo: `tools/math-test.html`. Sirve para paneles de ecuaciones en `onDraw`
// (world.draw.math); antes cada escena dibujaba las fracciones a mano.
function _mathBox(ctx, src, px, opts) {
  const s = String(src).replace(/\$/g, '');
  let i = 0;
  const fam = opts.family || '"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, sans-serif';
  const wt = opts.weight || '500';
  const ASC = 0.72, DESC = 0.22;
  const SPX = (p) => Math.max(7, p * 0.72);   // tamaño de script (sub/sup), 0.72x

  const glyph = (text, gpx, style) => {
    const font = (style === 'it' ? 'italic ' : '') + wt + ' ' + (Math.round(gpx * 10) / 10) + 'px ' + fam;
    ctx.font = font;
    const w = ctx.measureText(text).width || 0;
    return { w, a: gpx * ASC, d: gpx * DESC, draw(c, x, y) { c.font = font; c.fillText(text, x, y); } };
  };
  const charKind = (c) => {
    if ('=<>'.indexOf(c) >= 0) return 'rel';
    if ('+*'.indexOf(c) >= 0 || c === '-') return 'bin';
    if (c === '(' || c === '[') return 'open';
    if (c === ')' || c === ']') return 'close';
    return 'ord';
  };
  const charBox = (c, gpx) => {
    if (c === '') return { w: 0, a: gpx * ASC, d: gpx * DESC, draw() {} };
    let t = c, style = 'up';
    if (c === '-') t = '−';                 // guion → signo menos
    else if (/[A-Za-z]/.test(c)) style = 'it';    // variable → itálica
    return glyph(t, gpx, style);
  };
  const spaceBox = (wid) => ({ w: wid, a: 0, d: 0, draw() {} });   // espaciador (\, \; \quad)

  // fracción apilada: numerador sobre denominador, barra en el eje matemático.
  const fracBox = (num, den, gpx) => {
    const t = Math.max(1, gpx * 0.055), axis = gpx * 0.30, g = gpx * 0.16, pad = gpx * 0.18;
    const w = Math.max(num.w, den.w) + pad * 2;
    const numBase = -axis - g - t / 2 - num.d;    // baseline del num, relativo (arriba = negativo)
    const denBase = -axis + g + t / 2 + den.a;    // baseline del den
    return {
      w, a: -(numBase - num.a), d: denBase + den.d,
      draw(c, x, y) {
        c.fillRect(x + pad * 0.4, y - axis - t / 2, w - pad * 0.8, t);   // barra
        num.draw(c, x + (w - num.w) / 2, y + numBase);
        den.draw(c, x + (w - den.w) / 2, y + denBase);
      },
    };
  };
  // raíz con índice opcional (n-ésima): signo radical + vínculo sobre el
  // contenido; `idx` (caja) se dibuja en el ángulo, para \sqrt[n]{x}.
  const sqrtBox = (inner, gpx, idx) => {
    const t = Math.max(1, gpx * 0.05), gap = gpx * 0.12, radw = gpx * 0.55;
    const idxOver = idx ? Math.max(0, idx.w - radw * 0.5) : 0;   // cuánto sobresale el índice
    const lead = radw + idxOver;
    const w = lead + inner.w + gpx * 0.14;
    const topPad = idx ? (idx.a + idx.d) * 0.45 : 0;
    return {
      w, a: inner.a + gap + t + topPad, d: inner.d,
      draw(c, x, y) {
        const x0 = x + idxOver;
        const topY = y - inner.a - gap - t, botY = y + inner.d;
        c.save();
        c.strokeStyle = c.fillStyle; c.lineWidth = t; c.lineJoin = 'round'; c.lineCap = 'round';
        c.beginPath();
        c.moveTo(x0, y - inner.a * 0.10);
        c.lineTo(x0 + radw * 0.30, botY);
        c.lineTo(x0 + radw * 0.62, topY);
        c.lineTo(x + w, topY);
        c.stroke();
        c.restore();
        if (idx) idx.draw(c, x0, topY + gpx * 0.04);
        inner.draw(c, x + lead, y);
      },
    };
  };
  // base con superíndice y/o subíndice.
  const scriptBox = (base, sup, sub, gpx) => {
    const supUp = gpx * 0.40, subDn = gpx * 0.16, off = gpx * 0.02;
    const sw = Math.max(sup ? sup.w : 0, sub ? sub.w : 0);
    return {
      w: base.w + sw + off,
      a: Math.max(base.a, sup ? supUp + sup.a : 0),
      d: Math.max(base.d, sub ? subDn + sub.d : 0),
      draw(c, x, y) {
        base.draw(c, x, y);
        if (sup) sup.draw(c, x + base.w + off, y - supUp);
        if (sub) sub.draw(c, x + base.w + off, y + subDn);
      },
    };
  };

  // --- operadores grandes (∑ ∏ ∫ …) con límites, y operadores tipo lim ------
  const AXIS = 0.30;   // eje matemático (fracción de gpx sobre la baseline)
  const BIG_OPS = { sum: '∑', prod: '∏', coprod: '∐', int: '∫', iint: '∬', iiint: '∭', oint: '∮', bigcup: '⋃', bigcap: '⋂', bigvee: '⋁', bigwedge: '⋀', bigoplus: '⨁', bigotimes: '⨂', bigodot: '⨀', bigsqcup: '⨆' };
  const LIMIT_OPS = new Set(['lim', 'limsup', 'liminf', 'max', 'min', 'sup', 'inf', 'gcd', 'det', 'arg', 'Pr', 'argmax', 'argmin']);
  // glifo del operador grande, agrandado y centrado en el eje matemático.
  const bigOpGlyph = (sym, gpx, factor) => {
    const opx = gpx * factor, font = wt + ' ' + Math.round(opx) + 'px ' + fam;
    ctx.font = font;
    const w = ctx.measureText(sym).width || 0;
    const axis = gpx * AXIS, halfH = opx * 0.52;
    return { w, a: axis + halfH, d: Math.max(gpx * DESC, halfH - axis), draw(c, x, y) { c.save(); c.textBaseline = 'middle'; c.font = font; c.fillText(sym, x, y - axis); c.restore(); } };
  };
  // operador con límites apilados (∑, lim) o a los lados (∫).
  const bigOpScriptBox = (op, sup, sub, gpx, stack) => {
    if (stack) {
      const w = Math.max(op.w, sup ? sup.w : 0, sub ? sub.w : 0), g = gpx * 0.08;
      const supBase = sup ? -op.a - g - sup.d : 0, subBase = sub ? op.d + g + sub.a : 0;
      return {
        w, a: sup ? -(supBase - sup.a) : op.a, d: sub ? subBase + sub.d : op.d,
        draw(c, x, y) {
          op.draw(c, x + (w - op.w) / 2, y);
          if (sup) sup.draw(c, x + (w - sup.w) / 2, y + supBase);
          if (sub) sub.draw(c, x + (w - sub.w) / 2, y + subBase);
        },
      };
    }
    const off = gpx * 0.06, sw = Math.max(sup ? sup.w : 0, sub ? sub.w : 0);
    const supBase = sup ? -(op.a * 0.5) : 0, subBase = sub ? op.d * 0.5 + sub.a : 0;
    return {
      w: op.w + off + sw, a: Math.max(op.a, sup ? -(supBase - sup.a) : 0), d: Math.max(op.d, sub ? subBase + sub.d : 0),
      draw(c, x, y) {
        op.draw(c, x, y);
        if (sup) sup.draw(c, x + op.w + off, y + supBase);
        if (sub) sub.draw(c, x + op.w + off, y + subBase);
      },
    };
  };

  // --- delimitadores auto-escalables: \left( … \right) ----------------------
  const DELIM_CMD = { '{': '{', '}': '}', '|': '‖', langle: '⟨', rangle: '⟩', lvert: '|', rvert: '|', vert: '|', Vert: '‖', lceil: '⌈', rceil: '⌉', lfloor: '⌊', rfloor: '⌋', backslash: '\\' };
  const readDelimRaw = () => {
    if (s[i] === '\\') {
      i++;
      if (s[i] === '{' || s[i] === '}' || s[i] === '|') { const d = s[i]; i++; return DELIM_CMD[d]; }
      let j = i; while (j < s.length && /[A-Za-z]/.test(s[j])) j++;
      const nm = s.slice(i, j); i = j; return DELIM_CMD[nm] || '';
    }
    const ch = s[i] || ''; i++;
    return ch === '.' ? null : ch;   // '.' = delimitador invisible
  };
  // contenido rodeado por delimitadores escalados a su altura, centrados en el eje.
  const delimBox = (leftD, inner, rightD, gpx) => {
    const pad = gpx * 0.10, H = inner.a + inner.d;
    const dpx = Math.min(gpx * 3.2, Math.max(gpx, H / 0.62)), dfont = wt + ' ' + Math.round(dpx) + 'px ' + fam;
    const measD = (d) => { if (!d) return 0; ctx.font = dfont; return ctx.measureText(d).width || 0; };
    const lw = measD(leftD), rw = measD(rightD);
    const w = (leftD ? lw + pad : 0) + inner.w + (rightD ? pad + rw : 0);
    return {
      w, a: inner.a + gpx * 0.04, d: inner.d + gpx * 0.04,
      draw(c, x, y) {
        const center = y + (inner.d - inner.a) / 2;
        let cx = x;
        if (leftD) { c.save(); c.textBaseline = 'middle'; c.font = dfont; c.fillText(leftD, cx, center); c.restore(); cx += lw + pad; }
        inner.draw(c, cx, y); cx += inner.w + (rightD ? pad : 0);
        if (rightD) { c.save(); c.textBaseline = 'middle'; c.font = dfont; c.fillText(rightD, cx, center); c.restore(); }
      },
    };
  };
  // lee \left<d> … \right<d> (respeta anidamiento) y arma su delimBox. Guarda
  // contra \leftarrow/\rightarrow: solo cuenta si NO sigue otra letra.
  const readLeft = (gpx) => {
    const leftD = readDelimRaw();
    let depth = 1, start = i, rightPos = s.length;
    while (i < s.length) {
      if (s.startsWith('\\left', i) && !/[A-Za-z]/.test(s[i + 5] || '')) { depth++; i += 5; }
      else if (s.startsWith('\\right', i) && !/[A-Za-z]/.test(s[i + 6] || '')) { depth--; if (depth === 0) { rightPos = i; i += 6; break; } i += 6; }
      else i++;
    }
    const inner = _mathBox(ctx, s.slice(start, rightPos), gpx, opts);
    const rightD = readDelimRaw();
    return delimBox(leftD, inner, rightD, gpx);
  };

  // --- entornos: matrices y cases: \begin{env} … \end{env} ------------------
  const splitTop = (str, sep) => {          // divide por `sep` a profundidad 0 de llaves
    const out = []; let depth = 0, cur = '', k = 0;
    while (k < str.length) {
      const c = str[k];
      if (c === '{') { depth++; cur += c; k++; continue; }
      if (c === '}') { depth--; cur += c; k++; continue; }
      if (depth === 0 && str.startsWith(sep, k)) { out.push(cur); cur = ''; k += sep.length; continue; }
      cur += c; k++;
    }
    out.push(cur); return out;
  };
  const ENV_DELIM = { pmatrix: ['(', ')'], bmatrix: ['[', ']'], Bmatrix: ['{', '}'], vmatrix: ['|', '|'], Vmatrix: ['‖', '‖'], cases: ['{', null] };
  const matrixBox = (env, body, gpx) => {
    const rows = splitTop(body, '\\\\').map(r => r.trim()).filter(r => r.length);
    const grid = rows.map(r => splitTop(r, '&').map(cell => _mathBox(ctx, cell.trim(), gpx, opts)));
    const nCols = grid.reduce((m, r) => Math.max(m, r.length), 0);
    const colGap = gpx * 0.6, rowGap = gpx * 0.4;
    const colW = [];
    for (let cI = 0; cI < nCols; cI++) colW[cI] = grid.reduce((m, r) => Math.max(m, r[cI] ? r[cI].w : 0), 0);
    const rowA = grid.map(r => r.reduce((m, c) => Math.max(m, c.a), gpx * ASC));
    const rowD = grid.map(r => r.reduce((m, c) => Math.max(m, c.d), gpx * DESC));
    const totalW = colW.reduce((a, b) => a + b, 0) + colGap * Math.max(0, nCols - 1);
    let totalH = rowGap * Math.max(0, grid.length - 1);
    for (let rI = 0; rI < grid.length; rI++) totalH += rowA[rI] + rowD[rI];
    const axis = gpx * AXIS, leftAlign = env === 'cases';
    const content = {
      w: totalW, a: totalH / 2 + axis, d: totalH / 2 - axis,
      draw(c, x, y) {
        let ry = y - (totalH / 2 + axis);
        for (let rI = 0; rI < grid.length; rI++) {
          ry += rowA[rI];
          let cx = x;
          for (let cI = 0; cI < nCols; cI++) {
            const cell = grid[rI][cI];
            if (cell) cell.draw(c, leftAlign ? cx : cx + (colW[cI] - cell.w) / 2, ry);
            cx += colW[cI] + colGap;
          }
          ry += rowD[rI] + rowGap;
        }
      },
    };
    const d = ENV_DELIM[env];
    return d ? delimBox(d[0], content, d[1], gpx) : content;
  };
  const readEnv = (gpx) => {
    let name = '';
    if (s[i] === '{') { i++; while (i < s.length && s[i] !== '}') { name += s[i]; i++; } if (s[i] === '}') i++; }
    let depth = 1, start = i;
    while (i < s.length) {
      if (s.startsWith('\\begin', i)) { depth++; i += 6; }
      else if (s.startsWith('\\end', i)) { depth--; if (depth === 0) break; i += 4; }
      else i++;
    }
    const body = s.slice(start, i);
    if (s.startsWith('\\end', i)) { i += 4; if (s[i] === '{') { while (i < s.length && s[i] !== '}') i++; if (s[i] === '}') i++; } }
    return matrixBox(name, body, gpx);
  };
  // arma una lista horizontal con espaciado por tipo de átomo (rel/bin).
  const assemble = (atoms, gpx) => {
    const relSp = gpx * 0.22, binSp = gpx * 0.16, opSp = gpx * 0.14;
    const items = atoms.map((at, k) => {
      let sp = 0;
      if (k > 0) {
        const prev = atoms[k - 1].kind, cur = at.kind;
        if (cur === 'space' || prev === 'space') sp = 0;            // espaciador explícito manda
        else if (cur === 'rel' || prev === 'rel') sp = relSp;
        else if (cur === 'bin' || prev === 'bin') sp = binSp;
        else if (cur === 'op' || prev === 'op') sp = opSp;         // operador nombrado / grande
      }
      return { box: at.box, sp };
    });
    let w = 0, a = 0, d = 0;
    for (const it of items) { w += it.sp + it.box.w; a = Math.max(a, it.box.a); d = Math.max(d, it.box.d); }
    return { w, a, d, draw(c, x, y) { let cx = x; for (const it of items) { cx += it.sp; it.box.draw(c, cx, y); cx += it.box.w; } } };
  };

  const readGroupRawText = () => {   // texto crudo de un {...}, para \text/\mathrm
    if (s[i] !== '{') { const ch = s[i] || ''; i++; return ch; }
    i++; let out = '', depth = 1;
    while (i < s.length && depth > 0) { const c = s[i]; if (c === '{') depth++; else if (c === '}') { depth--; if (!depth) { i++; break; } } out += c; i++; }
    return out;
  };
  const cmdBox = (name, gpx) => {
    if (name === 'frac' || name === 'dfrac' || name === 'tfrac') { const a = readArgBox(gpx), b = readArgBox(gpx); return { box: fracBox(a, b, gpx), kind: 'ord' }; }
    if (name === 'sqrt') {
      let idx = null;
      if (s[i] === '[') { i++; let raw = '', dep = 0; while (i < s.length && !(dep === 0 && s[i] === ']')) { if (s[i] === '{') dep++; else if (s[i] === '}') dep--; raw += s[i]; i++; } if (s[i] === ']') i++; idx = _mathBox(ctx, raw, SPX(gpx) * 0.85, opts); }
      const a = readArgBox(gpx); return { box: sqrtBox(a, gpx, idx), kind: 'ord' };
    }
    if (name === 'left') return { box: readLeft(gpx), kind: 'ord' };
    if (name === 'begin') return { box: readEnv(gpx), kind: 'ord' };
    if (name in BIG_OPS) { const isInt = /int$/.test(name); return { box: bigOpGlyph(BIG_OPS[name], gpx, isInt ? 1.55 : 1.42), kind: 'op', big: { stack: !isInt } }; }
    if (LIMIT_OPS.has(name)) { const label = name === 'limsup' ? 'lim sup' : name === 'liminf' ? 'lim inf' : name === 'argmax' ? 'arg max' : name === 'argmin' ? 'arg min' : name; return { box: glyph(label, gpx, 'up'), kind: 'op', big: { stack: true } }; }
    if (name === 'text' || name === 'mathrm' || name === 'operatorname') { return { box: glyph(readGroupRawText(), gpx, 'up'), kind: 'ord' }; }
    if (TEX_OPS.has(name)) return { box: glyph(name, gpx, 'up'), kind: 'op' };
    if (TEX_REL.has(name)) return { box: glyph(TEX_SYM[name] || name, gpx, 'up'), kind: 'rel' };
    if (name in TEX_SYM) { const sym = TEX_SYM[name]; return { box: glyph(sym, gpx, 'up'), kind: /[+−\-×÷±·∓]/.test(sym) ? 'bin' : 'ord' }; }
    return { box: glyph(name, gpx, 'up'), kind: 'ord' };
  };
  const readArgBox = (gpx) => {
    if (s[i] === '{') return readGroupBox(gpx);
    if (s[i] === '\\') { i++; let j = i; while (j < s.length && /[A-Za-z]/.test(s[j])) j++; const nm = s.slice(i, j); i = j; const b = cmdBox(nm, gpx).box; if (!ARG_CMDS.has(nm) && s[i] === ' ') i++; return b; }
    const ch = s[i] || ''; i++; return charBox(ch, gpx);
  };
  const readGroupBox = (gpx) => { i++; return buildList(gpx, true); };

  function buildList(gpx, inGroup) {
    const atoms = [];
    const push = (box, kind, big) => atoms.push({ box, kind, big });
    while (i < s.length) {
      const ch = s[i];
      if (ch === '}') { if (inGroup) { i++; break; } i++; continue; }
      if (ch === ' ') { i++; continue; }                 // espacios: los ignora (como LaTeX)
      if (ch === '\\') {
        i++; let j = i; while (j < s.length && /[A-Za-z]/.test(s[j])) j++;
        const nm = s.slice(i, j);
        if (nm) { i = j; const cb = cmdBox(nm, gpx); if (!ARG_CMDS.has(nm) && s[i] === ' ') i++; push(cb.box, cb.kind, cb.big); }
        else {
          const c = s[i] || ''; i++;
          // espacios matemáticos: \, fino, \; medio, \: fino+, \! nada, \(espacio) espacio
          if (c === ',' || c === ':') push(spaceBox(gpx * 0.17), 'space');
          else if (c === ';') push(spaceBox(gpx * 0.28), 'space');
          else if (c === ' ') push(spaceBox(gpx * 0.25), 'space');
          else if (c === '!') { /* espacio fino negativo: no dibuja nada */ }
          else push(charBox(c, gpx), 'ord');
        }
        continue;
      }
      if (ch === '^' || ch === '_') {
        i++;
        const first = readArgBox(SPX(gpx));
        const baseAtom = atoms.length ? atoms.pop() : { box: charBox('', gpx), kind: 'ord' };
        let sup = ch === '^' ? first : null, sub = ch === '_' ? first : null;
        if (s[i] === '^' && !sup) { i++; sup = readArgBox(SPX(gpx)); }
        else if (s[i] === '_' && !sub) { i++; sub = readArgBox(SPX(gpx)); }
        // un operador grande (∑, lim...) apila/coloca los límites distinto.
        const scripted = baseAtom.big ? bigOpScriptBox(baseAtom.box, sup, sub, gpx, baseAtom.big.stack) : scriptBox(baseAtom.box, sup, sub, gpx);
        push(scripted, baseAtom.kind);
        continue;
      }
      if (ch === '{') { push(readGroupBox(gpx), 'ord'); continue; }
      i++; push(charBox(ch, gpx), charKind(ch));
    }
    return assemble(atoms, gpx);
  }

  return buildList(px, false);
}

// Mide una fórmula LaTeX en el ctx dado. Devuelve { w, ascent, descent, height }.
export function measureMath(ctx, tex, opts = {}) {
  const box = _mathBox(ctx, tex, opts.px || 16, opts);
  return { w: box.w, ascent: box.a, descent: box.d, height: box.a + box.d };
}

// Dibuja una fórmula LaTeX en notación apilada. (x,y) se ancla según
// `opts.align` (left|center|right) y `opts.valign` (baseline|middle|top|bottom,
// default baseline). opts: px (16), color (default fillStyle actual), weight,
// family, alpha, align, valign. Devuelve la geometría para posicionar partes
// contiguas: { w, ascent, descent, height, x, baseline }.
export function drawMath(ctx, tex, x, y, opts = {}) {
  const px = opts.px || 16;
  const box = _mathBox(ctx, tex, px, opts);
  const align = opts.align || 'left';
  const left = align === 'center' ? x - box.w / 2 : align === 'right' ? x - box.w : x;
  const va = opts.valign || 'baseline';
  const base = va === 'middle' ? y + (box.a - box.d) / 2
    : va === 'top' ? y + box.a
    : va === 'bottom' ? y - box.d
    : y;
  ctx.save();
  if (opts.color) { ctx.fillStyle = opts.color; ctx.strokeStyle = opts.color; }
  else ctx.strokeStyle = ctx.fillStyle;
  if (opts.alpha != null) ctx.globalAlpha *= opts.alpha;
  const pa = ctx.textAlign, pb = ctx.textBaseline;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  box.draw(ctx, left, base);
  ctx.textAlign = pa; ctx.textBaseline = pb;
  ctx.restore();
  return { w: box.w, ascent: box.a, descent: box.d, height: box.a + box.d, x: left, baseline: base };
}

export function mixColors(c1, c2, t) {
  const a = parseInt(c1.slice(1), 16);
  const b = parseInt(c2.slice(1), 16);
  const r1 = (a >> 16) & 255, g1 = (a >> 8) & 255, b1 = a & 255;
  const r2 = (b >> 16) & 255, g2 = (b >> 8) & 255, b2 = b & 255;
  const tt = Math.max(0, Math.min(1, t));
  const r = Math.round(r1 + (r2 - r1) * tt);
  const g = Math.round(g1 + (g2 - g1) * tt);
  const bb = Math.round(b1 + (b2 - b1) * tt);
  return '#' + ((r << 16) | (g << 8) | bb).toString(16).padStart(6, '0');
}

// Hex color (#rgb o #rrggbb) a string rgba con el alpha dado. Si el color no
// es hex (rgba(), nombre CSS) se devuelve tal cual: el caller pierde el alpha
// pero no explota.
export function colorAlpha(color, alpha) {
  const c = String(color || '').trim();
  if (c[0] !== '#') return c;
  let hex = c.slice(1);
  if (hex.length === 3) hex = hex.split('').map(ch => ch + ch).join('');
  const n = parseInt(hex.slice(0, 6), 16);
  if (Number.isNaN(n)) return c;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

export function mulberry32(a) {
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Easing for normalized progress p (0..1). Output may overshoot [0,1] for the
// "back"/"elastic" curves (intentional). Shared by world.tween and followPath.
export function ease(p, kind) {
  p = Math.max(0, Math.min(1, p));
  switch (kind) {
    case 'easeIn': return p * p;
    case 'easeOut': return 1 - (1 - p) * (1 - p);
    case 'easeInOut': case true: return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    case 'easeInCubic': return p * p * p;
    case 'easeOutCubic': return 1 - Math.pow(1 - p, 3);
    case 'easeInOutCubic': return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    case 'easeOutBack': { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); }
    case 'easeOutElastic': { if (p === 0 || p === 1) return p; const c4 = (2 * Math.PI) / 3; return Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * c4) + 1; }
    default: return p; // linear
  }
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function anchorTransform(anchor) {
  switch (anchor) {
    case 'top-right':    return 'translate(-100%, 0)';
    case 'bottom-left':  return 'translate(0, -100%)';
    case 'bottom-right': return 'translate(-100%, -100%)';
    case 'center':       return 'translate(-50%, -50%)';
    case 'top':          return 'translate(-50%, 0)';
    case 'bottom':       return 'translate(-50%, -100%)';
    case 'left':         return 'translate(0, -50%)';
    case 'right':        return 'translate(-100%, -50%)';
    default:             return 'translate(0, 0)';
  }
}

export function formatAPA(r) {
  if (!r || typeof r !== 'object') return '';
  const parts = [];
  if (r.authors) parts.push(escapeHtml(r.authors));
  if (r.year != null) parts.push(`(${escapeHtml(String(r.year))}).`);
  if (r.title) {
    const title = escapeHtml(r.title);
    if (r.journal) {
      parts.push(`${title}.`);
      let j = `<em>${escapeHtml(r.journal)}</em>`;
      if (r.volume) j += `, ${escapeHtml(r.volume)}`;
      if (r.pages) j += `, ${escapeHtml(r.pages)}`;
      parts.push(`${j}.`);
    } else {
      parts.push(`<em>${title}</em>.`);
    }
  }
  if (r.publisher) parts.push(`${escapeHtml(r.publisher)}.`);
  if (r.doi) parts.push(`<a href="https://doi.org/${encodeURIComponent(r.doi)}" target="_blank" rel="noopener">https://doi.org/${escapeHtml(r.doi)}</a>`);
  else if (r.url) parts.push(`<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.url)}</a>`);
  return parts.join(' ');
}

// HTML (de formatAPA/richToHtml) → texto plano para el canvas: quita etiquetas
// y DECODIFICA las entidades que introduce escapeHtml (&quot; &#39; &amp;...).
// Sin esto, un `.replace(/<[^>]*>/g,'')` deja `&quot;` literal en el lienzo.
export function htmlToText(html) {
  return String(html)
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');   // amp al final: evita re-decodificar entidades anidadas
}
