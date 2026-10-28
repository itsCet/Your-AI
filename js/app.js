// Video Edit Studio : trois onglets.
//  - Look : 7 étapes (couleurs, polices, accroche, sous-titres, éléments, motion, revue). Chaque carte
//    montre ta vidéo avec l'option ; un clic l'applique partout.
//  - Édition : ta transcription comme un document. Tu corriges les mots, tu barres ce qu'il faut couper,
//    chaque animation est posée sur ses mots et se modifie (texte, moment, type).
//  - Revue : coupes, sous-titres, sons, export, couverture.
import { render, setVideo, lookContext } from './render.js';
import { fstr, clamp, PALETTES } from './kit.js';
import { FONT_PAIRS, HOOK_STYLES, CAPTION_STYLES, ELEMENTS, MOTIONS, REEL_EFFECTS, CATALOG, PRESETS, DEFAULT_LOOK } from './look.js';
import { NEEDS_MATTE } from './reel.js';
import { decodeAudio, loudness, findPeaks, transcribe, cancelTranscription, chunkWords } from './analyze.js';
import { autoPlan, itemFromMoment, claudePrompt, parsePlan, planToItems, hookFrom, wordIndexAt } from './plan.js';
import { MEDIA_LAYOUTS, POSITIONS, interpretMedia, hasAlpha } from './media.js';
import { SFX, DEFAULT_SFX, sfxEvents, playSfx, loadSfxLibrary } from './sfx.js';
import { TRANSITIONS, TRANS_STYLES, TRANS_SFX, planTransitions, transName } from './transitions.js';
import { RHYTHMS, rhythmOf, pauseCuts, wordCuts, cleanupSummary } from './cleanup.js';
import { depth, BROWSER_MODELS, startBrowserMatting, startServerMatting, resetMatting, updateDepth, whenPrepared } from './depth.js';

const LANGS = [['fr', 'Français'], ['en', 'Anglais'], ['es', 'Espagnol'], ['de', 'Allemand'], ['it', 'Italien'], ['pt', 'Portugais'], ['ar', 'Arabe'], ['', 'Détection auto']];
const LOOK_STEPS = ['Couleurs', 'Polices', 'Accroche', 'Sous-titres', 'Éléments', 'Motion', 'Transitions', 'Revue'];
const CHIP_COLORS = { note: '#ffd60a', colorcard: '#ffb020', stamp: '#ff7a59', statcard: '#7ee0ff', checklist: '#3ddc97', versus: '#ff9bd2', emoji: '#ffe08a',
  screen: '#a0b4ff', lower: '#c8c8c8', orbit: '#b892ff', carousel: '#b892ff', shrink: '#ffd60a', comment: '#ffffff', wordreveal: '#ffe600', counter: '#7ee0ff',
  kinetic: '#ff8a65', beat: '#ff5a4f', morph: '#e9e7e2', chapter: '#e9e7e2',
  couchwall: '#c3f0ca', uiworld: '#c3f0ca', framebreak: '#c3f0ca', phonemockup: '#c3f0ca', headlinewall: '#c3f0ca', chartgrow: '#c3f0ca', pullback: '#c3f0ca',
  greenscreen: '#c3f0ca', papercut: '#c3f0ca', doodleboil: '#c3f0ca', vertigo: '#c3f0ca', coverstory: '#c3f0ca', glasstype: '#c3f0ca', zoom: '#9e9e9e', spotlight: '#9e9e9e' };

const S = {
  tab: 'look', lookStep: 0, visited: new Set([0]),
  file: null, fileName: '',
  A: { status: 'idle', msg: '', frac: 0, duration: 0, pcm: null, db: null, peaks: [], words: [], asrError: '' },
  opts: { transcribe: true, lang: 'fr' },
  words: [], chunks: [], sentences: [], moments: [], topic: '',
  look: { ...DEFAULT_LOOK }, hook: { l1: 'Ton accroche', l2: 'en deux lignes' }, titleDur: 3,
  items: [], media: [], photos: [], sample: null,
  captions: { on: true, pos: .72 },
  cuts: { on: true, sens: .3, rhythm: 'balanced', segs: [], lowRange: false, clean: { fillers: true, hedges: false, repeats: true, retakes: true } }, cutSegs: [], transOver: {},
  sfx: { on: true, vol: .6 }, depthOn: false, depthEngine: 'browser:multiclass',
  sel: null, lastWord: 0, dict: loadDict(),
  uid: 1, server: { ffmpeg: false, matting: [] }, exporting: false,
};

const $ = id => document.getElementById(id);
const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { return null; } };
// Téléphone ou tablette : la transcription n'utilise pas la carte graphique (WebGPU), trop fragile dans Safari.
const isPhone = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const fmt = s => isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00';
const fmt1 = s => `${Math.floor(s / 60)}:${(Math.max(0, s) % 60).toFixed(1).padStart(4, '0')}`;
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

// ---------- Dictionnaire de corrections (mémorisé dans le navigateur) ----------
function loadDict() { try { return JSON.parse(localStorage.getItem('ves-dict') || '{}'); } catch { return {}; } }
function saveDict() { try { localStorage.setItem('ves-dict', JSON.stringify(S.dict)); } catch { /* navigation privée */ } }
const core = w => w.replace(/^[«"“(]+|[.,!?;:»"”)…]+$/g, '');
const keyW = w => core(w).toLowerCase();
// Remplace le cœur d'un mot en gardant sa ponctuation (« bluetooth, » → « Bluetooth, »).
const withCore = (w, c) => { const m = w.match(/^([«"“(]*)(.*?)([.,!?;:»"”)…]*)$/); return m[1] + c + m[3]; };

// ---------- Données dérivées : sous-titres et coupes ----------
function refreshDerived() {
  S.chunks = chunkWords(S.words.filter(w => !w.cut));
  const segs = S.cuts.on ? [...S.cuts.segs] : [];
  // Mots barrés : on coupe du début du mot au début du mot gardé suivant.
  for (let i = 0; i < S.words.length; i++) {
    if (!S.words[i].cut) continue;
    let j = i; while (j + 1 < S.words.length && S.words[j + 1].cut) j++;
    const a = S.words[i].s - .03, b = j + 1 < S.words.length ? S.words[j + 1].s - .03 : S.A.duration;
    segs.push([Math.max(0, a), b]); i = j;
  }
  segs.sort((x, y) => x[0] - y[0]);
  const merged = [];
  for (const sg of segs) { const last = merged[merged.length - 1]; if (last && sg[0] <= last[1] + .05) last[1] = Math.max(last[1], sg[1]); else merged.push([...sg]); }
  S.cutSegs = merged;
}
const cutSaving = () => S.cutSegs.reduce((a, [x, y]) => a + (y - x), 0);

function recomputeSilences() {
  if (!S.A.db) { S.cuts.segs = []; return; }
  const r = pauseCuts(S.A.db, S.A.duration, S.cuts.rhythm, S.cuts.sens);
  S.cuts.segs = r.segs; S.cuts.lowRange = r.lowRange;
}

// Nettoyage : hésitations, tics, répétitions, reprises (mots barrés avec la raison, rétablissables).
// Les mots que tu as coupés ou rétablis à la main ne sont pas touchés.
function applyCleanup() {
  for (const w of S.words) if (w.cutWhy) { w.cut = false; w.cutWhy = null; }
  const free = S.words.map(w => !w.cut && !w.manual);
  for (const { a, b, why } of wordCuts(S.words, S.cuts.clean)) {
    if (S.words.slice(a, b + 1).every((_, k) => free[a + k])) for (let i = a; i <= b; i++) { S.words[i].cut = true; S.words[i].cutWhy = why; }
  }
  refreshDerived();
}
function cleanupPanel(after = draw) {
  const sum = cleanupSummary(S.A.duration, S.cutSegs, S.words);
  const c = S.cuts.clean;
  const opt = (k, label) => el('label', {}, el('input', { type: 'checkbox', checked: c[k], onchange: e => { S.cuts.clean = { ...c, [k]: e.target.checked }; applyCleanup(); after(); } }), label);
  const whyTxt = Object.entries(sum.why).map(([k, n]) => `${n} ${k}`).join(' · ');
  return el('div', { class: 'panel' }, el('h2', {}, 'Nettoyage et rythme'),
    el('div', { class: 'chips-row', style: 'margin-bottom:6px' }, el('span', { class: 'muted' }, 'Rythme :'),
      ...RHYTHMS.map(r => el('button', { class: 'chip-btn' + (S.cuts.rhythm === r.id ? ' on' : ''), title: r.desc, onclick: () => {
        S.cuts.rhythm = r.id; S.cuts.on = true; S.cuts.clean = { ...S.cuts.clean, hedges: r.hedges }; recomputeSilences(); applyCleanup(); after();
      } }, r.name))),
    el('p', { class: 'muted', style: 'margin:0 0 6px' }, rhythmOf(S.cuts.rhythm).desc + '.'),
    el('div', { class: 'options' },
      el('label', {}, el('input', { type: 'checkbox', checked: S.cuts.on, onchange: e => { S.cuts.on = e.target.checked; refreshDerived(); after(); } }), 'Raccourcir les blancs'),
      opt('fillers', 'Hésitations (euh, hum, bah)'),
      opt('hedges', 'Tics de langage (en fait, du coup, genre, tu vois…)'),
      opt('repeats', 'Répétitions et faux départs'),
      opt('retakes', 'Reprises (garder la dernière prise)')),
    S.A.db ? el('div', { class: 'options' }, el('label', {}, 'Sensibilité aux blancs', el('input', { type: 'range', min: '0.1', max: '0.6', step: '0.02', value: S.cuts.sens,
      onchange: e => { S.cuts.sens = +e.target.value; recomputeSilences(); refreshDerived(); after(); } }))) : null,
    S.cuts.lowRange ? el('p', { class: 'err' }, 'Micro bruyant : la voix et le silence sont trop proches pour bien repérer les blancs. Vérifie les coupes en lecture.') : null,
    el('p', {}, `${fmt(sum.before)} → `, el('b', {}, fmt(sum.after)), ` (−${Math.round(sum.pct * 100)} %) · ${sum.plans} plans, ${sum.median.toFixed(1)} s en médiane`),
    el('p', { class: 'muted', style: 'margin:0' }, (whyTxt ? 'Mots coupés : ' + whyTxt + '. ' : '') + 'Ils sont barrés dans l\'Édition (la raison s\'affiche au survol) ; clique dessus pour les rétablir.'));
}

