import os
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt
from jose.exceptions import ExpiredSignatureError, JWTError
from fastapi.security import OAuth2PasswordBearer

SECRET_KEY = os.getenv("SECRET_KEY", "cambiar_en_produccion_clave_secreta_lepra")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8") if isinstance(hashed_password, str) else hashed_password,
    )


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


class Security:
    secret = SECRET_KEY

    @classmethod
    def verify_token(cls, headers: dict) -> dict:
        if "authorization" not in headers:
            return {"message": "Authorization header faltante"}

        try:
            auth_header = headers["authorization"]
            if not auth_header.startswith("Bearer "):
                return {"message": "Formato de token inválido"}

            token = auth_header.split(" ")[1]
            payload = jwt.decode(token, cls.secret, algorithms=[ALGORITHM])
            return payload

        except ExpiredSignatureError:
            return {"message": "Token expirado"}
        except JWTError:
            return {"message": "Token inválido"}
        except Exception as e:
            return {"message": "Error al verificar token", "detail": str(e)}
