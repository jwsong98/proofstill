"""Create a persistent local JWT secret without replacing an existing key."""
import os
from pathlib import Path
import secrets

from dotenv import dotenv_values, set_key

from infra.auth import PROJECT_ROOT, TokenService


def setup(env_file: Path = PROJECT_ROOT / '.env') -> None:
    values = dotenv_values(env_file)
    secret = values.get('JWT_SECRET_KEY') or secrets.token_urlsafe(48)
    ttl = values.get('JWT_TTL_SECONDS') or '3600'
    TokenService(secret, int(ttl))
    # Exclusive creation protects existing files; no secret is printed to stdout.
    try:
        fd = os.open(env_file, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.close(fd)
    except FileExistsError:
        pass
    if not values.get('JWT_SECRET_KEY'):
        set_key(env_file, 'JWT_SECRET_KEY', secret)
    if not values.get('JWT_TTL_SECONDS'):
        set_key(env_file, 'JWT_TTL_SECONDS', ttl)


if __name__ == '__main__':
    setup()
    print('JWT configuration ready in project .env (existing key preserved)')
