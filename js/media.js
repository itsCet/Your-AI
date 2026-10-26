// Médias ajoutés par l'utilisateur (images, PNG, vidéos) : lecture du commentaire
// pour décider où, quand et comment les montrer, puis dessin selon la mise en page.
import { PALETTES, clamp, ease, backOut, env, drawFit, pill, glowCard, label, hi, isLight, UI_BOLD, fstr } from './kit.js';

export const MEDIA_LAYOUTS = [
  { id: 'card', name: 'Carte encadrée', desc: 'Dans une carte lumineuse, fond flouté, avec étiquette' },
  { id: 'full', name: 'Plein écran', desc: 'Remplace la vidéo le temps du passage' },
  { id: 'split', name: 'Écran partagé', desc: 'Le média en haut, toi en bas' },
  { id: 'pip', name: 'Incrustation', desc: 'Petite carte inclinée dans un coin' },
  { id: 'sticker', name: 'Sticker', desc: 'Posé sur la vidéo, idéal pour un logo ou un PNG détouré' },
];
export const POSITIONS = [['tr', 'Haut droite'], ['tl', 'Haut gauche'], ['c', 'Centre'], ['bl', 'Bas gauche'], ['br', 'Bas droite']];

// Mises en page qui assombrissent et floutent la vidéo.
export const MEDIA_DIMS = new Set(['card']);

const STOP = new Set(('le la les un une des du de d l au aux et ou à a en dans sur sous pour par avec sans ce cet cette ces mon ma mes ton ta tes son sa ses ' +
  'je tu il elle on nous vous ils elles qui que quoi quand où dont est sont mets met mettre montre montrer affiche afficher image photo vidéo video png logo ' +
  'moment parle dis dit fois là ici the a an of to in on at when i say show put this that it is my your').split(' '));

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}%+ ]/gu, ' ').replace(/\s+/g, ' ').trim();

// Cherche une suite de mots dans la transcription et renvoie le temps du premier mot.
function findPhrase(words, phrase) {
  const target = norm(phrase).split(' ').filter(Boolean);
  if (!target.length) return null;
  const ws = words.map(w => norm(w.w));
  for (let i = 0; i < ws.length; i++) {
    let ok = true;
    for (let j = 0; j < target.length; j++) {
      const w = ws[i + j];
      if (!w || !(w === target[j] || (target[j].length >= 4 && w.startsWith(target[j].slice(0, -1))))) { ok = false; break; }
    }
    if (ok) return words[i].s;
  }
  return null;
}

/**
 * Interprète le commentaire d'un média. Retourne { layout, start, dur, label, pos, reason }.
 * Exemples compris :
 *   « logo à mettre quand je dis Claude »            → sticker au mot « Claude »
 *   « photo de mon pote Guillaume sur scène, plein écran » → plein écran au mot « Guillaume »
 *   « capture de l'appli en haut pendant 4 s à 0:12 »  → écran partagé à 12 s, 4 s
 *   « à la fin », « au début », « en bas à gauche », « petit dans le coin »
 */
