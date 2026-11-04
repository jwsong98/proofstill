"""Independent expectation check; does not import either pricing implementation."""
import json
import sys

packet = json.load(sys.stdin)
actual = packet['output'].get('total_cents')
valid = type(actual) is int and actual == packet['case']['expected_cents']
print(json.dumps({'valid': valid, 'metrics': {'total_cents': actual} if type(actual) is int else {},
                  'violations': [] if valid else ['TOTAL_MISMATCH']}))
