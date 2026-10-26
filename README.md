# Video Edit Studio

Tu mets une vidéo, l'app la transcrit et fait un **premier montage** (accroche, sous-titres, animations liées à ce que tu dis, coupes des blancs). Tu choisis ton **look** en un clic par étape, puis tu **contrôles tout** : chaque mot (fautes, franglais), chaque coupe, chaque animation. Export MP4.
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
   | « en dix minutes », « moins de 5 euros », « 50 % » | carte chiffre (« 10 / MINUTES ») ou compteur |
   | « d'abord… ensuite… enfin… » ou « il faut des tomates, de l'ail et du basilic » | checklist dont chaque ligne se coche **au moment où tu la dis** |
   | « ce n'est pas la crème mais le parmesan » | Avant / Après : ✗ Crème (barré au moment du « mais ») → ✓ Parmesan |
   | un objet ou une idée : « tomates », « argent », « téléphone »… | emoji qui illustre le mot |
   | une question | commentaire d'abonné à l'écran |
   | une phrase courte dite avec force | phrase plein écran, mots surlignés, carte couleur |
   | un mot fort | note manuscrite entourée, tampon |

4. **Premier montage automatique**, fait seulement avec les éléments et motions cochés dans ton look. Rien n'est inventé : tous les textes viennent de ta vidéo.

## Les 3 onglets

### 1. Look (7 étapes)

**Couleurs · Polices · Accroche · Sous-titres · Éléments · Motion · Revue.** Chaque carte montre **ta vidéo** avec l'option, animée en direct. Un clic l'applique partout (accroche, sous-titres, cartes, animations).

- **Départs rapides** : Signature, Clean, Loud, Playful, Scrapbook, Derrière toi. Chacun remplit toutes les étapes, et tout reste modifiable.
- 8 palettes, 8 paires de polices (celles marquées « manuscrit » ajoutent une écriture à la main sur les mots d'accent), 7 styles d'accroche, 8 styles de sous-titres.
- **Éléments** (cartes posées sur la vidéo) : note manuscrite, carte couleur, mot tampon, carte chiffre, checklist, avant / après, illustration emoji, écran d'appli, nom + rôle.
- **Motion** (mouvements) : orbite de photos, carrousel, la vidéo rétrécit dans une carte, commentaire d'abonné, mots surlignés, compteur, phrase plein écran, beat cuts, punch-in, projecteur.

Tu coches ce que tu veux : le montage automatique n'utilise que ça. Les animations sont faites avec [GSAP](https://gsap.com) (timelines rejouées à l'image près, en avant comme en arrière).

### 2. Édition : la transcription comme un document

- **Corriger un mot** (franglais, noms propres) : clique dessus, tape la bonne orthographe. « Partout et retenir » le corrige dans toute la vidéo et l'ajoute au **dictionnaire** : il sera corrigé automatiquement dans tes prochaines vidéos. Double-clic pour corriger directement dans le texte. Un mot corrigé est souligné en vert (le mot transcrit s'affiche au survol).
- **Couper** : sélectionne des mots (glisser) → ✂ Couper. Ils sont barrés et sautés à la lecture et à l'export. Les blancs longs sont affichés (« · 1,4 s · ») et barrés quand ils sont coupés.
- **Animations posées sur les mots** : chaque animation est une étiquette ▶ à l'endroit du texte où elle apparaît. Clique dessus pour tout changer : type, variante, textes, début, durée, son. Les mots couverts sont soulignés de sa couleur.
- **Ajouter une animation** : sélectionne des mots → « + Ajouter une animation ici ». Le texte est prérempli avec les mots choisis.
- **Médias** : tes images, PNG et vidéos avec un commentaire (voir plus bas).

### 3. Revue

Coupe des blancs (sensibilité réglable, visible en rouge sur la timeline), sous-titres, effets sonores, effet texte derrière toi, **export MP4**, **couverture** PNG 1080 × 1920.

