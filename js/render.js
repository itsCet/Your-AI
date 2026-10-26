// Rendu d'une image complète : vidéo, médias, éléments et motions, sous-titres et titre d'accroche,
// le tout dans le look choisi. La même fonction sert aux vignettes, à l'aperçu et à l'export.
import { PALETTES, fstr, clamp, fitSize, drawVideoRect, drawFit, isLight, setFrame, kineticPop, slideBlur, withGlow } from './kit.js';
import { palOf, pairOf } from './look.js';
import { ez, handLine, marker } from './anim.js';
import { drawOverlay, drawShrink, zoomOf, stateOf, DEPTH_BEHIND, FULLSCREEN, HIDES_CAPTIONS, DIMS } from './elements.js';
import { drawMedia, syncMediaVideo, MEDIA_DIMS } from './media.js';

export { setVideo } from './kit.js';

// Polices et couleurs résolues d'un look.
export function lookContext(look) {
  const pair = pairOf(look), P = PALETTES[palOf(look)];
  return {
    P, pair, caps: !!pair.caps,
    D: pair.display, B: pair.body,
    Hd: pair.hand || pair.accent || pair.display,
    hasHand: !!pair.hand,
  };
}

const tx = (L, s) => L.caps ? s.toUpperCase() : s;
function shadowText(ctx, text, x, y, W, a = .5) {
  ctx.save(); ctx.shadowColor = `rgba(0,0,0,${a})`; ctx.shadowBlur = W * .025; ctx.shadowOffsetY = W * .004;
  ctx.fillText(text, x, y); ctx.restore();
}

