// Boîte à outils de dessin partagée : polices, palettes, courbes d'animation,
// et petits composants (pastilles, cartes lumineuses, image ajustée).

export const FONTS = [
  { name: 'Anton', family: 'Anton', weight: 400 },
  { name: 'Bebas Neue', family: 'Bebas Neue', weight: 400 },
  { name: 'Archivo Black', family: 'Archivo Black', weight: 400 },
  { name: 'DM Serif Display', family: 'DM Serif Display', weight: 400 },
  { name: 'Space Mono', family: 'Space Mono', weight: 700 },
  { name: 'Inter Extra Bold', family: 'Inter', weight: 800 },
  { name: 'Playfair italique', family: 'Playfair Display', weight: 700, style: 'italic' },
  { name: 'Instrument Serif', family: 'Instrument Serif', weight: 400, style: 'italic' },
];

// panel = fond des cartes et des écrans partagés.
export const PALETTES = [
  { name: 'Sunshine', accent: '#FFD60A', text: '#FFFFFF', ink: '#111111', panel: '#161616' },
  { name: 'Signal', accent: '#FF3B30', text: '#FFFFFF', ink: '#111111', panel: '#161616' },
  { name: 'Electric', accent: '#2F6BFF', text: '#FFFFFF', ink: '#0B0B0B', panel: '#10131C' },
  { name: 'Mint', accent: '#3DDC97', text: '#FFFFFF', ink: '#0E1B14', panel: '#101814' },
  { name: 'Bubblegum', accent: '#FF4FA3', text: '#FFFFFF', ink: '#1A0710', panel: '#1A0F15' },
  { name: 'Mono', accent: '#FFFFFF', text: '#FFFFFF', ink: '#000000', panel: '#141414' },
  { name: 'Or nuit', accent: '#FFC21A', text: '#FFFFFF', ink: '#17120A', panel: '#1A150C' },
  { name: 'Corail studio', accent: '#E8553D', text: '#FFFFFF', ink: '#1B1B1B', panel: '#F3EFE8' },
  { name: 'Cuivre', accent: '#F2B33D', text: '#FFFFFF', ink: '#1E0F06', panel: '#2A160B' },
  { name: 'Rose bonbon', accent: '#E86AA6', text: '#FFFFFF', ink: '#2A0E1C', panel: '#FBEFF5' },
];

// Polices fixes utilisées par certains éléments (indépendantes du choix de police).
export const SERIF = { family: 'Playfair Display', weight: 700, style: 'italic' };
export const UI = { family: 'Inter', weight: 600 };
export const UI_BOLD = { family: 'Inter', weight: 800 };
export const HAND = { family: 'Caveat', weight: 700 };

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
// Courbes d'animation (jamais de mouvement linéaire) :
// ease = Ease-Out cubique (freinage fluide pour les entrées),
// easeInOut = démarrage et fin doux, backOut = « elastic pop » qui dépasse légèrement puis se pose.
export const ease = p => 1 - Math.pow(1 - clamp(p), 3);
export const easeInOut = p => { p = clamp(p); return 3 * p * p - 2 * p * p * p; };
export const backOut = p => { p = clamp(p); return 1 + 2.70158 * Math.pow(p - 1, 3) + 1.70158 * Math.pow(p - 1, 2); };
export const env = (p, a = .15, b = .15) => Math.min(ease(p / a), ease((1 - p) / b));
export const fontOf = name => FONTS.find(f => f.name === name) || FONTS[0];
export const fstr = (F, size) => `${F.style || 'normal'} ${F.weight} ${Math.round(size)}px "${F.family}"`;
export const isLight = hex => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * .3 + (n >> 8 & 255) * .59 + (n & 255) * .11) > 150; };
// Couleur d'accent lisible même avec la palette Mono.
export const hi = P => P.accent === '#FFFFFF' ? '#FFD60A' : P.accent;

let video = null;
export function setVideo(v) { video = v; }
export function getVideo() { return video; }

export function fitSize(ctx, text, F, maxW, size) {
  ctx.font = fstr(F, size);
  const w = ctx.measureText(text).width;
  return w > maxW ? size * maxW / w : size;
}

export function wrap(ctx, text, maxW) {
  const lines = []; let cur = '';
  for (const w of text.split(/\s+/)) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

const srcSize = s => s instanceof HTMLVideoElement ? [s.videoWidth, s.videoHeight] : [s.naturalWidth || s.width, s.naturalHeight || s.height];
const srcReady = s => s && (s instanceof HTMLVideoElement ? s.readyState >= 2 && s.videoWidth : (s.complete ?? true) && srcSize(s)[0]);

// Dessine une image ou une vidéo dans un rectangle : 'cover' remplit, 'contain' montre tout.
export function drawFit(ctx, src, x, y, w, h, { mode = 'cover', r = 0, zoom = 1, cropY = .5 } = {}) {
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
  if (srcReady(src)) {
    const [sw, sh] = srcSize(src);
    const k = (mode === 'cover' ? Math.max(w / sw, h / sh) : Math.min(w / sw, h / sh)) * zoom;
    const dw = sw * k, dh = sh * k;
    ctx.drawImage(src, x + (w - dw) / 2, y + (h - dh) * cropY, dw, dh);
  } else if (src === video || !src) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#3a3530'); g.addColorStop(1, '#14161c');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.beginPath(); ctx.arc(x + w / 2, y + h * .42, w * .17, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * .82, w * .36, h * .2, 0, 0, 7); ctx.fill();
  }
  ctx.restore();
}
export const drawVideoRect = (ctx, x, y, w, h, r = 0, zoom = 1, cropY = .5) => drawFit(ctx, video, x, y, w, h, { r, zoom, cropY });

