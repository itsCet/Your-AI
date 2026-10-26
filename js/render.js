// Rendu d'une image complète : vidéo, médias, motions, sous-titres et titre.
// La même fonction sert aux vignettes, à l'aperçu et à l'export.
import { PALETTES, FONTS, fontOf, fstr, clamp, ease, backOut, env, fitSize, drawVideoRect, drawFit, hi, getVideo, SERIF, UI_BOLD } from './kit.js';
import { MOTIONS, M, CATEGORIES, DIMS, HIDES_CAPTIONS, FULLSCREEN, drawMotion } from './motions.js';
import { drawMedia, syncMediaVideo, MEDIA_DIMS } from './media.js';

export { FONTS, PALETTES, MOTIONS, M, CATEGORIES, fontOf, fstr, clamp };
export { setVideo } from './kit.js';

export const TITLES = [
  { id: 'editorial', name: 'Éditorial', desc: 'Capitales grasses + gros mot en serif italique' },
  { id: 'tiles', name: 'Tuiles', desc: 'Lettres en tuiles qui tombent' },
  { id: 'stack', name: 'Empilé', desc: 'Gros texte, 2e ligne en accent' },
  { id: 'banner', name: 'Bandeau', desc: 'Bandes de couleur qui balaient' },
  { id: 'sticker', name: 'Stickers', desc: 'Étiquettes blanches légèrement inclinées' },
  { id: 'highlight', name: 'Surligné', desc: 'Étiquettes couleur, texte gras italique' },
  { id: 'type', name: 'Machine à écrire', desc: 'Le texte se tape lettre par lettre' },
];

export const CAPTION_STYLES = [
  { id: 'editorial', name: 'Éditorial', desc: 'Petits mots en gras, le mot clé en gros serif doré' },
  { id: 'mixte', name: 'Mixte', desc: 'Texte blanc, mots clés en serif italique' },
  { id: 'brackets', name: 'Crochets', desc: 'Capitales, crochets autour du mot clé qui devient doré' },
  { id: 'band', name: 'Bandeau', desc: 'Bande sombre en bas, texte mixte' },
  { id: 'pop', name: 'Pop', desc: 'Majuscules, mot prononcé en couleur' },
  { id: 'box', name: 'Boîte', desc: 'Texte sur fond blanc, mot surligné' },
  { id: 'karaoke', name: 'Karaoké', desc: 'Les mots se colorent au fil de la voix' },
];

