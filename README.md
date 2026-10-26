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
3. **Compréhension de ce que tu dis** (`js/semantics.js`) : l'app repère dans la transcription des **moments à illustrer**, avec leur texte exact :

   | Ce que tu dis | Ce que l'app en fait |
   | --- | --- |
   | « en dix minutes », « moins de 5 euros », « 50 % » | carte avec le chiffre qui monte (« 10 / MINUTES ») ou compteur |
   | « d'abord… ensuite… enfin… » ou « il faut des tomates, de l'ail et du basilic » | checklist dont chaque ligne se coche **au moment où tu la dis** |
   | « ce n'est pas la crème mais le parmesan » | Avant / Après : ✗ Crème (barré au moment du « mais ») → ✓ Parmesan |
   | un objet ou une idée : « tomates », « argent », « téléphone »… | emoji qui illustre le mot (🍅 💶 📱), environ 250 mots dans 9 thèmes |
   | une question | la question tapée dans une bulle |
   | une phrase courte dite avec force | phrase cinétique plein écran |
   | « vraiment », « jamais », « secret », « gratuit »… | tampon |
   | « un seul », « le seul », « parmi tous » | une case allumée parmi les autres |

   Le **sujet** de la vidéo (cuisine, argent, tech, sport, santé, voyage, beauté…) est deviné à partir des mots employés et choisit les couleurs du montage « Sur mesure ».
4. **8 propositions de montage** : chacune a son style (police, couleurs, titre, sous-titres, effets) et sa façon de traduire ces moments en animations, plus ou moins dense. Rien n'est inventé : tous les textes viennent de ta vidéo.

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
3. **Propositions** : 8 montages construits à partir de ce que tu dis, chacun avec sa personnalité (Sur mesure, Derrière toi, Story doré, Ciné cuivré, Studio crème, Rose tag, Clean pro, Minimal), animés en direct sur ta vidéo avec tes médias.
4. **Hook** · 5. **Police** · 6. **Couleurs** · 7. **Titre** : ajuste le style (tout est prévisualisé en direct).
8. **Motions** :
   - **Moments de ta vidéo** : une carte par moment repéré, avec l'image de ta vidéo à cet instant, la phrase dite et l'animation qui l'illustre. Clique sur la carte pour l'ajouter ou la retirer ; tu peux changer le type d'animation et corriger le texte.
   - **Bibliothèque** : toutes les animations, ajoutées à la tête de lecture avec le texte de ce que tu dis à ce moment-là.
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
| `js/semantics.js` | Compréhension du discours : chiffres, listes, oppositions, questions, objets à illustrer, sujet |
| `js/motions.js` | Bibliothèque des 28 motions |
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
