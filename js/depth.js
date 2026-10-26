// Effet « texte derrière toi » : fournit, pour l'image vidéo en cours, un calque alpha de la
// personne (blanc opaque = personne) que render() utilise pour la redessiner par-dessus le texte.
//
// Deux moteurs :
//  - 'browser' (par défaut) : MediaPipe Tasks Vision (ImageSegmenter) dans le navigateur.
//    La silhouette est préparée une fois, image par image, sur une copie cachée de la vidéo,
//    puis relue à l'image près pendant l'aperçu et l'export : fluide même sur une machine
//    modeste, aucun serveur (fonctionne sur un hébergement statique comme Vercel).
//  - 'server' : vidéo de masque calculée par serve.py / depth.py (rembg ou mediapipe en Python).

const TASKS = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0';
export const BROWSER_MODELS = [
  ['multiclass', 'Précis (cheveux, vêtements) — 16 Mo',
    'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite'],
  ['selfie', 'Rapide — 250 Ko',
    'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite'],
];
const MASK_WIDTH = 192;          // largeur des masques stockés (le modèle travaille en 256 × 256)
const MEMORY_BUDGET = 150e6;     // octets max pour les masques en mémoire (baisse la cadence au-delà)

export const depth = {
  status: 'idle', // idle | loading | uploading | running | done | error
  kind: 'browser', done: 0, total: 0, engine: '', error: '', log: '', delegate: '',
  alpha: null,    // <canvas> : la personne en alpha, pour l'image en cours
  ready: false,   // un calque peut être fourni (même si la préparation n'est pas terminée)
};

// ---------- Moteur navigateur ----------
// La segmentation tourne dans un Web Worker : l'interface reste fluide pendant la préparation.
const WORKER_SRC = `
let seg = null, model = '', ts = 0, prev = null;
async function init(m, url) {
  const { FilesetResolver, ImageSegmenter } = await import('${TASKS}/vision_bundle.mjs');
  const fileset = await FilesetResolver.forVisionTasks('${TASKS}/wasm');
  // MediaPipe charge son moteur WebAssembly avec importScripts(), absent des workers « module » :
  // on évalue nous-mêmes le chargeur dans la portée globale, puis on neutralise importScripts.
  if (!self.ModuleFactory) {
    const code = await (await fetch(fileset.wasmLoaderPath)).text();
    (0, eval)(code + '\\nself.ModuleFactory = ModuleFactory;');
  }
  self.importScripts = () => {};
  const make = delegate => ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: url, delegate },
    runningMode: 'VIDEO', outputConfidenceMasks: true, outputCategoryMask: false,
  });
  // Certains navigateurs annoncent un GPU qui n'est qu'une émulation très lente :
  // on chronomètre GPU et processeur et on garde le plus rapide.
  const probe = new OffscreenCanvas(${MASK_WIDTH}, ${Math.round(MASK_WIDTH * 16 / 9)});
  probe.getContext('2d').fillRect(0, 0, probe.width, probe.height);
  const bench = s => { let best = Infinity; for (let i = 0; i < 3; i++) { const t0 = performance.now(); const r = s.segmentForVideo(probe, ++ts); r.close && r.close(); best = Math.min(best, performance.now() - t0); } return best; };
  if (seg) { seg.close(); seg = null; }
  let gpu = null, gpuMs = Infinity, delegate = 'GPU';
  try { gpu = await make('GPU'); bench(gpu); gpuMs = bench(gpu); } catch (e) { gpu = null; }
  if (gpu && gpuMs < 40) seg = gpu;
  else {
    const cpu = await make('CPU'); bench(cpu); const cpuMs = bench(cpu);
    if (gpu && gpuMs <= cpuMs) { cpu.close(); seg = gpu; }
    else { if (gpu) gpu.close(); seg = cpu; delegate = 'CPU'; }
  }
  model = m;
  return delegate;
}
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') return self.postMessage({ type: 'ready', delegate: await init(data.model, data.url) });
    if (data.type === 'seg') {
      const res = seg.segmentForVideo(data.bitmap, ++ts);
      const f = res.confidenceMasks[0].getAsFloat32Array();
      const out = new Uint8Array(f.length), bg = model === 'multiclass'; // catégorie 0 = fond
      if (!prev || prev.length !== f.length || data.first) prev = null;
      if (!prev) prev = new Float32Array(f.length);
      for (let k = 0; k < f.length; k++) {
        const p = bg ? 1 - f[k] : f[k];
        prev[k] = data.first ? p : prev[k] * .3 + p * .7; // lissage temporel léger (anti-scintillement)
        out[k] = prev[k] * 255;
      }
      res.close && res.close(); data.bitmap.close();
      self.postMessage({ type: 'mask', id: data.id, data: out }, [out.buffer]);
    }
  } catch (e) { self.postMessage({ type: 'error', id: data.id, message: String((e && e.message) || e) }); }
};`;

