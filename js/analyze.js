// Analyse de la vidéo : audio (volume, silences, temps forts) et transcription Whisper
// mot à mot, exécutée dans le navigateur via transformers.js (aucun envoi sur un serveur).

export const RATE = 16000;   // fréquence attendue par Whisper
export const HOP = 0.05;     // pas d'analyse du volume, en secondes

// Décode la piste audio du fichier en mono 16 kHz. Retourne { pcm, how } ; pcm = null si aucun moyen n'a marché
// (error dit pourquoi). Trois essais :
//  1. decodeAudioData directement en 16 kHz ;
//  2. decodeAudioData au débit natif puis rééchantillonnage (certains navigateurs refusent le 16 kHz) ;
//  3. WebCodecs + mp4box.js : on extrait la piste AAC du conteneur (.mov de l'iPhone, que Safari ne décode pas
//     toujours avec decodeAudioData) et on la décode avec AudioDecoder.
export async function decodeAudio(file) {
  const buf = await file.arrayBuffer();
  const errors = [];
  try { return { pcm: mono(await new OfflineAudioContext(1, 1, RATE).decodeAudioData(buf.slice(0))), how: 'decodeAudioData' }; }
  catch (e) { errors.push('decodeAudioData 16 kHz : ' + (e?.message || e)); }
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const ab = await ac.decodeAudioData(buf.slice(0));
    ac.close?.();
    return { pcm: await resample(mono(ab), ab.sampleRate), how: 'decodeAudioData + rééchantillonnage' };
  } catch (e) { errors.push('decodeAudioData : ' + (e?.message || e)); }
  try { return { pcm: await decodeWithWebCodecs(buf), how: 'WebCodecs' }; }
  catch (e) { errors.push('WebCodecs : ' + (e?.message || e)); }
  return { pcm: null, error: errors.join(' · ') };
}

function mono(ab) {
  const n = ab.length, pcm = new Float32Array(n);
  for (let c = 0; c < ab.numberOfChannels; c++) {
    const d = ab.getChannelData(c);
    for (let i = 0; i < n; i++) pcm[i] += d[i] / ab.numberOfChannels;
  }
  return pcm;
}

// Rééchantillonne un signal mono vers 16 kHz avec le moteur audio du navigateur.
async function resample(pcm, rate) {
  if (rate === RATE) return pcm;
  const len = Math.ceil(pcm.length * RATE / rate);
  const off = new OfflineAudioContext(1, len, RATE);
  const b = off.createBuffer(1, pcm.length, rate);
  b.getChannelData(0).set(pcm);
  const src = off.createBufferSource(); src.buffer = b; src.connect(off.destination); src.start();
  return (await off.startRendering()).getChannelData(0);
}

let mp4boxLoading = null;
function loadMp4box() {
  if (window.MP4Box) return Promise.resolve(window.MP4Box);
  return mp4boxLoading ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js';
    s.onload = () => window.MP4Box ? res(window.MP4Box) : rej(new Error('mp4box introuvable'));
    s.onerror = () => rej(new Error('mp4box ne se charge pas'));
    document.head.append(s);
  });
}

async function decodeWithWebCodecs(buf) {
  if (!('AudioDecoder' in window)) throw new Error('AudioDecoder indisponible');
  const MP4Box = await loadMp4box();
  const f = MP4Box.createFile();
  const { track, samples, description } = await new Promise((res, rej) => {
    let track = null, description, samples = [];
    f.onError = e => rej(new Error(String(e)));
    f.onReady = info => {
      track = info.audioTracks?.[0];
      if (!track) return rej(new Error('pas de piste audio'));
      // Configuration du décodeur AAC (AudioSpecificConfig) tirée de la boîte esds.
      const entry = f.getTrackById(track.id).mdia.minf.stbl.stsd.entries[0];
      const dsi = entry?.esds?.esd?.descs?.[0]?.descs?.[0];
      if (dsi?.data) description = new Uint8Array(dsi.data);
      f.setExtractionOptions(track.id, null, { nbSamples: 1e9 });
      f.start();
    };
    f.onSamples = (id, user, s) => { samples.push(...s); };
    const ab = buf.slice(0); ab.fileStart = 0;
    f.appendBuffer(ab); f.flush();
    setTimeout(() => track ? res({ track, samples, description }) : rej(new Error('conteneur illisible')), 0);
  });
  if (!samples.length) throw new Error('aucun échantillon audio');
  const rate = track.audio.sample_rate, chans = track.audio.channel_count;
  const parts = [];
  let total = 0, outRate = rate, err = null;
  const dec = new AudioDecoder({
    output: d => {
      outRate = d.sampleRate;
      const n = d.numberOfFrames, m = new Float32Array(n), tmp = new Float32Array(n);
      for (let c = 0; c < d.numberOfChannels; c++) {
        d.copyTo(tmp, { planeIndex: c, format: 'f32-planar' });
        for (let i = 0; i < n; i++) m[i] += tmp[i] / d.numberOfChannels;
      }
      parts.push(m); total += n; d.close();
    },
    error: e => { err = e; },
  });
  // Nom de codec normalisé (« mp4a.40.2 ») : mp4box peut renvoyer « mp4a » seul ou « mp4a.40.02 ».
  const aot = description ? description[0] >> 3 : 2;
  const m = /^mp4a\.40\.0*(\d+)$/.exec(track.codec || '');
  const codec = `mp4a.40.${m ? m[1] : aot || 2}`;
  dec.configure({ codec, sampleRate: rate, numberOfChannels: chans, ...(description ? { description } : {}) });
  for (const s of samples) dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: Math.round(s.cts * 1e6 / s.timescale), duration: Math.round(s.duration * 1e6 / s.timescale), data: s.data }));
  await dec.flush();
  dec.close();
  if (err) throw err;
  if (!total) throw new Error('rien décodé');
  const pcm = new Float32Array(total);
  let o = 0; for (const p of parts) { pcm.set(p, o); o += p.length; }
  return resample(pcm, outRate);
}

