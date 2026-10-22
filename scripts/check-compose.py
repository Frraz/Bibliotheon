#!/usr/bin/env python3
"""Valida Compose sem imprimir valores do ambiente. Não sobe containers."""
import argparse
import json
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--env-file', required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
result = subprocess.run(['docker', 'compose', '--file', str(root / 'compose.production.yaml'), '--env-file', str(Path(args.env_file).resolve()), '--profile', 'maintenance', '--profile', 'relationship', 'config', '--format', 'json'], capture_output=True, text=True)
if result.returncode:
    raise SystemExit('Compose inválido ou configuração incompleta. Revise o arquivo privado; valores não foram exibidos.')
config = json.loads(result.stdout)
app = config['services']['app']
db = config['services']['db']
assert 'ports' not in db, 'Banco não pode publicar portas.'
assert app['ports'][0]['host_ip'] == '127.0.0.1', 'App deve escutar somente em loopback para o proxy do host.'
assert app['read_only'] is True, 'App deve ter filesystem somente leitura.'
assert all(mount.startswith('/') for mount in app['tmpfs']), 'Montagem tmpfs inválida.'
assert 'no-new-privileges:true' in app['security_opt']
assert all(key not in app['environment'] for key in ['DB_OWNER_PASSWORD', 'DB_RUNTIME_PASSWORD', 'DATABASE_MIGRATION_URL']), 'App recebeu segredo administrativo desnecessário.'
assert config['services']['migrate']['environment']['DATABASE_URL'] != app['environment']['DATABASE_URL'], 'Separe runtime e migração.'
assert all('@sha256:' in service['image'] for service in config['services'].values()), 'Imagens devem ter digest.'
assert int(app['mem_limit']) <= 1536 * 1024 * 1024 and int(db['mem_limit']) <= 1024 * 1024 * 1024
worker = config['services']['worker']
assert 'ports' not in worker and worker['read_only'] is True
assert int(worker['mem_limit']) <= 768 * 1024 * 1024
assert all(key not in worker['environment'] for key in ['DB_OWNER_PASSWORD', 'DB_RUNTIME_PASSWORD', 'DATABASE_MIGRATION_URL'])
assert 'BREVO_API_KEY' not in config['services']['migrate']['environment']
assert all(mount['read_only'] for mount in worker['volumes']), 'Worker não precisa escrever mídia.'
print('Compose aprovado estruturalmente: loopback, banco privado, imagens fixadas, limites e segredos segregados. Não verifica VPS, DNS ou backup.')
