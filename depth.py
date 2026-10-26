#!/usr/bin/env python3
"""Détourage de la personne (video matting) pour l'effet « texte derrière toi ».

Calcule, image par image, un masque de la silhouette (blanc = personne, noir = décor)
et l'écrit dans une petite vidéo de masque synchronisée avec la vidéo d'origine.
Le navigateur s'en sert pour empiler les 3 couches à chaque image :
    vidéo d'origine (fond) -> texte du thème (milieu) -> silhouette détourée (premier plan).

Moteurs (dans cet ordre en mode « auto ») :
  - rembg (modèle u2net_human_seg) : détourage le plus net, mais lent sur processeur ;
    si l'estimation dépasse le budget de temps, on bascule automatiquement sur mediapipe.
  - mediapipe (ImageSegmenter, modèle selfie multiclasse) : rapide et stable en vidéo.

Usage en ligne de commande :
    python3 depth.py video.mp4                         # écrit video.mask.mp4
    python3 depth.py video.mp4 --engine mediapipe --preview apercu.png --at 2 --text "QUIT"
"""
import argparse
import os
import shutil
import subprocess
import time
import urllib.request

CACHE = os.path.join(os.path.expanduser("~"), ".cache", "video-edit-studio")
MP_MODELS = [
    # Multiclasse : cheveux, corps, vêtements séparés du fond (plus précis).
    ("selfie_multiclass_256x256.tflite",
     "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite"),
    # Repli léger (250 Ko).
    ("selfie_segmenter.tflite",
     "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite"),
]


def available_engines():
    """Moteurs importables sur cette machine (sans charger les modèles)."""
    found = []
    try:
        import cv2  # noqa: F401
        import numpy  # noqa: F401
    except ImportError:
        return found
    try:
        import rembg  # noqa: F401
        import onnxruntime  # noqa: F401
        found.append("rembg")
    except Exception:
        pass
    try:
        from mediapipe.tasks.python import vision  # noqa: F401
        found.append("mediapipe")
    except Exception:
        pass
    return found


class RembgMatter:
    """Détourage net avec rembg. Une seule session réutilisée pour toutes les images."""
    name = "rembg"

    def __init__(self, work_width=320):
        from rembg import new_session
        self.session = new_session("u2net_human_seg")
        self.work_width = work_width

    def __call__(self, frame_bgr, _ts_ms):
        import cv2
        import numpy as np
        from PIL import Image
        from rembg import remove
        h, w = frame_bgr.shape[:2]
        small = cv2.resize(frame_bgr, (self.work_width, round(h * self.work_width / w)), interpolation=cv2.INTER_AREA)
        pil = Image.fromarray(cv2.cvtColor(small, cv2.COLOR_BGR2RGB))
        mask = remove(pil, session=self.session, only_mask=True)
        return np.asarray(mask, dtype=np.float32) / 255.0


class MediapipeMatter:
    """Segmentation rapide avec mediapipe, en mode vidéo (suivi d'une image à l'autre)."""
    name = "mediapipe"

    def __init__(self):
        from mediapipe.tasks.python import BaseOptions, vision
        path, self.multiclass = None, False
        for fname, url in MP_MODELS:
            p = os.path.join(CACHE, fname)
            try:
                if not os.path.exists(p):
                    os.makedirs(CACHE, exist_ok=True)
                    urllib.request.urlretrieve(url, p + ".part")
                    os.replace(p + ".part", p)
                path, self.multiclass = p, "multiclass" in fname
                break
            except Exception:
                continue
        if not path:
            raise RuntimeError("impossible de télécharger le modèle mediapipe")
        opts = vision.ImageSegmenterOptions(
            base_options=BaseOptions(model_asset_path=path),
            running_mode=vision.RunningMode.VIDEO,
            output_confidence_masks=True, output_category_mask=False)
        self.seg = vision.ImageSegmenter.create_from_options(opts)

    def close(self):
        self.seg.close()

    def __call__(self, frame_bgr, ts_ms):
        import cv2
        import mediapipe as mp
        import numpy as np
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        res = self.seg.segment_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), int(ts_ms))
        masks = res.confidence_masks
        if self.multiclass:
            # Catégorie 0 = fond : la personne, c'est tout le reste.
            return 1.0 - np.asarray(masks[0].numpy_view(), dtype=np.float32)
        return np.asarray(masks[0].numpy_view(), dtype=np.float32)


def make_matter(engine="auto", probe=None, budget=None, log=print):
    """Choisit le moteur. En « auto », essaie rembg sur quelques images et bascule sur
    mediapipe si le temps estimé dépasse `budget` secondes."""
    engines = available_engines()
    if not engines:
        raise RuntimeError("aucun moteur de détourage installé : pip install -r requirements.txt")
    if engine != "auto":
        if engine not in engines:
            raise RuntimeError(f"moteur « {engine} » non installé (disponibles : {', '.join(engines)})")
        return RembgMatter() if engine == "rembg" else MediapipeMatter()
    if "rembg" in engines and probe is not None:
        frames, total = probe
        m = RembgMatter()
        m(frames[0], 0)  # premier appel : chargement du modèle, non compté
        t0 = time.time()
        for f in frames[1:]:
            m(f, 0)
        per = (time.time() - t0) / max(1, len(frames) - 1)
        estimate = per * total
        if budget is None or estimate <= budget or "mediapipe" not in engines:
            log(f"rembg : ~{per:.2f} s/image, ~{estimate:.0f} s au total")
            return m
        log(f"rembg trop lent (~{estimate:.0f} s estimées > {budget:.0f} s) : bascule sur mediapipe")
    return MediapipeMatter() if "mediapipe" in engines else RembgMatter()


