import { FONTS, PALETTES, TITLES, CAPTION_STYLES, MOTIONS, M, render, setVideo, fstr, clamp } from './render.js';
import { decodeAudio, loudness, findSilences, cutsFromSilences, findPeaks, transcribe, cancelTranscription, chunkWords, retextChunk } from './analyze.js';
import { makeProposals } from './proposals.js';

const STEPS = [
  ['Import', 'Importe ta vidéo.', 'Elle est analysée sur ton ordinateur : voix, silences, temps forts.'],
  ['Propositions', 'Choisis un montage.', 'Chaque proposition est construite à partir de ce que tu dis dans la vidéo.'],
  ['Hook', 'Ton hook.', 'Les deux lignes affichées au début.'],
  ['Police', 'Choisis la police.', 'Chaque aperçu est dessiné en direct sur ta vidéo.'],
  ['Couleurs', 'Choisis tes couleurs.', 'L\'accent sert aux titres, cartes, motions et sous-titres.'],
  ['Titre', 'Choisis le style de titre.', 'Dessiné en direct dans tes couleurs et ta police.'],
  ['Motions', 'Coche les motions que tu veux.', 'Elles sont dessinées en direct dans tes couleurs et ta police.'],
  ['Sous-titres', 'Sous-titres.', 'Générés depuis ta voix, mot à mot. Corrige le texte si besoin.'],
  ['Export', 'Coupes, timing & export.', 'Supprime les blancs, ajuste le timing, puis exporte.'],
];
const LANGS = [['fr', 'Français'], ['en', 'Anglais'], ['es', 'Espagnol'], ['de', 'Allemand'], ['it', 'Italien'], ['pt', 'Portugais'], ['ar', 'Arabe'], ['', 'Détection auto']];

const S = {
  step: 0, fileName: '',
  A: { status: 'idle', msg: '', frac: 0, duration: 0, pcm: null, db: null, silences: [], peaks: [], words: [], chunks: [], asrError: '' },
  opts: { transcribe: true, lang: 'fr' },
  hook: { l1: 'Quit', l2: 'your job?' }, font: 'Anton', pal: 0, title: 'tiles', titleDur: 3,
  taken: [], captions: { on: true, style: 'pop', pos: .74 }, cuts: { on: false, sens: .3, minLen: .5, segs: [] },
  proposals: [], seed: 0, preview: -1, applied: '',
  cards: MOTIONS.map(m => ({ type: m.id, variant: 0 })), uid: 1, server: { ffmpeg: false }, exporting: false,
};

const $ = id => document.getElementById(id);
const fmt = s => isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00';
const fmt1 = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const video = $('video');
setVideo(video);

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else if (k === 'checked' || k === 'value') e[k] = v;
    else e.setAttribute(k, v);
  }
  for (const k of kids) if (k != null && k !== false) e.append(k);
  return e;
}

// ---------- Configurations de rendu ----------
const captionsCfg = style => S.A.chunks.length ? { style, pos: S.captions.pos, chunks: S.A.chunks } : null;
const base = () => ({
  title: S.title, font: S.font, pal: S.pal, hook: S.hook, titleStart: 0, titleDur: S.titleDur,
  motions: S.taken, captions: S.captions.on ? captionsCfg(S.captions.style) : null,
});
const proposalCfg = p => ({
  title: p.title, font: p.font, pal: p.pal, hook: p.hook, titleStart: 0, titleDur: p.titleDur,
  motions: p.motions, captions: captionsCfg(p.captions),
});
const cutSaving = segs => segs.reduce((a, [x, y]) => a + (y - x), 0);

function activeCuts() {
  if (S.step === 1 && S.proposals[S.preview]) return S.proposals[S.preview].cuts ? S.cuts.segs : [];
  return S.cuts.on ? S.cuts.segs : [];
}

function recomputeCuts() {
  const A = S.A;
  if (!A.db) { S.cuts.segs = []; return; }
  A.silences = findSilences(A.db, S.cuts.sens, S.cuts.minLen);
  S.cuts.segs = cutsFromSilences(A.silences, A.duration);
}

