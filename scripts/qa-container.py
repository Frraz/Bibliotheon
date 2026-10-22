#!/usr/bin/env python3
"""Homologa a imagem em projeto/volumes descartáveis, sem acessar a VPS."""
from pathlib import Path
import json
import os
import re
import secrets
import socket
import subprocess
import tempfile
import time
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parents[1]
IMAGE = 'bibliotheon:local-b05'
project = 'bibliotheon-container-test-' + secrets.token_hex(5)


def run(command, *, data=None, expected=0):
    result = subprocess.run(command, input=data, capture_output=True)
    if result.returncode != expected:
        diagnostic = result.stderr.decode(errors='replace') + result.stdout.decode(errors='replace')
        for key, value in values.items():
            if any(word in key for word in ['PASSWORD', 'SECRET', 'DATABASE', 'API_KEY', 'TOKEN']):
                diagnostic = diagnostic.replace(value, '[redigido]')
        diagnostic = re.sub(r'\x1b\[[0-9;]*m', '', diagnostic)
        diagnostic = re.sub(r'postgres(?:ql)?://[^\s]+', '[url-banco-redigida]', diagnostic)
        errors = re.findall(r'(?:Error:|ERROR|error:|code:)[^\n]{0,400}', diagnostic)
        raise RuntimeError('Falha no cenário de container: ' + ('; '.join(errors[-5:]) if errors else diagnostic[-2500:]))
    return result.stdout.decode()


def request(port, route, body=None):
    payload = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f'http://127.0.0.1:{port}{route}', data=payload, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


