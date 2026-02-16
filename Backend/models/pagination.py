from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class InputPaginatedRequestFilter(BaseModel):
    limit: int = Field(default=20, gt=0, le=100)
    last_seen_id: Optional[int] = Field(default=None)
    filters: Optional[Dict[str, Any]] = Field(default=None)
