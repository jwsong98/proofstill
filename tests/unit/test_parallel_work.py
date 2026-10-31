import json
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

from proofstill.workflow import Harness, HarnessError
from tests.support import make_plan, fake_codex


class ParallelWorkTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.plan = make_plan(self.root)
        self.h = Harness(self.root, codex=fake_codex(self.root))
        self.h.init(self.plan)

    def test_same_task_cannot_overwrite_running_state(self):
        entered, release = threading.Event(), threading.Event()
        execute = self.h.execute

        def blocked(*args, **kwargs):
            entered.set()
            self.assertTrue(release.wait(10))
            return execute(*args, **kwargs)

        with patch.object(self.h, 'execute', side_effect=blocked), ThreadPoolExecutor() as pool:
            running = pool.submit(self.h.run, 'counter', 'red')
            try:
                self.assertTrue(entered.wait(5))
                other = Harness(self.root)
                for action in [other.run, other.report, other.cleanup, other.review]:
                    with self.assertRaisesRegex(HarnessError, '작업 실행 중'):
                        action('counter')
            finally:
                release.set()
            self.assertTrue(running.result()[0]['accepted'])
        self.assertEqual(len(self.h.load('counter')[1]['runs']), 1)
        self.assertTrue(self.h.run('counter', 'red')[0]['accepted'])

    def test_separate_sources_run_concurrently_without_copies_or_shared_records(self):
        plan = json.loads(self.plan.read_text())
        plan.update(id='other', sources=['src/other.py'])
        (self.root / 'src/other.py').write_text('VALUE = 1\n')
        check = self.root / 'tests/other.py'
        check.write_text((self.root / 'tests/check.py').read_text().replace('counter.py', 'other.py'))
        plan['checks'][0].update(argv=['python3', 'tests/other.py'], files=['tests/other.py'])
        definition = self.root / 'other.json'
        definition.write_text(json.dumps(plan))
        other = Harness(self.root, codex=self.h.codex)
        other.init(definition)
        before = self.h.source_digest(self.h.load('counter')[0])
        (self.root / 'src/other.py').write_text('VALUE = 1\n# unrelated edit\n')
        self.assertEqual(self.h.source_digest(self.h.load('counter')[0]), before)
        barrier = threading.Barrier(2)

        def synchronized(execute):
            def run(*args, **kwargs):
                barrier.wait(timeout=5)
                return execute(*args, **kwargs)
            return run

        with patch.object(self.h, 'execute', side_effect=synchronized(self.h.execute)), \
             patch.object(other, 'execute', side_effect=synchronized(other.execute)), ThreadPoolExecutor() as pool:
            a = pool.submit(self.h.run, 'counter', 'red')
            b = pool.submit(other.run, 'other')
            first, second = a.result()[0], b.result()[0]
        self.assertTrue(first['accepted'])
        self.assertTrue(second['accepted'])
        self.assertNotEqual(first['receipt'], second['receipt'])
        other.review('other')
        self.assertTrue(other.status('other')['complete'])
        self.assertFalse(list((self.root / '.proofstill').rglob('snapshot')))

    def test_exception_releases_task_lock(self):
        with patch.object(self.h, 'execute', side_effect=KeyboardInterrupt):
            with self.assertRaises(KeyboardInterrupt):
                self.h.run('counter', 'red')
        self.assertTrue(self.h.run('counter', 'red')[0]['accepted'])
