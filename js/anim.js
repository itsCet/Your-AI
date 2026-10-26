// Moteur d'animation : chaque élément décrit sa chorégraphie avec une timeline GSAP en pause,
// qu'on positionne au temps voulu (seek). Le résultat est déterministe : l'aperçu et l'export
// dessinent exactement la même chose à un temps donné, en avant comme en arrière.
// + petites primitives « faites main » : cercle dessiné, soulignement, surligneur, coche.
import { clamp } from './kit.js';

const G = () => window.gsap;
export const ez = name => G().parseEase(name);

const cache = new Map();
/**
 * État animé d'un élément au temps lt (secondes depuis son début).
 * key   : identifie l'élément et ses réglages (si ça change, la timeline est reconstruite)
 * init  : valeurs de départ (toutes les propriétés animées doivent exister)
 * build : (tl, s) => ajoute les tweens à la timeline
 */
export function stateAt(key, init, build, lt) {
  let c = cache.get(key);
  if (!c) {
    const s = { ...init };
    const tl = G().timeline({ paused: true });
    build(tl, s);
    c = { s, tl };
    cache.set(key, c);
    if (cache.size > 400) cache.delete(cache.keys().next().value);
  }
  c.tl.totalTime(clamp(lt, 0, c.tl.duration() || 0));
  return c.s;
}

// Bruit doux déterministe (pour que les traits « à la main » ne bougent pas d'une image à l'autre).
const wob = (a, seed) => Math.sin(a * 3 + seed) * .035 + Math.sin(a * 7 + seed * 2.3) * .015;

// Cercle dessiné à la main : un peu plus d'un tour, légèrement irrégulier. p = avancement 0..1.
export function handRing(ctx, cx, cy, rx, ry, p, color, lw, seed = 1) {
  if (p <= 0) return;
  const start = -.4 + seed * .3, total = Math.PI * 2 * 1.12, steps = 64;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i <= steps * p; i++) {
    const a = start + total * i / steps;
    const k = 1 + wob(a, seed) + .05 * i / steps;
    const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

// Trait dessiné à la main (soulignement ou rature), de x1 à x2, légèrement ondulé.
export function handLine(ctx, x1, y, x2, p, color, lw, seed = 1, curve = .02) {
  if (p <= 0) return;
  const steps = 32, w = x2 - x1;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= steps * p; i++) {
    const t = i / steps;
    const x = x1 + w * t, yy = y + Math.sin(t * Math.PI) * w * curve + Math.sin(t * 9 + seed) * lw * .25;
    i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
  }
  ctx.stroke();
  ctx.restore();
}

// Surligneur : une bande de couleur qui balaie de gauche à droite derrière le texte.
export function marker(ctx, x, y, w, h, p, color) {
  if (p <= 0) return;
  ctx.save();
  ctx.fillStyle = color;
  const ww = w * clamp(p);
  ctx.beginPath();
  ctx.moveTo(x - h * .08, y + h * .08);
  ctx.lineTo(x + ww, y);
  ctx.lineTo(x + ww + h * .06, y + h);
  ctx.lineTo(x - h * .02, y + h * .94);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Coche dessinée progressivement.
export function checkMark(ctx, cx, cy, size, p, color, lw) {
  if (p <= 0) return;
  const pts = [[-.42, .02], [-.12, .32], [.45, -.32]];
  const l1 = Math.hypot(.3, .3), l2 = Math.hypot(.57, .64), L = l1 + l2;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + pts[0][0] * size, cy + pts[0][1] * size);
  const d = p * L;
  const k1 = Math.min(1, d / l1);
  ctx.lineTo(cx + (pts[0][0] + (pts[1][0] - pts[0][0]) * k1) * size, cy + (pts[0][1] + (pts[1][1] - pts[0][1]) * k1) * size);
  if (d > l1) {
    const k2 = (d - l1) / l2;
    ctx.lineTo(cx + (pts[1][0] + (pts[2][0] - pts[1][0]) * k2) * size, cy + (pts[1][1] + (pts[2][1] - pts[1][1]) * k2) * size);
  }
  ctx.stroke();
  ctx.restore();
}

// Carte arrondie avec ombre douce.
export function softCard(ctx, x, y, w, h, r, fill, { shadow = .35, stroke = null, lw = 2 } = {}) {
  ctx.save();
  if (shadow) { ctx.shadowColor = `rgba(0,0,0,${shadow})`; ctx.shadowBlur = w * .08; ctx.shadowOffsetY = w * .025; }
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  ctx.shadowColor = 'transparent';
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  ctx.restore();
}