// ---------- Médias ----------
function mediaCfg() {
  return S.media.filter(m => m.ready).map(m => {
    const a = m.auto, o = m.override;
    return { el: m.el, name: m.name, layout: o.layout || (m.alpha && !a.explicitLayout ? 'sticker' : a.layout),
      start: o.start ?? a.start, dur: o.dur ?? a.dur, label: o.label ?? a.label, pos: o.pos || a.pos };
  });
}

// Transitions entre les plans (recalculées seulement quand les coupes, le style ou tes choix changent).
let transMemo = { k: null, v: [] };
function transitions() {
  const style = S.look.trans || 'auto';
  const k = [S.cutSegs, style, JSON.stringify(S.transOver), S.words.length];
  if (transMemo.k && k.every((x, i) => x === transMemo.k[i])) return transMemo.v;
  transMemo = { k, v: planTransitions(S.cutSegs, S.words, style, S.transOver, S.A.duration || video.duration || Infinity) };
  return transMemo.v;
}

// Configuration de rendu complète.
function cfg(over = {}) {
  return {
    transitions: transitions(),
    look: S.look, hook: S.hook, titleStart: 0, titleDur: S.titleDur,
    motions: S.items.map(itemForRender), media: mediaCfg(),
    captions: S.captions.on && S.chunks.length ? { style: S.look.captions, pos: S.captions.pos, chunks: S.chunks } : null,
    depth: S.depthOn && depth.ready ? depth.alpha : null, photos: S.photos, ...over,
  };
}
// L'écran d'appli affiche le média choisi s'il y en a un.
function itemForRender(it) {
  if (it.type === 'screen' && it.mediaId) { const m = S.media.find(x => x.id === it.mediaId); if (m) return { ...it, mediaEl: m.el }; }
  return it;
}

// ---------- Effet « texte derrière toi » ----------
function startDepth() {
  const [kind, name] = S.depthEngine.split(':');
  if (kind === 'browser') return startBrowserMatting(S.file, name, depthProgress);
  if (!S.file || !S.server.matting?.length) return;
  startServerMatting(S.file, name, depthProgress);
}
function depthProgress() {
  const bar = $('dbar'), msg = $('dmsg');
  if (depth.status === 'done' || depth.status === 'error' || !bar) { if (!S.exporting) draw(); return; }
  bar.style.width = (depth.total ? 100 * depth.done / depth.total : 2) + '%';
  msg.textContent = depthText();
}
function depthText() {
  if (depth.status === 'loading') return 'Chargement du détourage (une seule fois)…';
  if (depth.status === 'uploading') return 'Envoi de la vidéo au serveur de détourage…';
  if (depth.status === 'running') return `Préparation de ta silhouette : image ${depth.done} / ${depth.total || '…'}. L'effet apparaît déjà sur les images prêtes.`;
  if (depth.status === 'done') return `Silhouette prête (${depth.kind === 'browser' ? 'navigateur, ' + (depth.delegate === 'GPU' ? 'carte graphique' : 'processeur') : depth.engine}).`;
  if (depth.status === 'error') return 'Détourage impossible : ' + depth.error;
  return '';
}
function depthPanel() {
  const engines = [
    ...BROWSER_MODELS.map(([id, name]) => [`browser:${id}`, `Navigateur — ${name}`]),
    ...(S.server.matting?.length ? [['server:auto', 'Serveur Python — auto'], ...S.server.matting.map(e => [`server:${e}`, `Serveur Python — ${e}`])] : []),
  ];
  const busy = ['loading', 'uploading', 'running'].includes(depth.status);
  return el('div', { class: 'panel', style: 'margin-top:14px' },
    el('div', { class: 'options' },
      el('label', {}, el('input', { type: 'checkbox', checked: S.depthOn, onchange: e => { S.depthOn = e.target.checked; if (S.depthOn) startDepth(); draw(); } }),
        el('b', {}, 'Effet Texte en Arrière-plan')),
      el('label', {}, 'Détourage', select(engines, S.depthEngine, v => { S.depthEngine = v; resetMatting(); if (S.depthOn) startDepth(); draw(); }, { disabled: busy || null }))),
    el('p', { class: 'muted' }, 'L\'accroche « Géant derrière toi » et les gros textes (phrase plein écran, beat cuts, compteur, mots surlignés, écran d\'appli) passent derrière ta silhouette.'),
    S.depthOn && depth.status !== 'idle' ? el('div', {},
      el('div', { id: 'dmsg', class: depth.status === 'error' ? 'err' : depth.status === 'done' ? 'ok' : 'muted' }, depthText()),
      busy ? el('div', { class: 'progress' }, el('div', { id: 'dbar', style: `width:${depth.total ? 100 * depth.done / depth.total : 2}%` })) : null) : null);
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
  loadSfxLibrary(ac);
  return audio = { ac, dest, sfx };
}
document.addEventListener('pointerdown', () => { ensureAudio().ac.resume(); }, { once: true });
function sfxTimeline(c) {
  const ev = [];
  if (c.hook) ev.push({ t: c.titleStart, kind: DEFAULT_SFX.title });
  for (const m of c.motions) for (const e of sfxEvents(m)) ev.push({ t: m.start + e.t, kind: e.kind });
  for (const m of c.media || []) ev.push({ t: m.start, kind: m.layout === 'full' ? 'whoosh' : DEFAULT_SFX.media });
  // Le son d'une transition part juste avant la coupe (après, la lecture a déjà sauté).
  for (const tr of c.transitions || []) if (TRANS_SFX[tr.kind]) ev.push({ t: tr.a - .12, kind: TRANS_SFX[tr.kind] });
  return ev.sort((a, b) => a.t - b.t);
}
let lastT = 0;
function tickSfx(c, t) {
  if (!S.sfx.on || !audio || audio.ac.state !== 'running') { lastT = t; return; }
  if (t < lastT || t - lastT > .5) { lastT = t; return; }
  for (const e of sfxTimeline(c)) if (e.kind && e.t > lastT && e.t <= t) playSfx(audio.ac, audio.sfx, e.kind, S.sfx.vol, e.t);
  lastT = t;
}

// ---------- Boucle d'aperçu ----------
let live = [];
const mainCtx = $('main').getContext('2d');
function frame(now) {
  try { drawFrame(now); } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}
function drawFrame(now) {
  const clock = now / 1000, mc = $('main');
  if (!S.exporting) updateDepth(video, S.depthOn);
  if (!video.paused && !S.exporting) {
    const seg = S.cutSegs.find(([a, b]) => video.currentTime >= a && video.currentTime < b - .02);
    if (seg) video.currentTime = seg[1] >= video.duration - .05 ? 0 : seg[1];
  }
  // Un effet qui a besoin de ta silhouette est posé : on lance le détourage une fois (tu peux le décocher ensuite).
  if (!S.autoDepth && !S.depthOn && S.file && S.items.some(it => NEEDS_MATTE.has(it.type))) { S.autoDepth = true; S.depthOn = true; startDepth(); draw(); }
  const t = video.currentTime || 0;
  // Pendant le choix du look, l'accroche reste affichée pour voir l'effet de chaque clic.
  const pinHook = S.tab === 'look' && S.lookStep <= 3;
  const c = cfg(pinHook ? { titleStart: t - S.titleDur * .5 } : {});
  render(mainCtx, mc.width, mc.height, t, c);
  if (!video.paused && !S.exporting) tickSfx(c, t);
  for (const l of live) { try { l.draw(clock); } catch (e) { console.error(e); } }
  $('time').textContent = `${fmt(t)} / ${fmt(video.duration)}`;
  drawTimeline();
  if (S.tab === 'edit') highlightNow(t);
}

// Timeline : volume, coupes (rouge), éléments (couleur), médias (bleu), tête de lecture.
let wave = null;
function buildWave() {
  const c = $('timeline'), W = c.width, H = c.height, db = S.A.db;
  wave = document.createElement('canvas'); wave.width = W; wave.height = H;
  if (!db || !db.length) return;
  const g = wave.getContext('2d');
  const lo = Math.min(...db.filter(isFinite)), hi = Math.max(...db);
  g.fillStyle = '#4a4a4a';
  for (let x = 0; x < W; x++) {
    const i0 = Math.floor(x / W * db.length), i1 = Math.max(i0 + 1, Math.floor((x + 1) / W * db.length));
    let m = -Infinity; for (let i = i0; i < i1; i++) m = Math.max(m, db[i]);
    const h = clamp((m - lo) / (hi - lo + 1e-6)) * H * .8;
    g.fillRect(x, (H - h) / 2, 1, Math.max(1, h));
  }
}
function drawTimeline() {
  const c = $('timeline'), g = c.getContext('2d'), W = c.width, H = c.height, d = video.duration || S.A.duration;
  g.clearRect(0, 0, W, H);
  if (!d) return;
  if (wave) g.drawImage(wave, 0, 0);
  g.fillStyle = 'rgba(255,90,79,.35)';
  for (const [a, b] of S.cutSegs) g.fillRect(a / d * W, 0, (b - a) / d * W, H);
  g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(0, 2, S.titleDur / d * W, 6);
  S.items.forEach((m, i) => { g.fillStyle = CHIP_COLORS[m.type] || '#ffd60a'; g.fillRect(m.start / d * W, 12 + (i % 3) * 9, Math.max(2, m.dur / d * W), 6); });
  g.fillStyle = 'rgba(90,170,255,.95)';
  mediaCfg().forEach(m => g.fillRect(m.start / d * W, H - 10, Math.max(2, m.dur / d * W), 6));
  g.fillStyle = '#fff'; g.fillRect(video.currentTime / d * W - 1, 0, 2, H);
}
$('timeline').addEventListener('click', e => {
  const r = e.currentTarget.getBoundingClientRect();
  if (video.duration) video.currentTime = (e.clientX - r.left) / r.width * video.duration;
});

