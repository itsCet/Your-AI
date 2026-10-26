// Génère des propositions de montage complètes à partir de l'analyse de la vidéo :
// hook tiré de la transcription, motions placées sur les phrases, les chiffres,
// les questions et les temps forts de la voix.
import { M, FONTS, PALETTES, TITLES, CAPTION_STYLES } from './render.js';
import { sentences } from './analyze.js';

const TEMPLATES = [
  { name: 'Viral punchy', font: 'Anton', pal: 0, title: 'tiles', captions: 'pop', cuts: true, hook: 'first',
    recipe: ['zoom:peaks:3', 'counter', 'comment', 'orbit:.55', 'shrink:end'], cta: 'Abonne-toi' },
  { name: 'Clean pro', font: 'Inter Extra Bold', pal: 5, title: 'banner', captions: 'box', cuts: true, hook: 'first',
    recipe: ['lower', 'carousel:.5', 'zoom:peaks:1', 'shrink:end'], cta: 'Suis-moi pour la suite' },
  { name: 'Storytime', font: 'DM Serif Display', pal: 4, title: 'type', captions: 'karaoke', cuts: false, hook: 'question',
    recipe: ['comment', 'words:.6', 'carousel:.35'] },
  { name: 'Énergie max', font: 'Bebas Neue', pal: 1, title: 'stack', captions: 'pop', cuts: true, hook: 'peak',
    recipe: ['zoom:every', 'orbit:.3', 'counter', 'words:.7', 'carousel:.85'] },
  { name: 'Éducatif', font: 'Archivo Black', pal: 2, title: 'banner', captions: 'box', cuts: true, hook: 'question',
    recipe: ['lower', 'counter', 'words:.5', 'comment', 'shrink:end'], cta: 'Enregistre pour plus tard' },
  { name: 'Minimal', font: 'Space Mono', pal: 3, title: 'type', captions: 'box', cuts: true, hook: 'first',
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

function keyWords(sent) {
  const ws = sent.words.map(w => clean(w.w)).filter(w => w.length >= 4);
  const top = new Set([...ws].sort((a, b) => b.length - a.length).slice(0, 4));
  return ws.filter(w => top.has(w)).slice(0, 4).join(' ');
}

export function makeProposals(A, seed = 0) {
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
    const used = [];
    const free = (a, b) => a >= titleDur && b <= duration - .1 && used.every(([x, y]) => b <= x || a >= y);
    const anchors = (sents.length ? sents.map(s => s.s) : []).concat(
      Array.from({ length: Math.ceil(duration) }, (_, i) => i)).filter(a => a >= titleDur);
    const motions = [];
    const place = (type, prefer, extra = {}) => {
      const dur = M[type].dur;
      const cand = anchors.map(a => Math.max(titleDur, a - .15)).sort((a, b) => Math.abs(a - prefer) - Math.abs(b - prefer));
      const at = cand.find(a => free(a, a + dur));
      if (at == null) return;
      used.push([at, at + dur]);
      motions.push({ type, variant: seed ? Math.floor(r() * 3) : ti % 2, start: +at.toFixed(2), dur, text: M[type].text, ...extra });
    };

    for (const item of t.recipe) {
      const [type, arg, n] = item.split(':');
      if (type === 'zoom') {
        const times = arg === 'every' ? (sents.length ? sents.map(s => s.s) : anchors.filter((_, i) => i % 5 === 0)).filter((x, i, a) => i === 0 || x - a[i - 1] >= 4)
          : peaks.slice(0, +n || 2);
        for (const z of times) if (z >= titleDur && z + M.zoom.dur < duration) motions.push({ type: 'zoom', variant: 0, start: +z.toFixed(2), dur: M.zoom.dur });
      } else if (type === 'counter') {
        const num = findNumber(words);
        if (num) place('counter', num.t, { text: num.text });
      } else if (type === 'comment') {
        const q = sents.find((s, i) => i > 0 && s.text.trim().endsWith('?'));
        const text = q ? q.text.slice(0, 90) : sents.length ? null : pick(r, FALLBACK_COMMENTS);
        if (text) place('comment', q ? q.s : duration * .45, { text });
      } else if (type === 'words') {
        const target = duration * (+arg || .5);
        const s = sents.filter(x => x.words.length >= 3).sort((a, b) => Math.abs(a.s - target) - Math.abs(b.s - target))[0];
        const text = s && keyWords(s);
        if (text) place('words', s.s, { text });
      } else if (type === 'shrink') {
        const last = sents.length ? sents[sents.length - 1].s : duration - M.shrink.dur - .3;
        place('shrink', Math.min(last, duration - M.shrink.dur - .2), { text: t.cta || 'Abonne-toi' });
      } else if (type === 'lower') {
        place('lower', titleDur + .2);
      } else {
        place(type, duration * (+arg || .5));
      }
    }
    motions.sort((a, b) => a.start - b.start);
    return {
      name: T.name, font: t.font, pal: t.pal, title: t.title, titleDur, captions: t.captions, cuts: t.cuts,
      hook: hookFrom(sents, t.hook, peaks, FALLBACK_HOOKS[(ti + seed) % FALLBACK_HOOKS.length], usedHooks),
      motions,
    };
  });
}
