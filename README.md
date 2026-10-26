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

## Les 9 étapes

1. **Import** : dépose la vidéo, choisis la langue, l'analyse démarre.
2. **Propositions** : 6 montages animés en direct sur ta vidéo. « Aperçu » pour le voir en grand, « Choisir » pour l'appliquer.
3. **Hook** · 4. **Police** · 5. **Couleurs** · 6. **Titre** : ajuste le style (tout est prévisualisé en direct).
7. **Motions** : Orbit, Carousel, Shrink card, Comment pop-up, Compteur, Word pop, Punch-in, Lower third. « Prendre » pour ajouter, « Plus comme ça » pour une variante.
8. **Sous-titres** : 3 styles (Pop, Boîte, Karaoké), position réglable, texte corrigeable phrase par phrase.
9. **Export** : coupe des blancs (sensibilité réglable, visible en rouge sur la timeline), timing de chaque motion, puis export.

## Structure

| Fichier | Rôle |
| --- | --- |
| `index.html` | Mise en page et styles |
| `js/app.js` | Interface, étapes, aperçu, timeline, export |
| `js/render.js` | Dessin d'une image complète : vidéo, titre, sous-titres, motions |
| `js/analyze.js` | Analyse audio (blancs, temps forts) et transcription Whisper (Web Worker) |
| `js/proposals.js` | Génération des propositions de montage |
| `serve.py` | Serveur local + conversion MP4 via ffmpeg (`POST /convert`) |

Une seule fonction, `render()`, dessine chaque image. Elle sert aux vignettes, à l'aperçu et à l'export : **ce que tu vois est exactement ce qui est exporté**. L'export rejoue la vidéo, la dessine image par image sur un canvas en résolution native (1920 px max) et l'enregistre avec le son via `MediaRecorder`, en sautant les blancs coupés.

## Limites

- L'export se fait en temps réel (une vidéo de 1 min prend environ 1 min).
- Les cartes de l'Orbit passent devant toi, jamais derrière (il faudrait détourer la personne).
- Les vidéos très longues (plus de 10 min environ) demandent beaucoup de mémoire pour l'analyse audio.
