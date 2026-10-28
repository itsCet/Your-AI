// Transitions entre les plans. Un « plan » commence après chaque coupe (blanc ou mots barrés).
// Chaque coupe [a, b] reçoit une transition : la fin du plan précédent (juste avant a) et le début
// du suivant (juste après b) sont animés. Seule l'image de la vidéo bouge ; textes et cartes restent nets.
import { clamp } from './kit.js';
import { ez } from './anim.js';

export const TRANSITIONS = [
  { id: 'zoomcut', name: 'Recadrage', desc: 'Le plan suivant est cadré plus serré ou plus large (jump cut)', big: false },
  { id: 'whip', name: 'Whip pan', desc: 'L\'image file sur le côté avec un flou de vitesse', big: true },
  { id: 'blur', name: 'Flou zoom', desc: 'Flou et léger zoom qui se résorbe', big: true },
  { id: 'flash', name: 'Flash', desc: 'Éclair blanc au moment de la coupe', big: true },
  { id: 'glitch', name: 'Glitch', desc: 'Décalage RVB et tranches qui sautent', big: true },
  { id: 'spin', name: 'Zoom rotatif', desc: 'Le plan arrive en tournant et en dézoomant', big: true },
  { id: 'zoomthrough', name: 'Zoom à travers', desc: 'On plonge dans l\'image jusqu\'au flou, le plan suivant arrive de trop près et se pose (vidéo « 17 effets »)', big: true },
  { id: 'cut', name: 'Coupe sèche', desc: 'Aucun effet', big: false },
];
export const TRANS_STYLES = [
  { id: 'auto', name: 'Mix', desc: 'Recadrages sur les petites coupes, whip / flou / flash aux changements d\'idée' },
  { id: 'zoomcut', name: 'Recadrages', desc: 'Jump cuts plus serrés / plus larges, sans effet' },
  { id: 'whip', name: 'Whip pan', desc: 'Whip pan aux changements d\'idée, recadrages ailleurs' },
  { id: 'blur', name: 'Flou zoom', desc: 'Flou zoom aux changements d\'idée, recadrages ailleurs' },
  { id: 'flash', name: 'Flash', desc: 'Flash blanc aux changements d\'idée, recadrages ailleurs' },
  { id: 'glitch', name: 'Glitch', desc: 'Glitch aux changements d\'idée, recadrages ailleurs' },
  { id: 'spin', name: 'Zoom rotatif', desc: 'Zoom rotatif aux changements d\'idée, recadrages ailleurs' },
  { id: 'zoomthrough', name: 'Zoom à travers', desc: 'Plongée dans l\'image aux changements d\'idée, recadrages ailleurs' },
  { id: 'cut', name: 'Coupes sèches', desc: 'Aucune transition' },
];
export const transName = id => TRANSITIONS.find(x => x.id === id)?.name || id;

const OUT = .16, IN = .32;
// Le zoom à travers a besoin de plus d'élan avant la coupe et d'un peu plus de temps pour se poser.
const OUT_OF = { zoomthrough: .3 }, IN_OF = { zoomthrough: .45 };
const MIX = ['whip', 'zoomthrough', 'flash', 'blur', 'spin'];

/**
 * Les changements de plan : chaque coupe (blanc ou mots barrés), plus, sans coupe, chaque début de phrase
 * et un point au moins toutes les ~6 s (sur une virgule si possible) pour garder du rythme.
 * cutSegs = [[a, b]] (temps de la vidéo source) ; pour un point sans coupe, a = b.
 * style = TRANS_STYLES id, over = { [clé]: kind } choisis à la main. Retourne [{ key, a, b, kind, level, sentence }].
 * level = cadrage du plan qui commence (1 ou 1.12, alterné).
 */
