from alembic import context
from infra.database import metadata

connection = context.config.attributes.get('connection')
if connection is None:
    raise RuntimeError('Use the repository db:* commands to supply a database connection')
context.configure(connection=connection, target_metadata=metadata, compare_type=True)
with context.begin_transaction():
    context.run_migrations()
