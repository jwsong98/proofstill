import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi import Depends
from fastapi.testclient import TestClient

from infra.app import create_app
from infra.auth import TokenService, get_token_service, require_token
from infra.settings import DEFAULT_CORS_ORIGINS, cors_settings

ORIGIN = 'http://localhost:5173'


class CorsTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'CORS_ORIGINS': DEFAULT_CORS_ORIGINS,
                                           'CORS_ALLOW_CREDENTIALS': 'false'}, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_preflight_allows_json_and_bearer_requests_from_local_frontend(self):
        with TestClient(create_app()) as client:
            response = client.options('/tasks/id', headers={
                'Origin': ORIGIN, 'Access-Control-Request-Method': 'PATCH',
                'Access-Control-Request-Headers': 'authorization,content-type'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers['access-control-allow-origin'], ORIGIN)
            self.assertIn('PATCH', response.headers['access-control-allow-methods'])
            self.assertIn('authorization', response.headers['access-control-allow-headers'].lower())
            self.assertIn('Origin', response.headers['vary'])
            self.assertNotIn('access-control-allow-credentials', response.headers)

    def test_unknown_origin_and_header_are_not_allowed(self):
        with TestClient(create_app()) as client:
            for origin, headers in [('https://untrusted.example', 'content-type'), (ORIGIN, 'x-proofstill-token')]:
                response = client.options('/tasks', headers={'Origin': origin,
                    'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': headers})
                self.assertEqual(response.status_code, 400)
            response = client.get('/health', headers={'Origin': 'https://untrusted.example'})
            self.assertNotIn('access-control-allow-origin', response.headers)
            self.assertEqual(client.get('/health').status_code, 200)

    def test_success_and_handled_errors_are_readable_by_allowed_frontend(self):
        tokens = TokenService('cors-integration-test-key-' * 3)
        app = create_app()
        app.dependency_overrides[get_token_service] = lambda: tokens

        @app.get('/private')
        def private(data=Depends(require_token)):
            return data

        with TestClient(app) as client:
            responses = [client.get('/health', headers={'Origin': ORIGIN}),
                         client.get('/tasks/missing', headers={'Origin': ORIGIN}),
                         client.post('/tasks', content='', headers={'Origin': ORIGIN}),
                         client.get('/private', headers={'Origin': ORIGIN})]
            self.assertEqual([r.status_code for r in responses], [200, 404, 400, 401])
            for response in responses:
                self.assertEqual(response.headers['access-control-allow-origin'], ORIGIN)
            self.assertIn('WWW-Authenticate', responses[-1].headers['access-control-expose-headers'])
            token = tokens.issue({'id': 'u1'})
            response = client.get('/private', headers={'Origin': ORIGIN, 'Authorization': f'Bearer {token}'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), {'id': 'u1'})

    def test_env_origins_credentials_and_environment_override(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {}, clear=True):
            env_file = Path(folder) / '.env'
            env_file.write_text('CORS_ORIGINS=https://app.example/ , https://app.example,https://admin.example\nCORS_ALLOW_CREDENTIALS=true\n')
            options = cors_settings(env_file)
            self.assertEqual(options['allow_origins'], ['https://app.example', 'https://admin.example'])
            self.assertTrue(options['allow_credentials'])
            os.environ['CORS_ORIGINS'] = ORIGIN
            os.environ['CORS_ALLOW_CREDENTIALS'] = 'true'
            with TestClient(create_app()) as client:
                response = client.get('/health', headers={'Origin': ORIGIN})
                self.assertEqual(response.headers['access-control-allow-credentials'], 'true')
            self.assertEqual(cors_settings(env_file)['allow_origins'], [ORIGIN])
            os.environ['CORS_ORIGINS'] = ''
            self.assertEqual(cors_settings(env_file)['allow_origins'], [])

    def test_invalid_configuration_fails_before_serving(self):
        for invalid in ['*', 'https://*.example', 'http://localhost:invalid', 'http://localhost/path', 'https://user:pass@app.example', 'file://localhost']:
            os.environ['CORS_ORIGINS'] = invalid
            with self.subTest(origin=invalid), self.assertRaises(ValueError):
                create_app()
        os.environ['CORS_ORIGINS'] = ORIGIN
        os.environ['CORS_ALLOW_CREDENTIALS'] = 'maybe'
        with self.assertRaises(ValueError):
            create_app()