export function planTransitions(cutSegs, words, style = 'auto', over = {}, duration = Infinity) {
  const kept = words.filter(w => !w.cut);
  const prevWord = t => { let p = null; for (const w of kept) { if (w.e <= t + .05) p = w; else break; } return p; };
  const pts = [];
  for (const [a, b] of cutSegs) {
    if (a < .05 || b >= duration - .1) continue;
    const prev = prevWord(a);
    pts.push({ a, b, sentence: !prev || /[.?!…]$/.test(prev.w) || b - a > .9 });
  }
  const nearCut = t => pts.some(p => t > p.a - .5 && t < p.b + .5);
  for (let i = 1; i < kept.length; i++) {
    const t = Math.max(kept[i - 1].e, kept[i].s - .06);
    if (/[.?!…]$/.test(kept[i - 1].w) && t > 1 && t < duration - 1 && !nearCut(t)) pts.push({ a: t, b: t, sentence: true });
  }
  pts.sort((x, y) => x.b - y.b);
  // Rythme : pas de plan de plus de ~6 s.
  const rhythm = [];
  let last = 0;
  for (const p of [...pts, { b: duration, end: true }]) {
    while (p.a - last > 6.5 || (p.end && Math.min(duration, 1e6) - last > 6.5)) {
      const cand = kept.filter((w, i) => i > 0 && w.s > last + 3 && w.s < Math.min(p.a ?? duration, duration) - 2);
      const w = cand.find(w => w.s > last + 4 && /[,;:]$/.test(kept[kept.indexOf(w) - 1].w)) || cand.find(w => w.s > last + 4.5);
      if (!w) break;
      const t = w.s - .06; rhythm.push({ a: t, b: t, sentence: false }); last = t;
    }
    if (!p.end) last = p.b;
  }
  const all = [...pts, ...rhythm].sort((x, y) => x.b - y.b);
  const out = [];
  let lastBig = -1e9, n = 0, level = 1;
  for (const p of all) {
    const key = transKey(p.b);
    let kind = 'zoomcut';
    if (style === 'cut') kind = 'cut';
    else if (style !== 'zoomcut' && p.sentence && p.b - lastBig > 4) kind = style === 'auto' ? MIX[n % MIX.length] : style;
    if (over[key]) kind = over[key];
    if (TRANSITIONS.find(x => x.id === kind)?.big) { lastBig = p.b; n++; }
    if (kind !== 'cut') level = level === 1 ? 1.12 : 1;
    out.push({ key, a: p.a, b: p.b, kind, level, sentence: p.sentence });
  }
  return out;
}
export const transKey = b => String(Math.round(b * 10));

/**
 * Effet sur l'image de la vidéo à l'instant t (temps source).
 * Retourne { zoom, dx, rot, blur, flash, glitch } ; dx en fraction de la largeur, blur en fraction de la largeur.
 */
export function videoFx(trans, t) {
  const fx = { zoom: 1, dx: 0, rot: 0, blur: 0, flash: 0, glitch: 0 };
  if (!trans || !trans.length) return fx;
  // Cadrage du plan en cours (le dernier plan commencé).
  let cur = null;
  for (const tr of trans) if (tr.b <= t + .001) cur = tr;
  fx.zoom = cur ? cur.level : 1;
  for (const tr of trans) {
    const pin = (t - tr.b) / (IN_OF[tr.kind] || IN), pout = (tr.a - t) / (OUT_OF[tr.kind] || OUT);
    const inside = pin >= 0 && pin < 1, before = pout >= 0 && pout < 1;
    if (!inside && !before) continue;
    const k = tr.kind;
    if (inside) {
      const e = 1 - ez('expo.out')(pin); // 1 → 0
      if (k === 'zoomcut') fx.zoom *= 1 + .05 * e;
      if (k === 'whip') { fx.dx = .55 * e; fx.blur = .035 * e; }
      if (k === 'blur') { fx.zoom *= 1 + .14 * e; fx.blur = .03 * e; }
      if (k === 'flash') { fx.flash = Math.max(fx.flash, e); fx.zoom *= 1 + .06 * e; }
      if (k === 'glitch') fx.glitch = pin < .55 ? 1 - pin / .55 : 0;
      if (k === 'spin') { fx.zoom *= 1 + .35 * e; fx.rot = -.22 * e; fx.blur = .02 * e; }
      if (k === 'zoomthrough') { fx.zoom *= 1 + .5 * e; fx.blur = .028 * e; }
    } else {
      const e = ez('power2.in')(1 - pout); // 0 → 1 en arrivant à la coupe
      if (k === 'whip') { fx.dx = -.55 * e; fx.blur = .035 * e; }
      if (k === 'blur') { fx.zoom *= 1 + .1 * e; fx.blur = .03 * e; }
      if (k === 'flash') fx.flash = Math.max(fx.flash, e);
      if (k === 'glitch') fx.glitch = e * .8;
      if (k === 'spin') { fx.zoom *= 1 + .26 * e; fx.rot = .15 * e; fx.blur = .015 * e; }
      if (k === 'zoomthrough') { fx.zoom *= 1 + 2.2 * e; fx.blur = .03 * e; }
    }
  }
  return fx;
}

