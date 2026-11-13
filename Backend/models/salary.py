from datetime import datetime, timezone, date
from typing import Optional

from sqlalchemy import Column, Integer, Float, String, Boolean, ForeignKey, Date, DateTime, UniqueConstraint
from pydantic import BaseModel

from config.db import Base

DateValue = date


def _utcnow_naive():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class EmployeeSalaryMonth(Base):
    __tablename__ = "employee_salary_months"
    __table_args__ = (
        UniqueConstraint("id_user", "year", "month", name="uq_salary_user_month"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_user = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    paid = Column(Boolean, nullable=False, default=False)
    amount = Column(Float, nullable=True)
    paid_at = Column(Date, nullable=True)
    note = Column(String, nullable=True)
    updated_at = Column(DateTime, default=_utcnow_naive, onupdate=_utcnow_naive, nullable=False)


class InputSalaryMonth(BaseModel):
    id_user: int
    year: int
    month: int
    paid: bool
    amount: Optional[float] = None
    paid_at: Optional[DateValue] = None
    note: Optional[str] = None