with tempfile.TemporaryDirectory(prefix='bibliotheon-container-test-') as temp:
    env_file = Path(temp) / 'runtime.env'
    owner_password = secrets.token_hex(24)
    runtime_password = secrets.token_hex(24)
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    values = {
        'BIBLIOTHEON_IMAGE': IMAGE, 'BIBLIOTHEON_PORT': str(port), 'PUBLIC_SITE_URL': f'http://127.0.0.1:{port}',
        'PAYLOAD_SECRET': secrets.token_hex(32), 'DB_OWNER_PASSWORD': owner_password, 'DB_RUNTIME_PASSWORD': runtime_password,
        'DATABASE_URL': f'postgresql://bibliotheon_runtime:{runtime_password}@db:5432/bibliotheon',
        'DATABASE_MIGRATION_URL': f'postgresql://bibliotheon_owner:{owner_password}@db:5432/bibliotheon',
        'LEAD_TOKEN_SECRET': secrets.token_hex(32), 'LEADS_ENABLED': 'false', 'EMAIL_TRANSPORT_ENABLED': 'false',
    }
    env_file.write_text('\n'.join(f'{key}={value}' for key, value in values.items()) + '\n')
    env_file.chmod(0o600)
    compose = ['docker', 'compose', '--project-name', project, '--file', str(ROOT / 'compose.production.yaml'), '--env-file', str(env_file)]
    started = time.monotonic()
    try:
        print('Container: iniciando banco descartável e aplicando migrations.', flush=True)
        run(compose + ['up', '-d', '--wait', '--wait-timeout', '60', 'db'])
        run(compose + ['--profile', 'maintenance', 'run', '--rm', '--no-deps', 'migrate'])
        print('Container: iniciando app com runtime limitado e filesystem somente leitura.', flush=True)
        run(compose + ['up', '-d', '--wait', '--wait-timeout', '90', 'app'])
        assert request(port, '/health/ready')[0] == 200
        assert request(port, '/')[0] == 200
        assert request(port, '/api/admin-users')[0] == 403
        assert request(port, '/api/contacts')[0] == 403
        assert request(port, '/api/payload-jobs')[0] == 403
        assert request(port, '/api/payload-jobs/run')[0] in [401, 403]
        assert request(port, '/api/v1/lead-requests', {'email': 'reader@example.invalid'})[0] == 503
        assert request(port, '/api/admin-users/first-register', {'email': 'teste@example.invalid', 'password': secrets.token_hex(24)})[0] == 403
        assert run(compose + ['exec', '-T', 'app', 'id', '-u']).strip() != '0'
        run(compose + ['exec', '-T', 'app', 'node', '-e', "try{require('fs').writeFileSync('/app/forbidden','x');process.exit(1)}catch(e){process.exit(['EROFS','EACCES'].includes(e.code)?0:1)}"])
        assert run(compose + ['exec', '-T', 'db', 'psql', '-U', 'bibliotheon_owner', '-d', 'bibliotheon', '-At', '-c', "SELECT rolsuper FROM pg_roles WHERE rolname = 'bibliotheon_runtime'"]).strip() == 'f'
        denied = subprocess.run(compose + ['exec', '-T', 'db', 'psql', '-U', 'bibliotheon_runtime', '-d', 'bibliotheon', '-c', 'CREATE TABLE forbidden_runtime_ddl (id integer)'], capture_output=True)
        assert denied.returncode != 0
        password = secrets.token_hex(32)
        run(compose + ['run', '--rm', '--no-deps', '-T', 'app', 'node', 'cli/create-admin.js'], data=json.dumps({'email': 'owner-sintetico@example.invalid', 'password': password}).encode())
        assert request(port, '/api/admin-users/login', {'email': 'owner-sintetico@example.invalid', 'password': password})[0] == 200
        image_env = json.loads(run(['docker', 'image', 'inspect', IMAGE, '--format', '{{json .Config.Env}}']))
        assert not any(value.startswith(('PAYLOAD_SECRET=', 'DATABASE_URL=', 'DB_OWNER_PASSWORD=')) for value in image_env)
        run(['docker', 'run', '--rm', '--network', 'none', '--entrypoint', 'node', IMAGE, '-e', "process.exit(require('fs').existsSync('/app/.env.local')?1:0)"])
        run(['docker', 'run', '--rm', '--network', 'none', '--entrypoint', 'node', IMAGE, '-e', "process.exit(['worker','apply-suppression','recover-admin'].every(name=>require('fs').existsSync('/app/cli/'+name+'.js'))?0:1)"])
        assert run(compose + ['exec', '-T', 'db', 'psql', '-U', 'bibliotheon_owner', '-d', 'bibliotheon', '-At', '-c', 'SELECT (SELECT count(*) FROM email_deliveries) + (SELECT count(*) FROM payload_jobs)']).strip() == '0'
        # Only an empty synthetic queue is activated; no provider request can be dispatched.
        values.update({'EMAIL_TRANSPORT_ENABLED': 'true', 'BREVO_API_KEY': 'synthetic-not-valid', 'BREVO_SENDER_EMAIL': 'sender@example.invalid'})
        env_file.write_text('\n'.join(f'{key}={value}' for key, value in values.items()) + '\n')
        run(compose + ['--profile', 'relationship', 'up', '-d', '--wait', '--wait-timeout', '90', 'worker'])
        run(compose + ['exec', '-T', 'worker', 'node', 'cli/worker-health.js'])
        assert run(compose + ['exec', '-T', 'worker', 'id', '-u']).strip() != '0'
        run(compose + ['exec', '-T', 'worker', 'node', '-e', "process.exit(Intl.DateTimeFormat().resolvedOptions().timeZone==='America/Belem'?0:1)"])
        report = {
            'date': '2026-10-21 America/Belem', 'imageID': run(['docker', 'image', 'inspect', IMAGE, '--format', '{{.Id}}']).strip(),
            'migrationsFromEmpty': True, 'health': 200, 'nonRoot': True, 'readOnly': True, 'runtimeSuperuser': False,
            'runtimeDDLRejected': True, 'ownerCLIAndLogin': True, 'noEmbeddedRuntimeSecrets': True,
            'relationshipPrivate': True, 'publicJobExecutionDenied': True, 'captureDisabledByDefault': True, 'workerCLIIncluded': True,
            'workerEmptyQueueHealthy': True, 'runtimeTimezone': 'America/Belem',
            'durationSeconds': round(time.monotonic() - started, 2), 'environment': 'Docker local descartável, sem VPS',
        }
        destination = ROOT / 'artifacts/container/local-results.json'
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(report, indent=2))
        print('Container aprovado localmente: migrations, saúde, ACL, runtime limitado, owner CLI, isolamento e ausência de segredo embarcado.', flush=True)
    finally:
        run(compose + ['--profile', 'relationship', 'down', '--volumes'])
