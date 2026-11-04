import json
import sys
import tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from product import Orders
from engine import quote

with tempfile.TemporaryDirectory() as tmp:
    orders = Orders(Path(tmp) / 'orders.sqlite', quote)
    for case in json.loads(Path('cases.json').read_text()):
        saved = orders.create(case['input'])
        assert saved['result']['total_cents'] == case['expected_cents']
        assert orders.get(saved['id']) == saved
print('INTEGRATION_OK: actual pricing through saved orders')
