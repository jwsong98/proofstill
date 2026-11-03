import unittest
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from usecase.tasks import TaskList
from infra.database import create_database, migrate, seed, status, reset
from infra.task_repository import TaskRepository


class DatabaseTests(unittest.TestCase):
    def setUp(self):
        self.db = create_database('sqlite+pysqlite:///:memory:')
        self.addCleanup(self.db.dispose)
        migrate(self.db)
        seed(self.db)
        self.session = Session(self.db)
        self.addCleanup(self.session.close)
        self.tasks = TaskList(TaskRepository(self.session))

    def test_actual_memory_schema_seed_and_isolation(self):
        self.assertEqual(self.db.url.database, ':memory:')
        self.assertIn('tasks', inspect(self.db).get_table_names())
        self.assertEqual(status(self.db)['current'], ['0001_tasks'])
        self.assertEqual(status(self.db)['pending'], [])
        first = self.tasks.get('seed-planning')
        self.assertEqual(first, {'id': 'seed-planning', 'title': '사용자 흐름 정리', 'completed': False})
        self.assertTrue(self.tasks.get('seed-done')['completed'])
        self.tasks.update(first['id'], True)
        self.session.rollback()
        with self.db.begin() as c:
            c.execute(text('update tasks set title=:title where id=:id'), {'title': '사용자가 수정한 제목', 'id': first['id']})
        seed(self.db)
        self.assertEqual(self.tasks.get(first['id'])['title'], '사용자가 수정한 제목')
        self.assertTrue(self.tasks.get(first['id'])['completed'], 'Idempotent seed preserves existing user changes')
        other = create_database('sqlite+pysqlite:///:memory:')
        self.addCleanup(other.dispose)
        migrate(other); seed(other)
        with Session(other) as session:
            self.assertFalse(TaskList(TaskRepository(session)).get(first['id'])['completed'])
        self.session.rollback()
        with self.db.connect() as c: self.assertEqual(c.execute(text('select count(*) from tasks')).scalar(), 2)

    def test_domain_validation_persistence_and_missing_rows(self):
        for title in ['', '  ', None, 3]:
            with self.assertRaises(ValueError): self.tasks.create(title)
        task = self.tasks.create(' 새 작업 ')
        self.assertEqual(task['title'], '새 작업')
        with self.assertRaises(ValueError): self.tasks.update(task['id'], 'true')
        with self.assertRaises(KeyError): self.tasks.get('missing')
        with self.assertRaises(KeyError): self.tasks.update('missing', True)
        self.tasks.update(task['id'], True)
        self.session.rollback()
        with self.db.connect() as c:
            row = c.execute(text('select title, completed from tasks where id=:id'), {'id': task['id']}).one()
            self.assertEqual(row.title, '새 작업'); self.assertTrue(row.completed)

    def test_upgrade_downgrade_and_reset_use_real_migrations(self):
        migrate(self.db)
        self.assertEqual(status(self.db)['current'], ['0001_tasks'])
        migrate(self.db, 'base', downgrade=True)
        self.assertNotIn('tasks', inspect(self.db).get_table_names())
        self.assertTrue(status(self.db)['pending'])
        migrate(self.db); seed(self.db)
        self.tasks.create('지워질 테스트 데이터')
        reset(self.db)
        self.session.rollback()
        with self.db.connect() as c: self.assertEqual(c.execute(text('select count(*) from tasks')).scalar(), 2)
        self.assertEqual(status(self.db)['pending'], [])

    def test_failed_migration_does_not_advance_revision(self):
        from alembic.operations import Operations
        from unittest.mock import patch
        migrate(self.db, 'base', downgrade=True)
        def fail_table(self, *args, **kwargs):
            raise RuntimeError('migration probe')
        with patch.object(Operations, 'create_table', new=fail_table):
            with self.assertRaisesRegex(RuntimeError, 'migration probe'): migrate(self.db)
        self.assertEqual(status(self.db)['current'], [])
        migrate(self.db); seed(self.db)
        self.assertEqual(status(self.db)['current'], ['0001_tasks'])

    def test_sql_constraints_reject_invalid_rows_without_service_validation(self):
        from sqlalchemy.exc import IntegrityError
        cases = [('seed-planning', 'duplicate', False), ('new-null', None, False),
                 ('new-empty', '  ', False), ('new-bool', 'title', 2), ('new-none', 'title', None)]
        for task_id, title, completed in cases:
            with self.assertRaises(IntegrityError):
                with self.db.begin() as connection:
                    connection.execute(text('insert into tasks(id,title,completed) values(:id,:title,:completed)'),
                                       {'id': task_id, 'title': title, 'completed': completed})
        self.session.rollback()
        with self.db.connect() as c: self.assertEqual(c.execute(text('select count(*) from tasks')).scalar(), 2)
