import json
from infra.app import app

print(json.dumps(app.openapi()))