// Une vignette animée en boucle. f(clock) → { t, o } pour cette image.
function liveCanvas(f) {
  const c = el('canvas', { width: 270, height: 480 });
  const ctx = c.getContext('2d');
  live.push({ draw: clock => { const { t, o } = f(clock); render(ctx, 270, 480, t, { ...o, noSync: true }); } });
  return c;
}

// ---------- Onglets ----------
function draw() {
  live = [];
  const ready = S.A.status === 'done';
  $('tabs').replaceChildren(...[['look', 'Look'], ['edit', 'Édition'], ['review', 'Revue']].map(([id, n]) =>
    el('button', { class: S.tab === id ? 'on' : '', disabled: !ready || null, onclick: () => { S.tab = id; S.sel = null; draw(); } }, n)));
  const C = $('content'); C.replaceChildren();
  if (!ready) return importScreen(C);
  ({ look: lookTab, edit: editTab, review: reviewTab })[S.tab](C);
}

// ---------- Import ----------
function dropZone(title, hint, accept, multiple, onFiles, disabled = false) {
  const input = el('input', { type: 'file', accept, hidden: '', ...(multiple ? { multiple: '' } : {}), onchange: e => { onFiles([...e.target.files]); e.target.value = ''; } });
  const d = el('div', { class: 'drop', onclick: () => !disabled && input.click() }, el('strong', {}, title), hint, input);
  d.addEventListener('dragover', e => { e.preventDefault(); d.classList.add('over'); });
  d.addEventListener('dragleave', () => d.classList.remove('over'));
  d.addEventListener('drop', e => { e.preventDefault(); d.classList.remove('over'); if (!disabled && e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]); });
  return d;
}
function importScreen(C) {
  const busy = S.A.status === 'running';
  C.append(el('p', { class: 'lead' }, el('b', {}, 'Importe ta vidéo. '), 'Je la transcris, je repère ce que tu dis et je fais un premier montage. Ensuite tu choisis ton look et tu corriges tout.'));
  C.append(dropZone(S.fileName || 'Dépose ta vidéo ici', 'ou clique pour choisir un fichier (.mp4, .mov, .webm)', 'video/*', false, f => loadFile(f[0]), busy));
  C.append(el('div', { class: 'options' },
    el('label', {}, el('input', { type: 'checkbox', checked: S.opts.transcribe, disabled: busy || null, onchange: e => { S.opts.transcribe = e.target.checked; } }), 'Transcrire la voix'),
    el('label', {}, 'Langue', select(LANGS, S.opts.lang, v => { S.opts.lang = v; }, { disabled: busy || null }))));
  C.append(el('p', { class: 'muted' }, 'La première transcription télécharge le modèle Whisper (~200 Mo, une seule fois). Tout tourne sur ton appareil : ta vidéo n\'est envoyée nulle part.'));
  if (store('ves-asr-running') === '1' && S.A.status === 'idle') C.append(el('p', { class: 'err' },
    'La dernière transcription a fait planter la page (mémoire du téléphone). La prochaine utilisera un modèle plus léger, un peu moins précis : pense à corriger les mots dans l\'Édition.'));
  if (S.A.status !== 'idle') C.append(el('div', { class: 'panel' },
    el('div', { id: 'amsg', class: S.A.status === 'error' ? 'err' : '' }, S.A.msg),
    el('div', { class: 'progress' }, el('div', { id: 'abar', style: `width:${S.A.frac * 100}%` })),
    busy && S.A.transcribing ? el('button', { class: 'btn', onclick: () => cancelTranscription() }, 'Passer la transcription') : null));
}
function setProgress(msg, frac) {
  S.A.msg = msg; if (frac != null) S.A.frac = frac;
  const m = $('amsg'), b = $('abar');
  if (m) m.textContent = msg;
  if (b && frac != null) b.style.width = frac * 100 + '%';
}
function asrProgress(p) {
  if (p.phase === 'download') setProgress(`Téléchargement du modèle Whisper… ${(p.loaded / 1e6).toFixed(0)} / ${(p.total / 1e6).toFixed(0)} Mo`, .1 + .3 * p.loaded / p.total);
  else setProgress(`Transcription… ${fmt(p.done)} / ${fmt(p.total)}`, .4 + .6 * p.done / p.total);
}

async function loadFile(file) {
  if (!file) return;
  cancelTranscription(); resetMatting();
  Object.assign(S, { file, fileName: file.name, items: [], sel: null, tab: 'look', lookStep: 0 });
  $('filename').textContent = file.name;
  video.src = URL.createObjectURL(file); video.load();
  await new Promise(r => video.addEventListener('loadedmetadata', r, { once: true }));
  const A = S.A = { status: 'running', msg: 'Lecture de l\'audio…', frac: .02, duration: video.duration, pcm: null, db: null, peaks: [], words: [], asrError: '' };
  wave = null; draw();
  try {
    const au = await decodeAudio(file);
    A.pcm = au.pcm; A.audioError = au.error || ''; A.audioHow = au.how || '';
    if (A.pcm) { A.db = loudness(A.pcm); A.peaks = findPeaks(A.db); recomputeSilences(); buildWave(); }
    setProgress(A.pcm ? 'Audio analysé.' : 'Son illisible : ' + A.audioError, .1);
    if (A.pcm && S.opts.transcribe) {
      A.transcribing = true; draw();
      // Si la page a planté pendant la dernière transcription (mémoire du téléphone), on passe en mode léger.
      // Le choix est retenu sur cet appareil.
      if (store('ves-asr-running') === '1') store('ves-asr-light', '1');
      const light = store('ves-asr-light') === '1';
      store('ves-asr-running', '1');
      try {
        A.words = await transcribe(A.pcm, A.db, { lang: S.opts.lang, onProgress: asrProgress, light, gpu: !isPhone });
        store('ves-asr-running', null);
      } catch (e) { store('ves-asr-running', null); if (e.message !== 'cancelled') A.asrError = e.message; }
      A.transcribing = false;
    }
    // Les mots éditables, avec les corrections déjà retenues dans le dictionnaire.
    S.words = A.words.map(w => { const fix = S.dict[keyW(w.w)]; return { ...w, w: fix ? withCore(w.w, fix) : w.w, orig: w.w, fixed: !!fix }; });
    setProgress('Montage automatique…', .98);
    applyCleanup();
    replan(true);
    setProgress('Préparation des aperçus…', .99);
    await captureStills();
    A.status = 'done';
    video.currentTime = 0;
    draw();
  } catch (e) {
    A.status = 'error'; setProgress('Erreur d\'analyse : ' + e.message, 0); draw();
  }
}

// Montage automatique avec la boîte à outils du look (garde ce que tu as fait à la main ou importé).
function replan(first = false) {
  refreshDerived();
  const kept = S.items.filter(it => it.from !== 'auto');
  const blocked = [...mediaCfg(), ...kept];
  const r = autoPlan({ ...S.A, words: S.words }, S.look, blocked, S.uid);
  S.uid += r.items.length + 1;
  S.items = [...kept, ...r.items].sort((a, b) => a.start - b.start);
  S.moments = r.moments; S.topic = r.topic; S.sentences = r.sentences;
  if (first) S.hook = hookFrom(r.sentences);
}

// Images fixes de la vidéo : fond des vignettes du look et photos de l'Orbit / Carousel.
// Sur iPhone, une vidéo hors écran ne se charge pas toujours toute seule : chaque attente a donc un délai
// maximum, et si ça ne vient pas, les vignettes utilisent simplement l'image en cours (rien ne bloque).
const within = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('délai dépassé')), ms))]);
const once = (target, ok, bad) => new Promise((res, rej) => { target.addEventListener(ok, res, { once: true }); if (bad) target.addEventListener(bad, rej, { once: true }); });
async function captureStills() {
  const v = Object.assign(document.createElement('video'), { src: URL.createObjectURL(S.file), muted: true, playsInline: true, preload: 'auto' });
  v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
  const started = performance.now();
  try {
    v.load();
    await within(once(v, 'loadeddata', 'error'), 6000);
    const w = 270, h = Math.round(w * v.videoHeight / v.videoWidth), d = v.duration;
    const grab = async t => {
      v.currentTime = Math.min(d - .05, Math.max(0, t));
      await within(once(v, 'seeked'), 3000);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(v, 0, 0, w, h);
      return c;
    };
    // Échantillon : un sous-titre de 3 mots ou plus au premier tiers de la vidéo.
    const ch = S.chunks.find(c => c.s > d * .2 && c.words.length >= 3) || S.chunks[0];
    const t = ch ? ch.s : d * .3;
    S.sample = { t, end: ch ? ch.e : t + 2, frame: await grab(t + .2) };
    const imgs = S.media.filter(m => m.kind === 'image' && m.ready).map(m => m.el);
    S.photos = imgs.length >= 3 ? imgs : [];
    for (const k of [.15, .3, .45, .6, .75, .9]) {
      if (S.photos.length >= 6 || performance.now() - started > 15000) break;
      S.photos.push(await grab(d * k));
    }
  } catch (e) { console.warn('Images fixes indisponibles :', e.message); }
  if (!S.sample) S.sample = { t: S.A.duration * .3, end: S.A.duration * .3 + 2, frame: null };
  v.removeAttribute('src'); v.load();
}

