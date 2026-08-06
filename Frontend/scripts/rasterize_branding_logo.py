#!/usr/bin/env python3
"""Genera public/branding/lepra-logo-watermark.png desde el PDF de marca."""
from pathlib import Path
import sys

root = Path(__file__).resolve().parent.parent
pdf_path = root / "public" / "branding" / "lepra-logo.pdf"
out_path = root / "public" / "branding" / "lepra-logo-watermark.png"

if not pdf_path.is_file():
    raise SystemExit(f"No existe: {pdf_path}")

try:
    import fitz  # pymupdf
except ImportError:
    if out_path.is_file():
        print(
            f"Aviso: falta pymupdf (pip install pymupdf). "
            f"Se reutiliza el PNG existente: {out_path}",
            file=sys.stderr,
        )
        raise SystemExit(0)
    raise SystemExit(
        "Falta el módulo fitz (pymupdf). Instalá con:\n"
        "  pip install pymupdf\n"
        "y volvé a correr npm run build."
    )

doc = fitz.open(pdf_path)
page = doc[0]
pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=True)
out_path.parent.mkdir(parents=True, exist_ok=True)
pix.save(str(out_path))
doc.close()
print(f"Generado {out_path}")
