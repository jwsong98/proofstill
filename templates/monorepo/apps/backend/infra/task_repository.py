from sqlalchemy.orm import Session
from infra.models import Task


def task_data(task: Task) -> dict:
    return {'id': task.id, 'title': task.title, 'completed': task.completed}


class TaskRepository:
    def __init__(self, session: Session):
        self.session = session

    def create(self, task):
        row = Task(**task)
        self.session.add(row)
        result = task_data(row)
        self.session.commit()
        return result

    def get(self, task_id):
        row = self.session.get(Task, task_id)
        if row is None:
            raise KeyError(task_id)
        return task_data(row)

    def update(self, task_id, completed):
        row = self.session.get(Task, task_id)
        if row is None:
            raise KeyError(task_id)
        row.completed = completed
        result = task_data(row)
        self.session.commit()
        return result
