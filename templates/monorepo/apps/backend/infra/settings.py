import os
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import dotenv_values

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CORS_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173'


def environment(env_file: Path | None = None):
    return {**dotenv_values(env_file or PROJECT_ROOT / '.env'), **os.environ}


def cors_settings(env_file: Path | None = None):
    values = environment(env_file)
    origins = []
    for origin in (values.get('CORS_ORIGINS', DEFAULT_CORS_ORIGINS) or '').split(','):
        origin = origin.strip().rstrip('/')
        if not origin:
            continue
        parsed = urlsplit(origin)
        try:
            _ = parsed.port
        except ValueError:
            raise ValueError('CORS_ORIGINS must contain HTTP(S) origins with valid ports') from None
        if (parsed.scheme not in {'http', 'https'} or not parsed.hostname
                or parsed.username is not None or parsed.password is not None
                or parsed.path or parsed.query or parsed.fragment or '*' in origin):
            raise ValueError('CORS_ORIGINS must contain explicit HTTP(S) origins without paths')
        if origin not in origins:
            origins.append(origin)
    credentials = (values.get('CORS_ALLOW_CREDENTIALS') or 'false').strip().lower()
    if credentials not in {'true', 'false'}:
        raise ValueError('CORS_ALLOW_CREDENTIALS must be true or false')
    return {'allow_origins': origins, 'allow_credentials': credentials == 'true'}
