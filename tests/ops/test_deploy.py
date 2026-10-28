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
            'app': {'read_only': True, 'volumes': [{'type': 'volume', 'source': 'media', 'target': '/app/uploads'}], 'ports': [{'host_ip': '127.0.0.1', 'published': '33001'}], 'environment': {'PAYLOAD_SECRET': 'a'*64, 'LEAD_TOKEN_SECRET': 'b'*64, 'PUBLIC_SITE_URL': 'https://example.invalid', 'DATABASE_URL': 'postgresql://bibliotheon_runtime:synthetic-runtime@db:5432/bibliotheon', 'EMAIL_TRANSPORT_ENABLED': 'false'}},
            'db': {'image': 'postgres@sha256:'+'d'*64, 'environment': {'POSTGRES_PASSWORD': 'synthetic-only', 'DB_RUNTIME_PASSWORD': 'synthetic-runtime'}, 'volumes': [{'source': 'database'}]},
            'migrate': {'environment': {'DATABASE_URL': 'postgresql://bibliotheon_owner:synthetic-only@db:5432/bibliotheon'}}, 'worker': {'read_only': True}}, 'volumes': {'database': {'name': 'bibliotheon_database'}, 'media': {'name': 'bibliotheon_media'}}}
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
        self.real_command = deploy.command
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
        if 'backup' in argv:
            return json.dumps({'status': 'backup_encrypted', 'external': True, 'snapshot': 'f'*64, 'capturedAt': '2026-10-22T01:00:00Z', 'durationSeconds': 1})
        if 'cli/media-gc.js' in argv:
            return json.dumps({'mode': 'apply', 'scanned': 0, 'referenced': 0, 'candidates': 0, 'eligible': 0, 'removed': 0, 'skipped': 0})
        if argv[:3] == ['git', 'rev-parse', 'HEAD']:
            return self.commit
        if argv == ['git', 'rev-parse', 'FETCH_HEAD']:
            return self.commit
        if argv == ['git', 'rev-parse', '--show-toplevel']:
            return str(self.root)
        if argv == ['git', 'branch', '--show-current']:
            return 'main'
        if argv[:2] == ['git', 'pull']:
            self.assertEqual(kwargs['env']['GIT_TERMINAL_PROMPT'], '0')
            self.assertIn('BatchMode=yes', kwargs['env']['GIT_SSH_COMMAND'])
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

    def ready(self, url, *_):
        self.calls.append(['http-ready', url])
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
        self.assertEqual(current['backup_snapshot'], 'f'*64)
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

    def test_update_can_skip_backup_without_backup_config(self):
        self.update()
        config = dict(self.config)
        config.pop('backup_env')
        deploy.apply(config, self.state, backup_enabled=False)
        self.assertFalse(any('backup' in argv for argv in self.calls))
        self.assertTrue(self.contains('stop', 'app'))
        self.assertTrue(self.contains('run', 'migrate'))
        stopped = next(i for i, argv in enumerate(self.calls) if 'stop' in argv and 'app' in argv)
        migration = next(i for i, argv in enumerate(self.calls) if 'run' in argv and 'migrate' in argv)
        self.assertLess(stopped, migration)
        current = json.loads((self.state / 'current.json').read_text())
        self.assertTrue(current['backup_skipped'])
        self.assertNotIn('backup_snapshot', current)
        self.assertFalse((Path(current['release']) / 'backup.json').exists())

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
        with patch.object(deploy, 'command', self.real_command):
            log = self.base / 'log'
            with patch.object(deploy.subprocess, 'run', return_value=subprocess.CompletedProcess(['tool'], 1, b'private-token', b'private-address')):
                with self.assertRaises(deploy.DeployError):
                    deploy.command(['tool'], log=log)
            self.assertNotIn('private-token', log.read_text())
            self.assertNotIn('private-address', log.read_text())

    def test_daily_backup_does_not_pull_build_or_migrate(self):
        self.initial()
        self.calls.clear()
        deploy.backup_current(self.config, self.state)
        self.assertTrue((self.state / 'last-backup.json').is_file())
        self.assertTrue((self.state / 'last-media-gc.json').is_file())
        backup = next(i for i, argv in enumerate(self.calls) if 'backup' in argv)
        gc = next(i for i, argv in enumerate(self.calls) if 'cli/media-gc.js' in argv)
        self.assertLess(backup, gc)
        self.assertFalse(self.contains('build'))
        self.assertFalse(self.contains('git'))
        self.assertFalse(self.contains('migrate'))
        self.assertTrue(self.contains('up', 'app'))

    def test_daily_backup_failure_resumes_existing_app(self):
        self.initial()
        self.calls.clear()
        self.fail = lambda argv: 'backup' in argv
        with self.assertRaises(deploy.DeployError):
            deploy.backup_current(self.config, self.state)
        self.assertTrue(self.contains('up', 'app'))
        self.assertFalse((self.state / 'last-backup.json').exists())

    def test_dirty_checkout_blocks_before_pull(self):
        def fake(argv, **kwargs):
            if argv == ['git', 'status', '--porcelain']:
                return ' M file'
            return self.command(argv, **kwargs)
        with patch.object(deploy, 'read_config', return_value=(self.config, self.state)), patch.object(deploy, 'command', side_effect=fake), patch.object(deploy.sys, 'argv', ['deploy.py']), patch.object(deploy, 'apply') as apply:
            with self.assertRaisesRegex(deploy.DeployError, 'alterações locais'):
                deploy.main()
            apply.assert_not_called()
        self.assertFalse(self.contains('pull'))

    def test_git_pull_is_fast_forward_and_noninteractive(self):
        with patch.object(deploy, 'read_config', return_value=(self.config, self.state)), patch.object(deploy.sys, 'argv', ['deploy.py']), patch.object(deploy, 'apply') as apply, patch.dict(os.environ, {}, clear=True):
            deploy.main()
            apply.assert_called_once()
        self.assertTrue(self.contains('git', 'pull', '--ff-only', 'origin', 'main'))

    def test_parallel_update_refused_by_real_file_lock(self):
        import fcntl
        with (self.state / 'deploy.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with patch.object(deploy, 'read_config', return_value=(self.config, self.state)), patch.object(deploy.sys, 'argv', ['deploy.py']):
                with self.assertRaisesRegex(deploy.DeployError, 'Outra atualização'):
                    deploy.main()

    def test_daily_backup_failed_resume_preserves_checkpoint(self):
        self.initial()
        self.fail = lambda argv: 'up' in argv and 'app' in argv
        with self.assertRaises(deploy.DeployError):
            deploy.backup_current(self.config, self.state)
        self.assertEqual(json.loads((self.state / 'in-progress.json').read_text())['phase'], 'backup-only')

    def test_wrong_database_and_media_rejected(self):
        self.candidate['services']['migrate']['environment']['DATABASE_URL'] = 'postgresql://bibliotheon_owner:synthetic-only@other-host:5432/bibliotheon'
        with self.assertRaises(deploy.DeployError):
            deploy.validate_compose(self.candidate, self.config)
        self.candidate['services']['migrate']['environment']['DATABASE_URL'] = 'postgresql://bibliotheon_owner:synthetic-only@db:5432/bibliotheon'
        self.candidate['services']['app']['volumes'][0]['source'] = 'other-volume'
        with self.assertRaises(deploy.DeployError):
            deploy.validate_compose(self.candidate, self.config)

    def test_worker_only_starts_after_app_health(self):
        self.config['worker'] = True
        self.candidate['services']['app']['environment']['EMAIL_TRANSPORT_ENABLED'] = 'true'
        self.initial()
        app = next(i for i,c in enumerate(self.calls) if 'up' in c and 'app' in c)
        worker = next(i for i,c in enumerate(self.calls) if 'up' in c and 'worker' in c)
        self.assertLess(app, worker)
        health = next(i for i,c in enumerate(self.calls) if 'http-ready' in c)
        self.assertLess(health, worker)
        self.assertEqual(json.loads((self.state / 'current.json').read_text())['worker'], True)

    def test_worker_failure_preserves_pending_and_stops_application(self):
        self.config['worker'] = True
        self.candidate['services']['app']['environment']['EMAIL_TRANSPORT_ENABLED'] = 'true'
        self.fail = lambda argv: 'up' in argv and 'worker' in argv
        with self.assertRaises(deploy.DeployError):
            self.initial()
        self.assertTrue(self.contains('stop', 'app', 'worker'))
        self.assertTrue((self.state / 'in-progress.json').exists())

    def test_resources_below_threshold_do_not_stop_old_app(self):
        self.update()
        self.config['min_memory_mb'] = 2**63
        with self.assertRaisesRegex(deploy.DeployError, 'RAM/disco'):
            deploy.apply(self.config, self.state)
        self.assertFalse(self.contains('stop'))
        self.assertFalse(self.contains('build'))

    def test_private_configuration_permissions_and_paths(self):
        values = {**self.config, 'state_dir': str(self.state)}
        file = self.base / 'deploy.json'
        file.write_text(json.dumps(values))
        file.chmod(0o600)
        config, state = deploy.read_config(file)
        self.assertEqual(state, self.state)
        self.assertFalse(config['worker'])
        file.chmod(0o644)
        with self.assertRaises(deploy.DeployError):
            deploy.read_config(file)
        file.chmod(0o600)
        values['state_dir'] = 'relative-path'
        file.write_text(json.dumps(values))
        with self.assertRaisesRegex(deploy.DeployError, 'absolutos'):
            deploy.read_config(file)

    def test_resolved_compose_preserves_literal_dollars(self):
        value = {'environment': {'TOKEN': 'synthetic$TOKEN$$literal'}, 'command': ['echo', '$VALUE']}
        encoded = deploy.compose_literals(value)
        self.assertEqual(encoded['environment']['TOKEN'], 'synthetic$$TOKEN$$$$literal')
        self.assertEqual(deploy.compose_literals(encoded, escape=False), value)

    def test_local_commit_ahead_of_remote_does_not_deploy(self):
        def fake(argv, **kwargs):
            if argv == ['git', 'rev-parse', 'FETCH_HEAD']:
                return 'b'*40
            return self.command(argv, **kwargs)
        with patch.object(deploy, 'read_config', return_value=(self.config, self.state)), patch.object(deploy, 'command', side_effect=fake), patch.object(deploy.sys, 'argv', ['deploy.py']), patch.object(deploy, 'apply') as apply:
            with self.assertRaisesRegex(deploy.DeployError, 'commits locais'):
                deploy.main()
            apply.assert_not_called()

    def test_media_gc_failure_resumes_app_and_preserves_confirmed_backup(self):
        self.initial()
        self.calls.clear()
        self.fail = lambda argv: 'cli/media-gc.js' in argv
        with self.assertRaises(deploy.DeployError):
            deploy.backup_current(self.config, self.state)
        self.assertTrue((self.state / 'last-backup.json').is_file())
        self.assertFalse((self.state / 'last-media-gc.json').exists())
        self.assertTrue(self.contains('up', 'app'))
        self.assertFalse((self.state / 'in-progress.json').exists())


    def test_contact_sync_worker_can_run_without_email_transport(self):
        self.config['worker'] = True
        self.candidate['services']['app']['environment']['BREVO_CONTACT_SYNC_ENABLED'] = 'true'
        with self.assertRaises(deploy.DeployError):
            deploy.validate_compose(self.candidate, self.config)
        self.candidate['services']['app']['environment']['BREVO_API_KEY'] = 'synthetic-only-key'
        deploy.validate_compose(self.candidate, self.config)
        self.candidate['services']['app']['environment']['BREVO_CONTACT_SYNC_ENABLED'] = 'false'
        with self.assertRaises(deploy.DeployError):
            deploy.validate_compose(self.candidate, self.config)


    def test_registration_worker_requires_suppression_channel_and_link_secret(self):
        self.config['worker'] = True
        values = self.candidate['services']['app']['environment']
        values.update({'EMAIL_TRANSPORT_ENABLED': 'true', 'BREVO_CONTACT_REGISTRATION_ENABLED': 'true'})
        with self.assertRaises(deploy.DeployError):
            deploy.validate_compose(self.candidate, self.config)
        values.update({'BREVO_CONTACT_SYNC_ENABLED': 'true', 'BREVO_API_KEY': 'synthetic-only-key'})
        deploy.validate_compose(self.candidate, self.config)
        values['LEAD_TOKEN_SECRET'] = ''
        with self.assertRaises(deploy.DeployError):
            deploy.validate_compose(self.candidate, self.config)


    def test_webhook_requires_independent_private_secrets(self):
        values = self.candidate['services']['app']['environment']
        values['BREVO_WEBHOOK_ENABLED'] = 'true'
        with self.assertRaises(deploy.DeployError):
            deploy.validate_compose(self.candidate, self.config)
        values.update({'BREVO_WEBHOOK_TOKEN': 'w'*64, 'BREVO_WEBHOOK_EVENT_SECRET': 'v'*64})
        deploy.validate_compose(self.candidate, self.config)
        values['BREVO_WEBHOOK_EVENT_SECRET'] = values['BREVO_WEBHOOK_TOKEN']
        with self.assertRaises(deploy.DeployError):
            deploy.validate_compose(self.candidate, self.config)

    def test_observation_worker_requires_only_valid_api_key(self):
        self.config['worker'] = True
        values = self.candidate['services']['app']['environment']
        values.update({'EMAIL_TRANSPORT_ENABLED': 'false', 'BREVO_CONTACT_SYNC_ENABLED': 'false', 'BREVO_CAMPAIGN_OBSERVE_ENABLED': 'true'})
        values['BREVO_API_KEY'] = ''
        with self.assertRaises(deploy.DeployError):
            deploy.validate_compose(self.candidate, self.config)
        values['BREVO_API_KEY'] = 'synthetic-observer'
        deploy.validate_compose(self.candidate, self.config)
        values['BREVO_API_KEY'] = 'invalid key'
        with self.assertRaises(deploy.DeployError):
            deploy.validate_compose(self.candidate, self.config)

    def test_hotmart_receiver_requires_account_and_independent_token(self):
        values = self.candidate['services']['app']['environment']
        values['HOTMART_WEBHOOK_ENABLED'] = 'true'
        with self.assertRaises(deploy.DeployError):
            deploy.validate_compose(self.candidate, self.config)
        values.update({'HOTMART_ACCOUNT_KEY': 'synthetic-account', 'HOTMART_HOTTOK': 'synthetic-native-token'})
        deploy.validate_compose(self.candidate, self.config)
        for key, bad in [('HOTMART_ACCOUNT_KEY', 'buyer@example.invalid'), ('HOTMART_HOTTOK', values['PAYLOAD_SECRET']), ('HOTMART_PREVIOUS_HOTTOK', 'synthetic-native-token')]:
            before = values.get(key)
            values[key] = bad
            with self.assertRaises(deploy.DeployError):
                deploy.validate_compose(self.candidate, self.config)
            if before is None:
                values.pop(key, None)
            else:
                values[key] = before

    def test_hotmart_secret_is_not_needed_by_worker(self):
        self.candidate['services']['worker']['environment'] = {'HOTMART_HOTTOK': 'synthetic-native-token'}
        with self.assertRaises(deploy.DeployError):
            deploy.validate_compose(self.candidate, self.config)

    def test_kiwify_receiver_requires_account_and_independent_strong_token(self):
        values = self.candidate['services']['app']['environment']
        values['KIWIFY_WEBHOOK_ENABLED'] = 'true'
        with self.assertRaises(deploy.DeployError):
            deploy.validate_compose(self.candidate, self.config)
        values.update({'KIWIFY_ACCOUNT_KEY': 'synthetic-account', 'KIWIFY_WEBHOOK_TOKEN': 'synthetic-kiwify-token-at-least-32-characters'})
        deploy.validate_compose(self.candidate, self.config)
        for key, bad in [('KIWIFY_ACCOUNT_KEY', 'buyer@example.invalid'), ('KIWIFY_WEBHOOK_TOKEN', 'short'), ('KIWIFY_WEBHOOK_TOKEN', values['PAYLOAD_SECRET']), ('KIWIFY_WEBHOOK_PREVIOUS_TOKEN', values['KIWIFY_WEBHOOK_TOKEN'])]:
            before = values.get(key)
            values[key] = bad
            with self.assertRaises(deploy.DeployError):
                deploy.validate_compose(self.candidate, self.config)
            if before is None:
                del values[key]
            else:
                values[key] = before

    def test_kiwify_secret_is_not_needed_by_worker(self):
        self.candidate['services']['worker']['environment'] = {'KIWIFY_WEBHOOK_TOKEN': 'synthetic-kiwify-token-at-least-32-characters'}
        with self.assertRaises(deploy.DeployError):
            deploy.validate_compose(self.candidate, self.config)

    def test_cakto_receiver_requires_account_and_independent_strong_token(self):
        values = self.candidate['services']['app']['environment']
        values['CAKTO_WEBHOOK_ENABLED'] = 'true'
        with self.assertRaises(deploy.DeployError):
            deploy.validate_compose(self.candidate, self.config)
        values.update({'CAKTO_ACCOUNT_KEY': 'synthetic-account', 'CAKTO_WEBHOOK_SECRET': 'synthetic-cakto-token-at-least-32-characters'})
        deploy.validate_compose(self.candidate, self.config)
        for key, bad in [('CAKTO_ACCOUNT_KEY', 'buyer@example.invalid'), ('CAKTO_WEBHOOK_SECRET', 'short'), ('CAKTO_WEBHOOK_SECRET', values['PAYLOAD_SECRET']), ('CAKTO_WEBHOOK_PREVIOUS_SECRET', values['CAKTO_WEBHOOK_SECRET'])]:
            before = values.get(key)
            values[key] = bad
            with self.assertRaises(deploy.DeployError):
                deploy.validate_compose(self.candidate, self.config)
            if before is None:
                del values[key]
            else:
                values[key] = before

    def test_cakto_secret_is_not_needed_by_worker(self):
        self.candidate['services']['worker']['environment'] = {'CAKTO_WEBHOOK_SECRET': 'synthetic-cakto-token-at-least-32-characters'}
        with self.assertRaises(deploy.DeployError):
            deploy.validate_compose(self.candidate, self.config)

    def test_commercial_worker_requires_no_email_or_api_key(self):
        self.config['worker'] = True
        values = self.candidate['services']['app']['environment']
        values.update({'EMAIL_TRANSPORT_ENABLED': 'false', 'BREVO_CONTACT_SYNC_ENABLED': 'false', 'BREVO_CAMPAIGN_OBSERVE_ENABLED': 'false', 'COMMERCIAL_EVENTS_ENABLED': 'true', 'BREVO_API_KEY': ''})
        deploy.validate_compose(self.candidate, self.config)
        values['COMMERCIAL_EVENTS_ENABLED'] = 'false'
        with self.assertRaises(deploy.DeployError):
            deploy.validate_compose(self.candidate, self.config)

    def test_campaign_send_requires_draft_pipeline(self):
        values = self.candidate['services']['app']['environment']
        values['BREVO_CAMPAIGN_SEND_ENABLED'] = 'true'
        with self.assertRaises(deploy.DeployError):
            deploy.validate_compose(self.candidate, self.config)
        values.update({'BREVO_CONTACT_SYNC_ENABLED': 'true', 'BREVO_LIST_SYNC_ENABLED': 'true', 'BREVO_PREFERENCE_SYNC_ENABLED': 'true', 'BREVO_CAMPAIGN_SYNC_ENABLED': 'true', 'BREVO_API_KEY': 'synthetic', 'BREVO_LIST_FOLDER_ID': '10', 'BREVO_CAMPAIGN_SENDER_ID': '20', 'LEAD_TOKEN_SECRET': 'synthetic-links-key-private-at-least-32-bytes'})
        deploy.validate_compose(self.candidate, self.config)

    def test_campaign_drafts_require_dependencies_and_sender_id(self):
        values = self.candidate['services']['app']['environment']
        values['BREVO_CAMPAIGN_SYNC_ENABLED'] = 'true'
        with self.assertRaises(deploy.DeployError):
            deploy.validate_compose(self.candidate, self.config)
        values.update({'BREVO_CONTACT_SYNC_ENABLED': 'true', 'BREVO_LIST_SYNC_ENABLED': 'true', 'BREVO_PREFERENCE_SYNC_ENABLED': 'true', 'BREVO_API_KEY': 'synthetic', 'BREVO_LIST_FOLDER_ID': '10', 'BREVO_CAMPAIGN_SENDER_ID': '20', 'LEAD_TOKEN_SECRET': 'synthetic-links-key-private-at-least-32-bytes'})
        deploy.validate_compose(self.candidate, self.config)
        values['BREVO_CAMPAIGN_SENDER_ID'] = '1e2'
        with self.assertRaises(deploy.DeployError):
            deploy.validate_compose(self.candidate, self.config)

    def test_preference_sync_requires_suppression_and_private_keys(self):
        values = self.candidate['services']['app']['environment']
        values['BREVO_PREFERENCE_SYNC_ENABLED'] = 'true'
        with self.assertRaises(deploy.DeployError):
            deploy.validate_compose(self.candidate, self.config)
        values.update({'BREVO_CONTACT_SYNC_ENABLED': 'true', 'BREVO_API_KEY': 'synthetic-only-key', 'LEAD_TOKEN_SECRET': 'synthetic-only-links-key-at-least-32-bytes'})
        deploy.validate_compose(self.candidate, self.config)
        values['LEAD_TOKEN_SECRET'] = ''
        with self.assertRaises(deploy.DeployError):
            deploy.validate_compose(self.candidate, self.config)

    def test_list_sync_requires_explicit_folder_and_suppression_channel(self):
        values = self.candidate['services']['app']['environment']
        values['BREVO_LIST_SYNC_ENABLED'] = 'true'
        with self.assertRaises(deploy.DeployError):
            deploy.validate_compose(self.candidate, self.config)
        values.update({'BREVO_CONTACT_SYNC_ENABLED': 'true', 'BREVO_LIST_FOLDER_ID': '100', 'BREVO_API_KEY': 'synthetic-only-key'})
        deploy.validate_compose(self.candidate, self.config)
        values['BREVO_LIST_FOLDER_ID'] = '1e2'
        with self.assertRaises(deploy.DeployError):
            deploy.validate_compose(self.candidate, self.config)


if __name__ == '__main__':
    unittest.main()
