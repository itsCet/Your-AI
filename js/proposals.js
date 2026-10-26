// Génère des propositions de montage complètes à partir de l'analyse de la vidéo :
// hook tiré de la transcription, motions placées sur les phrases, les chiffres,
// les questions et les temps forts de la voix.
import { M, FONTS, PALETTES, TITLES, CAPTION_STYLES, clamp } from './render.js';
import { sentences } from './analyze.js';

// Chaque modèle reprend la « personnalité » d'un style de montage repéré dans des reels de référence.
const TEMPLATES = [
  { name: 'Derrière toi', fx: { pop: true, slide: true, glow: true, glowColor: '#00E5FF' }, depth: true,
    inspo: 'Titre géant et mots plein écran qui passent derrière ta tête, néon cyan',
    font: 'Anton', pal: 5, title: 'depth', captions: 'brackets', cuts: true, hook: 'first', media: 'card',
    recipe: ['beat:peak', 'words:.6', 'kinetic:.4', 'zoom:peaks:1'] },
  { name: 'Story doré', fx: { pop: true, slide: true, glow: true, glowColor: 'accent' }, inspo: 'Cartes lumineuses, chiffres, checklist, sous-titres serif dorés',
    font: 'Archivo Black', pal: 6, title: 'editorial', captions: 'editorial', cuts: true, hook: 'first', media: 'card',
    recipe: ['statcard', 'stamp:peak', 'recframe:.45', 'focus:peak2', 'typing', 'zoom:peaks:2'], stamp: '100% vrai' },
  { name: 'Ciné cuivré', fx: { pop: true, slide: false, glow: true, glowColor: 'accent' }, inspo: 'Plein écran chaud et granuleux, BAM sur le rythme, crochets dorés',
    font: 'Inter Extra Bold', pal: 8, title: 'stack', captions: 'brackets', cuts: true, hook: 'peak', media: 'full',
    recipe: ['name', 'kinetic:.35', 'beat:peak', 'spotlight:peak2', 'bigword:.75'] },
  { name: 'Studio crème', fx: { pop: false, slide: true, glow: false }, inspo: 'Écran partagé, stickers blancs, texte tapé, serif italique',
    font: 'Instrument Serif', pal: 7, title: 'sticker', captions: 'mixte', cuts: true, hook: 'first', media: 'split',
    recipe: ['numbers', 'prompt:.55', 'comment', 'zoom:peaks:1'] },
  { name: 'Zéro montage', fx: { pop: true, slide: true, glow: false }, inspo: 'Note manuscrite, carte couleur, tampon « 1 prise »',
    font: 'Playfair italique', pal: 0, title: 'editorial', captions: 'box', cuts: true, hook: 'question', media: 'sticker',
    recipe: ['note:.3', 'colorcard:.55', 'stamp:peak', 'zoom:every'], stamp: '1 prise' },
  { name: 'Rose tag', fx: { pop: true, slide: true, glow: true, glowColor: '#FF3DCB' }, inspo: 'Titre en étiquettes roses, incrustations, word pop',
    font: 'Inter Extra Bold', pal: 9, title: 'highlight', captions: 'pop', cuts: true, hook: 'question', media: 'pip',
    recipe: ['words:.5', 'comment', 'zoom:peaks:2', 'shrink:end'], cta: 'Abonne-toi' },
  { name: 'Viral punchy', fx: { pop: true, slide: false, glow: false }, inspo: 'Tuiles, zooms, orbit de photos, carte de fin',
    font: 'Anton', pal: 0, title: 'tiles', captions: 'pop', cuts: true, hook: 'first', media: 'card',
    recipe: ['zoom:peaks:3', 'counter', 'comment', 'orbit:.55', 'shrink:end'], cta: 'Abonne-toi' },
  { name: 'Clean pro', fx: { pop: false, slide: true, glow: false }, inspo: 'Sobre : bandeau, lower third, carousel',
    font: 'Inter Extra Bold', pal: 5, title: 'banner', captions: 'band', cuts: true, hook: 'first', media: 'split',
    recipe: ['lower', 'carousel:.5', 'zoom:peaks:1', 'shrink:end'], cta: 'Suis-moi pour la suite' },
  { name: 'Minimal', fx: { pop: false, slide: false, glow: false }, inspo: 'Juste des sous-titres et un zoom',
    font: 'Space Mono', pal: 3, title: 'type', captions: 'box', cuts: true, hook: 'first', media: 'pip',
    recipe: ['zoom:peaks:2'] },
];

