"""Verify imports from only the files npm would ship, without installing globally."""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix='proofstill-package-') as directory:
    result = subprocess.run(['npm', 'pack', '--dry-run', '--json', '--ignore-scripts'], cwd=root,
                            capture_output=True, text=True, check=True,
                            env=dict(os.environ, npm_config_cache=str(Path(directory) / 'cache')))
    names = {f['path'] for f in json.loads(result.stdout)[0]['files']}
    for name in ['proofstill/assurance.py', 'proofstill/collaboration.py', 'proofstill/handoff.py']:
        assert name in names, f'필수 배포 모듈 누락: {name}'
    for name in names:
        if name.startswith('proofstill/') and name.endswith('.py'):
            destination = Path(directory) / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes((root / name).read_bytes())
    imported = subprocess.run([sys.executable, '-c', 'from proofstill.workflow import Harness; from proofstill.handoff import briefing; from proofstill.collaboration import readiness'],
                              cwd=directory, env=dict(os.environ, PYTHONPATH=directory), capture_output=True, text=True)
    assert imported.returncode == 0, imported.stderr
print('HANDOFF_PACKAGE_OK')
