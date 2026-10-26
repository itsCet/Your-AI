// Effets sonores synthétisés (aucun fichier) : pop, clic, frappe, whoosh, impact, ding.
// Ils passent par le même AudioContext que la vidéo, donc ils sont aussi dans l'export.

export const SFX = [['', 'Aucun'], ['pop', 'Pop'], ['click', 'Clic'], ['type', 'Frappe'], ['whoosh', 'Whoosh'], ['bam', 'Impact'], ['ding', 'Ding']];

// Son par défaut de chaque élément.
export const DEFAULT_SFX = {
  note: 'pop', colorcard: 'whoosh', stamp: 'bam', statcard: 'whoosh', checklist: 'click', versus: 'whoosh', emoji: 'pop',
  screen: 'whoosh', lower: 'whoosh', orbit: 'whoosh', carousel: 'whoosh', shrink: 'whoosh', comment: 'pop',
  wordreveal: 'pop', counter: 'click', kinetic: 'type', beat: 'bam', zoom: 'whoosh', spotlight: '', media: 'pop', title: 'whoosh',
};

// Liste des sons d'un élément, en secondes depuis son début (certains sons se répètent).
export function sfxEvents(item) {
  const kind = item.sfx ?? DEFAULT_SFX[item.type] ?? '';
  if (!kind) return [];
  const f = item.f || {};
  const count = s => String(s || '').split(/\s+/).filter(Boolean).length;
  const repeat = (n, span, from = 0) => Array.from({ length: n }, (_, i) => ({ t: from + i * span / n, kind }));
  switch (item.type) {
    case 'beat': return repeat(Math.max(1, count(f.words)), item.dur);
    case 'kinetic': return item.times?.length ? item.times.map(t => ({ t: t + .15, kind })) : repeat(Math.min(10, Math.max(1, count(f.text))), item.dur * .55, .15);
    case 'checklist': {
      // Un clic par ligne cochée, au moment où elle apparaît.
      if (item.times?.length) return item.times.map(t => ({ t: t + .15, kind }));
      const n = Math.max(1, (Array.isArray(f.items) ? f.items : String(f.items || '').split('\n')).filter(Boolean).length);
      return Array.from({ length: n }, (_, i) => ({ t: .5 + i * Math.min(.6, (item.dur - 1) / n), kind }));
    }
    case 'versus': return [{ t: 0, kind }, { t: (item.turn ?? item.dur * .38) + .2, kind: 'ding' }];
    default: return [{ t: 0, kind }];
  }
}

let noiseBuf = null;
function noise(ac) {
  if (!noiseBuf || noiseBuf.sampleRate !== ac.sampleRate) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ac.createBufferSource(); s.buffer = noiseBuf; return s;
}
function env(ac, out, at, peak, attack, decay) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  g.connect(out);
  return g;
}

export function playSfx(ac, out, kind, volume = .6) {
  const t = ac.currentTime + .005, v = volume;
  if (kind === 'pop') {
    const o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(500, t); o.frequency.exponentialRampToValueAtTime(1300, t + .06);
    o.connect(env(ac, out, t, .5 * v, .005, .09)); o.start(t); o.stop(t + .12);
  } else if (kind === 'click' || kind === 'type') {
    const n = noise(ac), f = ac.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = kind === 'type' ? 2500 + Math.random() * 1500 : 3500; f.Q.value = 1.5;
    n.connect(f); f.connect(env(ac, out, t, (kind === 'type' ? .35 : .5) * v, .002, .03)); n.start(t); n.stop(t + .06);
  } else if (kind === 'whoosh') {
    const n = noise(ac), f = ac.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = .8;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3000, t + .25); f.frequency.exponentialRampToValueAtTime(800, t + .4);
    n.connect(f); f.connect(env(ac, out, t, .35 * v, .15, .25)); n.start(t); n.stop(t + .45);
  } else if (kind === 'bam') {
    const o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(38, t + .3);
    o.connect(env(ac, out, t, .9 * v, .004, .35)); o.start(t); o.stop(t + .4);
    const n = noise(ac), f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    n.connect(f); f.connect(env(ac, out, t, .4 * v, .002, .12)); n.start(t); n.stop(t + .15);
  } else if (kind === 'ding') {
    for (const [fq, a] of [[1320, .25], [1980, .12]]) {
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = fq;
      o.connect(env(ac, out, t, a * v, .005, .7)); o.start(t); o.stop(t + .75);
    }
  }
}