const FALLBACK_HOOKS = [
  ['Écoute', "ça jusqu'au bout"], ['Stop', 'fais plutôt ça'], ['Le secret', 'que personne ne dit'],
  ['Attends', 'regarde ça'], ['Personne', 'ne parle de ça'], ['Vrai', 'ou faux ?'],
];
const FALLBACK_COMMENTS = ['Tellement vrai, merci pour ce conseil !', 'Je ne savais pas ça du tout', 'Tu peux faire une partie 2 ?'];
const CTAS = ['Abonne-toi', 'Suis-moi pour la suite', 'Enregistre pour plus tard', 'Partie 2 ?'];

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const clean = w => w.replace(/[.,!?;:«»"“”()]/g, '');

const FILLERS = new Set(['and', 'so', 'um', 'uh', 'well', 'like', 'okay', 'ok', 'but', 'et', 'alors', 'donc', 'euh', 'bon', 'bah', 'ben', 'mais', 'voilà', 'bref', 'du', 'coup']);

function hookFrom(sents, mode, peaks, fallback, used) {
  const ordered = [...sents];
  if (mode === 'question') ordered.sort((a, b) => (b.text.trim().endsWith('?') ? 1 : 0) - (a.text.trim().endsWith('?') ? 1 : 0));
  if (mode === 'peak' && peaks.length) ordered.sort((a, b) => Math.abs(a.s - peaks[0]) - Math.abs(b.s - peaks[0]));
  for (const s of ordered) {
    const ws = s.words.map(w => clean(w.w)).filter(Boolean);
    while (ws.length > 2 && FILLERS.has(ws[0].toLowerCase())) ws.shift();
    if (ws.length < 2) continue;
    const n1 = ws[0].length <= 3 && ws.length > 2 ? 2 : 1;
    const l1 = ws.slice(0, n1).join(' ');
    const l2 = ws.slice(n1, n1 + 5).join(' ') + (ws.length > n1 + 5 ? '…' : s.text.trim().endsWith('?') ? ' ?' : '');
    const key = l1 + '|' + l2;
    if (used.has(key)) continue;
    used.add(key);
    return { l1: l1[0].toUpperCase() + l1.slice(1), l2 };
  }
  return { l1: fallback[0], l2: fallback[1] };
}

// Premier nombre prononcé, avec le mot qui le suit (« 10 000 abonnés »).
function findNumber(words) {
  for (let i = 0; i < words.length; i++) {
    if (!/\d/.test(words[i].w)) continue;
    let num = clean(words[i].w).replace(/\D/g, ''), j = i + 1;
    while (j < words.length && /^\d{3}[.,]?$/.test(words[j].w)) { num += words[j].w.replace(/\D/g, ''); j++; }
    const unit = j < words.length && /^[\p{L}%€$]+$/u.test(clean(words[j].w)) ? ' ' + clean(words[j].w) : '';
    if (+num > 0) return { t: words[i].s, text: num + unit };
  }
  return null;
}

// Mots du début de la phrase avant un nombre (« j'ai fait courir » 40 personnes).
function beforeNumber(sents, t) {
  const s = sents.find(x => t >= x.s - .01 && t <= x.e + .01);
  if (!s) return '';
  const i = s.words.findIndex(w => w.s >= t - .01);
  return s.words.slice(Math.max(0, i - 3), i).map(w => clean(w.w)).join(' ');
}
const near = (list, target) => [...list].sort((a, b) => Math.abs(a.s - target) - Math.abs(b.s - target))[0];

function keyWords(sent) {
  const ws = sent.words.map(w => clean(w.w)).filter(w => w.length >= 4);
  const top = new Set([...ws].sort((a, b) => b.length - a.length).slice(0, 4));
  return ws.filter(w => top.has(w)).slice(0, 4).join(' ');
}

// A = analyse { duration, words, peaks }, media = médias déjà placés [{ start, dur }] (le temps qu'ils occupent est réservé).
export function makeProposals(A, seed = 0, media = []) {
  const r = rng(seed * 7919 + 1);
  const duration = A.duration || 30;
  const words = A.words || [];
  const sents = sentences(words);
  const peaks = A.peaks || [];
  const titleDur = 3;
  const usedHooks = new Set();

  return TEMPLATES.map((T, ti) => {
    const t = { ...T };
    if (seed) {
      t.font = pick(r, FONTS).name; t.pal = Math.floor(r() * PALETTES.length);
      t.title = pick(r, TITLES).id; t.captions = pick(r, CAPTION_STYLES).id;
      t.hook = pick(r, ['first', 'question', 'peak']); t.cta = pick(r, CTAS);
    }
    const used = media.map(m => [m.start, m.start + m.dur]);
    const free = (a, b) => a >= titleDur && b <= duration - .1 && used.every(([x, y]) => b <= x || a >= y);
    const anchors = (sents.length ? sents.map(s => s.s) : []).concat(
      Array.from({ length: Math.ceil(duration) }, (_, i) => i)).filter(a => a >= titleDur);
    const motions = [];
    const place = (type, prefer, extra = {}) => {
      const dur = extra.dur ?? M[type].dur;
      const cand = anchors.concat([prefer]).map(a => Math.max(titleDur, a - .15)).sort((a, b) => Math.abs(a - prefer) - Math.abs(b - prefer));
      const at = cand.find(a => free(a, a + dur));
      if (at == null) return;
      used.push([at, at + dur]);
      motions.push({ type, variant: seed ? Math.floor(r() * 3) : ti % 2, start: +at.toFixed(2), dur, text: M[type].text, ...extra });
    };
    const peakAt = arg => arg === 'peak2' ? (peaks[1] ?? peaks[0]) : arg === 'peak' ? peaks[0] : null;
    const at = arg => peakAt(arg) ?? duration * (+arg || .5);
    const sentNear = (arg, min = 3, max = 99) => near(sents.filter(x => x.words.length >= min && x.words.length <= max), at(arg));

    for (const item of t.recipe) {
      const [type, arg, n] = item.split(':');
      if (type === 'zoom') {
        const times = arg === 'every' ? (sents.length ? sents.map(s => s.s) : anchors.filter((_, i) => i % 5 === 0)).filter((x, i, a) => i === 0 || x - a[i - 1] >= 4)
          : peaks.slice(0, +n || 2);
        for (const z of times) if (z >= titleDur && z + M.zoom.dur < duration) motions.push({ type: 'zoom', variant: 0, start: +z.toFixed(2), dur: M.zoom.dur });
      } else if (type === 'counter') {
        const num = findNumber(words);
        if (num) place('counter', num.t, { text: num.text });
      } else if (type === 'statcard') {
        const num = findNumber(words);
        if (num) {
          const [value, ...unit] = num.text.split(' ');
          place('statcard', num.t - .3, { text: `${beforeNumber(sents, num.t) || 'Le chiffre'}|${value}+|${unit.join(' ') || 'au total'}` });
        }
      } else if (type === 'comment') {
        const q = sents.find((s, i) => i > 0 && s.text.trim().endsWith('?'));
        const text = q ? q.text.slice(0, 90) : sents.length ? null : pick(r, FALLBACK_COMMENTS);
        if (text) place('comment', q ? q.s : duration * .45, { text });
      } else if (type === 'words') {
        const s = sentNear(arg);
        const text = s && keyWords(s);
        if (text) place('words', s.s, { text });
      } else if (type === 'shrink') {
        const last = sents.length ? sents[sents.length - 1].s : duration - M.shrink.dur - .3;
        place('shrink', Math.min(last, duration - M.shrink.dur - .2), { text: t.cta || 'Abonne-toi' });
      } else if (type === 'lower' || type === 'name') {
        place(type, titleDur + .2);
      } else if (type === 'stamp') {
        place('stamp', at(arg), { text: t.stamp || '100% vrai' });
      } else if (type === 'typing') {
        const s = sents.find((x, i) => i > 0 && x.s - sents[i - 1].e >= .5);
        if (s) place('typing', s.s - M.typing.dur);
      } else if (type === 'numbers') {
        const w = words.find(x => /^(premi|deuxi|troisi|[ée]tape|step|first|second|third)/i.test(x.w));
        if (w) place('numbers', w.s);
      } else if (type === 'prompt') {
        const s = sentNear(arg, 3, 7);
        if (s) place('prompt', s.s, { text: s.text });
      } else if (type === 'kinetic') {
        const s = sentNear(arg, 3, 7);
        if (s) place('kinetic', s.s, { text: s.text, dur: clamp(s.e - s.s + .6, 1.8, 4) });
      } else if (type === 'note' || type === 'colorcard') {
        const s = sentNear(arg);
        const text = s && keyWords(s).split(' ').slice(0, type === 'note' ? 3 : 2).join(' ').toLowerCase();
        if (text) place(type, s.s, { text });
      } else if (type === 'beat') {
        const s = sentNear(arg);
        const text = s && keyWords(s).split(' ').slice(0, 3).join(' ');
        if (text) place('beat', at(arg), { text: text.toUpperCase() });
      } else if (type === 'bigword') {
        const s = sentNear(arg);
        const text = s && keyWords(s).split(' ').sort((a, b) => b.length - a.length)[0];
        if (text) place('bigword', s.s, { text: text.toLowerCase() });
      } else {
        place(type, at(arg));
      }
    }
    motions.sort((a, b) => a.start - b.start);
    return {
      name: T.name, inspo: T.inspo, fx: { ...T.fx }, depth: !!T.depth, font: t.font, pal: t.pal, title: t.title, titleDur, captions: t.captions, cuts: t.cuts,
      mediaLayout: T.media,
      hook: hookFrom(sents, t.hook, peaks, FALLBACK_HOOKS[(ti + seed) % FALLBACK_HOOKS.length], usedHooks),
      motions,
    };
  });
}
