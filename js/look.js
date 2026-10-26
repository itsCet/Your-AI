// Le « look » d'un montage : couleurs, paire de polices, style du titre d'accroche, style des
// sous-titres, et la boîte à outils d'éléments et de motions autorisés. Un clic sur une option
// change le look, et tout (titre, sous-titres, cartes, animations) est redessiné avec.
import { PALETTES } from './kit.js';

export { PALETTES };

// Paires de polices : titre (display), texte (body), et manuscrite optionnelle (hand).
export const FONT_PAIRS = [
  { id: 'montserrat-caveat', name: 'Montserrat + Caveat', desc: 'Gras + manuscrit',
    display: { family: 'Montserrat', weight: 800 }, body: { family: 'Montserrat', weight: 700 }, hand: { family: 'Caveat', weight: 700 } },
  { id: 'playfair-inter', name: 'Playfair + Inter', desc: 'Éditorial, calme',
    display: { family: 'Playfair Display', weight: 700 }, body: { family: 'Inter', weight: 600 }, accent: { family: 'Playfair Display', weight: 700, style: 'italic' } },
  { id: 'anton-inter', name: 'Anton + Inter', desc: 'Haut, capitales qui crient', caps: true,
    display: { family: 'Anton', weight: 400 }, body: { family: 'Inter', weight: 800 } },
  { id: 'poppins', name: 'Poppins', desc: 'Rond, moderne',
    display: { family: 'Poppins', weight: 800 }, body: { family: 'Poppins', weight: 600 } },
  { id: 'dmserif-caveat', name: 'DM Serif + Caveat', desc: 'Élégant + manuscrit',
    display: { family: 'DM Serif Display', weight: 400 }, body: { family: 'Inter', weight: 600 }, hand: { family: 'Caveat', weight: 700 } },
  { id: 'bebas-inter', name: 'Bebas + Inter', desc: 'Ciné, condensé', caps: true,
    display: { family: 'Bebas Neue', weight: 400 }, body: { family: 'Inter', weight: 700 } },
  { id: 'archivo-mono', name: 'Archivo + Space Mono', desc: 'Tech, brut', caps: true,
    display: { family: 'Archivo Black', weight: 400 }, body: { family: 'Space Mono', weight: 700 } },
  { id: 'fraunces-inter', name: 'Fraunces + Inter', desc: 'Magazine chaleureux',
    display: { family: 'Fraunces', weight: 800 }, body: { family: 'Inter', weight: 600 }, accent: { family: 'Fraunces', weight: 700, style: 'italic' } },
];

export const HOOK_STYLES = [
  { id: 'stacked', name: 'Empilé', desc: 'Gros titre, 2e ligne en couleur' },
  { id: 'tiles', name: 'Tuiles', desc: 'Lettres en tuiles qui tombent, étiquette en dessous' },
  { id: 'editorial', name: 'Éditorial', desc: 'Petite ligne + grand mot d\'accent' },
  { id: 'tag', name: 'Étiquettes', desc: 'Chaque ligne dans une étiquette couleur' },
  { id: 'underline', name: 'Souligné main', desc: 'Trait dessiné à la main sous le mot fort' },
  { id: 'depth', name: 'Géant derrière toi', desc: 'Énorme mot qui passe derrière ta tête' },
  { id: 'type', name: 'Machine à écrire', desc: 'Le texte se tape avec un curseur' },
];

export const CAPTION_STYLES = [
  { id: 'pop', name: 'Pop', desc: 'Capitales, le mot dit grossit en couleur' },
  { id: 'highlight', name: 'Surligneur', desc: 'Le mot dit est surligné comme au feutre' },
  { id: 'editorial', name: 'Éditorial', desc: 'Petits mots + mot clé en grand' },
  { id: 'hand', name: 'Accent manuscrit', desc: 'Texte net, mot clé écrit à la main' },
  { id: 'box', name: 'Boîte', desc: 'Texte noir sur blanc, mot dit en couleur' },
  { id: 'brackets', name: 'Crochets', desc: 'Crochets qui se referment sur le mot clé' },
  { id: 'karaoke', name: 'Karaoké', desc: 'Les mots se colorent au fil de la voix' },
  { id: 'band', name: 'Bandeau', desc: 'Bande sombre en bas, texte posé' },
];

// Boîte à outils. Éléments = cartes et graphismes posés sur un moment ; Motion = mouvements.
// fields : ce qui se modifie dans l'éditeur (le texte vient de ce que tu dis).
export const ELEMENTS = [
  { id: 'note', name: 'Note manuscrite', desc: 'Un mot entouré d\'un cercle dessiné à la main', dur: 2.6, fields: [['text', 'Texte']] },
  { id: 'colorcard', name: 'Carte couleur', desc: 'Une carte pleine couleur avec quelques mots', dur: 2.6, fields: [['top', 'Texte']] },
  { id: 'stamp', name: 'Mot tampon', desc: 'Un mot ou un chiffre tamponné de travers', dur: 2, fields: [['text', 'Texte']] },
  { id: 'statcard', name: 'Carte chiffre', desc: 'Un chiffre qui monte dans une carte', dur: 3, fields: [['label', 'Titre'], ['value', 'Chiffre'], ['unit', 'Unité']] },
  { id: 'checklist', name: 'Checklist', desc: 'Chaque ligne se coche quand tu la dis', dur: 4, fields: [['title', 'Titre'], ['items', 'Lignes (une par ligne)', 'list']] },
  { id: 'versus', name: 'Avant / Après', desc: 'Ce qu\'il ne faut pas faire, barré, puis la bonne option', dur: 3.2, fields: [['bad', 'À éviter'], ['good', 'À faire']] },
  { id: 'emoji', name: 'Illustration', desc: 'Un emoji qui illustre le mot dit', dur: 2.2, fields: [['emoji', 'Emoji'], ['word', 'Mot']] },
  { id: 'screen', name: 'Écran d\'appli', desc: 'Une fenêtre d\'appli qui apparaît derrière toi', dur: 3.2, fields: [['title', 'Titre de la fenêtre'], ['lines', 'Lignes (une par ligne)', 'list']] },
  { id: 'lower', name: 'Nom + rôle', desc: 'Ton nom qui glisse en bas de l\'écran', dur: 3, fields: [['name', 'Nom'], ['role', 'Rôle']] },
];

