from pathlib import Path
import tempfile
import unittest
from scripts.check_architecture import violations


class DependencyTests(unittest.TestCase):
    def test_project_obeys_layers(self):
        self.assertEqual(violations(Path(__file__).resolve().parents[2]), [])

    def test_rejects_reverse_relative_and_framework_imports(self):
        cases = [('domain', 'import infra.database'),
                 ('domain', 'from ..infra import database'),
                 ('domain', 'import sqlalchemy'),
                 ('usecase', 'from app.http import create_http_app'),
                 ('usecase', 'from infra import task_repository'),
                 ('usecase', 'import fastapi'),
                 ('app', 'from domain.tasks import TaskStore'),
                 ('app', 'from ..infra import database'),
                 ('infra', 'from usecase.tasks import TaskList'),
                 ('infra', 'from app.http import create_http_app')]
        for layer, code in cases:
            with self.subTest(code=code), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                target = root / layer / 'feature.py'
                target.parent.mkdir()
                target.write_text(code + '\n')
                self.assertTrue(violations(root), code)

    def test_allows_contract_implementation_and_composition(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for name, code in {
                'domain/tasks.py': 'from typing import Protocol',
                'usecase/tasks.py': 'from domain.tasks import TaskStore',
                'app/tasks.py': 'from usecase.tasks import TaskList',
                'infra/tasks.py': 'from domain.tasks import TaskStore',
                'infra/app.py': 'from app.http import create_http_app\nfrom usecase.tasks import TaskList',
            }.items():
                file = root / name
                file.parent.mkdir(exist_ok=True)
                file.write_text(code + '\n')
            self.assertEqual(violations(root), [])

    def test_rejects_cycles_within_a_layer(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'domain').mkdir()
            (root / 'domain/first.py').write_text('from domain import second\n')
            (root / 'domain/second.py').write_text('from . import first\n')
            self.assertTrue(any('cycle' in item for item in violations(root)))
