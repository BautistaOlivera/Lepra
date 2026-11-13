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


def test_legacy_order_creator_backfill_runs_once():
    from services.schema_migrate import _backfill_legacy_order_creator

    class _Scalar:
        def __init__(self, value):
            self._value = value

        def scalar(self):
            return self._value

    class _Conn:
        def __init__(self):
            self.sql = []
            self.flag = None
            self.admin_id = 3

        def execute(self, clause, params=None):
            statement = str(clause)
            self.sql.append(statement)
            if "information_schema.columns" in statement:
                return _Scalar(1)
            if "SELECT 1 FROM schema_flags" in statement:
                return _Scalar(self.flag)
            if "SELECT id" in statement:
                return _Scalar(self.admin_id)
            if "INSERT INTO schema_flags" in statement:
                self.flag = 1
            return _Scalar(None)

    conn = _Conn()
    _backfill_legacy_order_creator(conn)
    joined = "\n".join(conn.sql)
    assert "UPDATE orders" in joined
    assert "created_by = :admin_id" in joined

    conn.sql.clear()
    _backfill_legacy_order_creator(conn)
    assert not any("UPDATE orders" in stmt for stmt in conn.sql)


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
