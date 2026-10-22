"""Falhas de deploy com comandos/HTTP simulados; nunca toca Docker/Git reais."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('deploy', Path(__file__).resolve().parents[2] / 'ops/deploy.py')
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.root = self.base / 'repo'
        self.root.mkdir()
        self.state = self.base / 'state'
        self.state.mkdir(mode=0o700)
        self.env_file = self.base / 'production.env'
        self.env_file.write_text('PAYLOAD_SECRET=private-not-for-logs\n')
        self.env_file.chmod(0o600)
        password = self.base / 'restic-password'
        password.write_text('private-restic-password')
        password.chmod(0o600)
        backup = self.base / 'backup.json'
        backup.write_text(json.dumps({'RESTIC_REPOSITORY': 'sftp:synthetic.invalid:/backup', 'RESTIC_PASSWORD_FILE': str(password)}))
        backup.chmod(0o600)
        self.config = {'env_file': str(self.env_file), 'branch': 'main', 'worker': False, 'backup_env': str(backup), 'health_timeout': 1, 'min_memory_mb': 1, 'min_disk_mb': 1, 'public_health': True}
        self.candidate = {'name': 'bibliotheon', 'services': {
            'app': {'read_only': True, 'ports': [{'host_ip': '127.0.0.1', 'published': '33001'}], 'environment': {'PAYLOAD_SECRET': 'a'*64, 'LEAD_TOKEN_SECRET': 'b'*64, 'PUBLIC_SITE_URL': 'https://example.invalid', 'DATABASE_URL': 'runtime-private', 'EMAIL_TRANSPORT_ENABLED': 'false'}},
            'db': {'image': 'postgres@sha256:'+'d'*64, 'environment': {'POSTGRES_PASSWORD': 'synthetic-only'}, 'volumes': [{'source': 'database'}]},
            'migrate': {'environment': {'DATABASE_URL': 'owner-private'}}, 'worker': {'read_only': True}}, 'volumes': {'database': {'name': 'bibliotheon_database'}, 'media': {'name': 'bibliotheon_media'}}}
        self.commit = 'a'*40
        self.calls = []
        self.fail = lambda argv: False
        self.fail_health = False
        self.existing = False
        self.old_umask = os.umask(0o077)
        self.addCleanup(os.umask, self.old_umask)
        self.root_patch = patch.object(deploy, 'ROOT', self.root)
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)
        self.cmd_patch = patch.object(deploy, 'command', self.command)
        self.cmd_patch.start()
        self.addCleanup(self.cmd_patch.stop)
        self.http_patch = patch.object(deploy, 'ready', self.ready)
        self.http_patch.start()
        self.addCleanup(self.http_patch.stop)

    def command(self, argv, **kwargs):
        self.calls.append(list(argv))
        if self.fail(argv):
            raise deploy.DeployError('synthetic failure')
        if argv[:3] == ['git', 'rev-parse', 'HEAD']:
            return self.commit
        if argv[:3] == ['docker', 'ps', '-aq'] or argv[:3] == ['docker', 'volume', 'ls']:
            return 'existing-resource' if self.existing else ''
        if argv[:3] == ['docker', 'image', 'inspect']:
            return 'sha256:'+'c'*64
        if argv[:2] == ['docker', 'inspect']:
            return 'sha256:'+'c'*64+' running healthy'
        if argv[:2] == ['docker', 'compose']:
            if 'config' in argv:
                return json.dumps(self.candidate)
            if 'ps' in argv:
                return 'e'*64
        return ''

    def ready(self, *_):
        if self.fail_health:
            raise deploy.DeployError('synthetic readiness failure')

    def initial(self):
        deploy.apply(self.config, self.state, initial=True)

    def update(self):
        self.initial()
        self.calls.clear()
        self.commit = 'b'*40

    def contains(self, *items):
        return any(all(item in argv for item in items) for argv in self.calls)

    def test_initial_then_update_backup_precedes_migration_and_preserves_volumes(self):
        self.update()
        deploy.apply(self.config, self.state)
        backup = next(i for i, argv in enumerate(self.calls) if 'backup' in argv)
        migration = next(i for i, argv in enumerate(self.calls) if 'run' in argv and 'migrate' in argv)
        self.assertLess(backup, migration)
        self.assertFalse(self.contains('up', 'db'), 'Atualização comum não recria o banco.')
        self.assertFalse(any(set(argv) & {'down', 'prune', 'reset', 'clean'} for argv in self.calls))
        self.assertFalse((self.state / 'in-progress.json').exists())
        current = json.loads((self.state / 'current.json').read_text())
        self.assertEqual(current['commit'], self.commit)
        self.assertTrue(Path(current['previous']).is_file())
        self.assertEqual(Path(current['compose_file']).stat().st_mode & 0o077, 0)
        self.assertFalse(self.contains('up', 'worker'))

    def test_same_commit_is_noop_with_health_and_image_check(self):
        self.initial()
        self.calls.clear()
        deploy.apply(self.config, self.state)
        self.assertTrue(self.contains('inspect'))
        self.assertFalse(self.contains('build'))

    def test_build_failure_keeps_old_app_and_manifest(self):
        self.update()
        self.fail = lambda argv: argv[:2] == ['docker', 'build']
        with self.assertRaises(deploy.DeployError):
            deploy.apply(self.config, self.state)
        self.assertFalse(self.contains('stop', 'app'))
        self.assertFalse((self.state / 'in-progress.json').exists())
        self.assertEqual(json.loads((self.state / 'current.json').read_text())['commit'], 'a'*40)

    def test_backup_failure_resumes_old_app_without_migration(self):
        self.update()
        self.fail = lambda argv: 'backup' in argv
        with self.assertRaises(deploy.DeployError):
            deploy.apply(self.config, self.state)
        self.assertTrue(self.contains('up', 'app'))
        self.assertFalse(self.contains('run', 'migrate'))
        self.assertFalse((self.state / 'in-progress.json').exists())

    def test_migration_failure_stops_app_preserves_pending_and_blocks_repeat(self):
        self.update()
        self.fail = lambda argv: 'run' in argv and 'migrate' in argv
        with self.assertRaises(deploy.DeployError):
            deploy.apply(self.config, self.state)
        self.assertTrue((self.state / 'in-progress.json').exists())
        self.assertFalse(self.contains('up', 'app'))
        with self.assertRaises(deploy.DeployError):
            deploy.apply(self.config, self.state)
        self.fail = lambda _: False
        deploy.apply(self.config, self.state, resume=True)
        self.assertFalse((self.state / 'in-progress.json').exists())
        self.assertTrue(self.contains('up', 'app'))

    def test_readiness_failure_never_reverts_schema_or_starts_worker(self):
        self.update()
        self.fail_health = True
        with self.assertRaises(deploy.DeployError):
            deploy.apply(self.config, self.state)
        self.assertTrue((self.state / 'in-progress.json').exists())
        self.assertTrue(self.contains('stop', 'app'))
        self.assertFalse(self.contains('up', 'worker'))

    def test_database_change_refused_before_build(self):
        self.update()
        self.candidate['services']['db']['image'] = 'postgres@sha256:'+'e'*64
        with self.assertRaises(deploy.DeployError):
            deploy.apply(self.config, self.state)
        self.assertFalse(self.contains('build'))

    def test_initial_refuses_existing_resources(self):
        self.existing = True
        with self.assertRaises(deploy.DeployError):
            self.initial()
        self.assertFalse(self.contains('build'))

    def test_first_deploy_can_resume_after_migration_failure(self):
        self.fail = lambda argv: 'run' in argv and 'migrate' in argv
        with self.assertRaises(deploy.DeployError):
            self.initial()
        self.fail = lambda _: False
        deploy.apply(self.config, self.state, resume=True)
        self.assertTrue((self.state / 'current.json').exists())

    def test_raw_output_is_not_persisted_in_log(self):
        with patch.object(deploy, 'command', spec.loader.load_module if False else self.cmd_patch.temp_original):
            log = self.base / 'log'
            with patch.object(deploy.subprocess, 'run', return_value=subprocess.CompletedProcess(['tool'], 1, b'private-token', b'private-address')):
                with self.assertRaises(deploy.DeployError):
                    deploy.command(['tool'], log=log)
            self.assertNotIn('private-token', log.read_text())
            self.assertNotIn('private-address', log.read_text())


if __name__ == '__main__':
    unittest.main()
