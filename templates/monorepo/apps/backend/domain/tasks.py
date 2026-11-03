from typing import Protocol, TypedDict
from uuid import uuid4


class TaskData(TypedDict):
    id: str
    title: str
    completed: bool


class TaskStore(Protocol):
    def create(self, task: TaskData) -> TaskData: ...
    def get(self, task_id: str) -> TaskData: ...
    def update(self, task_id: str, completed: bool) -> TaskData: ...


def new_task(title: str) -> TaskData:
    if not isinstance(title, str) or not title.strip():
        raise ValueError('title must be a nonempty string')
    return {'id': str(uuid4()), 'title': title.strip(), 'completed': False}


def validate_completed(completed: bool) -> bool:
    if not isinstance(completed, bool):
        raise ValueError('completed must be boolean')
    return completed