// ---------- Titres ----------
function drawTitle(ctx, W, H, p, o) {
  const F = fontOf(o.font), P = PALETTES[o.pal];
  const l1 = o.hook.l1 || '', l2 = o.hook.l2 || '';
  const out = ease((1 - p) / .1);
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = W * .02;

  if (o.title === 'tiles') {
    const letters = [...l1.toUpperCase().trim().replace(/\s+/g, ' ')];
    const n = Math.max(1, letters.length);
    const size = Math.min(W * .8 / n, W * .17), gap = size * .08;
    const x0 = (W - (n * size + (n - 1) * gap)) / 2, y0 = H * .1;
    letters.forEach((ch, i) => {
      const lp = backOut((p - i * .035) / .12);
      if (lp <= 0 || ch === ' ') return;
      ctx.save();
      ctx.globalAlpha = clamp(lp) * out;
      ctx.translate(x0 + i * (size + gap) + size / 2, y0 + size / 2 - (1 - lp) * size * 1.2);
      ctx.rotate((i % 2 ? 1 : -1) * .06);
      ctx.fillStyle = i % 2 ? P.accent : P.text;
      ctx.beginPath(); ctx.roundRect(-size / 2, -size / 2, size, size, size * .08); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = P.ink;
      ctx.font = fstr(F, size * .72); ctx.fillText(ch, 0, size * .04);
      ctx.restore();
    });
    if (l2) {
      const lp = ease((p - .25) / .15);
      const fs = fitSize(ctx, l2, F, W * .7, Math.max(size * .42, W * .05));
      ctx.font = fstr(F, fs);
      const tw = ctx.measureText(l2).width + fs * 1.2, th = fs * 1.6;
      ctx.globalAlpha = lp * out;
      const y = y0 + size * 1.35 + (1 - lp) * fs;
      ctx.fillStyle = P.text; ctx.beginPath(); ctx.roundRect(W / 2 - tw / 2, y - th / 2, tw, th, fs * .2); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = P.ink; ctx.fillText(l2, W / 2, y + fs * .05);
    }
  } else if (o.title === 'stack') {
    const s1 = fitSize(ctx, l1.toUpperCase(), F, W * .86, W * .2);
    const sc = backOut(p / .14);
    ctx.globalAlpha = clamp(p / .06) * out;
    ctx.save(); ctx.translate(W / 2, H * .14); ctx.scale(sc, sc);
    ctx.font = fstr(F, s1); ctx.fillStyle = P.text; ctx.fillText(l1.toUpperCase(), 0, 0);
    ctx.restore();
    const lp = backOut((p - .12) / .14);
    const s2 = fitSize(ctx, l2.toUpperCase(), F, W * .8, s1 * .7);
    ctx.globalAlpha = clamp((p - .12) / .06) * out;
    ctx.save(); ctx.translate(W / 2, H * .14 + s1 * .55 + s2 * .6); ctx.scale(lp, lp);
    ctx.font = fstr(F, s2); ctx.fillStyle = P.accent; ctx.fillText(l2.toUpperCase(), 0, 0);
    ctx.restore();
  } else if (o.title === 'banner') {
    [l1, l2].forEach((txt, i) => {
      if (!txt) return;
      const fs = fitSize(ctx, txt.toUpperCase(), F, W * .74, W * .12);
      ctx.font = fstr(F, fs);
      const tw = ctx.measureText(txt.toUpperCase()).width + fs * .8, th = fs * 1.35;
      const y = H * .12 + i * th * 1.15;
      const wp = ease((p - i * .1) / .16);
      const x = W / 2 - tw / 2;
      ctx.globalAlpha = out;
      ctx.fillStyle = i ? P.text : P.accent;
      ctx.fillRect(x, y - th / 2, tw * wp, th);
      ctx.save(); ctx.beginPath(); ctx.rect(x, y - th / 2, tw * wp, th); ctx.clip();
      ctx.shadowBlur = 0; ctx.fillStyle = P.ink; ctx.fillText(txt.toUpperCase(), W / 2, y + fs * .05);
      ctx.restore();
    });
  } else if (o.title === 'type') {
    const full = l1 + '\n' + l2;
    const n = Math.floor(full.length * clamp(p / .45));
    const shown = full.slice(0, n).split('\n');
    const fs = Math.min(fitSize(ctx, l1, F, W * .84, W * .13), fitSize(ctx, l2 || ' ', F, W * .84, W * .13));
    ctx.font = fstr(F, fs); ctx.globalAlpha = out;
    ctx.lineWidth = fs * .12; ctx.strokeStyle = P.ink; ctx.lineJoin = 'round';
    shown.forEach((line, i) => {
      const y = H * .13 + i * fs * 1.15;
      ctx.fillStyle = i ? P.accent : P.text;
      ctx.strokeText(line, W / 2, y); ctx.fillText(line, W / 2, y);
      if (i === shown.length - 1 && Math.floor(p * 12) % 2 === 0) {
        const w = ctx.measureText(line).width;
        ctx.fillStyle = P.accent; ctx.fillRect(W / 2 + w / 2 + fs * .08, y - fs * .45, fs * .08, fs * .9);
      }
    });
  } else if (o.title === 'editorial') {
    // Gros mot en serif italique + petite ligne en capitales grasses (montage « storytelling »).
    const a = l1.toUpperCase(), b = l2;
    const s1 = fitSize(ctx, a, UI_BOLD, W * .8, W * .1);
    const s2 = fitSize(ctx, b, SERIF, W * .94, W * .2);
    const y = H * .13;
    ctx.globalAlpha = out * ease(p / .1);
    ctx.font = fstr(UI_BOLD, s1); ctx.fillStyle = P.text;
    ctx.fillText(a, W / 2, y - (1 - ease(p / .12)) * s1);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W * ease((p - .08) / .2), H); ctx.clip();
    ctx.font = fstr(SERIF, s2); ctx.fillStyle = hi(P); ctx.fillText(b, W / 2, y + s1 * .55 + s2 * .45);
    ctx.restore();
  } else if (o.title === 'sticker' || o.title === 'highlight') {
    // Lignes dans des étiquettes : blanches inclinées (sticker) ou couleur, texte en gras italique (highlight).
    const tag = o.title === 'highlight';
    [l1, l2].filter(Boolean).forEach((txt, i) => {
      const Fh = tag ? { family: 'Inter', weight: 800, style: 'italic' } : UI_BOLD;
      const fs = fitSize(ctx, txt, Fh, W * .78, W * .07);
      ctx.font = fstr(Fh, fs);
      const tw = ctx.measureText(txt).width + fs * .9, th = fs * 1.45;
      const k = backOut((p - i * .08) / .14);
      if (k <= 0) return;
      ctx.save();
      ctx.globalAlpha = out;
      ctx.translate(W / 2, H * .1 + i * th * 1.02); ctx.rotate(tag ? 0 : (i % 2 ? .025 : -.03)); ctx.scale(k, k);
      ctx.shadowBlur = tag ? 0 : W * .02;
      ctx.fillStyle = tag ? hi(P) : '#fff';
      ctx.beginPath(); ctx.roundRect(-tw / 2, -th / 2, tw, th, fs * (tag ? .2 : .35)); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = tag ? '#fff' : '#111'; ctx.fillText(txt, 0, fs * .04);
      ctx.restore();
    });
  }
  ctx.restore();
}

