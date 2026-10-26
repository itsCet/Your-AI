import { FONTS, PALETTES, TITLES, CAPTION_STYLES, MOTIONS, CATEGORIES, M, render, setVideo, fstr, clamp, GLOW_COLORS, DEFAULT_FX } from './render.js';
import { depth, BROWSER_MODELS, startBrowserMatting, startServerMatting, resetMatting, updateDepth, whenPrepared } from './depth.js';
import { decodeAudio, loudness, findSilences, cutsFromSilences, findPeaks, transcribe, cancelTranscription, chunkWords, retextChunk } from './analyze.js';
import { makeProposals, motionFromMoment } from './proposals.js';
import { analyzeContent, motionText, TOPIC_NAMES } from './semantics.js';
import { MEDIA_LAYOUTS, POSITIONS, interpretMedia, hasAlpha } from './media.js';
import { SFX, DEFAULT_SFX, sfxEvents, playSfx } from './sfx.js';

const STEPS = [
  ['import', 'Import', 'Importe ta vidéo.', 'Elle est analysée sur ton ordinateur : voix, silences, temps forts.'],
  ['media', 'Médias', 'Ajoute tes images, PNG et vidéos.', 'Écris à côté de chacun ce que tu veux en faire, l\'app le place pour toi.'],
  ['proposals', 'Propositions', 'Choisis un montage.', 'Chaque proposition est construite à partir de ce que tu dis et de tes médias.'],
  ['hook', 'Hook', 'Ton hook.', 'Les deux lignes affichées au début.'],
  ['font', 'Police', 'Choisis la police.', 'Chaque aperçu est dessiné en direct sur ta vidéo.'],
  ['colors', 'Couleurs', 'Choisis tes couleurs.', 'L\'accent sert aux titres, cartes, motions et sous-titres.'],
  ['title', 'Titre', 'Choisis le style de titre.', 'Dessiné en direct dans tes couleurs et ta police.'],
  ['motions', 'Motions', 'Choisis les animations.', 'Chacune illustre ce que tu dis à un moment précis de ta vidéo. Clique sur une carte pour l\'ajouter.'],
  ['captions', 'Sous-titres', 'Sous-titres.', 'Générés depuis ta voix, mot à mot. Corrige le texte si besoin.'],
  ['export', 'Export', 'Coupes, sons, timing & export.', 'Supprime les blancs, règle les sons, puis exporte la vidéo et sa couverture.'],
];
const ST = Object.fromEntries(STEPS.map((s, i) => [s[0], i]));
const LANGS = [['fr', 'Français'], ['en', 'Anglais'], ['es', 'Espagnol'], ['de', 'Allemand'], ['it', 'Italien'], ['pt', 'Portugais'], ['ar', 'Arabe'], ['', 'Détection auto']];
const KIND_NAMES = { number: 'Chiffre', list: 'Liste', question: 'Question', contrast: 'Avant / Après', emoji: 'Illustration', keyword: 'Mot clé', punch: 'Punchline', stamp: 'Mot fort', unique: 'Un parmi tous' };

