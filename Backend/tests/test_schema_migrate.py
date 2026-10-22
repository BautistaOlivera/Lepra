"""El sync de columnas no debe reescribir datos ya migrados."""
from services.schema_migrate import _apply_kg_pricing, _apply_product_status


class _Result:
    def __init__(self, value):
        self._value = value

    def scalar(self):
        return self._value


class _Conn:
    def __init__(self, columns):
        self.columns = set(columns)
        self.sql = []

    def execute(self, clause, params=None):
        statement = str(clause)
        self.sql.append(statement)
        if "information_schema.columns" in statement:
            key = (params["table"], params["column"])
            return _Result(1 if key in self.columns else None)
        return _Result(None)


def test_product_status_backfill_runs_only_while_in_stock_exists():
    pending = _Conn({("products", "active"), ("products", "in_stock")})
    _apply_product_status(pending)
    joined = "\n".join(pending.sql)
    assert "ADD COLUMN status" in joined
    assert "WHEN in_stock = FALSE THEN 'sin_stock'" in joined
    assert "DROP COLUMN in_stock" in joined

    done = _Conn({("products", "active"), ("products", "status")})
    _apply_product_status(done)
    assert not any("UPDATE products SET status" in stmt for stmt in done.sql)
    assert not any("DROP COLUMN in_stock" in stmt for stmt in done.sql)


def test_kg_pricing_renames_old_columns_and_leaves_weight_nullable():
    conn = _Conn(
        {
            ("product_price_tiers", "min_quantity"),
            ("product_price_tiers", "unit_price"),
            ("order_products", "quantity"),
            ("order_products", "unit_price"),
            ("order_products", "weight"),
        }
    )
    _apply_kg_pricing(conn)
    joined = "\n".join(conn.sql)
    assert "ADD COLUMN fixed_weight" in joined
    assert "RENAME COLUMN min_quantity TO min_kg" in joined
    assert "RENAME COLUMN unit_price TO price_per_kg" in joined
    assert "DROP COLUMN quantity" in joined
    assert "SET NOT NULL" not in joined