// Quand il n'y a pas de transcription, on dit pourquoi (au lieu de sous-titres qui manquent sans explication).
function transcriptProblem() {
  if (S.words.length) return null;
  const A = S.A;
  const why = !A.pcm ? `Le son de ta vidéo n'a pas pu être lu (${A.audioError || 'raison inconnue'}).`
    : A.asrError ? `La transcription a échoué : ${A.asrError}.`
    : !S.opts.transcribe ? 'La transcription était décochée à l\'import.'
    : 'Aucune parole n\'a été reconnue (langue choisie : ' + (LANGS.find(l => l[0] === S.opts.lang)?.[1] || 'auto') + ').';
  return el('div', { class: 'panel', style: 'border:1px solid var(--red)' },
    el('h2', { class: 'err' }, 'Pas de transcription, donc pas de sous-titres'),
    el('p', { class: 'muted', style: 'margin:0 0 8px' }, why),
    el('div', { class: 'options' }, 'Langue', select(LANGS, S.opts.lang, v => { S.opts.lang = v; }),
      el('button', { class: 'btn yellow', onclick: () => { S.opts.transcribe = true; loadFile(S.file); } }, '↻ Réessayer')),
    el('p', { class: 'muted', style: 'margin:0' }, 'Si ça échoue encore, envoie-moi une capture de ce message.'));
}

// ---------- Onglet Look ----------
function lookTab(C) {
  const pb = transcriptProblem(); if (pb) C.append(pb);
  C.append(el('div', { class: 'steps' }, ...LOOK_STEPS.map((n, i) => el('button', { class: S.lookStep === i ? 'on' : '', onclick: () => { S.lookStep = i; S.visited.add(i); draw(); } },
    `${i + 1} ${n}`, S.visited.has(i) && i !== S.lookStep ? el('span', { class: 'ok' }, '✓') : null))));
  [lookColors, lookFonts, lookHook, lookCaptions, lookElements, lookMotion, lookTrans, lookReview][S.lookStep](C);
  if (S.lookStep < LOOK_STEPS.length - 1) C.append(el('div', { class: 'row-btns', style: 'margin-top:14px' },
    el('button', { class: 'btn primary', onclick: () => { S.lookStep++; S.visited.add(S.lookStep); draw(); } }, `Suivant : ${LOOK_STEPS[S.lookStep + 1]} →`)));
}

// Vignette « look » : l'échantillon de ta vidéo avec l'accroche et les sous-titres, dans une variante du look.
function sampleCard(over) {
  return liveCanvas(clock => {
    const sm = S.sample || { t: 0, end: 2, frame: null };
    const t = sm.t + clock % Math.max(1.5, Math.min(3.5, sm.end - sm.t + .6));
    const look = { ...S.look, ...over };
    return { t, o: cfg({ look, motions: [], media: [], depth: null, frame: sm.frame, titleStart: t - S.titleDur * .5,
      captions: S.chunks.length ? { style: look.captions, pos: S.captions.pos, chunks: S.chunks } : null }) };
  });
}

function choiceGrid(items, isSel, onPick, over, extra) {
  const g = el('div', { class: 'grid' });
  items.forEach((it, i) => g.append(el('div', { class: 'card' + (isSel(it) ? ' sel' : ''), onclick: () => { onPick(it); draw(); } },
    el('span', { class: 'num' }, String(i + 1)), sampleCard(over(it)), el('h3', {}, it.name), el('p', {}, it.desc || ''), extra ? extra(it) : null,
    el('button', { class: 'take' }, isSel(it) ? 'Pris ✓' : 'Prendre'))));
  return g;
}

function applyPreset(p) {
  S.look = { ...S.look, ...p, preset: p.id, fx: { ...p.fx } };
  if (p.depth && !S.depthOn) { S.depthOn = true; startDepth(); }
}

function lookColors(C) {
  C.append(el('p', { class: 'lead' }, el('b', {}, 'Choisis tes couleurs. '), 'Chaque étape suivante les utilise.'));
  C.append(el('div', { class: 'chips-row' }, el('span', { class: 'muted' }, 'Départ rapide :'),
    ...PRESETS.map(p => el('button', { class: 'chip-btn' + (S.look.preset === p.id ? ' on' : ''), title: p.desc, onclick: () => { applyPreset(p); draw(); } }, p.name))));
  C.append(el('p', { class: 'muted', style: 'margin-top:-6px' }, 'Un départ rapide remplit toutes les étapes avec un look prêt. Tu peux encore tout changer.'));
  C.append(choiceGrid(PALETTES, p => p.id === S.look.pal, p => { S.look = { ...S.look, pal: p.id, preset: '' }; }, p => ({ pal: p.id }),
    p => el('div', { class: 'swatches' }, ...[p.accent, p.accent2, p.card, p.paper].map(c => el('i', { style: `background:${c}` })))));
}
function lookFonts(C) {
  C.append(el('p', { class: 'lead' }, el('b', {}, 'Choisis tes polices. '), 'Elles servent à l\'accroche, aux sous-titres, aux cartes et aux animations. Celles avec « manuscrit » ajoutent une écriture à la main sur les mots d\'accent.'));
  C.append(choiceGrid(FONT_PAIRS, f => f.id === S.look.fonts, f => { S.look = { ...S.look, fonts: f.id, preset: '' }; }, f => ({ fonts: f.id })));
}
function lookHook(C) {
  C.append(el('p', { class: 'lead' }, el('b', {}, 'Ton accroche. '), 'Les mots affichés au début de la vidéo.'));
  C.append(el('div', { class: 'options' },
    el('label', {}, 'Ligne 1', el('input', { type: 'text', value: S.hook.l1, oninput: e => { S.hook.l1 = e.target.value; } })),
    el('label', {}, 'Ligne 2', el('input', { type: 'text', value: S.hook.l2, oninput: e => { S.hook.l2 = e.target.value; } })),
    el('label', {}, 'Durée', el('input', { type: 'number', min: '1', max: '10', step: '0.5', value: S.titleDur, oninput: e => { S.titleDur = clamp(+e.target.value || 3, 1, 10); } }), 's')));
  C.append(choiceGrid(HOOK_STYLES, h => h.id === S.look.hook, h => { S.look = { ...S.look, hook: h.id, preset: '' }; if (h.id === 'depth' && !S.depthOn) { S.depthOn = true; startDepth(); } }, h => ({ hook: h.id })));
  C.append(depthPanel());
}
function lookCaptions(C) {
  C.append(el('p', { class: 'lead' }, el('b', {}, 'Tes sous-titres. '), S.chunks.length ? 'Générés depuis ta voix, mot à mot. Le texte se corrige dans l\'onglet Édition.' : 'Pas de transcription : pas de sous-titres.'));
  C.append(el('div', { class: 'options' },
    el('label', {}, el('input', { type: 'checkbox', checked: S.captions.on, onchange: e => { S.captions.on = e.target.checked; } }), 'Afficher les sous-titres'),
    el('label', {}, 'Position', el('input', { type: 'range', min: '0.35', max: '0.88', step: '0.01', value: S.captions.pos, oninput: e => { S.captions.pos = +e.target.value; } }))));
  C.append(choiceGrid(CAPTION_STYLES, c => c.id === S.look.captions, c => { S.look = { ...S.look, captions: c.id, preset: '' }; }, c => ({ captions: c.id })));
}

