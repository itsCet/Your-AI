// Tout ce qui dessine : une seule fonction render() produit une image complète,
// utilisée à l'identique pour les vignettes, l'aperçu et l'export.

export const FONTS = [
  { name: 'Anton', family: 'Anton', weight: 400 },
  { name: 'Bebas Neue', family: 'Bebas Neue', weight: 400 },
  { name: 'Archivo Black', family: 'Archivo Black', weight: 400 },
  { name: 'DM Serif Display', family: 'DM Serif Display', weight: 400 },
  { name: 'Space Mono', family: 'Space Mono', weight: 700 },
  { name: 'Inter Extra Bold', family: 'Inter', weight: 800 },
];

export const PALETTES = [
  { name: 'Sunshine', accent: '#FFD60A', text: '#FFFFFF', ink: '#111111' },
  { name: 'Signal', accent: '#FF3B30', text: '#FFFFFF', ink: '#111111' },
  { name: 'Electric', accent: '#2F6BFF', text: '#FFFFFF', ink: '#0B0B0B' },
  { name: 'Mint', accent: '#3DDC97', text: '#FFFFFF', ink: '#0E1B14' },
  { name: 'Bubblegum', accent: '#FF4FA3', text: '#FFFFFF', ink: '#1A0710' },
  { name: 'Mono', accent: '#FFFFFF', text: '#FFFFFF', ink: '#000000' },
];

export const TITLES = [
  { id: 'tiles', name: 'Tuiles', desc: 'Lettres en tuiles qui tombent' },
  { id: 'stack', name: 'Empilé', desc: 'Gros texte, 2e ligne en accent' },
  { id: 'banner', name: 'Bandeau', desc: 'Bandes de couleur qui balaient' },
  { id: 'type', name: 'Machine à écrire', desc: 'Le texte se tape lettre par lettre' },
];

export const CAPTION_STYLES = [
  { id: 'pop', name: 'Pop', desc: 'Majuscules, mot prononcé en couleur' },
  { id: 'box', name: 'Boîte', desc: 'Texte sur fond blanc, mot surligné' },
  { id: 'karaoke', name: 'Karaoké', desc: 'Les mots se colorent au fil de la voix' },
];

export const MOTIONS = [
  { id: 'orbit', name: 'Orbit', desc: 'Des photos tournent autour de toi', dur: 3 },
  { id: 'carousel', name: 'Carousel', desc: 'Des cartes défilent en ligne', dur: 3 },
  { id: 'shrink', name: 'Shrink card', desc: 'La vidéo rétrécit sur une carte couleur', dur: 3, text: 'True dreams' },
  { id: 'comment', name: 'Comment pop-up', desc: 'Une bulle de commentaire apparaît', dur: 2.6, text: 'Love this, tell me more!' },
  { id: 'counter', name: 'Compteur', desc: 'Un chiffre qui monte', dur: 2.4, text: '10000 vues' },
  { id: 'words', name: 'Word pop', desc: 'Les mots claquent un par un', dur: 2.4, text: 'Film once post all week' },
  { id: 'zoom', name: 'Punch-in', desc: 'Zoom rapide sur ton visage', dur: 1.6 },
  { id: 'lower', name: 'Lower third', desc: 'Bandeau nom qui glisse', dur: 3, text: 'Ton Nom · Créateur' },
];
export const M = Object.fromEntries(MOTIONS.map(m => [m.id, m]));

