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
