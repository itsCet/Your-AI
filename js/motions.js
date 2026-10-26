// Bibliothèque de motions (animations posées sur la vidéo).
// Le texte d'une motion peut contenir plusieurs champs séparés par « | » (voir `hint`).
import {
  PALETTES, fontOf, fstr, clamp, ease, backOut, env, fitSize, wrap, drawVideoRect,
  pill, glowCard, label, brackets, hi, isLight, warmBg, SERIF, UI, UI_BOLD, HAND,
} from './kit.js';

export const CATEGORIES = [
  { id: 'infos', name: 'Infos' },
  { id: 'stickers', name: 'Stickers' },
  { id: 'plein', name: 'Plein écran' },
  { id: 'mouvement', name: 'Mouvement' },
];

export const MOTIONS = [
  // Infos : cartes et données, inspirées des montages « storytelling ».
  { id: 'statcard', cat: 'infos', name: 'Carte chiffre', desc: 'Grosse carte lumineuse, le chiffre monte', dur: 3,
    text: 'Le chiffre|100+|au total', hint: 'Titre | chiffre | étiquettes séparées par ·' },
  { id: 'checklist', cat: 'infos', name: 'Checklist', desc: 'Une liste qui se coche ligne par ligne', dur: 3.6,
    text: 'Les étapes|Première idée|Deuxième idée|Troisième idée', hint: 'Titre | ligne 1 | ligne 2 | …' },
  { id: 'versus', cat: 'infos', name: 'Avant / Après', desc: 'Ce qu\'il ne faut pas faire, barré, puis la bonne option', dur: 3.2,
    text: 'Ce qu\'on croit|Ce qui marche', hint: 'À éviter | à faire' },
  { id: 'progress', cat: 'infos', name: 'Jauge', desc: 'Une barre qui monte ou s\'effondre', dur: 2.8,
    text: 'Crédibilité|100|13', hint: 'Libellé | départ % | arrivée %' },
  { id: 'grid', cat: 'infos', name: 'Un parmi tous', desc: 'Une case allumée dans une foule de cases', dur: 3,
    text: 'Parmi tous|un seul', hint: 'Titre | étiquette du bas' },
  { id: 'counter', cat: 'infos', name: 'Compteur', desc: 'Un chiffre qui monte', dur: 2.4, text: '10000 vues', hint: 'Texte avec un nombre' },
  { id: 'lower', cat: 'infos', name: 'Lower third', desc: 'Bandeau nom qui glisse', dur: 3, text: 'Ton Nom · Créateur', hint: 'Nom · rôle' },
  { id: 'comment', cat: 'infos', name: 'Comment pop-up', desc: 'Une bulle de commentaire apparaît', dur: 2.6, text: 'Love this, tell me more!' },
  { id: 'name', cat: 'infos', name: 'Nom, dessiné', desc: 'Ton nom s\'écrit en haut, ton rôle dessous', dur: 3, text: 'Ton Nom|Créateur de contenu', hint: 'Nom | rôle' },
  { id: 'prompt', cat: 'infos', name: 'Texte tapé', desc: 'Une phrase se tape avec un curseur', dur: 3, text: 'Monte-moi ce reel.' },
  // Stickers : petits éléments posés près du visage.
  { id: 'emoji', cat: 'stickers', name: 'Illustration', desc: 'Un emoji qui illustre le mot que tu dis', dur: 2.2, text: '💡|Idée', hint: 'Emoji | mot' },
  { id: 'stamp', cat: 'stickers', name: 'Tampon', desc: 'Un mot tamponné de travers', dur: 2, text: 'Important' },
  { id: 'note', cat: 'stickers', name: 'Note manuscrite', desc: 'Une note écrite à la main près de l\'épaule', dur: 2.6, text: 'à retenir' },
  { id: 'colorcard', cat: 'stickers', name: 'Carte couleur', desc: 'Une carte pleine couleur avec quelques mots', dur: 2.4, text: 'mot clé' },
  { id: 'numbers', cat: 'stickers', name: 'Étapes 1 2 3', desc: 'Des numéros qui apparaissent un par un', dur: 3, text: '3', hint: 'Nombre d\'étapes' },
  { id: 'typing', cat: 'stickers', name: 'En train d\'écrire', desc: 'La bulle « … » qui attend une réponse', dur: 1.8 },
  { id: 'words', cat: 'stickers', name: 'Word pop', desc: 'Les mots claquent un par un', dur: 2.4, text: 'Film once post all week' },
  // Plein écran : cartes de coupe sur fond chaud granuleux.
  { id: 'beat', cat: 'plein', name: 'Beat cuts', desc: 'Des mots plein écran qui claquent sur le rythme', dur: 1.8, text: 'UN DEUX TROIS', hint: 'Mots séparés par des espaces' },
  { id: 'countdown', cat: 'plein', name: 'Compte à rebours', desc: '3, 2, 1 en plein écran', dur: 2.4, text: '3' },
  { id: 'kinetic', cat: 'plein', name: 'Phrase cinétique', desc: 'La phrase se construit mot par mot, plein écran', dur: 3, text: 'Ta phrase forte ici.' },
  { id: 'bigword', cat: 'plein', name: 'Un mot, plein écran', desc: 'Un seul mot en serif italique sur fond chaud', dur: 1.6, text: 'mot' },
  // Mouvement : animations de cadre.
  { id: 'spotlight', cat: 'mouvement', name: 'Spotlight', desc: 'Tout s\'assombrit sauf toi', dur: 2.4 },
  { id: 'recframe', cat: 'mouvement', name: 'Viseur REC', desc: 'Cadre caméra avec REC et timecode', dur: 3 },
  { id: 'focus', cat: 'mouvement', name: 'Mise au point', desc: 'Des coins se resserrent sur ton visage', dur: 1.6 },
  { id: 'zoom', cat: 'mouvement', name: 'Punch-in', desc: 'Zoom rapide sur ton visage', dur: 1.6 },
  { id: 'orbit', cat: 'mouvement', name: 'Orbit', desc: 'Des photos tournent autour de toi', dur: 3 },
  { id: 'carousel', cat: 'mouvement', name: 'Carousel', desc: 'Des cartes défilent en ligne', dur: 3 },
  { id: 'shrink', cat: 'mouvement', name: 'Shrink card', desc: 'La vidéo rétrécit sur une carte couleur', dur: 3, text: 'True dreams' },
];
export const M = Object.fromEntries(MOTIONS.map(m => [m.id, m]));