## Faire le montage avec Claude (dans la conversation)

1. Onglet Édition → **📋 Copier pour Claude** : copie la transcription numérotée mot à mot, ta boîte à outils (éléments et motions du look) et le format de réponse.
2. Colle-le à Claude. Il répond avec un plan JSON : accroche, **corrections** de mots, **coupes**, animations posées sur des index de mots avec leurs textes.
3. **📥 Importer un plan** : colle la réponse. Le plan remplace le montage automatique (ce que tu as ajouté à la main est gardé), puis tu corriges tout dans l'Édition.

## Effet « Texte en arrière-plan » (profondeur 3D)

Le texte passe **derrière toi** : à chaque image, ta silhouette est détourée, puis l'image est composée en 3 couches :
vidéo d'origine (fond) → texte du thème (milieu) → ta silhouette détourée (premier plan).

Coche **Effet Texte en Arrière-plan** (Look → Accroche, ou Revue), ou prends le départ rapide « Derrière toi ». Passent derrière toi : l'accroche **Géant derrière toi** et les gros textes (phrase plein écran, beat cuts, compteur, mots surlignés, écran d'appli).

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

Toutes les animations sont des timelines GSAP (`expo.out`, `back.out`, `power3`…), jamais de mouvement linéaire. Trois effets se règlent dans Look → Motion :
- **Kinetic Pop** : le mot clé grossit d'un coup à l'instant où tu le prononces ;
- **Slide & Blur** : entrées par le bas avec un flou de mouvement ;
- **Glow néon** : lueur floue de la couleur du look derrière les lettres.

## Ajouter tes images, PNG et vidéos (avec un commentaire)

Dans l'onglet **Édition** (en bas), dépose tes fichiers et écris à côté de chacun ce que tu veux en faire. L'app lit le commentaire et place le média toute seule :

| Tu écris | L'app comprend |
| --- | --- |
| « logo de Claude quand je dis Claude » | sticker, pile sur le mot « Claude » de ta transcription |
| « photo de mon pote Guillaume sur scène, plein écran » | plein écran, quand tu dis « Guillaume », étiquette « mon pote Guillaume sur scène » |
| « capture de l'appli en haut pendant 4 s » | écran partagé (média en haut, toi en bas), 4 secondes |
| « petit dans le coin en bas à gauche à 0:12 » | incrustation en bas à gauche, à 12 s |
| « à la fin » / « au début » | placé à la fin / au début |

Les PNG détourés deviennent des stickers. 5 mises en page : carte encadrée (fond flouté, REC, étiquette), plein écran, écran partagé, incrustation, sticker. Ce que l'app a compris s'affiche sous le commentaire (« ✓ Compris : … ») et tout reste modifiable à la main.

## Structure

| Fichier | Rôle |
| --- | --- |
| `index.html` | Mise en page et styles |
| `js/app.js` | Interface (onglets Look, Édition, Revue), aperçu, timeline, sons, export, couverture |
| `js/look.js` | Palettes, paires de polices, styles d'accroche et de sous-titres, catalogue des éléments et motions, départs rapides |
| `js/render.js` | Dessin d'une image complète : vidéo, médias, éléments, sous-titres, accroche |
| `js/elements.js` | Les éléments et motions (timelines GSAP + dessin) |
| `js/anim.js` | Cache des timelines GSAP et primitives dessinées à la main (cercle, trait, surligneur, coche) |
| `js/plan.js` | Montage automatique et aller-retour avec Claude (prompt, lecture du plan) |
| `js/semantics.js` | Compréhension du discours : chiffres, listes, oppositions, questions, objets à illustrer |
| `js/media.js` | Lecture des commentaires et mises en page des médias |
| `js/sfx.js` | Effets sonores synthétisés |
| `js/kit.js` | Palettes, composants de dessin, courbes |
| `js/analyze.js` | Analyse audio (blancs, temps forts) et transcription Whisper (Web Worker) |
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
