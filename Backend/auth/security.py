import os
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer

SECRET_KEY = os.getenv("SECRET_KEY", "cambiar_en_produccion_clave_secreta_lepra")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
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

        except jwt.ExpiredSignatureError:
            return {"message": "Token expirado"}
        except jwt.InvalidSignatureError:
            return {"message": "Firma de token inválida"}
        except jwt.DecodeError:
            return {"message": "Token inválido"}
        except Exception as e:
            return {"message": "Error al verificar token", "detail": str(e)}
