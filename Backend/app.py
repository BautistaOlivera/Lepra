from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.db import Base, engine
from models import User, Product
from models.order import Order, OrderProduct
from models.product_price_tier import ProductPriceTier

from routes.auth import auth
from routes.user import user_router
from routes.product import product_router
from routes.product_price_tier import tier_router
from routes.order import order_router

lepra = FastAPI(title="Lepra API", description="API para catálogo, pedidos y tickets")

Base.metadata.create_all(bind=engine)

lepra.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
)

lepra.include_router(auth)
lepra.include_router(user_router)
lepra.include_router(product_router)
lepra.include_router(tier_router)
lepra.include_router(order_router)
