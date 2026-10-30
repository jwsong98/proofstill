import json
from infra.openapi import openapi_document

print(json.dumps(openapi_document()))
