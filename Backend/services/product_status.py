"""Estados de producto (visibilidad admin / catálogo, no inventario real)."""

STATUS_ACTIVE = "active"
STATUS_SIN_STOCK = "sin_stock"
STATUS_INACTIVE = "inactive"

CATALOG_STATUSES = (STATUS_ACTIVE,)
ADMIN_VISIBLE_STATUSES = (STATUS_ACTIVE, STATUS_SIN_STOCK)


def sync_active_flag(status: str) -> bool:
    return status != STATUS_INACTIVE