const S = {
  step: 0, fileName: '',
  A: { status: 'idle', msg: '', frac: 0, duration: 0, pcm: null, db: null, silences: [], peaks: [], words: [], chunks: [], asrError: '' },
  opts: { transcribe: true, lang: 'fr' },
  hook: { l1: 'Quit', l2: 'your job?' }, font: 'Anton', pal: 0, title: 'editorial', titleDur: 3,
  taken: [], captions: { on: true, style: 'editorial', pos: .74 }, cuts: { on: false, sens: .3, minLen: .5, segs: [] },
  media: [], mediaLayout: 'card', sfx: { on: true, vol: .6 },
  fx: { ...DEFAULT_FX, pop: true, slide: true }, depthOn: false, depthEngine: 'browser:multiclass', file: null,
  proposals: [], seed: 0, preview: -1, applied: '', notes: {},
  motionTab: 'moments', kindFilter: '', momentType: {}, momentText: {}, libCat: 'infos',
  uid: 1, server: { ffmpeg: false }, exporting: false,
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
const select = (options, value, onchange, attrs = {}) => el('select', { onchange: e => onchange(e.target.value), ...attrs },
  ...options.map(([v, n]) => el('option', { value: v, ...(String(v) === String(value) ? { selected: '' } : {}) }, n)));

// ---------- Configurations de rendu ----------
const captionsCfg = style => S.A.chunks.length ? { style, pos: S.captions.pos, chunks: S.A.chunks } : null;

// Médias prêts à dessiner. defaultLayout : mise en page du montage choisi, utilisée
// quand le commentaire ne précise rien.
function mediaCfg(defaultLayout = S.mediaLayout) {
  return S.media.filter(m => m.ready).map(m => {
    const a = m.auto, o = m.override;
    return {
      el: m.el, name: m.name,
      layout: o.layout || (a.explicitLayout ? a.layout : (m.alpha ? 'sticker' : defaultLayout || a.layout)),
      start: o.start ?? a.start, dur: o.dur ?? a.dur, label: o.label ?? a.label, pos: o.pos || a.pos,
    };
  });
}
const base = () => ({
  title: S.title, font: S.font, pal: S.pal, hook: S.hook, titleStart: 0, titleDur: S.titleDur,
  motions: S.taken, media: mediaCfg(), captions: S.captions.on ? captionsCfg(S.captions.style) : null,
  fx: S.fx, depth: S.depthOn && depth.ready ? depth.alpha : null,
});
const proposalCfg = p => ({
  title: p.title, font: p.font, pal: p.pal, hook: p.hook, titleStart: 0, titleDur: p.titleDur,
  motions: p.motions, media: mediaCfg(p.mediaLayout), captions: captionsCfg(p.captions),
  fx: p.fx, depth: (p.depth || S.depthOn) && depth.ready ? depth.alpha : null,
});
// Configuration de l'aperçu principal / de l'export.
const currentCfg = () => S.step === ST.proposals && S.proposals[S.preview] ? proposalCfg(S.proposals[S.preview]) : base();
const cutSaving = segs => segs.reduce((a, [x, y]) => a + (y - x), 0);

function activeCuts() {
  if (S.step === ST.proposals && S.proposals[S.preview]) return S.proposals[S.preview].cuts ? S.cuts.segs : [];
  return S.cuts.on ? S.cuts.segs : [];
}

function recomputeCuts() {
  const A = S.A;
  if (!A.db) { S.cuts.segs = []; return; }
  A.silences = findSilences(A.db, S.cuts.sens, S.cuts.minLen);
  S.cuts.segs = cutsFromSilences(A.silences, A.duration);
}

function regenerateProposals() {
  if (S.A.status !== 'done') return;
  S.proposals = makeProposals(S.A, S.seed, mediaCfg());
  if (S.preview >= S.proposals.length) S.preview = 0;
}

function applyProposal(p) {
  Object.assign(S, { hook: { ...p.hook }, font: p.font, pal: p.pal, title: p.title, titleDur: p.titleDur, applied: p.name, mediaLayout: p.mediaLayout });
  S.taken = p.motions.map(m => ({ ...m, uid: S.uid++ }));
  S.captions.style = p.captions; S.captions.on = true;
  S.cuts.on = p.cuts && S.cuts.segs.length > 0;
  S.fx = { ...DEFAULT_FX, ...p.fx };
  if (p.depth) { S.depthOn = true; startDepth(); }
}

// ---------- Effet « texte en arrière-plan » ----------
// Moteur « browser:… » : MediaPipe dans le navigateur, masque calculé image par image (par défaut,
// aucun serveur nécessaire). Moteur « server:… » : serve.py / depth.py (rembg ou mediapipe Python).
function startDepth() {
  const [kind, name] = S.depthEngine.split(':');
  if (kind === 'browser') return startBrowserMatting(S.file, name, depthProgress);
  if (!S.file || !S.server.matting?.length) return;
  startServerMatting(S.file, name, depthProgress);
}
// L'effet est-il visible à l'écran en ce moment (montage en cours ou proposition en aperçu) ?
const depthActive = () => S.depthOn || !!(S.step === ST.proposals && S.proposals[S.preview]?.depth);
function depthProgress() {
  const bar = $('dbar'), msg = $('dmsg');
  // Pas de redessin complet pendant un export (il effacerait sa barre de progression).
  if (depth.status === 'done' || depth.status === 'error' || !bar) { if (!S.exporting) draw(); return; }
  bar.style.width = (depth.total ? 100 * depth.done / depth.total : 2) + '%';
  msg.textContent = depthText();
}
function depthText() {
  if (depth.status === 'loading') return 'Chargement de MediaPipe et du modèle de détourage (une seule fois)…';
  if (depth.status === 'uploading') return 'Envoi de la vidéo au serveur de détourage…';
  if (depth.status === 'running' && depth.kind === 'browser') return `Préparation de ta silhouette (MediaPipe, ${depth.delegate === 'GPU' ? 'carte graphique' : 'processeur'}) : image ${depth.done} / ${depth.total}. L'effet apparaît déjà sur les images prêtes.`;
  if (depth.status === 'running') return `Détourage en cours${depth.engine && depth.engine !== 'auto' ? ` (${depth.engine})` : ''} : image ${depth.done} / ${depth.total || '…'}${depth.log ? ` — ${depth.log}` : ''}`;
  if (depth.status === 'done') return depth.kind === 'browser'
    ? `Silhouette prête (MediaPipe dans le navigateur, ${depth.delegate === 'GPU' ? 'carte graphique' : 'processeur'}). Le texte passe derrière toi.`
    : `Silhouette prête (${depth.engine}). Le texte passe maintenant derrière toi.`;
  if (depth.status === 'error') return 'Détourage impossible : ' + depth.error;
  return '';
}

// Panneau commun aux étapes de choix du thème : profondeur + motion design.
function fxPanel(C) {
  const engines = [
    ...BROWSER_MODELS.map(([id, name]) => [`browser:${id}`, `Navigateur — ${name}`]),
    ...(S.server.matting?.length ? [['server:auto', 'Serveur Python — auto (rembg, sinon mediapipe)'], ...S.server.matting.map(e => [`server:${e}`, `Serveur Python — ${e}`])] : []),
  ];
  const busy = ['loading', 'uploading', 'running'].includes(depth.status);
  C.append(el('div', { class: 'panel fx' },
    el('h2', {}, 'Effets du thème'),
    el('div', { class: 'options' },
      el('label', {}, el('input', { type: 'checkbox', checked: S.depthOn,
        onchange: e => { S.depthOn = e.target.checked; if (S.depthOn) startDepth(); draw(); } }), el('b', {}, 'Effet Texte en Arrière-plan')),
      el('label', {}, 'Détourage', select(engines, S.depthEngine,
        v => { S.depthEngine = v; resetMatting(); if (S.depthOn) startDepth(); draw(); }, { disabled: busy || null }))),
    el('p', { class: 'muted' }, 'Le titre « Géant derrière toi » et les gros mots (beat, compteur, word pop, phrase cinétique…) passent derrière ta silhouette. Le détourage se fait sur ton ordinateur, rien n\'est envoyé en ligne.'),
    S.depthOn && depth.status !== 'idle' ? el('div', {},
      el('div', { id: 'dmsg', class: depth.status === 'error' ? 'err' : depth.status === 'done' ? 'understood' : 'muted' }, depthText()),
      busy ? el('div', { class: 'progress' }, el('div', { id: 'dbar', style: `width:${depth.total ? 100 * depth.done / depth.total : 2}%` })) : null) : null,
    el('div', { class: 'options' },
      el('label', {}, el('input', { type: 'checkbox', checked: S.fx.pop, onchange: e => { S.fx.pop = e.target.checked; } }), 'Kinetic Pop (le mot clé grossit quand tu le dis)'),
      el('label', {}, el('input', { type: 'checkbox', checked: S.fx.slide, onchange: e => { S.fx.slide = e.target.checked; } }), 'Slide & Blur (entrées par le bas avec flou)'),
      el('label', {}, el('input', { type: 'checkbox', checked: S.fx.glow, onchange: e => { S.fx.glow = e.target.checked; } }), 'Glow néon'),
      el('label', {}, 'Lueur', select(GLOW_COLORS, S.fx.glowColor, v => { S.fx.glowColor = v; S.fx.glow = true; draw(); })))));
}

// ---------- Sons ----------
let audio = null;
function ensureAudio() {
  if (audio) return audio;
  const ac = new AudioContext();
  const src = ac.createMediaElementSource(video);
  const dest = ac.createMediaStreamDestination();
  const sfx = ac.createGain();
  src.connect(dest); src.connect(ac.destination);
  sfx.connect(dest); sfx.connect(ac.destination);
  return audio = { ac, dest, sfx };
}
// L'AudioContext ne peut démarrer qu'après une action de l'utilisateur.
document.addEventListener('pointerdown', () => { ensureAudio().ac.resume(); }, { once: true });

function sfxTimeline(cfg) {
  const ev = [];
  if (cfg.title) ev.push({ t: cfg.titleStart, kind: DEFAULT_SFX.title });
  for (const m of cfg.motions) for (const e of sfxEvents(m)) ev.push({ t: m.start + e.t, kind: e.kind });
  for (const m of cfg.media || []) ev.push({ t: m.start, kind: m.layout === 'full' ? 'whoosh' : DEFAULT_SFX.media });
  return ev.sort((a, b) => a.t - b.t);
}
let lastT = 0;
function tickSfx(cfg, t) {
  if (!S.sfx.on || !audio || audio.ac.state !== 'running') { lastT = t; return; }
  if (t < lastT || t - lastT > .5) { lastT = t; return; }
  for (const e of sfxTimeline(cfg)) if (e.kind && e.t > lastT && e.t <= t) playSfx(audio.ac, audio.sfx, e.kind, S.sfx.vol);
  lastT = t;
}

// ---------- Boucle d'aperçu ----------
let live = []; // { ctx, W, H, cfg: () => o, loop: secondes | null (= temps de la vidéo) }
const mainCtx = $('main').getContext('2d');

function frame(now) {
  try { drawFrame(now); } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}

function drawFrame(now) {
  const clock = now / 1000;
  const mc = $('main');
  if (!S.exporting) updateDepth(video, depthActive());
  // Saut des passages coupés pendant la lecture.
  if (!video.paused && !S.exporting) {
    const seg = activeCuts().find(([a, b]) => video.currentTime >= a && video.currentTime < b - .02);
    if (seg) video.currentTime = seg[1] >= video.duration - .05 ? 0 : seg[1];
  }
  const styleStep = [ST.hook, ST.font, ST.colors, ST.title].includes(S.step);
  if (styleStep) {
    render(mainCtx, mc.width, mc.height, clock % (S.titleDur + .8), { ...base(), motions: [], media: [], captions: null, noSync: true });
  } else if (S.step === ST.import) {
    render(mainCtx, mc.width, mc.height, 0, { ...base(), title: null, motions: [], media: [], captions: null, noSync: true });
  } else {
    const cfg = currentCfg(), t = video.currentTime || 0;
    render(mainCtx, mc.width, mc.height, t, cfg);
    if (!video.paused && !S.exporting) tickSfx(cfg, t);
  }
  for (const l of live) {
    try { render(l.ctx, l.W, l.H, l.loop ? clock % l.loop : video.currentTime || 0, { ...l.cfg(), noSync: true }); } catch (e) { console.error(e); }
  }
  $('time').textContent = `${fmt(video.currentTime)} / ${fmt(video.duration)}`;
  drawTimeline();
}

// Timeline : volume de la voix, coupes (rouge), titre et motions (jaune), médias (bleu), tête de lecture.
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
  const cfg = currentCfg();
  g.fillStyle = 'rgba(255,214,10,.9)';
  if (cfg.title) g.fillRect(0, 2, cfg.titleDur / d * W, 8);
  cfg.motions.forEach((m, i) => g.fillRect(m.start / d * W, 14 + (i % 2) * 10, Math.max(2, m.dur / d * W), 7));
  g.fillStyle = 'rgba(90,170,255,.95)';
  cfg.media.forEach(m => g.fillRect(m.start / d * W, H - 12, Math.max(2, m.dur / d * W), 8));
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
const styleCfg = over => ({ ...base(), motions: [], media: [], captions: null, ...over });

function nextStart(dur) {
  const end = S.taken.reduce((a, m) => Math.max(a, m.start + m.dur), S.titleDur);
  const total = isFinite(video.duration) ? video.duration : 60;
  return Math.max(0, Math.min(+(end + .4).toFixed(1), +(total - dur).toFixed(1)));
}

function goto(step) { S.step = clamp(step, 0, STEPS.length - 1); draw(); window.scrollTo(0, 0); }

function draw() {
  live = [];
  $('dots').replaceChildren(...STEPS.map((s, i) =>
    el('button', { class: 'dot' + (i === S.step ? ' on' : i < S.step ? ' done' : ''), onclick: () => goto(i) }, `${i + 1}. ${s[1]}`)));
  const [, , t1, t2] = STEPS[S.step];
  $('stepText').innerHTML = `<b>Étape ${S.step + 1} sur ${STEPS.length}.</b> ${t1} <span class="muted">${t2}</span>`;
  $('prev').disabled = S.step === 0;
  $('next').style.display = S.step === STEPS.length - 1 ? 'none' : '';
  const C = $('content'); C.replaceChildren();
  ({
    import: stepImport, media: stepMedia, proposals: stepProposals, hook: stepHook, font: stepFont, colors: stepColors,
    title: stepTitle, motions: stepMotions, captions: stepCaptions, export: stepExport,
  })[STEPS[S.step][0]](C);
}

function dropZone(title, hint, accept, multiple, onFiles, disabled = false) {
  const input = el('input', { type: 'file', accept, hidden: '', ...(multiple ? { multiple: '' } : {}), onchange: e => { onFiles([...e.target.files]); e.target.value = ''; } });
  const d = el('div', { class: 'drop', onclick: () => !disabled && input.click() }, el('strong', {}, title), hint, input);
  d.addEventListener('dragover', e => { e.preventDefault(); d.classList.add('over'); });
  d.addEventListener('dragleave', () => d.classList.remove('over'));
  d.addEventListener('drop', e => { e.preventDefault(); d.classList.remove('over'); if (!disabled && e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]); });
  return d;
}

