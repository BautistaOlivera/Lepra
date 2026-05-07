"""Auth helpers (sin importar app ni conectar a Postgres)."""
from jose import jwt

from auth.security import (
    ALGORITHM,
    SECRET_KEY,
    Security,
    create_access_token,
    hash_password,
    verify_password,
)


def test_hash_and_verify_roundtrip():
    h = hash_password("secret123")
    assert verify_password("secret123", h) is True
    assert verify_password("wrong", h) is False


def test_create_and_decode_token():
    token = create_access_token({"sub": "1", "role": "ADMIN"})
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert payload["sub"] == "1"
    assert payload["role"] == "ADMIN"
    assert "exp" in payload


def test_verify_token_missing_header():
    out = Security.verify_token({})
    assert "message" in out


def test_verify_token_invalid_format():
    out = Security.verify_token({"authorization": "Basic xxx"})
    assert "message" in out


def test_verify_token_bad_jwt():
    out = Security.verify_token({"authorization": "Bearer not-a-jwt"})
    assert out.get("message") == "Token inválido"
