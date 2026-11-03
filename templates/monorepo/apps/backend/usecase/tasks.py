from domain.tasks import TaskData, TaskStore, new_task, validate_completed


class TaskList:
    def __init__(self, store: TaskStore):
        self.store = store

    def create(self, title: str) -> TaskData:
        return self.store.create(new_task(title))

    def get(self, task_id: str) -> TaskData:
        return self.store.get(task_id)

    def update(self, task_id: str, completed: bool) -> TaskData:
        return self.store.update(task_id, validate_completed(completed))
