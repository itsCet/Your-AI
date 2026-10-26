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

Le texte passe **derrière toi** : la personne est détourée image par image, puis chaque image est composée en 3 couches :
vidéo d'origine (fond) → texte du thème (milieu) → ta silhouette détourée (premier plan).

```bash
pip install -r requirements.txt   # opencv, mediapipe, rembg (Python 3.9 à 3.13)
python3 serve.py
```

Coche **Effet Texte en Arrière-plan** dans « Effets du thème » (étapes Propositions et Titre). Une barre de progression suit le calcul. Deux moteurs :
- **rembg** (`u2net_human_seg`) : le détourage le plus net, mais lent sur processeur (~0,5 s par image) ;
- **mediapipe** (segmentation selfie multiclasse) : rapide et stable en vidéo.

En mode **Auto**, l'app mesure rembg sur quelques images et bascule seule sur mediapipe si le calcul dépasserait ~1,5 × la durée de la vidéo. Passent derrière toi : le titre **Géant derrière toi** et les gros mots (beat cuts, compteur, word pop, phrase cinétique, mot plein écran). Le masque est gardé en cache : la même vidéo n'est détourée qu'une fois.

Tu peux aussi le lancer à la main : `python3 depth.py ma-video.mp4 --preview apercu.png --text QUIT` (écrit le masque et une image de contrôle).

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
| `js/depth.js` | Récupère le masque, le synchronise avec la vidéo et le transforme en calque alpha |
| `depth.py` | Détourage de la personne (rembg / mediapipe) → vidéo de masque |
| `serve.py` | Serveur local, conversion MP4 (`POST /convert`) et détourage (`POST /matte`) |
| `requirements.txt` | Dépendances Python, seulement pour l'effet arrière-plan |

Une seule fonction, `render()`, dessine chaque image. Elle sert aux vignettes, à l'aperçu et à l'export : **ce que tu vois est exactement ce qui est exporté**. L'export rejoue la vidéo, la dessine image par image sur un canvas en résolution native (1920 px max) et l'enregistre avec le son via `MediaRecorder`, en sautant les blancs coupés.

## Limites

- L'export se fait en temps réel (une vidéo de 1 min prend environ 1 min).
- L'effet arrière-plan suit le masque à ~0,1 s près pendant l'export : sur des gestes très rapides, le bord de la silhouette peut avoir un léger retard.
- Les vidéos très longues (plus de 10 min environ) demandent beaucoup de mémoire pour l'analyse audio.
