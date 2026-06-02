#!/usr/bin/env python3
"""Copia el logo PNG de marca a uploads/ (comprobantes PDF)."""
from __future__ import annotations

import os
import shutil
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_PNG = os.path.join(BACKEND_DIR, "..", "Frontend", "public", "branding", "lepra-logo-watermark.png")
BRANDING_SRC = os.path.join(BACKEND_DIR, "branding", "lepra-logo-watermark.png")
UPLOADS_DIR = os.path.join(BACKEND_DIR, "uploads")
UPLOADS_DST = os.path.join(UPLOADS_DIR, "lepra-logo-watermark.png")


def main() -> int:
    src = BRANDING_SRC if os.path.isfile(BRANDING_SRC) else FRONTEND_PNG
    if not os.path.isfile(src):
        print(f"No existe PNG de marca: {BRANDING_SRC} ni {FRONTEND_PNG}", file=sys.stderr)
        return 1
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    shutil.copy2(src, UPLOADS_DST)
    if src != BRANDING_SRC:
        shutil.copy2(src, BRANDING_SRC)
    print(f"Logo copiado a {UPLOADS_DST}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