export const MOTIONS = [
  { id: 'orbit', name: 'Orbit', desc: 'Des photos tournent autour de toi à hauteur de poitrine', dur: 3.2, fields: [] },
  { id: 'carousel', name: 'Carousel', desc: 'Des cartes défilent en ligne', dur: 3, fields: [] },
  { id: 'shrink', name: 'Shrink card', desc: 'La vidéo rétrécit sur une carte couleur', dur: 3, fields: [['top', 'Texte du haut'], ['bottom', 'Texte du bas']] },
  { id: 'comment', name: 'Commentaire', desc: 'Une bulle de commentaire apparaît', dur: 2.8, fields: [['name', 'Pseudo'], ['text', 'Commentaire']] },
  { id: 'wordreveal', name: 'Mots surlignés', desc: 'La phrase apparaît, les mots forts sont surlignés', dur: 2.8, fields: [['text', 'Phrase'], ['mark', 'Mots surlignés']] },
  { id: 'counter', name: 'Compteur', desc: 'Un grand chiffre qui défile', dur: 2.6, fields: [['value', 'Chiffre'], ['label', 'Légende']] },
  { id: 'kinetic', name: 'Phrase plein écran', desc: 'La phrase se construit mot par mot, plein écran', dur: 3, fields: [['text', 'Phrase']] },
  { id: 'beat', name: 'Beat cuts', desc: 'Des mots plein écran qui claquent', dur: 1.8, fields: [['words', 'Mots']] },
  { id: 'zoom', name: 'Punch-in', desc: 'Zoom rapide sur ton visage', dur: 1.4, fields: [] },
  { id: 'spotlight', name: 'Spotlight', desc: 'Tout s\'assombrit autour de toi', dur: 2.4, fields: [] },
];

export const CATALOG = Object.fromEntries([...ELEMENTS, ...MOTIONS].map(x => [x.id, x]));

// Looks prêts à l'emploi (départ rapide). Tout reste modifiable étape par étape.
export const PRESETS = [
  { id: 'signature', name: 'Signature', desc: 'Chaud, manuscrit, personnel',
    pal: 'sunlit', fonts: 'montserrat-caveat', hook: 'tiles', captions: 'editorial', fx: { pop: true, slide: true, glow: false },
    elements: ['note', 'colorcard', 'stamp', 'statcard', 'checklist', 'emoji'], motion: ['orbit', 'shrink', 'comment', 'wordreveal', 'counter', 'zoom'] },
  { id: 'clean', name: 'Clean', desc: 'Sobre, net, pro',
    pal: 'electric', fonts: 'playfair-inter', hook: 'editorial', captions: 'highlight', fx: { pop: false, slide: true, glow: false },
    elements: ['statcard', 'checklist', 'versus', 'lower', 'screen'], motion: ['wordreveal', 'counter', 'zoom'] },
  { id: 'loud', name: 'Loud', desc: 'Capitales, rouge, punch',
    pal: 'signal', fonts: 'anton-inter', hook: 'stacked', captions: 'pop', fx: { pop: true, slide: false, glow: false },
    elements: ['stamp', 'statcard', 'versus', 'emoji'], motion: ['beat', 'kinetic', 'counter', 'carousel', 'zoom'] },
  { id: 'playful', name: 'Playful', desc: 'Rose, manuscrit, emoji',
    pal: 'pink', fonts: 'montserrat-caveat', hook: 'tag', captions: 'hand', fx: { pop: true, slide: true, glow: false },
    elements: ['note', 'colorcard', 'emoji', 'stamp'], motion: ['orbit', 'carousel', 'comment', 'wordreveal', 'zoom'] },
  { id: 'scrapbook', name: 'Scrapbook', desc: 'Or et crème, collé à la main',
    pal: 'gold', fonts: 'dmserif-caveat', hook: 'underline', captions: 'hand', fx: { pop: false, slide: true, glow: false },
    elements: ['note', 'colorcard', 'screen', 'checklist'], motion: ['shrink', 'carousel', 'orbit', 'comment'] },
  { id: 'depth', name: 'Derrière toi', desc: 'Mots géants derrière ta tête',
    pal: 'mono', fonts: 'anton-inter', hook: 'depth', captions: 'brackets', fx: { pop: true, slide: true, glow: false }, depth: true,
    elements: ['statcard', 'checklist', 'versus'], motion: ['kinetic', 'beat', 'counter', 'zoom'] },
];

export const DEFAULT_LOOK = { ...PRESETS[0], preset: 'signature' };

export const palOf = look => Math.max(0, PALETTES.findIndex(p => p.id === look.pal));
export const pairOf = look => FONT_PAIRS.find(f => f.id === look.fonts) || FONT_PAIRS[0];
