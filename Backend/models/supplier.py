from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from pydantic import BaseModel
from config.db import Base


def _utcnow_naive():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    updated_at = Column(DateTime, default=_utcnow_naive, onupdate=_utcnow_naive, nullable=False)

    purchases = relationship("Purchase", back_populates="supplier")


class InputSupplier(BaseModel):
    name: str


class InputSupplierUpdate(BaseModel):
    id: int
    name: str | None = None
    active: bool | None = None
