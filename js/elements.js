// Éléments et motions dessinés sur la vidéo, dans les couleurs et les polices du look.
// Chaque type : init (état de départ), build (chorégraphie GSAP), draw (dessin à partir de l'état).
// m = { type, uid, start, dur, f: { champs texte }, variant, times? (instants des lignes), turn? }
// L = { P palette, D police titre, B police texte, Hd police d'accent (manuscrite si le look en a une), caps }
import { fstr, fitSize, wrap, clamp, drawVideoRect, drawFit, isLight, warmBg, pill } from './kit.js';
import { MORPH_DEFS } from './morph.js';
import { ez, stateAt, handRing, handLine, marker, checkMark, softCard } from './anim.js';

// Éléments qui passent derrière la personne (effet profondeur), et ceux qui recouvrent tout l'écran.
export const DEPTH_BEHIND = new Set(['kinetic', 'beat', 'counter', 'wordreveal', 'screen']);
export const FULLSCREEN = new Set(['kinetic', 'beat', 'morph', 'chapter']);
// Éléments qui occupent le centre : les sous-titres se masquent pendant ce temps.
export const HIDES_CAPTIONS = new Set(['morph', 'chapter', 'kinetic', 'beat', 'counter', 'wordreveal', 'shrink', 'colorcard']);
// Éléments qui floutent et assombrissent la vidéo derrière eux.
export const DIMS = new Set(['statcard']);

const val = (m, k, d = '') => (m.f && m.f[k] != null && m.f[k] !== '' ? m.f[k] : d);
const list = (m, k) => { const v = val(m, k, []); return (Array.isArray(v) ? v : String(v).split('\n')).map(x => String(x).trim()).filter(Boolean); };
const tx = (L, s) => L.caps ? s.toUpperCase() : s;
const exitAt = m => Math.max(.4, m.dur - .32);

// Texte avec ombre portée douce (lisible sur n'importe quelle vidéo).
function shadowed(ctx, text, x, y, W, a = .5) {
  ctx.save(); ctx.shadowColor = `rgba(0,0,0,${a})`; ctx.shadowBlur = W * .025; ctx.shadowOffsetY = W * .004;
  ctx.fillText(text, x, y); ctx.restore();
}

