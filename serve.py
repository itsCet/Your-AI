#!/usr/bin/env python3
"""Serveur local pour Video Edit Studio.

- Sert index.html sur http://localhost:8765
- POST /convert : convertit l'export WebM du navigateur en MP4 (H.264/AAC) via ffmpeg
- GET /health   : indique si ffmpeg est disponible
"""
import http.server
import json
import os
import shutil
import subprocess
import tempfile
import webbrowser

PORT = int(os.environ.get("PORT", "8765"))
ROOT = os.path.dirname(os.path.abspath(__file__))
FFMPEG = shutil.which("ffmpeg")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def _send(self, code, body, ctype):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            return self._send(200, json.dumps({"ffmpeg": bool(FFMPEG)}).encode(), "application/json")
        return super().do_GET()

    def do_POST(self):
        if self.path != "/convert":
            return self._send(404, b"not found", "text/plain")
        if not FFMPEG:
            return self._send(501, b"ffmpeg n'est pas installe", "text/plain")
        remaining = int(self.headers.get("Content-Length", "0"))
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "in.webm")
            dst = os.path.join(tmp, "out.mp4")
            with open(src, "wb") as f:
                while remaining > 0:
                    chunk = self.rfile.read(min(remaining, 1 << 20))
                    if not chunk:
                        break
                    f.write(chunk)
                    remaining -= len(chunk)
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


if __name__ == "__main__":
    url = f"http://localhost:{PORT}/index.html"
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Video Edit Studio -> {url}")
    print("ffmpeg :", FFMPEG or "absent (l'export restera en .webm)")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
