import atexit
from functools import lru_cache
import os
from pathlib import Path
import shutil
import subprocess
import tempfile


@lru_cache(maxsize=1)
def backend_python():
    root = Path(tempfile.mkdtemp(prefix='proofstill-test-python-'))
    atexit.register(shutil.rmtree, root, ignore_errors=True)
    subprocess.run(['python3', '-m', 'venv', str(root)], check=True, capture_output=True)
    python = root / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    result = subprocess.run([str(python), '-m', 'pip', 'install', '--disable-pip-version-check',
                             '-r', str(Path(__file__).with_name('db-requirements.txt'))],
                            capture_output=True, text=True, timeout=180)
    if result.returncode:
        raise RuntimeError('BACKEND_DEPENDENCIES_FAILED: ' + result.stderr)
    return str(python)