function stepImport(C) {
  const busy = S.A.status === 'running';
  C.append(dropZone(S.fileName ? 'Vidéo chargée — clique pour en changer' : 'Dépose ta vidéo ici',
    'ou clique pour choisir un fichier (.mp4, .mov, .webm)', 'video/*', false, f => loadFile(f[0]), busy));
  C.append(el('div', { class: 'options' },
    el('label', {}, el('input', { type: 'checkbox', checked: S.opts.transcribe, disabled: busy || null, onchange: e => { S.opts.transcribe = e.target.checked; } }),
      'Transcrire la voix (sous-titres + propositions basées sur ce que tu dis)'),
    el('label', {}, 'Langue', select(LANGS, S.opts.lang, v => { S.opts.lang = v; }, { disabled: busy || null }))));
  C.append(el('p', { class: 'muted' }, 'La première transcription télécharge le modèle Whisper (~200 Mo, une seule fois, gardé en cache par le navigateur). Tout tourne sur ton ordinateur.'));
  if (S.A.status !== 'idle') {
    C.append(el('div', { class: 'panel' },
      el('h2', {}, 'Analyse'),
      el('div', { id: 'amsg', class: S.A.status === 'error' ? 'err' : '' }, S.A.msg),
      el('div', { class: 'progress' }, el('div', { id: 'abar', style: `width:${S.A.frac * 100}%` })),
      S.A.asrError ? el('p', { class: 'err' }, 'Transcription impossible : ' + S.A.asrError) : null,
      busy && S.A.transcribing ? el('button', { class: 'btn', onclick: () => cancelTranscription() }, 'Passer la transcription') : null,
      S.A.status === 'done' ? el('div', { class: 'row-btns' },
        el('button', { class: 'btn', onclick: () => goto(ST.media) }, '+ Ajouter des images'),
        el('button', { class: 'btn yellow', onclick: () => goto(ST.proposals) }, 'Voir les propositions →')) : null));
  }
}