let worker = null, workerModel = '', delegate = '', token = 0;
let cache = null;   // { fps, w, h, frames: Uint8Array[] } : alpha de chaque image préparée
let lastIdx = -1, alphaImg = null, finished = null;

function call(msg, transfer = []) {
  return new Promise((resolve, reject) => {
    const on = ({ data }) => {
      if (msg.id !== undefined && data.id !== msg.id) return;
      worker.removeEventListener('message', on);
      data.type === 'error' ? reject(new Error(data.message)) : resolve(data);
    };
    worker.addEventListener('message', on);
    worker.postMessage(msg, transfer);
  });
}

async function loadSegmenter(model, onUpdate) {
  if (worker && workerModel === model) return;
  Object.assign(depth, { status: 'loading', error: '' }); onUpdate();
  if (!worker) worker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' })), { type: 'module' });
  const r = await call({ type: 'init', model, url: BROWSER_MODELS.find(m => m[0] === model)[2] });
  delegate = r.delegate; workerModel = model;
}

const seekTo = (v, t) => new Promise(res => { v.addEventListener('seeked', res, { once: true }); v.currentTime = t; });

export async function startBrowserMatting(file, model = 'multiclass', onUpdate = () => {}) {
  if (!file) return;
  const me = ++token;
  stopServer();
  Object.assign(depth, { kind: 'browser', engine: 'MediaPipe (navigateur)', ready: false, done: 0, total: 0 });
  let done;
  finished = new Promise(r => { done = r; });
  try {
    await loadSegmenter(model, onUpdate);
    if (me !== token) return;
    depth.delegate = delegate;
    // Copie cachée de la vidéo, parcourue image par image sans toucher à l'aperçu.
    const v = Object.assign(document.createElement('video'), { src: URL.createObjectURL(file), muted: true, playsInline: true, preload: 'auto' });
    await new Promise((res, rej) => { v.addEventListener('loadeddata', res, { once: true }); v.addEventListener('error', () => rej(new Error('vidéo illisible')), { once: true }); });
    const w = MASK_WIDTH, h = Math.round(v.videoHeight * w / v.videoWidth);
    const fps = Math.max(10, Math.min(30, Math.floor(MEMORY_BUDGET / (v.duration * w * h))));
    const n = Math.max(1, Math.ceil(v.duration * fps));
    cache = { fps, w, h, frames: new Array(n) };
    lastIdx = -1; alphaImg = null;
    depth.alpha = Object.assign(document.createElement('canvas'), { width: w, height: h });
    Object.assign(depth, { status: 'running', ready: true, total: n, done: 0 });
    onUpdate();
    // Pendant que le worker segmente l'image i, on cherche déjà l'image i + 1.
    await seekTo(v, Math.min(v.duration - .001, .5 / fps));
    for (let i = 0; i < n; i++) {
      if (me !== token) { v.removeAttribute('src'); return; }
      const bitmap = await createImageBitmap(v, { resizeWidth: w, resizeHeight: h });
      const pending = call({ type: 'seg', id: i, bitmap, first: i === 0 }, [bitmap]);
      const next = i + 1 < n ? seekTo(v, Math.min(v.duration - .001, (i + 1.5) / fps)) : null;
      cache.frames[i] = (await pending).data;
      if (next) await next;
      depth.done = i + 1;
      if (i % 4 === 0) onUpdate();
    }
    v.removeAttribute('src');
    Object.assign(depth, { status: 'done' });
  } catch (e) {
    if (me === token) Object.assign(depth, { status: 'error', ready: false, error: e.message });
  } finally {
    done();
  }
  if (me === token) onUpdate();
}