// Volume en dB par fenêtre de HOP secondes.
export function loudness(pcm) {
  const win = Math.round(RATE * HOP), n = Math.floor(pcm.length / win);
  const db = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = i * win; j < (i + 1) * win; j++) s += pcm[j] * pcm[j];
    db[i] = 10 * Math.log10(s / win + 1e-10);
  }
  return db;
}

const pct = (arr, q) => { const a = Array.from(arr).sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * a.length))] ?? -100; };

// Seuil de silence adaptatif : entre le bruit de fond et le niveau de la voix.
export function silenceThreshold(db, sensitivity = .3) {
  const floor = pct(db, .1), voice = pct(db, .95);
  return floor + (voice - floor) * sensitivity;
}

// Plages silencieuses d'au moins minLen secondes.
export function findSilences(db, sensitivity = .3, minLen = .5) {
  const thr = silenceThreshold(db, sensitivity), out = [];
  let start = -1;
  for (let i = 0; i <= db.length; i++) {
    const quiet = i < db.length && db[i] < thr;
    if (quiet && start < 0) start = i;
    if (!quiet && start >= 0) {
      if ((i - start) * HOP >= minLen) out.push([start * HOP, i * HOP]);
      start = -1;
    }
  }
  return out;
}

// Plages à couper : les silences, en gardant un peu d'air autour de la voix.
export function cutsFromSilences(silences, duration, pad = .15) {
  return silences.map(([a, b]) => [a <= HOP ? 0 : a + pad, b >= duration - HOP ? duration : b - pad])
    .filter(([a, b]) => b - a >= .25);
}

// Temps forts : maxima du volume lissé sur 1 s, espacés d'au moins `gap` secondes.
export function findPeaks(db, gap = 4) {
  const k = Math.round(1 / HOP), sm = [];
  for (let i = 0; i < db.length; i++) {
    let s = 0, c = 0;
    for (let j = Math.max(0, i - k / 2); j < Math.min(db.length, i + k / 2); j++) { s += db[j]; c++; }
    sm.push(s / c);
  }
  const thr = pct(sm, .8);
  const cands = sm.map((v, i) => ({ t: i * HOP, v })).filter(c => c.v >= thr).sort((a, b) => b.v - a.v);
  const out = [];
  for (const c of cands) if (out.every(t => Math.abs(t - c.t) >= gap)) out.push(c.t);
  return out.sort((a, b) => a - b);
}

// ---------- Transcription ----------
const MODEL = 'onnx-community/whisper-base_timestamped';
const WORKER_SRC = `
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/dist/transformers.min.js';
let asr = null;
async function load(webgpu) {
  const files = {};
  const opts = {
    dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
    progress_callback: e => {
      if (e.status !== 'progress' || !e.total) return;
      files[e.file] = [e.loaded, e.total];
      const v = Object.values(files);
      self.postMessage({ type: 'download', loaded: v.reduce((a, x) => a + x[0], 0), total: v.reduce((a, x) => a + x[1], 0) });
    },
  };
  let gpu = false;
  if (webgpu && self.navigator.gpu) { try { gpu = !!(await self.navigator.gpu.requestAdapter()); } catch (e) {} }
  if (gpu) { try { return await pipeline('automatic-speech-recognition', '${MODEL}', { ...opts, device: 'webgpu' }); } catch (e) {} }
  return pipeline('automatic-speech-recognition', '${MODEL}', { ...opts, device: 'wasm' });
}
let forceWasm = false;
self.onmessage = async ({ data }) => {
  const opts = { return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5, task: 'transcribe', ...(data.lang ? { language: data.lang } : {}) };
  try {
    if (!asr) asr = await load(data.webgpu && !forceWasm);
    let out;
    try { out = await asr(data.pcm, opts); }
    catch (e) {
      // La carte graphique (WebGPU) a échoué pendant le calcul : on recommence sur le processeur.
      if (forceWasm) throw e;
      forceWasm = true; asr = await load(false);
      out = await asr(data.pcm, opts);
    }
    self.postMessage({ type: 'done', id: data.id, out });
  } catch (e) { self.postMessage({ type: 'error', id: data.id, message: String((e && e.message) || e) }); }
};`;

