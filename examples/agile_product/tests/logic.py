import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from engine import quote

for case in json.loads(Path('cases.json').read_text()):
    assert quote(case['input']) == {'total_cents': case['expected_cents']}, case['id']
assert quote({'unit_cents': 10**20 + 1, 'quantity': 3, 'discount_percent': 50})['total_cents'] == 150000000000000000002
print('LOGIC_OK: normal, zero, exact half and large integer')
