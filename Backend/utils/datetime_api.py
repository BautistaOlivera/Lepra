"""Serialización de datetimes para JSON consumido por el frontend (JS)."""
from __future__ import annotations

from datetime import datetime


def utc_naive_iso(dt: datetime | None) -> str | None:
    """
    Convierte un datetime naive almacenado en UTC a string ISO que JS parsea como UTC.

    Sin sufijo Z/offset, ECMAScript trata 'YYYY-MM-DDTHH:mm:ss' como hora *local*, y la
    hora mostrada queda desfasada respecto al UTC guardado en BD.
    """
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.isoformat()
    s = dt.isoformat()
    if s.endswith("Z") or s.endswith("+00:00"):
        return s
    return f"{s}Z"
