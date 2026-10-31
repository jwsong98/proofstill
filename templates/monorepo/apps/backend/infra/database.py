import json
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, event, insert, select
from sqlalchemy.pool import StaticPool
from infra.models import Base, Task

BACKEND = Path(__file__).resolve().parents[1]
MEMORY_URL = 'sqlite+pysqlite:///:memory:'
metadata = Base.metadata
tasks = Task.__table__


def create_database(url=MEMORY_URL):
    options = {}
    if url.startswith('sqlite'):
        options['connect_args'] = {'check_same_thread': False}
        if ':memory:' in url or url in {'sqlite://', 'sqlite+pysqlite://'}:
            options['poolclass'] = StaticPool
    engine = create_engine(url, **options)
    if engine.dialect.name not in {'sqlite', 'postgresql'}:
        engine.dispose()
        raise ValueError('Supported databases: SQLite and PostgreSQL')
    if engine.dialect.name == 'sqlite':
        # Explicit BEGIN keeps DDL/version updates transactional on older sqlite3 drivers too.
        @event.listens_for(engine, 'connect')
        def configure_sqlite(connection, _):
            connection.isolation_level = None
            connection.execute('PRAGMA foreign_keys=ON')

        @event.listens_for(engine, 'begin')
        def begin_sqlite(connection):
            connection.exec_driver_sql('BEGIN')
    return engine


def is_memory(engine):
    return engine.dialect.name == 'sqlite' and engine.url.database in {None, '', ':memory:'}


def configuration(connection=None):
    cfg = Config()
    cfg.set_main_option('script_location', str(BACKEND / 'migrations').replace('%', '%%'))
    cfg.attributes['connection'] = connection
    return cfg


def migrate(engine, revision='head', *, downgrade=False):
    with engine.begin() as connection:
        operation = command.downgrade if downgrade else command.upgrade
        operation(configuration(connection), revision)


def status(engine):
    scripts = ScriptDirectory.from_config(configuration())
    with engine.connect() as connection:
        current = list(MigrationContext.configure(connection).get_current_heads())
    applied = set()
    for revision in current:
        applied.update(item.revision for item in scripts.iterate_revisions(revision, 'base'))
    pending = [item.revision for item in reversed(list(scripts.walk_revisions())) if item.revision not in applied]
    return {'current': current, 'heads': list(scripts.get_heads()), 'pending': pending}


def require_current(engine):
    versions = status(engine)
    if set(versions['current']) != set(versions['heads']):
        raise RuntimeError('Database has pending migrations; run db:migrate with DATABASE_URL first')


def seed(engine):
    require_current(engine)
    rows = json.loads((BACKEND / 'seed/tasks.json').read_text())
    with engine.begin() as connection:
        for row in rows:
            exists = connection.execute(select(tasks.c.id).where(tasks.c.id == row['id'])).first()
            if exists is None:
                connection.execute(insert(tasks).values(**row))
    return len(rows)


def reset(engine):
    migrate(engine, 'base', downgrade=True)
    migrate(engine)
    seed(engine)
