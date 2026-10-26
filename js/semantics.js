// Comprendre ce qui est dit dans la vidéo pour en tirer du motion design.
// À partir de la transcription mot à mot, repère des « moments » : un chiffre, une liste,
// une question, une opposition, un objet que l'on peut illustrer, un mot fort, une punchline…
// Chaque moment porte son texte (tiré de la vidéo, jamais inventé) et les motions qui lui vont.
import { sentences } from './analyze.js';

const STOP = new Set((
  'le la les l un une des du de d au aux et ou mais donc or ni car à a en dans sur sous pour par avec sans chez vers entre ' +
  'ce cet cette ces c ça cela ceci mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs ' +
  'je j tu il elle on nous vous ils elles me m te t se s lui y en qui que qu quoi dont où ' +
  'est es suis sont sommes êtes être été était étaient sera serait ai as avons avez ont avait avoir eu fait faire fais font va vais vas vont aller ' +
  'ne n pas plus moins très trop bien aussi alors puis comme si tout tous toute toutes rien quelque chose même autre autres ' +
  'oui non ok bon bah ben euh voilà là ici ah oh hein genre truc vraiment juste encore déjà toujours jamais peu beaucoup ' +
  'peut peux veux veut faut dit dis vois voir sais savoir mettre met mets prendre prends donne donner ' +
  'the a an of to in on at for with without and or but so is are was were be been being have has had do does did ' +
  'i you he she it we they me my your his her its our their this that these those there here what which who how why when ' +
  'not no yes just really very so too also then now well like gonna wanna can could would should will get got go going ' +
  'aujourd hui aujourd\'hui hier maintenant combien comment pourquoi quand fois chose choses gens personne petit petite grand grande ' +
  'faites faisez mettez prenez ajoutez voulez savez pouvez allez venez regardez montrer montre explique expliquer vais vas dire parler ' +
  'today now how why when thing things people'
).split(' '));
// Petits mots retirés en début et fin d'un extrait de phrase.
const EDGE = new Set('le la les l un une des du de d et ou à a au aux en avec pour par sur dans il vous faut the a an of to and or with for in on'.split(' '));
const UNIT_SYMBOL = { euro: '€', euros: '€', dollar: '$', dollars: '$', pourcent: '%', pourcents: '%', percent: '%' };

