"""Contratos de operação local com processos temporários; sem Docker/banco/Next."""
from contextlib import ExitStack
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('local_dev', ROOT / 'scripts/local-dev.py')
local = importlib.util.module_from_spec(spec)
spec.loader.exec_module(local)


@unittest.skipUnless(Path('/proc/self/stat').is_file(), 'Requer Linux')
class LocalDevelopmentTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='bibliotheon-local-control-')
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.state = self.root / 'dev.json'
        self.root_patch = patch.object(local, 'ROOT', self.root)
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)

    def process(self, code='import time; time.sleep(60)', **kwargs):
        child = subprocess.Popen([sys.executable, '-c', code], cwd=self.root,
                                 start_new_session=True, **kwargs)
        def cleanup():
            if child.poll() is None:
                os.killpg(child.pid, signal.SIGKILL)
            child.wait(timeout=5)
        self.addCleanup(cleanup)
        deadline = time.monotonic() + 3
        while not local.identity(child.pid) and time.monotonic() < deadline:
            time.sleep(0.01)
        return child

    def test_recycled_or_foreign_identity_is_never_signaled(self):
        child = self.process()
        record = local.identity(child.pid)
        record['started'] = '0'
        with self.assertRaises(local.LocalError):
            local.terminate(record, self.root)
        self.assertIsNone(child.poll())

    def test_different_checkout_cannot_stop_process(self):
        child = self.process()
        with self.assertRaises(local.LocalError):
            local.terminate(local.identity(child.pid), self.root / 'other')
        self.assertIsNone(child.poll())

    def test_stop_terminates_entire_detached_tree(self):
        # O pai aguarda/recolhe o filho no SIGTERM, evitando zombies no ensaio.
        marker = self.root / 'child.pid'
        code = '''import os, signal, subprocess, sys, time
child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'])
open('child.pid', 'w').write(str(child.pid))
def stop(*args):
    child.wait(timeout=3)
    sys.exit(0)
signal.signal(signal.SIGTERM, stop)
time.sleep(60)
'''
        parent = self.process(code)
        deadline = time.monotonic() + 3
        while not marker.exists() and time.monotonic() < deadline:
            time.sleep(0.01)
        self.assertTrue(marker.exists())
        descendant = int(marker.read_text())
        local.terminate(local.identity(parent.pid), self.root)
        parent.wait(timeout=3)
        self.assertIsNone(local.identity(descendant))

    def test_stop_foreign_pid_does_not_stop_database(self):
        child = self.process()
        record = local.identity(child.pid)
        record['started'] = '0'
        self.state.write_text(json.dumps(record))
        with patch.object(local, 'command') as command:
            with self.assertRaises(local.LocalError):
                local.stop(self.state, False)
            command.assert_not_called()
        self.assertTrue(self.state.exists())
        self.assertIsNone(child.poll())

    def test_stop_keep_db_preserves_compose_and_cleans_state(self):
        child = self.process()
        self.state.write_text(json.dumps(local.identity(child.pid)))
        with patch.object(local, 'available_port'), patch.object(local, 'command') as command:
            local.stop(self.state, True)
            command.assert_not_called()
        self.assertFalse(self.state.exists())
        child.wait(timeout=3)

    def test_foreign_server_blocks_database_stop(self):
        with patch.object(local, 'available_port', side_effect=local.LocalError('occupied')), patch.object(local, 'command') as command:
            with self.assertRaises(local.LocalError):
                local.stop(self.state, False)
            command.assert_not_called()

    def test_start_preserves_legacy_registration(self):
        legacy = self.root / '.local-run/next.pid'
        legacy.parent.mkdir()
        legacy.write_text('123\n')
        with patch.object(local, 'command') as command:
            with self.assertRaises(local.LocalError):
                local.start(self.state)
            command.assert_not_called()
        self.assertEqual(legacy.read_text(), '123\n')

    def test_start_does_not_report_unhealthy_process_as_ready(self):
        child = self.process()
        self.state.write_text(json.dumps(local.identity(child.pid)))
        with patch.object(local, 'healthy', return_value=False), patch.object(local, 'command') as command:
            with self.assertRaises(local.LocalError):
                local.start(self.state)
            command.assert_not_called()
        self.assertIsNone(child.poll())

    def prepare_fake_start(self):
        (self.root / '.env.local').write_text('SYNTHETIC=true\n')
        entry = self.root / 'node_modules/next/dist/bin/next'
        entry.parent.mkdir(parents=True)
        entry.write_text('synthetic')
        fake_bin = self.root / 'bin'
        fake_bin.mkdir()
        node = fake_bin / 'node'
        node.write_text('#!/usr/bin/python3\nimport time; time.sleep(60)\n')
        node.chmod(0o755)
        stack = ExitStack()
        stack.enter_context(patch.dict(os.environ, {'PATH': str(fake_bin) + ':' + os.environ['PATH']}))
        original_spawn = subprocess.Popen
        children = []
        def spawn(*args, **kwargs):
            child = original_spawn(*args, **kwargs)
            children.append(child)
            return child
        def reap():
            for child in children:
                if child.poll() is None:
                    os.killpg(child.pid, signal.SIGKILL)
                child.wait(timeout=3)
        self.addCleanup(reap)
        stack.enter_context(patch.object(local.subprocess, 'Popen', side_effect=spawn))
        return stack

    def test_start_is_idempotent_without_repeating_migrations(self):
        with self.prepare_fake_start(), patch.object(local, 'available_port'), patch.object(local.shutil, 'which', return_value='/synthetic'), patch.object(local, 'command') as command, patch.object(local, 'healthy', return_value=True):
            local.start(self.state)
            record = local.read_state(self.state)
            try:
                self.assertTrue(local.owned(record, self.root))
                local.start(self.state)
                self.assertEqual(command.call_count, 2)  # Compose + migrate, apenas uma vez.
                self.assertEqual(self.state.stat().st_mode & 0o777, 0o600)
            finally:
                local.terminate(record, self.root)
                self.state.unlink(missing_ok=True)

    def test_start_failure_cleans_process_and_state_without_stopping_db(self):
        records = []
        def fail_health():
            records.append(local.read_state(self.state))
            raise local.LocalError('synthetic readiness failure')
        with self.prepare_fake_start(), patch.object(local, 'available_port'), patch.object(local.shutil, 'which', return_value='/synthetic'), patch.object(local, 'command') as command, patch.object(local, 'healthy', side_effect=fail_health):
            with self.assertRaises(local.LocalError):
                local.start(self.state)
            self.assertEqual(command.call_count, 2)
        self.assertFalse(self.state.exists())
        self.assertEqual(len(records), 1)
        self.assertIsNone(local.identity(records[0]['pid']))

    def test_corrupt_state_is_preserved(self):
        self.state.write_text('{broken')
        with self.assertRaises(local.LocalError):
            local.read_state(self.state)
        self.assertEqual(self.state.read_text(), '{broken')

    def test_port_conflict_comes_before_docker_or_migrations(self):
        with patch.object(local, 'available_port', side_effect=local.LocalError('occupied')), patch.object(local, 'command') as command:
            with self.assertRaises(local.LocalError):
                local.start(self.state)
            command.assert_not_called()


