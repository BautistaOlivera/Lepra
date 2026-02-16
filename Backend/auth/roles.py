from typing import List, Union
from fastapi.responses import JSONResponse
from auth.security import Security


def require_roles(headers: dict, allowed_roles: List[str]) -> Union[dict, JSONResponse]:
    payload = Security.verify_token(headers)
    if "sub" not in payload:
        return JSONResponse(status_code=401, content=payload)

    user_role = payload.get("role", "").upper()
    normalized_allowed = [r.upper() for r in allowed_roles]

    if user_role not in normalized_allowed:
        return JSONResponse(status_code=403, content={"message": "Acceso denegado"})

    return payload
