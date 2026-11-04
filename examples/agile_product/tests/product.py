import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import tempfile
from product import Orders

with tempfile.TemporaryDirectory() as tmp:
    database = Path(tmp) / 'orders.sqlite'
    orders = Orders(database, lambda request: {'total_cents': 42})
    saved = orders.create({'unit_cents': 5, 'quantity': 1, 'discount_percent': 50})
    assert Orders(database, lambda request: None).get(saved['id']) == saved
    try:
        orders.create({'unit_cents': 5, 'quantity': 0, 'discount_percent': 50})
        raise AssertionError('invalid input accepted')
    except ValueError:
        pass
print('PRODUCT_OK: input validation, injected policy, persistence and read')
