from typing import Optional, List
from datetime import datetime, timezone, date
from sqlalchemy import Column, Integer, Float, String, Boolean, ForeignKey, Date, DateTime
from sqlalchemy.orm import relationship
from pydantic import BaseModel
from config.db import Base

def _utcnow_naive():
    return datetime.now(timezone.utc).replace(tzinfo=None)

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_user = Column(Integer, ForeignKey("users.id"), nullable=True)
    customer_name = Column(String, nullable=True)
    total = Column(Float, default=0.0)
    date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=_utcnow_naive)
    updated_at = Column(DateTime, default=_utcnow_naive, onupdate=_utcnow_naive, nullable=False)
    payment = Column(String, nullable=True)
    status = Column(String, default="PENDING")
    active = Column(Boolean, default=True)

    user = relationship("User", back_populates="orders", foreign_keys=[id_user])
    order_products = relationship(
        "OrderProduct",
        back_populates="order",
        cascade="all, delete-orphan",
    )


class OrderProduct(Base):
    __tablename__ = "order_products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_order = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    id_product = Column(Integer, ForeignKey("products.id"), nullable=False)
    weight = Column(Float, nullable=False)
    price_per_kg = Column(Float, nullable=False)

    order = relationship("Order", back_populates="order_products")
    product = relationship("Product", back_populates="order_products")


# Pydantic schemas

class OrderProductCreate(BaseModel):
    id_product: int
    weight: float
    price_per_kg: float


class OrderLineClientInput(BaseModel):
    """Línea de pedido cliente: peso total en kg; price_per_kg se calcula en backend."""
    id_product: int
    weight: float


class OrderLineAdminInput(BaseModel):
    """Línea admin: peso en kg; price_per_kg opcional (si no viene, se calcula)."""
    id_product: int
    weight: float
    price_per_kg: Optional[float] = None


class OrderCreateClient(BaseModel):
    date: Optional[date] = None
    payment: Optional[str] = None
    lines: List[OrderLineClientInput]


class OrderCreateAdmin(BaseModel):
    id_user: Optional[int] = None
    customer_name: Optional[str] = None
    date: Optional[date] = None
    payment: Optional[str] = None
    lines: List[OrderLineAdminInput]


class OrderProductResponse(BaseModel):
    id: int
    id_order: int
    id_product: int
    weight: float
    price_per_kg: float

    class Config:
        from_attributes = True


class OrderCreate(BaseModel):
    id_user: int
    date: Optional[date] = None
    payment: Optional[str] = None
    lines: List[OrderProductCreate]


class OrderResponse(BaseModel):
    id: int
    id_user: int
    total: float
    date: Optional[date] = None
    created_at: Optional[datetime] = None
    payment: Optional[str] = None
    status: str
    active: bool = True

    class Config:
        from_attributes = True


class OrderUpdate(BaseModel):
    date: Optional[date] = None
    payment: Optional[str] = None
    status: Optional[str] = None
    active: Optional[bool] = None


class InputOrder(BaseModel):
    id_user: int
    date: Optional[date] = None
    payment: Optional[str] = None
    lines: List[OrderProductCreate]


class InputOrderUpdate(BaseModel):
    id: int
    id_user: Optional[int] = None
    date: Optional[date] = None
    payment: Optional[str] = None
    status: Optional[str] = None
    active: Optional[bool] = None
    lines: Optional[List[OrderProductCreate]] = None