// Dessine la vidéo avec l'effet (drawVid(ctx, zoom) dessine la vidéo plein cadre).
export function withVideoFx(ctx, W, H, fx, drawVid, baseZoom = 1) {
  const z = baseZoom * fx.zoom;
  // En tournant, on agrandit le cadre entier (le découpage compris) pour que les coins restent couverts.
  const r = Math.abs(fx.rot), cover = r ? Math.max(1, (Math.cos(r) + Math.max(W, H) / Math.min(W, H) * Math.sin(r)) / fx.zoom) : 1;
  if (!fx.dx && !fx.rot && !fx.blur) return drawVid(ctx, z);
  ctx.save();
  if (fx.blur) ctx.filter = (ctx.filter && ctx.filter !== 'none' ? ctx.filter + ' ' : '') + `blur(${Math.round(fx.blur * W)}px)`;
  ctx.translate(W / 2 + fx.dx * W, H / 2); ctx.rotate(fx.rot); ctx.scale(cover, cover); ctx.translate(-W / 2, -H / 2);
  // Pendant un whip, on remplit le côté découvert avec l'image miroir pour ne pas montrer de noir.
  drawVid(ctx, z);
  if (fx.dx) { ctx.translate(fx.dx > 0 ? -W : W, 0); drawVid(ctx, z); }
  ctx.restore();
}

// Effets posés sur toute l'image : flash blanc, glitch.
let glitchLayer = null;
export function drawPostFx(ctx, W, H, fx, t) {
  if (fx.glitch > .02) {
    if (!glitchLayer) glitchLayer = document.createElement('canvas');
    if (glitchLayer.width !== W || glitchLayer.height !== H) { glitchLayer.width = W; glitchLayer.height = H; }
    const g = glitchLayer.getContext('2d');
    g.clearRect(0, 0, W, H); g.drawImage(ctx.canvas, 0, 0);
    const a = fx.glitch, seed = Math.floor(t * 30);
    const rnd = i => { const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return x - Math.floor(x); };
    // Décalage rouge / bleu.
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .45 * a;
    ctx.filter = 'sepia(1) saturate(8) hue-rotate(-50deg)'; ctx.drawImage(glitchLayer, W * .025 * a, 0);
    ctx.filter = 'sepia(1) saturate(8) hue-rotate(170deg)'; ctx.drawImage(glitchLayer, -W * .025 * a, 0);
    ctx.restore();
    // Tranches horizontales décalées.
    for (let i = 0; i < 7; i++) {
      if (rnd(i) > .35 + .5 * (1 - a)) continue;
      const y = rnd(i + 10) * H, h = H * (.015 + rnd(i + 20) * .06), dx = (rnd(i + 30) - .5) * W * .18 * a;
      ctx.drawImage(glitchLayer, 0, y, W, h, dx, y, W, h);
    }
  }
  if (fx.flash > .01) { ctx.save(); ctx.globalAlpha = clamp(fx.flash) * .92; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
}

export const TRANS_SFX = { zoomthrough: 'whoosh', whip: 'whoosh', blur: 'swipe', flash: 'bam', glitch: 'glitch', spin: 'whoosh', zoomcut: '', cut: '' };