const DEFS = {
  // ---------------- Éléments ----------------
  note: {
    init: { a: 0, sc: .6, ring: 0 },
    build: (tl, s, m) => tl
      .to(s, { a: 1, sc: 1, duration: .4, ease: 'back.out(2.2)' }, 0)
      .to(s, { ring: 1, duration: .6, ease: 'power2.inOut' }, .12)
      .to(s, { a: 0, sc: .85, duration: .3, ease: 'power2.in' }, exitAt(m)),
    draw(ctx, s, m, L, W, H) {
      const text = val(m, 'text', 'à retenir'), F = L.Hd;
      const cx = m.variant % 2 ? W * .28 : W * .72, cy = H * .44, r = W * .15;
      ctx.save(); ctx.globalAlpha = clamp(s.a);
      ctx.translate(cx, cy); ctx.rotate(-.08); ctx.scale(s.sc, s.sc);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let fs = r * .42; ctx.font = fstr(F, fs);
      let lines = wrap(ctx, text, r * 1.6);
      while (lines.length > 3 && fs > r * .22) { fs *= .88; ctx.font = fstr(F, fs); lines = wrap(ctx, text, r * 1.6); }
      ctx.fillStyle = '#fff';
      lines.slice(0, 3).forEach((l, i) => shadowed(ctx, l, 0, (i - (Math.min(3, lines.length) - 1) / 2) * fs * 1.05, W, .6));
      handRing(ctx, 0, 0, r * 1.08, r * .82, s.ring, L.P.accent, W * .009, m.uid % 7 || 3);
      ctx.restore();
    },
  },

  colorcard: {
    init: { a: 0, y: 1, rot: .14, sc: .82, words: 0 },
    build: (tl, s, m) => tl
      .to(s, { a: 1, y: 0, rot: -.035, sc: 1, duration: .65, ease: 'back.out(1.3)' }, 0)
      .to(s, { words: 1, duration: .55, ease: 'power2.out' }, .28)
      .to(s, { a: 0, y: -.25, sc: .92, duration: .32, ease: 'power2.in' }, exitAt(m)),
    draw(ctx, s, m, L, W, H) {
      const text = val(m, 'top', 'mot clé'), P = L.P;
      const w = W * .6, h = w * 1.22;
      ctx.save(); ctx.globalAlpha = clamp(s.a);
      ctx.translate(W / 2, H * .43 + s.y * H * .3); ctx.rotate((m.variant % 2 ? -1 : 1) * s.rot); ctx.scale(s.sc, s.sc);
      softCard(ctx, -w / 2, -h / 2, w, h, w * .03, P.accent, { shadow: .4 });
      const F = L.Hd;
      ctx.fillStyle = isLight(P.accent) ? P.ink === '#FFFFFF' ? '#111' : P.ink : '#fff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let fs = w * .2; ctx.font = fstr(F, fs);
      let lines = wrap(ctx, tx(L, text), w * .8);
      while (lines.length > 4 && fs > w * .08) { fs *= .88; ctx.font = fstr(F, fs); lines = wrap(ctx, tx(L, text), w * .8); }
      const words = lines.join(' ').split(' ').length;
      let k = 0;
      lines.forEach((l, i) => {
        const y = (i - (lines.length - 1) / 2) * fs * 1.1;
        let x = -ctx.measureText(l).width / 2;
        for (const wd of l.split(' ')) {
          const p = clamp(s.words * words - k++);
          ctx.globalAlpha = clamp(s.a) * p;
          const ww = ctx.measureText(wd + ' ').width;
          ctx.textAlign = 'left'; ctx.fillText(wd, x, y + (1 - p) * fs * .35);
          x += ww;
        }
      });
      ctx.restore();
    },
  },

  stamp: {
    init: { a: 0, sc: 2.6, rot: -.4, shake: 1 },
    build: (tl, s, m) => tl
      .to(s, { a: 1, sc: 1, rot: -.13, duration: .22, ease: 'expo.in' }, 0)
      .to(s, { shake: 0, duration: .35, ease: 'power1.out' }, .22)
      .to(s, { a: 0, duration: .25, ease: 'power2.in' }, exitAt(m)),
    draw(ctx, s, m, L, W, H, lt) {
      const text = val(m, 'text', 'important').toUpperCase(), P = L.P;
      const j = s.sc <= 1.01 ? Math.sin(lt * 90) * s.shake * W * .008 : 0;
      ctx.save(); ctx.globalAlpha = clamp(s.a);
      ctx.translate((m.variant % 2 ? W * .3 : W * .7) + j, H * .3 + j * .5); ctx.rotate(s.rot * (m.variant % 2 ? -1 : 1)); ctx.scale(s.sc, s.sc);
      const fs = fitSize(ctx, text, L.D, W * .42, W * .07);
      ctx.font = fstr(L.D, fs);
      const tw = ctx.measureText(text).width + fs * 1.1, th = fs * 1.75;
      const light = m.variant % 2 === 1;
      ctx.fillStyle = light ? '#fff' : P.accent;
      ctx.beginPath(); ctx.roundRect(-tw / 2, -th / 2, tw, th, fs * .12); ctx.fill();
      const ink = light ? '#111' : (isLight(P.accent) ? '#111' : '#fff');
      ctx.strokeStyle = ink; ctx.lineWidth = fs * .09;
      ctx.beginPath(); ctx.roundRect(-tw / 2 + fs * .16, -th / 2 + fs * .16, tw - fs * .32, th - fs * .32, fs * .08); ctx.stroke();
      ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, fs * .06);
      ctx.restore();
    },
  },

  statcard: {
    init: { a: 0, sc: .86, blur: 1, v: 0, chip: 0 },
    build: (tl, s, m) => tl
      .to(s, { a: 1, sc: 1, blur: 0, duration: .6, ease: 'expo.out' }, 0)
      .to(s, { v: 1, duration: 1.3, ease: 'power3.out' }, .15)
      .to(s, { chip: 1, duration: .45, ease: 'back.out(2)' }, .55)
      .to(s, { a: 0, sc: .94, duration: .3, ease: 'power2.in' }, exitAt(m)),
    draw(ctx, s, m, L, W, H) {
      const P = L.P, label = val(m, 'label', ''), raw = String(val(m, 'value', '0')), unit = val(m, 'unit', '');
      const w = W * .76, h = H * .32, x = (W - w) / 2, y = H * .1;
      const num = raw.match(/\d+(?:[.,]\d+)?/);
      let shown = raw;
      if (num) {
        const n = parseFloat(num[0].replace(',', '.')), cur = n * s.v;
        const f = Number.isInteger(n) ? Math.round(cur).toLocaleString('fr-FR').replace(/[  ]/g, ' ') : cur.toFixed(1).replace('.', ',');
        shown = raw.replace(num[0], f);
      }
      ctx.save(); ctx.globalAlpha = clamp(s.a);
      if (s.blur > .01) ctx.filter = `blur(${(s.blur * W * .02).toFixed(1)}px)`;
      ctx.translate(W / 2, y + h / 2); ctx.scale(s.sc, s.sc); ctx.translate(-W / 2, -(y + h / 2));
      softCard(ctx, x, y, w, h, w * .05, P.card, { shadow: .5, stroke: P.accent, lw: Math.max(2, W * .004) });
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (label) {
        ctx.font = fstr(L.B, W * .026); ctx.letterSpacing = `${W * .006}px`; ctx.fillStyle = 'rgba(255,255,255,.7)';
        ctx.fillText(label.toUpperCase().slice(0, 40), W / 2, y + h * .15); ctx.letterSpacing = '0px';
      }
      const fs = fitSize(ctx, tx(L, shown), L.D, w * .84, h * .48);
      ctx.font = fstr(L.D, fs); ctx.fillStyle = '#fff';
      ctx.shadowColor = P.accent; ctx.shadowBlur = W * .03;
      ctx.fillText(tx(L, shown), W / 2, y + h * .5);
      ctx.shadowBlur = 0;
      if (unit && s.chip > 0) {
        ctx.save(); ctx.translate(W / 2, y + h * .82); ctx.scale(s.chip, s.chip);
        pill(ctx, 0, 0, unit, { size: W * .026, bg: P.accent, fg: isLight(P.accent) ? '#111' : '#fff', align: 'center', border: null });
        ctx.restore();
      }
      ctx.restore();
    },
  },

  checklist: {
    init: m => {
      const s = { a: 0, y: 1 };
      list(m, 'items').forEach((_, i) => { s['r' + i] = 0; s['c' + i] = 0; });
      return s;
    },
    build: (tl, s, m) => {
      const items = list(m, 'items');
      tl.to(s, { a: 1, y: 0, duration: .5, ease: 'expo.out' }, 0);
      items.forEach((_, i) => {
        const at = clamp(m.times?.[i] ?? .35 + i * Math.min(.6, (m.dur - 1) / Math.max(1, items.length)), .1, m.dur - .5);
        tl.to(s, { ['r' + i]: 1, duration: .5, ease: 'expo.out' }, at).to(s, { ['c' + i]: 1, duration: .4, ease: 'power2.out' }, at + .15);
      });
      tl.to(s, { a: 0, y: -.4, duration: .32, ease: 'power2.in' }, exitAt(m));
    },
    draw(ctx, s, m, L, W, H) {
      const P = L.P, title = val(m, 'title', ''), items = list(m, 'items');
      const fs = W * .038, rh = fs * 2.15, w = W * .7, x = W * .06, y = H * .065 + s.y * H * .03;
      const h = (title ? fs * 2.4 : fs * .8) + items.length * rh + fs * .4;
      ctx.save(); ctx.globalAlpha = clamp(s.a);
      softCard(ctx, x, y, w, h, fs * .7, P.card, { shadow: .45 });
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      if (title) {
        ctx.font = fstr(L.D, fs * .9); ctx.fillStyle = P.accent;
        ctx.fillText(tx(L, title).slice(0, 34), x + fs * .9, y + fs * 1.3);
      }
      items.forEach((it, i) => {
        const r = s['r' + i], c = s['c' + i];
        if (r <= 0) return;
        const ry = y + (title ? fs * 2.4 : fs * .8) + i * rh + rh / 2;
        ctx.save(); ctx.globalAlpha = clamp(s.a) * clamp(r);
        const bx = x + fs * 1.5;
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = fs * .1;
        ctx.beginPath(); ctx.arc(bx, ry, fs * .55, 0, 7); ctx.stroke();
        if (c > 0) {
          ctx.fillStyle = P.accent; ctx.beginPath(); ctx.arc(bx, ry, fs * .55 * Math.min(1, c * 1.4), 0, 7); ctx.fill();
          checkMark(ctx, bx, ry, fs * .62, clamp((c - .3) / .7), isLight(P.accent) ? '#111' : '#fff', fs * .13);
        }
        const f2 = fitSize(ctx, it, L.B, w - fs * 3.3, fs * .9);
        ctx.font = fstr(L.B, f2); ctx.fillStyle = '#fff';
        ctx.fillText(it, bx + fs * 1.15 + (1 - r) * fs * 1.5, ry + f2 * .04);
        ctx.restore();
      });
      ctx.restore();
    },
  },

  versus: {
    init: { a: 0, bad: 0, strike: 0, good: 0 },
    build: (tl, s, m) => {
      const turn = clamp(m.turn ?? m.dur * .38, .5, m.dur - 1);
      tl.to(s, { a: 1, duration: .4, ease: 'expo.out' }, 0)
        .to(s, { bad: 1, duration: .5, ease: 'expo.out' }, .1)
        .to(s, { strike: 1, duration: .4, ease: 'power2.inOut' }, turn)
        .to(s, { good: 1, duration: .55, ease: 'back.out(1.6)' }, turn + .2)
        .to(s, { a: 0, duration: .3, ease: 'power2.in' }, exitAt(m));
    },
    draw(ctx, s, m, L, W, H) {
      const P = L.P, bad = val(m, 'bad', ''), good = val(m, 'good', '');
      const w = W * .8, fs = W * .05, rh = fs * 2.2, x = (W - w) / 2, y = H * .16;
      ctx.save(); ctx.globalAlpha = clamp(s.a);
      softCard(ctx, x, y, w, rh * 2 + fs * .8, fs * .6, P.card, { shadow: .45 });
      const row = (text, yy, ok, k) => {
        if (k <= 0) return;
        ctx.save(); ctx.globalAlpha = clamp(s.a) * clamp(k);
        const cx = x + fs * 1.15, off = (1 - k) * fs * 1.2;
        ctx.fillStyle = ok ? P.accent : '#FF5A4F'; ctx.beginPath(); ctx.arc(cx, yy, fs * .52, 0, 7); ctx.fill();
        const ic = ok ? (isLight(P.accent) ? '#111' : '#fff') : '#fff';
        if (ok) checkMark(ctx, cx, yy, fs * .6, 1, ic, fs * .13);
        else { ctx.strokeStyle = ic; ctx.lineWidth = fs * .12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx - fs * .2, yy - fs * .2); ctx.lineTo(cx + fs * .2, yy + fs * .2); ctx.moveTo(cx + fs * .2, yy - fs * .2); ctx.lineTo(cx - fs * .2, yy + fs * .2); ctx.stroke(); }
        const f = fitSize(ctx, text, L.B, w - fs * 3, fs);
        ctx.font = fstr(L.B, f); ctx.fillStyle = ok ? '#fff' : 'rgba(255,255,255,.62)'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        const tx0 = cx + fs * .95 + off;
        ctx.fillText(text, tx0, yy + f * .04);
        if (!ok) handLine(ctx, tx0 - fs * .1, yy, tx0 + ctx.measureText(text).width + fs * .1, s.strike, '#FF5A4F', fs * .13, 2, .01);
        ctx.restore();
      };
      row(bad, y + fs * .4 + rh / 2, false, s.bad);
      row(good, y + fs * .4 + rh * 1.5, true, s.good);
      ctx.restore();
    },
  },

  emoji: {
    init: { sc: 0, a: 0, pill: 0 },
    build: (tl, s, m) => tl
      .to(s, { a: 1, duration: .15 }, 0)
      .to(s, { sc: 1, duration: .9, ease: 'elastic.out(1, 0.55)' }, 0)
      .to(s, { pill: 1, duration: .4, ease: 'back.out(2)' }, .25)
      .to(s, { a: 0, sc: .6, duration: .28, ease: 'power2.in' }, exitAt(m)),
    draw(ctx, s, m, L, W, H, lt) {
      const P = L.P, em = val(m, 'emoji', '💡'), word = val(m, 'word', '');
      const r = W * .14, bob = Math.sin(lt * 2.6) * W * .006;
      ctx.save(); ctx.globalAlpha = clamp(s.a);
      ctx.translate(m.variant % 2 ? W * .24 : W * .76, H * .35 + bob); ctx.scale(Math.max(0, s.sc), Math.max(0, s.sc));
      softCard(ctx, -r, -r, r * 2, r * 2, r, '#fff', { shadow: .3 });
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `${Math.round(r * 1.12)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.fillText(em, 0, r * .07);
      if (word && s.pill > 0) {
        ctx.save(); ctx.translate(0, r * 1.38); ctx.scale(s.pill, s.pill);
        ctx.font = fstr(L.Hd, W * .05); const tw = ctx.measureText(word).width + W * .05;
        ctx.fillStyle = P.accent; ctx.beginPath(); ctx.roundRect(-tw / 2, -W * .038, tw, W * .076, W * .038); ctx.fill();
        ctx.fillStyle = isLight(P.accent) ? '#111' : '#fff'; ctx.fillText(word, 0, W * .004);
        ctx.restore();
      }
      ctx.restore();
    },
  },

  screen: {
    init: { a: 0, y: 1, sc: .94, rows: 0 },
    build: (tl, s, m) => tl
      .to(s, { a: 1, y: 0, sc: 1, duration: .7, ease: 'expo.out' }, 0)
      .to(s, { rows: 1, duration: .8, ease: 'power2.out' }, .35)
      .to(s, { a: 0, y: .3, duration: .35, ease: 'power2.in' }, exitAt(m)),
    draw(ctx, s, m, L, W, H) {
      const P = L.P, title = val(m, 'title', 'Mon appli'), lines = list(m, 'lines');
      const w = W * .82, h = H * .34, x = (W - w) / 2, y = H * .08 + s.y * H * .25;
      ctx.save(); ctx.globalAlpha = clamp(s.a);
      ctx.translate(W / 2, y + h / 2); ctx.scale(s.sc, s.sc); ctx.translate(-W / 2, -(y + h / 2));
      softCard(ctx, x, y, w, h, W * .025, '#FFFFFF', { shadow: .45 });
      const bar = H * .035;
      ctx.fillStyle = '#F1F1F3'; ctx.beginPath(); ctx.roundRect(x, y, w, bar, [W * .025, W * .025, 0, 0]); ctx.fill();
      ['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + W * .04 + i * W * .03, y + bar / 2, W * .009, 0, 7); ctx.fill(); });
      ctx.fillStyle = '#555'; ctx.font = fstr(L.B, W * .024); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(title.slice(0, 40), W / 2, y + bar / 2);
      const cy = y + bar, ch = h - bar;
      if (m.mediaEl) drawFit(ctx, m.mediaEl, x + W * .02, cy + W * .02, w - W * .04, ch - W * .04, { mode: 'contain' });
      else {
        const fs = W * .034;
        ctx.textAlign = 'left';
        (lines.length ? lines : [title]).slice(0, 5).forEach((l, i) => {
          const k = clamp(s.rows * (lines.length || 1) - i);
          if (k <= 0) return;
          const ly = cy + fs * 1.6 + i * fs * 2;
          ctx.globalAlpha = clamp(s.a) * k;
          ctx.fillStyle = P.accent === '#FFFFFF' ? '#111' : P.accent; ctx.beginPath(); ctx.roundRect(x + fs * .9, ly - fs * .45, fs * .9, fs * .9, fs * .2); ctx.fill();
          ctx.fillStyle = '#1b1b1b'; ctx.font = fstr(L.B, fs);
          ctx.fillText(l.slice(0, 44), x + fs * 2.3 + (1 - k) * fs, ly + fs * .05);
        });
      }
      ctx.restore();
    },
  },

  lower: {
    init: { bar: 0, wipe: 0 },
    build: (tl, s, m) => tl
      .to(s, { bar: 1, duration: .35, ease: 'expo.out' }, 0)
      .to(s, { wipe: 1, duration: .55, ease: 'expo.out' }, .12)
      .to(s, { wipe: 0, duration: .3, ease: 'power2.in' }, exitAt(m))
      .to(s, { bar: 0, duration: .2, ease: 'power2.in' }, exitAt(m) + .15),
    draw(ctx, s, m, L, W, H) {
      const P = L.P, name = val(m, 'name', 'Ton nom'), role = val(m, 'role', '');
      const fs = W * .065, x = W * .07, y = H * .8;
      ctx.save();
      ctx.font = fstr(L.D, fs); const nw = ctx.measureText(tx(L, name)).width;
      ctx.font = fstr(L.Hd, fs * .55); const rw = ctx.measureText(role).width;
      const w = Math.max(nw, rw) + fs * .6, h = fs * (role ? 2 : 1.25);
      ctx.fillStyle = P.accent; ctx.fillRect(x, y - h / 2 + h * (1 - s.bar) / 2, fs * .14, h * s.bar);
      ctx.beginPath(); ctx.rect(x + fs * .3, y - h, w * s.wipe, h * 2); ctx.clip();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
      ctx.font = fstr(L.D, fs); shadowed(ctx, tx(L, name), x + fs * .45, y - (role ? fs * .32 : 0), W);
      if (role) { ctx.fillStyle = P.accent; ctx.font = fstr(L.Hd, fs * .55); shadowed(ctx, role, x + fs * .47, y + fs * .55, W); }
      ctx.restore();
    },
  },

  // ---------------- Motion ----------------
  orbit: {
    init: { spread: 0, a: 0, ang: 0 },
    build: (tl, s, m) => tl
      .to(s, { a: 1, duration: .3 }, 0)
      .to(s, { spread: 1, duration: .8, ease: 'expo.out' }, 0)
      .to(s, { ang: 1, duration: m.dur, ease: 'sine.inOut' }, 0)
      .to(s, { spread: 0, a: 0, duration: .4, ease: 'power2.in' }, exitAt(m) - .1),
    draw(ctx, s, m, L, W, H, lt, o) {
      const N = 6, P = L.P, photos = o.photos || [];
      const items = [...Array(N)].map((_, i) => { const th = i / N * Math.PI * 2 + s.ang * Math.PI * 2.2 * (m.variant % 2 ? -1 : 1); return { i, th, z: Math.sin(th) }; }).sort((a, b) => a.z - b.z);
      for (const it of items) {
        const d = (it.z + 1) / 2, sc = .7 + .32 * d, w = W * .17 * sc, h = w * 1.22;
        ctx.save(); ctx.globalAlpha = clamp(s.a) * (.45 + .55 * d);
        ctx.translate(W / 2 + Math.cos(it.th) * W * .37 * s.spread, H * .6 + it.z * H * .05); ctx.rotate(Math.cos(it.th) * .16);
        polaroid(ctx, w, h, photos[it.i % (photos.length || 1)], it.i % 3 === 2 ? P.accent : '#fff');
        ctx.restore();
      }
    },
  },

  carousel: {
    init: { x: 0, a: 0 },
    build: (tl, s, m) => tl
      .to(s, { a: 1, duration: .25 }, 0)
      .to(s, { x: 1, duration: m.dur, ease: 'power2.inOut' }, 0)
      .to(s, { a: 0, duration: .25 }, m.dur - .25),
    draw(ctx, s, m, L, W, H, lt, o) {
      const N = 7, w = W * .23, sp = w * 1.12, photos = o.photos || [];
      for (let i = 0; i < N; i++) {
        let x = W + w - s.x * (W + N * sp + w) + i * sp;
        if (m.variant % 2) x = W - x;
        const near = Math.max(0, 1 - Math.abs(x - W / 2) / (W * .35)), sc = 1 + .2 * ez('sine.inOut')(near);
        ctx.save(); ctx.globalAlpha = clamp(s.a);
        ctx.translate(x, H * .56); ctx.scale(sc, sc); ctx.rotate((i % 2 ? 1 : -1) * .03);
        polaroid(ctx, w, w * 1.25, i % 2 === 0 ? photos[i % (photos.length || 1)] : null, i % 2 ? L.P.accent : '#fff');
        ctx.restore();
      }
    },
  },

  shrink: {
    init: { k: 0, top: 0, bot: 0 },
    build: (tl, s, m) => tl
      .to(s, { k: 1, duration: .75, ease: 'expo.inOut' }, 0)
      .to(s, { top: 1, duration: .5, ease: 'back.out(1.5)' }, .5)
      .to(s, { bot: 1, duration: .5, ease: 'back.out(1.5)' }, .75)
      .to(s, { top: 0, bot: 0, duration: .22, ease: 'power2.in' }, m.dur - .85)
      .to(s, { k: 0, duration: .6, ease: 'expo.inOut' }, m.dur - .62),
    // Dessiné par render() : il remplace la vidéo (voir drawShrink).
    draw() {},
  },

  comment: {
    init: { sc: 0, a: 0, heart: 0 },
    build: (tl, s, m) => tl
      .to(s, { a: 1, duration: .15 }, 0)
      .to(s, { sc: 1, duration: .5, ease: 'back.out(1.9)' }, 0)
      .to(s, { heart: 1, duration: .7, ease: 'elastic.out(1, 0.5)' }, .9)
      .to(s, { a: 0, sc: .9, duration: .28, ease: 'power2.in' }, exitAt(m)),
    draw(ctx, s, m, L, W, H) {
      const P = L.P, name = val(m, 'name', 'un abonné'), text = val(m, 'text', '');
      const bw = W * .84, fs = W * .042, y = m.variant % 2 ? H * .62 : H * .25;
      ctx.save(); ctx.globalAlpha = clamp(s.a);
      ctx.font = fstr(L.B, fs);
      const lines = wrap(ctx, text, bw * .66).slice(0, 3);
      const bh = fs * 2.7 + lines.length * fs * 1.3;
      ctx.translate(W / 2, y); ctx.scale(s.sc, s.sc);
      softCard(ctx, -bw / 2, -bh / 2, bw, bh, fs * .9, '#fff', { shadow: .35 });
      const ax = -bw / 2 + fs * 1.8, ay = -bh / 2 + fs * 1.6;
      ctx.fillStyle = P.accent === '#FFFFFF' ? '#111' : P.accent; ctx.beginPath(); ctx.arc(ax, ay, fs * .95, 0, 7); ctx.fill();
      ctx.fillStyle = isLight(ctx.fillStyle) ? '#111' : '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = fstr(L.D, fs * .9); ctx.fillText((name[0] || '?').toUpperCase(), ax, ay + fs * .05);
      ctx.textAlign = 'left'; ctx.font = fstr(L.B, fs * .8); ctx.fillStyle = '#111';
      ctx.fillText(name, ax + fs * 1.5, ay - fs * .2);
      ctx.fillStyle = '#999'; ctx.font = fstr({ family: 'Inter', weight: 500 }, fs * .62); ctx.fillText('il y a 2 min', ax + fs * 1.5, ay + fs * .6);
      ctx.fillStyle = '#111'; ctx.font = fstr(L.B, fs);
      lines.forEach((l, i) => ctx.fillText(l, ax + fs * 1.5, -bh / 2 + fs * 2.9 + i * fs * 1.3));
      // cœur qui « like »
      const hx = bw / 2 - fs * 1.4, hy = 0, hs = fs * .55 * (1 + .25 * Math.sin(Math.PI * clamp(s.heart)));
      ctx.fillStyle = s.heart > .05 ? '#FF3B5C' : '#ccc';
      ctx.beginPath(); ctx.moveTo(hx, hy + hs * .6);
      ctx.bezierCurveTo(hx - hs * 1.3, hy - hs * .2, hx - hs * .6, hy - hs * 1.1, hx, hy - hs * .35);
      ctx.bezierCurveTo(hx + hs * .6, hy - hs * 1.1, hx + hs * 1.3, hy - hs * .2, hx, hy + hs * .6); ctx.fill();
      ctx.restore();
    },
  },

  wordreveal: {
    init: m => {
      const s = { a: 1 };
      String(val(m, 'text', '')).split(/\s+/).filter(Boolean).forEach((_, i) => { s['w' + i] = 0; s['k' + i] = 0; });
      return s;
    },
    build: (tl, s, m) => {
      const words = String(val(m, 'text', '')).split(/\s+/).filter(Boolean);
      const step = Math.min(.14, (m.dur * .45) / Math.max(1, words.length));
      words.forEach((_, i) => {
        tl.to(s, { ['w' + i]: 1, duration: .5, ease: 'expo.out' }, .05 + i * step)
          .to(s, { ['k' + i]: 1, duration: .4, ease: 'power2.out' }, .3 + i * step);
      });
      tl.to(s, { a: 0, duration: .3, ease: 'power2.in' }, exitAt(m));
    },
    draw(ctx, s, m, L, W, H) {
      const P = L.P, words = String(val(m, 'text', '')).split(/\s+/).filter(Boolean);
      const mark = new Set(String(val(m, 'mark', '')).toLowerCase().split(/[\s,]+/).filter(Boolean));
      let fs = W * .085;
      ctx.save(); ctx.globalAlpha = clamp(s.a);
      ctx.font = fstr(L.D, fs);
      let lines = wrap(ctx, tx(L, words.join(' ')), W * .84);
      while (lines.length > 3 && fs > W * .05) { fs *= .9; ctx.font = fstr(L.D, fs); lines = wrap(ctx, tx(L, words.join(' ')), W * .84); }
      const sp = ctx.measureText(' ').width, lh = fs * 1.2, y0 = H * .6 - (lines.length - 1) * lh / 2;
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      let k = 0;
      lines.forEach((line, li) => {
        const ws = line.split(' '), total = ctx.measureText(line).width;
        let x = (W - total) / 2; const y = y0 + li * lh;
        for (const wd of ws) {
          const i = k++, p = clamp(s['w' + i]), ww = ctx.measureText(wd).width;
          const isMark = mark.has(words[i]?.toLowerCase().replace(/[.,!?]/g, ''));
          ctx.save(); ctx.globalAlpha = clamp(s.a) * p;
          if (isMark) marker(ctx, x - fs * .12, y - fs * .58, ww + fs * .24, fs * 1.1, s['k' + i], P.accent);
          ctx.fillStyle = isMark && s['k' + i] > .5 ? (isLight(P.accent) ? '#111' : '#fff') : '#fff';
          if (isMark && s['k' + i] > .5) ctx.fillText(wd, x, y + (1 - p) * fs * .5);
          else shadowed(ctx, wd, x, y + (1 - p) * fs * .5, W);
          ctx.restore();
          x += ww + sp;
        }
      });
      ctx.restore();
    },
  },

  counter: {
    init: { a: 0, sc: .7, v: 0, lab: 0 },
    build: (tl, s, m) => tl
      .to(s, { a: 1, sc: 1, duration: .5, ease: 'back.out(1.8)' }, 0)
      .to(s, { v: 1, duration: 1.4, ease: 'power3.out' }, .1)
      .to(s, { lab: 1, duration: .45, ease: 'expo.out' }, .35)
      .to(s, { a: 0, sc: .9, duration: .3, ease: 'power2.in' }, exitAt(m)),
    draw(ctx, s, m, L, W, H) {
      const P = L.P, raw = String(val(m, 'value', '0')), label = val(m, 'label', '');
      const num = raw.match(/\d+(?:[.,]\d+)?/);
      let shown = raw;
      if (num) { const n = parseFloat(num[0].replace(',', '.')); shown = raw.replace(num[0], Math.round(n * s.v).toLocaleString('fr-FR').replace(/[  ]/g, ' ')); }
      ctx.save(); ctx.globalAlpha = clamp(s.a);
      ctx.translate(W / 2, H * .55); ctx.scale(s.sc, s.sc);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const fs = fitSize(ctx, tx(L, shown), L.D, W * .86, W * .26);
      ctx.font = fstr(L.D, fs); ctx.fillStyle = '#fff';
      shadowed(ctx, tx(L, shown), 0, 0, W, .55);
      if (label) {
        ctx.globalAlpha = clamp(s.a) * clamp(s.lab);
        ctx.font = fstr(L.Hd, W * .055); ctx.fillStyle = P.accent;
        shadowed(ctx, label, 0, fs * .62 + (1 - s.lab) * W * .03, W);
      }
      ctx.restore();
    },
  },

  kinetic: {
    init: m => { const s = { bg: 0, out: 0 }; String(val(m, 'text', '')).split(/\s+/).filter(Boolean).forEach((_, i) => { s['w' + i] = 0; }); return s; },
    build: (tl, s, m) => {
      const words = String(val(m, 'text', '')).split(/\s+/).filter(Boolean);
      tl.to(s, { bg: 1, duration: .3, ease: 'power2.out' }, 0);
      const step = Math.min(.18, (m.dur * .55) / Math.max(1, words.length));
      words.forEach((_, i) => tl.to(s, { ['w' + i]: 1, duration: .55, ease: 'expo.out' }, .15 + (m.times?.[i] ?? i * step)));
      tl.to(s, { out: 1, duration: .35, ease: 'expo.in' }, exitAt(m)).to(s, { bg: 0, duration: .25 }, exitAt(m) + .1);
    },
    draw(ctx, s, m, L, W, H) {
      const P = L.P, words = String(val(m, 'text', '')).split(/\s+/).filter(Boolean);
      if (!o_isDepth(m)) { ctx.save(); ctx.globalAlpha = clamp(s.bg); bgFill(ctx, W, H, P); ctx.restore(); }
      let fs = W * .11;
      ctx.save(); ctx.font = fstr(L.D, fs);
      let lines = wrap(ctx, tx(L, words.join(' ')), W * .82);
      while (lines.length > 4 && fs > W * .06) { fs *= .9; ctx.font = fstr(L.D, fs); lines = wrap(ctx, tx(L, words.join(' ')), W * .82); }
      const sp = ctx.measureText(' ').width, lh = fs * 1.08, y0 = H / 2 - (lines.length - 1) * lh / 2;
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      let k = 0;
      lines.forEach((line, li) => {
        const total = ctx.measureText(line).width; let x = (W - total) / 2; const y = y0 + li * lh;
        ctx.save(); ctx.beginPath(); ctx.rect(0, y - lh * .62, W, lh * 1.2); ctx.clip();
        for (const wd of line.split(' ')) {
          const i = k++, p = clamp(s['w' + i]), ww = ctx.measureText(wd).width;
          ctx.fillStyle = i === words.length - 1 ? P.accent : '#fff';
          ctx.fillText(wd, x, y + (1 - p) * lh - s.out * lh * 1.2);
          x += ww + sp;
        }
        ctx.restore();
      });
      ctx.restore();
    },
  },

  beat: {
    init: { a: 1 },
    build: (tl, s, m) => tl.to(s, { a: 1, duration: m.dur }, 0),
    draw(ctx, s, m, L, W, H, lt) {
      const P = L.P, words = String(val(m, 'words', '')).split(/\s+/).filter(Boolean);
      if (!words.length) return;
      if (!o_isDepth(m)) bgFill(ctx, W, H, P);
      const n = words.length, seg = m.dur / n, i = Math.min(n - 1, Math.floor(lt / seg)), p = (lt - i * seg) / seg;
      const k = ez('expo.out')(clamp(p / .5));
      const wd = tx(L, words[i]).toUpperCase();
      const fs = fitSize(ctx, wd, L.D, W * .84, W * .26);
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(1.35 - .35 * k, 1.35 - .35 * k);
      ctx.font = fstr(L.D, fs); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = i === n - 1 ? P.accent : '#fff'; ctx.fillText(wd, 0, 0);
      ctx.restore();
    },
  },

  zoom: { init: { z: 0 }, build: (tl, s, m) => tl.to(s, { z: 1, duration: .35, ease: 'expo.out' }, 0).to(s, { z: 0, duration: .5, ease: 'power2.inOut' }, m.dur - .5), draw() {} },

  spotlight: {
    init: { k: 0 },
    build: (tl, s, m) => tl.to(s, { k: 1, duration: .5, ease: 'power2.out' }, 0).to(s, { k: 0, duration: .4, ease: 'power2.in' }, m.dur - .4),
    draw(ctx, s, m, L, W, H) {
      const g = ctx.createRadialGradient(W / 2, H * .38, W * .22, W / 2, H * .38, W * .8);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${.82 * s.k})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    },
  },
  ...MORPH_DEFS,
};

// Le fond plein écran est omis quand le texte passe derrière la personne (la vidéo reste visible).
let depthMode = false;
const o_isDepth = () => depthMode;

function bgFill(ctx, W, H, P) {
  warmBg(ctx, W, H, { ...P, panel: P.card });
}

// Carte photo façon polaroid : une photo (média ou image de ta vidéo) ou une carte couleur.
function polaroid(ctx, w, h, photo, color) {
  softCard(ctx, -w / 2, -h / 2, w, h, w * .06, color, { shadow: .35 });
  if (color === '#fff' || photo) {
    const pad = w * .07;
    if (photo) drawFit(ctx, photo, -w / 2 + pad, -h / 2 + pad, w - pad * 2, h - pad * 3.3, { r: w * .03 });
    else drawVideoRect(ctx, -w / 2 + pad, -h / 2 + pad, w - pad * 2, h - pad * 3.3, w * .03, 1.8, .3);
  }
}

export const keyOf = m => `${m.uid ?? m.key ?? ''}|${m.type}|${m.dur}|${m.variant || 0}|${JSON.stringify(m.f || {})}|${(m.times || []).join(',')}|${m.turn ?? ''}`;

export function stateOf(m, lt) {
  const d = DEFS[m.type];
  if (!d) return null;
  const init = typeof d.init === 'function' ? d.init(m) : d.init;
  return stateAt(keyOf(m), init, (tl, s) => d.build(tl, s, m), lt);
}

export function drawOverlay(ctx, W, H, m, lt, o, L) {
  const d = DEFS[m.type];
  if (!d) return;
  const s = stateOf(m, lt);
  depthMode = !!o.depthBehind;
  ctx.save();
  try { d.draw(ctx, s, m, L, W, H, lt, o); } finally { ctx.restore(); depthMode = false; }
}

// Shrink card : la vidéo rétrécit sur une carte de la couleur d'accent, texte au-dessus et en dessous.
export function drawShrink(ctx, W, H, m, lt, L, zoom) {
  const s = stateOf(m, lt), P = L.P, k = s.k;
  if (k <= 0.001) return false;
  ctx.save();
  ctx.fillStyle = P.accent; ctx.globalAlpha = clamp(k * 1.5); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  const sc = 1 - .44 * k, vw = W * sc, vh = H * sc, vx = (W - vw) / 2, vy = (H - vh) / 2 + H * .015 * k;
  softCard(ctx, vx, vy, vw, vh, W * .03 * k, '#000', { shadow: .35 * k });
  drawVideoRect(ctx, vx, vy, vw, vh, W * .03 * k, zoom);
  const ink = isLight(P.accent) ? (P.ink === '#FFFFFF' ? '#111' : P.ink) : '#fff';
  const top = m.f?.top || '', bot = m.f?.bottom || '';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = ink;
  const slot = (H - vh) / 2;
  if (top) { const fs = fitSize(ctx, tx(L, top), L.Hd, W * .86, slot * .62); ctx.font = fstr(L.Hd, fs); ctx.globalAlpha = clamp(s.top); ctx.fillText(tx(L, top), W / 2, vy - slot / 2 + (1 - s.top) * slot * .3); }
  if (bot) { const fs = fitSize(ctx, tx(L, bot), L.Hd, W * .86, slot * .62); ctx.font = fstr(L.Hd, fs); ctx.globalAlpha = clamp(s.bot); ctx.fillText(tx(L, bot), W / 2, vy + vh + slot / 2 - (1 - s.bot) * slot * .3); }
  ctx.restore();
  return true;
}

// Facteur de zoom (punch-in) à un instant.
export const zoomOf = (m, lt) => 1 + .22 * stateOf(m, lt).z;
