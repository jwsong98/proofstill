import unittest

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from infra.auth import TokenService, get_token_service, require_token


class BearerTests(unittest.TestCase):
    def setUp(self):
        self.tokens = TokenService('integration-only-secret-' * 3)
        app = FastAPI()
        app.dependency_overrides[get_token_service] = lambda: self.tokens

        @app.get('/private')
        def private(data=Depends(require_token)):
            return data

        self.client = TestClient(app)

    def test_bearer_token_returns_verified_application_data(self):
        token = self.tokens.issue({'user': {'id': 'u1'}, 'permissions': ['read']})
        response = self.client.get('/private', headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['user'], {'id': 'u1'})

    def test_missing_invalid_and_wrong_scheme_tokens_are_unauthorized(self):
        for header in ['', 'Bearer invalid', 'Basic abc', 'Bearer', 'Bearer ' + TokenService('another-key-' * 4).issue({})]:
            with self.subTest(header=header):
                response = self.client.get('/private', headers={'Authorization': header})
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.headers['www-authenticate'], 'Bearer')

    def test_missing_configuration_does_not_accept_tokens(self):
        from unittest.mock import patch
        self.client.app.dependency_overrides.clear()
        with patch.object(TokenService, 'from_env', side_effect=ValueError('missing key')):
            response = self.client.get('/private', headers={'Authorization': 'Bearer fake'})
        self.assertEqual(response.status_code, 503)
