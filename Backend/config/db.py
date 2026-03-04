"""
Configuración de base de datos.
- En producción (Render): usar DATABASE_URL o INTERNAL_DATABASE_URL si está definida.
- En desarrollo: variables DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME o .env.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Render (y otros PaaS) inyectan DATABASE_URL o INTERNAL_DATABASE_URL al enlazar Postgres
_url = os.getenv("INTERNAL_DATABASE_URL") or os.getenv("DATABASE_URL")
if _url:
    SYNC_DATABASE_URL = _url
    ASYNC_DATABASE_URL = _url.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "lepra")
    SYNC_DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    ASYNC_DATABASE_URL = f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(
    SYNC_DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_timeout=10,
    pool_recycle=1800,
    echo=False,
)

async_engine = create_async_engine(
    ASYNC_DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_timeout=10,
    pool_recycle=1800,
    echo=False,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
AsyncSessionLocal = sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()
