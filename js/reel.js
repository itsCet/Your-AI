// Les effets de la vidéo « 17 video effects Claude can create » (@tenfoldmarc) qui manquaient à l'app,
// écrits d'après la description effet par effet de github.com/ONIKOSIOLA/video-editing-kit
// (skills/video-overlays/reel-effects-17.md). Aucun code repris : seulement la recette.
//
// Beaucoup s'appuient sur ta silhouette détourée (o.person) : « derrière toi », contour, sticker, fond qui bouge.
// Sans détourage (pas encore calculé), chaque effet a une version de secours qui reste propre.
// Tout est une fonction du temps lt (secondes depuis le début de l'effet) : aperçu et export identiques.
import { fstr, fitSize, clamp, drawVideoRect, drawFit, isLight } from './kit.js';

// Effets qui remplacent toute l'image (ils dessinent eux-mêmes la vidéo et la personne).
export const SCENES = new Set(['uiworld', 'framebreak', 'pullback', 'greenscreen', 'papercut', 'vertigo']);
// Effets posés derrière la personne quand le détourage est prêt.
export const BEHIND = new Set(['couchwall', 'headlinewall', 'phonemockup', 'coverstory', 'glasstype']);
// Effets qui ont besoin du détourage pour être réussis (l'app le lance toute seule).
export const NEEDS_MATTE = new Set(['couchwall', 'headlinewall', 'phonemockup', 'coverstory', 'glasstype', 'greenscreen', 'papercut', 'doodleboil', 'vertigo', 'framebreak']);
export const REEL_HIDES = new Set(['uiworld', 'pullback', 'greenscreen', 'papercut', 'coverstory', 'glasstype', 'chartgrow', 'framebreak']);

const eo = x => 1 - (1 - clamp(x)) ** 3;
const eio = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2; };
const back = (x, s = 1.7) => { x = clamp(x); const c = s + 1; return 1 + c * (x - 1) ** 3 + s * (x - 1) ** 2; };
// Entrée / sortie d'un effet : 0 → 1 → 0.
const life = (lt, dur, a = .35, b = .3) => Math.min(eo(lt / a), eo((dur - lt) / b));
const val = (m, k, d = '') => (m.f && m.f[k] != null && m.f[k] !== '' ? m.f[k] : d);
const list = (m, k, d = []) => { const v = val(m, k, d); return (Array.isArray(v) ? v : String(v).split('\n')).map(x => String(x).trim()).filter(Boolean); };
// Hasard stable (même tirage à chaque image).
const rnd = (i, seed = 1) => { const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453; return x - Math.floor(x); };
const SERIF = { family: 'Playfair Display', weight: 700 };
const SANS = w => ({ family: 'Inter', weight: w });
const GEIST = w => ({ family: 'Geist', weight: w });

function rr(ctx, x, y, w, h, r, fill, stroke, lw = 2) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function blurIn(ctx, k, W) { if (k < .999) ctx.filter = `blur(${((1 - k) * W * .014).toFixed(1)}px)`; ctx.globalAlpha *= clamp(k); }
// Une image source (photo, image de la vidéo) dans un rectangle, recadrée.
const img = (ctx, src, x, y, w, h, r) => drawFit(ctx, src, x, y, w, h, { r });
// La vidéo ou une image de secours.
const vid = (ctx, x, y, w, h, r = 0, zoom = 1, cropY = .5) => drawVideoRect(ctx, x, y, w, h, r, zoom, cropY);
// Ta silhouette seule (canvas W×H) ou null sans détourage.
const personOf = (o, zoom = 1) => (o.person ? o.person(zoom) : null);
// Gros titre en bas de l'écran qui arrive en flou (légende des effets de la vidéo).
function bigCaption(ctx, text, mark, W, H, k, L, y = .74) {
  if (!text || k <= 0) return;
  ctx.save(); blurIn(ctx, k, W);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const F = SANS(900), fs = fitSize(ctx, text, F, W * .86, W * .1);
  ctx.font = fstr(F, fs);
  const words = text.split(/\s+/), marks = new Set(String(mark || '').toLowerCase().split(/\s+/).filter(Boolean));
  const widths = words.map(w => ctx.measureText(w + ' ').width), total = widths.reduce((a, b) => a + b, 0);
  let x = W / 2 - total / 2;
  ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = W * .03;
  words.forEach((w, i) => {
    ctx.fillStyle = marks.has(w.toLowerCase().replace(/[.,!?]/g, '')) ? L.P.accent : '#fff';
    ctx.textAlign = 'left'; ctx.fillText(w, x, H * y + (1 - k) * W * .03); x += widths[i];
  });
  ctx.restore();
}

