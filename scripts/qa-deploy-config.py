#!/usr/bin/env python3
"""Valida Compose real/normalizado com ambiente sintético. Não inicia containers."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('deploy', root / 'ops/deploy.py')
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)
with tempfile.TemporaryDirectory(prefix='bibliotheon-deploy-config-') as folder:
    private = Path(folder)
    values = {
        'PUBLIC_SITE_URL': 'https://example.invalid', 'BIBLIOTHEON_IMAGE': 'bibliotheon-release:synthetic-check',
        'BIBLIOTHEON_PORT': '33001', 'PAYLOAD_SECRET': 'synthetic-session-'+'a'*48,
        'LEAD_TOKEN_SECRET': 'synthetic-links-'+'b'*48, 'DB_OWNER_PASSWORD': 'synthetic-owner',
        'DB_RUNTIME_PASSWORD': 'synthetic$runtime',
        'DATABASE_URL': 'postgresql://bibliotheon_runtime:synthetic%24runtime@db:5432/bibliotheon',
        'DATABASE_MIGRATION_URL': 'postgresql://bibliotheon_owner:synthetic-owner@db:5432/bibliotheon',
    }
    env_file = private / 'production.env'
    env_file.write_text(''.join(f"{k}='{v}'\n" for k,v in values.items()))
    env_file.chmod(0o600)
    env = deploy.docker_env(env_file, values['BIBLIOTHEON_IMAGE'])
    command = ['docker','compose','-p','bibliotheon','--project-directory',str(root),'-f',str(root/'compose.production.yaml'),'--env-file',str(env_file),'--profile','maintenance','--profile','relationship','config','--format','json']
    result = subprocess.run(command, env=env, capture_output=True, check=True)
    data = deploy.compose_literals(json.loads(result.stdout), escape=False)
    deploy.validate_compose(data, {'worker': False})
    frozen = private / 'compose.json'
    frozen.write_text(json.dumps(deploy.compose_literals(data)))
    frozen.chmod(0o600)
    second = deploy.compose_literals(json.loads(subprocess.run(deploy.compose(frozen, 'config', '--format', 'json'), env=env, capture_output=True, check=True).stdout), escape=False)
    deploy.compatible_database(data, second)
    assert second['services']['app']['environment']['CAKTO_WEBHOOK_ENABLED'] == 'false'
    assert 'CAKTO_WEBHOOK_SECRET' not in second['services']['worker']['environment']
    assert 'CAKTO_WEBHOOK_PREVIOUS_SECRET' not in second['services']['worker']['environment']
    assert second['services']['app']['environment']['KIWIFY_WEBHOOK_ENABLED'] == 'false'
    assert 'KIWIFY_WEBHOOK_TOKEN' not in second['services']['worker']['environment']
    assert 'KIWIFY_WEBHOOK_PREVIOUS_TOKEN' not in second['services']['worker']['environment']
    assert second['services']['app']['environment']['HOTMART_WEBHOOK_ENABLED'] == 'false'
    assert 'HOTMART_HOTTOK' not in second['services']['worker']['environment']
    assert 'HOTMART_PREVIOUS_HOTTOK' not in second['services']['worker']['environment']
    assert second['services']['app']['environment']['COMMERCIAL_EVENTS_ENABLED'] == 'false'
    assert second['services']['worker']['environment']['COMMERCIAL_EVENTS_ENABLED'] == 'false'
    assert second['services']['app']['environment']['BREVO_CAMPAIGN_OBSERVE_ENABLED'] == 'false'
    assert second['services']['worker']['environment']['BREVO_CAMPAIGN_OBSERVE_ENABLED'] == 'false'
    assert second['services']['app']['environment']['BREVO_WEBHOOK_ENABLED'] == 'false'
    assert second['services']['worker']['environment']['BREVO_WEBHOOK_ENABLED'] == 'false'
    assert second['services']['app']['environment']['ANALYTICS_ENABLED'] == 'false'
    assert second['services']['worker']['environment']['ANALYTICS_ENABLED'] == 'false'
    assert second['name'] == 'bibliotheon'
    assert second['services']['app']['environment']['BREVO_CONTACT_SYNC_ENABLED'] == 'false'
    assert second['services']['worker']['environment']['BREVO_CONTACT_SYNC_ENABLED'] == 'false'
    assert second['services']['app']['environment']['BREVO_CONTACT_REGISTRATION_ENABLED'] == 'false'
    assert second['services']['worker']['environment']['BREVO_CONTACT_REGISTRATION_ENABLED'] == 'false'
    assert second['services']['app']['environment']['BREVO_CAMPAIGN_SEND_ENABLED'] == 'false'
    assert second['services']['worker']['environment']['BREVO_CAMPAIGN_SEND_ENABLED'] == 'false'
    assert second['services']['app']['environment']['BREVO_CAMPAIGN_SYNC_ENABLED'] == 'false'
    assert second['services']['worker']['environment']['BREVO_CAMPAIGN_SYNC_ENABLED'] == 'false'
    assert second['services']['app']['environment']['BREVO_PREFERENCE_SYNC_ENABLED'] == 'false'
    assert second['services']['worker']['environment']['BREVO_PREFERENCE_SYNC_ENABLED'] == 'false'
    assert second['services']['app']['environment']['BREVO_LIST_SYNC_ENABLED'] == 'false'
    assert second['services']['worker']['environment']['BREVO_LIST_SYNC_ENABLED'] == 'false'
    assert second['services']['app']['image'] == values['BIBLIOTHEON_IMAGE']
    assert second['services']['migrate']['environment']['DATABASE_URL'] == values['DATABASE_MIGRATION_URL']
    values.update({'CAKTO_WEBHOOK_ENABLED': 'true', 'CAKTO_ACCOUNT_KEY': 'synthetic-account', 'CAKTO_WEBHOOK_SECRET': 'synthetic$cakto-secret-at-least-32-characters', 'KIWIFY_WEBHOOK_ENABLED': 'true', 'KIWIFY_ACCOUNT_KEY': 'synthetic-account', 'KIWIFY_WEBHOOK_TOKEN': 'synthetic$kiwify-token-at-least-32-characters', 'HOTMART_WEBHOOK_ENABLED': 'true', 'HOTMART_ACCOUNT_KEY': 'synthetic-account', 'HOTMART_HOTTOK': 'synthetic$hotmart-token'})
    env_file.write_text(''.join(f"{k}='{v}'\n" for k,v in values.items()))
    enabled_env = deploy.docker_env(env_file, values['BIBLIOTHEON_IMAGE'])
    enabled = deploy.compose_literals(json.loads(subprocess.run(command, env=enabled_env, capture_output=True, check=True).stdout), escape=False)
    deploy.validate_compose(enabled, {'worker': False})
    frozen.write_text(json.dumps(deploy.compose_literals(enabled)))
    enabled_frozen = deploy.compose_literals(json.loads(subprocess.run(deploy.compose(frozen, 'config', '--format', 'json'), env=enabled_env, capture_output=True, check=True).stdout), escape=False)
    deploy.validate_compose(enabled_frozen, {'worker': False})
    assert enabled_frozen['services']['app']['environment']['CAKTO_WEBHOOK_SECRET'] == values['CAKTO_WEBHOOK_SECRET']
    assert 'CAKTO_WEBHOOK_SECRET' not in enabled_frozen['services']['worker']['environment']
    assert enabled_frozen['services']['app']['environment']['KIWIFY_WEBHOOK_TOKEN'] == values['KIWIFY_WEBHOOK_TOKEN']
    assert 'KIWIFY_WEBHOOK_TOKEN' not in enabled_frozen['services']['worker']['environment']
    assert enabled_frozen['services']['app']['environment']['HOTMART_HOTTOK'] == values['HOTMART_HOTTOK']
    assert 'HOTMART_HOTTOK' not in enabled_frozen['services']['worker']['environment']
print('Compose real e JSON privado normalizado aprovados; nenhum container iniciado.')