// Mots qu'on peut illustrer par un emoji, groupés par sujet (sert aussi à deviner le thème de la vidéo).
const LEXICON = {
  cuisine: { recette: '📖', cuisine: '🍳', cuisiner: '🍳', poêle: '🍳', four: '🔥', feu: '🔥', cuire: '🔥', cuisson: '🔥', bouillir: '♨️', eau: '💧',
    sel: '🧂', poivre: '🌶️', piment: '🌶️', épice: '🌶️', huile: '🫒', olive: '🫒', beurre: '🧈', oeuf: '🥚', œuf: '🥚', farine: '🌾', sucre: '🍬',
    lait: '🥛', crème: '🥛', fromage: '🧀', pain: '🍞', pâte: '🍝', pâtes: '🍝', riz: '🍚', tomate: '🍅', oignon: '🧅', ail: '🧄', carotte: '🥕',
    pomme: '🍎', citron: '🍋', banane: '🍌', fraise: '🍓', chocolat: '🍫', gâteau: '🎂', café: '☕', thé: '🍵', vin: '🍷', bière: '🍺',
    poulet: '🍗', viande: '🥩', boeuf: '🥩', bœuf: '🥩', poisson: '🐟', saumon: '🐟', légume: '🥦', salade: '🥗', soupe: '🍲', pizza: '🍕',
    burger: '🍔', frite: '🍟', avocat: '🥑', champignon: '🍄', couteau: '🔪', assiette: '🍽️', délicieux: '😋', miam: '😋', goût: '😋', manger: '🍽️',
    recipe: '📖', cook: '🍳', oven: '🔥', salt: '🧂', egg: '🥚', cheese: '🧀', bread: '🍞', pasta: '🍝', chicken: '🍗', delicious: '😋' },
  argent: { argent: '💰', euro: '💶', euros: '💶', dollar: '💵', dollars: '💵', prix: '🏷️', payer: '💳', carte: '💳', banque: '🏦', riche: '🤑',
    salaire: '💰', épargne: '🐷', investir: '📈', investissement: '📈', bourse: '📈', crypto: '🪙', bitcoin: '🪙', économiser: '🐷', gratuit: '🆓',
    vendre: '🛒', acheter: '🛒', client: '🤝', clients: '🤝', business: '💼', entreprise: '🏢', money: '💰', price: '🏷️', free: '🆓', sell: '🛒' },
  tech: { ordinateur: '💻', ordi: '💻', téléphone: '📱', iphone: '📱', appli: '📱', application: '📱', app: '📱', code: '👨‍💻', coder: '👨‍💻',
    ia: '🤖', robot: '🤖', claude: '🤖', chatgpt: '🤖', intelligence: '🧠', internet: '🌐', site: '🌐', vidéo: '🎬', vidéos: '🎬', montage: '🎬',
    caméra: '🎥', photo: '📸', email: '📧', mail: '📧', message: '💬', notification: '🔔', bug: '🐛', données: '📊', computer: '💻', phone: '📱', ai: '🤖' },
  sport: { sport: '🏋️', muscu: '🏋️', musculation: '🏋️', salle: '🏋️', courir: '🏃', course: '🏃', running: '🏃', foot: '⚽', football: '⚽',
    basket: '🏀', tennis: '🎾', vélo: '🚴', nager: '🏊', piscine: '🏊', match: '🏟️', entraînement: '💪', muscle: '💪', muscles: '💪',
    protéine: '🥤', protéines: '🥤', calorie: '🔥', calories: '🔥', gym: '🏋️', run: '🏃', workout: '💪' },
  santé: { santé: '❤️', coeur: '❤️', cœur: '❤️', sommeil: '😴', dormir: '😴', nuit: '🌙', stress: '😰', médecin: '🩺', douleur: '🤕',
    eau: '💧', boire: '💧', cerveau: '🧠', mental: '🧠', méditation: '🧘', respirer: '🌬️', health: '❤️', sleep: '😴' },
  voyage: { voyage: '✈️', voyager: '✈️', avion: '✈️', vacances: '🏖️', plage: '🏖️', mer: '🌊', montagne: '🏔️', hôtel: '🏨', valise: '🧳',
    paris: '🗼', france: '🇫🇷', japon: '🗾', pays: '🌍', monde: '🌍', ville: '🏙️', voiture: '🚗', train: '🚆', travel: '✈️', beach: '🏖️' },
  beauté: { maquillage: '💄', rouge: '💄', peau: '✨', crème: '🧴', cheveux: '💇', parfum: '🌸', ongles: '💅', mode: '👗', robe: '👗', look: '👀',
    tenue: '👕', chaussures: '👟', makeup: '💄', skin: '✨', hair: '💇', fashion: '👗' },
  temps: { minute: '⏱️', minutes: '⏱️', seconde: '⏱️', secondes: '⏱️', heure: '⏰', heures: '⏰', jour: '📅', jours: '📅', semaine: '📅',
    mois: '🗓️', an: '🗓️', ans: '🗓️', année: '🗓️', matin: '🌅', soir: '🌆', demain: '📅', minutes_en: '⏱️', hour: '⏰', day: '📅' },
  émotions: { amour: '❤️', aimer: '❤️', adore: '😍', content: '😊', heureux: '😊', triste: '😢', peur: '😱', choc: '😱', incroyable: '🤯',
    fou: '🤯', dingue: '🤯', rire: '😂', drôle: '😂', colère: '😡', énervé: '😤', fier: '😎', merci: '🙏', bravo: '👏', idée: '💡', secret: '🤫',
    problème: '⚠️', attention: '⚠️', erreur: '❌', astuce: '💡', conseil: '💡', objectif: '🎯', succès: '🏆', gagner: '🏆', love: '❤️', crazy: '🤯', tip: '💡' },
};
// Palette suggérée par sujet (index dans PALETTES de kit.js).
export const TOPIC_PALETTE = { cuisine: 8, argent: 3, tech: 2, sport: 1, santé: 3, voyage: 2, beauté: 9, temps: 0, émotions: 4 };
export const TOPIC_NAMES = { cuisine: 'cuisine', argent: 'argent', tech: 'tech', sport: 'sport', santé: 'santé', voyage: 'voyage', beauté: 'beauté / mode', temps: 'organisation', émotions: 'storytelling' };

const EMOJI = {}, EMOJI_TOPIC = {};
for (const [topic, words] of Object.entries(LEXICON)) for (const [w, e] of Object.entries(words)) { EMOJI[w] = e; EMOJI_TOPIC[w] = topic; }

const NUM_WORDS = { deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14,
  quinze: 15, seize: 16, vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, cent: 100, cents: 100, mille: 1000, million: 1e6, millions: 1e6,
  two: 2, three: 3, four: 4, five: 5, six_: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20, fifty: 50, hundred: 100, thousand: 1000 };