function applyProposal(p) {
  Object.assign(S, { hook: { ...p.hook }, font: p.font, pal: p.pal, title: p.title, titleDur: p.titleDur, applied: p.name });
  S.taken = p.motions.map(m => ({ ...m, uid: S.uid++ }));
  S.captions.style = p.captions; S.captions.on = true;
  S.cuts.on = p.cuts && S.cuts.segs.length > 0;
}

// ---------- Boucle d'aperçu ----------
let live = []; // { ctx, W, H, cfg: () => o, loop: secondes | null (= temps de la vidéo) }
const mainCtx = $('main').getContext('2d');

function frame(now) {
  const clock = now / 1000;
  const mc = $('main');
  // Saut des passages coupés pendant la lecture.
  if (!video.paused && !S.exporting) {
    const seg = activeCuts().find(([a, b]) => video.currentTime >= a && video.currentTime < b - .02);
    if (seg) video.currentTime = seg[1] >= video.duration - .05 ? 0 : seg[1];
  }
  if (S.step >= 2 && S.step <= 5) {
    render(mainCtx, mc.width, mc.height, clock % (S.titleDur + .8), { ...base(), motions: [], captions: null });
  } else if (S.step === 0) {
    render(mainCtx, mc.width, mc.height, 0, { ...base(), title: null, motions: [], captions: null });
  } else if (S.step === 1 && S.proposals[S.preview]) {
    render(mainCtx, mc.width, mc.height, video.currentTime || 0, proposalCfg(S.proposals[S.preview]));
  } else {
    render(mainCtx, mc.width, mc.height, video.currentTime || 0, base());
  }
  for (const l of live) render(l.ctx, l.W, l.H, l.loop ? clock % l.loop : video.currentTime || 0, l.cfg());
  $('time').textContent = `${fmt(video.currentTime)} / ${fmt(video.duration)}`;
  drawTimeline();
  requestAnimationFrame(frame);
}

// Timeline : volume de la voix, coupes (rouge), titre et motions (jaune), tête de lecture.
let wave = null;
function buildWave() {
  const c = $('timeline'), W = c.width, H = c.height, db = S.A.db;
  wave = document.createElement('canvas'); wave.width = W; wave.height = H;
  if (!db || !db.length) return;
  const g = wave.getContext('2d');
  const lo = Math.min(...db.filter(isFinite)), hi = Math.max(...db);
  g.fillStyle = '#555';
  for (let x = 0; x < W; x++) {
    const i0 = Math.floor(x / W * db.length), i1 = Math.max(i0 + 1, Math.floor((x + 1) / W * db.length));
    let m = -Infinity; for (let i = i0; i < i1; i++) m = Math.max(m, db[i]);
    const h = clamp((m - lo) / (hi - lo + 1e-6)) * H * .8;
    g.fillRect(x, (H - h) / 2, 1, Math.max(1, h));
  }
}
function drawTimeline() {
  const c = $('timeline'), g = c.getContext('2d'), W = c.width, H = c.height;
  const d = video.duration || S.A.duration;
  g.clearRect(0, 0, W, H);
  if (!d) return;
  if (wave) g.drawImage(wave, 0, 0);
  g.fillStyle = 'rgba(255,90,79,.35)';
  for (const [a, b] of activeCuts()) g.fillRect(a / d * W, 0, (b - a) / d * W, H);
  const cfg = S.step === 1 && S.proposals[S.preview] ? proposalCfg(S.proposals[S.preview]) : base();
  g.fillStyle = 'rgba(255,214,10,.9)';
  if (cfg.title) g.fillRect(0, 2, cfg.titleDur / d * W, 8);
  cfg.motions.forEach((m, i) => g.fillRect(m.start / d * W, 14 + (i % 2) * 10, Math.max(2, m.dur / d * W), 7));
  g.fillStyle = '#fff'; g.fillRect(video.currentTime / d * W - 1, 0, 2, H);
}
$('timeline').addEventListener('click', e => {
  const r = e.currentTarget.getBoundingClientRect();
  if (video.duration) video.currentTime = (e.clientX - r.left) / r.width * video.duration;
});