let worker = null, pending = null;
export function cancelTranscription() {
  if (worker) { worker.terminate(); worker = null; }
  if (pending) { pending(new Error('cancelled')); pending = null; }
}
function getWorker() {
  if (!worker) worker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' })), { type: 'module' });
  return worker;
}

// Phrases que Whisper "hallucine" souvent sur du silence.
const HALLUCINATION = /amara\.org|sous-titr|merci d'avoir regardé|thanks for watching|subtitles by/i;

// Découpe en fenêtres de ~28 s, coupées au moment le plus calme pour ne pas couper un mot.
function windows(db, duration) {
  const out = []; let a = 0;
  while (a < duration - .5) {
    let b = Math.min(duration, a + 28);
    if (b < duration) {
      let best = b, min = Infinity;
      for (let t = a + 22; t < a + 28; t += HOP) { const v = db[Math.round(t / HOP)] ?? 0; if (v < min) { min = v; best = t; } }
      b = best;
    }
    out.push([a, b]); a = b;
  }
  return out;
}

// Retourne [{ w, s, e }] : chaque mot avec son début et sa fin en secondes.
export async function transcribe(pcm, db, { lang, onProgress }) {
  const duration = pcm.length / RATE;
  const thr = silenceThreshold(db, .3);
  const wins = windows(db, duration);
  const w = getWorker();
  let id = 0;
  const words = [];
  const ask = msg => new Promise((resolve, reject) => {
    const myId = ++id;
    pending = reject;
    const onMsg = ({ data }) => {
      if (data.type === 'download') onProgress({ phase: 'download', loaded: data.loaded, total: data.total });
      if (data.id !== myId) return;
      w.removeEventListener('message', onMsg);
      pending = null;
      data.type === 'done' ? resolve(data.out) : reject(new Error(data.message));
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ ...msg, id: myId });
  });
  for (let i = 0; i < wins.length; i++) {
    const [a, b] = wins[i];
    onProgress({ phase: 'transcribe', done: a, total: duration });
    // Fenêtre quasi silencieuse : inutile (et source d'hallucinations).
    let loud = 0, n = 0;
    for (let t = a; t < b; t += HOP) { n++; if ((db[Math.round(t / HOP)] ?? -100) > thr) loud++; }
    if (loud / Math.max(1, n) < .05) continue;
    const out = await ask({ pcm: pcm.slice(Math.round(a * RATE), Math.round(b * RATE)), lang, webgpu: 'gpu' in navigator });
    if (HALLUCINATION.test(out.text || '')) continue;
    for (const c of out.chunks || []) {
      const text = (c.text || '').trim();
      if (!text) continue;
      const s = a + (c.timestamp[0] ?? 0);
      const e = a + (c.timestamp[1] ?? (c.timestamp[0] ?? 0) + .3);
      words.push({ w: text, s, e: Math.max(e, s + .08) });
    }
  }
  onProgress({ phase: 'transcribe', done: duration, total: duration });
  return words;
}

// Regroupe les mots en sous-titres courts (3 mots max, coupés sur la ponctuation et les pauses).
export function chunkWords(words, maxWords = 3, maxDur = 1.6) {
  const chunks = []; let cur = null;
  for (const w of words) {
    const brk = !cur || cur.words.length >= maxWords || w.e - cur.s > maxDur || w.s - cur.e > .5 || /[.?!,;:]$/.test(cur.words[cur.words.length - 1].w);
    if (brk) { cur = { s: w.s, e: w.e, words: [] }; chunks.push(cur); }
    cur.words.push(w); cur.e = w.e;
  }
  return chunks;
}

// Remplace le texte d'un sous-titre en répartissant les nouveaux mots sur sa durée.
export function retextChunk(chunk, text) {
  const ws = text.split(/\s+/).filter(Boolean);
  const d = (chunk.e - chunk.s) / Math.max(1, ws.length);
  chunk.words = ws.map((w, i) => ({ w, s: chunk.s + i * d, e: chunk.s + (i + 1) * d }));
}

// Phrases (pour le hook et le placement des motions).
export function sentences(words) {
  const out = []; let cur = null;
  for (const w of words) {
    if (!cur || w.s - cur.e > 1) { cur = { s: w.s, e: w.e, words: [] }; out.push(cur); }
    cur.words.push(w); cur.e = w.e;
    if (/[.?!]$/.test(w.w)) cur = null;
  }
  return out.map(s => ({ ...s, text: s.words.map(w => w.w).join(' ') }));
}
