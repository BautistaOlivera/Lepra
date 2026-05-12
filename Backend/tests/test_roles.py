"""require_roles con token simulado (sin app FastAPI)."""
from unittest.mock import patch

from fastapi.responses import JSONResponse

from auth.roles import require_roles


def test_require_roles_allowed():
    payload = {"sub": "1", "role": "admin"}
    with patch("auth.roles.Security.verify_token", return_value=payload):
        out = require_roles({"authorization": "Bearer x"}, ["ADMIN", "USER"])
    assert out == payload


def test_require_roles_forbidden():
    payload = {"sub": "1", "role": "CLIENT"}
    with patch("auth.roles.Security.verify_token", return_value=payload):
        out = require_roles({"authorization": "Bearer x"}, ["ADMIN"])
    assert isinstance(out, JSONResponse)
    assert out.status_code == 403


def test_require_roles_missing_sub():
    payload = {"message": "Token inválido"}
    with patch("auth.roles.Security.verify_token", return_value=payload):
        out = require_roles({"authorization": "Bearer x"}, ["ADMIN"])
    assert isinstance(out, JSONResponse)
    assert out.status_code == 401