// ---------- UI ----------
function liveCanvas(cfg, loop = null) {
  const c = el('canvas', { width: 270, height: 480 });
  live.push({ ctx: c.getContext('2d'), W: c.width, H: c.height, cfg, loop });
  return c;
}

function choiceGrid(items, isSel, onPick, cfgFor, extra, loop = S.titleDur + .8) {
  const g = el('div', { class: 'grid' });
  items.forEach((it, i) => {
    g.append(el('div', { class: 'card clickable' + (isSel(it) ? ' sel' : ''), onclick: () => { onPick(it); draw(); } },
      el('span', { class: 'num' }, String(i + 1)),
      liveCanvas(() => cfgFor(it), loop),
      el('h3', {}, it.name), extra ? extra(it) : null));
  });
  return g;
}

function nextStart(dur) {
  const end = S.taken.reduce((a, m) => Math.max(a, m.start + m.dur), S.titleDur);
  const total = isFinite(video.duration) ? video.duration : 60;
  return Math.max(0, Math.min(+(end + .4).toFixed(1), +(total - dur).toFixed(1)));
}

function goto(step) { S.step = clamp(step, 0, STEPS.length - 1); draw(); window.scrollTo(0, 0); }

function draw() {
  live = [];
  $('dots').replaceChildren(...STEPS.map((s, i) =>
    el('button', { class: 'dot' + (i === S.step ? ' on' : i < S.step ? ' done' : ''), onclick: () => goto(i) }, `${i + 1}. ${s[0]}`)));
  $('stepText').innerHTML = `<b>Étape ${S.step + 1} sur ${STEPS.length}.</b> ${STEPS[S.step][1]} <span class="muted">${STEPS[S.step][2]}</span>`;
  $('prev').disabled = S.step === 0;
  $('next').style.display = S.step === STEPS.length - 1 ? 'none' : '';
  const C = $('content'); C.replaceChildren();
  [stepImport, stepProposals, stepHook, stepFont, stepColors, stepTitle, stepMotions, stepCaptions, stepExport][S.step](C);
}

function stepImport(C) {
  const busy = S.A.status === 'running';
  const d = el('div', { class: 'drop', onclick: () => !busy && $('file').click() },
    el('strong', {}, S.fileName ? 'Vidéo chargée — clique pour en changer' : 'Dépose ta vidéo ici'),
    'ou clique pour choisir un fichier (.mp4, .mov, .webm)');
  d.addEventListener('dragover', e => { e.preventDefault(); d.classList.add('over'); });
  d.addEventListener('dragleave', () => d.classList.remove('over'));
  d.addEventListener('drop', e => { e.preventDefault(); d.classList.remove('over'); if (!busy && e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); });
  C.append(d);
  C.append(el('div', { class: 'options' },
    el('label', {}, el('input', { type: 'checkbox', checked: S.opts.transcribe, disabled: busy || null, onchange: e => { S.opts.transcribe = e.target.checked; } }),
      'Transcrire la voix (sous-titres + propositions basées sur ce que tu dis)'),
    el('label', {}, 'Langue', el('select', { disabled: busy || null, onchange: e => { S.opts.lang = e.target.value; } },
      ...LANGS.map(([v, n]) => el('option', { value: v, ...(v === S.opts.lang ? { selected: '' } : {}) }, n))))));
  C.append(el('p', { class: 'muted' }, 'La première transcription télécharge le modèle Whisper (~200 Mo, une seule fois, gardé en cache par le navigateur). Tout tourne sur ton ordinateur.'));
  if (S.A.status !== 'idle') {
    C.append(el('div', { class: 'panel' },
      el('h2', {}, 'Analyse'),
      el('div', { id: 'amsg', class: S.A.status === 'error' ? 'err' : '' }, S.A.msg),
      el('div', { class: 'progress' }, el('div', { id: 'abar', style: `width:${S.A.frac * 100}%` })),
      S.A.asrError ? el('p', { class: 'err' }, 'Transcription impossible : ' + S.A.asrError) : null,
      busy && S.A.transcribing ? el('button', { class: 'btn', onclick: () => cancelTranscription() }, 'Passer la transcription') : null,
      S.A.status === 'done' ? el('button', { class: 'btn yellow', onclick: () => goto(1) }, 'Voir les propositions →') : null));
  }
}