const ORDINAL = /^(premi[eè]re?(ment)?|d'abord|deuxi[eè]me(ment)?|ensuite|puis|troisi[eè]me(ment)?|enfin|finalement|apr[eè]s|first(ly)?|second(ly)?|then|next|third(ly)?|finally|lastly|[ée]tape)$/i;
const INTENSE = /^(vraiment|jamais|toujours|incroyable|énorme|secret|gratuit|facile|simple|rapide|meilleur|meilleure|pire|attention|stop|important|obligé|indispensable|interdit|parfait|zéro|never|always|free|easy|best|worst|secret|crazy|insane)$/i;
const UNIQUE = /\b(un seul|une seule|le seul|la seule|unique|parmi (tous|toutes|des)|only one|one of)\b/i;
const CONTRAST = /\s(mais|but|au lieu de|plutôt que|instead of|alors que)\s/i;

const clean = w => w.replace(/[.,!?;:«»"“”()…]/g, '');
const norm = w => clean(w).toLowerCase().replace(/^(l|d|j|qu|n|s|c|m|t)['’]/, '');
const isContent = w => { const n = norm(w); return n.length >= 3 && !STOP.has(n) && !/^\d+$/.test(n); };
const stem = n => EMOJI[n] ? n : EMOJI[n.replace(/(s|x)$/, '')] ? n.replace(/(s|x)$/, '') : null;
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
// Jusqu'à `max` mots bruts (on garde les petits mots du milieu), sans petits mots aux extrémités.
function phrase(ws, max = 5) {
  const out = [];
  for (const w of ws) { out.push(clean(w.w)); if (out.length >= max || /[,.;:!?]$/.test(w.w)) break; }
  while (out.length && EDGE.has(norm(out[0]))) out.shift();
  while (out.length && EDGE.has(norm(out[out.length - 1]))) out.pop();
  return out.join(' ');
}

// Nombres : « 200 grammes », « 3 minutes », « 10 000 € », « deux cents abonnés », « 50% ».
function findNumbers(words) {
  const out = [];
  for (let i = 0; i < words.length; i++) {
    let j = i, value = null, raw = clean(words[i].w).toLowerCase();
    if (/\d/.test(raw)) {
      let digits = raw.replace(/[^\d,.%€$]/g, '');
      while (j + 1 < words.length && /^\d{3}[.,]?$/.test(clean(words[j + 1].w))) { digits += clean(words[j + 1].w); j++; }
      value = parseFloat(digits.replace(/[^\d,.]/g, '').replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'));
      if (/%/.test(digits)) raw = '%'; else if (/€/.test(digits)) raw = '€'; else if (/\$/.test(digits)) raw = '$'; else raw = '';
    } else if (NUM_WORDS[raw] != null) {
      value = NUM_WORDS[raw];
      while (j + 1 < words.length && NUM_WORDS[norm(words[j + 1].w)] != null) {
        const n = NUM_WORDS[norm(words[j + 1].w)]; value = n >= 100 ? value * n : value + n; j++;
      }
      raw = '';
    } else if ((raw === 'un' || raw === 'une') && /^millions?$/.test(norm(words[i + 1]?.w || ''))) { value = 1e6; j = i + 1; raw = ''; }
    if (value == null || !isFinite(value) || value <= 1) continue;
    const nextW = words[j + 1] ? clean(words[j + 1].w) : '';
    let unit = raw || (nextW && !STOP.has(nextW.toLowerCase()) && /^[\p{L}%€$]+$/u.test(nextW) ? nextW.toLowerCase() : '');
    const sym = UNIT_SYMBOL[unit];
    const fmt = Math.round(value) === value ? Math.round(value).toLocaleString('fr-FR').replace(/[  ]/g, ' ') : String(value).replace('.', ',');
    const j2 = unit && !raw ? j + 1 : j;
    if (sym) unit = sym;
    out.push({ i, j: j2, t: words[i].s, value, unit, big: /^[%€$]$/.test(unit) ? fmt + ' ' + unit : fmt, display: /^[%€$]$/.test(unit) ? fmt + ' ' + unit : fmt + (unit ? ' ' + unit : '') });
    i = j;
  }
  return out;
}

function keyword(sent, peaks) {
  let best = null, score = 0;
  for (const w of sent.words) {
    if (!isContent(w.w) || ORDINAL.test(clean(w.w))) continue;
    const n = norm(w.w);
    let s = n.length;
    if (/^\p{Lu}/u.test(clean(w.w)) && w !== sent.words[0]) s += 4;        // nom propre
    if (EMOJI[n] || stem(n)) s += 2;
    if (peaks.some(p => Math.abs(p - w.s) < .6)) s += 3;                    // dit avec force
    if (s > score) { score = s; best = w; }
  }
  return best;
}

/**
 * Analyse le contenu. words = [{ w, s, e }], peaks = temps forts (s).
 * Retourne { topic, moments } ; un moment = { id, kind, t, end, score, label, text, ... , candidates }.
 */
export function analyzeContent(words, peaks = [], duration = 0) {
  const sents = sentences(words);
  const moments = [];
  const topics = {};
  let id = 0;
  const add = m => moments.push({ id: ++id, ...m });

  // Chiffres
  for (const n of findNumbers(words)) {
    // Les mots juste avant le chiffre, dans la même phrase (« pâtes à la tomate » en 10 minutes).
    let k = n.i; while (k > 0 && n.i - k < 6 && !/[.?!]$/.test(words[k - 1].w)) k--;
    const before = phrase(words.slice(k, n.i).filter((w, x, a) => !(x === a.length - 1 && /^(en|de|à|a|pour|in|of|for)$/i.test(clean(w.w)))), 5);
    add({ kind: 'number', t: n.t, end: words[n.j]?.e ?? n.t + 1, score: 9, label: 'Chiffre', value: n.value, display: n.display, big: n.big, unit: n.unit,
      before, text: n.display, candidates: ['statcard', 'counter'] });
  }

  // Listes : marqueurs d'ordre sur des phrases proches (« d'abord… ensuite… enfin… »)
  let run = [];
  const flushRun = () => {
    if (run.length >= 2) {
      const items = run.map(s => {
        const rest = s.words.filter((w, k) => !(k < 2 && ORDINAL.test(clean(w.w))));
        return { text: cap(phrase(rest, 5)), t: s.s };
      }).filter(it => it.text);
      if (items.length >= 2) add({ kind: 'list', t: items[0].t - .3, end: run[run.length - 1].e, score: 10, label: 'Liste', title: 'Les étapes', items,
        text: ['Les étapes', ...items.map(i => i.text)].join('|'), candidates: ['checklist', 'numbers'] });
    }
    run = [];
  };
  for (const s of sents) {
    const first = s.words.slice(0, 2).map(w => clean(w.w));
    if (first.some(w => ORDINAL.test(w))) { if (run.length && s.s - run[run.length - 1].e > 20) flushRun(); run.push(s); }
    else if (run.length && s.s - run[run.length - 1].e > 12) flushRun();
  }
  flushRun();
  // Listes dans une phrase : « il faut des tomates, de l'ail et du basilic »
  for (const s of sents) {
    const txt = s.words.map(w => w.w).join(' ');
    if ((txt.match(/,/g) || []).length < 1 || !/\s(et|and|ou|or)\s/i.test(txt)) continue;
    const parts = []; let cur = [];
    for (const w of s.words) {
      const n = norm(w.w);
      if (n === 'et' || n === 'and' || n === 'ou' || n === 'or') { if (cur.length) parts.push(cur); cur = []; continue; }
      cur.push(w);
      if (/,$/.test(w.w)) { parts.push(cur); cur = []; }
    }
    if (cur.length) parts.push(cur);
    const items = parts.slice(1).filter(p => p.filter(w => isContent(w.w)).length && p.length <= 4)
      .map(p => ({ text: cap(phrase(p, 4)), t: p[0].s })).filter(i => i.text && !ORDINAL.test(i.text));
    const head = (parts[0] || []).filter(w => isContent(w.w) && !ORDINAL.test(clean(w.w)));
    if (head.length) items.unshift({ text: cap(clean(head[head.length - 1].w)), t: head[head.length - 1].s });
    if (items.length >= 3 && items.length <= 6) {
      const title = cap(phrase(s.words.slice(0, 3), 3)) || 'La liste';
      add({ kind: 'list', t: items[0].t - .4, end: s.e, score: 10, label: 'Liste', title, items, text: [title, ...items.map(i => i.text)].join('|'), candidates: ['checklist', 'numbers'] });
    }
  }

  for (const s of sents) {
    const txt = s.words.map(w => w.w).join(' ').trim();
    // Questions
    if (/\?$/.test(txt) && s.words.length >= 3) add({ kind: 'question', t: s.s, end: s.e, score: 7, label: 'Question', text: txt.slice(0, 90), candidates: ['prompt', 'comment'] });
    // Oppositions : « pas X mais Y »
    const m = txt.match(CONTRAST);
    if (m) {
      const [a, b] = [txt.slice(0, m.index), txt.slice(m.index + m[0].length)];
      const toW = str => str.split(/\s+/).filter(Boolean).map(w => ({ w }));
      let aw = toW(a);
      const neg = aw.map(x => norm(x.w)).lastIndexOf('pas');
      aw = neg >= 0 ? aw.slice(neg + 1) : aw.slice(-4);
      const left = phrase(aw, 4);
      const r = phrase(toW(b), 4);
      if (left && r) {
        const at = s.words.find(w => norm(w.w) === m[1].toLowerCase().split(' ')[0]);
        add({ kind: 'contrast', t: s.s, end: s.e, score: 8, label: 'Opposition', left: cap(left), right: cap(r), turn: (at?.s ?? s.s) - s.s,
          text: `${cap(left)}|${cap(r)}`, candidates: ['versus'] });
      }
    }
    // « Un seul », « le seul », « parmi tous »…
    if (UNIQUE.test(txt)) {
      const k = keyword(s, peaks);
      add({ kind: 'unique', t: s.s, end: s.e, score: 6, label: 'Un parmi tous', text: `${k ? cap(clean(k.w)) : 'Parmi tous'}|${(txt.match(UNIQUE) || [''])[0]}`, candidates: ['grid'] });
    }
    // Mots forts → tampon
    const strong = s.words.find(w => INTENSE.test(clean(w.w)));
    if (strong) add({ kind: 'stamp', t: strong.s, end: strong.e + 1.5, score: 5, label: 'Mot fort', text: clean(strong.w), candidates: ['stamp'] });
    // Objet / sujet qu'on peut illustrer → emoji
    let em = null;
    for (const w of s.words) {
      const st = stem(norm(w.w));
      if (st) { topics[EMOJI_TOPIC[st]] = (topics[EMOJI_TOPIC[st]] || 0) + 1; if (!em) em = { w, emoji: EMOJI[st] }; }
    }
    if (em) add({ kind: 'emoji', t: em.w.s, end: em.w.e + 2, score: 6.5, label: 'Illustration', emoji: em.emoji, text: `${em.emoji}|${cap(clean(em.w.w))}`, candidates: ['emoji'] });
    // Mot clé de la phrase
    const k = keyword(s, peaks);
    const kScore = k ? norm(k.w).length + (peaks.some(p => Math.abs(p - k.s) < .6) ? 3 : 0) : 0;
    if (k && s.words.length >= 3 && kScore >= 7 && !(em && em.w === k)) add({ kind: 'keyword', t: k.s, end: k.e + 1, score: 4 + (peaks.some(p => Math.abs(p - k.s) < .6) ? 3 : 0), label: 'Mot clé',
      text: clean(k.w), sentence: txt, candidates: ['words', 'bigword', 'kinetic'] });
    // Punchline : phrase courte dite avec force
    if (s.words.length >= 3 && s.words.length <= 7 && peaks.some(p => p >= s.s - .3 && p <= s.e + .3))
      add({ kind: 'punch', t: s.s, end: s.e, score: 8, label: 'Punchline', text: txt.replace(/[,;]$/, ''), candidates: ['kinetic', 'beat'] });
  }

  moments.sort((a, b) => a.t - b.t);
  const topic = Object.entries(topics).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  return { topic, moments, sentences: sents };
}

// Texte d'une motion pour un moment donné (format attendu par chaque motion).
export function motionText(m, type) {
  switch (type) {
    case 'statcard': return `${m.before || m.label}|${m.big || m.display}|${m.unit && !/^[%€$]$/.test(m.unit) ? m.unit : ''}`;
    case 'counter': return m.display;
    case 'checklist': return m.text;
    case 'numbers': return String(m.items?.length || 3);
    case 'beat': return (m.text || '').split(/\s+/).filter(w => isContent(w)).slice(0, 3).map(clean).join(' ').toUpperCase() || m.text;
    case 'bigword': return (m.text || '').toLowerCase();
    case 'kinetic': return m.sentence && m.kind === 'keyword' ? m.sentence.split(/\s+/).slice(0, 7).join(' ') : m.text;
    default: return m.text;
  }
}

// Instants (relatifs au début de la motion) où chaque ligne d'une liste est dite.
export const itemTimes = (m, start) => m.items ? m.items.map(i => Math.max(.1, i.t - start)) : undefined;
