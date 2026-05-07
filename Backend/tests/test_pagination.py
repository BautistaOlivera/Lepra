"""Modelos Pydantic sin tocar la base de datos."""
import pytest
from pydantic import ValidationError

from models.pagination import InputPaginatedRequestFilter


def test_pagination_defaults():
    m = InputPaginatedRequestFilter()
    assert m.limit == 20
    assert m.last_seen_id is None
    assert m.filters is None


def test_pagination_custom_limit():
    m = InputPaginatedRequestFilter(limit=50, last_seen_id=10, filters={"search": "x"})
    assert m.limit == 50
    assert m.last_seen_id == 10
    assert m.filters == {"search": "x"}


def test_pagination_limit_bounds():
    with pytest.raises(ValidationError):
        InputPaginatedRequestFilter(limit=0)
    with pytest.raises(ValidationError):
        InputPaginatedRequestFilter(limit=101)
