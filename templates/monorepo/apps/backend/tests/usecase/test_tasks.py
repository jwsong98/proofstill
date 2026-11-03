import unittest
from domain.tasks import TaskStore
from usecase.tasks import TaskList


class MemoryTaskStore(TaskStore):
    def __init__(self):
        self.rows = {}
        self.writes = 0

    def create(self, task):
        self.writes += 1
        self.rows[task['id']] = dict(task)
        return dict(task)

    def get(self, task_id):
        return dict(self.rows[task_id])

    def update(self, task_id, completed):
        row = self.rows[task_id]
        self.writes += 1
        row['completed'] = completed
        return dict(row)


class TaskListTests(unittest.TestCase):
    def setUp(self):
        self.store = MemoryTaskStore()
        self.tasks = TaskList(self.store)

    def test_create_update_get(self):
        task = self.tasks.create(' work ')
        self.assertEqual(task['title'], 'work')
        self.assertFalse(task['completed'])
        self.tasks.update(task['id'], True)
        self.assertEqual(self.tasks.get(task['id']), {**task, 'completed': True})
        self.assertEqual(self.store.writes, 2)

    def test_invalid_input_never_writes(self):
        task = self.tasks.create('preserved')
        before = self.store.writes
        for value in ['', ' ', None, 1]:
            with self.assertRaises(ValueError):
                self.tasks.create(value)
        for value in [None, 1, 'true']:
            with self.assertRaises(ValueError):
                self.tasks.update(task['id'], value)
        self.assertEqual(self.store.writes, before)
        self.assertEqual(self.tasks.get(task['id']), task)

    def test_missing_task_and_store_failure_are_preserved(self):
        with self.assertRaises(KeyError):
            self.tasks.get('missing')
        with self.assertRaises(KeyError):
            self.tasks.update('missing', True)
        class FailingStore(MemoryTaskStore):
            def create(self, task):
                raise RuntimeError('storage unavailable')
        with self.assertRaisesRegex(RuntimeError, 'storage unavailable'):
            TaskList(FailingStore()).create('work')

    def test_instances_do_not_share_state(self):
        task = self.tasks.create('first')
        with self.assertRaises(KeyError):
            TaskList(MemoryTaskStore()).get(task['id'])