// ---------- Sous-titres ----------
// Mot clé d'un sous-titre : le plus long (5 lettres min.) ou un nombre.
function emphasisIdx(words) {
  let best = -1, score = 0;
  words.forEach((w, i) => {
    const l = w.w.replace(/[^\p{L}\p{N}]/gu, '');
    const s = /\d/.test(l) ? 20 + l.length : l.length >= 5 ? l.length : 0;
    if (s > score) { score = s; best = i; }
  });
  return best;
}

function drawCaptions(ctx, W, H, t, o) {
  const cap = o.captions;
  const chunk = cap.chunks.find(c => t >= c.s && t <= c.e + .15);
  if (!chunk) return;
  const P = PALETTES[o.pal], A = hi(P);
  const style = cap.style;
  const emph = emphasisIdx(chunk.words);
  const cur = chunk.words.findIndex(w => t >= w.s && t < w.e + .05);
  const pos = style === 'band' ? .87 : cap.pos;
  ctx.save();
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';

  if (style === 'editorial') {
    const small = chunk.words.filter((_, i) => i !== emph).map(w => w.w).join(' ');
    const big = emph >= 0 ? chunk.words[emph] : null;
    const s1 = fitSize(ctx, small, UI_BOLD, W * .8, W * .055);
    const s2 = big ? fitSize(ctx, big.w, SERIF, W * .9, W * .15) : 0;
    const y = H * pos;
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = W * .025;
    if (small) { ctx.font = fstr(UI_BOLD, s1); ctx.fillStyle = '#fff'; ctx.fillText(small, W / 2, big ? y - s2 * .42 : y); }
    if (big && t >= big.s - .05) {
      const k = backOut((t - big.s + .05) / .2);
      ctx.translate(W / 2, y + s1 * .2); ctx.scale(k, k);
      ctx.font = fstr(SERIF, s2); ctx.fillStyle = A; ctx.fillText(big.w, 0, 0);
    }
    ctx.restore();
    return;
  }

  if (style === 'band') {
    const g = ctx.createLinearGradient(0, H * .7, 0, H);
    g.addColorStop(0, 'rgba(12,12,12,0)'); g.addColorStop(.35, 'rgba(12,12,12,.92)'); g.addColorStop(1, 'rgba(12,12,12,1)');
    ctx.fillStyle = g; ctx.fillRect(0, H * .7, W, H * .3);
  }
  const upper = style === 'pop' || style === 'karaoke' || style === 'brackets';
  const fontFor = i => style === 'box' ? UI_BOLD
    : (style === 'mixte' || style === 'band') ? (i === emph ? SERIF : UI_BOLD)
    : style === 'brackets' ? UI_BOLD : fontOf(o.font);
  const words = chunk.words.map((w, i) => ({ ...w, i, w: upper ? w.w.toUpperCase() : w.w }));
  let fs = W * (style === 'box' || style === 'mixte' || style === 'band' ? .06 : style === 'brackets' ? .065 : .085);
  ctx.textAlign = 'left';
  let lines, sp;
  for (let k = 0; k < 6; k++) {
    ctx.font = fstr(UI_BOLD, fs); sp = ctx.measureText(' ').width;
    lines = [[]]; let lw = 0;
    for (const w of words) {
      ctx.font = fstr(fontFor(w.i), fs * (fontFor(w.i) === SERIF ? 1.12 : 1));
      const ww = ctx.measureText(w.w).width;
      if (lw && lw + sp + ww > W * .84) { lines.push([]); lw = 0; }
      lines[lines.length - 1].push({ ...w, ww }); lw += (lw ? sp : 0) + ww;
    }
    if (lines.length <= 2) break;
    fs *= .85;
  }
  const lh = fs * (style === 'box' ? 1.45 : 1.25);
  const y0 = H * pos - (lines.length - 1) * lh / 2;
  const pop = style === 'band' || style === 'mixte' ? ease((t - chunk.s) / .12) : backOut((t - chunk.s) / .18);
  if (style === 'band' || style === 'mixte') ctx.globalAlpha = pop;
  else { ctx.translate(W / 2, H * pos); ctx.scale(pop, pop); ctx.translate(-W / 2, -H * pos); }
  lines.forEach((line, li) => {
    const total = line.reduce((a, w) => a + w.ww, 0) + sp * (line.length - 1);
    let x = (W - total) / 2; const y = y0 + li * lh;
    if (style === 'box') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.roundRect(x - fs * .35, y - lh / 2, total + fs * .7, lh, fs * .25); ctx.fill();
    }
    for (const w of line) {
      const isCur = w.i === cur, spoken = t >= w.s;
      const Fw = fontFor(w.i);
      ctx.font = fstr(Fw, fs * (Fw === SERIF ? 1.12 : 1));
      if (style === 'box') {
        if (isCur) { ctx.fillStyle = A; ctx.beginPath(); ctx.roundRect(x - fs * .12, y - fs * .6, w.ww + fs * .24, fs * 1.2, fs * .15); ctx.fill(); }
        ctx.fillStyle = '#111111'; ctx.fillText(w.w, x, y + fs * .04);
      } else if (style === 'mixte' || style === 'band') {
        ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = style === 'band' ? 0 : W * .02;
        ctx.fillStyle = spoken ? '#fff' : 'rgba(255,255,255,.55)';
        ctx.fillText(w.w, x, y);
        ctx.shadowBlur = 0;
      } else if (style === 'brackets') {
        const isEm = w.i === emph && spoken;
        ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = W * .02;
        ctx.fillStyle = isEm || isCur ? A : spoken ? '#fff' : 'rgba(255,255,255,.6)';
        ctx.fillText(w.w, x, y);
        if (isEm) {
          const k = ease((t - w.s) / .2), pad = fs * .35 * k + fs * .1, bh = fs * .62, bl = fs * .3;
          ctx.strokeStyle = A; ctx.lineWidth = fs * .07; ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.moveTo(x - pad + bl, y - bh); ctx.lineTo(x - pad, y - bh); ctx.lineTo(x - pad, y + bh); ctx.lineTo(x - pad + bl, y + bh);
          ctx.moveTo(x + w.ww + pad - bl, y - bh); ctx.lineTo(x + w.ww + pad, y - bh); ctx.lineTo(x + w.ww + pad, y + bh); ctx.lineTo(x + w.ww + pad - bl, y + bh);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      } else {
        ctx.save();
        if (style === 'pop' && isCur) { ctx.translate(x + w.ww / 2, y); ctx.scale(1.12, 1.12); ctx.translate(-(x + w.ww / 2), -y); }
        ctx.lineJoin = 'round'; ctx.lineWidth = fs * .18; ctx.strokeStyle = '#000000';
        ctx.strokeText(w.w, x, y);
        const on = style === 'pop' ? isCur : spoken;
        ctx.fillStyle = on ? A : '#FFFFFF';
        ctx.fillText(w.w, x, y);
        ctx.restore();
      }
      x += w.ww + sp;
    }
  });
  ctx.restore();
}

