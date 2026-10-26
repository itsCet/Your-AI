// Effet « texte derrière toi » : produit, pour l'image vidéo en cours, un calque alpha de la
// personne (blanc opaque = personne) que render() utilise pour la redessiner par-dessus le texte.
//
// Deux moteurs :
//  - 'browser' (par défaut) : MediaPipe Tasks Vision (ImageSegmenter) dans le navigateur, GPU si
//    possible. Le masque est calculé sur l'image exacte qui est dessinée : aucun décalage, aucun
//    serveur (fonctionne sur un hébergement statique comme Vercel).
//  - 'server' : vidéo de masque calculée par serve.py / depth.py (rembg ou mediapipe en Python).
import { setFrameSource } from './kit.js';

const TASKS = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0';
export const BROWSER_MODELS = [
  ['multiclass', 'Précis (cheveux, vêtements) — 16 Mo',
    'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite'],
  ['selfie', 'Rapide — 250 Ko',
    'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite'],
];
const SEG_WIDTH = 256; // largeur de l'image envoyée au modèle

export const depth = {
  status: 'idle', // idle | loading | uploading | running | done | error
  kind: 'browser', done: 0, total: 0, engine: '', error: '', log: '', delegate: '',
  alpha: null,    // <canvas> : la personne en alpha
  ready: false,
};

// ---------- Moteur navigateur ----------
let seg = null, segModel = '', lastTs = 0, frameCanvas = null, smallCanvas = null, prev = null, lastFrameKey = null;
let segCost = 0, nextSegAt = 0; // durée moyenne d'une segmentation (ms) et prochaine segmentation autorisée en aperçu

export async function startBrowserMatting(model = 'multiclass', onUpdate = () => {}) {
  if (seg && segModel === model) { Object.assign(depth, { status: 'done', ready: true, kind: 'browser' }); onUpdate(); return; }
  stopServer();
  Object.assign(depth, { status: 'loading', kind: 'browser', ready: false, error: '', engine: 'MediaPipe (navigateur)' });
  onUpdate();
  try {
    const { FilesetResolver, ImageSegmenter } = await import(`${TASKS}/vision_bundle.mjs`);
    const fileset = await FilesetResolver.forVisionTasks(`${TASKS}/wasm`);
    const url = BROWSER_MODELS.find(m => m[0] === model)[2];
    const make = delegate => ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: url, delegate },
      runningMode: 'VIDEO', outputConfidenceMasks: true, outputCategoryMask: false,
    });
    if (seg) seg.close();
    try { seg = await make('GPU'); depth.delegate = 'GPU'; } catch { seg = await make('CPU'); depth.delegate = 'CPU'; }
    segModel = model; prev = null; lastFrameKey = null;
    Object.assign(depth, { status: 'done', ready: true });
  } catch (e) {
    seg = null;
    Object.assign(depth, { status: 'error', ready: false, error: 'chargement de MediaPipe impossible (' + e.message + ')' });
  }
  onUpdate();
}

// Copie l'image vidéo en cours (pleine résolution pour le dessin, petite pour le modèle),
// segmente la petite, et convertit la confiance « personne » en alpha.
// exact = true (export) : chaque image est segmentée et dessinée depuis la même copie.
// exact = false (aperçu) : sur une machine lente, on espace les segmentations pour garder
// l'interface fluide (la vidéo reste en direct, le masque peut avoir une image de retard).
function segmentFrame(video, exact) {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || video.readyState < 2) return;
  const key = video.currentTime + ':' + vw;
  if (key === lastFrameKey) return;
  const now = performance.now();
  if (!exact && now < nextSegAt) { setFrameSource(null); return; }
  lastFrameKey = key;
  if (!frameCanvas) frameCanvas = document.createElement('canvas');
  if (frameCanvas.width !== vw || frameCanvas.height !== vh) { frameCanvas.width = vw; frameCanvas.height = vh; }
  frameCanvas.getContext('2d').drawImage(video, 0, 0, vw, vh);
  const sw = SEG_WIDTH, sh = Math.round(vh * sw / vw);
  if (!smallCanvas) smallCanvas = document.createElement('canvas');
  if (smallCanvas.width !== sw || smallCanvas.height !== sh) { smallCanvas.width = sw; smallCanvas.height = sh; prev = null; }
  smallCanvas.getContext('2d').drawImage(frameCanvas, 0, 0, sw, sh);
  lastTs = Math.max(lastTs + 1, now);
  const res = seg.segmentForVideo(smallCanvas, lastTs);
  try {
    const masks = res.confidenceMasks;
    const m = masks[0], f = m.getAsFloat32Array(), mw = m.width, mh = m.height;
    const bg = segModel === 'multiclass'; // catégorie 0 = fond : la personne, c'est le reste
    if (!depth.alpha) depth.alpha = document.createElement('canvas');
    const a = depth.alpha;
    if (a.width !== mw || a.height !== mh) { a.width = mw; a.height = mh; prev = null; }
    if (!prev || prev.length !== f.length) prev = new Float32Array(f.length);
    const g = a.getContext('2d'), img = g.createImageData(mw, mh), d = img.data;
    for (let i = 0; i < f.length; i++) {
      const p = bg ? 1 - f[i] : f[i];
      const v = prev[i] = prev[i] * .3 + p * .7; // lissage temporel léger (anti-scintillement)
      const j = i * 4;
      d[j] = d[j + 1] = d[j + 2] = 255; d[j + 3] = v * 255;
    }
    g.putImageData(img, 0, 0);
  } finally {
    res.close?.();
  }
  const cost = performance.now() - now;
  segCost = segCost ? segCost * .8 + cost * .2 : cost;
  depth.cost = segCost;
  // Au-delà de ~12 ms par image, l'aperçu laisse respirer l'interface entre deux segmentations.
  nextSegAt = performance.now() + (segCost > 12 ? segCost * 2 : 0);
  // L'image dessinée est exactement celle qui a été segmentée.
  setFrameSource(frameCanvas);
}

// ---------- Moteur serveur (serve.py / depth.py) ----------
let jobFor = null, maskVideo = null, lastMaskTime = -1;

export async function startServerMatting(file, engine = 'auto', onUpdate = () => {}) {
  if (!file) return;
  if (jobFor === file && depth.kind === 'server' && ['uploading', 'running', 'done'].includes(depth.status)) return;
  jobFor = file;
  setFrameSource(null);
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
export function resetMatting() {
  stopServer();
  setFrameSource(null);
  prev = null; lastFrameKey = null;
  Object.assign(depth, { status: seg && depth.kind === 'browser' ? 'done' : 'idle', ready: !!seg && depth.kind === 'browser', done: 0, total: 0, error: '' });
  if (!depth.ready) depth.alpha = null;
}

// À appeler une fois par image (aperçu et export), seulement quand l'effet est actif.
export function updateDepth(video, active, exact = false) {
  if (!active || !depth.ready) { setFrameSource(null); return; }
  if (depth.kind === 'browser' && seg) segmentFrame(video, exact);
  else followMaskVideo(video);
}
