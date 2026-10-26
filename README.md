# Video Edit Studio

Tu mets une vidéo, l'app l'analyse et te **propose des montages complets** (titre d'accroche, sous-titres, animations, coupes des blancs). Tu choisis, tu ajustes, tu exportes en MP4.
Inspiré de la vidéo « Don't sleep on Claude editing! ». Tout tourne **sur ton ordinateur** : la vidéo n'est envoyée nulle part.

## Lancer

```bash
python3 serve.py          # ouvre http://localhost:8765/index.html
```

- **Python 3** (aucune dépendance à installer).
- **ffmpeg** recommandé : l'export est converti en **MP4 H.264/AAC** (Instagram, TikTok, iPhone). Sans ffmpeg, tu récupères le fichier brut du navigateur.
- **Chrome, Edge ou Arc** (desktop). Garde l'onglet au premier plan pendant l'export.
- Il faut passer par `serve.py` (ou un autre serveur local) : la page ne marche pas en double-cliquant sur `index.html`.

## Ce que fait l'analyse

1. **Audio** : volume de la voix, détection des **blancs** (à couper) et des **temps forts** (pour placer des zooms).
2. **Transcription mot à mot** avec Whisper (`whisper-base`), exécutée dans le navigateur via [transformers.js](https://github.com/huggingface/transformers.js). Le premier lancement télécharge le modèle (~200 Mo), ensuite il est en cache. Utilise le GPU (WebGPU) s'il y en a un, sinon le processeur.
3. **6 propositions de montage** construites à partir de ce que tu dis :
   - le **hook** est tiré de ta première phrase, d'une question ou du moment le plus fort ;
   - un **compteur** apparaît quand tu prononces un chiffre (« 10 000 abonnés ») ;
   - une **bulle de commentaire** reprend une question que tu poses ;
   - un **word pop** reprend les mots clés d'une phrase ;
   - des **punch-in** tombent sur les temps forts de ta voix ;
   - une **carte de fin** avec un appel à l'action (Abonne-toi, Partie 2 ?, …).

   « ↻ Autres propositions » en génère de nouvelles (polices, couleurs et styles différents).

## Effet « Texte en arrière-plan » (profondeur 3D)

Le texte passe **derrière toi** : à chaque image, ta silhouette est détourée, puis l'image est composée en 3 couches :
vidéo d'origine (fond) → texte du thème (milieu) → ta silhouette détourée (premier plan).

Coche **Effet Texte en Arrière-plan** dans « Effets du thème » (étapes Propositions et Titre). Passent derrière toi : le titre **Géant derrière toi** et les gros mots (beat cuts, compteur, word pop, phrase cinétique, mot plein écran).

**Par défaut, tout se fait dans le navigateur**, sans serveur ni installation, avec [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter) (`ImageSegmenter`) :
- quand tu coches l'effet, ta silhouette est **préparée une fois**, image par image, dans un Web Worker (l'interface reste fluide, une barre de progression suit le calcul, l'effet apparaît au fur et à mesure) ;
- l'app chronomètre la carte graphique et le processeur et garde le plus rapide (certains navigateurs annoncent un GPU qui n'est qu'une émulation lente) ;
- ensuite l'aperçu et l'export relisent la silhouette **à l'image près** : aucun décalage, même sur une machine modeste ;
- deux modèles : **Précis** (selfie multiclasse, 16 Mo, cheveux et vêtements) ou **Rapide** (250 Ko).

Rien n'est envoyé en ligne. Fonctionne aussi sur un hébergement statique (Vercel, Netlify…).

**Option : moteur Python** (`depth.py`), si tu lances l'app avec `serve.py` et que tu installes `pip install -r requirements.txt` :
- **rembg** (`u2net_human_seg`) : le détourage le plus net, mais lent (~0,5 s par image) ;
- **mediapipe** Python : rapide ;
- **auto** : mesure rembg et bascule sur mediapipe si le calcul dépasserait ~1,5 × la durée de la vidéo.

Le serveur calcule une vidéo de masque une fois pour toutes (gardée en cache). En ligne de commande : `python3 depth.py ma-video.mp4 --preview apercu.png --text QUIT`.

## Motion design

Toutes les animations utilisent des courbes de lissage, jamais de mouvement linéaire : Ease-Out cubique `1 − (1 − t)³` pour les entrées, Ease-In-Out `3t² − 2t³`, et Elastic Pop `1 + 2,70158 (t − 1)³ + 1,70158 (t − 1)²`. Trois effets se règlent par thème (chaque proposition a son réglage) :
- **Kinetic Pop** : le mot clé grossit d'un coup à l'instant où tu le prononces, puis reprend sa taille ;
- **Slide & Blur** : titres, sous-titres, cartes et bandeaux entrent par le bas avec un flou de mouvement sur les premières images ;
- **Glow néon** : lueur floue (couleur du thème, cyan, rose, or ou blanc) derrière les lettres, texte net par-dessus.

## Ajouter tes images, PNG et vidéos (avec un commentaire)

À l'étape **Médias**, dépose tes fichiers et écris à côté de chacun ce que tu veux en faire. L'app lit le commentaire et place le média toute seule :

| Tu écris | L'app comprend |
| --- | --- |
| « logo de Claude quand je dis Claude » | sticker, pile sur le mot « Claude » de ta transcription |
| « photo de mon pote Guillaume sur scène, plein écran » | plein écran, quand tu dis « Guillaume », étiquette « mon pote Guillaume sur scène » |
| « capture de l'appli en haut pendant 4 s » | écran partagé (média en haut, toi en bas), 4 secondes |
| « petit dans le coin en bas à gauche à 0:12 » | incrustation en bas à gauche, à 12 s |
| « à la fin » / « au début » | placé à la fin / au début |

Les PNG détourés deviennent des stickers. 5 mises en page : carte encadrée (fond flouté, REC, étiquette), plein écran, écran partagé, incrustation, sticker. Ce que l'app a compris s'affiche sous le commentaire (« ✓ Compris : … ») et tout reste modifiable à la main.

## Les 10 étapes

1. **Import** : dépose la vidéo, choisis la langue, l'analyse démarre.
2. **Médias** : tes images, PNG et b-roll avec leur commentaire (voir plus haut).
3. **Propositions** : 8 montages à la personnalité marquée, animés en direct sur ta vidéo avec tes médias :
   - **Story doré** : cartes lumineuses, gros chiffre qui monte, tampon « 100% vrai », viseur REC, sous-titres avec le mot clé en serif doré ;
   - **Ciné cuivré** : plein écran chaud et granuleux, « BAM » sur le rythme, phrase cinétique, crochets dorés autour du mot clé ;
   - **Studio crème** : écran partagé, titre en stickers blancs, texte qui se tape, serif italique ;
   - **Zéro montage** : note manuscrite, carte couleur, tampon « 1 prise » ;
   - **Rose tag** : titre en étiquettes roses, incrustations, word pop ;
   - **Viral punchy**, **Clean pro**, **Minimal**.
4. **Hook** · 5. **Police** · 6. **Couleurs** · 7. **Titre** : ajuste le style (tout est prévisualisé en direct).
8. **Motions** : 26 éléments en 4 familles (Infos, Stickers, Plein écran, Mouvement). Pour chacun : **Garder / Peut-être / Jeter** + une note « ce qui marche, ce qu'il faut changer », et « Plus comme ça » pour une variante.
9. **Sous-titres** : 7 styles (Éditorial, Mixte, Crochets, Bandeau, Pop, Boîte, Karaoké), position réglable, texte corrigeable.
10. **Export** :
    - coupe des blancs (visible en rouge sur la timeline) ;
    - **effets sonores** générés par l'app (pop, whoosh, impact, frappe, clic, ding), un son réglable par motion, mixés dans l'export ;
    - timing de chaque motion ;
    - export MP4 ;
    - **couverture du reel** en PNG 1080 × 1920 avec ton titre ;
    - **brief pour Claude** : un résumé (médias + commentaires, éléments gardés / jetés, notes) à coller dans ta conversation avec Claude pour qu'il ajuste le montage ou l'app.

## Structure

| Fichier | Rôle |
| --- | --- |
| `index.html` | Mise en page et styles |
| `js/app.js` | Interface, étapes, aperçu, timeline, sons, export, couverture, brief |
| `js/render.js` | Dessin d'une image complète : vidéo, médias, motions, sous-titres, titre |
| `js/motions.js` | Bibliothèque des 26 motions |
| `js/media.js` | Lecture des commentaires et mises en page des médias |
| `js/sfx.js` | Effets sonores synthétisés |
| `js/kit.js` | Polices, palettes, courbes d'animation, composants de dessin |
| `js/analyze.js` | Analyse audio (blancs, temps forts) et transcription Whisper (Web Worker) |
| `js/proposals.js` | Génération des propositions de montage |
| `js/depth.js` | Détourage dans le navigateur (MediaPipe) ou via le serveur, calque alpha de la personne |
| `depth.py` | Détourage de la personne (rembg / mediapipe) → vidéo de masque |
| `serve.py` | Serveur local, conversion MP4 (`POST /convert`) et détourage (`POST /matte`) |
| `requirements.txt` | Dépendances Python, seulement pour le moteur de détourage Python (optionnel) |

Une seule fonction, `render()`, dessine chaque image. Elle sert aux vignettes, à l'aperçu et à l'export : **ce que tu vois est exactement ce qui est exporté**. L'export rejoue la vidéo, la dessine image par image sur un canvas en résolution native (1920 px max) et l'enregistre avec le son via `MediaRecorder`, en sautant les blancs coupés.

## Limites

- L'export se fait en temps réel (une vidéo de 1 min prend environ 1 min).
- Avec le moteur Python (optionnel), la silhouette suit la vidéo à ~0,1 s près pendant l'export ; le moteur navigateur (par défaut) n'a pas ce décalage.
- Sur Vercel (hébergement statique), la conversion MP4 par ffmpeg n'existe pas : l'export sort dans le format du navigateur (MP4 sur Safari et Chrome récents, sinon WebM).
- Les vidéos très longues (plus de 10 min environ) demandent beaucoup de mémoire pour l'analyse audio.