export const REEL_DEFS = {
  // 2. Couch wall : un mur de vignettes derrière toi, qui arrivent une à une en flou, + gros titre.
  couchwall: {
    draw(ctx, m, lt, L, W, H, o) {
      const k = life(lt, m.dur), photos = (o.photos || []).filter(Boolean);
      const cols = 4, rows = 5, gw = W * .94, cw = gw / cols, ch = cw * 1.25, x0 = (W - gw) / 2, y0 = H * .03;
      ctx.save(); ctx.globalAlpha = k;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c, at = .05 + i * .065, q = eo((lt - at) / .35);
        if (q <= 0) continue;
        const x = x0 + c * cw + cw * .05, y = y0 + r * ch + ch * .05, w = cw * .9, h = ch * .9;
        ctx.save(); blurIn(ctx, q, W);
        ctx.translate(x + w / 2, y + h / 2); ctx.scale(.85 + .15 * q, .85 + .15 * q); ctx.translate(-x - w / 2, -y - h / 2);
        rr(ctx, x, y, w, h, w * .07, '#111');
        if (photos.length) img(ctx, photos[i % photos.length], x, y, w, h, w * .07);
        // Pastille « lecture » (sans chiffres inventés).
        ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.roundRect(x + w * .06, y + h - w * .22, w * .3, w * .16, w * .08); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); const px = x + w * .14, py = y + h - w * .14;
        ctx.moveTo(px - w * .03, py - w * .045); ctx.lineTo(px + w * .045, py); ctx.lineTo(px - w * .03, py + w * .045); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    },
    front(ctx, m, lt, L, W, H) { bigCaption(ctx, val(m, 'text'), val(m, 'mark'), W, H, eo((lt - .5) / .4) * life(lt, m.dur), L); },
  },

  // 3. UI world : l'écran se coupe en deux, une appli de montage (notre maquette) en haut, toi en bas.
  uiworld: {
    draw(ctx, m, lt, L, W, H, o) {
      const T = m.dur, s = Math.min(eio(lt / .45), eio((T - lt) / .35)); // 0 plein écran → 1 coupé
      const split = H * .5 * s, A = L.P.accent;
      ctx.fillStyle = '#0d0d10'; ctx.fillRect(0, 0, W, H);
      vid(ctx, 0, split, W, H - split, 0, 1, .35);
      if (s <= .001) return;
      ctx.save(); ctx.translate(0, -H * .5 * (1 - s));
      const u = W / 1080, pad = 44 * u, top = 70 * u;
      ctx.fillStyle = '#f4f2ee'; ctx.fillRect(0, 0, W, H * .5);
      ctx.fillStyle = '#0b0b0b'; ctx.font = fstr(GEIST(600), 34 * u); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillText(val(m, 'app', 'Studio'), pad, top);
      ctx.fillStyle = '#8a8782'; ctx.font = fstr(GEIST(500), 24 * u); ctx.textAlign = 'right'; ctx.fillText('nouveau projet', W - pad, top);
      // Zone de dépôt + vignettes qui tombent dedans.
      const zx = pad, zy = top + 50 * u, zw = W - pad * 2, zh = H * .5 - zy - 150 * u;
      ctx.setLineDash([14 * u, 10 * u]); rr(ctx, zx, zy, zw, zh, 28 * u, '#fff', '#c9c5be', 3 * u); ctx.setLineDash([]);
      const photos = (o.photos || []).filter(Boolean).slice(0, 4), tw = (zw - 50 * u) / 4;
      photos.forEach((p, i) => {
        const q = back((lt - .5 - i * .15) / .4);
        if (q <= 0) return;
        const x = zx + 10 * u + i * (tw + 10 * u), y = zy + 24 * u - (1 - q) * 120 * u;
        ctx.save(); ctx.globalAlpha = clamp(q); img(ctx, p, x, y, tw, zh * .62, 16 * u); ctx.restore();
      });
      // Étiquette au surligneur.
      const tq = eo((lt - 1.1) / .3);
      if (tq > 0) {
        const tag = val(m, 'tag', 'RUSHS'); ctx.font = fstr(GEIST(700), 28 * u);
        const w = ctx.measureText(tag).width + 30 * u, y = zy + zh - 50 * u;
        ctx.fillStyle = '#E8F26B'; ctx.fillRect(zx + 20 * u, y - 22 * u, w * tq, 44 * u);
        ctx.fillStyle = '#0b0b0b'; ctx.textAlign = 'left'; ctx.globalAlpha = tq; ctx.fillText(tag, zx + 35 * u, y + 1); ctx.globalAlpha = 1;
      }
      // Barre de commande tapée + bouton envoyer qui s'allume.
      const cmd = val(m, 'command', '/montage'), by = H * .5 - 100 * u, typed = Math.floor(clamp((lt - 1.4) / .8) * cmd.length);
      rr(ctx, pad, by, W - pad * 2, 76 * u, 38 * u, '#fff', '#e2dfd9', 2 * u);
      ctx.font = fstr({ family: 'Space Mono', weight: 700 }, 28 * u); ctx.fillStyle = '#0b0b0b'; ctx.textAlign = 'left';
      ctx.fillText(cmd.slice(0, typed) + (Math.floor(lt * 2.5) % 2 && typed < cmd.length ? '|' : ''), pad + 32 * u, by + 39 * u);
      const lit = typed >= cmd.length && lt > 2.3;
      ctx.fillStyle = lit ? A : '#d8d4cd'; ctx.beginPath(); ctx.arc(W - pad - 40 * u, by + 38 * u, 26 * u, 0, 7); ctx.fill();
      ctx.strokeStyle = lit && isLight(A) ? '#111' : '#fff'; ctx.lineWidth = 4 * u; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(W - pad - 40 * u, by + 50 * u); ctx.lineTo(W - pad - 40 * u, by + 26 * u); ctx.moveTo(W - pad - 51 * u, by + 37 * u); ctx.lineTo(W - pad - 40 * u, by + 26 * u); ctx.lineTo(W - pad - 29 * u, by + 37 * u); ctx.stroke();
      ctx.restore();
    },
  },

  // 4. Frame break : la vidéo rétrécit dans une publication ; tes mains et ta tête sortent du cadre.
  framebreak: {
    draw(ctx, m, lt, L, W, H, o) {
      const k = Math.min(eio(lt / .5), eio((m.dur - lt) / .35)), u = W / 1080;
      const g = ctx.createRadialGradient(W / 2, H * .45, W * .1, W / 2, H * .45, H * .7);
      g.addColorStop(0, '#2a2a2e'); g.addColorStop(1, '#050506');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const sc = 1 - .36 * k, cw = W * sc, chh = H * sc * .82, cx = (W - cw) / 2, cy = H * .5 - chh / 2 + H * .02 * k;
      // Interface du post autour.
      ctx.save(); ctx.globalAlpha = k;
      rr(ctx, cx - 24 * u, cy - 110 * u, cw + 48 * u, chh + 240 * u, 34 * u, '#121214');
      ctx.fillStyle = L.P.accent; ctx.beginPath(); ctx.arc(cx + 30 * u, cy - 58 * u, 26 * u, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = fstr(SANS(700), 28 * u); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(val(m, 'handle', '@toncompte'), cx + 70 * u, cy - 58 * u);
      rr(ctx, cx + cw - 150 * u, cy - 82 * u, 150 * u, 48 * u, 24 * u, '#fff');
      ctx.fillStyle = '#111'; ctx.font = fstr(SANS(700), 24 * u); ctx.textAlign = 'center'; ctx.fillText('Suivre', cx + cw - 75 * u, cy - 57 * u);
      // Icônes : cœur, bulle, avion.
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4 * u; const iy = cy + chh + 60 * u;
      ctx.beginPath(); const hx = cx + 30 * u; ctx.moveTo(hx, iy + 14 * u); ctx.bezierCurveTo(hx - 34 * u, iy - 10 * u, hx - 14 * u, iy - 34 * u, hx, iy - 14 * u); ctx.bezierCurveTo(hx + 14 * u, iy - 34 * u, hx + 34 * u, iy - 10 * u, hx, iy + 14 * u); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + 100 * u, iy - 4 * u, 20 * u, .4, 5.9); ctx.lineTo(cx + 116 * u, iy + 18 * u); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 150 * u, iy - 18 * u); ctx.lineTo(cx + 196 * u, iy - 18 * u); ctx.lineTo(cx + 168 * u, iy + 20 * u); ctx.closePath(); ctx.stroke();
      ctx.restore();
      // La vidéo plein cadre, réduite autour du centre de la carte et coupée par la carte ; la personne subit la
      // même réduction mais sans être coupée : ce qui dépasse (mains, tête) sort de la publication.
      const ccy = cy + chh / 2;
      const place = c => { c.translate(W / 2, ccy); c.scale(sc, sc); c.translate(-W / 2, -H / 2); };
      ctx.save(); ctx.beginPath(); ctx.roundRect(cx, cy, cw, chh, 26 * u * k); ctx.clip(); place(ctx); vid(ctx, 0, 0, W, H); ctx.restore();
      const p = personOf(o);
      if (p && k > .02) { ctx.save(); place(ctx); ctx.drawImage(p, 0, 0, W, H); ctx.restore(); }
    },
  },

  // 6. Phone mockup : un téléphone avec une conversation glisse derrière ton épaule.
  phonemockup: {
    draw(ctx, m, lt, L, W, H) {
      const k = life(lt, m.dur, .5, .35), u = W / 1080;
      const pw = 400 * u, ph = 820 * u, x = W * .62 + (1 - k) * 220 * u, y = H * .2, rot = (6 - 10 * eo(lt / .6)) * Math.PI / 180;
      ctx.save(); ctx.globalAlpha = clamp(k * 1.5);
      ctx.translate(x + pw / 2, y + ph / 2); ctx.rotate(rot); ctx.translate(-pw / 2, -ph / 2);
      ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 50 * u; ctx.shadowOffsetY = 20 * u;
      rr(ctx, 0, 0, pw, ph, 64 * u, '#0b0b0b'); ctx.shadowColor = 'transparent';
      rr(ctx, 14 * u, 14 * u, pw - 28 * u, ph - 28 * u, 52 * u, '#f6f6f8');
      rr(ctx, pw / 2 - 60 * u, 28 * u, 120 * u, 34 * u, 17 * u, '#0b0b0b');
      ctx.fillStyle = '#111'; ctx.font = fstr(SANS(700), 26 * u); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(val(m, 'title', 'Assistant'), pw / 2, 110 * u);
      ctx.fillStyle = '#e4e4ea'; ctx.fillRect(30 * u, 140 * u, pw - 60 * u, 2 * u);
      const bubble = (text, right, y0, at) => {
        const q = back((lt - at) / .35); if (q <= 0) return y0;
        ctx.font = fstr(SANS(600), 24 * u);
        const lines = wrapText(ctx, text, pw * .62), lh = 32 * u, bh = lines.length * lh + 30 * u, bw = Math.max(...lines.map(l => ctx.measureText(l).width)) + 36 * u;
        const bx = right ? pw - 30 * u - bw : 30 * u;
        ctx.save(); ctx.globalAlpha *= clamp(q); ctx.translate(bx + bw / 2, y0 + bh / 2); ctx.scale(.8 + .2 * q, .8 + .2 * q); ctx.translate(-bx - bw / 2, -y0 - bh / 2);
        rr(ctx, bx, y0, bw, bh, 22 * u, right ? L.P.accent : '#fff', right ? null : '#e4e4ea', 2 * u);
        ctx.fillStyle = right && isLight(L.P.accent) ? '#111' : right ? '#fff' : '#111'; ctx.textAlign = 'left';
        lines.forEach((l, i) => ctx.fillText(l, bx + 18 * u, y0 + 15 * u + lh / 2 + i * lh));
        ctx.restore();
        return y0 + bh + 20 * u;
      };
      let yy = 170 * u;
      yy = bubble(val(m, 'msg', 'Coupe les blancs et ajoute les sous-titres'), true, yy, .45);
      yy = bubble(val(m, 'reply', 'C\'est fait. Je lance le rendu ?'), false, yy, 1.0);
      const bq = eo((lt - 1.5) / .3);
      if (bq > 0) { ctx.globalAlpha *= bq; rr(ctx, 30 * u, yy, pw - 60 * u, 64 * u, 32 * u, '#111'); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = fstr(SANS(700), 24 * u); ctx.fillText('Approuver', pw / 2, yy + 33 * u); }
      ctx.restore();
    },
  },

  // 8. Headline wall : des coupures de presse se collent sur le mur derrière toi.
  headlinewall: {
    draw(ctx, m, lt, L, W, H) {
      const k = life(lt, m.dur), u = W / 1080;
      const items = list(m, 'items', ['Ta phrase forte en gros titre', 'On en parle partout', 'Le secret enfin révélé', 'Tout le monde s\'y met']);
      const slots = [[.06, .06], [.52, .04], [.04, .3], [.56, .28], [.26, .16], [.3, .4]];
      ctx.save(); ctx.globalAlpha = k;
      items.slice(0, slots.length).forEach((t, i) => {
        const q = back((lt - .1 - i * .12) / .4);
        if (q <= 0) return;
        const [sx, sy] = slots[i], w = W * .42, x = W * sx, y = H * sy, rot = (rnd(i, 3) - .5) * .18;
        ctx.save(); ctx.translate(x + w / 2, y + 120 * u); ctx.rotate(rot); ctx.scale(.6 + .4 * q, .6 + .4 * q); ctx.globalAlpha *= clamp(q);
        const paper = i % 3 === 2 ? '#fff' : '#f1ead8', news = i % 3 !== 2;
        ctx.font = fstr(news ? SERIF : SANS(800), 40 * u);
        const lines = wrapText(ctx, t, w - 50 * u), h = lines.length * 48 * u + (news ? 90 * u : 70 * u);
        ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 24 * u; ctx.shadowOffsetY = 8 * u;
        rr(ctx, -w / 2, -h / 2, w, h, news ? 2 * u : 18 * u, paper); ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#111'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        if (news) { ctx.font = fstr(SANS(700), 16 * u); ctx.fillStyle = '#6b6457'; ctx.fillText('LA UNE', -w / 2 + 25 * u, -h / 2 + 18 * u); ctx.fillRect(-w / 2 + 25 * u, -h / 2 + 42 * u, w - 50 * u, 2 * u); }
        ctx.font = fstr(news ? SERIF : SANS(800), 40 * u); ctx.fillStyle = '#111';
        lines.forEach((l, j) => ctx.fillText(l, -w / 2 + 25 * u, -h / 2 + (news ? 58 : 30) * u + j * 48 * u));
        ctx.restore();
      });
      ctx.restore();
    },
  },

  // 10. Chart grow : l'image s'assombrit, une courbe lumineuse monte jour après jour.
  chartgrow: {
    draw(ctx, m, lt, L, W, H) {
      const k = life(lt, m.dur), u = W / 1080, A = L.P.accent;
      ctx.fillStyle = `rgba(0,0,0,${.45 * k})`; ctx.fillRect(0, 0, W, H);
      const labels = list(m, 'axis', ['L', 'M', 'M', 'J', 'V', 'S', 'D']);
      const n = labels.length, x0 = W * .1, x1 = W * .9, yb = H * .62, yt = H * .38;
      // Valeurs relatives (aucun chiffre inventé) : une montée régulière avec un petit creux.
      const vals = labels.map((_, i) => .12 + .85 * (i / (n - 1)) ** 1.6 - (i === 2 ? .06 : 0));
      const pts = vals.map((v, i) => [x0 + (x1 - x0) * i / (n - 1), yb - (yb - yt) * v]);
      ctx.save(); ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = fstr(SANS(700), 30 * u); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      labels.forEach((l, i) => ctx.fillText(l, pts[i][0], yb + 30 * u));
      const p = clamp((lt - .2) / Math.max(.8, m.dur * .55)) * (n - 1);
      // Lignes pointillées et points.
      ctx.setLineDash([6 * u, 8 * u]); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 2 * u;
      pts.forEach(([x, y], i) => { if (i <= p) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, yb + 10 * u); ctx.stroke(); } });
      ctx.setLineDash([]);
      ctx.strokeStyle = A; ctx.lineWidth = 9 * u; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.shadowColor = A; ctx.shadowBlur = 30 * u;
      ctx.beginPath(); ctx.moveTo(...pts[0]);
      for (let i = 1; i <= Math.floor(p); i++) ctx.lineTo(...pts[i]);
      const f = p - Math.floor(p), i0 = Math.floor(p);
      let head = pts[i0];
      if (i0 < n - 1) { head = [pts[i0][0] + (pts[i0 + 1][0] - pts[i0][0]) * f, pts[i0][1] + (pts[i0 + 1][1] - pts[i0][1]) * f]; ctx.lineTo(...head); }
      ctx.stroke(); ctx.shadowBlur = 0;
      pts.forEach(([x, y], i) => { const q = back((p - i) * 2); if (q > 0) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 11 * u * q, 0, 7); ctx.fill(); } });
      const cq = back((p - (n - 1.4)) * 2);
      if (cq > 0) {
        const label = val(m, 'label', 'ÇA MONTE ↗'); ctx.font = fstr(SANS(800), 30 * u);
        const w = ctx.measureText(label).width + 40 * u, [hx, hy] = pts[n - 1];
        ctx.save(); ctx.translate(Math.min(W - w / 2 - 20 * u, hx), hy - 70 * u); ctx.scale(cq, cq);
        rr(ctx, -w / 2, -28 * u, w, 56 * u, 28 * u, A); ctx.fillStyle = isLight(A) ? '#111' : '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, 2 * u);
        ctx.restore();
      }
      ctx.restore();
    },
  },

  // 11. Pull-back reveal : la caméra recule, ta vidéo était dans une fenêtre de montage.
  pullback: {
    draw(ctx, m, lt, L, W, H) {
      const T = m.dur, k = Math.min(eio((lt - .1) / .7), eio((T - lt) / .35)), u = W / 1080, A = L.P.accent;
      ctx.fillStyle = '#16161a'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalAlpha = k;
      ctx.fillStyle = '#222228'; ctx.fillRect(0, 0, W, 110 * u);
      ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(40 * u + i * 34 * u, 55 * u, 11 * u, 0, 7); ctx.fill(); });
      rr(ctx, 160 * u, 30 * u, 340 * u, 54 * u, 12 * u, '#16161a');
      ctx.fillStyle = '#ddd'; ctx.font = fstr({ family: 'Space Mono', weight: 700 }, 22 * u); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(val(m, 'file', 'mon-reel.mp4'), 180 * u, 58 * u);
      ctx.restore();
      // La vidéo passe de plein écran à une fenêtre en haut.
      const vw = W - (W - W * .58) * k, vh = H - (H - H * .5) * k, vx = (W - vw) / 2, vy = (110 * u + 30 * u) * k;
      vid(ctx, vx, vy, vw, vh, 18 * u * k, 1, .4);
      if (k <= .01) return;
      ctx.save(); ctx.globalAlpha = k;
      // Timeline avec tête de lecture.
      const ty = vy + vh + 40 * u;
      rr(ctx, 40 * u, ty, W - 80 * u, 120 * u, 14 * u, '#202026');
      for (let i = 0; i < 9; i++) rr(ctx, 60 * u + i * 106 * u, ty + 20 * u, 96 * u, 36 * u, 6 * u, i % 3 === 1 ? A : '#3a3a44');
      for (let i = 0; i < 18; i++) rr(ctx, 60 * u + i * 53 * u, ty + 70 * u, 46 * u, 26 * u, 5 * u, '#2e4b6e');
      const px = 60 * u + (W - 140 * u) * clamp(lt / T);
      ctx.fillStyle = '#fff'; ctx.fillRect(px, ty + 8 * u, 3 * u, 104 * u);
      // Assistant : étapes qui se cochent.
      const steps = list(m, 'steps', ['Transcription', 'Meilleure prise', 'Coupes', 'Sous-titres', 'Rendu']);
      const sy = ty + 160 * u;
      ctx.fillStyle = '#9a9aa6'; ctx.font = fstr(SANS(700), 24 * u); ctx.textAlign = 'left'; ctx.fillText('Montage en cours', 50 * u, sy);
      steps.forEach((s, i) => {
        const at = .8 + i * Math.max(.25, (T - 1.4) / steps.length), q = eo((lt - at) / .25), y = sy + 56 * u + i * 58 * u;
        ctx.globalAlpha = k * (.35 + .65 * clamp(q));
        ctx.fillStyle = q > .5 ? A : '#3a3a44'; ctx.beginPath(); ctx.arc(66 * u, y, 16 * u, 0, 7); ctx.fill();
        if (q > .5) { ctx.strokeStyle = isLight(A) ? '#111' : '#fff'; ctx.lineWidth = 4 * u; ctx.beginPath(); ctx.moveTo(58 * u, y); ctx.lineTo(64 * u, y + 7 * u); ctx.lineTo(75 * u, y - 7 * u); ctx.stroke(); }
        ctx.fillStyle = '#fff'; ctx.font = fstr(SANS(600), 28 * u); ctx.fillText(s, 100 * u, y + 1);
      });
      ctx.restore();
    },
  },

  // 12. Green screen : ton fond est remplacé par une interface ; le texte passe derrière toi.
  greenscreen: {
    draw(ctx, m, lt, L, W, H, o) {
      const T = m.dur, k = Math.min(eo(lt / .35), eo((T - lt) / .3)), u = W / 1080, A = L.P.accent;
      vid(ctx, 0, 0, W, H);
      ctx.save(); ctx.globalAlpha = k;
      ctx.fillStyle = '#f6f4fb'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#6c4bd8'; ctx.fillRect(0, 0, W, 170 * u);
      ctx.fillStyle = '#fff'; ctx.font = fstr(SANS(800), 34 * u); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('Focus', 50 * u, 95 * u);
      // Minuteur qui défile.
      const secs = Math.max(0, 50 * 60 - 3 - Math.floor(lt));
      ctx.font = fstr(SANS(800), 120 * u); ctx.fillStyle = '#1d1640'; ctx.textAlign = 'center';
      ctx.fillText(`${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`, W / 2, 330 * u);
      ctx.font = fstr(SANS(600), 32 * u); ctx.fillStyle = '#6b6680'; ctx.fillText(val(m, 'task', 'Écrire la page de vente'), W / 2, 420 * u);
      const rows = list(m, 'items', ['Tourner la vidéo', 'Monter le reel', 'Publier']);
      rows.forEach((r, i) => {
        const y = 500 * u + i * 92 * u;
        rr(ctx, 60 * u, y, W - 120 * u, 72 * u, 18 * u, '#fff', '#e6e2f2', 2 * u);
        ctx.strokeStyle = '#6c4bd8'; ctx.lineWidth = 4 * u; ctx.beginPath(); ctx.arc(110 * u, y + 36 * u, 16 * u, 0, 7); ctx.stroke();
        ctx.fillStyle = '#1d1640'; ctx.textAlign = 'left'; ctx.font = fstr(SANS(600), 30 * u); ctx.fillText(r, 150 * u, y + 37 * u);
      });
      // Phrase avec un mot surligné, au niveau de la poitrine (la personne passe devant).
      const text = val(m, 'text', 'il te faut du montage'), mark = val(m, 'mark', 'montage').toLowerCase();
      ctx.font = fstr(SANS(900), fitSize(ctx, text, SANS(900), W * .9, 92 * u)); ctx.textAlign = 'left';
      const words = text.split(/\s+/), widths = words.map(w => ctx.measureText(w + ' ').width), tw = widths.reduce((a, b) => a + b, 0);
      let x = (W - tw) / 2; const y = H * .66;
      words.forEach((w, i) => {
        if (w.toLowerCase().replace(/[.,!?]/g, '') === mark) { ctx.fillStyle = A; ctx.fillRect(x - 8 * u, y - 52 * u, ctx.measureText(w).width + 16 * u, 104 * u); }
        ctx.fillStyle = '#1d1640'; ctx.fillText(w, x, y); x += widths[i];
      });
      ctx.restore();
      const p = personOf(o);
      if (p) ctx.drawImage(p, 0, 0, W, H);
      else { ctx.save(); ctx.globalAlpha = k; ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 30 * u; vid(ctx, W * .52, H * .7, W * .42, H * .26, 28 * u, 1, .3); ctx.restore(); }
    },
  },

  // 13. Paper cut : collage sur papier quadrillé, toi en sticker détouré, scotch, gribouillis, lettres découpées.
  papercut: {
    draw(ctx, m, lt, L, W, H, o) {
      const T = m.dur, k = Math.min(eo(lt / .3), eo((T - lt) / .3)), u = W / 1080;
      vid(ctx, 0, 0, W, H);
      ctx.save(); ctx.globalAlpha = k;
      ctx.fillStyle = '#f3efe4'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(70,120,200,.18)'; ctx.lineWidth = 2 * u;
      for (let x = 0; x < W; x += 54 * u) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 54 * u) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      // Bandes de scotch jaune déchirées.
      [[.05, .1, -.2], [.62, .07, .25], [.1, .82, .12]].forEach(([x, y, r], i) => {
        ctx.save(); ctx.translate(W * x, H * y); ctx.rotate(r); ctx.fillStyle = 'rgba(255,214,10,.85)';
        ctx.beginPath(); ctx.moveTo(0, 0);
        for (let j = 0; j <= 10; j++) ctx.lineTo(j * 36 * u, (rnd(j, i) - .5) * 10 * u);
        for (let j = 10; j >= 0; j--) ctx.lineTo(j * 36 * u, 80 * u + (rnd(j + 20, i) - .5) * 10 * u);
        ctx.fill(); ctx.restore();
      });
      // Gribouillis qui se dessinent (tremblés à 8 images/s).
      const boil = Math.floor(lt * 8);
      ctx.lineCap = 'round'; ctx.lineWidth = 7 * u;
      [['#3d7bff', .72, .3], ['#ff5fa8', .2, .55]].forEach(([c, x, y], i) => {
        const q = clamp((lt - .3 - i * .25) / .6); if (q <= 0) return;
        ctx.strokeStyle = c; ctx.beginPath();
        const N = Math.floor(14 * q);
        for (let j = 0; j < N; j++) { const jx = W * x + (j % 2 ? 120 : -120) * u + (rnd(j + boil, i) - .5) * 8 * u, jy = H * y + j * 14 * u; j ? ctx.lineTo(jx, jy) : ctx.moveTo(jx, jy); }
        ctx.stroke();
      });
      ctx.strokeStyle = '#111'; ctx.lineWidth = 6 * u;
      const xq = clamp((lt - .6) / .3);
      if (xq > 0) { const x = W * .82, y = H * .58, d = 40 * u; ctx.beginPath(); ctx.moveTo(x - d, y - d); ctx.lineTo(x - d + 2 * d * xq, y - d + 2 * d * xq); if (xq > .5) { ctx.moveTo(x + d, y - d); ctx.lineTo(x + d - 4 * d * (xq - .5), y - d + 4 * d * (xq - .5)); } ctx.stroke(); }
      ctx.restore();
      // Toi en sticker : contour blanc épais autour de la silhouette.
      const p = personOf(o);
      if (p) {
        ctx.save(); ctx.globalAlpha = k;
        const t = 9 * u, j = (rnd(boil, 9) - .5) * 2 * u;
        ctx.filter = `drop-shadow(${t + j}px 0 0 #fff) drop-shadow(${-t}px 0 0 #fff) drop-shadow(0 ${t}px 0 #fff) drop-shadow(0 ${-t + j}px 0 #fff) drop-shadow(0 ${10 * u}px ${18 * u}px rgba(0,0,0,.35))`;
        ctx.drawImage(p, 0, 0, W, H); ctx.restore();
      } else {
        ctx.save(); ctx.globalAlpha = k; ctx.translate(W / 2, H * .45); ctx.rotate(-.04);
        rr(ctx, -W * .37, -H * .3, W * .74, H * .6, 10 * u, '#fff'); vid(ctx, -W * .35, -H * .29, W * .7, H * .58, 6 * u, 1, .35); ctx.restore();
      }
      // Lettres découpées façon lettre anonyme, qui tamponnent une à une, puis entourées en rouge.
      const word = val(m, 'text', '100%').slice(0, 8);
      const fonts = [SERIF, SANS(900), { family: 'Bebas Neue', weight: 400 }, { family: 'Space Mono', weight: 700 }, { family: 'DM Serif Display', weight: 400 }];
      const bgs = ['#fff', '#111', '#ffd60a', '#ff5fa8', '#3d7bff'];
      const size = Math.min(150 * u, W * .8 / Math.max(1, word.length)), x0 = W / 2 - word.length * size * .55 / 1, y = H * .8;
      [...word].forEach((ch, i) => {
        const q = clamp((lt - .8 - i * .14) / .18); if (q <= 0) return;
        const s = 1.8 - .8 * eo(q), x = x0 + i * size * 1.1 + size * .5, rot = (rnd(i, 5) - .5) * .28;
        ctx.save(); ctx.globalAlpha = k * clamp(q * 2); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
        const bg = bgs[i % bgs.length]; rr(ctx, -size * .5, -size * .58, size, size * 1.16, 4 * u, bg);
        ctx.fillStyle = bg === '#111' || bg === '#3d7bff' ? '#fff' : '#111';
        ctx.font = fstr(fonts[i % fonts.length], size * .8); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch, 0, size * .04);
        ctx.restore();
      });
      const cq = clamp((lt - .8 - word.length * .14 - .1) / .5);
      if (cq > 0) {
        ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 8 * u; ctx.lineCap = 'round';
        const cx = x0 + word.length * size * .55, rx = word.length * size * .62 + 30 * u, ry = size * .95;
        ctx.beginPath();
        for (let a = 0; a <= cq * Math.PI * 2.15; a += .08) { const wob = 1 + (rnd(Math.floor(a * 3), 7) - .5) * .05; const px = cx + Math.cos(a - 2) * rx * wob, py = y + Math.sin(a - 2) * ry * wob; a ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.stroke(); ctx.restore();
      }
    },
  },

  // 14. Doodle boil : un contour blanc tremblé autour de toi + petits dessins qui changent de couleur.
  doodleboil: {
    draw(ctx, m, lt, L, W, H, o) {
      const k = life(lt, m.dur, .25, .25), u = W / 1080, boil = Math.floor(lt * 10), p = personOf(o);
      if (p && k > 0) {
        const ring = outline(p, W, H, 9 * u, boil);
        ctx.save(); ctx.globalAlpha = k; ctx.drawImage(ring, (rnd(boil, 2) - .5) * 4 * u, (rnd(boil, 3) - .5) * 4 * u); ctx.restore();
      }
      const cols = ['#ffffff', '#ff5fa8', '#ffd60a'];
      ctx.save(); ctx.globalAlpha = k; ctx.lineWidth = 7 * u; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const doodles = [
        [W * .2, H * .2, 'heart'], [W * .8, H * .18, 'clap'], [W * .82, H * .55, 'rect'], [W * .15, H * .6, 'star'],
      ];
      doodles.forEach(([x, y, kind], i) => {
        const q = clamp((lt - .1 - i * .15) / .5); if (q <= 0) return;
        ctx.save(); ctx.translate(x + (rnd(boil, i) - .5) * 6 * u, y + Math.sin(lt * 1.5 + i) * 10 * u + (rnd(boil, i + 4) - .5) * 6 * u);
        ctx.rotate((rnd(boil, i + 9) - .5) * .08); ctx.strokeStyle = cols[(Math.floor(lt * 3) + i) % cols.length];
        doodle(ctx, kind, 60 * u, q); ctx.restore();
      });
      ctx.restore();
    },
  },

  // 15. Vertigo : le fond grossit (effet Hitchcock) pendant que tu restes à la même taille.
  vertigo: {
    draw(ctx, m, lt, L, W, H, o) {
      const T = m.dur, z = 1 + .3 * eio(lt / Math.max(.6, T - .2)), p = personOf(o);
      vid(ctx, 0, 0, W, H, 0, Math.max(1, z));
      if (p) ctx.drawImage(p, 0, 0, W, H);
      bigCaption(ctx, val(m, 'text'), val(m, 'mark'), W, H, life(lt, T, .3, .25), L, .8);
    },
  },

  // 16. Cover story : un titre de magazine géant derrière ta tête, dans un fin cadre.
  coverstory: {
    draw(ctx, m, lt, L, W, H, o) {
      const k = life(lt, m.dur, .4, .3), u = W / 1080, title = val(m, 'title', 'EDIT').toUpperCase();
      ctx.save(); ctx.globalAlpha = k;
      const F = { family: 'Playfair Display', weight: 700 }, fs = fitSize(ctx, title, F, W * .94, H * .2);
      ctx.font = fstr(F, fs); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = `${-fs * .02}px`;
      ctx.fillStyle = val(m, 'color', '') || '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 20 * u;
      ctx.fillText(title, W / 2, H * .06 + fs * .82 + (1 - eo(lt / .5)) * 40 * u);
      ctx.letterSpacing = '0px';
      ctx.restore();
    },
    front(ctx, m, lt, L, W, H) {
      const k = life(lt, m.dur, .4, .3), u = W / 1080;
      ctx.save(); ctx.globalAlpha = k;
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2 * u; ctx.strokeRect(28 * u, 28 * u, W - 56 * u, H - 56 * u);
      const lines = list(m, 'lines', []);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 12 * u;
      lines.slice(0, 3).forEach((l, i) => {
        ctx.font = fstr(i === 0 ? SANS(900) : SANS(600), (i === 0 ? 44 : 30) * u);
        ctx.fillText(i === 0 ? l.toUpperCase() : l, 60 * u, H * .64 + i * 60 * u, W * .45);
      });
      ctx.restore();
    },
  },

  // 17. Glass type : un énorme mot en verre dépoli, en relief, derrière toi.
  glasstype: {
    draw(ctx, m, lt, L, W, H) {
      const k = life(lt, m.dur, .45, .3), u = W / 1080, text = val(m, 'text', 'DESIGN').toUpperCase();
      const F = SANS(900), fs = fitSize(ctx, text, F, W * .95, H * .16);
      const x = W / 2, y = H * .3 + (1 - eo(lt / .6)) * 50 * u;
      // Relief et reflet flou dessous, directement sur l'image.
      ctx.save(); ctx.globalAlpha = k; ctx.font = fstr(F, fs); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 10; i > 0; i--) { ctx.fillStyle = `rgba(20,24,30,${.06 + i * .012})`; ctx.fillText(text, x + i * 2 * u, y + i * 2.4 * u); }
      ctx.filter = `blur(${Math.round(18 * u)}px)`; ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillText(text, x, y + 14 * u);
      ctx.restore();
      // Face du verre sur un calque à part (le reflet qui balaie ne touche que les lettres).
      const g = layer(W, H), c = g.getContext('2d');
      c.clearRect(0, 0, W, H); c.font = fstr(F, fs); c.textAlign = 'center'; c.textBaseline = 'middle';
      const gr = c.createLinearGradient(0, y - fs / 2, 0, y + fs / 2);
      gr.addColorStop(0, 'rgba(255,255,255,.92)'); gr.addColorStop(.55, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,.15)');
      c.fillStyle = gr; c.fillText(text, x, y);
      c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 2 * u; c.strokeText(text, x, y);
      const sweep = ((lt * .5) % 1.4) - .2;
      c.globalCompositeOperation = 'source-atop';
      const sg = c.createLinearGradient(W * sweep - W * .2, 0, W * sweep + W * .2, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(.5, 'rgba(255,255,255,.6)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = sg; c.fillRect(0, y - fs, W, fs * 2);
      c.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.globalAlpha = k; ctx.drawImage(g, 0, 0); ctx.restore();
    },
  },
};

