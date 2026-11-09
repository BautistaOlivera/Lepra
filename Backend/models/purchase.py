from typing import Optional, List
from datetime import datetime, timezone, date

# Un campo llamado date no puede anotarse con date: Python resuelve ese nombre como None.
DateValue = date
from sqlalchemy import Column, Integer, Float, String, Boolean, ForeignKey, Date, DateTime
from sqlalchemy.orm import relationship
from pydantic import BaseModel
from config.db import Base


def _utcnow_naive():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Purchase(Base):
    __tablename__ = "purchases"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_supplier = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    date = Column(Date, nullable=False)
    unitemized_amount = Column(Float, default=0.0, nullable=False)
    total = Column(Float, default=0.0, nullable=False)
    note = Column(String, nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=_utcnow_naive)
    updated_at = Column(DateTime, default=_utcnow_naive, onupdate=_utcnow_naive, nullable=False)

    supplier = relationship("Supplier", back_populates="purchases")
    lines = relationship(
        "PurchaseLine",
        back_populates="purchase",
        cascade="all, delete-orphan",
    )


class PurchaseLine(Base):
    __tablename__ = "purchase_lines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_purchase = Column(Integer, ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False)
    id_product = Column(Integer, ForeignKey("products.id"), nullable=False)
    weight = Column(Float, nullable=False)
    price_per_kg = Column(Float, nullable=False)

    purchase = relationship("Purchase", back_populates="lines")
    product = relationship("Product")


class PurchaseLineInput(BaseModel):
    id_product: int
    weight: float
    price_per_kg: float


class InputPurchase(BaseModel):
    id_supplier: int
    date: Optional[DateValue] = None
    unitemized_amount: float = 0
    note: Optional[str] = None
    lines: List[PurchaseLineInput] = []


class InputPurchaseUpdate(BaseModel):
    id: int
    id_supplier: Optional[int] = None
    date: Optional[DateValue] = None
    unitemized_amount: Optional[float] = None
    note: Optional[str] = None
    lines: Optional[List[PurchaseLineInput]] = None