// Écrit dans depth.alpha le masque préparé de l'image au temps t (le plus proche disponible).
function showCached(t) {
  const c = cache;
  if (!c) return;
  let idx = Math.min(c.frames.length - 1, Math.max(0, Math.floor(t * c.fps)));
  if (!c.frames[idx]) { // pas encore préparée : la plus proche déjà prête, à 3 images près
    let found = -1;
    for (let d = 1; d <= 3 && found < 0; d++) { if (c.frames[idx - d]) found = idx - d; else if (c.frames[idx + d]) found = idx + d; }
    if (found < 0) { if (lastIdx !== -2) { depth.alpha.getContext('2d').clearRect(0, 0, c.w, c.h); lastIdx = -2; } return; }
    idx = found;
  }
  if (idx === lastIdx) return;
  lastIdx = idx;
  const g = depth.alpha.getContext('2d');
  if (!alphaImg) { alphaImg = g.createImageData(c.w, c.h); alphaImg.data.fill(255); }
  const d = alphaImg.data, a = c.frames[idx];
  for (let k = 0; k < a.length; k++) d[k * 4 + 3] = a[k];
  g.putImageData(alphaImg, 0, 0);
}

// Attend la fin de la préparation (avant un export).
export const whenPrepared = () => finished || Promise.resolve();

// ---------- Moteur serveur (serve.py / depth.py) ----------
let jobFor = null, maskVideo = null, lastMaskTime = -1;

export async function startServerMatting(file, engine = 'auto', onUpdate = () => {}) {
  if (!file) return;
  if (jobFor === file && depth.kind === 'server' && ['uploading', 'running', 'done'].includes(depth.status)) return;
  token++; cache = null;
  jobFor = file;
  Object.assign(depth, { status: 'uploading', kind: 'server', done: 0, total: 0, error: '', ready: false, engine });
  onUpdate();
  try {
    const r = await fetch(`/matte?engine=${encodeURIComponent(engine)}`, { method: 'POST', body: file });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.id) throw new Error(j.error || `le serveur a répondu ${r.status}`);
    depth.status = 'running'; onUpdate();
    for (;;) {
      await new Promise(res => setTimeout(res, 600));
      if (jobFor !== file) return;
      const s = await (await fetch(`/matte/status?id=${j.id}`)).json();
      Object.assign(depth, { done: s.done || 0, total: s.total || 0, engine: s.engine || engine, log: s.log || '' });
      if (s.state === 'error') throw new Error(s.error);
      if (s.state === 'done') break;
      onUpdate();
    }
    const blob = await (await fetch(`/matte/mask?id=${j.id}`)).blob();
    const v = Object.assign(document.createElement('video'), { src: URL.createObjectURL(blob), muted: true, playsInline: true, preload: 'auto' });
    await new Promise((res, rej) => { v.addEventListener('loadeddata', res, { once: true }); v.addEventListener('error', () => rej(new Error('vidéo de masque illisible')), { once: true }); });
    depth.alpha = Object.assign(document.createElement('canvas'), { width: v.videoWidth, height: v.videoHeight });
    maskVideo = v; lastMaskTime = -1;
    Object.assign(depth, { status: 'done', ready: true });
  } catch (e) {
    Object.assign(depth, { status: 'error', error: e.message, ready: false });
  }
  onUpdate();
}

function stopServer() {
  jobFor = null;
  if (maskVideo) maskVideo.pause();
  maskVideo = null;
}

function followMaskVideo(video) {
  const m = maskVideo;
  if (!m) return;
  const t = video.currentTime;
  if (video.paused || video.seeking) {
    if (!m.paused) m.pause();
    if (Math.abs(m.currentTime - t) > .02 && !m.seeking) m.currentTime = t;
  } else {
    if (m.paused) m.play().catch(() => {});
    if (Math.abs(m.currentTime - t) > .08 && !m.seeking) m.currentTime = t;
  }
  if (m.readyState < 2 || m.currentTime === lastMaskTime) return;
  lastMaskTime = m.currentTime;
  const c = depth.alpha, g = c.getContext('2d', { willReadFrequently: true });
  g.globalCompositeOperation = 'copy';
  g.drawImage(m, 0, 0, c.width, c.height);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) { d[i + 3] = d[i]; d[i] = d[i + 1] = d[i + 2] = 255; }
  g.putImageData(img, 0, 0);
}

// ---------- Commun ----------
// Nouvelle vidéo ou changement de moteur : on oublie la silhouette préparée.
export function resetMatting() {
  token++;
  stopServer();
  cache = null; lastIdx = -1; finished = null;
  Object.assign(depth, { status: 'idle', ready: false, done: 0, total: 0, error: '', alpha: null });
}

// À appeler une fois par image (aperçu et export), seulement quand l'effet est actif.
export function updateDepth(video, active) {
  if (!active || !depth.ready) return;
  if (depth.kind === 'browser') showCached(video.currentTime);
  else followMaskVideo(video);
}
