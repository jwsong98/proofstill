import json
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from proofstill.project import Project
from proofstill.submission import capture
from proofstill.workflow import Harness
from tests.support import fake_codex
from tests.integration.test_project import definition


class SubmissionTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.h = Harness(self.root, codex=fake_codex(self.root))
        self.project = Project.create(self.h, definition(self.root))

    def verify(self):
        self.project.run()
        for row in self.project.status()['work']:
            self.h.review(row['feature'])

    def test_partial_keeps_last_verified_and_archives_actual_code(self):
        self.verify()
        first = capture(self.project)
        self.assertEqual(first['status'], 'verified')
        pointer = (self.project.folder / 'last-verified.json').read_bytes()
        with tarfile.open(first['archive']) as tar:
            self.assertEqual(tar.extractfile('src/logic.py').read(), b'VALUE = 1\n')
            self.assertTrue(any(n.endswith('/state.json') for n in tar.getnames()))
        (self.root / 'src/logic.py').write_text('VALUE = 3\n')
        partial = capture(self.project)
        self.assertEqual(partial['status'], 'partial')
        self.assertEqual((self.project.folder / 'last-verified.json').read_bytes(), pointer)

    def test_mutation_during_archive_cannot_be_verified(self):
        self.verify()
        original = tarfile.TarFile.addfile
        touched = False
        def mutate(tar, entry, fileobj=None):
            nonlocal touched
            result = original(tar, entry, fileobj)
            if not touched:
                touched = True
                (self.root / 'src/logic.py').write_text('VALUE = 99\n')
            return result
        with patch.object(tarfile.TarFile, 'addfile', mutate):
            result = capture(self.project)
        self.assertEqual(result['status'], 'partial')
        self.assertFalse(result['source_unchanged'])
        self.assertFalse((self.project.folder / 'last-verified.json').exists())

    def test_open_question_prevents_verified_snapshot(self):
        self.verify()
        self.project.question('logic', 'q', 'which rounding rule?')
        self.assertEqual(capture(self.project)['status'], 'partial')
