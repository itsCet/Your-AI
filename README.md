# Video Edit Studio

Outil local pour monter des vidéos verticales courtes (Reels, TikTok, Shorts) en 7 étapes, inspiré de la vidéo « Don't sleep on Claude editing! ».
Chaque aperçu est dessiné **en direct sur ta propre vidéo**, dans tes couleurs et ta police. Rien ne quitte ton ordinateur.

## Lancer

```bash
python3 serve.py          # ouvre http://localhost:8765/index.html
```

- **Python 3** requis (aucune dépendance à installer).
- **ffmpeg** optionnel mais recommandé : l'export est alors converti en **MP4 H.264/AAC**, le format accepté partout. Sans ffmpeg, tu récupères le fichier brut du navigateur (WebM).
- Utilise Chrome, Edge ou Arc, et garde l'onglet au premier plan pendant l'export.

## Les 7 étapes

1. **Import** : dépose une vidéo (verticale idéalement).
2. **Hook** : les deux lignes du titre d'ouverture et leur durée à l'écran.
3. **Police** : Anton, Bebas Neue, Archivo Black, DM Serif Display, Space Mono, Inter.
4. **Couleurs** : 6 palettes (accent, texte, encre).
5. **Style de titre** : Tuiles (lettres qui tombent), Empilé, Bandeau, Machine à écrire.
6. **Motions** : coche celles que tu veux (**Prendre**). **Plus comme ça** ajoute une variante (couleurs inversées, sens inversé, autre position).
   - Orbit : des photos tournent autour de toi à hauteur de poitrine
   - Carousel : des cartes défilent en ligne
   - Shrink card : la vidéo rétrécit sur une carte couleur avec un texte
   - Comment pop-up : une bulle de commentaire apparaît
   - Compteur : un chiffre qui monte (ex. « 10000 vues »)
   - Word pop : les mots claquent un par un
   - Punch-in : un zoom rapide
   - Lower third : un bandeau nom qui glisse
7. **Timing & export** : règle le début, la durée et le texte de chaque motion (le bouton « ⇤ Tête de lecture » la place au moment en cours), puis exporte.

## Comment ça marche

- `index.html` : toute l'app dans un seul fichier, sans framework. Une seule fonction `render(ctx, W, H, t, config)` dessine une image complète sur un `<canvas>` : la vidéo, puis le titre, puis les motions actives au temps `t`. Cette même fonction sert aux vignettes, à l'aperçu principal et à l'export, donc **ce que tu vois est exactement ce que tu exportes**.
- Export : la vidéo est rejouée depuis le début, chaque image est dessinée sur un canvas en résolution native (1920 px max), et le flux du canvas est enregistré avec l'audio de la vidéo via `MediaRecorder`.
- `serve.py` : un petit serveur Python qui sert la page et expose `POST /convert` (conversion MP4 par ffmpeg) et `GET /health`.

## Limites

- Pas de sous-titres automatiques (il faudrait un modèle de transcription comme Whisper).
- Les cartes de l'Orbit passent devant toi, jamais derrière (il faudrait une segmentation de la personne).
