// Effet « texte derrière toi » côté navigateur : récupère la vidéo de masque calculée par
// serve.py (depth.py), la garde synchronisée avec la vidéo, et la transforme en calque
// de transparence (blanc = personne opaque) utilisé par render() pour redessiner la
// personne par-dessus le texte.

export const depth = {
  status: 'idle', // idle | uploading | running | done | error
  done: 0, total: 0, engine: '', error: '', log: '',
  mask: null,     // <video> du masque
  alpha: null,    // <canvas> : la personne en alpha, à la résolution du masque
  ready: false,
};

let jobFor = null, lastMaskTime = -1;

export async function startMatting(file, engine = 'auto', onUpdate = () => {}) {
  if (!file) return;
  if (jobFor === file && (depth.status === 'running' || depth.status === 'done' || depth.status === 'uploading')) return;
  jobFor = file;
  Object.assign(depth, { status: 'uploading', done: 0, total: 0, error: '', ready: false, engine });
  onUpdate();
  try {
    const r = await fetch(`/matte?engine=${encodeURIComponent(engine)}`, { method: 'POST', body: file });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.id) throw new Error(j.error || `le serveur a répondu ${r.status} (lance l'app avec « python3 serve.py »)`);
    depth.status = 'running'; onUpdate();
    for (;;) {
      await new Promise(res => setTimeout(res, 600));
      if (jobFor !== file) return; // une autre vidéo a été chargée entre-temps
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
    depth.mask = v; lastMaskTime = -1;
    Object.assign(depth, { status: 'done', ready: true });
  } catch (e) {
    Object.assign(depth, { status: 'error', error: e.message, ready: false });
  }
  onUpdate();
}

export function resetMatting() {
  jobFor = null;
  if (depth.mask) depth.mask.pause();
  Object.assign(depth, { status: 'idle', done: 0, total: 0, error: '', ready: false, mask: null, alpha: null });
}

// À appeler une fois par image (aperçu et export) : cale le masque sur la vidéo
// principale puis convertit sa luminance en transparence.
export function updateDepth(video) {
  const m = depth.mask;
  if (!depth.ready || !m) return;
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
