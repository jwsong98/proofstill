"""JWT primitives for login handlers and FastAPI dependencies."""
from collections.abc import Mapping
from dataclasses import dataclass
import json
from pathlib import Path
import time
from typing import Any

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt

from infra.settings import PROJECT_ROOT, environment


@dataclass(frozen=True)
class TokenService:
    secret: str
    ttl_seconds: int = 3600

    def __post_init__(self):
        if len(self.secret.encode('utf-8')) < 32:
            raise ValueError('JWT_SECRET_KEY must contain at least 32 bytes; run npm run auth:setup')
        if type(self.ttl_seconds) is not int or self.ttl_seconds <= 0:
            raise ValueError('JWT_TTL_SECONDS must be a positive integer')

    @classmethod
    def from_env(cls, env_file: Path | None = None):
        values = environment(env_file)
        return cls(values.get('JWT_SECRET_KEY') or '', int(values.get('JWT_TTL_SECONDS') or '3600'))

    def issue(self, data: Mapping[str, Any]) -> str:
        # Nest application data so user-defined fields cannot replace expiry or signature policy.
        if not isinstance(data, Mapping) or any(not isinstance(key, str) for key in data):
            raise ValueError('Token data must be a JSON object with string keys')
        payload = dict(data)
        json.dumps(payload, allow_nan=False)
        now = int(time.time())
        return jwt.encode({'data': payload, 'iat': now, 'exp': now + self.ttl_seconds},
                          self.secret, algorithm='HS256')

    def verify(self, token: str) -> dict[str, Any]:
        claims = jwt.decode(token, self.secret, algorithms=['HS256'],
                            options={'require': ['exp', 'iat', 'data']})
        if (not isinstance(claims['data'], dict)
                or type(claims['iat']) is not int or type(claims['exp']) is not int
                or claims['exp'] <= claims['iat']):
            raise jwt.InvalidTokenError('Invalid token claims')
        return claims['data']


def get_token_service() -> TokenService:
    try:
        return TokenService.from_env()
    except ValueError:
        raise HTTPException(503, 'Authentication is not configured') from None


_bearer = HTTPBearer(auto_error=False)


def require_token(credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
                  tokens: TokenService = Depends(get_token_service)) -> dict[str, Any]:
    """Use Depends(require_token) on routes that need verified application data."""
    if credentials is not None:
        try:
            return tokens.verify(credentials.credentials)
        except jwt.InvalidTokenError:
            pass
    raise HTTPException(401, 'Invalid or expired bearer token', headers={'WWW-Authenticate': 'Bearer'})