function setProgress(msg, frac) {
  S.A.msg = msg; if (frac != null) S.A.frac = frac;
  const m = $('amsg'), b = $('abar');
  if (m) m.textContent = msg;
  if (b && frac != null) b.style.width = frac * 100 + '%';
}

function stepProposals(C) {
  if (!S.proposals.length) {
    C.append(el('p', { class: 'muted' }, 'Importe une vidéo pour recevoir des propositions.'), el('button', { class: 'btn', onclick: () => goto(0) }, '← Import'));
    return;
  }
  const A = S.A;
  C.append(el('div', { class: 'banner' },
    el('span', {}, A.words.length ? `${A.words.length} mots transcrits` : 'Pas de transcription (propositions génériques)',
      ' · ', `${A.peaks.length} temps forts`, ' · ',
      S.cuts.segs.length ? `${S.cuts.segs.length} blancs à couper (−${cutSaving(S.cuts.segs).toFixed(1)} s)` : 'aucun blanc à couper'),
    el('button', { class: 'btn', style: 'margin-left:auto', onclick: () => { S.seed++; S.proposals = makeProposals(A, S.seed); S.preview = 0; draw(); } }, '↻ Autres propositions')));
  const g = el('div', { class: 'grid wide' });
  S.proposals.forEach((p, i) => {
    const P = PALETTES[p.pal];
    const names = [...new Set(p.motions.map(m => M[m.type].name))];
    g.append(el('div', { class: 'card' + (i === S.preview ? ' sel' : '') },
      el('span', { class: 'num' }, String(i + 1)),
      liveCanvas(() => proposalCfg(p)),
      el('h3', {}, p.name),
      el('p', { class: 'hookline' }, `« ${p.hook.l1} ${p.hook.l2} »`),
      el('div', { class: 'chips' },
        el('span', {}, p.font), el('span', { style: `border-color:${P.accent};color:${P.accent}` }, P.name),
        el('span', {}, 'Titre ' + TITLES.find(t => t.id === p.title).name.toLowerCase()),
        A.chunks.length ? el('span', {}, 'Sous-titres ' + CAPTION_STYLES.find(c => c.id === p.captions).name.toLowerCase()) : null,
        p.cuts && S.cuts.segs.length ? el('span', {}, `Coupes −${cutSaving(S.cuts.segs).toFixed(1)} s`) : el('span', {}, 'Sans coupes'),
        ...names.map(n => el('span', {}, n))),
      el('div', { class: 'row' },
        el('button', { onclick: () => { S.preview = i; video.currentTime = 0; video.play().catch(() => {}); draw(); } }, 'Aperçu'),
        el('button', { class: 'go', onclick: () => { applyProposal(p); goto(2); } }, 'Choisir'))));
  });
  C.append(g);
}

function appliedBanner(C) {
  if (!S.applied) return;
  C.append(el('div', { class: 'banner' }, el('span', {}, `Montage « ${S.applied} » appliqué. Ajuste ce que tu veux, ou va directement à l'export.`),
    el('button', { class: 'btn yellow', style: 'margin-left:auto', onclick: () => goto(STEPS.length - 1) }, 'Aller à l\'export →')));
}

