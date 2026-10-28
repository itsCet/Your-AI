// Plan de montage : quelles animations, à quel moment, avec quel texte.
// - autoPlan : premier montage automatique à partir des moments repérés dans la transcription
//   (semantics.js), avec seulement les éléments et motions cochés dans le look.
// - claudePrompt / parsePlan / applyPlan : aller-retour avec Claude dans la conversation.
import { CATALOG } from './look.js';
import { analyzeContent } from './semantics.js';
import { TRANSITIONS } from './transitions.js';

const LEAD = { checklist: .35, statcard: .3, versus: .3, screen: .3, shrink: .25, kinetic: .1 };
const clean = w => String(w).replace(/[.,!?;:«»"“”()…]/g, '');
const firstWords = (s, n) => String(s || '').split(/\s+/).slice(0, n).join(' ').replace(/[,;:]$/, '');

export const wordIndexAt = (words, t) => {
  let best = 0;
  for (let i = 0; i < words.length; i++) { if (words[i].s <= t + .01) best = i; else break; }
  return best;
};

// Champs d'un élément à partir d'un moment repéré (le texte vient de la vidéo).
function fieldsFor(type, m) {
  switch (type) {
    case 'statcard': return { label: m.before || '', value: m.big || m.display || '', unit: m.unit && !/^[%€$]$/.test(m.unit) ? m.unit : '' };
    case 'counter': return { value: m.big || m.display || '', label: m.unit && !/^[%€$]$/.test(m.unit) ? m.unit : (m.before || '') };
    case 'checklist': return { title: m.title || '', items: (m.items || []).map(i => i.text) };
    case 'versus': return { bad: m.left || '', good: m.right || '' };
    case 'emoji': return { emoji: m.emoji, word: String(m.text || '').split('|')[1] || '' };
    case 'comment': return { name: 'un abonné', text: m.text };
    case 'kinetic': return { text: firstWords(m.sentence || m.text, 8) };
    case 'wordreveal': return { text: firstWords(m.sentence || m.text, 9), mark: m.kind === 'keyword' ? m.text : '' };
    case 'note': return { text: clean(m.kind === 'keyword' ? m.text : firstWords(m.text, 3)).toLowerCase() };
    case 'colorcard': return { top: firstWords(m.kind === 'punch' ? m.text : (m.sentence || m.text), 5) };
    case 'stamp': return { text: m.text };
    case 'shrink': return { top: m.kind === 'keyword' ? m.text : firstWords(m.text, 3), bottom: '' };
    case 'beat': return { words: String(m.sentence || m.text).split(/\s+/).map(clean).filter(w => w.length > 3).slice(0, 3).join(' ').toUpperCase() };
    default: return {};
  }
}

// Types possibles pour chaque sorte de moment, par ordre de préférence.
const PREFS = {
  number: ['statcard', 'counter', 'stamp'],
  list: ['checklist'],
  contrast: ['versus'],
  emoji: ['emoji', 'note'],
  question: ['comment', 'wordreveal'],
  punch: ['kinetic', 'wordreveal', 'colorcard', 'shrink', 'beat'],
  keyword: ['wordreveal', 'note', 'colorcard', 'shrink'],
  stamp: ['stamp', 'note'],
  unique: ['note', 'stamp'],
};

export function itemFromMoment(m, type, words, uid) {
  const def = CATALOG[type];
  const start = Math.max(0, +(m.t - (LEAD[type] ?? .15)).toFixed(2));
  let dur = def.dur;
  if (type === 'checklist') dur = Math.min(12, Math.max(def.dur, (m.end ?? m.t) - start + 1.2));
  if (type === 'kinetic' || type === 'versus' || type === 'wordreveal') dur = Math.min(6, Math.max(def.dur, (m.end ?? m.t) - start + .6));
  const it = { uid, type, start, dur: +dur.toFixed(2), f: fieldsFor(type, m), variant: uid % 2, w0: wordIndexAt(words, m.t), from: 'auto' };
  if (type === 'checklist' && m.items) it.times = m.items.map(i => Math.max(.1, +(i.t - start).toFixed(2)));
  if (type === 'versus' && m.turn != null) it.turn = +(m.turn + (m.t - start)).toFixed(2);
  return it;
}

/**
 * Montage automatique. A = analyse { words, peaks, duration }, look = look choisi,
 * blocked = intervalles déjà occupés (médias). Retourne { items, moments }.
 */
export function autoPlan(A, look, blocked = [], startUid = 1) {
  const sem = analyzeContent(A.words || [], A.peaks || [], A.duration || 0);
  const allowed = new Set([...(look.elements || []), ...(look.motion || [])]);
  const used = blocked.map(b => [b.start, b.start + b.dur]);
  const free = (a, b) => a >= 2.6 && b <= (A.duration || 1e9) - .1 && used.every(([x, y]) => b <= x - .3 || a >= y + .3);
  const items = [];
  let uid = startUid;
  const budget = Math.max(2, Math.round((A.duration || 30) / 4.5));
  const count = {};
  for (const m of [...sem.moments].sort((a, b) => b.score - a.score)) {
    if (items.length >= budget) break;
    // Varier : on évite de répéter trop souvent le même type.
    const type = (PREFS[m.kind] || []).filter(t => allowed.has(t)).sort((a, b) => (count[a] || 0) - (count[b] || 0))[0];
    if (!type) continue;
    const it = itemFromMoment(m, type, A.words, uid);
    if (!free(it.start, it.start + it.dur)) continue;
    used.push([it.start, it.start + it.dur]);
    items.push(it); uid++; count[type] = (count[type] || 0) + 1;
  }
  // Orbit / carousel : sur une respiration (sans autre élément), pour le rythme visuel.
  for (const type of ['orbit', 'carousel']) {
    if (!allowed.has(type)) continue;
    const m = sem.moments.find(x => (x.kind === 'punch' || x.kind === 'keyword') && free(x.t, x.t + CATALOG[type].dur));
    if (m) { const it = itemFromMoment(m, type, A.words, uid++); used.push([it.start, it.start + it.dur]); items.push(it); }
  }
  if (allowed.has('zoom')) for (const p of (A.peaks || []).slice(0, 3)) {
    if (p > 3 && p + 1.4 < (A.duration || 1e9)) items.push({ uid: uid++, type: 'zoom', start: +p.toFixed(2), dur: 1.4, f: {}, variant: 0, w0: wordIndexAt(A.words, p), from: 'auto' });
  }
  items.sort((a, b) => a.start - b.start);
  return { items, moments: sem.moments, topic: sem.topic, sentences: sem.sentences };
}

// ---------- Aller-retour avec Claude ----------
export function claudePrompt(words, look, hook) {
  const allowed = [...(look.elements || []), ...(look.motion || [])];
  const tools = allowed.map(id => {
    const d = CATALOG[id];
    const f = d.fields.map(([k, label, kind]) => `${k}${kind === 'list' ? '[]' : ''} (${label})`).join(', ');
    return `- ${id} : ${d.name} — ${d.desc}${f ? ` ; champs f : ${f}` : ''} ; durée conseillée ${d.dur} s`;
  }).join('\n');
  const lines = [];
  let cur = [];
  words.forEach((w, i) => {
    cur.push(`${i}:${w.w}`);
    if (/[.?!]$/.test(w.w) || cur.length >= 14) { lines.push(`(${words[i - cur.length + 1].s.toFixed(1)}s) ${cur.join(' ')}`); cur = []; }
  });
  if (cur.length) lines.push(`(${words[words.length - cur.length].s.toFixed(1)}s) ${cur.join(' ')}`);
  return `Fais le plan de montage de ce reel (Video Edit Studio). Réponds uniquement avec un bloc JSON.

Boîte à outils autorisée (look « ${look.name || look.preset} ») :
${tools}

Format attendu :
{
  "hook": { "l1": "accroche courte", "l2": "suite" },
  "corrections": [ { "i": 12, "w": "mot corrigé" } ],
  "cuts": [ [indexDébut, indexFin] ],
  "items": [ { "type": "checklist", "at": 34, "until": 52, "f": { "title": "…", "items": ["…", "…"] }, "itemAt": [34, 40, 47] } ],
  "transitions": [ { "at": 53, "type": "flash" } ]
}
- "at" / "until" = index des mots (ci-dessous) où l'élément apparaît et disparaît ; "itemAt" = index du mot où chaque ligne d'une checklist est dite.
- transitions : sur une coupe (blanc ou "cuts"), "at" = index du premier mot gardé après la coupe ; types : ${TRANSITIONS.map(x => `${x.id} (${x.name})`).join(', ')}. Les grosses transitions aux changements d'idée, sinon "zoomcut".
- corrections : fautes de transcription (franglais, noms propres). cuts : hésitations ou phrases ratées à couper.
- Une animation toutes les 3 à 6 s environ, qui illustre vraiment le sens de ce qui est dit, avec des textes courts tirés de la vidéo.

Accroche actuelle : « ${hook.l1} / ${hook.l2} »

Transcription (index:mot) :
${lines.join('\n')}`;
}

// Lit un plan collé (tolère du texte autour du JSON, des blocs de code…).
export function parsePlan(text) {
  const s = String(text);
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('aucun JSON trouvé dans le texte collé');
  return JSON.parse(s.slice(a, b + 1));
}

// Applique un plan : renvoie { items, hook?, corrections, cuts } prêts pour l'app.
export function planToItems(plan, words, startUid = 1) {
  let uid = startUid;
  const tOf = i => words[Math.max(0, Math.min(words.length - 1, i | 0))]?.s ?? 0;
  const items = [];
  for (const p of plan.items || []) {
    const def = CATALOG[p.type];
    if (!def) continue;
    const start = Math.max(0, +(tOf(p.at) - (LEAD[p.type] ?? .15)).toFixed(2));
    const end = p.until != null ? (words[Math.min(words.length - 1, p.until)]?.e ?? start + def.dur) + .4 : start + (p.dur || def.dur);
    const it = { uid: uid++, type: p.type, start, dur: +Math.max(.8, Math.min(15, end - start)).toFixed(2), f: { ...(p.f || {}) }, variant: uid % 2, w0: p.at | 0, from: 'claude' };
    if (Array.isArray(it.f.items) === false && typeof it.f.items === 'string') it.f.items = it.f.items.split('\n');
    if (p.itemAt) it.times = p.itemAt.map(i => Math.max(.1, +(tOf(i) - start).toFixed(2)));
    items.push(it);
  }
  items.sort((a, b) => a.start - b.start);
  return { items, hook: plan.hook, corrections: plan.corrections || [], cuts: plan.cuts || [], transitions: plan.transitions || [] };
}

// Accroche (2 lignes) tirée de la première phrase qui a du sens.
const FILLERS = new Set(['and', 'so', 'um', 'uh', 'well', 'like', 'okay', 'ok', 'but', 'et', 'alors', 'donc', 'euh', 'bon', 'bah', 'ben', 'mais', 'voilà', 'bref', 'du', 'coup']);
export function hookFrom(sentences) {
  for (const s of sentences || []) {
    const ws = s.words.map(w => clean(w.w)).filter(Boolean);
    while (ws.length > 2 && FILLERS.has(ws[0].toLowerCase())) ws.shift();
    if (ws.length < 3) continue;
    const n1 = ws[0].length <= 3 && ws.length > 3 ? 2 : 1;
    const l1 = ws.slice(0, n1).join(' ');
    const l2 = ws.slice(n1, n1 + 5).join(' ') + (ws.length > n1 + 5 ? '…' : /\?$/.test(s.text.trim()) ? ' ?' : '');
    return { l1: l1[0].toUpperCase() + l1.slice(1), l2 };
  }
  return { l1: 'Écoute', l2: "ça jusqu'au bout" };
}