// Pastille arrondie en petites capitales, avec un point de couleur optionnel.
// align : 'left' | 'center' | 'right' par rapport à x. Retourne la largeur.
export function pill(ctx, x, y, text, { size, bg = 'rgba(20,20,20,.85)', fg = '#fff', dot = null, align = 'left', border = 'rgba(255,255,255,.18)' } = {}) {
  ctx.save();
  ctx.font = fstr(UI_BOLD, size);
  ctx.letterSpacing = `${size * .12}px`;
  const label = text.toUpperCase();
  const tw = ctx.measureText(label).width, dw = dot ? size * .9 : 0;
  const w = tw + dw + size * 1.6, h = size * 2;
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x0, y - h / 2, w, h, h / 2); ctx.fill();
  if (border) { ctx.strokeStyle = border; ctx.lineWidth = Math.max(1, size * .08); ctx.stroke(); }
  if (dot) { ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(x0 + size * .95, y, size * .25, 0, 7); ctx.fill(); }
  ctx.fillStyle = fg; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x0 + size * .8 + dw, y + size * .05);
  ctx.restore();
  return w;
}

// Carte sombre aux bords lumineux (style « carte à collectionner »).
export function glowCard(ctx, x, y, w, h, P, { fill = null } = {}) {
  const c = hi(P);
  ctx.save();
  ctx.shadowColor = c; ctx.shadowBlur = w * .07;
  ctx.fillStyle = fill || 'rgba(16,13,8,.92)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, w * .05); ctx.fill();
  ctx.shadowBlur = w * .03; ctx.strokeStyle = c; ctx.lineWidth = Math.max(2, w * .008); ctx.stroke();
  ctx.restore();
}

// Petit libellé espacé en capitales (titres de cartes).
export function label(ctx, x, y, text, size, color = 'rgba(255,255,255,.75)', align = 'center') {
  ctx.save();
  ctx.font = fstr(UI_BOLD, size); ctx.letterSpacing = `${size * .25}px`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillText(text.toUpperCase(), x, y);
  ctx.restore();
}

// Coins de cadrage (viseur caméra, mise au point).
export function brackets(ctx, x, y, w, h, len, color, lw) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    ctx.moveTo(cx, cy + dy * len); ctx.lineTo(cx, cy); ctx.lineTo(cx + dx * len, cy);
  }
  ctx.stroke();
  ctx.restore();
}

// Fond plein écran chaud et granuleux (cartes « BAM », « 3 », phrases cinétiques).
let grain = null;
function grainPattern(ctx) {
  if (!grain) {
    grain = document.createElement('canvas'); grain.width = grain.height = 160;
    const g = grain.getContext('2d'), img = g.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 40; }
    g.putImageData(img, 0, 0);
  }
  return ctx.createPattern(grain, 'repeat');
}
export function warmBg(ctx, W, H, P, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const dark = P.panel && !isLight(P.panel) ? P.panel : '#1E0F06';
  const g = ctx.createRadialGradient(W * .5, H * .3, W * .05, W * .5, H * .45, H * .75);
  g.addColorStop(0, mix(hi(P), dark, .45)); g.addColorStop(.55, mix(hi(P), dark, .8)); g.addColorStop(1, dark);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = alpha * .6; ctx.fillStyle = grainPattern(ctx); ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
export function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// ---------- Motion design (effets de thème) ----------
// fx = { pop, slide, glow, glowColor } : réglages du thème, voir FX_PRESETS dans render.js.

// Kinetic Text Pop : le mot grossit d'un coup quand il est prononcé (elastic pop),
// puis reprend sa taille (ease-in-out). x = secondes depuis le début du mot.
export function kineticPop(x, amp = .28) {
  if (x < 0) return 1;
  if (x < .12) return 1 + amp * backOut(x / .12);
  return 1 + amp * (1 - easeInOut((x - .12) / .3));
}

// Slide & Blur : entrée par le bas (position en Ease-Out) avec un flou de mouvement
// limité aux premières images. À appeler après ctx.save(). p = avancement 0..1 de l'élément.
export function slideBlur(ctx, W, H, p, span = .22) {
  const k = clamp(p / span);
  if (k >= 1) return;
  ctx.translate(0, (1 - ease(k)) * H * .09);
  const blur = (1 - k) * W * .014;
  if (blur > .3) ctx.filter = `blur(${blur.toFixed(1)}px)`;
}

// Glow (néon) : chaque texte dessiné pendant fn() reçoit d'abord une lueur floue de la
// couleur choisie, puis le texte net par-dessus.
export function withGlow(ctx, color, W, fn) {
  if (!color) return fn();
  const own = Object.prototype.hasOwnProperty.call(ctx, 'fillText');
  const fill = CanvasRenderingContext2D.prototype.fillText;
  ctx.fillText = function (t, x, y, mw) {
    this.save();
    this.fillStyle = color; this.shadowColor = color;
    this.shadowBlur = W * .045; this.globalAlpha *= .85;
    fill.call(this, t, x, y, mw);
    this.shadowBlur = W * .018;
    fill.call(this, t, x, y, mw);
    this.restore();
    fill.call(this, t, x, y, mw);
  };
  try { return fn(); } finally { if (!own) delete ctx.fillText; }
}