function setProgress(msg, frac) {
  S.A.msg = msg; if (frac != null) S.A.frac = frac;
  const m = $('amsg'), b = $('abar');
  if (m) m.textContent = msg;
  if (b && frac != null) b.style.width = frac * 100 + '%';
}

// ---------- Médias ----------
async function addMedia(files) {
  for (const file of files) {
    const isVideo = file.type.startsWith('video/');
    if (!isVideo && !file.type.startsWith('image/')) continue;
    const url = URL.createObjectURL(file);
    const item = { id: S.uid++, name: file.name, url, kind: isVideo ? 'video' : 'image', comment: '', override: {}, ready: false, alpha: false };
    if (isVideo) {
      item.el = Object.assign(document.createElement('video'), { src: url, muted: true, playsInline: true, loop: true, preload: 'auto' });
      await new Promise(r => { item.el.addEventListener('loadeddata', r, { once: true }); item.el.addEventListener('error', r, { once: true }); });
    } else {
      item.el = new Image(); item.el.src = url;
      try { await item.el.decode(); } catch { continue; }
      item.alpha = /png|webp|gif|svg/.test(file.type) && hasAlpha(item.el);
    }
    item.ready = true;
    S.media.push(item);
    interpret(item);
  }
  regenerateProposals();
  draw();
}

function interpret(item) {
  const i = S.media.indexOf(item);
  item.auto = interpretMedia(item, S.A.words, S.A.duration || video.duration || 30, i, S.media.length);
}

function stepMedia(C) {
  C.append(dropZone('Dépose tes images, PNG ou vidéos ici', 'Photos, logos, captures d\'écran, b-roll… Plusieurs fichiers à la fois.', 'image/*,video/*', true, addMedia));
  C.append(el('div', { class: 'panel', style: 'margin-top:16px' },
    el('h2', {}, 'Comment écrire le commentaire'),
    el('p', { class: 'muted' },
      'Dis simplement ce que c\'est et quand le montrer. Exemples : « logo de Claude quand je dis Claude » · « photo de mon pote Guillaume sur scène, plein écran » · ',
      '« capture de l\'appli en haut pendant 4 s » · « petit dans le coin en bas à gauche à 0:12 » · « à la fin ». ',
      'Les PNG détourés deviennent des stickers. Tout reste modifiable à la main.')));
  if (!S.A.words.length && S.media.length) C.append(el('p', { class: 'muted' }, 'Astuce : avec la transcription, « quand je dis … » place le média pile sur le bon mot.'));
  const list = el('div', { class: 'media-list' });
  for (const m of S.media) {
    const c = mediaCfg().find(x => x.el === m.el) || {};
    const thumb = m.kind === 'video' ? el('video', { src: m.url, muted: '', class: 'thumb' }) : el('img', { src: m.url, class: 'thumb' + (m.alpha ? ' checker' : '') });
    const set = (k, v) => { m.override[k] = v; regenerateProposals(); draw(); };
    list.append(el('div', { class: 'media-row panel' },
      thumb,
      el('div', { class: 'media-body' },
        el('div', { class: 'media-name' }, m.name, m.alpha ? el('span', { class: 'chip' }, 'PNG détouré') : null),
        el('textarea', { rows: '2', placeholder: 'Dis-moi quoi en faire… ex. « photo de mon pote sur scène quand je dis Guillaume »', value: m.comment,
          onchange: e => { m.comment = e.target.value; m.override = {}; interpret(m); regenerateProposals(); draw(); } }),
        el('p', { class: 'understood' }, '✓ Compris : ', m.auto.reason.join(', '), ` · ${fmt1(c.start)} → ${fmt1(c.start + c.dur)}`, c.label ? ` · étiquette « ${c.label} »` : ''),
        el('div', { class: 'options compact' },
          el('label', {}, 'Mise en page', select([['', `Auto (${MEDIA_LAYOUTS.find(l => l.id === c.layout)?.name})`], ...MEDIA_LAYOUTS.map(l => [l.id, l.name])], m.override.layout || '', v => set('layout', v || undefined))),
          ['sticker', 'pip'].includes(c.layout) ? el('label', {}, 'Position', select(POSITIONS, c.pos, v => set('pos', v))) : null,
          el('label', {}, 'Début', el('input', { type: 'number', step: '0.1', min: '0', value: (+c.start).toFixed(1), onchange: e => set('start', Math.max(0, +e.target.value || 0)) })),
          el('label', {}, 'Durée', el('input', { type: 'number', step: '0.1', min: '0.5', value: (+c.dur).toFixed(1), onchange: e => set('dur', Math.max(.5, +e.target.value || 1)) })),
          el('label', {}, 'Étiquette', el('input', { type: 'text', value: c.label || '', placeholder: 'texte affiché', onchange: e => set('label', e.target.value) })),
          el('button', { class: 'btn', onclick: () => { video.currentTime = Math.max(0, c.start - .4); video.play().catch(() => {}); } }, '▶ Voir'),
          el('button', { class: 'btn', onclick: () => { S.media = S.media.filter(x => x !== m); regenerateProposals(); draw(); } }, '✕')))));
  }
  C.append(list);
  if (S.media.length) C.append(el('button', { class: 'btn yellow', style: 'margin-top:12px', onclick: () => goto(ST.proposals) }, 'Voir les propositions avec mes médias →'));
}

