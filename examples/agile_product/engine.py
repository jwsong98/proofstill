"""Pure pricing policy; no HTTP or storage dependency."""
def quote(request):
    numerator = request['unit_cents'] * request['quantity'] * (100 - request['discount_percent'])
    return {'total_cents': (numerator + 50) // 100}


def baseline(request):
    return {'total_cents': request['unit_cents'] * request['quantity'] * (100 - request['discount_percent']) // 100}


if __name__ == '__main__':
    import json
    import sys
    print(json.dumps((baseline if '--baseline' in sys.argv else quote)(json.load(sys.stdin))))
