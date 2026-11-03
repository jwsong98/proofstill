import argparse
import json
import os

from alembic import command
from sqlalchemy import select
from infra.database import (configuration, create_database, migrate, reset,
                            seed, status, tasks)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['revision', 'migrate', 'status', 'rollback', 'seed', 'reset', 'check'])
    parser.add_argument('--revision')
    parser.add_argument('--message')
    parser.add_argument('--autogenerate', action='store_true')
    parser.add_argument('--yes', action='store_true')
    args = parser.parse_args()
    url = os.environ.get('DATABASE_URL')
    if args.action != 'check' and not url:
        parser.error('DATABASE_URL is required for DB administration; use db:check for a seeded memory database')
    if args.action == 'reset' and not args.yes:
        parser.error('db:reset removes data; specify --yes to reset the DATABASE_URL target')
    if args.action == 'revision' and not args.message:
        parser.error('db:revision requires --message')
    engine = create_database() if args.action == 'check' else create_database(url)
    try:
        if args.action == 'revision':
            with engine.begin() as connection:
                command.revision(configuration(connection), message=args.message, autogenerate=args.autogenerate)
        elif args.action == 'migrate':
            migrate(engine, args.revision or 'head')
        elif args.action == 'rollback':
            migrate(engine, args.revision or '-1', downgrade=True)
        elif args.action == 'seed':
            seed(engine)
        elif args.action == 'reset':
            reset(engine)
        elif args.action == 'check':
            migrate(engine); seed(engine)
            with engine.connect() as connection:
                rows = [dict(row) for row in connection.execute(select(tasks).order_by(tasks.c.id)).mappings()]
            print('MEMORY_DB_VERIFIED ' + json.dumps({'database': ':memory:', 'seed': rows}, ensure_ascii=False))
        print(json.dumps(status(engine), ensure_ascii=False))
    finally:
        engine.dispose()


if __name__ == '__main__':
    main()
