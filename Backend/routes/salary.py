from datetime import datetime, timezone

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select

from auth.roles import require_roles
from config.db import AsyncSessionLocal
from models.salary import EmployeeSalaryMonth, InputSalaryMonth
from models.user import User
from routes.sync import _salary_dict

salary_router = APIRouter(prefix="/salary", tags=["Salary"])


def _utcnow_naive():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _validate(body: InputSalaryMonth):
    if body.month < 1 or body.month > 12:
        return JSONResponse(status_code=400, content={"message": "Mes inválido"})
    if body.year < 2000 or body.year > 2100:
        return JSONResponse(status_code=400, content={"message": "Año inválido"})
    note = (body.note or "").strip() or None
    if not body.paid:
        return {"paid": False, "amount": None, "paid_at": None, "note": note}
    if body.amount is None:
        return JSONResponse(status_code=400, content={"message": "Indicá el monto del sueldo"})
    try:
        amount = float(body.amount)
    except (TypeError, ValueError):
        return JSONResponse(status_code=400, content={"message": "Monto inválido"})
    if amount < 0:
        return JSONResponse(status_code=400, content={"message": "El monto no puede ser negativo"})
    if body.paid_at is None:
        return JSONResponse(status_code=400, content={"message": "Indicá la fecha de pago"})
    return {"paid": True, "amount": round(amount, 2), "paid_at": body.paid_at, "note": note}


@salary_router.get("/year")
async def list_salary_year(req: Request, id_user: int, year: int):
    """Meses de sueldo de un empleado. Solo ADMIN."""
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    async with AsyncSessionLocal() as session:
        user = await session.get(User, id_user)
        if not user or (user.rol or "").upper() != "EMPLOYEE":
            return JSONResponse(status_code=404, content={"message": "Empleado no encontrado"})
        stmt = select(EmployeeSalaryMonth).where(
            EmployeeSalaryMonth.id_user == id_user,
            EmployeeSalaryMonth.year == year,
        )
        result = await session.execute(stmt)
        rows = result.scalars().all()

    return JSONResponse(
        status_code=200,
        content={"items": [_salary_dict(row) for row in rows]},
    )


@salary_router.put("/month")
async def upsert_salary_month(req: Request, body: InputSalaryMonth):
    """Marca un mes como pagado o impago. Solo ADMIN."""
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    parsed = _validate(body)
    if isinstance(parsed, JSONResponse):
        return parsed

    async with AsyncSessionLocal() as session:
        user = await session.get(User, body.id_user)
        if not user or (user.rol or "").upper() != "EMPLOYEE":
            return JSONResponse(status_code=404, content={"message": "Empleado no encontrado"})

        stmt = select(EmployeeSalaryMonth).where(
            EmployeeSalaryMonth.id_user == body.id_user,
            EmployeeSalaryMonth.year == body.year,
            EmployeeSalaryMonth.month == body.month,
        )
        row = (await session.execute(stmt)).scalar_one_or_none()
        if row is None:
            row = EmployeeSalaryMonth(
                id_user=body.id_user,
                year=body.year,
                month=body.month,
            )
            session.add(row)

        row.paid = parsed["paid"]
        row.amount = parsed["amount"]
        row.paid_at = parsed["paid_at"]
        row.note = parsed["note"]
        row.updated_at = _utcnow_naive()
        await session.commit()
        await session.refresh(row)
        return JSONResponse(status_code=200, content={"month": _salary_dict(row)})