export function interpretMedia(item, words, duration, index = 0, count = 1) {
  const c = (item.comment || '').trim();
  const n = norm(c);
  const out = { reason: [] };

  // Mise en page
  if (/plein ecran|fullscreen|full screen|tout l ecran|en grand/.test(n)) out.layout = 'full';
  else if (/logo|icone|sticker|autocollant|emoji|detour/.test(n)) out.layout = 'sticker';
  else if (/en haut|moitie|split|ecran partage|au dessus|capture|screenshot|interface|appli|site|ecran de/.test(n)) out.layout = 'split';
  else if (/petit|coin|miniature|incrust|pip/.test(n)) out.layout = 'pip';
  else if (/carte|encadre|cadre|b ?roll|rec/.test(n)) out.layout = 'card';
  out.explicitLayout = !!out.layout;
  if (!out.layout) out.layout = item.alpha ? 'sticker' : 'card';
  out.reason.push(MEDIA_LAYOUTS.find(l => l.id === out.layout).name.toLowerCase() + (out.explicitLayout ? '' : ' (par défaut)'));

  // Position (stickers et incrustations)
  out.pos = /gauche/.test(n) ? (/bas/.test(n) ? 'bl' : 'tl') : /droite/.test(n) ? (/bas/.test(n) ? 'br' : 'tr') : /centre|milieu/.test(n) ? 'c' : /en bas/.test(n) ? 'br' : 'tr';

  // Durée (« pendant 4 s ») et moment explicite (« à 0:12 », « à 12 s »)
  const lc = c.toLowerCase();
  const d = lc.match(/(?:pendant|durant)\s+(\d+(?:[.,]\d+)?)\s*(?:s|sec|secondes)?\b/);
  out.dur = d ? clamp(parseFloat(d[1].replace(',', '.')), .5, 15) : { sticker: 2.4, pip: 3, split: 3.2, full: 2.4, card: 3 }[out.layout];
  let start = null;
  const mmss = lc.match(/(?:à|a|at)\s+(\d+):(\d{1,2})/);
  const secs = lc.match(/(?:à|a|at)\s+(\d+(?:[.,]\d+)?)\s*(?:s|sec|secondes)\b/);
  const quoted = c.match(/[«"“]\s*([^»"”]{2,60}?)\s*[»"”]/);
  const says = n.match(/(?:quand|lorsque|au moment ou|des que) (?:je|j|on) (?:dis|parle(?: de| du| des)?|mentionne|prononce|dit) (.+?)(?: en | pendant | a \d|$)/);
  if (mmss) { start = +mmss[1] * 60 + +mmss[2]; out.reason.push(`à ${mmss[1]}:${mmss[2].padStart(2, '0')}`); }
  else if (secs) { start = parseFloat(secs[1].replace(',', '.')); out.reason.push(`à ${start} s`); }
  if (start == null && quoted && words.length) { const t = findPhrase(words, quoted[1]); if (t != null) { start = t; out.reason.push(`quand tu dis « ${quoted[1]} »`); } }
  if (start == null && says && words.length) {
    const phrase = says[1].split(' ').filter(w => !STOP.has(w)).slice(0, 3).join(' ');
    const t = phrase && findPhrase(words, phrase);
    if (t != null) { start = t; out.reason.push(`quand tu dis « ${phrase} »`); }
  }
  if (start == null && /au debut|intro|des le debut|en premier/.test(n)) { start = .2; out.reason.push('au début'); }
  if (start == null && /a la fin|fin de la video|outro|en dernier|pour finir/.test(n)) { start = Math.max(0, duration - out.dur - .3); out.reason.push('à la fin'); }
  if (start == null && words.length) {
    // Sinon : premier mot significatif du commentaire entendu dans la vidéo.
    // Noms propres (majuscule dans le commentaire) d'abord, puis les mots les plus longs.
    const proper = new Set((c.match(/(?<![.!?]\s)(?<!^)\b\p{Lu}[\p{L}-]+/gu) || []).map(norm));
    const keys = n.split(' ').filter(w => w.length >= 4 && !STOP.has(w)).sort((a, b) => (proper.has(b) - proper.has(a)) || b.length - a.length);
    for (const k of keys) {
      const t = findPhrase(words, k);
      if (t != null) { start = t; out.reason.push(`quand tu dis « ${k} »`); break; }
    }
  }
  if (start == null) { start = duration * (index + 1) / (count + 1); out.reason.push('réparti dans la vidéo'); }
  out.start = +clamp(start - .1, 0, Math.max(0, duration - .5)).toFixed(2);

  // Étiquette : le commentaire sans les consignes de placement.
  const RM = ['en plein écran', 'plein écran', 'en grand', 'en haut', 'en bas', 'à gauche', 'à droite', 'au centre', 'au milieu', 'dans le coin',
    'en petit', 'petit', 'à la fin', 'au début', 'pendant \\d+(?:[.,]\\d+)?\\s*(?:s|sec|secondes)?', 'à \\d+:\\d+', 'à \\d+(?:[.,]\\d+)?\\s*(?:s|sec|secondes)'];
  let lab = c.replace(/[«"“][^»"”]*[»"”]/g, ' ').replace(/(?:^|\s)(?:quand|lorsque|au moment où|dès que)\s.*$/i, ' ');
  for (const r of RM) lab = lab.replace(new RegExp(`(^|[\\s,])${r}(?=[\\s,.;]|$)`, 'gi'), ' ');
  out.label = lab
    .replace(/^\s*(?:c'est |voici |ça c'est |mets |met |montre |affiche )/i, '')
    .replace(/^\s*(?:la |le |une |un |l')?(?:photo|image|vidéo|video|capture|logo|png|b-roll)\s*(?:de |d'|du |des )?/i, '')
    .replace(/\s+/g, ' ').replace(/^[\s,.;:]+|[\s,.;:]+$/g, '').trim().slice(0, 40);
  return out;
}

const corner = (pos, W, H, w, h) => {
  const m = W * .06;
  const x = pos[1] === 'l' ? m : pos[1] === 'r' ? W - w - m : (W - w) / 2;
  const y = pos[0] === 't' ? H * .1 : pos[0] === 'b' ? H * .62 - h : (H - h) / 2;
  return pos === 'c' ? [(W - w) / 2, (H - h) / 2] : [x, y];
};

// Garde la vidéo d'un média synchronisée sur le temps local du passage.
export function syncMediaVideo(item, lt, active) {
  const el = item.el;
  if (!(el instanceof HTMLVideoElement)) return;
  if (!active) { if (!el.paused) el.pause(); return; }
  if (el.paused) el.play().catch(() => {});
  const target = lt % (el.duration || Infinity);
  if (Math.abs(el.currentTime - target) > .3) el.currentTime = target;
}

export function drawMedia(ctx, W, H, item, lt, o) {
  const P = PALETTES[o.pal], A = hi(P);
  const p = lt / item.dur, e = env(p, .12, .12);
  const el = item.el;
  ctx.save();
  switch (item.layout) {
    case 'full': {
      ctx.globalAlpha = env(p, .06, .08);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const z = 1.06 - .06 * ease(p);
      drawFit(ctx, el, 0, 0, W, H, { mode: 'cover', zoom: z });
      if (item.label) pill(ctx, W / 2, H * .08, item.label, { size: W * .022, dot: A, align: 'center' });
      break;
    }
    case 'card': {
      const w = W * .76, h = H * .5, x = (W - w) / 2, y = H * .07;
      const k = .88 + .12 * backOut(p / .16);
      ctx.globalAlpha = e;
      ctx.translate(W / 2, y + h / 2); ctx.scale(k, k); ctx.translate(-W / 2, -(y + h / 2));
      glowCard(ctx, x, y, w, h, P);
      const pad = w * .025;
      drawFit(ctx, el, x + pad, y + pad, w - 2 * pad, h - 2 * pad, { mode: 'cover', r: w * .035, zoom: 1 + .05 * p });
      ctx.fillStyle = '#FF3B30'; ctx.beginPath(); ctx.arc(x + w * .08, y + w * .075, w * .012, 0, 7); ctx.fill();
      ctx.font = fstr(UI_BOLD, w * .028); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('REC', x + w * .105, y + w * .077);
      if (item.label) pill(ctx, W / 2, y + h - w * .07, item.label, { size: W * .021, bg: A, fg: isLight(A) ? P.ink : '#fff', dot: isLight(A) ? P.ink : '#fff', align: 'center', border: null });
      break;
    }
    case 'split': {
      const h = H * .47, slide = ease(p / .14) * ease((1 - p) / .12);
      ctx.translate(0, -(1 - slide) * h);
      ctx.fillStyle = P.panel || '#161616'; ctx.fillRect(0, 0, W, h);
      ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = W * .04;
      const pad = W * .07;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(pad, pad, W - 2 * pad, h - 2 * pad, W * .025); ctx.fill();
      ctx.shadowBlur = 0;
      drawFit(ctx, el, pad, pad, W - 2 * pad, h - 2 * pad, { mode: 'contain', r: W * .025 });
      if (item.label) label(ctx, W / 2, h - pad / 2, item.label, W * .02, isLight(P.panel || '#000') ? '#555' : 'rgba(255,255,255,.7)');
      break;
    }
    case 'pip': {
      const w = W * .33, h = w * 1.4;
      const [x, y] = corner(item.pos || 'tr', W, H, w, h + w * .14);
      const k = backOut(p / .15), bob = Math.sin(lt * 2) * W * .004;
      ctx.globalAlpha = ease((1 - p) / .1);
      ctx.translate(x + w / 2, y + h / 2 + bob); ctx.rotate(.04); ctx.scale(k, k);
      ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = W * .04;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h + w * .14, w * .05); ctx.fill();
      ctx.shadowBlur = 0;
      drawFit(ctx, el, -w / 2 + w * .03, -h / 2 + w * .03, w * .94, h - w * .03, { mode: 'cover', r: w * .035 });
      ctx.fillStyle = '#111'; ctx.font = fstr(UI_BOLD, w * .07); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((item.label || item.name || '').slice(0, 22), 0, h / 2 + w * .065);
      break;
    }
    case 'sticker':
    default: {
      const s = W * (item.pos === 'c' ? .5 : .32);
      const [x, y] = corner(item.pos || 'tr', W, H, s, s);
      const k = backOut(p / .15);
      ctx.globalAlpha = ease((1 - p) / .1);
      ctx.translate(x + s / 2, y + s / 2); ctx.rotate(-.08 + Math.sin(lt * 2.4) * .02); ctx.scale(k, k);
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = W * .03; ctx.shadowOffsetY = W * .01;
      drawFit(ctx, el, -s / 2, -s / 2, s, s, { mode: 'contain' });
      break;
    }
  }
  ctx.restore();
}

// Détecte si une image a de la transparence (PNG détouré → sticker par défaut).
export function hasAlpha(img) {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, 32, 32);
    const d = g.getImageData(0, 0, 32, 32).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
  } catch { /* image d'une autre origine */ }
  return false;
}
