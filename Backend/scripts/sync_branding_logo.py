#!/usr/bin/env python3
"""Copia el logo de marca a uploads/ para servirlo en /uploads/lepra-logo.pdf."""
from __future__ import annotations

import os
import shutil
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRANDING_SRC = os.path.join(BACKEND_DIR, "branding", "lepra-logo.pdf")
UPLOADS_DIR = os.path.join(BACKEND_DIR, "uploads")
UPLOADS_DST = os.path.join(UPLOADS_DIR, "lepra-logo.pdf")


def main() -> int:
    if not os.path.isfile(BRANDING_SRC):
        print(f"No existe el archivo de marca: {BRANDING_SRC}", file=sys.stderr)
        return 1
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    shutil.copy2(BRANDING_SRC, UPLOADS_DST)
    print(f"Logo copiado a {UPLOADS_DST}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
