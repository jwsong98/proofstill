"""A runnable input→policy→save→read flow with an injectable pricing boundary."""
import json
import sqlite3
import uuid


class Orders:
    def __init__(self, database, pricing):
        self.database, self.pricing = database, pricing
        with sqlite3.connect(database) as db:
            db.execute('CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, request TEXT NOT NULL, result TEXT NOT NULL)')

    def create(self, request):
        for field in ['unit_cents', 'quantity', 'discount_percent']:
            if type(request.get(field)) is not int:
                raise ValueError(field + ' must be an integer')
        if request['unit_cents'] < 0 or request['quantity'] <= 0 or not 0 <= request['discount_percent'] <= 100:
            raise ValueError('invalid price, quantity or discount')
        result = self.pricing(request)
        if type(result.get('total_cents')) is not int or result['total_cents'] < 0:
            raise ValueError('invalid pricing result')
        key = uuid.uuid4().hex
        with sqlite3.connect(self.database) as db:
            db.execute('INSERT INTO orders VALUES(?,?,?)', (key, json.dumps(request), json.dumps(result)))
        return self.get(key)

    def get(self, key):
        with sqlite3.connect(self.database) as db:
            row = db.execute('SELECT request,result FROM orders WHERE id=?', (key,)).fetchone()
        return {'id': key, 'request': json.loads(row[0]), 'result': json.loads(row[1])} if row else None