function stepHook(C) {
  appliedBanner(C);
  const f = (label, key) => el('label', { class: 'field' }, el('span', {}, label),
    el('input', { value: S.hook[key], oninput: e => { S.hook[key] = e.target.value; } }));
  C.append(f('Ligne 1 (courte, idéalement un mot)', 'l1'), f('Ligne 2', 'l2'),
    el('label', { class: 'field' }, el('span', {}, 'Durée du titre (secondes)'),
      el('input', { type: 'number', min: '1', max: '10', step: '0.1', value: S.titleDur, oninput: e => { S.titleDur = clamp(+e.target.value || 3, 1, 10); } })));
}
function stepFont(C) {
  appliedBanner(C);
  C.append(choiceGrid(FONTS, f => f.name === S.font, f => S.font = f.name, f => ({ ...base(), font: f.name, motions: [], captions: null })));
}
function stepColors(C) {
  appliedBanner(C);
  C.append(choiceGrid(PALETTES.map((p, i) => ({ ...p, i })), p => p.i === S.pal, p => S.pal = p.i, p => ({ ...base(), pal: p.i, motions: [], captions: null }),
    p => el('div', { class: 'swatches' }, ...[p.accent, p.text, p.ink].map(c => el('i', { style: `background:${c}` })))));
}
function stepTitle(C) {
  appliedBanner(C);
  C.append(choiceGrid(TITLES, t => t.id === S.title, t => S.title = t.id, t => ({ ...base(), title: t.id, motions: [], captions: null }),
    t => el('p', {}, t.desc)));
}

function stepMotions(C) {
  appliedBanner(C);
  const g = el('div', { class: 'grid' });
  S.cards.forEach((c, i) => {
    const def = M[c.type];
    const taken = S.taken.find(m => m.type === c.type && m.variant === c.variant);
    const mot = { type: c.type, variant: c.variant, start: .3, dur: def.dur, text: def.text };
    g.append(el('div', { class: 'card' + (taken ? ' taken' : '') },
      el('span', { class: 'num' }, String(i + 1)),
      liveCanvas(() => ({ ...base(), title: null, captions: null, motions: [mot] }), def.dur + .8),
      el('h3', {}, def.name + (c.variant ? ` · v${c.variant + 1}` : '')),
      el('p', {}, def.desc),
      el('div', { class: 'row' },
        el('button', { class: 'take', onclick: () => {
          if (taken) S.taken = S.taken.filter(m => m.type !== c.type || m.variant !== c.variant);
          else S.taken.push({ uid: S.uid++, type: c.type, variant: c.variant, start: nextStart(def.dur), dur: def.dur, text: def.text });
          draw();
        } }, taken ? 'Pris ✓' : 'Prendre'),
        el('button', { onclick: () => {
          const v = Math.max(...S.cards.filter(x => x.type === c.type).map(x => x.variant)) + 1;
          S.cards.splice(i + 1, 0, { type: c.type, variant: v }); draw();
        } }, 'Plus comme ça'))));
  });
  C.append(g);
}

function stepCaptions(C) {
  appliedBanner(C);
  const A = S.A;
  if (!A.chunks.length) {
    const busy = A.status === 'running';
    C.append(el('div', { class: 'panel' },
      el('h2', {}, 'Pas encore de transcription'),
      el('p', { class: 'muted' }, A.pcm ? 'Lance la transcription pour générer les sous-titres.' : 'Importe une vidéo avec du son pour générer des sous-titres.'),
      A.asrError ? el('p', { class: 'err' }, A.asrError) : null,
      el('div', { class: 'options' },
        el('label', {}, 'Langue', el('select', { onchange: e => { S.opts.lang = e.target.value; } },
          ...LANGS.map(([v, n]) => el('option', { value: v, ...(v === S.opts.lang ? { selected: '' } : {}) }, n)))),
        el('button', { class: 'btn yellow', disabled: !A.pcm || busy || null, onclick: runTranscription }, busy ? 'Transcription en cours…' : 'Transcrire')),
      el('div', { id: 'amsg', class: 'muted' }, busy ? A.msg : ''),
      el('div', { class: 'progress' }, el('div', { id: 'abar', style: `width:${A.frac * 100}%` }))));
    return;
  }
  C.append(el('div', { class: 'options' },
    el('label', {}, el('input', { type: 'checkbox', checked: S.captions.on, onchange: e => { S.captions.on = e.target.checked; draw(); } }), 'Afficher les sous-titres'),
    el('label', {}, 'Position', el('input', { type: 'range', min: '0.3', max: '0.9', step: '0.01', value: S.captions.pos, oninput: e => { S.captions.pos = +e.target.value; } }))));
  C.append(choiceGrid(CAPTION_STYLES, c => c.id === S.captions.style, c => { S.captions.style = c.id; S.captions.on = true; },
    c => ({ ...base(), title: null, motions: [], captions: captionsCfg(c.id) }), c => el('p', {}, c.desc), null));
  const rows = A.chunks.map(ch => el('tr', {},
    el('td', {}, el('button', { onclick: () => { video.currentTime = ch.s; } }, fmt1(ch.s))),
    el('td', {}, el('input', { type: 'text', value: ch.words.map(w => w.w).join(' '), onchange: e => retextChunk(ch, e.target.value) }))));
  C.append(el('div', { class: 'panel', style: 'margin-top:16px' }, el('h2', {}, 'Texte des sous-titres'),
    el('div', { class: 'scroll' }, el('table', {}, ...rows))));
}

