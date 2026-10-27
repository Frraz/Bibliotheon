#!/usr/bin/env python3
"""Testa imagem atual e upgrade em projetos locais descartáveis, sem saída externa."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import os
import re
import secrets
import socket
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
PHASE = os.environ.get('BIBLIOTHEON_QA_PHASE', 'D114')
assert re.fullmatch(r'D[0-9]+', PHASE)
IMAGE = os.environ.get('BIBLIOTHEON_QA_IMAGE', 'bibliotheon:local-' + PHASE.lower())
PREVIOUS = os.environ.get('BIBLIOTHEON_UPGRADE_IMAGE')
assert os.environ.get('BIBLIOTHEON_SYNTHETIC_TESTS') == 'true', 'Exige ambiente sintético descartável.'
values = {}
private_values = set()


def run(command, *, data=None, expected=0, timeout=180):
    result = subprocess.run(command, input=data, capture_output=True, timeout=timeout)
    if result.returncode != expected:
        diagnostic = result.stderr.decode(errors='replace') + result.stdout.decode(errors='replace')
        for key, value in values.items():
            if any(word in key for word in ['PASSWORD', 'SECRET', 'DATABASE', 'API_KEY', 'TOKEN']):
                diagnostic = diagnostic.replace(value, '[redigido]')
        for value in private_values:
            diagnostic = diagnostic.replace(value, '[redigido]')
        diagnostic = re.sub(r'\x1b\[[0-9;]*m', '', diagnostic)
        diagnostic = re.sub(r'postgres(?:ql)?://[^\s]+', '[url-banco-redigida]', diagnostic)
        errors = re.findall(r'(?:Error:|ERROR|error:|code:)[^\n]{0,400}', diagnostic)
        raise RuntimeError('Falha no cenário de container: ' + ('; '.join(errors[-5:]) if errors else diagnostic[-2000:]))
    return result.stdout.decode()


def request(compose, route, body=None, token=None):
    # Docker's internal bridge may not publish host ports. Probe the real HTTP
    # server from its container, keeping provider egress physically blocked.
    script = """let input='';for await(const chunk of process.stdin)input+=chunk;