// Motions qui occupent le centre de l'écran : les sous-titres se masquent pendant ce temps.
const HIDES_CAPTIONS = new Set(['words', 'counter', 'shrink']);

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const ease = p => 1 - Math.pow(1 - clamp(p), 3);
export const backOut = p => { p = clamp(p); const c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
export const env = (p, a = .15, b = .15) => Math.min(ease(p / a), ease((1 - p) / b));
export const fontOf = name => FONTS.find(f => f.name === name) || FONTS[0];
export const fstr = (F, size) => `${F.weight} ${Math.round(size)}px "${F.family}"`;
const UI = { family: 'Inter', weight: 600 };
const UI_BOLD = { family: 'Inter', weight: 800 };

let video = null;
export function setVideo(v) { video = v; }

function fitSize(ctx, text, F, maxW, size) {
  ctx.font = fstr(F, size);
  const w = ctx.measureText(text).width;
  return w > maxW ? size * maxW / w : size;
}
function wrap(ctx, text, maxW) {
  const lines = []; let cur = '';
  for (const w of text.split(/\s+/)) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

// Dessine la vidéo en "cover" dans un rectangle (avec zoom et coins arrondis optionnels)
function drawVideoRect(ctx, x, y, w, h, r = 0, zoom = 1, cropY = .5) {
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
  if (video && video.readyState >= 2 && video.videoWidth) {
    const vw = video.videoWidth, vh = video.videoHeight;
    const k = Math.max(w / vw, h / vh) * zoom;
    const dw = vw * k, dh = vh * k;
    ctx.drawImage(video, x + (w - dw) / 2, y + (h - dh) * cropY, dw, dh);
  } else {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#3a3530'); g.addColorStop(1, '#14161c');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.beginPath(); ctx.arc(x + w / 2, y + h * .42, w * .17, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * .82, w * .36, h * .2, 0, 0, 7); ctx.fill();
  }
  ctx.restore();
}

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
  }
  ctx.restore();
}

// ---------- Sous-titres ----------
function drawCaptions(ctx, W, H, t, o) {
  const cap = o.captions;
  const chunk = cap.chunks.find(c => t >= c.s && t <= c.e + .15);
  if (!chunk) return;
  const P = PALETTES[o.pal];
  const style = cap.style;
  const F = style === 'box' ? UI_BOLD : fontOf(o.font);
  const words = chunk.words.map(w => ({ ...w, w: style === 'box' ? w.w : w.w.toUpperCase() }));
  const cur = words.findIndex(w => t >= w.s && t < w.e + .05);
  let fs = W * (style === 'box' ? .06 : .085);
  ctx.save();
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  // Mise en page en 2 lignes max, taille réduite si nécessaire.
  let lines;
  for (let k = 0; k < 6; k++) {
    ctx.font = fstr(F, fs);
    const sp = ctx.measureText(' ').width;
    lines = [[]]; let lw = 0;
    for (const w of words) {
      const ww = ctx.measureText(w.w).width;
      if (lw && lw + sp + ww > W * .84) { lines.push([]); lw = 0; }
      lines[lines.length - 1].push({ ...w, ww }); lw += (lw ? sp : 0) + ww;
    }
    if (lines.length <= 2) break;
    fs *= .85;
  }
  const sp = ctx.measureText(' ').width;
  const lh = fs * (style === 'box' ? 1.45 : 1.2);
  const y0 = H * cap.pos - (lines.length - 1) * lh / 2;
  const pop = backOut((t - chunk.s) / .18);
  ctx.translate(W / 2, H * cap.pos); ctx.scale(pop, pop); ctx.translate(-W / 2, -H * cap.pos);
  lines.forEach((line, li) => {
    const total = line.reduce((a, w) => a + w.ww, 0) + sp * (line.length - 1);
    let x = (W - total) / 2; const y = y0 + li * lh;
    if (style === 'box') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.roundRect(x - fs * .35, y - lh / 2, total + fs * .7, lh, fs * .25); ctx.fill();
    }
    for (const w of line) {
      const idx = words.findIndex(z => z.s === w.s && z.w === w.w);
      const isCur = idx === cur;
      const spoken = t >= w.s;
      if (style === 'box') {
        if (isCur) { ctx.fillStyle = P.accent === '#FFFFFF' ? '#FFD60A' : P.accent; ctx.beginPath(); ctx.roundRect(x - fs * .12, y - fs * .6, w.ww + fs * .24, fs * 1.2, fs * .15); ctx.fill(); }
        ctx.fillStyle = '#111111'; ctx.fillText(w.w, x, y + fs * .04);
      } else {
        ctx.save();
        if (style === 'pop' && isCur) { ctx.translate(x + w.ww / 2, y); ctx.scale(1.12, 1.12); ctx.translate(-(x + w.ww / 2), -y); }
        ctx.lineJoin = 'round'; ctx.lineWidth = fs * .18; ctx.strokeStyle = '#000000';
        ctx.strokeText(w.w, x, y);
        const on = style === 'pop' ? isCur : spoken;
        ctx.fillStyle = on ? (P.accent === '#FFFFFF' ? '#FFD60A' : P.accent) : '#FFFFFF';
        ctx.fillText(w.w, x, y);
        ctx.restore();
      }
      x += w.ww + sp;
    }
  });
  ctx.restore();
}