async function runTranscription() {
  const A = S.A;
  A.status = 'running'; A.transcribing = true; A.asrError = ''; draw();
  try {
    A.words = await transcribe(A.pcm, A.db, { lang: S.opts.lang, onProgress: asrProgress });
  } catch (e) {
    if (e.message !== 'cancelled') A.asrError = e.message;
  }
  A.transcribing = false;
  A.chunks = chunkWords(A.words);
  S.proposals = makeProposals(A, S.seed);
  A.status = 'done';
  setProgress(A.words.length ? `Terminé : ${A.words.length} mots transcrits.` : 'Terminé.', 1);
  draw();
}

function asrProgress(p) {
  if (p.phase === 'download') setProgress(`Téléchargement du modèle Whisper… ${(p.loaded / 1e6).toFixed(0)} / ${(p.total / 1e6).toFixed(0)} Mo`, .1 + .3 * p.loaded / p.total);
  else setProgress(`Transcription… ${fmt(p.done)} / ${fmt(p.total)}`, .4 + .6 * p.done / p.total);
}

function stepExport(C) {
  appliedBanner(C);
  const A = S.A;
  // Coupes
  const saving = cutSaving(S.cuts.segs);
  C.append(el('div', { class: 'panel' }, el('h2', {}, 'Couper les blancs'),
    A.db ? el('div', {},
      el('div', { class: 'options' },
        el('label', {}, el('input', { type: 'checkbox', checked: S.cuts.on, onchange: e => { S.cuts.on = e.target.checked; draw(); } }),
          `Supprimer ${S.cuts.segs.length} blancs (−${saving.toFixed(1)} s → ${fmt(A.duration - saving)} au final)`),
        el('label', {}, 'Sensibilité', el('input', { type: 'range', min: '0.1', max: '0.6', step: '0.02', value: S.cuts.sens, onchange: e => { S.cuts.sens = +e.target.value; recomputeCuts(); draw(); } })),
        el('label', {}, 'Blanc minimum', el('input', { type: 'range', min: '0.25', max: '1.5', step: '0.05', value: S.cuts.minLen, onchange: e => { S.cuts.minLen = +e.target.value; recomputeCuts(); draw(); } }), `${S.cuts.minLen.toFixed(2)} s`)),
      el('p', { class: 'muted' }, 'Les zones coupées apparaissent en rouge sur la timeline sous l\'aperçu.'))
      : el('p', { class: 'muted' }, 'Aucune piste audio analysée.')));

  // Timing
  const rows = [...S.taken].sort((a, b) => a.start - b.start);
  const num = (m, key) => el('input', { type: 'number', step: '0.1', min: key === 'dur' ? '0.3' : '0', value: m[key],
    oninput: e => { const v = parseFloat(e.target.value); if (isFinite(v)) m[key] = Math.max(key === 'dur' ? .3 : 0, v); } });
  C.append(el('div', { class: 'panel' }, el('h2', {}, 'Timing des motions'),
    rows.length ? null : el('p', { class: 'muted' }, 'Aucune motion — choisis une proposition ou prends-en à l\'étape Motions.'),
    el('div', { class: 'scroll' }, el('table', {},
      el('tr', {}, ...['Motion', 'Début (s)', 'Durée (s)', 'Texte', '', ''].map(h => el('th', {}, h))),
      el('tr', {}, el('td', {}, 'Titre (hook)'), el('td', {}, '0'), el('td', {}, String(S.titleDur)), el('td', {}, `${S.hook.l1} / ${S.hook.l2}`), el('td'), el('td')),
      ...rows.map(m => el('tr', {},
        el('td', {}, M[m.type].name + (m.variant ? ` v${m.variant + 1}` : '')),
        el('td', {}, num(m, 'start')),
        el('td', {}, num(m, 'dur')),
        el('td', {}, m.text != null ? el('input', { type: 'text', value: m.text, oninput: e => { m.text = e.target.value; } }) : el('span', { class: 'muted' }, '—')),
        el('td', {}, el('button', { onclick: () => { m.start = +video.currentTime.toFixed(1); draw(); } }, '⇤ Tête de lecture')),
        el('td', {}, el('button', { onclick: () => { S.taken = S.taken.filter(x => x !== m); draw(); } }, '✕'))))))));

  // Export
  C.append(el('div', { class: 'panel' }, el('h2', {}, 'Export'),
    el('button', { class: 'btn yellow', id: 'exportBtn', onclick: exportVideo }, 'Exporter la vidéo'),
    el('div', { class: 'progress' }, el('div', { id: 'bar' })),
    el('p', { class: 'muted', id: 'status' },
      S.server.ffmpeg ? 'ffmpeg détecté : l\'export sera converti en MP4 H.264.' : 'Lance « python3 serve.py » avec ffmpeg installé pour obtenir un MP4 (sinon export WebM).'),
    el('p', { class: 'muted' }, 'L\'export se fait en temps réel : la vidéo est rejouée et capturée. Garde l\'onglet au premier plan.')));
}

