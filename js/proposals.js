// Propositions de montage construites à partir de ce qui est dit dans la vidéo.
// Chaque modèle définit un STYLE (police, couleurs, titre, sous-titres, effets) et une manière
// de traduire les moments repérés par semantics.js en motions. Aucun texte n'est inventé :
// tout vient de la transcription (chiffres, listes, questions, oppositions, mots forts…).
import { M, FONTS, PALETTES, TITLES, CAPTION_STYLES } from './render.js';
import { motionText, itemTimes, TOPIC_PALETTE } from './semantics.js';

// prefer : motion choisie pour chaque type de moment (absent = ce montage ignore ce type).
// density : nombre de motions visé par tranche de 10 s. zoom : punch-in sur les temps forts.
const TEMPLATES = [
  { name: 'Sur mesure', inspo: 'Couleurs adaptées au sujet de ta vidéo, une animation pour chaque idée forte',
    fx: { pop: true, slide: true, glow: false }, font: 'Archivo Black', pal: 'topic', title: 'editorial', captions: 'editorial', media: 'card', density: 1.6, zoom: 2,
    prefer: { list: 'checklist', number: 'statcard', contrast: 'versus', emoji: 'emoji', question: 'prompt', punch: 'kinetic', keyword: 'words', stamp: 'stamp', unique: 'grid' } },
  { name: 'Derrière toi', depth: true, inspo: 'Les mots clés passent en géant derrière ta tête, néon cyan',
    fx: { pop: true, slide: true, glow: true, glowColor: '#00E5FF' }, font: 'Anton', pal: 5, title: 'depth', captions: 'brackets', media: 'card', density: 1.2, zoom: 1,
    prefer: { punch: 'beat', keyword: 'words', number: 'counter', list: 'checklist', contrast: 'versus' } },
  { name: 'Story doré', inspo: 'Cartes lumineuses pour les chiffres et les listes, mot clé en serif doré',
    fx: { pop: true, slide: true, glow: true, glowColor: 'accent' }, font: 'Archivo Black', pal: 6, title: 'editorial', captions: 'editorial', media: 'card', density: 1.3, zoom: 2,
    prefer: { number: 'statcard', list: 'checklist', contrast: 'versus', unique: 'grid', stamp: 'stamp', question: 'prompt', punch: 'kinetic' } },
  { name: 'Ciné cuivré', inspo: 'Phrases fortes en plein écran chaud et granuleux, crochets dorés',
    fx: { pop: true, slide: false, glow: true, glowColor: 'accent' }, font: 'Inter Extra Bold', pal: 8, title: 'stack', captions: 'brackets', media: 'full', density: 1, zoom: 1,
    prefer: { punch: 'kinetic', keyword: 'bigword', number: 'counter', list: 'numbers' } },
  { name: 'Studio crème', inspo: 'Écran partagé, stickers, emoji sur les objets dont tu parles',
    fx: { pop: false, slide: true, glow: false }, font: 'Instrument Serif', pal: 7, title: 'sticker', captions: 'mixte', media: 'split', density: 1.4, zoom: 1,
    prefer: { emoji: 'emoji', list: 'checklist', question: 'prompt', contrast: 'versus', number: 'counter' } },
  { name: 'Rose tag', inspo: 'Titre en étiquettes roses, mots clés qui claquent',
    fx: { pop: true, slide: true, glow: true, glowColor: '#FF3DCB' }, font: 'Inter Extra Bold', pal: 9, title: 'highlight', captions: 'pop', media: 'pip', density: 1.3, zoom: 2,
    prefer: { keyword: 'words', emoji: 'emoji', question: 'comment', stamp: 'stamp', number: 'counter' } },
  { name: 'Clean pro', inspo: 'Sobre : listes et chiffres seulement, bandeau de sous-titres',
    fx: { pop: false, slide: true, glow: false }, font: 'Inter Extra Bold', pal: 5, title: 'banner', captions: 'band', media: 'split', density: .7, zoom: 1,
    prefer: { list: 'checklist', number: 'statcard', contrast: 'versus' } },
  { name: 'Minimal', inspo: 'Juste des sous-titres et un zoom sur les temps forts',
    fx: { pop: false, slide: false, glow: false }, font: 'Space Mono', pal: 3, title: 'type', captions: 'box', media: 'pip', density: 0, zoom: 2, prefer: {} },
];

