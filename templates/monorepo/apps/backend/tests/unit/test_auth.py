import json
import os
from pathlib import Path
import stat
import tempfile
import time
import unittest
from unittest.mock import patch

from dotenv import dotenv_values
import jwt

from infra.auth import TokenService
from infra.auth_setup import setup

KEY = 'unit-test-only-key-' * 4


class TokenTests(unittest.TestCase):
    def setUp(self):
        # Project .env values must not override each test's temporary JWT configuration.
        env = patch.dict(os.environ, {}, clear=True)
        env.start()
        self.addCleanup(env.stop)
        self.tokens = TokenService(KEY)

    def test_round_trip_preserves_arbitrary_data_without_claim_override(self):
        data = {'id': 42, 'roles': ['editor'], 'profile': {'name': '지웅'}, 'exp': 'application field'}
        original = json.loads(json.dumps(data))
        token = self.tokens.issue(data)
        self.assertEqual(self.tokens.verify(token), original)
        self.assertEqual(data, original)
        claims = jwt.decode(token, KEY, algorithms=['HS256'])
        self.assertEqual(claims['exp'] - claims['iat'], 3600)
        self.assertEqual(self.tokens.verify(self.tokens.issue({})), {})

    def test_tampering_wrong_key_algorithm_and_expiry_are_rejected(self):
        token = self.tokens.issue({'id': 'u1'})
        parts = token.split('.')
        parts[1] = parts[1][::-1]
        now = int(time.time())
        expired = jwt.encode({'iat': now - 60, 'exp': now - 1, 'data': {}}, KEY, algorithm='HS256')
        wrong_algorithm = jwt.encode({'iat': now, 'exp': now + 60, 'data': {}}, KEY, algorithm='HS384')
        for invalid in ['.'.join(parts), token + 'x', '', 'not.jwt', expired, wrong_algorithm,
                        jwt.encode({'data': {}}, KEY, algorithm='HS256'),
                        jwt.encode({'iat': now, 'exp': now + 60, 'data': []}, KEY, algorithm='HS256')]:
            with self.subTest(token=invalid[:20]), self.assertRaises(jwt.InvalidTokenError):
                self.tokens.verify(invalid)
        with self.assertRaises(jwt.InvalidTokenError):
            TokenService('different-key-' * 4).verify(token)

    def test_config_and_input_validation(self):
        for key, ttl in [('', 3600), ('short', 3600), (KEY, 0), (KEY, -1), (KEY, True)]:
            with self.subTest(ttl=ttl), self.assertRaises(ValueError):
                TokenService(key, ttl)
        for data in [[], {1: 'not a string key'}, {'nan': float('nan')}]:
            with self.subTest(data=data), self.assertRaises(ValueError):
                self.tokens.issue(data)

    def test_env_file_and_environment_precedence(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {}, clear=True):
            path = Path(folder) / '.env'
            path.write_text(f'JWT_SECRET_KEY={KEY}\nJWT_TTL_SECONDS=120\n')
            self.assertEqual(TokenService.from_env(path).ttl_seconds, 120)
            os.environ['JWT_TTL_SECONDS'] = '90'
            self.assertEqual(TokenService.from_env(path).ttl_seconds, 90)
            os.environ['JWT_SECRET_KEY'] = ''
            with self.assertRaises(ValueError):
                TokenService.from_env(path)

    def test_setup_generates_private_persistent_key_and_preserves_existing_settings(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / '.env'
            setup(path)
            values = dotenv_values(path)
            self.assertGreaterEqual(len(values['JWT_SECRET_KEY']), 32)
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            token = TokenService.from_env(path).issue({'id': 'persisted'})
            setup(path)
            self.assertEqual(dotenv_values(path)['JWT_SECRET_KEY'], values['JWT_SECRET_KEY'])
            self.assertEqual(TokenService.from_env(path).verify(token), {'id': 'persisted'})
            path.write_text('OTHER_SETTING=keep\nJWT_SECRET_KEY=\nJWT_TTL_SECONDS=90\n')
            setup(path)
            self.assertEqual(dotenv_values(path)['OTHER_SETTING'], 'keep')
            self.assertEqual(TokenService.from_env(path).ttl_seconds, 90)
            other = Path(folder) / 'other.env'
            setup(other)
            self.assertNotEqual(dotenv_values(other)['JWT_SECRET_KEY'], dotenv_values(path)['JWT_SECRET_KEY'])