def compute_masks(src, dst, engine="auto", width=360, budget_factor=1.5, progress=None, log=print):
    """Écrit dans `dst` une vidéo de masques (H.264, niveaux de gris) alignée image par image sur `src`.
    progress(fait, total) est appelé régulièrement. Retourne {engine, frames, fps, width, height}."""
    import cv2
    import numpy as np
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg est nécessaire pour écrire la vidéo de masque")
    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        raise RuntimeError("impossible de lire la vidéo")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
    w0, h0 = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    ow = width - width % 2
    oh = round(h0 * ow / w0); oh -= oh % 2

    # Quelques images pour estimer la vitesse de rembg.
    probe = []
    for _ in range(4):
        ok, f = cap.read()
        if ok:
            probe.append(f)
    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    budget = max(20.0, budget_factor * total / fps)
    matter = make_matter(engine, (probe, total) if probe else None, budget, log)

    proc = subprocess.Popen(
        [ffmpeg, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{ow}x{oh}", "-r", f"{fps:.6f}",
         "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-g", "10", "-movflags", "+faststart", dst],
        stdin=subprocess.PIPE)
    prev, i = None, 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            m = matter(frame, i * 1000.0 / fps)
            m = cv2.resize(m, (ow, oh), interpolation=cv2.INTER_LINEAR)
            # Lissage temporel (évite le scintillement des contours) puis bords adoucis.
            if prev is not None:
                m = .7 * m + .3 * prev
            prev = m
            m = cv2.GaussianBlur(m, (5, 5), 0)
            proc.stdin.write((np.clip(m, 0, 1) * 255).astype(np.uint8).tobytes())
            i += 1
            if progress and (i % 5 == 0 or i == total):
                progress(i, total)
    finally:
        proc.stdin.close()
        proc.wait()
        cap.release()
        if hasattr(matter, "close"):
            matter.close()
    if proc.returncode != 0:
        raise RuntimeError("ffmpeg n'a pas pu écrire la vidéo de masque")
    if progress:
        progress(i, i)
    return {"engine": matter.name, "frames": i, "fps": fps, "width": ow, "height": oh}


def composite_text_behind(frame_bgr, text_rgba, mask):
    """Les 3 couches du SKILL, version Python (sert à l'aperçu en ligne de commande) :
    fond = frame, milieu = texte RGBA, premier plan = personne découpée par `mask` (0..1)."""
    import numpy as np
    base = frame_bgr.astype(np.float32)
    a_txt = text_rgba[:, :, 3:4].astype(np.float32) / 255.0
    with_text = base * (1 - a_txt) + text_rgba[:, :, :3].astype(np.float32) * a_txt
    a_person = mask[:, :, None].astype(np.float32)
    out = with_text * (1 - a_person) + base * a_person
    return out.astype(np.uint8)


def _preview(src, mask_path, out_png, at, text):
    import cv2
    import numpy as np
    cap, mcap = cv2.VideoCapture(src), cv2.VideoCapture(mask_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    idx = int(at * fps)
    for c in (cap, mcap):
        c.set(cv2.CAP_PROP_POS_FRAMES, idx)
    ok1, frame = cap.read()
    ok2, mframe = mcap.read()
    if not (ok1 and ok2):
        raise RuntimeError("image introuvable")
    h, w = frame.shape[:2]
    mask = cv2.resize(cv2.cvtColor(mframe, cv2.COLOR_BGR2GRAY), (w, h)).astype(np.float32) / 255
    layer = np.zeros((h, w, 4), np.uint8)
    scale = w / 160
    (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_DUPLEX, scale, int(scale * 3))
    cv2.putText(layer, text, ((w - tw) // 2, int(h * .35)), cv2.FONT_HERSHEY_DUPLEX, scale, (10, 214, 255, 255), int(scale * 3), cv2.LINE_AA)
    cv2.imwrite(out_png, composite_text_behind(frame, layer, mask))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video")
    ap.add_argument("--engine", default="auto", choices=["auto", "rembg", "mediapipe"])
    ap.add_argument("--out")
    ap.add_argument("--width", type=int, default=360)
    ap.add_argument("--preview", help="écrit une image de contrôle (texte derrière la personne)")
    ap.add_argument("--at", type=float, default=1.0)
    ap.add_argument("--text", default="DERRIÈRE")
    a = ap.parse_args()
    out = a.out or os.path.splitext(a.video)[0] + ".mask.mp4"
    t0 = time.time()
    info = compute_masks(a.video, out, a.engine, a.width, progress=lambda d, t: print(f"\r{d}/{t}", end="", flush=True))
    print(f"\n{info} en {time.time() - t0:.1f} s -> {out}")
    if a.preview:
        _preview(a.video, out, a.preview, a.at, a.text)
        print("aperçu ->", a.preview)
