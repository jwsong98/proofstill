from typing import Protocol
from uuid import uuid4


class TaskStore(Protocol):
    def create(self, task: dict) -> dict: ...
    def get(self, task_id: str) -> dict: ...
    def update(self, task_id: str, completed: bool) -> dict: ...


class TaskList:
    def __init__(self, store: TaskStore):
        self.store = store

    def create(self, title):
        if not isinstance(title, str) or not title.strip():
            raise ValueError('title must be a nonempty string')
        return self.store.create({'id': str(uuid4()), 'title': title.strip(), 'completed': False})

    def get(self, task_id):
        return self.store.get(task_id)

    def update(self, task_id, completed):
        if not isinstance(completed, bool):
            raise ValueError('completed must be boolean')
        return self.store.update(task_id, completed)
