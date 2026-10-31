import hashlib
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
CLI = ROOT / 'bin/proofstill.mjs'
NAMES = ['proofstill-develop', 'proofstill-interview', 'proofstill-ux', 'proofstill-verify',
         'jwdesign', 'design-taste-frontend', 'proofstill-api', 'proofstill-db']

class SetupTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue((ROOT / 'bootstrap/setup.mjs').is_file(), 'GLOBAL_SETUP_MISSING: automatic global installation required')
        self.temp = tempfile.TemporaryDirectory(prefix='proofstill setup ')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.codex = self.base / 'custom codex'
        self.skills = self.base / 'user skills'
        self.codex.mkdir()
        self.cache=self.base/'npm-cache'
        self.env = dict(os.environ, CODEX_HOME=str(self.codex), npm_config_cache=str(self.cache), NPM_CONFIG_CACHE=str(self.cache))
        self.env.pop('NODE_AUTH_TOKEN', None)
        self.env.pop('NPM_TOKEN', None)

    def run_cli(self, *args, env=None, cli=CLI):
        return subprocess.run(['node', str(cli), *args, '--codex-home', str(self.codex), '--skills-dir', str(self.skills)],
                              cwd=self.base, env=env or self.env, text=True, capture_output=True, timeout=120)

    def ok(self, result):
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_default_install_survives_source_removal_and_runs_scaffold(self):
        source = self.base / 'downloaded package'
        source.mkdir()
        manifest = json.loads((ROOT / 'package.json').read_text())
        for name in manifest['files']:
            dest = source / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / name, dest)
        # No verb: this is the default invoked by npx github:jwsong98/proofstill.
        result = self.run_cli(cli=source / 'bin/proofstill.mjs')
        self.ok(result)
        self.assertIn('새 Codex 세션', result.stdout)
        self.assertIn('즉시 등록', result.stdout)
        self.assertIn('Proofstill로 프로젝트', result.stdout)
        readme=(ROOT/'README.md').read_text()
        self.assertIn('npx github:jwsong98/proofstill',readme)
        self.assertIn('Proofstill로 프로젝트',readme)
        self.assertEqual(manifest['version'],'0.5.0')
        self.assertEqual(json.loads((ROOT/'package-lock.json').read_text())['version'],'0.5.0')
        self.assertIn('bootstrap/setup.mjs',manifest['files'])
        self.assertIn('0.5.0',readme)
        self.assertIn('즉시 등록',readme)
        self.assertIn('새 Codex 세션',readme)
        runtime = self.codex / 'proofstill/runtime'
        self.assertTrue((runtime / 'bin/proofstill.mjs').is_file())
        self.assertTrue((runtime / 'node_modules/yaml/package.json').is_file())
        self.assertFalse((self.codex / 'config.toml').exists())
        for name in NAMES:
            self.assertTrue((self.skills / name / 'SKILL.md').is_file(), name)
        develop = (self.skills / 'proofstill-develop/SKILL.md').read_text()
        self.assertIn(str(runtime), develop)
        self.assertNotIn('../../../examples/', develop)
        self.assertTrue((runtime/'bin/proofstill').is_file())
        self.assertTrue((runtime/'examples/orders/feature.json').is_file())
        for name in NAMES:
            origin = ROOT / (('vendor/skills/' if name in ['jwdesign','design-taste-frontend'] else 'templates/monorepo/.agents/skills/' if name in ['proofstill-api','proofstill-db'] else '.agents/skills/') + name)
            for original_file in origin.rglob('*'):
                if not original_file.is_file(): continue
                relative=original_file.relative_to(origin)
                installed_file=self.skills/name/relative
                self.assertTrue(installed_file.is_file(),str(installed_file))
                if name=='proofstill-develop' and str(relative)=='SKILL.md': continue
                self.assertEqual(installed_file.read_bytes(),original_file.read_bytes(),str(relative))
        shutil.rmtree(source)
        shutil.rmtree(self.cache)
        references=re.findall(r'\[[^\]]+\]\(([^)]+)\)',develop)
        self.assertGreaterEqual(len(references),5)
        for reference in references:
            if reference.startswith(('https:','http:')):continue
            target=Path(reference.strip('<>'))
            if not target.is_absolute():target=self.skills/'proofstill-develop'/target
            self.assertTrue(target.is_file(),str(target))
            self.assertTrue(target.read_text(),str(target))
        project = self.base / 'later-project'
        for args in [['--help'], ['harness', '--help'], ['harness', '--root', str(runtime), 'init', str(runtime/'examples/orders/feature.json')], ['scaffold', str(project)]]:
            r = subprocess.run(['node', str(runtime / 'bin/proofstill.mjs'), *args], cwd=self.base,
                               env=self.env, text=True, capture_output=True, timeout=30)
            self.ok(r)
        status=subprocess.run(['node',str(runtime/'bin/proofstill.mjs'),'harness','--root',str(runtime),'status','order-dedup-v3'],cwd=self.base,env=self.env,text=True,capture_output=True,timeout=30)
        self.assertEqual(status.returncode,1,status.stdout+status.stderr)
        self.assertFalse(json.loads(status.stdout)['complete'])
        self.assertTrue(json.loads(status.stdout)['reasons'])
        state=json.loads((runtime/'.proofstill/evidence/order-dedup-v3/state.json').read_text())
        self.assertIn('plan_digest',state)
        r = subprocess.run(['node', str(runtime / 'bin/proofstill.mjs'), 'tracker', 'flow', 'validate'],
                           cwd=project, env=self.env, text=True, capture_output=True, timeout=30)
        self.ok(r)
        self.assertTrue((project / '.agents/skills/proofstill-db/SKILL.md').is_file())

    def test_existing_settings_skills_and_override_are_preserved_and_reinstall_is_idempotent(self):
        config = b'model = "existing-model"\n[profiles.personal]\napproval_policy = "on-request"\n'
        auth = b'{"private":"unchanged-local-fixture"}'
        (self.codex / 'config.toml').write_bytes(config)
        (self.codex / 'auth.json').write_bytes(auth)
        original = '# My instructions\n\nUse Korean.\n'
        override = '# Temporary override\nKeep this.\n'
        (self.codex / 'AGENTS.md').write_text(original)
        (self.codex / 'AGENTS.override.md').write_text(override)
        existing = self.skills / 'jwdesign';existing.mkdir(parents=True)
        (existing / 'SKILL.md').write_text('custom design')
        self.ok(self.run_cli('setup'))
        first = {name: (self.codex / name).read_bytes() for name in ['AGENTS.md','AGENTS.override.md']}
        self.ok(self.run_cli('setup'))
        for name,content in first.items():
            self.assertEqual((self.codex / name).read_bytes(),content)
            self.assertEqual(content.count(b'<!-- proofstill:begin -->'),1)
            guidance=content.decode()
            self.assertIn(str(self.codex/'proofstill/runtime/bin/proofstill.mjs'),guidance)
            self.assertIn('scaffold',guidance)
            self.assertIn('--install',guidance)
            self.assertIn('Proofstill로 프로젝트',guidance)
            for skill in NAMES:
                self.assertIn(str(self.codex/'proofstill/skills'/skill/'SKILL.md'),guidance)
        self.assertTrue(first['AGENTS.md'].decode().startswith(original))
        self.assertTrue(first['AGENTS.override.md'].decode().startswith(override))
        self.assertEqual((self.codex / 'config.toml').read_bytes(), config)
        self.assertEqual((self.codex / 'auth.json').read_bytes(), auth)
        self.assertEqual((existing / 'SKILL.md').read_text(), 'custom design')
        self.assertTrue((self.codex / 'proofstill/skills/jwdesign/SKILL.md').is_file())
        backups = list((self.codex / 'proofstill-backups').rglob('AGENTS.md'))
        self.assertTrue(any(p.read_text() == original for p in backups))
        override_backups=list((self.codex/'proofstill-backups').rglob('AGENTS.override.md'))
        self.assertTrue(any(p.read_text()==override for p in override_backups))
        self.assertEqual(len(list(self.skills.iterdir())),8)

    def test_dependency_failure_preserves_prior_install_and_guidance(self):
        self.ok(self.run_cli('setup'))
        before = self.snapshot(self.codex)
        skill_before=self.snapshot(self.skills)
        fake = self.base / 'fakebin';fake.mkdir()
        command = fake / 'npm';command.write_text('#!/bin/sh\nexit 42\n');command.chmod(0o755)
        env=dict(self.env, PATH=str(fake)+os.pathsep+os.environ['PATH'])
        result = self.run_cli('setup',env=env)
        self.assertNotEqual(result.returncode,0)
        self.assertIn('42',result.stderr)
        self.assertEqual(self.snapshot(self.codex), before)
        self.assertEqual(self.snapshot(self.skills), skill_before)

    def test_conflicting_install_and_malformed_marker_fail_without_mutation(self):
        owned = self.codex / 'proofstill';owned.mkdir();(owned / 'mine').write_text('keep')
        before = self.snapshot(self.codex)
        self.assertNotEqual(self.run_cli('setup').returncode,0)
        self.assertEqual(self.snapshot(self.codex),before)
        shutil.rmtree(owned)
        for name in ['AGENTS.md','AGENTS.override.md']:
            for bad in ['User text\n<!-- proofstill:begin -->\nunfinished',
                        '<!-- proofstill:end --><!-- proofstill:begin -->',
                        '<!-- proofstill:begin --><!-- proofstill:end --><!-- proofstill:begin --><!-- proofstill:end -->']:
                with self.subTest(name=name,bad=bad):
                    target=self.codex/name;target.write_text(bad)
                    before=self.snapshot(self.codex)
                    self.assertNotEqual(self.run_cli('setup').returncode,0)
                    self.assertEqual(self.snapshot(self.codex),before)
                    target.unlink()

    def test_symlink_guidance_is_rejected_without_touching_target(self):
        outside=self.base/'outside.md';outside.write_text('keep')
        for name in ['AGENTS.md','AGENTS.override.md']:
            with self.subTest(name=name):
                target=self.codex/name;target.symlink_to(outside)
                self.assertNotEqual(self.run_cli('setup').returncode,0)
                self.assertEqual(outside.read_text(),'keep')
                self.assertFalse((self.codex/'proofstill').exists())
                target.unlink()

    def test_explicit_codex_home_wins_over_environment(self):
        wrong=self.base/'environment-home'
        self.ok(self.run_cli('setup',env=dict(self.env,CODEX_HOME=str(wrong))))
        self.assertTrue((self.codex/'AGENTS.md').is_file())
        self.assertFalse(wrong.exists())

    def test_env_codex_home_and_explicit_help_have_correct_effect(self):
        r=subprocess.run(['node',str(CLI),'setup','--skills-dir',str(self.skills)],env=self.env,
                         cwd=self.base,text=True,capture_output=True,timeout=120)
        self.ok(r)
        self.assertTrue((self.codex/'AGENTS.md').is_file())
        help_home=self.base/'help-only';help_home.mkdir()
        (help_home/'.codex').mkdir();(help_home/'.codex/AGENTS.md').write_text('keep')
        (help_home/'.agents/skills').mkdir(parents=True)
        hook=self.base/'help-home.mjs'
        hook.write_text("import os from 'node:os'; import {syncBuiltinESMExports} from 'node:module'; os.homedir=()=>"+json.dumps(str(help_home))+"; syncBuiltinESMExports();")
        env=self.env.copy();env.pop('CODEX_HOME',None)
        before=self.snapshot(help_home)
        r=subprocess.run(['node','--import',str(hook),str(CLI),'--help'],env=env,text=True,capture_output=True,timeout=10)
        self.ok(r)
        self.assertIn('setup',r.stdout)
        self.assertEqual(self.snapshot(help_home),before)
        self.assertEqual(list((help_home/'.agents/skills').iterdir()),[])
        self.assertFalse((help_home/'.codex/proofstill').exists())

    def test_symlink_skills_directory_preserves_external_files_on_failures(self):
        external=self.base/'external-skills';external.mkdir()
        self.skills.symlink_to(external,target_is_directory=True)
        personal=external/'personal';personal.mkdir();(personal/'SKILL.md').write_text('keep personal')
        self.ok(self.run_cli('setup'))
        before=self.snapshot(external)
        fake=self.base/'fake-npm';fake.mkdir();exe=fake/'npm'
        exe.write_text('#!/bin/sh\nexit 42\n');exe.chmod(0o755)
        self.assertNotEqual(self.run_cli('setup',env=dict(self.env,PATH=str(fake)+os.pathsep+os.environ['PATH'])).returncode,0)
        self.assertEqual(self.snapshot(external),before)
        marker=self.codex/'AGENTS.md';marker.write_text('<!-- proofstill:begin -->')
        self.assertNotEqual(self.run_cli('setup').returncode,0)
        self.assertEqual(self.snapshot(external),before)
        self.assertTrue(self.skills.is_symlink())

    def test_guidance_commit_failure_restores_runtime_links_and_both_files(self):
        (self.codex/'AGENTS.override.md').write_text('existing override')
        self.ok(self.run_cli('setup'))
        (self.codex/'AGENTS.md').write_text('user base without managed block')
        (self.codex/'AGENTS.override.md').write_text('user override without managed block')
        (self.skills/'proofstill-db').unlink()
        before=self.snapshot(self.codex);skills_before=self.snapshot(self.skills)
        hook=self.base/'fail-commit.mjs'
        hook.write_text("import fs from 'node:fs/promises'; const rename=fs.rename; let failed=false; fs.rename=async(a,b)=>{if(!failed && String(b)==="+json.dumps(str(self.codex/'AGENTS.override.md'))+"){failed=true;const e=new Error('GUIDANCE_COMMIT_DENIED');e.code='EACCES';throw e;}return rename(a,b);};")
        env=dict(self.env,NODE_OPTIONS='--import='+json.dumps(str(hook)))
        r=self.run_cli('setup',env=env)
        self.assertNotEqual(r.returncode,0)
        self.assertIn('GUIDANCE_COMMIT_DENIED',r.stderr)
        self.assertEqual(self.snapshot(self.codex),before)
        self.assertEqual(self.snapshot(self.skills),skills_before)
        self.ok(self.run_cli('setup'))
        self.assertTrue((self.skills/'proofstill-db/SKILL.md').is_file())

    def test_no_arguments_use_default_user_directories(self):
        # Replace only the OS home-directory boundary; do not alter the real HOME.
        home=self.base/'new-user';home.mkdir()
        hook=self.base/'home-fixture.mjs'
        hook.write_text("import os from 'node:os'; import {syncBuiltinESMExports} from 'node:module'; os.homedir = () => "+json.dumps(str(home))+"; syncBuiltinESMExports();\n")
        env=self.env.copy();env.pop('CODEX_HOME',None)
        r=subprocess.run(['node','--import',str(hook),str(CLI)],env=env,cwd=self.base,
                         text=True,capture_output=True,timeout=120)
        self.ok(r)
        self.assertTrue((home/'.codex/AGENTS.md').is_file(),'GLOBAL_SETUP_NOT_REGISTERED: no-argument CLI must install global guidance')
        self.assertTrue((home/'.codex/proofstill/runtime/bin/proofstill.mjs').is_file())
        self.assertEqual({p.name for p in (home/'.agents/skills').iterdir()},set(NAMES))
        for name in NAMES:self.assertTrue((home/'.agents/skills'/name/'SKILL.md').is_file())

    @staticmethod
    def snapshot(root):
        result={}
        for p in root.rglob('*'):
            name=str(p.relative_to(root))
            if p.is_symlink():
                result[name]='link:'+os.readlink(p)
                if p.is_dir():
                    for child in p.rglob('*'):
                        if child.is_file():result[name+'/'+str(child.relative_to(p))]=hashlib.sha256(child.read_bytes()).hexdigest()
            elif p.is_file():result[name]=hashlib.sha256(p.read_bytes()).hexdigest()
        return result

if __name__ == '__main__': unittest.main()
