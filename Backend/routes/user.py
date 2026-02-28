from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
import traceback

from models import User, InputUser, InputUserUpdate, InputPaginatedRequestFilter
from config.db import AsyncSessionLocal
from auth.roles import require_roles
from auth.security import hash_password

user_router = APIRouter(prefix="/user", tags=["User"])


@user_router.post("/paginated")
async def get_users_paginated(req: Request, body: InputPaginatedRequestFilter):
    """Lista paginada de usuarios. Solo ADMIN."""
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    limit = body.limit or 20
    last_seen_id = body.last_seen_id
    filters = body.filters or {}
    search = (filters.get("search") or "").strip()
    role_filter = filters.get("rol") or filters.get("role")
    active_filter = filters.get("active")

    async with AsyncSessionLocal() as session:
        stmt = select(User)
        if search:
            stmt = stmt.where(
                User.email.ilike(f"%{search}%") | User.name.ilike(f"%{search}%")
            )
        if role_filter:
            stmt = stmt.where(User.rol == str(role_filter).upper())
        if active_filter is True:
            stmt = stmt.where(User.active.is_(True))
        elif active_filter is False:
            stmt = stmt.where(User.active.is_(False))

        stmt = stmt.order_by(User.id.desc())
        if last_seen_id is not None:
            stmt = stmt.where(User.id < last_seen_id)
        stmt = stmt.limit(limit)

        result = await session.execute(stmt)
        users = result.scalars().unique().all()

        return JSONResponse(
            status_code=200,
            content={
                "items": [
                    {
                        "id": u.id,
                        "email": u.email,
                        "name": u.name,
                        "location": u.location,
                        "rol": u.rol,
                        "active": u.active,
                    }
                    for u in users
                ],
                "next_cursor": users[-1].id if len(users) == limit else None,
            },
        )


@user_router.get("/{user_id}")
async def get_user(req: Request, user_id: int):
    """Obtener usuario por id. ADMIN: cualquiera. CLIENT: solo el propio."""
    payload = require_roles(req.headers, ["CLIENT", "ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    current_id = int(payload["sub"])
    role = payload.get("role", "").upper()
    if role == "CLIENT" and current_id != user_id:
        return JSONResponse(status_code=403, content={"message": "Acceso denegado"})

    async with AsyncSessionLocal() as session:
        stmt = select(User).where(User.id == user_id)
        result = await session.execute(stmt)
        u = result.scalar_one_or_none()
        if not u:
            return JSONResponse(status_code=404, content={"message": "Usuario no encontrado"})

        return JSONResponse(
            status_code=200,
            content={
                "id": u.id,
                "email": u.email,
                "name": u.name,
                "location": u.location,
                "rol": u.rol,
                "active": u.active,
            },
        )


@user_router.post("/create")
async def create_user(req: Request, body: InputUser):
    """Crear usuario. Solo ADMIN."""
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    try:
        async with AsyncSessionLocal() as session:
            stmt = select(User).where(User.email == body.email)
            result = await session.execute(stmt)
            if result.scalar_one_or_none():
                return JSONResponse(status_code=400, content={"message": "El email ya está registrado"})

            new_user = User(
                email=body.email,
                password=hash_password(body.password),
                name=body.name,
                location=body.location,
                rol=body.rol.upper(),
            )
            session.add(new_user)
            await session.commit()
            await session.refresh(new_user)
            return JSONResponse(
                status_code=201,
                content={
                    "message": "Usuario creado",
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
        return JSONResponse(status_code=500, content={"message": "Error al crear usuario"})


@user_router.put("/update")
async def update_user(req: Request, body: InputUserUpdate):
    """Actualizar usuario. Solo ADMIN."""
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    try:
        async with AsyncSessionLocal() as session:
            stmt = select(User).where(User.id == body.id)
            result = await session.execute(stmt)
            u = result.scalar_one_or_none()
            if not u:
                return JSONResponse(status_code=404, content={"message": "Usuario no encontrado"})

            if body.email is not None:
                u.email = body.email
            if body.name is not None:
                u.name = body.name
            if body.location is not None:
                u.location = body.location
            if body.rol is not None:
                u.rol = body.rol.upper()
            if body.password is not None and body.password.strip():
                u.password = hash_password(body.password)
            if body.active is not None:
                u.active = body.active

            await session.commit()
            await session.refresh(u)
            return JSONResponse(status_code=200, content={"message": "Usuario actualizado"})
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"message": "Error al actualizar usuario"})


@user_router.put("/{user_id}/deactivate")
async def deactivate_user(req: Request, user_id: int):
    """Baja lógica de usuario. Solo ADMIN."""
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    async with AsyncSessionLocal() as session:
        stmt = select(User).where(User.id == user_id)
        result = await session.execute(stmt)
        u = result.scalar_one_or_none()
        if not u:
            return JSONResponse(status_code=404, content={"message": "Usuario no encontrado"})
        u.active = False
        await session.commit()
        return JSONResponse(status_code=200, content={"message": "Usuario desactivado"})
