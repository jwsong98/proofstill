from sqlalchemy.orm import Session
from domain.tasks import TaskData, TaskStore
from infra.models import Task


def task_data(task: Task) -> TaskData:
    return {'id': task.id, 'title': task.title, 'completed': task.completed}


class TaskRepository(TaskStore):
    def __init__(self, session: Session):
        self.session = session

    def create(self, task: TaskData) -> TaskData:
        row = Task(**task)
        self.session.add(row)
        result = task_data(row)
        self.session.commit()
        return result

    def get(self, task_id: str) -> TaskData:
        row = self.session.get(Task, task_id)
        if row is None:
            raise KeyError(task_id)
        return task_data(row)

    def update(self, task_id: str, completed: bool) -> TaskData:
        row = self.session.get(Task, task_id)
        if row is None:
            raise KeyError(task_id)
        row.completed = completed
        result = task_data(row)
        self.session.commit()
        return result