// ---------- Titre d'accroche ----------
function drawHook(ctx, W, H, p, o, L, part) {
  const P = L.P, style = o.look.hook;
  const l1 = o.hook.l1 || '', l2 = o.hook.l2 || '';
  const out = ez('power2.in')(clamp((1 - p) / .12)) ;
  const inn = q => ez('expo.out')(clamp(q));
  const back = q => ez('back.out(1.8)')(clamp(q));
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (o.look.fx?.slide) slideBlur(ctx, W, H, p, .1);

  if (style === 'tiles') {
    // Les tuiles prennent un mot court ; le reste de la ligne passe dans l'étiquette.
    let t1 = l1.trim(), t2 = l2;
    if (t1.replace(/\s/g, '').length > 7) { const [w0, ...rest] = t1.split(/\s+/); t1 = w0; t2 = [rest.join(' '), l2].filter(Boolean).join(' '); }
    const letters = [...tx(L, t1).toUpperCase().trim().replace(/\s+/g, ' ')];
    const n = Math.max(1, letters.length), size = Math.min(W * .8 / n, W * .16), gap = size * .08;
    const x0 = (W - (n * size + (n - 1) * gap)) / 2, y0 = H * .1;
    letters.forEach((ch, i) => {
      const k = back((p - i * .035) / .12);
      if (k <= 0 || ch === ' ') return;
      ctx.save(); ctx.globalAlpha = clamp(k) * out;
      ctx.translate(x0 + i * (size + gap) + size / 2, y0 + size / 2 - (1 - k) * size * 1.3); ctx.rotate((i % 2 ? 1 : -1) * .06);
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = size * .25;
      ctx.fillStyle = i % 2 ? P.accent : '#fff'; ctx.beginPath(); ctx.roundRect(-size / 2, -size / 2, size, size, size * .1); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = i % 2 && !isLight(P.accent) ? '#fff' : '#111';
      ctx.font = fstr(L.D, size * .68); ctx.fillText(ch, 0, size * .04);
      ctx.restore();
    });
    if (t2) {
      const k = inn((p - .25) / .15), F = L.hasHand ? L.Hd : L.B;
      const fs = fitSize(ctx, t2, F, W * .8, Math.max(size * .42, W * .055));
      ctx.font = fstr(F, fs); const tw = ctx.measureText(t2).width + fs * 1.1, th = fs * 1.55;
      ctx.globalAlpha = k * out;
      const y = y0 + size * 1.4 + (1 - k) * fs;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(W / 2 - tw / 2, y - th / 2, tw, th, fs * .2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillText(t2, W / 2, y + fs * .05);
    }
  } else if (style === 'stacked') {
    const s1 = fitSize(ctx, tx(L, l1).toUpperCase(), L.D, W * .86, W * .19);
    const k1 = back(p / .14), k2 = back((p - .12) / .14);
    ctx.globalAlpha = clamp(p / .05) * out;
    ctx.save(); ctx.translate(W / 2, H * .14); ctx.scale(k1, k1); ctx.font = fstr(L.D, s1); ctx.fillStyle = '#fff'; shadowText(ctx, tx(L, l1).toUpperCase(), 0, 0, W); ctx.restore();
    const s2 = fitSize(ctx, tx(L, l2).toUpperCase(), L.D, W * .82, s1 * .72);
    ctx.globalAlpha = clamp((p - .12) / .05) * out;
    ctx.save(); ctx.translate(W / 2, H * .14 + s1 * .55 + s2 * .6); ctx.scale(k2, k2); ctx.font = fstr(L.D, s2); ctx.fillStyle = P.accent; shadowText(ctx, tx(L, l2).toUpperCase(), 0, 0, W); ctx.restore();
  } else if (style === 'editorial') {
    const a = l1.toUpperCase(), s1 = fitSize(ctx, a, L.B, W * .8, W * .065);
    const F2 = L.Hd, s2 = fitSize(ctx, l2, F2, W * .92, W * .17), y = H * .12;
    ctx.globalAlpha = out * inn(p / .1);
    ctx.font = fstr(L.B, s1); ctx.letterSpacing = `${W * .006}px`; ctx.fillStyle = '#fff'; shadowText(ctx, a, W / 2, y - (1 - inn(p / .12)) * s1, W); ctx.letterSpacing = '0px';
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W * inn((p - .08) / .2), H); ctx.clip();
    ctx.font = fstr(F2, s2); ctx.fillStyle = P.accent; shadowText(ctx, l2, W / 2, y + s1 * .75 + s2 * .45, W);
    ctx.restore();
  } else if (style === 'tag') {
    [l1, l2].filter(Boolean).forEach((txt, i) => {
      const F = L.hasHand && i ? L.Hd : { ...L.B, style: 'italic' };
      const fs = fitSize(ctx, txt, F, W * .78, W * .072);
      ctx.font = fstr(F, fs); const tw = ctx.measureText(txt).width + fs * .9, th = fs * 1.45;
      const k = back((p - i * .08) / .14); if (k <= 0) return;
      ctx.save(); ctx.globalAlpha = out;
      ctx.translate(W / 2, H * .1 + i * th * 1.06); ctx.rotate(i % 2 ? .02 : -.025); ctx.scale(k, k);
      ctx.fillStyle = P.accent; ctx.beginPath(); ctx.roundRect(-tw / 2, -th / 2, tw, th, fs * .2); ctx.fill();
      ctx.fillStyle = isLight(P.accent) ? '#111' : '#fff'; ctx.fillText(txt, 0, fs * .04);
      ctx.restore();
    });
  } else if (style === 'underline') {
    const s1 = fitSize(ctx, tx(L, l1), L.D, W * .86, W * .13), F2 = L.Hd, s2 = fitSize(ctx, l2, F2, W * .86, W * .12), y = H * .12;
    ctx.globalAlpha = out * inn(p / .1);
    ctx.font = fstr(L.D, s1); ctx.fillStyle = '#fff'; shadowText(ctx, tx(L, l1), W / 2, y, W);
    if (l2) {
      ctx.globalAlpha = out * inn((p - .1) / .12);
      ctx.font = fstr(F2, s2); ctx.fillStyle = P.accent; const y2 = y + s1 * .6 + s2 * .6;
      shadowText(ctx, l2, W / 2, y2, W);
      const tw = ctx.measureText(l2).width;
      ctx.globalAlpha = out;
      handLine(ctx, W / 2 - tw / 2, y2 + s2 * .55, W / 2 + tw / 2, ez('power2.inOut')(clamp((p - .2) / .2)), P.accent, W * .011, 3, -.03);
    }
  } else if (style === 'depth') {
    const a = tx(L, l1).toUpperCase(), s1 = fitSize(ctx, a, L.D, W * .96, W * .5), k = inn(p / .18);
    if (part !== 'front') { ctx.globalAlpha = out * k; ctx.font = fstr(L.D, s1); ctx.fillStyle = P.accent; ctx.fillText(a, W / 2, H * .27 + (1 - k) * s1 * .25); }
    if (l2 && part !== 'back') {
      const F2 = L.hasHand ? L.Hd : L.B, s2 = fitSize(ctx, l2, F2, W * .8, W * .08);
      ctx.globalAlpha = out * inn((p - .15) / .15); ctx.font = fstr(F2, s2); ctx.fillStyle = '#fff';
      shadowText(ctx, l2, W / 2, H * .27 + s1 * .52 + s2 * .6, W);
    }
  } else { // type
    const full = l1 + '\n' + l2, n = Math.floor(full.length * clamp(p / .45)), shown = full.slice(0, n).split('\n');
    const fs = Math.min(fitSize(ctx, l1, L.D, W * .84, W * .12), fitSize(ctx, l2 || ' ', L.D, W * .84, W * .12));
    ctx.font = fstr(L.D, fs); ctx.globalAlpha = out;
    shown.forEach((line, i) => {
      const y = H * .13 + i * fs * 1.15;
      ctx.fillStyle = i ? P.accent : '#fff'; shadowText(ctx, line, W / 2, y, W);
      if (i === shown.length - 1 && Math.floor(p * 12) % 2 === 0) { const w = ctx.measureText(line).width; ctx.fillStyle = P.accent; ctx.fillRect(W / 2 + w / 2 + fs * .08, y - fs * .45, fs * .07, fs * .9); }
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

function drawCaptions(ctx, W, H, t, o, L) {
  const cap = o.captions, chunk = cap.chunks.find(c => t >= c.s && t <= c.e + .15);
  if (!chunk || !chunk.words.length) return;
  const P = L.P, style = cap.style;
  const emph = emphasisIdx(chunk.words), cur = chunk.words.findIndex(w => t >= w.s && t < w.e + .05);
  const pos = style === 'band' ? .87 : cap.pos;
  ctx.save();
  if (o.look.fx?.slide) slideBlur(ctx, W, H, (t - chunk.s) / 1, .2);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';

  if (style === 'editorial') {
    const small = chunk.words.filter((_, i) => i !== emph).map(w => w.w).join(' '), big = emph >= 0 ? chunk.words[emph] : null;
    const s1 = fitSize(ctx, small, L.B, W * .8, W * .055), s2 = big ? fitSize(ctx, big.w, L.Hd, W * .9, W * .15) : 0, y = H * pos;
    ctx.fillStyle = '#fff';
    if (small) { ctx.font = fstr(L.B, s1); shadowText(ctx, small, W / 2, big ? y - s2 * .42 : y, W); }
    if (big && t >= big.s - .05) {
      const k = ez('back.out(1.8)')(clamp((t - big.s + .05) / .2)) * (o.look.fx?.pop ? kineticPop(t - big.s, .16) : 1);
      ctx.translate(W / 2, y + s1 * .2); ctx.scale(k, k); ctx.font = fstr(L.Hd, s2); ctx.fillStyle = P.accent; shadowText(ctx, big.w, 0, 0, W);
    }
    ctx.restore(); return;
  }
  if (style === 'band') {
    const g = ctx.createLinearGradient(0, H * .7, 0, H);
    g.addColorStop(0, 'rgba(12,12,12,0)'); g.addColorStop(.35, 'rgba(12,12,12,.92)'); g.addColorStop(1, 'rgba(12,12,12,1)');
    ctx.fillStyle = g; ctx.fillRect(0, H * .7, W, H * .3);
  }
  const upper = style === 'pop' || style === 'brackets' || style === 'karaoke' || L.caps && style !== 'box';
  const fontFor = i => style === 'pop' ? (L.caps ? L.D : { ...L.B, weight: 800 })
    : (style === 'hand' || style === 'band') && i === emph ? L.Hd : L.B;
  const sizeFor = i => (style === 'hand' || style === 'band') && i === emph ? 1.25 : 1;
  const words = chunk.words.map((w, i) => ({ ...w, i, w: upper ? w.w.toUpperCase() : w.w }));
  let fs = W * (style === 'pop' ? .075 : style === 'box' ? .058 : .062);
  ctx.textAlign = 'left';
  let lines, sp;
  for (let k = 0; k < 6; k++) {
    ctx.font = fstr(L.B, fs); sp = ctx.measureText(' ').width;
    lines = [[]]; let lw = 0;
    for (const w of words) {
      ctx.font = fstr(fontFor(w.i), fs * sizeFor(w.i));
      const ww = ctx.measureText(w.w).width;
      if (lw && lw + sp + ww > W * .84) { lines.push([]); lw = 0; }
      lines[lines.length - 1].push({ ...w, ww }); lw += (lw ? sp : 0) + ww;
    }
    if (lines.length <= 2) break;
    fs *= .86;
  }
  const lh = fs * (style === 'box' ? 1.45 : 1.3), y0 = H * pos - (lines.length - 1) * lh / 2;
  const appear = ez('expo.out')(clamp((t - chunk.s) / .25));
  if (style === 'band' || style === 'hand' || style === 'highlight') ctx.globalAlpha = appear;
  else { const k = ez('back.out(1.7)')(clamp((t - chunk.s) / .2)); ctx.translate(W / 2, H * pos); ctx.scale(k, k); ctx.translate(-W / 2, -H * pos); }
  const accentInk = isLight(P.accent) ? '#111' : '#fff';
  lines.forEach((line, li) => {
    const total = line.reduce((a, w) => a + w.ww, 0) + sp * (line.length - 1);
    let x = (W - total) / 2; const y = y0 + li * lh;
    if (style === 'box') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x - fs * .35, y - lh / 2, total + fs * .7, lh, fs * .25); ctx.fill(); }
    for (const w of line) {
      const isCur = w.i === cur, spoken = t >= w.s, Fw = fontFor(w.i);
      const kp = o.look.fx?.pop && (style === 'pop' ? isCur : w.i === emph) ? kineticPop(t - w.s) : 1;
      ctx.save();
      if (kp !== 1) { ctx.translate(x + w.ww / 2, y); ctx.scale(kp, kp); ctx.translate(-(x + w.ww / 2), -y); }
      ctx.font = fstr(Fw, fs * sizeFor(w.i));
      if (style === 'box') {
        if (isCur) { ctx.fillStyle = P.accent; ctx.beginPath(); ctx.roundRect(x - fs * .12, y - fs * .6, w.ww + fs * .24, fs * 1.2, fs * .15); ctx.fill(); }
        ctx.fillStyle = isCur ? accentInk : '#111'; ctx.fillText(w.w, x, y + fs * .04);
      } else if (style === 'highlight') {
        if (isCur || (spoken && w.i === emph)) marker(ctx, x - fs * .1, y - fs * .6, w.ww + fs * .2, fs * 1.15, ez('power2.out')(clamp((t - w.s) / .18)), P.accent);
        ctx.fillStyle = isCur || (spoken && w.i === emph) ? accentInk : '#fff';
        if (isCur || (spoken && w.i === emph)) ctx.fillText(w.w, x, y); else shadowText(ctx, w.w, x, y, W, .6);
      } else if (style === 'hand' || style === 'band') {
        ctx.fillStyle = w.i === emph ? P.accent : spoken || style === 'band' ? '#fff' : 'rgba(255,255,255,.75)';
        if (style === 'band') ctx.fillText(w.w, x, y); else shadowText(ctx, w.w, x, y, W, .6);
      } else if (style === 'brackets') {
        const isEm = w.i === emph && spoken;
        ctx.fillStyle = isEm || isCur ? P.accent : spoken ? '#fff' : 'rgba(255,255,255,.65)';
        shadowText(ctx, w.w, x, y, W, .6);
        if (isEm) {
          const k = ez('expo.out')(clamp((t - w.s) / .25)), pad = fs * .35 * k + fs * .1, bh = fs * .62, bl = fs * .3;
          ctx.strokeStyle = P.accent; ctx.lineWidth = fs * .07; ctx.beginPath();
          ctx.moveTo(x - pad + bl, y - bh); ctx.lineTo(x - pad, y - bh); ctx.lineTo(x - pad, y + bh); ctx.lineTo(x - pad + bl, y + bh);
          ctx.moveTo(x + w.ww + pad - bl, y - bh); ctx.lineTo(x + w.ww + pad, y - bh); ctx.lineTo(x + w.ww + pad, y + bh); ctx.lineTo(x + w.ww + pad - bl, y + bh);
          ctx.stroke();
        }
      } else { // pop, karaoke
        ctx.lineJoin = 'round'; ctx.lineWidth = fs * .16; ctx.strokeStyle = '#000';
        ctx.strokeText(w.w, x, y);
        ctx.fillStyle = (style === 'pop' ? isCur : spoken) ? P.accent : '#fff';
        ctx.fillText(w.w, x, y);
      }
      ctx.restore();
      x += w.ww + sp;
    }
  });
  ctx.restore();
}

// ---------- Image complète ----------
// o = { look, hook, titleStart, titleDur, motions, media, captions, depth (calque alpha) | null, photos, frame, noSync }
export function render(ctx, W, H, t, o) {
  setFrame(o.frame || null);
  try { renderFrame(ctx, W, H, t, o); } finally { setFrame(null); }
}

function renderFrame(ctx, W, H, t, o) {
  const L = lookContext(o.look);
  const oo = { ...o, pal: palOf(o.look) };
  const isOn = x => t >= x.start && t <= x.start + x.dur;
  const active = (o.motions || []).filter(isOn);
  const media = o.media || [];
  if (!o.noSync) for (const m of media) syncMediaVideo(m, t - m.start, isOn(m));
  const mediaOn = media.filter(isOn);
  let zoom = 1, dim = 0, shrink = null;
  for (const m of active) {
    const lt = t - m.start;
    if (m.type === 'zoom') zoom *= zoomOf(m, lt);
    if (m.type === 'shrink') shrink = m;
    if (DIMS.has(m.type)) dim = Math.max(dim, clamp(stateOf(m, lt).a));
  }
  for (const m of mediaOn) if (MEDIA_DIMS.has(m.layout)) dim = Math.max(dim, ez('power2.out')(clamp(Math.min(t - m.start, m.start + m.dur - t) / .3)));
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  drawVideoRect(ctx, 0, 0, W, H, 0, zoom);
  if (dim > 0) {
    ctx.save(); ctx.globalAlpha = dim; ctx.filter = `blur(${Math.round(W * .02)}px) brightness(.5)`;
    drawVideoRect(ctx, -W * .05, -H * .05, W * 1.1, H * 1.1, 0, zoom);
    ctx.restore();
  }
  const shrunk = shrink ? drawShrink(ctx, W, H, shrink, t - shrink.start, L, zoom) : false;

  const fullMedia = mediaOn.some(m => m.layout === 'full');
  const depthOn = !!(o.depth && !shrunk && !fullMedia);
  const titleOn = o.hook && (o.hook.l1 || o.hook.l2) && t >= o.titleStart && t <= o.titleStart + o.titleDur;
  const covered = dim > .3 || fullMedia || mediaOn.some(m => m.layout === 'split') || (!depthOn && active.some(m => FULLSCREEN.has(m.type)));
  const showTitle = titleOn && !covered;
  const behind = m => depthOn && DEPTH_BEHIND.has(m.type);
  const glow = o.look.fx?.glow ? L.P.accent : null;
  const draw = m => withGlow(ctx, glow && !['checklist', 'versus', 'comment', 'screen', 'stamp', 'colorcard'].includes(m.type) ? glow : null, W,
    () => drawOverlay(ctx, W, H, m, t - m.start, { ...oo, depthBehind: behind(m) }, L));
  const hookP = (t - o.titleStart) / o.titleDur;

  // Couche du milieu : ce qui passe derrière la personne (ou les plein écran sans profondeur).
  for (const m of active) if (FULLSCREEN.has(m.type) && !behind(m)) draw(m);
  let behindDrawn = false;
  for (const m of active) if (behind(m)) { draw(m); behindDrawn = true; }
  if (depthOn && showTitle) { drawHook(ctx, W, H, hookP, o, L, 'back'); behindDrawn = true; }
  if (behindDrawn) drawPerson(ctx, W, H, zoom, o.depth);
  if (depthOn && showTitle && o.look.hook === 'depth') drawHook(ctx, W, H, hookP, o, L, 'front');

  for (const m of mediaOn) drawMedia(ctx, W, H, m, t - m.start, oo);
  for (const m of active) if (!FULLSCREEN.has(m.type) && !behind(m) && m.type !== 'zoom' && m.type !== 'shrink') draw(m);
  if (o.captions && o.captions.chunks.length && !fullMedia && !active.some(m => HIDES_CAPTIONS.has(m.type)))
    withGlow(ctx, glow && o.captions.style !== 'box' ? glow : null, W, () => drawCaptions(ctx, W, H, t, oo, L));
  if (showTitle && !depthOn) withGlow(ctx, glow, W, () => drawHook(ctx, W, H, hookP, o, L));
}

// La personne seule (vidéo × masque alpha), au même cadrage que la vidéo.
let personLayer = null;
function drawPerson(ctx, W, H, zoom, alpha) {
  if (!personLayer) personLayer = document.createElement('canvas');
  if (personLayer.width !== W || personLayer.height !== H) { personLayer.width = W; personLayer.height = H; }
  const g = personLayer.getContext('2d');
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, W, H);
  drawVideoRect(g, 0, 0, W, H, 0, zoom);
  g.globalCompositeOperation = 'destination-in';
  drawFit(g, alpha, 0, 0, W, H, { zoom });
  g.globalCompositeOperation = 'source-over';
  ctx.drawImage(personLayer, 0, 0);
}