const {route,body,token}=JSON.parse(input);const headers={'Content-Type':'application/json'};
if(token)headers.Authorization='JWT '+token;
const response=await fetch('http://127.0.0.1:3000'+route,{method:body===null?'GET':'POST',headers,...(body===null?{}:{body:JSON.stringify(body)})});
console.log(JSON.stringify({status:response.status,body:await response.text()}));"""
    output = run(compose + ['exec','-T','app','node','--input-type=module','-e',script], data=json.dumps({'route':route,'body':body,'token':token}).encode(), timeout=45)
    result = json.loads(output)
    return result['status'], result['body']


def json_report(output):
    return json.loads(next(line for line in reversed(output.splitlines()) if line.startswith('{')))


image_id = run(['docker', 'image', 'inspect', IMAGE, '--format', '{{.Id}}']).strip()
previous_id = run(['docker', 'image', 'inspect', PREVIOUS, '--format', '{{.Id}}']).strip() if PREVIOUS else None
expected_migrations = re.findall(r"name: '([^']+)'", (ROOT / 'migrations/index.ts').read_text())
migration_count = len(expected_migrations)
assert migration_count and len(set(expected_migrations)) == migration_count


def scenario(label, previous=None):
    global values
    project = 'bibliotheon-container-test-' + secrets.token_hex(5)
    with tempfile.TemporaryDirectory(prefix=project + '-') as temp:
        env_file = Path(temp) / 'runtime.env'
        override = Path(temp) / 'isolated.yaml'
        # Prevent all provider/telemetry egress even if a configuration regresses.
        override.write_text('networks:\n  private:\n    internal: true\nservices:\n  db:\n    healthcheck:\n      interval: 2s\n  app:\n    healthcheck:\n      interval: 2s\n      start_period: 30s\n      retries: 30\n  worker:\n    healthcheck:\n      interval: 2s\n      start_period: 30s\n      retries: 30\n')
        owner_password, runtime_password = secrets.token_hex(24), secrets.token_hex(24)
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        values = {
            'BIBLIOTHEON_IMAGE': previous or image_id, 'BIBLIOTHEON_PORT': str(port), 'PUBLIC_SITE_URL': f'http://127.0.0.1:{port}',
            'PAYLOAD_SECRET': secrets.token_hex(32), 'DB_OWNER_PASSWORD': owner_password, 'DB_RUNTIME_PASSWORD': runtime_password,
            'DATABASE_URL': f'postgresql://bibliotheon_runtime:{runtime_password}@db:5432/bibliotheon',
            'DATABASE_MIGRATION_URL': f'postgresql://bibliotheon_owner:{owner_password}@db:5432/bibliotheon',
            'LEAD_TOKEN_SECRET': secrets.token_hex(32), 'LEADS_ENABLED': 'false', 'EMAIL_TRANSPORT_ENABLED': 'false',
        }

        def save_env():
            env_file.write_text('\n'.join(f'{key}={value}' for key, value in values.items()) + '\n')
            env_file.chmod(0o600)

        save_env()
        compose = ['docker', 'compose', '--project-name', project, '--file', str(ROOT / 'compose.production.yaml'), '--file', str(override), '--env-file', str(env_file)]
        sql = lambda query: run(compose + ['exec', '-T', 'db', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'bibliotheon_owner', '-d', 'bibliotheon', '-At', '-c', query]).strip()
        cli_seconds = {}
        def cli(name, *args):
            cli_started = time.monotonic()
            print(f'Imagem {label}: executando CLI {name}.', flush=True)
            output = run(compose + ['run', '--rm', '--no-deps', '-T', 'app', 'node', 'cli/' + name + '.js', *args], timeout=60)
            cli_seconds[name] = round(time.monotonic() - cli_started, 2)
            return output
        password = secrets.token_hex(32)
        private_values.add(password)
        credentials = {'email': 'owner-sintetico@example.invalid', 'password': password}
        started = time.monotonic()
        old_migrations = []
        try:
            print(f'Imagem {label}: iniciando banco isolado e migrations.', flush=True)
            run(compose + ['up', '-d', '--wait', '--wait-timeout', '60', 'db'])
            run(compose + ['--profile', 'maintenance', 'run', '--rm', '--no-deps', 'migrate'])
            if previous:
                old_migrations = sql('SELECT name FROM payload_migrations WHERE batch >= 0 ORDER BY name').splitlines()
                assert 0 < len(old_migrations) < len(expected_migrations)
                print(f'Upgrade real: {len(old_migrations)} para {migration_count} migrations.', flush=True)
                assert old_migrations == sorted(expected_migrations[:len(old_migrations)])
                sql("INSERT INTO contacts (id,email,delivery_state,created_at,updated_at) VALUES (gen_random_uuid(),'upgrade@example.invalid','ok',now(),now())")
                run(compose + ['run', '--rm', '--no-deps', '-T', 'app', 'node', 'cli/create-admin.js'], data=json.dumps(credentials).encode())
                values['BIBLIOTHEON_IMAGE'] = image_id
                save_env()
                run(compose + ['--profile', 'maintenance', 'run', '--rm', '--no-deps', 'migrate'])
                assert sql("SELECT count(*) FROM contacts WHERE email='upgrade@example.invalid'") == '1'
            else:
                run(compose + ['run', '--rm', '--no-deps', '-T', 'app', 'node', 'cli/create-admin.js'], data=json.dumps(credentials).encode())
            assert sql('SELECT name FROM payload_migrations WHERE batch >= 0 ORDER BY name').splitlines() == sorted(expected_migrations)
            # Repeating migrations must not add or replace records.
            migrations_before = sql('SELECT id,name,batch,created_at FROM payload_migrations ORDER BY id')
            run(compose + ['--profile', 'maintenance', 'run', '--rm', '--no-deps', 'migrate'])
            assert sql('SELECT id,name,batch,created_at FROM payload_migrations ORDER BY id') == migrations_before
            print(f'Imagem {label}: {migration_count} migrations conferidas; testando HTTP, ACL e CLIs.', flush=True)
            run(compose + ['up', '-d', '--wait', '--wait-timeout', '120', 'app'])
            assert request(compose, '/health/ready')[0] == 200
            assert request(compose, '/')[0] == 200
            private = ['admin-users','contacts','privacy-request-audit','marketing-suppression-tombstones','contact-retirements','theme-withdrawals','commercial-inbox','commercial-settlement-evidence','financial-cost-entries','payload-jobs']
            for collection in private:
                assert request(compose, '/api/' + collection)[0] == 403, collection
            assert request(compose, '/api/payload-jobs/run')[0] in [401,403]
            assert request(compose, '/api/v1/lead-requests', {'email': 'reader@example.invalid'})[0] == 503
            for provider in ['hotmart','kiwify','cakto']:
                assert request(compose, '/api/v1/webhooks/' + provider, {})[0] == 503, provider
            assert request(compose, '/api/admin-users/first-register', credentials)[0] == 403
            status, logged = request(compose, '/api/admin-users/login', credentials)
            assert status == 200
            token = json.loads(logged)['token']
            private_values.add(token)
            for collection in ['contacts','privacy-request-audit','marketing-suppression-tombstones','contact-retirements','theme-withdrawals','commercial-settlement-evidence','financial-cost-entries']:
                assert request(compose, '/api/' + collection, token=token)[0] == 200, collection
                assert request(compose, '/api/' + collection, {}, token=token)[0] == 403, collection
            assert run(compose + ['exec', '-T', 'app', 'id', '-u']).strip() != '0'
            run(compose + ['exec', '-T', 'app', 'node', '-e', "try{require('fs').writeFileSync('/app/forbidden','x');process.exit(1)}catch(e){process.exit(['EROFS','EACCES'].includes(e.code)?0:1)}"])
            assert sql("SELECT rolsuper OR rolcreatedb OR rolcreaterole FROM pg_roles WHERE rolname='bibliotheon_runtime'") == 'f'
            denied = subprocess.run(compose + ['exec', '-T', 'db', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'bibliotheon_runtime', '-d', 'bibliotheon', '-c', 'CREATE TABLE forbidden_runtime_ddl (id integer)'], capture_output=True, timeout=30)
            assert denied.returncode != 0 and b'permission denied' in denied.stderr
            assert sql("SELECT to_regclass('public.forbidden_runtime_ddl')") == ''
            env = json.loads(run(['docker', 'image', 'inspect', image_id, '--format', '{{json .Config.Env}}']))
            assert not any(value.startswith(('PAYLOAD_SECRET=', 'DATABASE_URL=', 'DB_OWNER_PASSWORD=')) for value in env)
            run(['docker', 'run', '--rm', '--network', 'none', '--entrypoint', 'node', image_id, '-e', "process.exit(['.env','.env.local','.env.production','tests','artifacts'].some(name=>require('fs').existsSync('/app/'+name))?1:0)"])
            inventory = json_report(cli('privacy-inventory'))
            assert inventory['classification'] == 'aggregate_counts_only'
            retention = json_report(cli('privacy-retention'))
            assert retention['mode'] == 'preview'
            analytics = json_report(cli('analytics-retention'))
            assert analytics['mode'] == 'preview'
            owner = sql('SELECT id FROM admin_users LIMIT 1')
            assert re.fullmatch(r'[a-f0-9-]{36}', owner)
            snapshot = datetime.now(timezone.utc).isoformat()
            command = 'node cli/privacy-recovery.js export --output /tmp/recovery.json && node cli/privacy-recovery.js preview --input /tmp/recovery.json --snapshot-at "$QA_SNAPSHOT_AT" --owner "$QA_OWNER_ID" --isolated && node cli/privacy-recovery.js apply --input /tmp/recovery.json --snapshot-at "$QA_SNAPSHOT_AT" --owner "$QA_OWNER_ID" --isolated'
            replay = json_report(run(compose + ['run','--rm','--no-deps','-T','-e','QA_OWNER_ID='+owner,'-e','QA_SNAPSHOT_AT='+snapshot,'app','sh','-c',command]))
            assert replay['mode'] == 'applied' and replay['manifestVersion'] == 2 and replay['outboundCalls'] == 0
            assert sql('SELECT count(*) FROM email_deliveries') == '0'
            disabled = subprocess.run(compose + ['--profile','relationship','run','--rm','--no-deps','-T','worker'], capture_output=True, timeout=60)
            assert disabled.returncode != 0 and b'Worker desativado' in disabled.stdout + disabled.stderr
            # Only local retention is enabled; all provider transports remain false.
            values['DATA_RETENTION_ENABLED'] = 'true'
            save_env()
            run(compose + ['--profile','relationship','up','-d','--wait','--wait-timeout','90','worker'])
            run(compose + ['exec','-T','worker','node','cli/worker-health.js'])
            stamp_command = compose + ['exec','-T','worker','node','-e',"console.log(require('fs').readFileSync('/tmp/bibliotheon-worker-health','utf8'))"]
            before_idle = int(run(stamp_command).strip())
            print(f'Imagem {label}: verificando renovação do heartbeat após ciclo ocioso.', flush=True)
            time.sleep(35)
            assert int(run(stamp_command).strip()) > before_idle
            run(compose + ['exec','-T','worker','node','cli/worker-health.js'])
            assert run(compose + ['exec','-T','worker','id','-u']).strip() != '0'
            run(compose + ['exec','-T','worker','node','-e',"process.exit(Intl.DateTimeFormat().resolvedOptions().timeZone==='America/Belem'?0:1)"])
            assert sql('SELECT (SELECT count(*) FROM email_deliveries)+(SELECT count(*) FROM payload_jobs)') == '0'
            assert run(['docker','network','inspect',project+'_private','--format','{{.Internal}}']).strip() == 'true'
            report = {'scenario':label,'imageID':image_id,'previousImageID':previous,'previousMigrations':len(old_migrations),'currentMigrations':migration_count,'exactMigrationNamesMatched':True,'migrationReplayUnchanged':True,'upgradeSyntheticContactAndOwnerPreserved':bool(previous),'health':200,'httpProbeLocation':'container loopback on internal network','nonRoot':True,'readOnly':True,'runtimeDDLRejected':True,'ownerCLIAndLogin':True,'privateAnonymousCollections':len(private),'ownerReadAndImmutableAPICollections':7,'threeWebhookFlagsDisabled':True,'captureDisabled':True,'runtimeSecretsAbsentFromImageEnv':True,'fixturesAndEnvFilesAbsentFromImage':True,'cliSeconds':cli_seconds,'privacyInventoryCLI':True,'privacyRetentionPreviewCLI':True,'analyticsRetentionPreviewCLI':True,'privacyRecoveryV2CLI':True,'privacyRecoveryEntries':replay['entries'],'workerRefusesAllFlagsDisabled':True,'retentionOnlyWorkerHealthy':True,'idleHeartbeatAdvances':True,'idleObservationSeconds':35,'providerTransportsDisabled':True,'networkInternal':True,'outboundDeliveries':0,'durationSeconds':round(time.monotonic()-started,2)}
            print(f'Imagem {label}: aprovada em ambiente local isolado.', flush=True)
            return report
        except Exception:
            diagnostic = subprocess.run(compose + ['logs','--no-color','--tail','30','worker'], capture_output=True, timeout=30).stdout.decode(errors='replace')
            for value in list(values.values()) + list(private_values):
                if value:
                    diagnostic = diagnostic.replace(value, '[redigido]')
            diagnostic = re.sub(r'postgres(?:ql)?://[^\s]+', '[url-banco-redigida]', diagnostic)
            if diagnostic:
                print('Diagnóstico sintético do worker: ' + diagnostic[-2500:], flush=True)
            raise
        finally:
            run(compose + ['--profile','relationship','down','--volumes'])


results = [scenario('empty')]
if previous_id:
    results.append(scenario('upgrade', previous_id))
binary_hashes = json.loads(run(['docker','run','--rm','--network','none','--entrypoint','node',image_id,'-e',"const fs=require('fs'),c=require('crypto');console.log(JSON.stringify(Object.fromEntries(['privacy-inventory','privacy-retention','analytics-retention','privacy-recovery','worker'].map(n=>[n,c.createHash('sha256').update(fs.readFileSync('/app/cli/'+n+'.js')).digest('hex')]))))"]))
for name, digest in binary_hashes.items():
    assert hashlib.sha256((ROOT / '.release' / (name + '.js')).read_bytes()).hexdigest() == digest, name
report = {'phase':PHASE,'packagedCLISHA256':binary_hashes,'date':datetime.now(timezone.utc).isoformat(),'environment':'Docker local descartável com rede internal; sem VPS ou serviços externos','imageID':image_id,'scenarios':results,'upgradeValidated':bool(previous_id),'physicalRestoreInThisImageValidated':False,'productionReady':False,'sourceSHA256':{name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in ['Dockerfile','compose.production.yaml','scripts/qa-container.py','scripts/build-runtime.mjs','migrations/index.ts','src/payload.config.ts','pnpm-lock.yaml','scripts/privacy-inventory.ts','scripts/privacy-retention.ts','scripts/analytics-retention.ts','scripts/worker.ts']}}
destination = ROOT / ('artifacts/container/' + PHASE.lower() + '-results.json')
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(PHASE + ': evidência local gravada; imagem não publicada e produção não homologada.', flush=True)
