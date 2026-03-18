from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from pydantic import BaseModel
from config.db import Base

def _utcnow_naive():
    # Guardamos UTC sin tzinfo para evitar problemas con drivers/config
    return datetime.now(timezone.utc).replace(tzinfo=None)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=True)
    password = Column(String, nullable=True)
    location = Column(String, nullable=True)
    rol = Column(String, nullable=False)
    active = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=_utcnow_naive, onupdate=_utcnow_naive, nullable=False)

    orders = relationship("Order", back_populates="user", foreign_keys="Order.id_user")


class UserBase(BaseModel):
    email: Optional[str] = None
    name: str
    location: Optional[str] = None
    rol: str


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    active: bool = True

    class Config:
        from_attributes = True


class SignupRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None
    location: Optional[str] = None
    rol: str = "CLIENT"


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserAuthResponse(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    rol: str
    active: bool = True

    class Config:
        from_attributes = True


class InputUser(BaseModel):
    email: str
    password: str
    name: Optional[str] = None
    location: Optional[str] = None
    rol: str


class InputUserUpdate(BaseModel):
    id: int
    email: Optional[str] = None
    password: Optional[str] = None
    name: Optional[str] = None
    location: Optional[str] = None
    rol: Optional[str] = None
    active: Optional[bool] = None