// Motions qui assombrissent et floutent la vidéo derrière elles.
export const DIMS = new Set(['statcard', 'grid']);
// Motions qui occupent le centre : les sous-titres se masquent pendant ce temps.
export const HIDES_CAPTIONS = new Set(['words', 'counter', 'shrink', 'colorcard', 'beat', 'countdown', 'kinetic', 'bigword']);
// Motions qui recouvrent toute la vidéo.
export const FULLSCREEN = new Set(['beat', 'countdown', 'kinetic', 'bigword']);

const fields = (text, n) => { const f = String(text ?? '').split('|').map(s => s.trim()); while (f.length < n) f.push(''); return f; };

function photoCard(ctx, cx, cy, w, h, rot, color, photo) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = w * .15; ctx.shadowOffsetY = w * .05;
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, w * .07); ctx.fill();
  ctx.shadowColor = 'transparent';
  if (photo) { const pad = w * .08; drawVideoRect(ctx, -w / 2 + pad, -h / 2 + pad, w - pad * 2, h - pad * 3.2, w * .04, 1.8, .3); }
  ctx.restore();
}

// Remplace le premier nombre d'un texte par sa valeur animée (« 40+ » compte de 0 à 40).
function countUp(text, k) {
  const m = String(text).match(/\d+/);
  if (!m) return text;
  const val = Math.round(+m[0] * k).toLocaleString('fr-FR').replace(/[  ]/g, ' ');
  return text.replace(/\d+/, val);
}