const FALLBACK_HOOKS = [
  ['Écoute', "ça jusqu'au bout"], ['Stop', 'fais plutôt ça'], ['Le secret', 'que personne ne dit'],
  ['Attends', 'regarde ça'], ['Personne', 'ne parle de ça'], ['Vrai', 'ou faux ?'], ['Regarde', 'bien ça'], ['Voilà', 'comment faire'],
];

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

// Transforme un moment en motion placée dans le temps (le texte vient du moment).
export function motionFromMoment(m, type, variant = 0) {
  const lead = type === 'checklist' || type === 'statcard' || type === 'versus' ? .35 : .15;
  const start = Math.max(0, +(m.t - lead).toFixed(2));
  const base = M[type].dur;
  // La motion dure le temps de l'idée (une liste reste jusqu'à son dernier élément).
  const dur = type === 'checklist' ? Math.min(12, Math.max(base, m.end - start + 1.2))
    : type === 'kinetic' || type === 'versus' ? Math.min(6, Math.max(base, m.end - start + .6)) : base;
  const out = { type, variant, start, dur: +dur.toFixed(2), text: motionText(m, type), momentId: m.id };
  if (type === 'checklist') out.times = itemTimes(m, start);
  if (type === 'versus' && m.turn != null) out.turn = m.turn + (m.t - start);
  return out;
}

// A = { duration, words, peaks, sentences, moments, topic }, media = médias placés [{ start, dur }].
export function makeProposals(A, seed = 0, media = []) {
  const r = rng(seed * 7919 + 1);
  const duration = A.duration || 30;
  const sents = A.sentences || [];
  const peaks = A.peaks || [];
  const moments = A.moments || [];
  const titleDur = 3;
  const usedHooks = new Set();

  return TEMPLATES.map((T, ti) => {
    const t = { ...T };
    if (seed) {
      t.font = pick(r, FONTS).name; t.pal = pick(r, ['topic', ...PALETTES.keys()]);
      t.title = pick(r, TITLES).id; t.captions = pick(r, CAPTION_STYLES).id;
    }
    const pal = t.pal === 'topic' ? (TOPIC_PALETTE[A.topic] ?? 0) : t.pal;
    const used = media.map(m => [m.start, m.start + m.dur]);
    const free = (a, b) => a >= titleDur && b <= duration - .1 && used.every(([x, y]) => b <= x - .3 || a >= y + .3);
    const motions = [];
    // Les moments les plus parlants d'abord, dans la limite de la densité du modèle.
    const budget = Math.round(t.density * duration / 10);
    const ranked = moments.filter(m => t.prefer[m.kind]).map(m => ({ m, s: m.score + r() * (seed ? 3 : .5) })).sort((a, b) => b.s - a.s);
    for (const { m } of ranked) {
      if (motions.length >= budget) break;
      const mo = motionFromMoment(m, t.prefer[m.kind], seed ? Math.floor(r() * 2) : ti % 2);
      if (!free(mo.start, mo.start + mo.dur)) continue;
      used.push([mo.start, mo.start + mo.dur]);
      motions.push(mo);
    }
    for (const z of peaks.slice(0, t.zoom)) {
      if (z >= titleDur && z + M.zoom.dur < duration) motions.push({ type: 'zoom', variant: 0, start: +z.toFixed(2), dur: M.zoom.dur });
    }
    motions.sort((a, b) => a.start - b.start);
    return {
      name: T.name, inspo: T.inspo, fx: { ...T.fx }, depth: !!T.depth, font: t.font, pal, title: t.title, titleDur,
      captions: t.captions, cuts: true, mediaLayout: T.media,
      hook: hookFrom(sents, ti % 3 === 1 ? 'question' : ti % 3 === 2 ? 'peak' : 'first', peaks, FALLBACK_HOOKS[(ti + seed) % FALLBACK_HOOKS.length], usedHooks),
      motions,
    };
  });
}
