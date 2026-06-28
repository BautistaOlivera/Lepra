from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import os

from config.db import Base, engine
from models import User, Product
from models.order import Order, OrderProduct
from models.product_price_tier import ProductPriceTier

from routes.auth import auth
from routes.user import user_router
from routes.product import product_router
from routes.product_price_tier import tier_router
from routes.order import order_router
from routes.sync import sync_router
from routes.stats import stats_router

lepra = FastAPI(title="El Lepra API", description="API para catálogo, pedidos y tickets")

Base.metadata.create_all(bind=engine)

lepra.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

lepra.include_router(auth)
lepra.include_router(user_router)
lepra.include_router(product_router)
lepra.include_router(tier_router)
lepra.include_router(order_router)
lepra.include_router(sync_router)
lepra.include_router(stats_router)


@lepra.get("/health")
async def health():
    """Ping simple para probar conectividad desde el navegador (incl. tablets viejas)."""
    return {"ok": True}


# Servir imágenes subidas (uploads)
uploads_path = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(uploads_path, exist_ok=True)


@lepra.get("/uploads/lepra-logo-watermark.png")
async def branding_logo_png():
    """Logo del comprobante (PNG); ruta explícita antes del mount estático."""
    path = os.path.join(uploads_path, "lepra-logo-watermark.png")
    branding_png_src = os.path.join(os.path.dirname(__file__), "branding", "lepra-logo-watermark.png")
    if not os.path.isfile(path) and os.path.isfile(branding_png_src):
        path = branding_png_src
    if not os.path.isfile(path):
        return JSONResponse(status_code=404, content={"message": "Logo no encontrado"})
    return FileResponse(
        path,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400"},
    )


lepra.mount("/uploads", StaticFiles(directory=uploads_path), name="uploads")
