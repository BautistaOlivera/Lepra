from typing import Optional
from sqlalchemy import Column, Integer, String, Boolean, Float
from sqlalchemy.orm import relationship
from pydantic import BaseModel
from config.db import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    brand = Column(String, nullable=True)
    category = Column(String, nullable=True)
    has_tiered_pricing = Column(Boolean, default=False)
    img = Column(String, nullable=True)
    active = Column(Boolean, default=True)

    price_tiers = relationship("ProductPriceTier", back_populates="product", cascade="all, delete-orphan")
    order_products = relationship("OrderProduct", back_populates="product")


class ProductBase(BaseModel):
    name: str
    price: float
    brand: Optional[str] = None
    category: Optional[str] = None
    has_tiered_pricing: bool = False
    img: Optional[str] = None


class ProductResponse(ProductBase):
    id: int
    active: bool = True

    class Config:
        from_attributes = True


class InputProduct(BaseModel):
    name: str
    price: float
    brand: Optional[str] = None
    category: Optional[str] = None
    has_tiered_pricing: bool = False
    img: Optional[str] = None


class InputProductUpdate(BaseModel):
    id: int
    name: Optional[str] = None
    price: Optional[float] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    has_tiered_pricing: Optional[bool] = None
    img: Optional[str] = None
    active: Optional[bool] = None
