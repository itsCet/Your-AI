// B-roll « une forme qui ne coupe jamais », d'après la skill motion-broll de github.com/Barty-Bart/motion-graphics (MIT).
// Une seule forme change de taille, d'arrondi et de couleur d'un état à l'autre ; son contenu s'échange avec un
// court flou ; un curseur clique pour déclencher les changements, et chaque changement tombe sur un mot dit.
// Tout est une fonction pure du temps (ressorts en forme close), donc l'aperçu et l'export sont identiques.
import { fstr, clamp } from './kit.js';

// ---------- Ressorts (réponse indicielle d'un ressort amorti, vitesse initiale nulle) ----------
const S = (tau, w, z) => {
  if (tau <= 0) return 0;
  if (!isFinite(w)) return 1;
  if (z < 1) { const wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + z * w / wd * Math.sin(wd * tau)); }
  if (z > 1 + 1e-6) { const q = w * Math.sqrt(z * z - 1), r1 = -z * w + q, r2 = -z * w - q; return 1 - (r2 * Math.exp(r1 * tau) - r1 * Math.exp(r2 * tau)) / (r2 - r1); }
  return 1 - Math.exp(-w * tau) * (1 + w * tau);
};
const MORPH = [15, .84], FAST = [27, .86], CAM = [7.5, 1];
// Une valeur qui change de cible plusieurs fois = la somme d'un ressort par changement.
const track = (v0, keys, def = MORPH) => t => {
  let v = v0, prev = v0;
  for (const [kt, kv, sp] of keys) { const d = kv - prev; prev = kv; if (d) v += d * S(t - kt, ...(sp || def)); }
  return v;
};
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const ctrack = (h0, keys) => { const c0 = hex(h0); const tr = [0, 1, 2].map(i => track(c0[i], keys.map(([t, h]) => [t, hex(h)[i]]), [20, 1])); return t => `rgb(${tr.map(f => Math.round(clamp(f(t), 0, 255))).join(',')})`; };
const eo = x => { x = clamp(x); return 1 - (1 - x) ** 3; };
const eio = x => { x = clamp(x); return x * x * x * (x * (6 * x - 15) + 10); };
// Échange de contenu : la sortie floute vite, l'entrée attend un peu puis arrive en se défloutant.
function vis(t, tin, tout, o = {}) {
  const din = o.din ?? .07, lin = o.lin ?? .26, lout = o.lout ?? .12, bl = o.blur ?? 12;
  const a = tin == null ? 1 : eo((t - tin - din) / lin);
  const b = tout == null ? 0 : eo((t - tout) / lout);
  return { o: a * (1 - b), blur: (1 - a) * bl + b * bl * .8, s: (.94 + .06 * a) * (1 - .03 * b) };
}
// Chemin du curseur entre des points clés, avec un léger arc « humain ».
const path = K => t => {
  if (t <= K[0][0]) return { x: K[0][1], y: K[0][2] };
  const L = K[K.length - 1]; if (t >= L[0]) return { x: L[1], y: L[2] };
  let i = 0; while (t >= K[i + 1][0]) i++;
  const [t0, x0, y0] = K[i], [t1, x1, y1] = K[i + 1];
  const u = eio((t - t0) / (t1 - t0)), dx = x1 - x0, dy = y1 - y0, arc = Math.sin(Math.PI * u) * .06;
  return { x: x0 + dx * u - dy * arc, y: y0 + dy * u + dx * arc };
};
const presses = clicks => track(0, clicks.flatMap(c => [[c - .07, 1, [45, 1]], [c + .035, 0, [22, .72]]]));

// Couleurs du style motion-broll : toile gris chaud, encre noire, composants blancs, un accent (celui du look).
const CANVAS = '#E9E7E2', INK = '#0B0B0B', MUTED = '#8A8782', LINE = '#E2DFD9';

const val = (m, k, d = '') => (m.f && m.f[k] != null && m.f[k] !== '' ? m.f[k] : d);
const list = (m, k) => { const v = val(m, k, []); return (Array.isArray(v) ? v : String(v).split('\n')).map(x => String(x).trim()).filter(Boolean); };

