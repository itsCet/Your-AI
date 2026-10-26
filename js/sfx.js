// Effets sonores synthétisés (aucun fichier) : pop, clic, frappe, whoosh, impact, ding.
// Ils passent par le même AudioContext que la vidéo, donc ils sont aussi dans l'export.

export const SFX = [['', 'Aucun'], ['pop', 'Pop'], ['click', 'Clic'], ['type', 'Frappe'], ['whoosh', 'Whoosh'], ['bam', 'Impact'], ['ding', 'Ding']];

// Son par défaut de chaque motion.
export const DEFAULT_SFX = {
  statcard: 'whoosh', checklist: 'click', progress: 'whoosh', grid: 'ding', counter: 'click', lower: 'whoosh', comment: 'pop',
  name: 'whoosh', prompt: 'type', stamp: 'bam', note: 'pop', colorcard: 'pop', numbers: 'pop', typing: 'pop', words: 'pop',
  beat: 'bam', countdown: 'click', kinetic: 'type', bigword: 'whoosh', spotlight: '', recframe: 'click', focus: 'click',
  emoji: 'pop', versus: 'whoosh', zoom: 'whoosh', orbit: 'whoosh', carousel: 'whoosh', shrink: 'whoosh', media: 'pop', title: 'whoosh',
};

// Liste des sons d'un élément, en secondes depuis son début (certains sons se répètent).
export function sfxEvents(item) {
  const kind = item.sfx ?? DEFAULT_SFX[item.type] ?? '';
  if (!kind) return [];
  const words = String(item.text || '').split(/\s+/).filter(Boolean);
  const repeat = (n, span) => Array.from({ length: n }, (_, i) => ({ t: i * span / n, kind }));
  switch (item.type) {
    case 'beat': case 'words': return repeat(Math.max(1, words.length), item.dur);
    case 'kinetic': return repeat(Math.max(1, words.length), item.dur * .7);
    case 'countdown': return repeat(Math.max(1, parseInt(item.text, 10) || 3), item.dur);
    case 'numbers': return repeat(Math.max(1, parseInt(item.text, 10) || 3), item.dur * .5);
    case 'checklist': {
      // Un clic par ligne cochée, au moment où elle apparaît.
      if (item.times?.length) return item.times.map(t => ({ t, kind }));
      const n = Math.max(1, String(item.text).split('|').length - 1);
      return Array.from({ length: n }, (_, i) => ({ t: item.dur * (.1 + i * .6 / n), kind }));
    }
    case 'prompt': return repeat(Math.min(14, Math.max(1, String(item.text).length)), item.dur * .55).map(e => ({ ...e, t: e.t + item.dur * .08 }));
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