// ---------- Propositions ----------
function stepProposals(C) {
  if (!S.proposals.length) {
    C.append(el('p', { class: 'muted' }, 'Importe une vidéo pour recevoir des propositions.'), el('button', { class: 'btn', onclick: () => goto(ST.import) }, '← Import'));
    return;
  }
  const A = S.A;
  C.append(el('div', { class: 'banner' },
    el('span', {}, A.words.length ? `${A.words.length} mots transcrits` : 'Pas de transcription (propositions génériques)',
      A.topic ? ` · sujet : ${TOPIC_NAMES[A.topic]}` : '', A.moments?.length ? ` · ${A.moments.length} moments à illustrer` : '',
      ' · ', `${A.peaks.length} temps forts`, ' · ', `${S.media.length} média${S.media.length > 1 ? 's' : ''}`, ' · ',
      S.cuts.segs.length ? `${S.cuts.segs.length} blancs à couper (−${cutSaving(S.cuts.segs).toFixed(1)} s)` : 'aucun blanc à couper'),
    el('button', { class: 'btn', style: 'margin-left:auto', onclick: () => { S.seed++; regenerateProposals(); S.preview = 0; draw(); } }, '↻ Autres propositions')));
  fxPanel(C);
  const g = el('div', { class: 'grid wide' });
  S.proposals.forEach((p, i) => {
    const P = PALETTES[p.pal];
    const names = [...new Set(p.motions.map(m => M[m.type].name))];
    g.append(el('div', { class: 'card' + (i === S.preview ? ' sel' : '') },
      el('span', { class: 'num' }, String(i + 1)),
      liveCanvas(() => proposalCfg(p)),
      el('h3', {}, p.name),
      el('p', {}, p.inspo),
      el('p', { class: 'hookline' }, `« ${p.hook.l1} ${p.hook.l2} »`),
      el('div', { class: 'chips' },
        el('span', {}, p.font), el('span', { style: `border-color:${P.accent};color:${P.accent}` }, P.name),
        el('span', {}, 'Titre ' + TITLES.find(t => t.id === p.title).name.toLowerCase()),
        A.chunks.length ? el('span', {}, 'Sous-titres ' + CAPTION_STYLES.find(c => c.id === p.captions).name.toLowerCase()) : null,
        S.media.length ? el('span', {}, 'Médias : ' + MEDIA_LAYOUTS.find(l => l.id === p.mediaLayout).name.toLowerCase()) : null,
        p.cuts && S.cuts.segs.length ? el('span', {}, `Coupes −${cutSaving(S.cuts.segs).toFixed(1)} s`) : el('span', {}, 'Sans coupes'),
        p.depth ? el('span', { class: 'hot' }, 'Texte derrière toi') : null,
        ...[['pop', 'Kinetic Pop'], ['slide', 'Slide & Blur'], ['glow', 'Glow']].filter(([k]) => p.fx[k]).map(([, n]) => el('span', {}, n)),
        ...names.map(n => el('span', {}, n))),
      el('textarea', { rows: '1', class: 'note', placeholder: 'Ta note (ce qui marche, ce qu\'il faut changer)', value: S.notes[p.name] || '', oninput: e => { S.notes[p.name] = e.target.value; } }),
      el('div', { class: 'row' },
        el('button', { onclick: () => { S.preview = i; video.currentTime = 0; video.play().catch(() => {}); draw(); } }, 'Aperçu'),
        el('button', { class: 'go', onclick: () => { applyProposal(p); goto(ST.hook); } }, 'Choisir'))));
  });
  C.append(g);
}

function appliedBanner(C) {
  if (!S.applied) return;
  C.append(el('div', { class: 'banner' }, el('span', {}, `Montage « ${S.applied} » appliqué. Ajuste ce que tu veux, ou va directement à l'export.`),
    el('button', { class: 'btn yellow', style: 'margin-left:auto', onclick: () => goto(ST.export) }, 'Aller à l\'export →')));
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
  C.append(choiceGrid(FONTS, f => f.name === S.font, f => S.font = f.name, f => styleCfg({ font: f.name })));
}
function stepColors(C) {
  appliedBanner(C);
  C.append(choiceGrid(PALETTES.map((p, i) => ({ ...p, i })), p => p.i === S.pal, p => S.pal = p.i, p => styleCfg({ pal: p.i }),
    p => el('div', { class: 'swatches' }, ...[p.accent, p.text, p.ink, p.panel].map(c => el('i', { style: `background:${c}` })))));
}
function stepTitle(C) {
  appliedBanner(C);
  fxPanel(C);
  C.append(choiceGrid(TITLES, t => t.id === S.title, t => S.title = t.id, t => styleCfg({ title: t.id }), t => el('p', {}, t.desc)));
}

// ---------- Motions : les moments de ta vidéo, et la bibliothèque ----------
const momentById = id => S.A.moments?.find(m => m.id === id);
const momentTypeOf = m => S.momentType[m.id] || m.candidates[0];
// Motion prête à placer pour un moment (type et texte éventuellement modifiés par l'utilisateur).
function momentMotion(m) {
  const mo = motionFromMoment(m, momentTypeOf(m));
  if (S.momentText[m.id] != null) mo.text = S.momentText[m.id];
  return mo;
}
const sentenceAt = t => (S.A.sentences || []).find(s => t >= s.s - .2 && t <= s.e + .2);

function toggleMoment(m) {
  const on = S.taken.find(x => x.momentId === m.id);
  if (on) S.taken = S.taken.filter(x => x !== on);
  else S.taken.push({ ...momentMotion(m), uid: S.uid++ });
  draw();
}
function refreshMoment(m) {
  const i = S.taken.findIndex(x => x.momentId === m.id);
  if (i >= 0) S.taken[i] = { ...momentMotion(m), uid: S.taken[i].uid };
}