class EntrypointTests(unittest.TestCase):
    def test_shell_entrypoints_help_from_other_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            for script in ('start.sh', 'stop.sh', 'atualizar.sh'):
                with self.subTest(script=script):
                    result = subprocess.run([str(ROOT / script), '--help'], cwd=directory,
                                            capture_output=True, text=True, timeout=10)
                    self.assertEqual(result.returncode, 0, result.stderr)

    def test_all_integration_scripts_are_covered_once(self):
        collected = []
        for name in ('check-integration.sh', 'check-http.sh'):
            result = subprocess.run(['bash', str(ROOT / 'scripts' / name), '--list'],
                                    capture_output=True, text=True, check=True)
            collected.extend(result.stdout.splitlines())
        expected = {name for name in json.loads((ROOT / 'package.json').read_text())['scripts'] if name.startswith('test:')}
        self.assertEqual(set(collected), expected)
        self.assertEqual(len(collected), len(expected))

    def test_integration_requires_disposable_environment_acknowledgement(self):
        env = {key: value for key, value in os.environ.items() if key != 'BIBLIOTHEON_SYNTHETIC_TESTS'}
        for name in ('check-integration.sh', 'check-http.sh'):
            result = subprocess.run(['bash', str(ROOT / 'scripts' / name)], env=env,
                                    capture_output=True, text=True, timeout=5)
            self.assertEqual(result.returncode, 2)
            self.assertIn('descartáveis', result.stderr)

class HTTPHarnessTests(unittest.TestCase):
    """Executa o shell real em checkout temporário com servidor/comandos sintéticos."""
    def harness(self, fail_readiness=False, fail_suite=''):
        with tempfile.TemporaryDirectory(prefix='bibliotheon-http-harness-') as directory:
            root = Path(directory)
            (root / 'scripts').mkdir()
            script = root / 'scripts/check-http.sh'
            script.write_bytes((ROOT / 'scripts/check-http.sh').read_bytes())
            fake_bin = root / 'bin'
            fake_bin.mkdir()
            programs = {
                'python3': '#!/bin/sh\nexit 0\n',  # Porta sintética; não toca a porta 3000.
                'node': '#!/usr/bin/python3\nimport os,time\nopen("server.pid","w").write(str(os.getpid()))\ntime.sleep(60)\n',
                'curl': '#!/bin/sh\nexit ' + ('1' if fail_readiness else '0') + '\n',
                'sleep': '#!/bin/sh\nexit 0\n',
                'npm': '#!/bin/sh\necho "$2" >> suites.txt\n[ "$2" != "' + fail_suite + '" ]\n',
            }
            for name, body in programs.items():
                path = fake_bin / name
                path.write_text(body)
                path.chmod(0o755)
            result = subprocess.run(['bash', str(script)], cwd=root,
                env={**os.environ, 'PATH': str(fake_bin) + ':' + os.environ['PATH'],
                     'BIBLIOTHEON_SYNTHETIC_TESTS': 'true'}, capture_output=True, text=True, timeout=15)
            suites = (root / 'suites.txt').read_text().splitlines() if (root / 'suites.txt').exists() else []
            marker = root / 'server.pid'
            if marker.exists():
                pid = int(marker.read_text())
                self.assertIsNone(local.identity(pid), 'Servidor sintético vazou após o harness')
            return result, suites

    def test_unhealthy_server_prevents_all_http_suites(self):
        result, suites = self.harness(fail_readiness=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(suites, [])
        self.assertIn('não ficou saudável', result.stderr)

    def test_suite_failure_stops_sequence_and_cleans_process(self):
        result, suites = self.harness(fail_suite='test:cakto-http')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(suites[-1], 'test:cakto-http')
        self.assertNotIn('test:commercial-csv-http', suites)

    def test_healthy_server_runs_all_suites_and_is_stopped(self):
        result, suites = self.harness()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(suites), 10)
        self.assertEqual(suites[-1], 'test:admin-recovery')


if __name__ == '__main__':
    unittest.main()
