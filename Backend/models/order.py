from typing import Optional, List
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, String, Boolean, ForeignKey, Date, DateTime
from sqlalchemy.orm import relationship
from pydantic import BaseModel
from config.db import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_user = Column(Integer, ForeignKey("users.id"), nullable=False)
    total = Column(Float, default=0.0)
    date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
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
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)

    order = relationship("Order", back_populates="order_products")
    product = relationship("Product", back_populates="order_products")


# Pydantic schemas

class OrderProductCreate(BaseModel):
    id_product: int
    quantity: int
    unit_price: float


class OrderLineClientInput(BaseModel):
    """Solo id_product y quantity; unit_price se calcula en backend."""
    id_product: int
    quantity: int


class OrderLineAdminInput(BaseModel):
    """id_product, quantity y opcional unit_price (si viene, se usa; si no, se calcula)."""
    id_product: int
    quantity: int
    unit_price: Optional[float] = None


class OrderCreateClient(BaseModel):
    """Crear pedido como cliente: id_user = usuario logueado, líneas sin precio."""
    date: Optional[date] = None
    payment: Optional[str] = None
    lines: List[OrderLineClientInput]


class OrderCreateAdmin(BaseModel):
    """Crear pedido como admin: id_user en body, líneas con unit_price opcional."""
    id_user: int
    date: Optional[date] = None
    payment: Optional[str] = None
    lines: List[OrderLineAdminInput]


class OrderProductResponse(BaseModel):
    id: int
    id_order: int
    id_product: int
    quantity: int
    unit_price: float

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
