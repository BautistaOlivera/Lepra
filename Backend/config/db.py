"""
Configuración de base de datos.
- Producción / desarrollo con URL completa: DATABASE_URL (o INTERNAL_DATABASE_URL si está definida).
- Desarrollo sin URL: DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME.
"""
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# Prioridad: INTERNAL_DATABASE_URL, luego DATABASE_URL; si no hay, variables DB_* locales
_url = os.getenv("INTERNAL_DATABASE_URL") or os.getenv("DATABASE_URL")
if _url:
    SYNC_DATABASE_URL = _url
    ASYNC_DATABASE_URL = _url.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "123")
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
