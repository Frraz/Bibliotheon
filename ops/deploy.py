#!/usr/bin/env python3
"""Deploy local por Git/Compose. Configuração privada fora do checkout; sem shell/eval."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
PROJECT = 'bibliotheon'


class DeployError(Exception):
    pass


def private_file(path):
    path = Path(path).resolve()
    if not path.is_file() or path.stat().st_mode & 0o077:
        raise DeployError('Arquivo privado ausente ou permissões abertas; use chmod 600.')
    if path.is_relative_to(ROOT):
        raise DeployError('Guarde configuração/credenciais fora do checkout Git.')
    return path


def read_config(path):
    config = json.loads(private_file(path).read_text())
    allowed = {'env_file', 'state_dir', 'branch', 'worker', 'backup_env', 'health_timeout', 'min_memory_mb', 'min_disk_mb', 'public_health'}
    if not isinstance(config, dict) or set(config) - allowed:
        raise DeployError('Configuração de deploy inválida; confira deploy.md.')
    config.setdefault('branch', 'main')
    config.setdefault('worker', False)
    config.setdefault('health_timeout', 180)
    config.setdefault('min_memory_mb', 4096)
    config.setdefault('min_disk_mb', 15360)
    config.setdefault('public_health', True)
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._/-]*', config['branch']) or '..' in config['branch']:
        raise DeployError('Branch inválida.')
    if type(config['worker']) is not bool or type(config['public_health']) is not bool:
        raise DeployError('worker/public_health precisam ser booleanos.')
    for key in ['health_timeout', 'min_memory_mb', 'min_disk_mb']:
        if type(config[key]) is not int or config[key] < 1:
            raise DeployError('Limite operacional inválido.')
    config['env_file'] = str(private_file(config['env_file']))
    state = Path(config['state_dir']).resolve()
    if state.is_relative_to(ROOT):
        raise DeployError('Diretório de releases precisa ficar fora do checkout.')
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    if state.stat().st_mode & 0o077:
        raise DeployError('Diretório de releases deve ter permissão 700.')
    return config, state


def command(argv, *, env=None, log=None):
    # Never persist raw tool output: it can contain a URL, token or submitted data.
    started = time.monotonic()
    result = subprocess.run(argv, cwd=ROOT, env=env, capture_output=True)
    if log:
        with Path(log).open('a') as stream:
            stream.write(json.dumps({'program': Path(argv[0]).name, 'exit': result.returncode, 'seconds': round(time.monotonic() - started, 2)}) + '\n')
    if result.returncode:
        raise DeployError('Etapa falhou; log privado registra resultado/duração. Consulte diagnóstico em deploy.md; saídas brutas não foram gravadas.')
    return result.stdout.decode().strip() if not log else ''


def save(path, data):
    temp = Path(str(path) + '.tmp')
    with temp.open('w') as stream:
        json.dump(data, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temp, path)


def compose(file, *args):
    return ['docker', 'compose', '-p', PROJECT, '--project-directory', str(ROOT), '-f', str(file), '--profile', 'maintenance', '--profile', 'relationship', *args]


def docker_env(env_file, image):
    env = os.environ.copy()
    keys = re.findall(r'^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=', Path(env_file).read_text(), re.M)
    for key in list(env):
        if key in keys or key.startswith('COMPOSE_'):
            env.pop(key)
    env['BIBLIOTHEON_IMAGE'] = image
    return env


def validate_compose(data, config):
    services = data['services']
    if set(services) != {'app', 'db', 'migrate', 'worker'}:
        raise DeployError('Mudança de serviços exige revisão do deploy.')
    app, db, worker = (services[k] for k in ['app', 'db', 'worker'])
    if db.get('ports') or worker.get('ports') or not app.get('read_only') or not worker.get('read_only'):
        raise DeployError('Isolamento de serviços inválido.')
    ports = app.get('ports', [])
    if len(ports) != 1 or ports[0].get('host_ip') != '127.0.0.1':
        raise DeployError('App deve publicar uma única porta de loopback.')
    if '@sha256:' not in db['image']:
        raise DeployError('Banco precisa de imagem fixada por digest.')
    values = app['environment']
    for key in ['PAYLOAD_SECRET', 'LEAD_TOKEN_SECRET']:
        value = values.get(key, '')
        if len(value) < 32 or 'REPLACE' in value:
            raise DeployError('Configure segredos privados independentes, sem placeholders.')
    if values['PAYLOAD_SECRET'] == values['LEAD_TOKEN_SECRET']:
        raise DeployError('Use segredos diferentes para sessão e links.')
    if not values['PUBLIC_SITE_URL'].startswith('https://'):
        raise DeployError('Produção exige origem HTTPS.')
    if values['DATABASE_URL'] == services['migrate']['environment']['DATABASE_URL']:
        raise DeployError('Separe a credencial de runtime da credencial de migração.')
    if config['worker'] and values.get('EMAIL_TRANSPORT_ENABLED') != 'true':
        raise DeployError('Worker solicitado com transporte desativado.')
    # Reject unfilled database credentials without printing their contents.
    for service in services.values():
        if any('REPLACE' in str(value) for value in service.get('environment', {}).values()):
            raise DeployError('Configuração ainda contém placeholders.')


def compatible_database(previous, candidate):
    for key in ['image', 'environment', 'volumes', 'networks', 'command', 'entrypoint', 'user', 'ports']:
        if previous['services']['db'].get(key) != candidate['services']['db'].get(key):
            raise DeployError('Banco/configuração alterados: faça manutenção específica, não atualização automática.')
    for name in ['database', 'media']:
        if previous['volumes'][name] != candidate['volumes'][name]:
            raise DeployError('Mudança de volumes persistentes exige manutenção específica.')


def ready(url, timeout):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                if response.status == 200 and json.loads(response.read(1024)) == {'status': 'ready'}:
                    return
        except (OSError, ValueError):
            pass
        time.sleep(2)
    raise DeployError('Readiness não foi confirmada dentro do prazo.')


def verify_service(file, service, image_id, env):
    container = command(compose(file, 'ps', '-q', service), env=env)
    if not re.fullmatch(r'[a-f0-9]{12,64}', container):
        raise DeployError('Container esperado não foi encontrado.')
    status = command(['docker', 'inspect', container, '--format', '{{.Image}} {{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}'], env=env)
    if status != f'{image_id} running healthy':
        raise DeployError('Imagem/saúde do container diferente da release esperada.')


def backup_environment(path):
    values = json.loads(private_file(path).read_text())
    if not isinstance(values, dict) or not all(isinstance(v, str) and re.fullmatch(r'(RESTIC|AWS|B2|AZURE|GOOGLE)_[A-Z0-9_]+', k) for k, v in values.items()):
        raise DeployError('JSON privado de backup inválido.')
    env = os.environ.copy()
    for key in list(env):
        if key.startswith('COMPOSE_'):
            env.pop(key)
    env.update(values)
    if not env.get('RESTIC_REPOSITORY') or not re.match(r'^(sftp|s3|rest|azure|gs|rclone|b2|swift):', env['RESTIC_REPOSITORY']):
        raise DeployError('Configure repositório externo de backup antes de atualizar.')
    private_file(env['RESTIC_PASSWORD_FILE'])
    return env


def apply(config, state, initial=False, rebuild=False, resume=False):
    current_path, pending_path = state / 'current.json', state / 'in-progress.json'
    interrupted = json.loads(pending_path.read_text()) if pending_path.exists() else None
    if interrupted and not resume:
        raise DeployError('Existe atualização interrompida. Consulte deploy.md e in-progress.json antes de retomar.')
    current = json.loads(current_path.read_text()) if current_path.exists() else None
    if resume:
        if initial or not interrupted:
            raise DeployError('--retomar exige uma atualização interrompida, sem --inicial.')
        interrupted_release = Path(interrupted['release']).resolve()
        if not interrupted_release.is_relative_to(state / 'releases'):
            raise DeployError('Estado de recuperação inválido.')
        # Even a failed first deploy has a built image and a private resolved config.
        current = json.loads((interrupted_release / 'release.json').read_text())
        rebuild = True
    elif initial == bool(current):
        raise DeployError('Use --inicial apenas no primeiro deploy; atualizações exigem current.json existente.')
    command(['docker', 'info'])
    if initial and (command(['docker', 'ps', '-aq', '--filter', f'label=com.docker.compose.project={PROJECT}']) or command(['docker', 'volume', 'ls', '-q', '--filter', f'label=com.docker.compose.project={PROJECT}'])):
        raise DeployError('Já existem containers desse projeto sem estado gerenciado; não serão assumidos automaticamente.')
    commit = command(['git', 'rev-parse', 'HEAD'])
    env_hash = hashlib.sha256(Path(config['env_file']).read_bytes()).hexdigest()
    if current and not rebuild and current['commit'] == commit and current['env_hash'] == env_hash and current['worker'] == config['worker']:
        verify_service(Path(current['compose_file']), 'app', current['image_id'], os.environ.copy())
        if current['worker']:
            verify_service(Path(current['compose_file']), 'worker', current['image_id'], os.environ.copy())
        ready(current['local_health'], config['health_timeout'])
        if config['public_health']:
            ready(current['public_health'], config['health_timeout'])
        print('Versão e configuração já estão aplicadas; saúde confirmada.')
        return
    memory = int(re.search(r'^MemAvailable:\s+(\d+)', Path('/proc/meminfo').read_text(), re.M)[1]) // 1024
    if memory < config['min_memory_mb'] or shutil.disk_usage(ROOT).free // (1024 ** 2) < config['min_disk_mb']:
        raise DeployError('RAM/disco livres abaixo do mínimo configurado; build não iniciado.')
    backup_env = backup_environment(config['backup_env'])
    command([backup_env.get('RESTIC_BINARY', 'restic'), 'snapshots', '--json'], env=backup_env)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')
    release = state / 'releases' / f'{stamp}-{commit[:12]}-{os.urandom(3).hex()}'
    release.mkdir(parents=True, mode=0o700)
    log = release / 'operations.log'
    image = f'bibliotheon-release:{release.name.lower()}'
    env = docker_env(config['env_file'], image)
    source_compose = ROOT / 'compose.production.yaml'
    candidate = json.loads(command(['docker', 'compose', '-p', PROJECT, '--project-directory', str(ROOT), '--env-file', config['env_file'], '-f', str(source_compose), '--profile', 'maintenance', '--profile', 'relationship', 'config', '--format', 'json'], env=env))
    validate_compose(candidate, config)
    old_file = Path(current['compose_file']) if current else None
    if current:
        compatible_database(json.loads(old_file.read_text()), candidate)
        actual = command(['docker', 'image', 'inspect', current['image'], '--format', '{{.Id}}'])
        if actual != current['image_id']:
            raise DeployError('Imagem anterior não corresponde ao manifesto; atualização interrompida.')
    file = release / 'compose.json'
    save(file, candidate)
    # Keep a private dotenv snapshot for recovery.py; compose.json is already resolved.
    shutil.copyfile(config['env_file'], release / 'production.env')
    print('Construindo imagem nova; a aplicação atual permanece ativa durante o build.', flush=True)
    command(['docker', 'build', '--label', f'org.opencontainers.image.revision={commit}', '-t', image, '.'], env=env, log=log)
    image_id = command(['docker', 'image', 'inspect', image, '--format', '{{.Id}}'])
    port = candidate['services']['app']['ports'][0]['published']
    record = {'commit': commit, 'image': image, 'image_id': image_id, 'compose_file': str(file), 'env_hash': env_hash, 'worker': config['worker'], 'local_health': f'http://127.0.0.1:{port}/health/ready', 'public_health': candidate['services']['app']['environment']['PUBLIC_SITE_URL'].rstrip('/') + '/health/ready', 'previous': str(Path(current['release']) / 'release.json') if current else None, 'release': str(release), 'status': 'built'}
    if current:
        save(release / 'previous.json', current)
    if interrupted:
        save(release / 'interrupted.json', interrupted)
    save(release / 'release.json', record)
    save(pending_path, {'release': str(release), 'phase': 'before-backup'})
    stopped, migration_started = False, resume
    try:
        if current:
            print('Pausando somente app/worker do Bibliotheon para backup consistente.', flush=True)
            stopped = True
            command(compose(old_file, 'stop', 'app', 'worker'), env=env, log=log)
            if resume:
                command(compose(old_file, 'up', '-d', '--no-recreate', '--wait', '--wait-timeout', str(config['health_timeout']), 'db'), env=env, log=log)
                if not command(compose(old_file, 'ps', '-a', '-q', 'app'), env=env):
                    command(compose(old_file, 'create', '--no-deps', '--pull', 'never', 'app'), env=env, log=log)
            command([sys.executable, str(ROOT / 'ops/recovery.py'), 'backup', '--compose-file', str(old_file), '--env-file', str(Path(current['release']) / 'production.env')], env=backup_env, log=log)
        else:
            command(compose(file, 'up', '-d', '--wait', '--wait-timeout', str(config['health_timeout']), 'db'), env=env, log=log)
        save(pending_path, {'release': str(release), 'phase': 'migration-started'})
        migration_started = True
        print('Aplicando migrações; o schema não terá rollback automático.', flush=True)
        command(compose(file, 'run', '--rm', '--no-deps', '-T', '--pull', 'never', 'migrate'), env=env, log=log)
        save(pending_path, {'release': str(release), 'phase': 'starting-app'})
        command(compose(file, 'up', '-d', '--no-deps', '--pull', 'never', '--wait', '--wait-timeout', str(config['health_timeout']), 'app'), env=env, log=log)
        ready(record['local_health'], config['health_timeout'])
        verify_service(file, 'app', image_id, env)
        if not initial and config['public_health']:
            ready(record['public_health'], config['health_timeout'])
        if config['worker']:
            command(compose(file, 'up', '-d', '--no-deps', '--pull', 'never', '--wait', '--wait-timeout', str(config['health_timeout']), 'worker'), env=env, log=log)
            verify_service(file, 'worker', image_id, env)
        record['status'] = 'healthy'
        save(release / 'release.json', record)
        save(current_path, record)
        pending_path.unlink()
        print(f'Versão {commit[:12]} aplicada e saudável. Manifesto privado: {release}')
    except BaseException:
        if not migration_started:
            if stopped:
                command(compose(old_file, 'up', '-d', '--no-deps', '--pull', 'never', '--wait', '--wait-timeout', str(config['health_timeout']), *(['app', 'worker'] if current['worker'] else ['app'])), env=env, log=log)
            pending_path.unlink(missing_ok=True)
        else:
            # New/old code may no longer match the partially changed schema.
            command(compose(file, 'stop', 'app', 'worker'), env=env, log=log)
            print('Migração iniciada: serviços de aplicação ficam parados para diagnóstico; banco/volumes preservados.', flush=True)
        raise


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inicial', action='store_true')
    parser.add_argument('--reconstruir', action='store_true')
    parser.add_argument('--retomar', action='store_true', help='Após diagnóstico de uma atualização interrompida; não reverte schema.')
    parser.add_argument('--config', default='/etc/bibliotheon/deploy.json')
    args = parser.parse_args()
    config, state = read_config(args.config)
    with (state / 'deploy.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise DeployError('Outra atualização já está em execução.')
        if (state / 'in-progress.json').exists() and not args.retomar:
            raise DeployError('Atualização interrompida; revise in-progress.json e deploy.md antes de fazer pull.')
        if command(['git', 'rev-parse', '--show-toplevel']) != str(ROOT):
            raise DeployError('Execute no checkout Git do Bibliotheon.')
        if command(['git', 'status', '--porcelain']):
            raise DeployError('Checkout contém alterações locais; faça commit/stash/revisão antes de atualizar.')
        if command(['git', 'branch', '--show-current']) != config['branch']:
            raise DeployError('Branch atual diferente da configurada.')
        before = hashlib.sha256(Path(__file__).read_bytes()).digest()
        print('Buscando atualização Git com fast-forward, sem reset ou descarte de arquivos.', flush=True)
        command(['git', 'pull', '--ff-only', 'origin', config['branch']])
        if before != hashlib.sha256(Path(__file__).read_bytes()).digest():
            # No production mutation has started. Restart the updated deploy tool.
            lock.close()
            os.execv(sys.executable, [sys.executable, str(Path(__file__)), *sys.argv[1:]])
        apply(config, state, args.inicial, args.reconstruir, args.retomar)


if __name__ == '__main__':
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    try:
        main()
    except DeployError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except (OSError, ValueError, KeyError, TypeError, KeyboardInterrupt):
        print('Atualização interrompida. Consulte deploy.md, estado e logs privados; dados e segredos não foram exibidos.', file=sys.stderr)
        sys.exit(1)