let glassCanvas = null;
function layer(W, H) {
  if (!glassCanvas) glassCanvas = document.createElement('canvas');
  if (glassCanvas.width !== W || glassCanvas.height !== H) { glassCanvas.width = W; glassCanvas.height = H; }
  return glassCanvas;
}

// Contour de la silhouette : silhouette élargie moins la silhouette (épaisseur r), en blanc.
let ringCanvas = null;
function outline(person, W, H, r, seed) {
  if (!ringCanvas) ringCanvas = document.createElement('canvas');
  if (ringCanvas.width !== W || ringCanvas.height !== H) { ringCanvas.width = W; ringCanvas.height = H; }
  const g = ringCanvas.getContext('2d');
  g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, rr2 = r * (1 + (rnd(i + seed, 11) - .5) * .5); g.drawImage(person, Math.cos(a) * rr2, Math.sin(a) * rr2, W, H); }
  g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'destination-out'; g.drawImage(person, 0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  return ringCanvas;
}
function doodle(ctx, kind, s, q) {
  ctx.beginPath();
  if (kind === 'heart') { ctx.moveTo(0, s * .5); ctx.bezierCurveTo(-s * 1.1, -s * .2, -s * .4, -s * 1, 0, -s * .35); ctx.bezierCurveTo(s * .4, -s, s * 1.1, -s * .2, 0, s * .5); }
  if (kind === 'rect') ctx.rect(-s * .7, -s * .5, s * 1.4, s);
  if (kind === 'clap') { ctx.rect(-s * .7, -s * .2, s * 1.4, s * .8); ctx.moveTo(-s * .7, -s * .2); ctx.lineTo(-s * .55, -s * .6); ctx.lineTo(s * .75, -s * .45); ctx.lineTo(s * .7, -s * .2); }
  if (kind === 'star') for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? s * .4 : s; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.save(); ctx.setLineDash([s * 12, s * 12]); ctx.lineDashOffset = s * 12 * (1 - q); ctx.stroke(); ctx.restore();
}
function wrapText(ctx, text, maxW) {
  const out = []; let line = '';
  for (const w of String(text).split(/\s+/)) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out.slice(0, 4);
}