// Exemple d'un élément avec un vrai moment de ta vidéo quand il y en a un qui lui correspond.
const SAMPLE_F = {
  note: { text: 'à retenir' }, colorcard: { top: 'l\'idée clé' }, stamp: { text: 'important' }, statcard: { label: 'le chiffre', value: '100', unit: 'au total' },
  checklist: { title: 'Les étapes', items: ['Première idée', 'Deuxième idée', 'Troisième idée'] }, versus: { bad: 'Ce qu\'on croit', good: 'Ce qui marche' },
  emoji: { emoji: '💡', word: 'idée' }, screen: { title: 'Mon appli', lines: ['Étape 1', 'Étape 2', 'Étape 3'] }, lower: { name: 'Ton nom', role: 'créateur' },
  shrink: { top: 'l\'idée', bottom: 'en une phrase' }, comment: { name: 'un abonné', text: 'Tu peux faire une partie 2 ?' },
  wordreveal: { text: 'une phrase forte à retenir', mark: 'retenir' }, counter: { value: '1000', label: 'vues' }, kinetic: { text: 'Ta phrase forte ici.' }, beat: { words: 'UN DEUX TROIS' },
  couchwall: { text: 'vendre une formation', mark: 'formation' }, uiworld: { app: 'Studio', tag: 'RUSHS', command: '/montage' }, framebreak: { handle: '@toncompte' },
  phonemockup: { title: 'Assistant', msg: 'Coupe les blancs et ajoute les sous-titres', reply: 'C\'est fait. Je lance le rendu ?' },
  headlinewall: { items: ['Ta phrase forte en gros titre', 'On en parle partout', 'Le secret enfin révélé'] }, chartgrow: { label: 'ÇA MONTE ↗', axis: ['L', 'M', 'M', 'J', 'V', 'S', 'D'] },
  pullback: { file: 'mon-reel.mp4', steps: ['Transcription', 'Meilleure prise', 'Coupes', 'Sous-titres', 'Rendu'] },
  greenscreen: { task: 'Écrire la page de vente', items: ['Tourner la vidéo', 'Monter le reel', 'Publier'], text: 'il te faut du montage', mark: 'montage' },
  papercut: { text: '100%' }, doodleboil: {}, vertigo: { text: 'NUL EN DESIGN', mark: 'design' }, coverstory: { title: 'EDIT', lines: ['Le guide', 'Monter un reel en 10 min'] }, glasstype: { text: 'DESIGN' },
  morph: { pill: 'Ma méthode', title: 'En 3 étapes', items: ['Première idée', 'Deuxième idée', 'Troisième idée'] }, chapter: { num: '01', title: 'La suite', sub: '' },
};
const KIND_FOR = { statcard: 'number', counter: 'number', checklist: 'list', morph: 'list', versus: 'contrast', emoji: 'emoji', comment: 'question' };
function sampleItem(type) {
  const need = KIND_FOR[type];
  const m = S.moments.find(x => need ? x.kind === need : ['keyword', 'punch'].includes(x.kind));
  if (m) return { ...itemFromMoment(m, type, S.words, 0), key: 'sample-' + type, start: 0 };
  return { key: 'sample-' + type, type, start: 0, dur: CATALOG[type].dur, f: SAMPLE_F[type] || {}, variant: 0 };
}
function toolboxGrid(C, list, key) {
  const g = el('div', { class: 'grid' });
  list.forEach((d, i) => {
    const on = (S.look[key] || []).includes(d.id);
    const it = sampleItem(d.id);
    g.append(el('div', { class: 'card' + (on ? ' sel' : ' off'), onclick: () => {
      const set = new Set(S.look[key] || []); on ? set.delete(d.id) : set.add(d.id);
      S.look = { ...S.look, [key]: [...set], preset: '' }; draw();
    } },
      el('span', { class: 'num' }, String(i + 1)),
      liveCanvas(clock => {
        const sm = S.sample || { t: 0, frame: null }, lt = clock % (it.dur + .8);
        return { t: sm.t + lt, o: cfg({ hook: null, captions: null, media: [], depth: null, frame: sm.frame, motions: [{ ...it, start: sm.t + .2 }] }) };
      }),
      el('h3', {}, d.name), el('p', {}, d.desc), el('button', { class: 'take' }, on ? 'Pris ✓' : 'Prendre')));
  });
  C.append(g);
}
function lookElements(C) {
  C.append(el('p', { class: 'lead' }, el('b', {}, 'Coche les éléments que tu veux dans tes montages. '), 'Montrés dans tes couleurs et tes polices, avec ce que tu dis quand c\'est possible.'));
  toolboxGrid(C, ELEMENTS, 'elements');
}
function lookMotion(C) {
  C.append(el('p', { class: 'lead' }, el('b', {}, 'Coche les mouvements que tu veux. '), 'Dessinés en direct sur ta vidéo.'));
  const fx = S.look.fx || {};
  C.append(el('div', { class: 'options' },
    el('label', {}, el('input', { type: 'checkbox', checked: fx.pop, onchange: e => { S.look = { ...S.look, fx: { ...fx, pop: e.target.checked } }; } }), 'Le mot clé grossit quand tu le dis'),
    el('label', {}, el('input', { type: 'checkbox', checked: fx.slide, onchange: e => { S.look = { ...S.look, fx: { ...fx, slide: e.target.checked } }; } }), 'Entrées glissées avec flou'),
    el('label', {}, el('input', { type: 'checkbox', checked: fx.glow, onchange: e => { S.look = { ...S.look, fx: { ...fx, glow: e.target.checked } }; } }), 'Lueur néon')));
  toolboxGrid(C, MOTIONS, 'motion');
  C.append(el('h2', { style: 'font-size:15px;margin:22px 0 4px' }, 'Les effets de la vidéo « 17 video effects Claude can create »'),
    el('p', { class: 'muted', style: 'margin:0 0 12px' }, 'Ceux marqués « détourage » utilisent ta silhouette : l\'app la calcule dès que tu en poses un (sinon une version de secours s\'affiche).'));
  toolboxGrid(C, REEL_EFFECTS, 'motion');
}
// Aperçu d'une transition : deux images de ta vidéo, coupe au milieu de la boucle.
function transCard(kindOf) {
  return liveCanvas(clock => {
    const loop = 1.8, n = Math.floor(clock / loop), lt = clock % loop, at = .8;
    const kind = kindOf(n);
    const ph = S.photos.length >= 2 ? S.photos : [S.sample?.frame, S.sample?.frame];
    const before = lt < at, t = before ? lt : lt + 10;
    const trans = [{ key: 'x', a: at, b: at + 10, kind, level: kind === 'cut' ? 1 : 1.12 }];
    return { t, o: cfg({ hook: null, captions: null, media: [], motions: [], depth: null, transitions: trans,
      frame: ph[(before ? 2 * n : 2 * n + 1) % ph.length] || null }) };
  });
}
function lookTrans(C) {
  const cur = transitions();
  const big = cur.filter(tr => TRANSITIONS.find(x => x.id === tr.kind)?.big).length;
  C.append(el('p', { class: 'lead' }, el('b', {}, 'Tes transitions entre les plans. '),
    cur.length ? `${cur.length} changements de plan dans ta vidéo (coupes, débuts de phrase, et au moins toutes les 6 s) : ${big} grosse(s) transition(s) aux changements d'idée, des recadrages ailleurs. Chacune se change dans l'Édition (étiquette ⇄).`
      : 'Ta vidéo est trop courte pour changer de plan.'));
  const MIX = ['whip', 'blur', 'flash', 'spin'];
  const g = el('div', { class: 'grid' });
  TRANS_STYLES.forEach((st, i) => {
    const on = (S.look.trans || 'auto') === st.id;
    g.append(el('div', { class: 'card' + (on ? ' sel' : ''), onclick: () => { S.look = { ...S.look, trans: st.id, preset: '' }; draw(); } },
      el('span', { class: 'num' }, String(i + 1)),
      transCard(n => st.id === 'auto' ? MIX[n % MIX.length] : st.id === 'zoomcut' ? 'zoomcut' : st.id),
      el('h3', {}, st.name), el('p', {}, st.desc), el('button', { class: 'take' }, on ? 'Pris ✓' : 'Prendre')));
  });
  C.append(g);
}

function lookReview(C) {
  const L = lookContext(S.look);
  C.append(el('p', { class: 'lead' }, el('b', {}, 'Ton look est prêt. '), 'Le montage automatique peut être refait avec ces éléments ; ce que tu as ajouté à la main est gardé.'));
  C.append(el('div', { class: 'panel' },
    el('p', {}, `Couleurs : ${L.P.name} · Polices : ${L.pair.name} · Accroche : ${HOOK_STYLES.find(h => h.id === S.look.hook)?.name} · Sous-titres : ${CAPTION_STYLES.find(c => c.id === S.look.captions)?.name}`),
    el('p', { class: 'muted' }, 'Éléments : ' + ((S.look.elements || []).map(id => CATALOG[id].name).join(', ') || 'aucun')),
    el('p', { class: 'muted' }, 'Motion : ' + ((S.look.motion || []).map(id => CATALOG[id].name).join(', ') || 'aucun')),
    el('p', { class: 'muted' }, 'Transitions : ' + (TRANS_STYLES.find(x => x.id === (S.look.trans || 'auto'))?.name || '')),
    el('div', { class: 'row-btns' },
      el('button', { class: 'btn', onclick: () => { replan(); draw(); } }, '↻ Refaire le montage auto avec ce look'),
      el('button', { class: 'btn yellow', onclick: () => { S.tab = 'edit'; draw(); } }, 'Corriger le texte et les animations →'))));
}

// ---------- Onglet Édition ----------
const itemByUid = uid => S.items.find(i => i.uid === uid);
function sentencesOf(words) {
  const out = []; let cur = null;
  words.forEach((w, i) => {
    if (!cur || (i > 0 && w.s - words[i - 1].e > 1.2)) { cur = { i0: i, words: [] }; out.push(cur); }
    cur.words.push(i);
    if (/[.?!]$/.test(w.w)) cur = null;
  });
  return out;
}
// Mot d'ancrage d'un élément (le premier mot dit pendant l'élément).
const anchorOf = it => it.w0 != null ? it.w0 : wordIndexAt(S.words, it.start + .2);

function editTab(C) {
  C.append(el('div', { class: 'row-btns', style: 'margin-bottom:12px' },
    el('button', { class: 'btn', onclick: copyForClaude }, '📋 Copier pour Claude'),
    el('button', { class: 'btn', onclick: importPlanModal }, '📥 Importer un plan'),
    el('button', { class: 'btn', onclick: () => { replan(); draw(); } }, '↻ Montage auto'),
    el('button', { class: 'btn', onclick: cleanupModal }, '✂ Nettoyage'),
    el('button', { class: 'btn', onclick: dictModal }, `📖 Dictionnaire (${Object.keys(S.dict).length})`),
    el('span', { class: 'muted', style: 'margin-left:auto' }, `${S.items.length} animation(s) · ${S.words.filter(w => w.cut).length} mot(s) coupé(s)`)));
  C.append(el('div', { class: 'options' },
    el('label', {}, 'Accroche', el('input', { type: 'text', value: S.hook.l1, oninput: e => { S.hook.l1 = e.target.value; } })),
    el('input', { type: 'text', value: S.hook.l2, oninput: e => { S.hook.l2 = e.target.value; } })));
  C.append(inspector());
  if (!S.words.length) C.append(transcriptProblem(), el('div', { class: 'panel' }, el('p', { class: 'muted' }, 'Sans transcription, ajoute des animations à la tête de lecture.'), addHere()));
  else C.append(doc());
  C.append(mediaSection());
}

function addHere() {
  const types = [...(S.look.elements || []), ...(S.look.motion || [])];
  const rest = Object.keys(CATALOG).filter(k => !types.includes(k));
  return el('div', { class: 'options' }, 'Ajouter à la tête de lecture :',
    select([['', '+ Animation…'], ...types.map(k => [k, CATALOG[k].name]), ...rest.map(k => [k, CATALOG[k].name + ' (hors look)'])], '', v => {
      if (!v) return;
      const it = newItem(v, wordIndexAt(S.words, video.currentTime), null, video.currentTime);
      S.items.push(it); S.sel = { kind: 'item', uid: it.uid }; draw();
    }));
}

// Champ principal de chaque type (celui que remplissent les mots sélectionnés).
const MAIN_FIELD = { couchwall: 'text', vertigo: 'text', glasstype: 'text', coverstory: 'title', papercut: 'text', greenscreen: 'text', morph: 'title', chapter: 'title', note: 'text', colorcard: 'top', stamp: 'text', comment: 'text', wordreveal: 'text', kinetic: 'text', beat: 'words', counter: 'value', shrink: 'top', lower: 'name', screen: 'title', statcard: 'value' };

