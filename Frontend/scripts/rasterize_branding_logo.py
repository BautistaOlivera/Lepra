#!/usr/bin/env python3
"""Genera public/branding/lepra-logo-watermark.png desde el PDF de marca."""
from pathlib import Path

import fitz  # pymupdf

root = Path(__file__).resolve().parent.parent
pdf_path = root / "public" / "branding" / "lepra-logo.pdf"
out_path = root / "public" / "branding" / "lepra-logo-watermark.png"

if not pdf_path.is_file():
    raise SystemExit(f"No existe: {pdf_path}")

doc = fitz.open(pdf_path)
page = doc[0]
pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=True)
out_path.parent.mkdir(parents=True, exist_ok=True)
pix.save(str(out_path))
doc.close()
print(f"Generado {out_path}")
