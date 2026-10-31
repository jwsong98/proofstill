from pathlib import Path
import sys
import unittest
root = Path(__file__).resolve().parent
sys.path.insert(0, str(root))
suite = unittest.TestSuite([
    unittest.defaultTestLoader.discover(str(root), pattern='test_database.py'),
    unittest.defaultTestLoader.discover(str(root / 'e2e'), pattern='test_postgres.py'),
])
result = unittest.TextTestRunner(verbosity=2).run(suite)
raise SystemExit(0 if result.wasSuccessful() else 1)