// Nouvel élément posé sur des mots (texte prérempli avec les mots sélectionnés).
function newItem(type, a, b, at) {
  const def = CATALOG[type];
  const text = b != null ? S.words.slice(a, b + 1).map(w => w.w).join(' ').replace(/[,;:]$/, '') : '';
  const f = JSON.parse(JSON.stringify(SAMPLE_F[type] || {}));
  const set = MAIN_FIELD[type];
  if (set && text) f[set] = type === 'beat' ? text.toUpperCase() : text;
  if ((type === 'checklist' || type === 'morph') && text) f.items = text.split(/,|\set\s/).map(s => s.trim()).filter(Boolean);
  if (type === 'morph' && text) f.pill = text.split(/\s+/).slice(0, 3).join(' ');
  if (type === 'statcard' && text) { const n = text.match(/\d+(?:[.,]\d+)?/); f.value = n ? n[0] : text; f.label = ''; f.unit = ''; }
  if (type === 'wordreveal' && text) f.mark = '';
  const start = at != null ? at : (S.words[a]?.s ?? 0) - .15;
  const end = b != null ? (S.words[b]?.e ?? start) + .5 : start + def.dur;
  return { uid: S.uid++, type, start: +Math.max(0, start).toFixed(2), dur: +Math.max(def.dur, end - start).toFixed(2), f, variant: 0, w0: a, from: 'manual' };
}

function doc() {
  const d = el('div', { class: 'doc', id: 'doc' });
  const chipsAt = {};
  for (const it of S.items) (chipsAt[anchorOf(it)] ||= []).push(it);
  const selItem = S.sel?.kind === 'item' ? itemByUid(S.sel.uid) : null;
  // Une étiquette ⇄ devant le premier mot gardé de chaque nouveau plan.
  const transAt = {};
  for (const tr of transitions()) {
    const i = S.words.findIndex(w => !w.cut && w.s >= tr.b - .12);
    if (i >= 0) transAt[i] = tr;
  }
  for (const sent of sentencesOf(S.words)) {
    const p = el('p', {}, el('span', { class: 'ts', onclick: () => { video.currentTime = S.words[sent.i0].s; } }, fmt(S.words[sent.i0].s)));
    for (const i of sent.words) {
      const w = S.words[i];
      if (i > 0 && w.s - S.words[i - 1].e > .7) {
        const a = S.words[i - 1].e, b = w.s, cut = S.cutSegs.some(([x, y]) => x <= a + .15 && y >= b - .15);
        p.append(el('span', { class: 'pause' + (cut ? ' cut' : ''), title: cut ? 'Blanc coupé' : 'Blanc', onclick: () => { video.currentTime = a; } }, ` · ${(b - a).toFixed(1)} s · `));
      }
      if (transAt[i]) {
        const tr = transAt[i];
        p.append(el('span', { class: 'chip trans' + (S.sel?.kind === 'trans' && S.sel.key === tr.key ? ' on' : ''), title: 'Changer la transition',
          onmouseup: e => e.stopPropagation(),
          onclick: e => { e.stopPropagation(); S.sel = { kind: 'trans', key: tr.key }; video.currentTime = Math.max(0, tr.a - 1); draw(); } }, '⇄ ' + transName(tr.kind)));
      }
      for (const it of chipsAt[i] || []) {
        p.append(el('span', { class: 'chip' + (selItem === it ? ' on' : ''), style: `background:${CHIP_COLORS[it.type] || '#ffd60a'}`, title: 'Modifier cette animation',
          onmouseup: e => e.stopPropagation(),
          onclick: e => { e.stopPropagation(); S.sel = { kind: 'item', uid: it.uid }; video.currentTime = it.start; draw(); } }, '▶ ' + CATALOG[it.type].name));
      }
      const inSel = S.sel?.kind === 'words' && i >= S.sel.a && i <= S.sel.b;
      const inRange = selItem && w.s >= selItem.start - .05 && w.s <= selItem.start + selItem.dur;
      p.append(el('span', { class: 'wd' + (w.cut ? ' cut' : '') + (w.fixed ? ' fixed' : '') + (inSel ? ' sel' : '') + (inRange ? ' inrange' : ''), 'data-i': i,
        style: inRange ? `--chip:${CHIP_COLORS[selItem.type]}` : null, title: w.cutWhy ? `Coupé : ${w.cutWhy} (clique pour rétablir)` : w.fixed ? `Transcrit : « ${w.orig} »` : null }, w.w), ' ');
    }
    d.append(p);
  }
  // Sélection : un mot (clic) ou plusieurs (glisser). Double-clic : corriger le mot sur place.
  // Glisser à la souris : la sélection du navigateur donne la plage de mots.
  d.addEventListener('mouseup', () => {
    const s = window.getSelection();
    if (s.isCollapsed) return;
    const idx = n => { const e = n?.nodeType === 3 ? n.parentElement : n; const w = e?.closest?.('.wd'); return w ? +w.dataset.i : null; };
    let a = idx(s.anchorNode), b = idx(s.focusNode);
    if (a == null && b == null) return;
    if (a == null) a = b; if (b == null) b = a;
    if (a > b) [a, b] = [b, a];
    S.sel = { kind: 'words', a, b }; S.lastWord = a;
    video.currentTime = S.words[a].s;
    s.removeAllRanges();
    draw();
  });
  // Toucher / cliquer un mot : le sélectionne, ou termine la plage si « Étendre » est actif (tactile).
  d.addEventListener('click', e => {
    const w = e.target.closest('.wd');
    if (!w || !window.getSelection().isCollapsed) return;
    const i = +w.dataset.i;
    if (S.extend && S.sel?.kind === 'words') S.sel = { kind: 'words', a: Math.min(S.sel.a, i), b: Math.max(S.sel.b, i) };
    else { S.sel = { kind: 'words', a: i, b: i }; video.currentTime = S.words[i].s; }
    S.extend = false; S.lastWord = i;
    draw();
  });
  d.addEventListener('dblclick', e => { const w = e.target.closest('.wd'); if (w) editWordInline(+w.dataset.i); });
  return d;
}
let nowIdx = -1;
function highlightNow(t) {
  const i = S.words.findIndex(w => t >= w.s && t <= w.e + .05);
  if (i === nowIdx && document.querySelector('.wd.now')) return;
  document.querySelector('.wd.now')?.classList.remove('now');
  nowIdx = i;
  if (i >= 0) document.querySelector(`.wd[data-i="${i}"]`)?.classList.add('now');
}

function fixWord(i, text, everywhere) {
  const w = S.words[i], k = keyW(w.orig);
  const apply = x => { x.w = withCore(x.w, core(text)); x.fixed = keyW(x.orig) !== keyW(x.w); };
  if (everywhere) {
    S.words.forEach(x => { if (keyW(x.orig) === k) apply(x); });
    if (core(text) && k !== core(text).toLowerCase()) { S.dict[k] = core(text); saveDict(); }
  } else { w.w = text; w.fixed = keyW(w.orig) !== keyW(w.w); }
  refreshDerived();
}
function editWordInline(i) {
  const span = document.querySelector(`.wd[data-i="${i}"]`);
  if (!span) return;
  const input = el('input', { type: 'text', value: S.words[i].w, style: 'width:' + Math.max(70, span.offsetWidth + 30) + 'px' });
  span.replaceWith(input); input.focus(); input.select();
  let closed = false;
  const done = save => { if (closed) return; closed = true; if (save && input.value.trim()) fixWord(i, input.value.trim(), false); draw(); };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
  input.addEventListener('blur', () => done(true));
  input.addEventListener('mouseup', e => e.stopPropagation());
}

// Panneau d'édition : le mot ou les mots sélectionnés, ou l'animation sélectionnée.
function inspector() {
  const box = el('div', { class: 'inspector' });
  if (S.sel?.kind === 'item' && itemByUid(S.sel.uid)) { itemInspector(box, itemByUid(S.sel.uid)); return box; }
  const tr = S.sel?.kind === 'trans' && transitions().find(x => x.key === S.sel.key);
  if (tr) {
    box.append(el('h2', {}, el('span', { class: 'chip trans' }, '⇄ Transition'), el('span', { class: 'muted' }, tr.b - tr.a > .05 ? `coupe ${fmt1(tr.a)} → ${fmt1(tr.b)}` : `changement de plan à ${fmt1(tr.b)}`)));
    const g = el('div', { class: 'chips-row', style: 'margin:8px 0' });
    for (const x of TRANSITIONS) g.append(el('button', { class: 'chip-btn' + (tr.kind === x.id ? ' on' : ''), title: x.desc,
      onclick: () => { S.transOver = { ...S.transOver, [tr.key]: x.id }; draw(); playAround(tr); } }, x.name));
    box.append(g, el('div', { class: 'row-btns' },
      el('button', { class: 'btn small', onclick: () => playAround(tr) }, '▶ Voir'),
      S.transOver[tr.key] ? el('button', { class: 'btn small', onclick: () => { const o = { ...S.transOver }; delete o[tr.key]; S.transOver = o; draw(); } }, '↺ Revenir au choix du look') : null,
      el('button', { class: 'btn small', onclick: () => { S.sel = null; draw(); } }, 'Fermer')));
    return box;
  }
  if (S.sel?.kind === 'words' && S.words.length) {
    const { a, b } = S.sel, one = a === b, w = S.words[a];
    const allCut = S.words.slice(a, b + 1).every(x => x.cut);
    box.append(el('h2', {}, one ? `Mot « ${w.w} »` : `${b - a + 1} mots : « ${S.words.slice(a, b + 1).map(x => x.w).join(' ').slice(0, 70)} »`,
      el('span', { class: 'muted' }, fmt1(w.s))));
    if (one) {
      const input = el('input', { type: 'text', value: w.w, style: 'min-width:180px' });
      const every = el('input', { type: 'checkbox', checked: true });
      const go = () => { if (input.value.trim()) { fixWord(a, input.value.trim(), every.checked); draw(); } };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      const same = S.words.filter(x => keyW(x.orig) === keyW(w.orig)).length;
      box.append(el('div', { class: 'options' }, 'Corriger :', input,
        el('label', {}, every, same > 1 ? `partout (${same} fois) et retenir` : 'retenir pour les prochaines vidéos'),
        el('button', { class: 'btn small primary', onclick: go }, 'Corriger'),
        w.fixed ? el('span', { class: 'muted' }, `transcrit : « ${w.orig} »`) : null));
    }
    const why = [...new Set(S.words.slice(a, b + 1).map(x => x.cutWhy).filter(Boolean))];
    if (why.length) box.append(el('p', { class: 'muted', style: 'margin:4px 0' }, 'Coupé par le nettoyage : ' + why.join(', ') + '.'));
    const types = [...(S.look.elements || []), ...(S.look.motion || [])];
    const rest = Object.keys(CATALOG).filter(k => !types.includes(k));
    box.append(el('div', { class: 'row-btns' },
      el('button', { class: 'btn small' + (allCut ? '' : ' danger'), onclick: () => { S.words.slice(a, b + 1).forEach(x => { x.cut = !allCut; x.cutWhy = null; x.manual = true; }); refreshDerived(); draw(); } },
        allCut ? '↺ Rétablir' : '✂ Couper ' + (one ? 'ce mot' : 'ces mots')),
      select([['', '+ Ajouter une animation ici…'], ...types.map(k => [k, CATALOG[k].name]), ...rest.map(k => [k, CATALOG[k].name + ' (hors look)'])], '', v => {
        if (!v) return;
        const it = newItem(v, a, one ? null : b);
        S.items.push(it); S.items.sort((x, y) => x.start - y.start); S.sel = { kind: 'item', uid: it.uid }; draw();
      }),
      el('button', { class: 'btn small' + (S.extend ? ' primary' : ''), onclick: () => { S.extend = !S.extend; draw(); } },
        S.extend ? 'Touche le dernier mot…' : 'Étendre jusqu\'à un autre mot'),
      el('button', { class: 'btn small', onclick: () => { S.sel = null; S.extend = false; draw(); } }, 'Fermer')));
    return box;
  }
  box.classList.add('idle');
  box.append(el('h2', {}, 'Comment corriger'),
    el('p', { class: 'muted', style: 'margin:0' }, 'Touche ou clique un mot pour le corriger ou le couper. Pour plusieurs mots : glisse à la souris, ou touche le premier puis « Étendre jusqu\'à un autre mot » pour les couper ou poser une animation dessus. Double-clic pour corriger directement. Clique sur une étiquette ▶ pour modifier une animation, ou ⇄ pour changer une transition.'));
  return box;
}