// ---------- Image complète ----------
// o = { title, font, pal, hook, titleStart, titleDur, motions: [...], media: [{el, layout, start, dur, label, pos}],
//       captions: {style, pos, chunks} | null }
export function render(ctx, W, H, t, o) {
  const P = PALETTES[o.pal], F = fontOf(o.font);
  const isOn = x => t >= x.start && t <= x.start + x.dur;
  const active = o.motions.filter(isOn);
  const media = o.media || [];
  // Seuls l'aperçu principal et l'export pilotent la lecture des vidéos ajoutées.
  if (!o.noSync) for (const m of media) syncMediaVideo(m, t - m.start, isOn(m));
  const mediaOn = media.filter(isOn);
  let zoom = 1, shrink = null, dim = 0;
  for (const m of active) {
    const p = (t - m.start) / m.dur;
    if (m.type === 'zoom') zoom *= 1 + .25 * env(p, .15, .25);
    if (m.type === 'shrink') shrink = { m, e: env(p, .2, .18) };
    if (DIMS.has(m.type)) dim = Math.max(dim, env(p, .1, .1));
  }
  for (const m of mediaOn) if (MEDIA_DIMS.has(m.layout)) dim = Math.max(dim, env((t - m.start) / m.dur, .1, .1));
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  drawVideoRect(ctx, 0, 0, W, H, 0, zoom);
  if (dim > 0) {
    // Fond flouté et assombri derrière les cartes.
    ctx.save(); ctx.globalAlpha = dim; ctx.filter = `blur(${Math.round(W * .02)}px) brightness(.5)`;
    drawVideoRect(ctx, -W * .05, -H * .05, W * 1.1, H * 1.1, 0, zoom);
    ctx.restore();
  }

  if (shrink) {
    const { m, e } = shrink, P2 = (m.variant || 0) % 2 ? P.text : P.accent;
    ctx.fillStyle = P.ink; ctx.globalAlpha = e * .9; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    const s = 1 - .4 * e, vw = W * s, vh = H * s, vx = (W - vw) / 2, vy = (H - vh) / 2 + H * .06 * e;
    const pad = W * .035 * e, head = H * .1 * e;
    ctx.fillStyle = P2;
    ctx.beginPath(); ctx.roundRect(vx - pad, vy - head - pad, vw + pad * 2, vh + head + pad * 2, W * .04 * e); ctx.fill();
    drawVideoRect(ctx, vx, vy, vw, vh, W * .025 * e, zoom);
    const text = m.text ?? M.shrink.text;
    if (text && e > .05) {
      ctx.save(); ctx.globalAlpha = clamp((e - .5) * 2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = P.ink;
      ctx.font = fstr(F, fitSize(ctx, text, F, vw * .9, head * .6));
      ctx.fillText(text, W / 2, vy - head / 2 - pad / 2); ctx.restore();
    }
  }
  for (const m of active) if (FULLSCREEN.has(m.type)) drawMotion(ctx, W, H, m, t - m.start, o);
  for (const m of mediaOn) drawMedia(ctx, W, H, m, t - m.start, o);
  for (const m of active) if (m.type !== 'zoom' && m.type !== 'shrink' && !FULLSCREEN.has(m.type)) drawMotion(ctx, W, H, m, t - m.start, o);
  const fullMedia = mediaOn.some(m => m.layout === 'full');
  // Le titre s'efface quand une carte, un plein écran ou un écran partagé occupe le haut.
  const covered = dim > .3 || fullMedia || mediaOn.some(m => m.layout === 'split') || active.some(m => FULLSCREEN.has(m.type));
  const titleOn = o.title && !covered && t >= o.titleStart && t <= o.titleStart + o.titleDur;
  if (o.captions && o.captions.chunks.length && !fullMedia && !active.some(m => HIDES_CAPTIONS.has(m.type))) drawCaptions(ctx, W, H, t, o);
  if (titleOn) drawTitle(ctx, W, H, (t - o.titleStart) / o.titleDur, o);
}
