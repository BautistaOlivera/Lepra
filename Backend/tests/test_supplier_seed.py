"""El seed de proveedores corre solo con la tabla vacía."""
from services.supplier_seed import SEED_SUPPLIER_NAMES, seed_suppliers_if_empty


class _Result:
    def __init__(self, value):
        self._value = value

    def scalar(self):
        return self._value


class _Conn:
    def __init__(self, count):
        self.count = count
        self.sql = []
        self.params = []

    def execute(self, clause, params=None):
        statement = str(clause)
        self.sql.append(statement)
        self.params.append(params)
        if "COUNT" in statement:
            return _Result(self.count)
        return _Result(None)


def test_seed_inserts_the_given_names_when_empty():
    conn = _Conn(0)
    inserted = seed_suppliers_if_empty(conn)
    assert inserted == len(SEED_SUPPLIER_NAMES) == 13
    names = [p["name"] for p in conn.params if p and "name" in p]
    assert names[0] == "Frigoríficos"
    assert "Quesos" in names
    assert names[-1] == "Javier Vergara"
    assert all(p["active"] is True for p in conn.params if p and "name" in p)


def test_seed_does_not_insert_when_suppliers_already_exist():
    conn = _Conn(2)
    assert seed_suppliers_if_empty(conn) == 0
    assert not any("INSERT" in stmt for stmt in conn.sql)