export function drawMotion(ctx, W, H, m, lt, o) {
  const F = fontOf(o.font), P = PALETTES[o.pal], A = hi(P);
  const p = lt / m.dur, v = m.variant || 0;
  const [c1, c2] = v % 2 ? [P.accent, P.text] : [P.text, P.accent];
  const dir = v % 3 === 2 ? -1 : 1;
  const text = m.text ?? M[m.type].text ?? '';
  const e = env(p, .12, .12);
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  switch (m.type) {
    case 'statcard': {
      const [title, value, chips] = fields(text, 3);
      const w = W * .74, h = H * .4, x = (W - w) / 2, y = H * .08;
      const sc = .85 + .15 * backOut(p / .16);
      ctx.globalAlpha = e;
      ctx.translate(W / 2, y + h / 2); ctx.scale(sc, sc); ctx.translate(-W / 2, -(y + h / 2));
      glowCard(ctx, x, y, w, h, P);
      label(ctx, W / 2, y + h * .1, title, W * .022);
      const str = countUp(value || '0', ease((p - .08) / .5));
      const fs = fitSize(ctx, str, UI_BOLD, w * .82, W * .24);
      ctx.font = fstr(UI_BOLD, fs); ctx.fillStyle = '#fff';
      ctx.shadowColor = A; ctx.shadowBlur = W * .03;
      ctx.fillText(str, W / 2, y + h * .36);
      ctx.shadowBlur = 0;
      const list = chips.split('·').map(s => s.trim()).filter(Boolean);
      if (list.length) {
        ctx.font = fstr(UI_BOLD, W * .02);
        const widths = list.map((c, i) => ctx.measureText(c.toUpperCase()).width + W * .02 * (i ? 2.5 : 1.6) + W * .006 * c.length);
        let cx = W / 2 - (widths.reduce((a, b) => a + b, 0) + (list.length - 1) * W * .015) / 2;
        list.forEach((c, i) => {
          ctx.globalAlpha = e * ease((p - .3 - i * .08) / .12);
          cx += pill(ctx, cx, y + h * .58, c, { size: W * .02, dot: i ? A : null }) + W * .015;
        });
      }
      break;
    }
    case 'checklist': {
      const [title, ...items] = fields(text, 2);
      const rows = items.filter(Boolean);
      const fs = W * .026, rh = fs * 2.1, w = W * .56, x = W * .05, y = H * .05;
      const h = fs * 2.6 + rows.length * rh;
      ctx.globalAlpha = e;
      ctx.fillStyle = 'rgba(14,14,14,.88)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, fs * .7); ctx.fill();
      label(ctx, x + fs, y + fs * 1.3, title, fs * .62, 'rgba(255,255,255,.6)', 'left');
      rows.forEach((r, i) => {
        const at = m.times?.[i] != null ? m.times[i] / m.dur : .1 + i * (.6 / rows.length);
        const k = ease((p - at) / .08);
        if (k <= 0) return;
        const ry = y + fs * 2.6 + i * rh + rh / 2;
        ctx.globalAlpha = e * k;
        ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + fs, ry - rh / 2); ctx.lineTo(x + w - fs, ry - rh / 2); ctx.stroke();
        ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = fstr(UI_BOLD, fs * .7);
        ctx.fillText(String(i + 1).padStart(2, '0'), x + fs, ry);
        ctx.fillStyle = '#fff'; ctx.font = fstr(UI_BOLD, fs * .8); ctx.letterSpacing = `${fs * .05}px`;
        ctx.fillText(r.toUpperCase(), x + fs * 2.6, ry); ctx.letterSpacing = '0px';
        const cx = x + w - fs * 1.6, cr = fs * .6 * backOut(k);
        ctx.fillStyle = A; ctx.beginPath(); ctx.arc(cx, ry, cr, 0, 7); ctx.fill();
        ctx.strokeStyle = P.ink; ctx.lineWidth = fs * .15; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx - cr * .45, ry); ctx.lineTo(cx - cr * .1, ry + cr * .35); ctx.lineTo(cx + cr * .45, ry - cr * .35); ctx.stroke();
      });
      break;
    }
    case 'progress': {
      const [lab, a, b] = fields(text, 3);
      const from = clamp((+a || 100) / 100), to = clamp((+b || 0) / 100);
      const k = from + (to - from) * ease((p - .25) / .45);
      const w = W * .62, fs = W * .026, h = fs * 3.4, x = (W - w) / 2, y = H * .07;
      ctx.globalAlpha = e;
      ctx.fillStyle = 'rgba(14,14,14,.88)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, fs * .7); ctx.fill();
      label(ctx, x + fs, y + fs * 1.1, lab, fs * .7, '#fff', 'left');
      ctx.textAlign = 'right'; ctx.font = fstr(UI_BOLD, fs * .8); ctx.fillStyle = A;
      ctx.fillText(Math.round(k * 100) + '%', x + w - fs, y + fs * 1.1);
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.roundRect(x + fs, y + fs * 2.2, w - fs * 2, fs * .55, fs * .3); ctx.fill();
      ctx.fillStyle = k < .3 ? '#FF5A4F' : A; ctx.beginPath(); ctx.roundRect(x + fs, y + fs * 2.2, Math.max(fs * .55, (w - fs * 2) * k), fs * .55, fs * .3); ctx.fill();
      break;
    }
    case 'grid': {
      const [title, foot] = fields(text, 2);
      const w = W * .74, h = H * .4, x = (W - w) / 2, y = H * .08;
      ctx.globalAlpha = e;
      glowCard(ctx, x, y, w, h, P);
      label(ctx, W / 2, y + h * .08, title, W * .022);
      const cols = 10, rows = 8, gap = w * .012, cw = (w * .82 - gap * (cols - 1)) / cols;
      const gx = x + w * .09, gy = y + h * .16;
      const pink = P.name === 'Bubblegum' ? '#FFD60A' : '#FF4FA3';
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const on = r === 4 && c === 6;
        const k = ease((p - (r + c) * .008) / .15);
        ctx.globalAlpha = e * k;
        ctx.fillStyle = on && p > .35 ? pink : 'rgba(255,255,255,.16)';
        if (on && p > .35) { ctx.shadowColor = pink; ctx.shadowBlur = cw * (1 + .5 * Math.sin(lt * 8)); }
        ctx.beginPath(); ctx.roundRect(gx + c * (cw + gap), gy + r * (cw + gap), cw, cw, cw * .2); ctx.fill();
        ctx.shadowBlur = 0;
      }
      if (foot) { ctx.globalAlpha = e * ease((p - .45) / .12); pill(ctx, W / 2, y + h * .9, foot, { size: W * .02, dot: pink, align: 'center' }); }
      break;
    }
    case 'recframe': {
      const pad = W * .06, k = backOut(p / .15);
      const x = pad / k, y = H * .05 / k, w = W - 2 * x, h = H * .66 - y;
      ctx.globalAlpha = e;
      brackets(ctx, x, y, w, h, W * .08, '#fff', W * .006);
      if (Math.floor(lt * 2) % 2 === 0) { ctx.fillStyle = '#FF3B30'; ctx.beginPath(); ctx.arc(x + W * .04, y + W * .045, W * .012, 0, 7); ctx.fill(); }
      ctx.font = fstr(UI_BOLD, W * .026); ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
      ctx.fillText('REC', x + W * .065, y + W * .047);
      const s = Math.floor(lt + (m.start || 0));
      ctx.textAlign = 'right'; ctx.font = fstr({ family: 'Space Mono', weight: 700 }, W * .024);
      ctx.fillText(`00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`, x + w - W * .03, y + W * .047);
      if (text) pill(ctx, W / 2, y + W * .047, text, { size: W * .02, align: 'center' });
      break;
    }
    case 'focus': {
      const k = ease(p / .25), s = W * (.7 - .2 * k);
      ctx.globalAlpha = env(p, .1, .2);
      brackets(ctx, W / 2 - s / 2, H * .34 - s / 2, s, s, s * .18, A, W * .008);
      break;
    }
    case 'stamp': {
      const k = clamp(p / .1), sc = 2.2 - 1.2 * ease(k);
      const shake = p > .1 && p < .18 ? Math.sin(lt * 90) * W * .004 : 0;
      ctx.globalAlpha = Math.min(k * 2, ease((1 - p) / .1));
      ctx.translate(W * .72 + shake, H * .3); ctx.rotate(-.14 + (v % 2) * .26); ctx.scale(sc, sc);
      const fs = fitSize(ctx, text.toUpperCase(), UI_BOLD, W * .4, W * .055);
      ctx.font = fstr(UI_BOLD, fs);
      const tw = ctx.measureText(text.toUpperCase()).width + fs * .9, th = fs * 1.6;
      const light = v % 2 === 1;
      ctx.fillStyle = light ? '#fff' : A; ctx.fillRect(-tw / 2, -th / 2, tw, th);
      ctx.strokeStyle = P.ink; ctx.lineWidth = fs * .12; ctx.strokeRect(-tw / 2 + fs * .15, -th / 2 + fs * .15, tw - fs * .3, th - fs * .3);
      ctx.fillStyle = P.ink; ctx.fillText(text.toUpperCase(), 0, fs * .06);
      break;
    }
    case 'note': {
      const r = W * .13, k = backOut(p / .18);
      ctx.globalAlpha = ease((1 - p) / .12);
      ctx.translate(v % 2 ? W * .27 : W * .73, H * .43); ctx.rotate(-.12); ctx.scale(k, k);
      ctx.fillStyle = 'rgba(70,70,70,.88)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = W * .004; ctx.beginPath(); ctx.arc(0, 0, r * .9, 0, 7); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = fstr(HAND, r * .38);
      const lines = wrap(ctx, text, r * 1.5).slice(0, 3);
      const n = Math.ceil(lines.join(' ').length * clamp((p - .1) / .4));
      let left = n;
      lines.forEach((l, i) => { const s = l.slice(0, Math.max(0, left)); left -= l.length + 1; ctx.fillText(s, 0, (i - (lines.length - 1) / 2) * r * .4); });
      break;
    }
    case 'colorcard': {
      const s = W * .56, k = backOut(p / .16);
      ctx.globalAlpha = ease((1 - p) / .12);
      ctx.translate(W / 2, H * .47); ctx.rotate((v % 2 ? 1 : -1) * .03); ctx.scale(k, k);
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = W * .05;
      ctx.fillStyle = A; ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.shadowBlur = 0; ctx.fillStyle = isLight(A) ? P.ink : '#fff';
      ctx.font = fstr(SERIF, s * .16);
      const lines = wrap(ctx, text, s * .8).slice(0, 3);
      lines.forEach((l, i) => ctx.fillText(l, 0, (i - (lines.length - 1) / 2) * s * .18));
      break;
    }
    case 'numbers': {
      const n = clamp(parseInt(text, 10) || 3, 1, 6), size = W * .1;
      for (let i = 0; i < n; i++) {
        const k = backOut((p - i * (.5 / n)) / .12);
        if (k <= 0) continue;
        ctx.save();
        ctx.globalAlpha = ease((1 - p) / .1);
        ctx.translate(v % 2 ? W * .14 : W * .86, H * .28 + i * size * 1.25); ctx.rotate((i % 2 ? 1 : -1) * .05); ctx.scale(k, k);
        ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = size * .3;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(-size / 2, -size / 2, size, size, size * .14); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = '#111'; ctx.font = fstr(UI_BOLD, size * .66); ctx.fillText(String(i + 1), 0, size * .04);
        ctx.restore();
      }
      break;
    }
    case 'typing': {
      const w = W * .2, h = W * .09, k = backOut(p / .15);
      ctx.globalAlpha = ease((1 - p) / .12);
      ctx.translate(W / 2, H * .25); ctx.scale(k, k);
      ctx.fillStyle = 'rgba(30,30,30,.92)'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fill();
      for (let i = 0; i < 3; i++) {
        const b = Math.max(0, Math.sin(lt * 9 - i * .9));
        ctx.fillStyle = `rgba(255,255,255,${.5 + .5 * b})`;
        ctx.beginPath(); ctx.arc((i - 1) * h * .38, -b * h * .12, h * .1, 0, 7); ctx.fill();
      }
      break;
    }
    case 'prompt': {
      const n = Math.floor(text.length * clamp((p - .08) / .55));
      const shown = text.slice(0, n), blink = Math.floor(lt * 3) % 2 === 0;
      ctx.globalAlpha = e;
      if (v % 2 === 0) {
        const fs = fitSize(ctx, text, SERIF, W * .78, W * .075);
        ctx.font = fstr(SERIF, fs); ctx.fillStyle = '#fff';
        ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = W * .03;
        const tw = ctx.measureText(text).width, x = (W - tw) / 2, y = H * .6;
        ctx.textAlign = 'left'; ctx.fillText(shown, x, y);
        const cw = ctx.measureText(shown).width;
        if (blink) ctx.fillRect(x + cw + fs * .08, y - fs * .5, fs * .05, fs);
        ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(W * .1, y + fs * .75, W * .8, Math.max(1, W * .002));
      } else {
        const w = W * .8, fs = W * .065, h = fs * 2.6, x = (W - w) / 2, y = H * .16;
        ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = W * .04;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x, y, w, h, fs * .4); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + w * .08, y + h - 1); ctx.lineTo(x + w * .06, y + h + fs * .6); ctx.lineTo(x + w * .16, y + h - 1); ctx.fill();
        ctx.shadowBlur = 0; ctx.textAlign = 'left';
        ctx.fillStyle = '#999'; ctx.font = fstr(UI, fs * .3); ctx.fillText('Ton commentaire', x + fs * .5, y + fs * .55);
        ctx.fillStyle = '#111'; ctx.font = fstr(UI_BOLD, fitSize(ctx, text, UI_BOLD, w - fs, fs));
        ctx.fillText(shown, x + fs * .5, y + h * .62);
        const cw = ctx.measureText(shown).width;
        ctx.fillStyle = A; ctx.fillRect(x + fs * .5, y + h * .62 + fs * .45, cw, fs * .08);
        if (blink) { ctx.fillStyle = '#111'; ctx.fillRect(x + fs * .55 + cw, y + h * .62 - fs * .4, fs * .05, fs * .8); }
      }
      break;
    }
    case 'emoji': {
      const [em, word] = fields(text, 2);
      const r = W * .15, k = backOut(p / .16), bob = Math.sin(lt * 3) * W * .006;
      ctx.globalAlpha = ease((1 - p) / .12);
      ctx.translate(v % 2 ? W * .24 : W * .76, H * .36 + bob); ctx.rotate((v % 2 ? 1 : -1) * .08 * (1 - ease(p / .3))); ctx.scale(k, k);
      ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = W * .04;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.font = `${Math.round(r * 1.15)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.fillText(em, 0, r * .06);
      if (word) {
        ctx.globalAlpha *= ease((p - .12) / .15);
        pill(ctx, 0, r * 1.35, word, { size: W * .024, bg: A, fg: isLight(A) ? P.ink : '#fff', align: 'center', border: null });
      }
      break;
    }
    case 'versus': {
      const [bad, good] = fields(text, 2);
      const turn = m.turn != null ? clamp(m.turn / m.dur, .15, .7) : .4;
      const w = W * .78, fs = W * .05, rh = fs * 2.2, x = (W - w) / 2, y = H * .2;
      ctx.globalAlpha = e;
      ctx.fillStyle = 'rgba(14,14,14,.9)'; ctx.beginPath(); ctx.roundRect(x, y, w, rh * 2 + fs, fs * .6); ctx.fill();
      const row = (txt, yy, ok, k) => {
        if (k <= 0) return;
        ctx.save(); ctx.globalAlpha = e * k; ctx.textAlign = 'left';
        const cx = x + fs * 1.1;
        ctx.fillStyle = ok ? '#3DDC97' : '#FF5A4F'; ctx.beginPath(); ctx.arc(cx, yy, fs * .5, 0, 7); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = fs * .12; ctx.lineCap = 'round'; ctx.beginPath();
        if (ok) { ctx.moveTo(cx - fs * .22, yy); ctx.lineTo(cx - fs * .05, yy + fs * .18); ctx.lineTo(cx + fs * .24, yy - fs * .18); }
        else { ctx.moveTo(cx - fs * .18, yy - fs * .18); ctx.lineTo(cx + fs * .18, yy + fs * .18); ctx.moveTo(cx + fs * .18, yy - fs * .18); ctx.lineTo(cx - fs * .18, yy + fs * .18); }
        ctx.stroke();
        const f = fitSize(ctx, txt, UI_BOLD, w - fs * 2.8, fs);
        ctx.font = fstr(UI_BOLD, f); ctx.fillStyle = ok ? '#fff' : 'rgba(255,255,255,.6)';
        ctx.fillText(txt, cx + fs * .9, yy + f * .05);
        if (!ok && p > turn) { // barré au moment du « mais »
          const tw = ctx.measureText(txt).width * ease((p - turn) / .12);
          ctx.strokeStyle = '#FF5A4F'; ctx.lineWidth = fs * .09; ctx.beginPath(); ctx.moveTo(cx + fs * .9, yy); ctx.lineTo(cx + fs * .9 + tw, yy); ctx.stroke();
        }
        ctx.restore();
      };
      row(bad, y + fs * .5 + rh / 2, false, ease(p / .12));
      row(good, y + fs * .5 + rh * 1.5, true, ease((p - turn - .05) / .12));
      break;
    }
    case 'beat': {
      const words = text.split(/\s+/).filter(Boolean);
      if (!words.length) break;
      warmBg(ctx, W, H, P);
      const n = words.length, idx = Math.min(n - 1, Math.floor(clamp(p) * n)), wp = clamp(p) * n - idx;
      const shown = v % 2 ? words.slice(0, idx + 1) : [words[idx]];
      const fs = Math.min(...shown.map(w => fitSize(ctx, w.toUpperCase(), UI_BOLD, W * .8, W * .2)));
      ctx.font = fstr(UI_BOLD, fs); ctx.fillStyle = '#fff';
      shown.forEach((w, i) => {
        const last = i === shown.length - 1, k = last ? backOut(wp / .25) : 1;
        ctx.save(); ctx.translate(W / 2, H / 2 + (i - (shown.length - 1) / 2) * fs * 1.05); ctx.scale(k * (last ? 1 + .15 * (1 - clamp(wp / .25)) : 1), k);
        ctx.fillStyle = last && i === n - 1 ? A : '#fff';
        ctx.fillText(w.toUpperCase(), 0, 0); ctx.restore();
      });
      break;
    }
    case 'countdown': {
      const n = clamp(parseInt(text, 10) || 3, 1, 9);
      warmBg(ctx, W, H, P);
      const idx = Math.min(n - 1, Math.floor(clamp(p) * n)), wp = clamp(p) * n - idx;
      const F2 = v % 2 ? UI_BOLD : SERIF;
      ctx.font = fstr(F2, W * .5); ctx.fillStyle = v % 2 ? '#fff' : A;
      const k = 1.25 - .25 * ease(wp / .3);
      ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.globalAlpha = clamp(wp / .1);
      ctx.fillText(String(n - idx), 0, 0);
      ctx.globalAlpha = .7; ctx.strokeStyle = '#fff'; ctx.lineWidth = W * .003;
      for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.beginPath(); ctx.moveTo(x * W * .22 - W * .015, y * W * .3); ctx.lineTo(x * W * .22 + W * .015, y * W * .3);
        ctx.moveTo(x * W * .22, y * W * .3 - W * .015); ctx.lineTo(x * W * .22, y * W * .3 + W * .015); ctx.stroke();
      }
      break;
    }
    case 'kinetic': {
      warmBg(ctx, W, H, P, ease(p / .08) * ease((1 - p) / .08));
      const words = text.split(/\s+/).filter(Boolean);
      const shownN = Math.min(words.length, Math.floor(clamp(p / .7) * words.length) + 1);
      const fs = W * .1;
      ctx.font = fstr(UI_BOLD, fs);
      const lines = wrap(ctx, words.join(' ').toUpperCase(), W * .8);
      let count = 0;
      ctx.textAlign = 'left';
      lines.forEach((line, li) => {
        const lw = line.split(' ');
        const total = ctx.measureText(line).width;
        let x = (W - total) / 2; const y = H / 2 + (li - (lines.length - 1) / 2) * fs * 1.1;
        lw.forEach(w => {
          count++;
          const ww = ctx.measureText(w).width;
          if (count <= shownN) {
            ctx.globalAlpha = ease((1 - p) / .08);
            ctx.fillStyle = count === words.length ? A : '#fff';
            ctx.fillText(w, x, y);
          }
          x += ww + ctx.measureText(' ').width;
        });
      });
      break;
    }
    case 'bigword': {
      warmBg(ctx, W, H, P, ease(p / .1) * ease((1 - p) / .1));
      const fs = fitSize(ctx, text, SERIF, W * .8, W * .2);
      ctx.font = fstr(SERIF, fs); ctx.fillStyle = '#fff';
      ctx.globalAlpha = ease((p - .05) / .15) * ease((1 - p) / .1);
      ctx.translate(W / 2, H / 2); const k = .92 + .08 * ease(p / .5); ctx.scale(k, k);
      ctx.fillText(text, 0, 0);
      break;
    }
    case 'name': {
      const [name, role] = fields(text, 2);
      ctx.globalAlpha = ease((1 - p) / .1);
      const fs = fitSize(ctx, name.toUpperCase(), UI_BOLD, W * .8, W * .085);
      ctx.font = fstr(UI_BOLD, fs);
      const tw = ctx.measureText(name.toUpperCase()).width;
      ctx.save(); ctx.beginPath(); ctx.rect(W / 2 - tw / 2 - fs, 0, (tw + 2 * fs) * ease(p / .35), H); ctx.clip();
      ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = W * .02; ctx.fillStyle = '#fff';
      ctx.fillText(name.toUpperCase(), W / 2, H * .12);
      ctx.restore();
      ctx.strokeStyle = A; ctx.lineWidth = fs * .08; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(W / 2 - tw / 2, H * .12 + fs * .62); ctx.lineTo(W / 2 - tw / 2 + tw * ease((p - .2) / .3), H * .12 + fs * .62); ctx.stroke();
      if (role) { ctx.globalAlpha *= ease((p - .35) / .15); label(ctx, W / 2, H * .12 + fs * 1.15, role, fs * .28, A); }
      break;
    }
    case 'spotlight': {
      const k = env(p, .2, .2);
      const g = ctx.createRadialGradient(W / 2, H * .38, W * .2, W / 2, H * .38, W * .75);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${.82 * k})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      break;
    }
    case 'orbit': {
      const N = 6;
      const items = [...Array(N)].map((_, i) => { const th = i / N * Math.PI * 2 + dir * lt * 1.8; return { i, th, z: Math.sin(th) }; })
        .sort((a, b) => a.z - b.z);
      for (const it of items) {
        const d = (it.z + 1) / 2, s = .7 + .3 * d, w = W * .17 * s;
        ctx.globalAlpha = e * (.5 + .5 * d);
        photoCard(ctx, W / 2 + Math.cos(it.th) * W * .38 * e, H * .6 + it.z * H * .045, w, w * 1.25, Math.cos(it.th) * .15,
          it.i % 2 ? c2 : c1, it.i % 2 === 0);
      }
      break;
    }
    case 'carousel': {
      const N = 7, w = W * .22, sp = w * 1.12;
      const travel = W + N * sp;
      for (let i = 0; i < N; i++) {
        let x = W + w - ease(p * .95) * travel + i * sp;
        if (dir < 0) x = W - x;
        const near = Math.max(0, 1 - Math.abs(x - W / 2) / (W * .35));
        const s = 1 + .18 * near;
        ctx.globalAlpha = env(p, .05, .08);
        photoCard(ctx, x, H * .58, w * s, w * 1.3 * s, 0, i % 2 ? c2 : c1, i % 2 === 0);
      }
      break;
    }
    case 'comment': {
      const inP = backOut(p / .14), outA = ease((1 - p) / .12);
      const y = v % 2 ? H * .62 : H * .26, bw = W * .84;
      const fs = W * .045;
      ctx.font = fstr(UI, fs);
      const lines = wrap(ctx, text, bw * .7).slice(0, 3);
      const bh = fs * 2.6 + lines.length * fs * 1.3;
      ctx.translate(W / 2, y); ctx.scale(inP, inP); ctx.globalAlpha = outA * clamp(p / .05);
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = W * .04;
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(-bw / 2, -bh / 2, bw, bh, fs * .9); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-bw * .3, bh / 2 - 1); ctx.lineTo(-bw * .36, bh / 2 + fs * 1.1); ctx.lineTo(-bw * .2, bh / 2 - 1); ctx.fill();
      ctx.shadowColor = 'transparent';
      const ax = -bw / 2 + fs * 1.9;
      ctx.fillStyle = P.accent === '#FFFFFF' ? '#111' : P.accent; ctx.beginPath(); ctx.arc(ax, -bh / 2 + fs * 1.7, fs * 1.05, 0, 7); ctx.fill();
      ctx.textAlign = 'left'; ctx.fillStyle = '#888';
      ctx.font = fstr(UI, fs * .8); ctx.fillText('@viewer', ax + fs * 1.6, -bh / 2 + fs * 1.4);
      ctx.fillStyle = '#111'; ctx.font = fstr(UI, fs);
      lines.forEach((l, i) => ctx.fillText(l, ax + fs * 1.6, -bh / 2 + fs * 2.7 + i * fs * 1.3));
      break;
    }
    case 'counter': {
      const str = /\d/.test(text) ? countUp(text, ease(p / .7)) : text;
      const fs = fitSize(ctx, str, F, W * .86, W * .2);
      ctx.globalAlpha = env(p, .08, .12);
      const sc = backOut(p / .12);
      ctx.translate(W / 2, H * .55); ctx.scale(sc, sc);
      ctx.font = fstr(F, fs);
      const tw = ctx.measureText(str).width;
      ctx.fillStyle = P.accent; ctx.fillRect(-tw / 2, fs * .38, tw * ease(p / .7), fs * .1);
      ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = W * .03;
      ctx.fillStyle = c1; ctx.fillText(str, 0, 0);
      break;
    }
    case 'words': {
      const words = text.split(/\s+/).filter(Boolean);
      if (!words.length) break;
      const idx = Math.min(words.length - 1, Math.floor(clamp(p) * words.length));
      const wp = clamp(p) * words.length - idx;
      const word = words[idx].toUpperCase();
      const fs = fitSize(ctx, word, F, W * .78, W * .16);
      ctx.font = fstr(F, fs);
      const tw = ctx.measureText(word).width;
      const sc = backOut(wp / .3);
      ctx.translate(W / 2, H * .62); ctx.scale(sc, sc);
      if (v % 2 === 0) {
        ctx.fillStyle = P.accent; ctx.beginPath(); ctx.roundRect(-tw / 2 - fs * .25, -fs * .65, tw + fs * .5, fs * 1.3, fs * .15); ctx.fill();
        ctx.fillStyle = P.ink;
      } else {
        ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = W * .03; ctx.fillStyle = P.accent;
      }
      ctx.fillText(word, 0, fs * .04);
      break;
    }
    case 'lower': {
      const [name, role] = text.split('·').map(s => s.trim());
      const fs = W * .06, y = H * .86;
      ctx.textAlign = 'left';
      ctx.font = fstr(F, fs); const nw = ctx.measureText(name || '').width;
      ctx.font = fstr(UI, fs * .5); const rw = ctx.measureText(role || '').width;
      const bw = Math.max(nw, rw) + fs * 1.4, bh = fs * (role ? 2.3 : 1.6);
      const inX = ease(p / .2), outX = ease((1 - p) / .15);
      const x = W * .06 - (1 - Math.min(inX, outX)) * (bw + W * .1);
      ctx.fillStyle = P.accent; ctx.fillRect(x, y - bh / 2, fs * .25, bh);
      ctx.fillStyle = 'rgba(10,10,10,.85)'; ctx.fillRect(x + fs * .25, y - bh / 2, bw, bh);
      ctx.fillStyle = P.text; ctx.font = fstr(F, fs); ctx.fillText(name || '', x + fs * .8, y - (role ? fs * .3 : 0));
      if (role) { ctx.fillStyle = P.accent; ctx.font = fstr(UI, fs * .5); ctx.fillText(role, x + fs * .8, y + fs * .55); }
      break;
    }
  }
  ctx.restore();
}
