from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from datetime import timedelta
import traceback

from models import User, SignupRequest, LoginRequest
from config.db import AsyncSessionLocal
from auth.security import (
    hash_password,
    verify_password,
    create_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from auth.roles import require_roles

auth = APIRouter(prefix="/auth", tags=["Auth"])


@auth.post("/signup")
async def signup(req: Request, user_data: SignupRequest):
    """Registrar un nuevo usuario (cliente o administrador)."""
    try:
        async with AsyncSessionLocal() as session:
            stmt = select(User).where(User.email == user_data.email)
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()

            if existing:
                return JSONResponse(
                    status_code=400,
                    content={"message": "El email ya está registrado"},
                )

            new_user = User(
                email=user_data.email,
                name=user_data.name,
                password=hash_password(user_data.password),
                location=user_data.location,
                rol=user_data.rol.upper(),
            )
            session.add(new_user)
            await session.commit()
            await session.refresh(new_user)

            return JSONResponse(
                status_code=201,
                content={
                    "message": "Usuario registrado",
                    "user": {
                        "id": new_user.id,
                        "email": new_user.email,
                        "name": new_user.name,
                        "rol": new_user.rol,
                    },
                },
            )
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"message": "Error al registrar usuario"})


@auth.post("/login")
async def login(req: Request, credentials: LoginRequest):
    """Iniciar sesión y obtener token JWT."""
    try:
        async with AsyncSessionLocal() as session:
            stmt = select(User).where(User.email == credentials.email)
            result = await session.execute(stmt)
            user = result.scalar_one_or_none()

            if not user:
                return JSONResponse(status_code=401, content={"message": "Credenciales incorrectas"})

            if not verify_password(credentials.password, user.password):
                return JSONResponse(status_code=401, content={"message": "Credenciales incorrectas"})

            if not user.active:
                return JSONResponse(status_code=403, content={"message": "Usuario desactivado"})

            access_token = create_access_token(
                data={
                    "sub": str(user.id),
                    "email": user.email,
                    "role": user.rol,
                },
                expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
            )

            return JSONResponse(
                status_code=200,
                content={
                    "access_token": access_token,
                    "token_type": "bearer",
                    "user": {
                        "id": user.id,
                        "name": user.name or user.email.split("@")[0],
                        "email": user.email,
                        "rol": user.rol,
                        "active": user.active,
                    },
                },
            )
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"message": "Error al iniciar sesión"})


@auth.get("/me")
async def get_me(req: Request):
    """Obtener el usuario autenticado."""
    payload = require_roles(req.headers, ["CLIENT", "ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    user_id = int(payload["sub"])
    async with AsyncSessionLocal() as session:
        stmt = select(User).where(User.id == user_id)
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            return JSONResponse(status_code=404, content={"message": "Usuario no encontrado"})

        return JSONResponse(
            status_code=200,
            content={
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "location": user.location,
                "rol": user.rol,
                "active": user.active,
            },
        )
