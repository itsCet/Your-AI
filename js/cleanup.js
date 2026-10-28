// Nettoyage automatique d'une prise face caméra, d'après la skill cut-video
// (github.com/louisedesadeleer/cut-video, repérée dans awesome-claude-video-skills) :
// hésitations (« euh »), tics de langage (« en fait », « du coup »…), répétitions et faux départs,
// reprises d'une phrase entière (on garde la dernière prise), et pauses resserrées selon le rythme choisi.
// Rien n'est effacé : les mots sont barrés dans l'Édition, avec la raison, et se rétablissent d'un clic.
import { HOP, silenceThreshold } from './analyze.js';

const core = w => String(w).toLowerCase().replace(/^[«"“(¿¡]+|[.,!?;:»"”)…]+$/g, '').replace(/’/g, '\'');
const endsSentence = w => /[.?!…]$/.test(w);
const endsClause = w => /[,;:]$/.test(w);

// Hésitations : toujours coupées quand elles sont seules.
const FILLERS = new Set(['euh', 'euhh', 'euhhh', 'heu', 'heuu', 'hum', 'humm', 'hmm', 'hm', 'mmh', 'mh', 'bah', 'beh', 'ben', 'uh', 'uhh', 'um', 'umm', 'er', 'erm', 'eh']);
// Tics de langage (quand ils servent de remplissage, pas de sens). Expressions de plusieurs mots d'abord.
const HEDGES = [
  ['en', 'fait'], ['du', 'coup'], ['tu', 'vois'], ['vous', 'voyez'], ['en', 'gros'], ['je', 'veux', 'dire'], ['j\'veux', 'dire'], ['on', 'va', 'dire'],
  ['tu', 'sais'], ['vous', 'savez'], ['you', 'know'], ['i', 'mean'], ['kind', 'of'], ['sort', 'of'], ['or', 'whatever'], ['or', 'something'],
  ['genre'], ['voilà'], ['bref'], ['basically'], ['literally'], ['actually'],
];
// Tics seulement en début de phrase (« Bon, », « Alors, », « So »…).
const OPENERS = new Set(['bon', 'alors', 'donc', 'bref', 'so', 'okay', 'ok', 'well', 'right', 'anyway']);

export const RHYTHMS = [
  { id: 'soft', name: 'Doux', desc: 'Garde le souffle : seuls les blancs de plus de 0,6 s sont raccourcis (à 0,5 s)', min: .6, keep: .5, hedges: false },
  { id: 'balanced', name: 'Équilibré', desc: 'Les blancs de plus de 0,35 s sont ramenés à 0,3 s', min: .35, keep: .3, hedges: false },
  { id: 'tight', name: 'Serré', desc: 'Rythme des reels : pauses de plus de 0,25 s ramenées à 0,1 s, tics de langage coupés', min: .25, keep: .1, hedges: true },
];
export const rhythmOf = id => RHYTHMS.find(r => r.id === id) || RHYTHMS[1];

/**
 * Pauses à couper, mesurées sur l'audio (les horodatages de Whisper cachent souvent les pauses dans les mots).
 * On garde un peu plus d'air après la voix (fins de mots douces) qu'avant.
 * Retourne { segs: [[a, b]], lowRange } ; lowRange = micro trop bruité pour distinguer voix et silence.
 */
export function pauseCuts(db, duration, rhythm, sensitivity = .3) {
  if (!db || !db.length) return { segs: [], lowRange: false };
  const sorted = Array.from(db).filter(isFinite).sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * .1)], voice = sorted[Math.floor(sorted.length * .9)];
  const lowRange = voice - floor < 8;
  const thr = silenceThreshold(db, sensitivity), r = rhythmOf(rhythm), segs = [];
  const tail = r.keep * .6, lead = r.keep * .4;
  let start = -1;
  for (let i = 0; i <= db.length; i++) {
    const quiet = i < db.length && db[i] < thr;
    if (quiet && start < 0) start = i;
    if (!quiet && start >= 0) {
      const a = start * HOP, b = i * HOP;
      if (b - a >= r.min) {
        if (a <= HOP) segs.push([0, Math.max(0, b - lead)]);
        else if (b >= duration - HOP) segs.push([a + tail, duration]);
        else segs.push([a + tail, b - lead]);
      }
      start = -1;
    }
  }
  return { segs: segs.filter(([a, b]) => b - a >= .08), lowRange };
}

