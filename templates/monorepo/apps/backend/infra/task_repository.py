from sqlalchemy import insert, select, update
from infra.database import tasks


class TaskRepository:
    def __init__(self, engine):
        self.engine = engine

    def create(self, task):
        with self.engine.begin() as connection:
            connection.execute(insert(tasks).values(**task))
        return dict(task)

    def get(self, task_id):
        with self.engine.connect() as connection:
            row = connection.execute(select(tasks).where(tasks.c.id == task_id)).mappings().first()
        if row is None:
            raise KeyError(task_id)
        return dict(row)

    def update(self, task_id, completed):
        with self.engine.begin() as connection:
            result = connection.execute(update(tasks).where(tasks.c.id == task_id).values(completed=completed))
            if result.rowcount == 0:
                raise KeyError(task_id)
            return dict(connection.execute(select(tasks).where(tasks.c.id == task_id)).mappings().one())