function stepMotions(C) {
  appliedBanner(C);
  const moments = S.A.moments || [];
  C.append(el('div', { class: 'tabs' },
    el('button', { class: 'tab' + (S.motionTab === 'moments' ? ' on' : ''), onclick: () => { S.motionTab = 'moments'; draw(); } },
      'Moments de ta vidéo ', el('span', { class: 'muted' }, String(moments.length))),
    el('button', { class: 'tab' + (S.motionTab === 'lib' ? ' on' : ''), onclick: () => { S.motionTab = 'lib'; draw(); } }, 'Bibliothèque'),
    el('span', { class: 'muted', style: 'margin-left:auto;align-self:center' }, `${S.taken.filter(x => x.type !== 'zoom').length} animation(s) dans ton montage`)));
  if (S.motionTab === 'lib') return stepLibrary(C);

  if (!moments.length) {
    C.append(el('div', { class: 'panel' }, el('h2', {}, 'Aucun moment repéré'),
      el('p', { class: 'muted' }, S.A.words.length
        ? 'La transcription ne contient ni chiffre, ni liste, ni question, ni mot fort exploitable. Utilise la bibliothèque pour ajouter des animations à la main.'
        : 'Sans transcription, l\'app ne peut pas savoir ce que tu dis. Lance la transcription (étape Sous-titres) ou utilise la bibliothèque.')));
    return;
  }
  C.append(el('p', { class: 'muted' }, S.A.topic ? `Sujet repéré : ${TOPIC_NAMES[S.A.topic]}. ` : '',
    'Chaque carte est un moment de ta vidéo, avec l\'animation qui illustre ce que tu dis à cet instant. Clique sur une carte pour l\'ajouter ou la retirer.'));
  const kinds = [...new Set(moments.map(m => m.kind))];
  C.append(el('div', { class: 'tabs small' },
    el('button', { class: 'tab' + (!S.kindFilter ? ' on' : ''), onclick: () => { S.kindFilter = ''; draw(); } }, 'Tous'),
    ...kinds.map(k => el('button', { class: 'tab' + (S.kindFilter === k ? ' on' : ''), onclick: () => { S.kindFilter = k; draw(); } },
      KIND_NAMES[k], ' ', el('span', { class: 'muted' }, String(moments.filter(m => m.kind === k).length))))));
  const g = el('div', { class: 'grid' });
  for (const m of moments) {
    if (S.kindFilter && m.kind !== S.kindFilter) continue;
    const added = S.taken.some(x => x.momentId === m.id);
    const sent = sentenceAt(m.t);
    const preview = () => { const mo = momentMotion(m); return { ...mo, start: .3, times: mo.times }; };
    const card = el('div', { class: 'card clickable moment' + (added ? ' taken' : ''), onclick: e => { if (!e.target.closest('select,input,button')) toggleMoment(m); } },
      el('span', { class: 'num' }, `${fmt1(m.t)} · ${KIND_NAMES[m.kind]}`),
      el('span', { class: 'badge' }, added ? '✓ Ajouté' : '+ Ajouter'),
      liveCanvas(() => ({ ...base(), title: null, captions: null, media: [], motions: [preview()], frame: m.frame }), preview().dur + .8),
      el('p', { class: 'quote' }, `« ${(sent?.text || m.text).slice(0, 110)} »`),
      el('div', { class: 'options compact' },
        m.candidates.length > 1 ? select(m.candidates.map(c => [c, M[c].name]), momentTypeOf(m), v => { S.momentType[m.id] = v; delete S.momentText[m.id]; refreshMoment(m); draw(); }) : el('b', {}, M[m.candidates[0]].name),
        el('button', { class: 'btn', onclick: () => { video.currentTime = Math.max(0, m.t - 1); video.play().catch(() => {}); } }, '▶ Voir')),
      el('input', { type: 'text', class: 'mtext', value: S.momentText[m.id] ?? motionText(m, momentTypeOf(m)), title: M[momentTypeOf(m)].hint || '',
        oninput: e => { S.momentText[m.id] = e.target.value; refreshMoment(m); } }));
    g.append(card);
  }
  C.append(g);
}

// Bibliothèque : toutes les animations, ajoutées à la tête de lecture avec le texte de ce moment-là.
function libraryText(type) {
  const t = video.currentTime || 0;
  const m = (S.A.moments || []).filter(x => x.candidates.includes(type)).sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0];
  if (m && Math.abs(m.t - t) < 8) return motionText(m, type);
  const s = sentenceAt(t);
  if (s && M[type].text && !/\|/.test(M[type].text) && type !== 'emoji') return s.words.slice(0, 6).map(w => w.w).join(' ');
  return M[type].text;
}
function stepLibrary(C) {
  C.append(el('p', { class: 'muted' }, 'Place la tête de lecture où tu veux l\'animation, puis clique sur une carte : elle s\'ajoute à ce moment avec le texte de ce que tu dis (modifiable à l\'étape Export).'));
  C.append(el('div', { class: 'tabs small' }, ...CATEGORIES.map(c => el('button', { class: 'tab' + (S.libCat === c.id ? ' on' : ''), onclick: () => { S.libCat = c.id; draw(); } }, c.name))));
  const g = el('div', { class: 'grid' });
  for (const def of MOTIONS) {
    if (def.cat !== S.libCat) continue;
    const n = S.taken.filter(x => x.type === def.id).length;
    const sample = { type: def.id, variant: 0, start: .3, dur: def.dur, text: libraryText(def.id) };
    g.append(el('div', { class: 'card clickable' + (n ? ' taken' : ''), onclick: () => {
      const t = +(video.currentTime || 0).toFixed(2);
      S.taken.push({ uid: S.uid++, type: def.id, variant: 0, start: t, dur: def.dur, text: libraryText(def.id) });
      draw();
    } },
      el('span', { class: 'badge' }, n ? `✓ ${n} dans le montage` : `+ Ajouter à ${fmt1(video.currentTime || 0)}`),
      liveCanvas(() => ({ ...base(), title: null, captions: null, media: [], motions: [sample] }), def.dur + .8),
      el('h3', {}, def.name), el('p', {}, def.desc)));
  }
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
        el('label', {}, 'Langue', select(LANGS, S.opts.lang, v => { S.opts.lang = v; })),
        el('button', { class: 'btn yellow', disabled: !A.pcm || busy || null, onclick: runTranscription }, busy ? 'Transcription en cours…' : 'Transcrire')),
      el('div', { id: 'amsg', class: 'muted' }, busy ? A.msg : ''),
      el('div', { class: 'progress' }, el('div', { id: 'abar', style: `width:${A.frac * 100}%` }))));
    return;
  }
  C.append(el('div', { class: 'options' },
    el('label', {}, el('input', { type: 'checkbox', checked: S.captions.on, onchange: e => { S.captions.on = e.target.checked; draw(); } }), 'Afficher les sous-titres'),
    el('label', {}, 'Position', el('input', { type: 'range', min: '0.3', max: '0.9', step: '0.01', value: S.captions.pos, oninput: e => { S.captions.pos = +e.target.value; } }))));
  C.append(choiceGrid(CAPTION_STYLES, c => c.id === S.captions.style, c => { S.captions.style = c.id; S.captions.on = true; },
    c => ({ ...base(), title: null, motions: [], media: [], captions: captionsCfg(c.id) }), c => el('p', {}, c.desc), null));
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
  Object.assign(A, analyzeContent(A.words, A.peaks, A.duration));
  captureMomentFrames();
  A.status = 'done';
  S.media.forEach(interpret);
  regenerateProposals();
  setProgress(A.words.length ? `Terminé : ${A.words.length} mots transcrits.` : 'Terminé.', 1);
  draw();
}