// Moteur d'une scène : états de la forme (w, h, r, bg, cam en unités « monde », 1 unité = 1/1080 de la largeur),
// séquence [[t, état]], calques de contenu. Dessine tout à l'instant t.
function scene(ctx, W, H, t, cfg) {
  const u = W / 1080, SH = cfg.SH, P0 = SH[cfg.start];
  const tr = k => track(P0[k], cfg.SEQ.map(([st, n]) => [st, SH[n][k]]));
  const g = { w: tr('w')(t), h: tr('h')(t), r: tr('r')(t), bg: ctrack(P0.bg, cfg.SEQ.map(([st, n]) => [st, SH[n].bg]))(t),
    cam: track(P0.cam, cfg.SEQ.map(([st, n]) => [st, SH[n].cam]), CAM)(t) };
  const press = cfg.cursor ? presses(cfg.cursor.clicks)(t) : 0;
  const ia = S(t - (cfg.intro ?? .05), 13, .78);
  let sc = (1 - .035 * press) * (.55 + .45 * ia), op = clamp((t - (cfg.intro ?? .05)) / .12);
  // Sortie : la forme se replie vite (la vidéo revient ensuite en coupe franche).
  const out = cfg.T - t < .28 ? eo((t - (cfg.T - .28)) / .28) : 0;
  sc *= 1 - .25 * out; op *= 1 - out;
  g.r = Math.min(g.r, g.h / 2, g.w / 2);
  ctx.save();
  ctx.fillStyle = CANVAS; ctx.fillRect(0, 0, W, H);
  // Monde → écran : centre de l'écran + cam × position.
  ctx.translate(W / 2, H * (cfg.cy ?? .5)); ctx.scale(g.cam * u, g.cam * u);
  ctx.save(); ctx.globalAlpha = op; ctx.scale(sc, sc);
  ctx.shadowColor = 'rgba(0,0,0,.10)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
  ctx.fillStyle = g.bg; ctx.beginPath(); ctx.roundRect(-g.w / 2, -g.h / 2, g.w, g.h, g.r); ctx.fill();
  ctx.shadowColor = 'transparent';
  for (const L of cfg.layers) {
    const v = vis(t, L.tin, L.tout, L.o);
    if (v.o < .003) continue;
    ctx.save(); ctx.globalAlpha = op * v.o;
    if (v.blur > .05) ctx.filter = `blur(${(v.blur * g.cam * u).toFixed(1)}px)`;
    const ay = L.anchor === 't' ? -g.h / 2 : 0;
    ctx.translate(0, ay); ctx.scale(v.s, v.s);
    L.draw(ctx, t, g);
    ctx.restore();
  }
  ctx.restore();
  // Curseur : taille constante à l'écran.
  if (cfg.cursor) {
    const c = path(cfg.cursor.keys)(t), k = 1 / g.cam;
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(k * (1 - .13 * press), k * (1 - .13 * press)); ctx.globalAlpha = op;
    cursorArrow(ctx, 46);
    ctx.restore();
  }
  ctx.restore();
}
function cursorArrow(ctx, s) {
  const p = new Path2D('M2 2 L2 30 L9.5 23 L14.5 34 L19.5 32 L14.5 21 L24.5 21 Z');
  ctx.save(); ctx.scale(s / 36, s / 36);
  ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#fff'; ctx.fill(p); ctx.shadowColor = 'transparent';
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.stroke(p);
  ctx.restore();
}
function icon(ctx, name, x, y, size, color, sw = 2.2) {
  const IC = { arrow: ['M5 12h14', 'M13 5l7 7-7 7'], check: ['M20 6 9 17l-5-5'] };
  ctx.save(); ctx.translate(x - size / 2, y - size / 2); ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color; ctx.lineWidth = sw * 24 / size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const d of IC[name]) ctx.stroke(new Path2D(d));
  ctx.restore();
}
// Police Geist (SIL OFL, fournie avec la skill motion-broll), comme dans les clips d'origine.
const font = (L, size, w = 600) => fstr({ family: 'Geist', weight: w }, size);

