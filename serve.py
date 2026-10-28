#!/usr/bin/env python3
"""Serveur local pour Video Edit Studio.

- Sert index.html sur http://localhost:8765
- POST /convert            : convertit l'export WebM du navigateur en MP4 (H.264/AAC) via ffmpeg
- POST /matte?engine=auto  : lance le détourage de la personne (voir depth.py), répond { id }
- GET  /matte/status?id=…  : avancement { state, done, total, engine, error }
- GET  /matte/mask?id=…    : vidéo de masque (MP4, blanc = personne)
- GET  /health             : ffmpeg et moteurs de détourage disponibles
"""
import hashlib
import http.server
import json
import os
import shutil
import subprocess
import tempfile
import threading
import webbrowser
from urllib.parse import parse_qs, urlparse

PORT = int(os.environ.get("PORT", "8765"))
ROOT = os.path.dirname(os.path.abspath(__file__))
FFMPEG = shutil.which("ffmpeg")
MATTE_DIR = os.path.join(tempfile.gettempdir(), "video-edit-studio-mattes")
JOBS = {}
JOBS_LOCK = threading.Lock()


def matting_engines():
    try:
        import depth
        return depth.available_engines()
    except Exception:
        return []


def run_matte(job_id, src, dst, engine):
    import depth
    job = JOBS[job_id]

    def progress(done, total):
        job.update(done=done, total=total)

    def log(msg):
        job["log"] = msg
        print("[détourage]", msg)

    try:
        info = depth.compute_masks(src, dst + ".part.mp4", engine, progress=progress, log=log)
        os.replace(dst + ".part.mp4", dst)
        job.update(state="done", engine=info["engine"])
    except Exception as e:  # noqa: BLE001 - l'erreur est renvoyée telle quelle à l'interface
        job.update(state="error", error=str(e))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        if "/matte/status" not in (str(args[0]) if args else ""):
            super().log_message(fmt, *args)

    def _send(self, code, body, ctype):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _json(self, obj, code=200):
        self._send(code, json.dumps(obj).encode(), "application/json")

    def _read_body(self, path):
        """Copie le corps de la requête dans `path` et renvoie son empreinte SHA-1."""
        remaining = int(self.headers.get("Content-Length", "0"))
        h = hashlib.sha1()
        with open(path, "wb") as f:
            while remaining > 0:
                chunk = self.rfile.read(min(remaining, 1 << 20))
                if not chunk:
                    break
                f.write(chunk)
                h.update(chunk)
                remaining -= len(chunk)
        return h.hexdigest()

    def do_GET(self):
        url = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(url.query).items()}
        if url.path == "/health":
            return self._json({"ffmpeg": bool(FFMPEG), "matting": matting_engines()})
        if url.path == "/matte/status":
            job = JOBS.get(q.get("id", ""))
            return self._json(job or {"state": "unknown"}, 200 if job else 404)
        if url.path == "/matte/mask":
            job = JOBS.get(q.get("id", ""))
            if not job or job["state"] != "done":
                return self._send(404, b"masque pas encore pret", "text/plain")
            with open(job["mask"], "rb") as f:
                return self._send(200, f.read(), "video/mp4")
        return super().do_GET()

    def do_POST(self):
        url = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(url.query).items()}
        if url.path == "/matte":
            return self._matte(q.get("engine", "auto"))
        if url.path != "/convert":
            return self._send(404, b"not found", "text/plain")
        if not FFMPEG:
            return self._send(501, b"ffmpeg n'est pas installe", "text/plain")
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "in.webm")
            dst = os.path.join(tmp, "out.mp4")
            self._read_body(src)
            result = subprocess.run(
                [FFMPEG, "-y", "-loglevel", "error", "-i", src,
                 "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30",
                 "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", dst],
                capture_output=True, text=True,
            )
            if result.returncode != 0:
                return self._send(500, result.stderr[-2000:].encode(), "text/plain")
            with open(dst, "rb") as f:
                data = f.read()
        self._send(200, data, "video/mp4")

    def _matte(self, engine):
        if not FFMPEG:
            return self._json({"error": "ffmpeg n'est pas installé"}, 501)
        if not matting_engines():
            return self._json({"error": "aucun moteur de détourage : pip install -r requirements.txt"}, 501)
        os.makedirs(MATTE_DIR, exist_ok=True)
        tmp = os.path.join(MATTE_DIR, "upload-%d" % threading.get_ident())
        digest = self._read_body(tmp)
        job_id = f"{digest[:16]}-{engine}"
        src = os.path.join(MATTE_DIR, digest[:16] + ".video")
        dst = os.path.join(MATTE_DIR, job_id + ".mask.mp4")
        os.replace(tmp, src)
        with JOBS_LOCK:
            job = JOBS.get(job_id)
            if job and job["state"] in ("running", "done"):
                return self._json({"id": job_id})
            # Même vidéo déjà détourée lors d'une session précédente : on réutilise le masque.
            if os.path.exists(dst):
                JOBS[job_id] = {"state": "done", "done": 1, "total": 1, "engine": engine, "mask": dst}
                return self._json({"id": job_id})
            JOBS[job_id] = {"state": "running", "done": 0, "total": 0, "engine": engine, "mask": dst}
        threading.Thread(target=run_matte, args=(job_id, src, dst, engine), daemon=True).start()
        self._json({"id": job_id})


if __name__ == "__main__":
    url = f"http://localhost:{PORT}/index.html"
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Video Edit Studio -> {url}")
    print("ffmpeg :", FFMPEG or "absent (l'export restera en .webm)")
    print("détourage :", ", ".join(matting_engines()) or "absent (pip install -r requirements.txt)")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