function asrProgress(p) {
  if (p.phase === 'download') setProgress(`Téléchargement du modèle Whisper… ${(p.loaded / 1e6).toFixed(0)} / ${(p.total / 1e6).toFixed(0)} Mo`, .1 + .3 * p.loaded / p.total);
  else setProgress(`Transcription… ${fmt(p.done)} / ${fmt(p.total)}`, .4 + .6 * p.done / p.total);
}

// ---------- Export ----------
function stepExport(C) {
  appliedBanner(C);
  const A = S.A;
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

  C.append(el('div', { class: 'panel' }, el('h2', {}, 'Effets sonores'),
    el('div', { class: 'options' },
      el('label', {}, el('input', { type: 'checkbox', checked: S.sfx.on, onchange: e => { S.sfx.on = e.target.checked; } }), 'Ajouter des sons (pop, whoosh, impact, frappe…) sur les animations'),
      el('label', {}, 'Volume', el('input', { type: 'range', min: '0', max: '1', step: '0.05', value: S.sfx.vol, oninput: e => { S.sfx.vol = +e.target.value; } }))),
    el('p', { class: 'muted' }, 'Les sons sont générés par l\'app (aucun fichier), entendus en lecture et mixés dans l\'export.')));

  const rows = [...S.taken].sort((a, b) => a.start - b.start);
  const num = (m, key) => el('input', { type: 'number', step: '0.1', min: key === 'dur' ? '0.3' : '0', value: m[key],
    oninput: e => { const v = parseFloat(e.target.value); if (isFinite(v)) m[key] = Math.max(key === 'dur' ? .3 : 0, v); } });
  C.append(el('div', { class: 'panel' }, el('h2', {}, 'Timing des motions'),
    rows.length ? null : el('p', { class: 'muted' }, 'Aucune motion — choisis une proposition ou garde-en à l\'étape Motions.'),
    el('div', { class: 'scroll' }, el('table', {},
      el('tr', {}, ...['Motion', 'Début (s)', 'Durée (s)', 'Texte', 'Son', '', ''].map(h => el('th', {}, h))),
      el('tr', {}, el('td', {}, 'Titre (hook)'), el('td', {}, '0'), el('td', {}, String(S.titleDur)), el('td', {}, `${S.hook.l1} / ${S.hook.l2}`), el('td'), el('td'), el('td')),
      ...rows.map(m => el('tr', {},
        el('td', {}, M[m.type].name + (m.variant ? ` v${m.variant + 1}` : '')),
        el('td', {}, num(m, 'start')),
        el('td', {}, num(m, 'dur')),
        el('td', {}, m.text != null ? el('input', { type: 'text', value: m.text, title: M[m.type].hint || '', placeholder: M[m.type].hint || '', oninput: e => { m.text = e.target.value; } }) : el('span', { class: 'muted' }, '—')),
        el('td', {}, select(SFX, m.sfx ?? DEFAULT_SFX[m.type] ?? '', v => { m.sfx = v; })),
        el('td', {}, el('button', { onclick: () => { m.start = +video.currentTime.toFixed(1); draw(); } }, '⇤ Tête de lecture')),
        el('td', {}, el('button', { onclick: () => { S.taken = S.taken.filter(x => x !== m); draw(); } }, '✕'))))))));

  C.append(el('div', { class: 'panel' }, el('h2', {}, 'Export'),
    el('button', { class: 'btn yellow', id: 'exportBtn', onclick: exportVideo }, 'Exporter la vidéo'),
    el('div', { class: 'progress' }, el('div', { id: 'bar' })),
    el('p', { class: 'muted', id: 'status' },
      S.server.ffmpeg ? 'ffmpeg détecté : l\'export sera converti en MP4 H.264.' : 'Lance « python3 serve.py » avec ffmpeg installé pour obtenir un MP4 (sinon export WebM).'),
    el('p', { class: 'muted' }, 'L\'export se fait en temps réel : la vidéo est rejouée et capturée. Garde l\'onglet au premier plan.')));

  C.append(el('div', { class: 'panel' }, el('h2', {}, 'Couverture du reel'),
    el('p', { class: 'muted' }, 'Place la tête de lecture sur la bonne image, le titre (ton hook) est ajouté dans ton style. Ça donne un PNG 1080 × 1920 à mettre en couverture.'),
    el('button', { class: 'btn', onclick: downloadCover }, 'Télécharger la couverture (PNG)')));

  C.append(el('div', { class: 'panel' }, el('h2', {}, 'Brief pour Claude'),
    el('p', { class: 'muted' }, 'Résume tout ton montage : médias et ce que tu as écrit dessus, éléments gardés / jetés et tes notes. Colle-le dans ta conversation avec Claude pour qu\'il ajuste l\'app ou le montage.'),
    el('div', { class: 'row-btns' },
      el('button', { class: 'btn', onclick: e => { navigator.clipboard.writeText(brief()).then(() => { e.target.textContent = 'Copié ✓'; }); } }, 'Copier le brief'),
      el('button', { class: 'btn', onclick: () => el('a', { href: URL.createObjectURL(new Blob([brief()], { type: 'text/markdown' })), download: 'brief-montage.md' }).click() }, 'Télécharger (.md)'))));
}

