"""Persist tasks for the explained user flow."""
from alembic import op
import sqlalchemy as sa

revision = '0001_tasks'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('tasks',
                    sa.Column('id', sa.String(64), primary_key=True),
                    sa.Column('title', sa.String(), nullable=False),
                    sa.Column('completed', sa.Boolean(create_constraint=True, name='task_completed_bool'), nullable=False),
                    sa.CheckConstraint('length(trim(title)) > 0', name='task_title_not_blank'))


def downgrade():
    op.drop_table('tasks')