function playAround(tr) { video.currentTime = Math.max(0, tr.a - 1.2); video.play().catch(() => {}); }

function itemInspector(box, it) {
  const def = CATALOG[it.type];
  const upd = () => { if (it.from === 'auto') it.from = 'edited'; };
  box.append(el('h2', {}, el('span', { class: 'chip', style: `background:${CHIP_COLORS[it.type]}` }, def.name),
    el('span', { class: 'muted' }, `${fmt1(it.start)} → ${fmt1(it.start + it.dur)}`)));
  const fields = el('div', { class: 'fields' });
  fields.append(el('label', {}, 'Type', select(Object.values(CATALOG).map(d => [d.id, d.name]), it.type, v => {
    const fresh = newItem(v, anchorOf(it), null, it.start); S.uid--;
    it.type = v; it.f = { ...fresh.f, ...pickText(it.f, v) }; it.dur = Math.max(it.dur, CATALOG[v].dur); upd(); draw();
  })));
  fields.append(el('label', {}, 'Variante', select([[0, 'A'], [1, 'B']], it.variant || 0, v => { it.variant = +v; upd(); })));
  for (const [k, label, kind] of def.fields) {
    const v = it.f?.[k];
    fields.append(el('label', { class: kind === 'list' || ['text', 'top', 'bad', 'good', 'words'].includes(k) ? 'wide' : '' }, label,
      kind === 'list'
        ? el('textarea', { rows: '3', value: Array.isArray(v) ? v.join('\n') : (v || ''), oninput: e => { it.f = { ...it.f, [k]: e.target.value.split('\n') }; upd(); } })
        : el('input', { type: 'text', value: v ?? '', oninput: e => { it.f = { ...it.f, [k]: e.target.value }; upd(); } })));
  }
  if (it.type === 'screen' && S.media.length) fields.append(el('label', { class: 'wide' }, 'Afficher un de tes médias',
    select([['', 'Non, du texte'], ...S.media.map(m => [m.id, m.name])], it.mediaId || '', v => { it.mediaId = v ? +v : null; upd(); })));
  fields.append(el('label', {}, 'Début (s)', el('input', { type: 'number', step: '0.1', min: '0', value: it.start, oninput: e => { const v = parseFloat(e.target.value); if (isFinite(v)) { it.start = Math.max(0, v); it.w0 = null; upd(); } } })));
  fields.append(el('label', {}, 'Durée (s)', el('input', { type: 'number', step: '0.1', min: '0.5', value: it.dur, oninput: e => { const v = parseFloat(e.target.value); if (isFinite(v)) { it.dur = Math.max(.5, v); upd(); } } })));
  fields.append(el('label', {}, 'Son', select(SFX, it.sfx ?? DEFAULT_SFX[it.type] ?? '', v => { it.sfx = v; })));
  box.append(fields);
  box.append(el('div', { class: 'row-btns' },
    el('button', { class: 'btn small', onclick: () => { video.currentTime = Math.max(0, it.start - .3); video.play().catch(() => {}); } }, '▶ Voir'),
    el('button', { class: 'btn small', onclick: () => { const w = S.words[S.lastWord]; if (w) { it.start = +Math.max(0, w.s - .15).toFixed(2); it.w0 = S.lastWord; upd(); draw(); } } }, '⇤ Caler sur le dernier mot cliqué'),
    el('button', { class: 'btn small', onclick: () => { it.start = +video.currentTime.toFixed(2); it.w0 = null; upd(); draw(); } }, '⇤ Caler sur la tête de lecture'),
    el('button', { class: 'btn small danger', onclick: () => { S.items = S.items.filter(x => x !== it); S.sel = null; draw(); } }, '🗑 Supprimer'),
    el('button', { class: 'btn small', onclick: () => { S.sel = null; draw(); } }, 'Fermer')));
}
// Garde le texte principal quand on change le type d'une animation.
function pickText(f, type) {
  const main = f.text || f.top || f.words || f.title || f.value || f.name || '';
  const set = MAIN_FIELD[type];
  return set && main ? { [set]: Array.isArray(main) ? main.join(' ') : main } : {};
}

// ---------- Médias (images, PNG, vidéos + commentaire) ----------
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
  const imgs = S.media.filter(m => m.kind === 'image' && m.ready).map(m => m.el);
  if (imgs.length >= 3) S.photos = imgs;
  draw();
}
function interpret(item) {
  item.auto = interpretMedia(item, S.words, S.A.duration || video.duration || 30, S.media.indexOf(item), S.media.length);
}
function mediaSection() {
  const box = el('div', { class: 'panel', style: 'margin-top:14px' }, el('h2', {}, 'Tes médias (images, PNG, vidéos)'),
    el('p', { class: 'muted' }, 'Écris à côté de chacun ce que tu veux en faire : « logo quand je dis Claude », « photo de mon pote en plein écran », « capture de l\'appli en haut pendant 4 s »…'),
    dropZone('Dépose tes images, PNG ou vidéos', 'Plusieurs fichiers à la fois.', 'image/*,video/*', true, addMedia));
  for (const m of S.media) {
    const c = mediaCfg().find(x => x.el === m.el) || {};
    const set = (k, v) => { m.override[k] = v; draw(); };
    box.append(el('div', { class: 'media-row', style: 'margin-top:12px' },
      m.kind === 'video' ? el('video', { src: m.url, muted: '', class: 'thumb' }) : el('img', { src: m.url, class: 'thumb' }),
      el('div', { style: 'flex:1;min-width:0' },
        el('b', {}, m.name),
        el('textarea', { rows: '2', placeholder: 'Dis-moi quoi en faire…', value: m.comment, onchange: e => { m.comment = e.target.value; m.override = {}; interpret(m); draw(); } }),
        el('div', { class: 'understood' }, '✓ Compris : ', m.auto.reason.join(', '), ` · ${fmt1(c.start)} → ${fmt1(c.start + c.dur)}`),
        el('div', { class: 'options' },
          select([['', `Auto (${MEDIA_LAYOUTS.find(l => l.id === c.layout)?.name})`], ...MEDIA_LAYOUTS.map(l => [l.id, l.name])], m.override.layout || '', v => set('layout', v || undefined)),
          ['sticker', 'pip'].includes(c.layout) ? select(POSITIONS, c.pos, v => set('pos', v)) : null,
          el('label', {}, 'Début', el('input', { type: 'number', step: '0.1', min: '0', value: (+c.start).toFixed(1), onchange: e => set('start', Math.max(0, +e.target.value || 0)) })),
          el('label', {}, 'Durée', el('input', { type: 'number', step: '0.1', min: '0.5', value: (+c.dur).toFixed(1), onchange: e => set('dur', Math.max(.5, +e.target.value || 1)) })),
          el('button', { class: 'btn small', onclick: () => { video.currentTime = Math.max(0, c.start - .4); video.play().catch(() => {}); } }, '▶'),
          el('button', { class: 'btn small danger', onclick: () => { S.media = S.media.filter(x => x !== m); draw(); } }, '✕')))));
  }
  return box;
}