// ---------- Import & analyse ----------
async function loadFile(file) {
  cancelTranscription();
  S.fileName = file.name;
  $('filename').textContent = file.name;
  video.src = URL.createObjectURL(file);
  await new Promise(r => video.addEventListener('loadedmetadata', r, { once: true }));
  video.play().catch(() => {});
  const A = S.A = { status: 'running', msg: 'Lecture de l\'audio…', frac: .02, duration: video.duration, pcm: null, db: null, silences: [], peaks: [], words: [], chunks: [], asrError: '' };
  S.proposals = []; S.preview = -1; S.applied = ''; wave = null;
  draw();
  try {
    A.pcm = await decodeAudio(file);
    if (A.pcm) {
      A.db = loudness(A.pcm);
      A.peaks = findPeaks(A.db);
      recomputeCuts();
      buildWave();
    }
    setProgress(A.pcm ? 'Audio analysé.' : 'Pas de piste audio détectée.', .1);
    if (A.pcm && S.opts.transcribe) {
      A.transcribing = true; draw();
      try { A.words = await transcribe(A.pcm, A.db, { lang: S.opts.lang, onProgress: asrProgress }); }
      catch (e) { if (e.message !== 'cancelled') A.asrError = e.message; }
      A.transcribing = false;
    }
    A.chunks = chunkWords(A.words);
    S.proposals = makeProposals(A, S.seed);
    A.status = 'done';
    setProgress(`Analyse terminée${A.words.length ? ` : ${A.words.length} mots transcrits` : ''}. ${S.proposals.length} montages proposés.`, 1);
    S.preview = 0;
    video.currentTime = 0;
    goto(1);
  } catch (e) {
    A.status = 'error'; setProgress('Erreur d\'analyse : ' + e.message, 0); draw();
  }
}

$('file').addEventListener('change', e => { if (e.target.files[0]) loadFile(e.target.files[0]); e.target.value = ''; });
$('play').onclick = () => { video.paused ? video.play() : video.pause(); };
video.addEventListener('play', () => $('play').textContent = 'Pause');
video.addEventListener('pause', () => $('play').textContent = 'Lecture');
$('back5').onclick = () => { video.currentTime = Math.max(0, video.currentTime - 5); };
$('fwd5').onclick = () => { video.currentTime = Math.min(video.duration || 0, video.currentTime + 5); };
$('prev').onclick = () => goto(S.step - 1);
$('next').onclick = () => goto(S.step + 1);

