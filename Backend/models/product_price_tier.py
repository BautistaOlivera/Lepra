from typing import Optional
from sqlalchemy import Column, Integer, Float, ForeignKey
from sqlalchemy.orm import relationship
from pydantic import BaseModel
from config.db import Base


class ProductPriceTier(Base):
    __tablename__ = "product_price_tiers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_product = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    min_kg = Column(Float, nullable=False)
    price_per_kg = Column(Float, nullable=False)

    product = relationship("Product", back_populates="price_tiers")


class ProductPriceTierCreate(BaseModel):
    id_product: int
    min_kg: float
    price_per_kg: float


class ProductPriceTierResponse(BaseModel):
    id: int
    id_product: int
    min_kg: float
    price_per_kg: float

    class Config:
        from_attributes = True


class InputProductPriceTier(BaseModel):
    id_product: int
    min_kg: float
    price_per_kg: float


class InputProductPriceTierUpdate(BaseModel):
    id: int
    min_kg: Optional[float] = None
    price_per_kg: Optional[float] = None