// ---------- Aller-retour avec Claude ----------
function copyForClaude(e) {
  const txt = claudePrompt(S.words, { ...S.look, name: PRESETS.find(p => p.id === S.look.preset)?.name || 'perso' }, S.hook);
  const btn = e.currentTarget;
  navigator.clipboard.writeText(txt).then(() => { btn.textContent = 'Copié ✓ — colle-le à Claude'; },
    () => modal('Copie ce texte et colle-le à Claude', el('textarea', { rows: '16', value: txt })));
}
function modal(title, ...body) {
  const m = el('div', { class: 'modal', onclick: e => { if (e.target === m) m.remove(); } },
    el('div', {}, el('h2', { style: 'margin-top:0;font-size:16px' }, title), ...body,
      el('div', { class: 'row-btns', style: 'margin-top:12px' }, el('button', { class: 'btn', onclick: () => m.remove() }, 'Fermer'))));
  document.body.append(m);
  return m;
}
function importPlanModal() {
  const ta = el('textarea', { rows: '14', placeholder: 'Colle ici la réponse de Claude (le bloc JSON)…' });
  const msg = el('p', { class: 'muted' }, 'Les animations importées remplacent le montage automatique ; ce que tu as ajouté à la main est gardé.');
  const m = modal('Importer le plan de Claude', ta, msg, el('button', { class: 'btn yellow', onclick: () => {
    try {
      const r = planToItems(parsePlan(ta.value), S.words, S.uid);
      S.uid += r.items.length + 1;
      for (const c of r.corrections) if (S.words[c.i] && c.w) { S.words[c.i].w = c.w; S.words[c.i].fixed = keyW(S.words[c.i].orig) !== keyW(c.w); }
      for (const [a, b] of r.cuts) for (let i = a; i <= b && i < S.words.length; i++) if (S.words[i]) Object.assign(S.words[i], { cut: true, cutWhy: null, manual: true });
      if (r.hook?.l1) S.hook = { l1: r.hook.l1, l2: r.hook.l2 || '' };
      refreshDerived();
      // Transitions demandées : posées sur la coupe la plus proche du mot indiqué.
      for (const x of r.transitions) {
        const w = S.words[x.at | 0]; if (!w || !TRANSITIONS.some(k => k.id === x.type)) continue;
        const tr = transitions().reduce((best, c) => Math.abs(c.b - w.s) < Math.abs((best?.b ?? 1e9) - w.s) ? c : best, null);
        if (tr && Math.abs(tr.b - w.s) < 1.5) S.transOver = { ...S.transOver, [tr.key]: x.type };
      }
      S.items = [...S.items.filter(it => it.from === 'manual'), ...r.items].sort((x, y) => x.start - y.start);
      refreshDerived();
      m.remove(); S.tab = 'edit'; S.sel = null; draw();
    } catch (err) { msg.className = 'err'; msg.textContent = 'Plan illisible : ' + err.message; }
  } }, 'Importer'));
}
function cleanupModal() {
  let cur;
  const after = () => { draw(); const np = cleanupPanel(after); cur.replaceWith(np); cur = np; };
  cur = cleanupPanel(after);
  modal('Nettoyage et rythme', cur);
}
function dictModal() {
  const rows = Object.entries(S.dict);
  modal('Dictionnaire de corrections', el('p', { class: 'muted' }, 'Ces corrections sont appliquées automatiquement à chaque nouvelle transcription.'),
    rows.length ? el('div', {}, ...rows.map(([k, v]) => el('div', { class: 'options' }, el('span', {}, `« ${k} » → « ${v} »`),
      el('button', { class: 'btn small danger', onclick: e => { delete S.dict[k]; saveDict(); e.currentTarget.parentElement.remove(); } }, 'Oublier')))) : el('p', {}, 'Vide pour l\'instant.'));
}

// ---------- Onglet Revue ----------
function reviewTab(C) {
  C.append(el('p', { class: 'lead' }, el('b', {}, 'Revue. '), 'Regarde le résultat à gauche, règle les derniers détails et exporte.'));
  C.append(cleanupPanel());
  C.append(el('div', { class: 'panel' }, el('h2', {}, 'Sous-titres et sons'),
    el('div', { class: 'options' },
      el('label', {}, el('input', { type: 'checkbox', checked: S.captions.on, onchange: e => { S.captions.on = e.target.checked; } }), 'Sous-titres'),
      el('label', {}, el('input', { type: 'checkbox', checked: S.sfx.on, onchange: e => { S.sfx.on = e.target.checked; } }), 'Effets sonores sur les animations et transitions'),
      el('label', {}, 'Transitions', select(TRANS_STYLES.map(x => [x.id, x.name]), S.look.trans || 'auto', v => { S.look = { ...S.look, trans: v }; })),
      el('label', {}, 'Volume', el('input', { type: 'range', min: '0', max: '1', step: '0.05', value: S.sfx.vol, oninput: e => { S.sfx.vol = +e.target.value; } })))));
  C.append(depthPanel());
  C.append(el('div', { class: 'panel', style: 'margin-top:14px' }, el('h2', {}, 'Export'),
    el('button', { class: 'btn yellow', id: 'exportBtn', onclick: exportVideo }, 'Exporter la vidéo'),
    el('div', { class: 'progress' }, el('div', { id: 'bar' })),
    el('p', { class: 'muted', id: 'status' }, S.server.ffmpeg ? 'Export en MP4 H.264.' : 'Sans ffmpeg (serve.py), l\'export sort dans le format du navigateur.'),
    el('p', { class: 'muted' }, 'L\'export se fait en temps réel : garde l\'onglet au premier plan (sur téléphone, garde l\'écran allumé).'),
    el('div', { class: 'row-btns' },
      el('button', { class: 'btn', onclick: downloadCover }, 'Télécharger la couverture (PNG)'),
      el('button', { class: 'btn', onclick: copyForClaude }, '📋 Copier pour Claude'))));
}

function downloadCover() {
  const c = el('canvas', { width: 1080, height: 1920 }), t = video.currentTime || 0;
  render(c.getContext('2d'), 1080, 1920, t, cfg({ motions: [], media: [], captions: null, noSync: true, titleStart: t - S.titleDur * .5 }));
  c.toBlob(b => el('a', { href: URL.createObjectURL(b), download: (S.fileName.replace(/\.[^.]+$/, '') || 'reel') + '-couverture.png' }).click(), 'image/png');
}

// ---------- Lecture ----------
$('play').onclick = () => { video.paused ? video.play() : video.pause(); };
video.addEventListener('play', () => $('play').textContent = 'Pause');
video.addEventListener('pause', () => $('play').textContent = 'Lecture');
video.addEventListener('ended', () => { if (!S.exporting) { video.currentTime = 0; video.play().catch(() => {}); } });
$('back5').onclick = () => { video.currentTime = Math.max(0, video.currentTime - 5); };
$('fwd5').onclick = () => { video.currentTime = Math.min(video.duration || 0, video.currentTime + 5); };
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) { e.preventDefault(); $('play').click(); }
});

// ---------- Export ----------
const seekTo = t => new Promise(r => { video.addEventListener('seeked', r, { once: true }); video.currentTime = t; });
async function exportVideo() {
  if (S.exporting || !video.src) return;
  S.exporting = true;
  const btn = $('exportBtn'), bar = $('bar'), status = $('status');
  btn.disabled = true;
  try {
    if (S.depthOn && depth.kind === 'browser' && depth.status === 'running') { status.textContent = 'Attente de la préparation de ta silhouette…'; await whenPrepared(); }
    await document.fonts.ready;
    let W = video.videoWidth, H = video.videoHeight;
    const k = 1920 / Math.max(W, H);
    if (k < 1) { W = Math.round(W * k / 2) * 2; H = Math.round(H * k / 2) * 2; }
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const stream = c.captureStream(30);
    const { ac, dest } = ensureAudio();
    await ac.resume();
    await loadSfxLibrary(ac);
    dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
    const mime = ['video/mp4;codecs=avc1,mp4a', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(m => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12e6 });
    const chunks = [];
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    const stopped = new Promise(r => rec.onstop = r);
    const conf = cfg();
    const segs = S.cutSegs, D = video.duration, kept = D - cutSaving();
    const keptBefore = t => t - segs.reduce((a, [x, y]) => a + clamp(t - x, 0, y - x), 0);
    video.pause(); video.muted = false;
    const first = segs.find(([a]) => a <= .01);
    await seekTo(first ? first[1] : 0);
    lastT = video.currentTime - .01;
    updateDepth(video, S.depthOn);
    render(ctx, W, H, video.currentTime, conf);
    let finish; const finished = new Promise(r => finish = r);
    const onEnd = () => finish();
    video.addEventListener('ended', onEnd, { once: true });
    let busy = false, done = false;
    const tick = async () => {
      if (done) return;
      const t = video.currentTime;
      const seg = !busy && segs.find(([a, b]) => t >= a && t < b);
      if (seg) {
        if (seg[1] >= D - .05) { finish(); return; }
        busy = true; rec.pause(); video.pause();
        await seekTo(seg[1]); lastT = video.currentTime - .01;
        updateDepth(video, S.depthOn); render(ctx, W, H, video.currentTime, conf);
        rec.resume(); await video.play(); busy = false;
      } else if (!busy) { updateDepth(video, S.depthOn); render(ctx, W, H, t, conf); tickSfx(conf, t); }
      bar.style.width = (100 * keptBefore(t) / kept) + '%';
      status.textContent = `Enregistrement… ${fmt(keptBefore(t))} / ${fmt(kept)}`;
      requestAnimationFrame(tick);
    };
    rec.start(250); await video.play(); tick();
    await finished; done = true; video.pause();
    video.removeEventListener('ended', onEnd);
    rec.stop(); await stopped;
    let blob = new Blob(chunks, { type: mime.split(';')[0] }), ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
    if (!mime.includes('avc1') && S.server.ffmpeg) {
      status.textContent = 'Conversion en MP4…';
      const r = await fetch('/convert', { method: 'POST', body: blob });
      if (r.ok) { blob = await r.blob(); ext = 'mp4'; } else status.textContent = 'Conversion échouée, export brut.';
    }
    const name = (S.fileName.replace(/\.[^.]+$/, '') || 'video') + '-edit.' + ext;
    el('a', { href: URL.createObjectURL(blob), download: name }).click();
    bar.style.width = '100%';
    status.textContent = `Terminé : ${name} (${(blob.size / 1e6).toFixed(1)} Mo).`;
  } catch (err) {
    status.textContent = 'Erreur pendant l\'export : ' + err.message;
  } finally {
    video.muted = true; btn.disabled = false; S.exporting = false;
  }
}

fetch('/health').then(r => r.ok ? r.json() : null).then(j => { if (j) S.server = { ...S.server, ...j }; }).catch(() => {});
document.fonts.ready.then(() => Promise.all(FONT_PAIRS.flatMap(p => [p.display, p.body, p.hand, p.accent].filter(Boolean)).map(f => document.fonts.load(fstr(f, 40))))).catch(() => {});
draw();
requestAnimationFrame(frame);