// ---------- Export ----------
let audio = null;
function ensureAudio() {
  if (audio) return audio;
  const ac = new AudioContext();
  const src = ac.createMediaElementSource(video);
  const dest = ac.createMediaStreamDestination();
  src.connect(dest); src.connect(ac.destination);
  return audio = { ac, dest };
}
const seekTo = t => new Promise(r => { video.addEventListener('seeked', r, { once: true }); video.currentTime = t; });

async function exportVideo() {
  if (S.exporting) return;
  if (!video.src) { alert('Importe d\'abord une vidéo (étape 1).'); return; }
  S.exporting = true;
  const btn = $('exportBtn'), bar = $('bar'), status = $('status');
  btn.disabled = true;
  try {
    await document.fonts.ready;
    let W = video.videoWidth, H = video.videoHeight;
    const k = 1920 / Math.max(W, H);
    if (k < 1) { W = Math.round(W * k / 2) * 2; H = Math.round(H * k / 2) * 2; }
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const stream = c.captureStream(30);
    const { ac, dest } = ensureAudio();
    await ac.resume();
    dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
    const mime = ['video/mp4;codecs=avc1,mp4a', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
      .find(m => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12e6 });
    const chunks = [];
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    const stopped = new Promise(r => rec.onstop = r);

    const cfg = base();
    const segs = S.cuts.on ? [...S.cuts.segs].sort((a, b) => a[0] - b[0]) : [];
    const D = video.duration, kept = D - cutSaving(segs);
    const keptBefore = t => t - segs.reduce((a, [x, y]) => a + clamp(t - x, 0, y - x), 0);

    video.pause(); video.loop = false; video.muted = false;
    const first = segs.find(([a]) => a <= .01);
    await seekTo(first ? first[1] : 0);
    render(ctx, W, H, video.currentTime, cfg);

    let finish;
    const finished = new Promise(r => finish = r);
    video.addEventListener('ended', () => finish(), { once: true });
    let busy = false, done = false;
    const tick = async () => {
      if (done) return;
      const t = video.currentTime;
      const seg = !busy && segs.find(([a, b]) => t >= a && t < b);
      if (seg) {
        if (seg[1] >= D - .05) { finish(); return; }
        busy = true;
        rec.pause(); video.pause();
        await seekTo(seg[1]);
        render(ctx, W, H, video.currentTime, cfg);
        rec.resume(); await video.play();
        busy = false;
      } else if (!busy) {
        render(ctx, W, H, t, cfg);
      }
      bar.style.width = (100 * keptBefore(t) / kept) + '%';
      status.textContent = `Enregistrement… ${fmt(keptBefore(t))} / ${fmt(kept)}`;
      requestAnimationFrame(tick);
    };
    rec.start(250);
    await video.play();
    tick();
    await finished;
    done = true;
    video.pause();
    rec.stop(); await stopped;

    let blob = new Blob(chunks, { type: mime.split(';')[0] });
    let ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
    if (!mime.includes('avc1') && S.server.ffmpeg) {
      status.textContent = 'Conversion en MP4 avec ffmpeg…';
      const r = await fetch('/convert', { method: 'POST', body: blob });
      if (r.ok) { blob = await r.blob(); ext = 'mp4'; } else status.textContent = 'Conversion échouée, export brut : ' + (await r.text()).slice(0, 200);
    }
    const name = (S.fileName.replace(/\.[^.]+$/, '') || 'video') + '-edit.' + ext;
    el('a', { href: URL.createObjectURL(blob), download: name }).click();
    bar.style.width = '100%';
    status.textContent = `Terminé : ${name} (${(blob.size / 1e6).toFixed(1)} Mo).`;
  } catch (err) {
    status.textContent = 'Erreur pendant l\'export : ' + err.message;
  } finally {
    video.muted = true; video.loop = true; video.play().catch(() => {});
    btn.disabled = false; S.exporting = false;
  }
}

fetch('/health').then(r => r.ok ? r.json() : null).then(j => { if (j) S.server = j; }).catch(() => {});
document.fonts.ready.then(() => Promise.all(FONTS.map(f => document.fonts.load(fstr(f, 40))))).catch(() => {});
draw();
requestAnimationFrame(frame);