/**
 * Mots à couper. words = [{ w, s, e }], opts = { fillers, hedges, repeats, retakes }.
 * Retourne [{ a, b, why }] (index de mots inclus).
 */
export function wordCuts(words, opts) {
  const out = [], taken = new Set();
  const add = (a, b, why) => {
    for (let i = a; i <= b; i++) if (taken.has(i)) return;
    for (let i = a; i <= b; i++) taken.add(i);
    out.push({ a, b, why });
  };
  const c = words.map(w => core(w.w));
  const sentStart = i => i === 0 || endsSentence(words[i - 1].w) || words[i].s - words[i - 1].e > 1;

  // Reprises : deux phrases qui commencent pareil (3 premiers mots) à moins de 60 s → on garde la dernière.
  if (opts.retakes) {
    const sents = [];
    let cur = null;
    words.forEach((w, i) => { if (!cur || sentStart(i)) { cur = { a: i, b: i }; sents.push(cur); } cur.b = i; });
    for (let k = 0; k < sents.length - 1; k++) {
      const A = sents[k], key = c.slice(A.a, A.a + 3).join(' ');
      if (A.b - A.a < 2 || !key.trim()) continue;
      const B = sents.slice(k + 1).find(s => words[s.a].s - words[A.a].s < 60 && c.slice(s.a, s.a + 3).join(' ') === key);
      if (B) add(A.a, A.b, 'reprise : tu redis cette phrase plus loin, la dernière prise est gardée');
    }
  }
  // Faux départs et répétitions : la même suite de 1 à 3 mots dite deux fois d'affilée → on coupe la première.
  if (opts.repeats) {
    for (let i = 0; i < words.length; i++) {
      for (const n of [3, 2, 1]) {
        if (i + 2 * n > words.length) continue;
        const a = c.slice(i, i + n).join(' '), b = c.slice(i + n, i + 2 * n).join(' ');
        if (a && a === b && words[i + n].s - words[i].s < 3 && !(n === 1 && c[i].length < 2)) { add(i, i + n - 1, 'répétition'); break; }
      }
    }
  }
  if (opts.fillers) c.forEach((w, i) => { if (FILLERS.has(w)) add(i, i, 'hésitation'); });
  if (opts.hedges) {
    for (let i = 0; i < words.length; i++) {
      for (const h of HEDGES) {
        if (c.slice(i, i + h.length).join(' ') !== h.join(' ')) continue;
        // « genre » / « kind of » suivis de « de » / un nom gardent leur sens : on ne coupe que le remplissage
        // (entre virgules, en début ou en fin de phrase).
        const last = words[i + h.length - 1], next = c[i + h.length];
        const loose = sentStart(i) || endsClause(last.w) || endsSentence(last.w) || (i > 0 && endsClause(words[i - 1].w));
        if (h[0] === 'genre' && (next === 'de' || next === 'd\'')) continue;
        if (loose) add(i, i + h.length - 1, 'tic de langage');
      }
      if (OPENERS.has(c[i]) && sentStart(i) && i + 1 < words.length && !endsSentence(words[i].w)) add(i, i, 'tic de langage (début de phrase)');
      // « …, quoi. » en fin de phrase.
      if (c[i] === 'quoi' && endsSentence(words[i].w) && i > 0 && !endsSentence(words[i - 1].w)) add(i, i, 'tic de langage');
    }
  }
  return out.sort((x, y) => x.a - y.a);
}

// Résumé façon cut-video : durée avant / après, part coupée, nombre de coupes par raison, durée médiane d'un plan.
export function cleanupSummary(duration, cutSegs, words) {
  const cut = cutSegs.reduce((s, [a, b]) => s + (b - a), 0);
  const keeps = [];
  let t = 0;
  for (const [a, b] of cutSegs) { if (a - t > .05) keeps.push(a - t); t = Math.max(t, b); }
  if (duration - t > .05) keeps.push(duration - t);
  keeps.sort((a, b) => a - b);
  const why = {};
  for (const w of words) if (w.cut && w.cutWhy) why[w.cutWhy.split(' :')[0]] = (why[w.cutWhy.split(' :')[0]] || 0) + 1;
  return { before: duration, after: duration - cut, pct: duration ? cut / duration : 0, plans: keeps.length, median: keeps[Math.floor(keeps.length / 2)] || duration, why };
}