function downloadCover() {
  const c = el('canvas', { width: 1080, height: 1920 });
  const t = video.currentTime || 0;
  render(c.getContext('2d'), 1080, 1920, t, { ...base(), motions: [], media: [], captions: null, noSync: true, titleStart: t - S.titleDur * .5 });
  c.toBlob(b => el('a', { href: URL.createObjectURL(b), download: (S.fileName.replace(/\.[^.]+$/, '') || 'reel') + '-couverture.png' }).click(), 'image/png');
}

function brief() {
  const L = [];
  const cfg = base();
  L.push(`# Brief de montage — ${S.fileName || 'vidéo'}`, '');
  L.push(`- Durée : ${fmt(S.A.duration)}${S.cuts.on ? ` (−${cutSaving(S.cuts.segs).toFixed(1)} s de blancs coupés)` : ''}`);
  L.push(`- Montage de départ : ${S.applied || 'aucun'}`);
  L.push(`- Hook : « ${S.hook.l1} / ${S.hook.l2} » — titre ${TITLES.find(t => t.id === S.title).name}, police ${S.font}, couleurs ${PALETTES[S.pal].name}`);
  L.push(`- Sous-titres : ${S.captions.on && S.A.chunks.length ? CAPTION_STYLES.find(c => c.id === S.captions.style).name : 'non'} · Sons : ${S.sfx.on ? 'oui' : 'non'}`);
  L.push(`- Effets : ${[S.depthOn && 'texte en arrière-plan', S.fx.pop && 'Kinetic Pop', S.fx.slide && 'Slide & Blur', S.fx.glow && `Glow (${GLOW_COLORS.find(g => g[0] === S.fx.glowColor)?.[1]})`].filter(Boolean).join(', ') || 'aucun'}`, '');
  if (S.media.length) {
    L.push('## Médias');
    S.media.forEach((m, i) => {
      const c = cfg.media.find(x => x.el === m.el);
      L.push(`${i + 1}. **${m.name}** — commentaire : « ${m.comment || '(vide)'} »`,
        `   → ${MEDIA_LAYOUTS.find(l => l.id === c.layout).name}, ${fmt1(c.start)} pendant ${c.dur.toFixed(1)} s${c.label ? `, étiquette « ${c.label} »` : ''}`);
    });
    L.push('');
  }
  if (S.taken.length) {
    L.push('## Motions dans le montage');
    [...S.taken].sort((a, b) => a.start - b.start).forEach(m => L.push(`- ${fmt1(m.start)} ${M[m.type].name}${m.text ? ` — « ${m.text} »` : ''}`));
    L.push('');
  }
  const notes = Object.entries(S.notes).filter(([, n]) => n);
  if (notes.length) { L.push('## Notes sur les propositions'); notes.forEach(([n, t]) => L.push(`- ${n} : ${t}`)); L.push(''); }
  return L.join('\n');
}

// Image de la vidéo à chaque moment repéré (fond des cartes « Moments de ta vidéo »).
async function captureMomentFrames() {
  const file = S.file, moments = S.A.moments || [];
  if (!file || !moments.length) return;
  const v = Object.assign(document.createElement('video'), { src: URL.createObjectURL(file), muted: true, playsInline: true, preload: 'auto' });
  try {
    await new Promise((res, rej) => { v.addEventListener('loadeddata', res, { once: true }); v.addEventListener('error', rej, { once: true }); });
    const w = 270, h = Math.round(w * v.videoHeight / v.videoWidth);
    for (const m of moments) {
      if (S.file !== file) break;
      await new Promise(res => { v.addEventListener('seeked', res, { once: true }); v.currentTime = Math.min(v.duration - .05, m.t + .2); });
      m.frame = await createImageBitmap(v, { resizeWidth: w, resizeHeight: h });
    }
  } catch { /* les cartes gardent l'image en cours de la vidéo */ }
  v.removeAttribute('src');
}

// ---------- Import & analyse ----------
async function loadFile(file) {
  if (!file) return;
  cancelTranscription();
  resetMatting();
  S.file = file;
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
    Object.assign(A, analyzeContent(A.words, A.peaks, A.duration));
    captureMomentFrames();
    A.status = 'done';
    S.media.forEach(interpret);
    regenerateProposals();
    setProgress(`Analyse terminée${A.words.length ? ` : ${A.words.length} mots transcrits` : ''}. ${S.proposals.length} montages proposés.`, 1);
    S.preview = 0;
    video.currentTime = 0;
    if (S.depthOn) startDepth();
    goto(S.media.length ? ST.proposals : ST.media);
  } catch (e) {
    A.status = 'error'; setProgress('Erreur d\'analyse : ' + e.message, 0); draw();
  }
}

$('play').onclick = () => { video.paused ? video.play() : video.pause(); };
video.addEventListener('play', () => $('play').textContent = 'Pause');
video.addEventListener('pause', () => $('play').textContent = 'Lecture');
$('back5').onclick = () => { video.currentTime = Math.max(0, video.currentTime - 5); };
$('fwd5').onclick = () => { video.currentTime = Math.min(video.duration || 0, video.currentTime + 5); };
$('prev').onclick = () => goto(S.step - 1);
$('next').onclick = () => goto(S.step + 1);

const seekTo = t => new Promise(r => { video.addEventListener('seeked', r, { once: true }); video.currentTime = t; });

async function exportVideo() {
  if (S.exporting) return;
  if (!video.src) { alert('Importe d\'abord une vidéo (étape 1).'); return; }
  S.exporting = true;
  const btn = $('exportBtn'), bar = $('bar'), status = $('status');
  btn.disabled = true;
  try {
    if (S.depthOn && depth.kind === 'browser' && depth.status === 'running') {
      status.textContent = 'Attente de la fin de la préparation de ta silhouette…';
      await whenPrepared();
    }
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
    lastT = video.currentTime - .01;
    updateDepth(video, S.depthOn);
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
        lastT = video.currentTime - .01;
        updateDepth(video, S.depthOn);
        render(ctx, W, H, video.currentTime, cfg);
        rec.resume(); await video.play();
        busy = false;
      } else if (!busy) {
        updateDepth(video, S.depthOn);
        render(ctx, W, H, t, cfg);
        tickSfx(cfg, t);
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
document.fonts.ready.then(() => Promise.all([...FONTS, { family: 'Caveat', weight: 700 }, { family: 'Inter', weight: 800, style: 'italic' }].map(f => document.fonts.load(fstr(f, 40))))).catch(() => {});
draw();
requestAnimationFrame(frame);