// ---------- Motions ----------
function card(ctx, cx, cy, w, h, rot, color, photo) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = w * .15; ctx.shadowOffsetY = w * .05;
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, w * .07); ctx.fill();
  ctx.shadowColor = 'transparent';
  if (photo) { const pad = w * .08; drawVideoRect(ctx, -w / 2 + pad, -h / 2 + pad, w - pad * 2, h - pad * 3.2, w * .04, 1.8, .3); }
  ctx.restore();
}

function drawMotion(ctx, W, H, m, lt, o) {
  const F = fontOf(o.font), P = PALETTES[o.pal];
  const p = lt / m.dur, v = m.variant || 0;
  const [c1, c2] = v % 2 ? [P.accent, P.text] : [P.text, P.accent];
  const dir = v % 3 === 2 ? -1 : 1;
  const text = m.text ?? M[m.type].text ?? '';
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  if (m.type === 'orbit') {
    const e = env(p, .15, .15), N = 6;
    const items = [...Array(N)].map((_, i) => { const th = i / N * Math.PI * 2 + dir * lt * 1.8; return { i, th, z: Math.sin(th) }; })
      .sort((a, b) => a.z - b.z);
    for (const it of items) {
      const d = (it.z + 1) / 2, s = .7 + .3 * d, w = W * .17 * s;
      ctx.globalAlpha = e * (.5 + .5 * d);
      card(ctx, W / 2 + Math.cos(it.th) * W * .38 * e, H * .6 + it.z * H * .045, w, w * 1.25, Math.cos(it.th) * .15,
        it.i % 2 ? c2 : c1, it.i % 2 === 0);
    }
  } else if (m.type === 'carousel') {
    const N = 7, w = W * .22, sp = w * 1.12;
    const travel = W + N * sp;
    for (let i = 0; i < N; i++) {
      let x = W + w - ease(p * .95) * travel + i * sp;
      if (dir < 0) x = W - x;
      const near = Math.max(0, 1 - Math.abs(x - W / 2) / (W * .35));
      const s = 1 + .18 * near;
      ctx.globalAlpha = env(p, .05, .08);
      card(ctx, x, H * .58, w * s, w * 1.3 * s, 0, i % 2 ? c2 : c1, i % 2 === 0);
    }
  } else if (m.type === 'comment') {
    const inP = backOut(p / .14), outA = ease((1 - p) / .12);
    const y = v % 2 ? H * .62 : H * .26, bw = W * .84;
    const fs = W * .045;
    ctx.font = fstr(UI, fs);
    const lines = wrap(ctx, text, bw * .7).slice(0, 3);
    const bh = fs * 2.6 + lines.length * fs * 1.3;
    ctx.translate(W / 2, y); ctx.scale(inP, inP); ctx.globalAlpha = outA * clamp(p / .05);
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = W * .04;
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(-bw / 2, -bh / 2, bw, bh, fs * .9); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-bw * .3, bh / 2 - 1); ctx.lineTo(-bw * .36, bh / 2 + fs * 1.1); ctx.lineTo(-bw * .2, bh / 2 - 1); ctx.fill();
    ctx.shadowColor = 'transparent';
    const ax = -bw / 2 + fs * 1.9;
    ctx.fillStyle = P.accent === '#FFFFFF' ? '#111' : P.accent; ctx.beginPath(); ctx.arc(ax, -bh / 2 + fs * 1.7, fs * 1.05, 0, 7); ctx.fill();
    ctx.textAlign = 'left'; ctx.fillStyle = '#888';
    ctx.font = fstr(UI, fs * .8); ctx.fillText('@viewer', ax + fs * 1.6, -bh / 2 + fs * 1.4);
    ctx.fillStyle = '#111'; ctx.font = fstr(UI, fs);
    lines.forEach((l, i) => ctx.fillText(l, ax + fs * 1.6, -bh / 2 + fs * 2.7 + i * fs * 1.3));
  } else if (m.type === 'counter') {
    const target = parseInt((text.match(/\d+/) || ['10000'])[0], 10);
    const val = Math.round(target * ease(p / .7)).toLocaleString('fr-FR').replace(/ | /g, ' ');
    const str = /\d/.test(text) ? text.replace(/\d+/, val) : val;
    const fs = fitSize(ctx, str, F, W * .86, W * .2);
    ctx.globalAlpha = env(p, .08, .12);
    const sc = backOut(p / .12);
    ctx.translate(W / 2, H * .55); ctx.scale(sc, sc);
    ctx.font = fstr(F, fs);
    const tw = ctx.measureText(str).width;
    ctx.fillStyle = P.accent; ctx.fillRect(-tw / 2, fs * .38, tw * ease(p / .7), fs * .1);
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = W * .03;
    ctx.fillStyle = c1; ctx.fillText(str, 0, 0);
  } else if (m.type === 'words') {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length) {
      const idx = Math.min(words.length - 1, Math.floor(clamp(p) * words.length));
      const wp = clamp(p) * words.length - idx;
      const word = words[idx].toUpperCase();
      const fs = fitSize(ctx, word, F, W * .78, W * .16);
      ctx.font = fstr(F, fs);
      const tw = ctx.measureText(word).width;
      const sc = backOut(wp / .3);
      ctx.translate(W / 2, H * .62); ctx.scale(sc, sc);
      if (v % 2 === 0) {
        ctx.fillStyle = P.accent; ctx.beginPath(); ctx.roundRect(-tw / 2 - fs * .25, -fs * .65, tw + fs * .5, fs * 1.3, fs * .15); ctx.fill();
        ctx.fillStyle = P.ink;
      } else {
        ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = W * .03; ctx.fillStyle = P.accent;
      }
      ctx.fillText(word, 0, fs * .04);
    }
  } else if (m.type === 'lower') {
    const [name, role] = text.split('·').map(s => s.trim());
    const fs = W * .06, y = H * .86;
    ctx.textAlign = 'left';
    ctx.font = fstr(F, fs); const nw = ctx.measureText(name || '').width;
    ctx.font = fstr(UI, fs * .5); const rw = ctx.measureText(role || '').width;
    const bw = Math.max(nw, rw) + fs * 1.4, bh = fs * (role ? 2.3 : 1.6);
    const inX = ease(p / .2), outX = ease((1 - p) / .15);
    const x = W * .06 - (1 - Math.min(inX, outX)) * (bw + W * .1);
    ctx.fillStyle = P.accent; ctx.fillRect(x, y - bh / 2, fs * .25, bh);
    ctx.fillStyle = 'rgba(10,10,10,.85)'; ctx.fillRect(x + fs * .25, y - bh / 2, bw, bh);
    ctx.fillStyle = P.text; ctx.font = fstr(F, fs); ctx.fillText(name || '', x + fs * .8, y - (role ? fs * .3 : 0));
    if (role) { ctx.fillStyle = P.accent; ctx.font = fstr(UI, fs * .5); ctx.fillText(role, x + fs * .8, y + fs * .55); }
  }
  ctx.restore();
}

// ---------- Image complète ----------
// o = { title, font, pal, hook, titleStart, titleDur, motions: [{type, variant, start, dur, text}], captions: {style, pos, chunks} | null }
export function render(ctx, W, H, t, o) {
  const P = PALETTES[o.pal], F = fontOf(o.font);
  const active = o.motions.filter(m => t >= m.start && t <= m.start + m.dur);
  let zoom = 1, shrink = null;
  for (const m of active) {
    const p = (t - m.start) / m.dur;
    if (m.type === 'zoom') zoom *= 1 + .25 * env(p, .15, .25);
    if (m.type === 'shrink') shrink = { m, e: env(p, .2, .18) };
  }
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  drawVideoRect(ctx, 0, 0, W, H, 0, zoom);

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
  const titleOn = o.title && t >= o.titleStart && t <= o.titleStart + o.titleDur;
  if (o.captions && o.captions.chunks.length && !active.some(m => HIDES_CAPTIONS.has(m.type))) drawCaptions(ctx, W, H, t, o);
  if (titleOn) drawTitle(ctx, W, H, (t - o.titleStart) / o.titleDur, o);
  for (const m of active) if (m.type !== 'zoom' && m.type !== 'shrink') drawMotion(ctx, W, H, m, t - m.start, o);
}
