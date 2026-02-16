from typing import Optional
from sqlalchemy import Column, Integer, Float, ForeignKey
from sqlalchemy.orm import relationship
from pydantic import BaseModel
from config.db import Base


class ProductPriceTier(Base):
    __tablename__ = "product_price_tiers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_product = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    min_quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)

    product = relationship("Product", back_populates="price_tiers")


class ProductPriceTierCreate(BaseModel):
    id_product: int
    min_quantity: int
    unit_price: float


class ProductPriceTierResponse(BaseModel):
    id: int
    id_product: int
    min_quantity: int
    unit_price: float

    class Config:
        from_attributes = True


class InputProductPriceTier(BaseModel):
    id_product: int
    min_quantity: int
    unit_price: float


class InputProductPriceTierUpdate(BaseModel):
    id: int
    min_quantity: Optional[int] = None
    unit_price: Optional[float] = None