export const MORPH_DEFS = {
  // Bouton → clic → carte dont les lignes se cochent sur les mots.
  morph: {
    init: {}, build() {},
    draw(ctx, s, m, L, W, H, lt) {
      const items = list(m, 'items').slice(0, 6), title = val(m, 'title', ''), pill = val(m, 'pill', title || 'Voir');
      const A = L.P.accent, T = m.dur;
      ctx.font = font(L, 34); const pw = Math.min(560, ctx.measureText(pill).width + 130);
      const tClick = Math.min(.9, T * .25);
      const rowH = 100, ch = 160 + items.length * rowH + 40;
      const times = items.map((_, i) => clamp(m.times?.[i] ?? tClick + .5 + i * Math.min(.55, (T - tClick - 1) / Math.max(1, items.length)), tClick + .35, T - .5));
      scene(ctx, W, H, lt, {
        T, intro: .05, start: 'pill', SEQ: [[tClick, 'card']],
        SH: { pill: { w: pw, h: 92, r: 46, bg: INK, cam: 1.9 }, card: { w: 680, h: ch, r: 40, bg: '#FFFFFF', cam: 1.32 } },
        cursor: { clicks: [tClick], keys: [[0, 330, 420], [tClick - .55, 330, 420], [tClick - .08, pw / 2 - 60, 10], [tClick + .5, pw / 2 - 40, 30], [tClick + 1.1, 420, 520]] },
        layers: [
          { tin: .05, tout: tClick, o: { din: .03 }, draw(c) {
            c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = font(L, 34); c.fillStyle = '#fff';
            c.fillText(pill, -22, 2, pw - 110); icon(c, 'arrow', pw / 2 - 52, 0, 30, '#fff');
          } },
          { tin: tClick, tout: null, anchor: 't', draw(c, t) {
            c.textBaseline = 'middle'; c.textAlign = 'left';
            if (title) { c.font = font(L, 32, 500); c.fillStyle = MUTED; c.fillText(title, -300, 74, 600); }
            c.fillStyle = LINE; c.fillRect(-300, 122, 600, 2);
            items.forEach((it, i) => {
              const v = vis(t, times[i], null, { din: .02, lin: .3 });
              if (v.o < .003) return;
              const y = 160 + i * rowH + rowH / 2, done = S(t - times[i] - .12, 17, .62);
              c.save(); c.globalAlpha *= v.o; c.translate(0, (1 - v.s) * 120);
              c.fillStyle = done > .02 ? A : '#fff'; c.strokeStyle = done > .02 ? A : '#C9C5BE'; c.lineWidth = 3;
              c.beginPath(); c.arc(-272, y, 26 * (done > .02 ? clamp(.6 + .4 * done, 0, 1.15) : 1), 0, 7); c.fill(); c.stroke();
              if (done > .02) icon(c, 'check', -272, y, 30, '#fff', 3.2);
              c.fillStyle = INK; c.font = font(L, fitFont(c, it, L, 510, 42));
              c.fillText(it, -222, y + 1, 520);
              c.restore();
            });
          } },
        ],
      });
    },
  },
  // Carte chapitre : « À suivre → » puis un grand numéro et le titre.
  chapter: {
    init: {}, build() {},
    draw(ctx, s, m, L, W, H, lt) {
      const num = val(m, 'num', '01'), title = val(m, 'title', 'La suite'), sub = val(m, 'sub', ''), A = L.P.accent;
      const tSw = Math.min(.95, m.dur * .33);
      ctx.font = font(L, 64); const tw = Math.min(560, ctx.measureText(title).width);
      const cw = Math.max(520, Math.min(900, 200 + tw + 120));
      scene(ctx, W, H, lt, {
        T: m.dur, intro: .08, start: 'next', SEQ: [[tSw, 'ch']],
        SH: { next: { w: 260, h: 92, r: 46, bg: INK, cam: 2.0 }, ch: { w: cw, h: 300, r: 48, bg: INK, cam: Math.min(1.5, 980 / cw) } },
        layers: [
          { tin: .08, tout: tSw, o: { din: .03 }, draw(c) {
            c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = font(L, 32, 500); c.fillStyle = '#fff';
            c.fillText('À suivre', -22, 2); icon(c, 'arrow', 72, 0, 30, '#fff');
          } },
          { tin: tSw, tout: null, draw(c) {
            const x0 = -cw / 2 + 60;
            c.textBaseline = 'alphabetic'; c.textAlign = 'left';
            c.font = font(L, 150, 600); c.letterSpacing = '-7px'; c.fillStyle = A; c.fillText(num, x0, 62);
            const nx = x0 + c.measureText(num).width + 36;
            c.letterSpacing = '0px';
            c.font = font(L, fitFont(c, title, L, cw - (nx - x0) - 120, 60)); c.fillStyle = '#fff'; c.fillText(title, nx, sub ? -2 : 20);
            if (sub) { c.font = font(L, 28, 400); c.fillStyle = '#9A9791'; c.fillText(sub, nx + 2, 50, cw - (nx - x0) - 120); }
          } },
        ],
      });
    },
  },
};
function fitFont(c, text, L, maxW, size) {
  c.font = font(L, size);
  const w = c.measureText(text).width;
  return w > maxW ? Math.max(size * .55, size * maxW / w) : size;
}
