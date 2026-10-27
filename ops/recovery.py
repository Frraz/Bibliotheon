#!/usr/bin/env python3
"""Backup criptografado e restore somente em projeto Compose isolado.

Nunca imprime credenciais, dumps, linhas do banco ou saídas brutas do restic.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tarfile
import tempfile
import time


class RecoveryError(Exception):
    pass


def run(command, *, output=None, input_file=None):
    result = subprocess.run(command, stdin=input_file, stdout=output if output else subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise RecoveryError('Uma etapa falhou. Nenhum dado bruto foi exibido; confira serviço, acesso e configuração em ambiente protegido.')
    return result.stdout if output is None else b''


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def compose(args):
    return ['docker', 'compose', '--file', str(Path(args.compose_file).resolve()), '--env-file', str(Path(args.env_file).resolve()), '--profile', 'maintenance', '--profile', 'relationship']


def quiescent(args):
    command = compose(args)
    config = json.loads(run(command + ['config', '--format', 'json']))
    running = run(command + ['ps', '--status', 'running', '--services']).decode().split()
    if 'app' in running or 'worker' in running:
        raise RecoveryError('Pare somente app e worker do Bibliotheon antes da captura/restauração. O banco deve permanecer ativo.')
    if 'db' not in running:
        raise RecoveryError('O banco do projeto escolhido precisa estar ativo.')
    return config


def restic(args):
    binary = os.environ.get('RESTIC_BINARY') or shutil.which('restic')
    if not binary or not Path(binary).is_file():
        raise RecoveryError('Configure RESTIC_BINARY com uma instalação verificada do restic.')
    repository = os.environ.get('RESTIC_REPOSITORY', '')
    if not repository or not os.environ.get('RESTIC_PASSWORD_FILE'):
        raise RecoveryError('Configure RESTIC_REPOSITORY e RESTIC_PASSWORD_FILE fora do Git.')
    password_file = Path(os.environ['RESTIC_PASSWORD_FILE'])
    if not password_file.is_file() or password_file.stat().st_mode & 0o077:
        raise RecoveryError('O arquivo da chave precisa existir com acesso restrito ao proprietário (600).')
    if not args.lab and not re.match(r'^(sftp|s3|rest|azure|gs|rclone|b2|swift):', repository):
        raise RecoveryError('Backup operacional exige repositório externo. Repositório local só é aceito em --lab.')
    return str(binary)


def database_command(args, command):
    # Variables are expanded by the trusted container shell, never by host input.
    return compose(args) + ['exec', '-T', 'db', 'sh', '-c', command]


def backup(args):
    started = time.monotonic()
    config = quiescent(args)
    if args.lab and not config['name'].startswith('bibliotheon-local'):
        raise RecoveryError('--lab só pode capturar um projeto bibliotheon-local.')
    binary = restic(args)
    with tempfile.TemporaryDirectory(prefix='bibliotheon-backup-') as temp:
        staging = Path(temp)
        dump = staging / 'database.dump'
        captured_at = datetime.now(timezone.utc).isoformat()
        with dump.open('wb') as stream:
            run(database_command(args, 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl'), output=stream)
        media = staging / 'uploads'
        if args.media_dir:
            source = Path(args.media_dir).resolve()
            if not source.is_dir():
                raise RecoveryError('Diretório de mídia ausente.')
            shutil.copytree(source, media, symlinks=True)
        else:
            app_id = run(compose(args) + ['ps', '-a', '-q', 'app']).decode().strip()
            if not re.fullmatch(r'[a-f0-9]{12,64}', app_id):
                raise RecoveryError('Container app ausente; informe um diretório de mídia autorizado.')
            media.mkdir()
            run(['docker', 'cp', f'{app_id}:/app/uploads/.', str(media)])
        hashes = {}
        for path in media.rglob('*'):
            if path.is_symlink():
                raise RecoveryError('Mídia com link simbólico não pode entrar no backup.')
            if path.is_file():
                hashes[path.relative_to(media).as_posix()] = digest(path)
        manifest = { 'version': 1, 'capturedAt': captured_at, 'image': config['services'].get('app', {}).get('image'), 'dumpSHA256': digest(dump), 'mediaSHA256': hashes }
        (staging / 'manifest.json').write_text(json.dumps(manifest), encoding='utf-8')
        archive = staging / 'bibliotheon-backup.tar'
        with tarfile.open(archive, 'w') as tar:
            for name in ['manifest.json', 'database.dump', 'uploads']:
                tar.add(staging / name, arcname=name, recursive=True)
        with archive.open('rb') as stream:
            lines = run([binary, 'backup', '--stdin', '--stdin-filename', 'bibliotheon-backup.tar', '--tag', 'bibliotheon', '--json'], input_file=stream).decode().splitlines()
        summaries = [json.loads(line) for line in lines if line.startswith('{')]
        snapshot = next((line.get('snapshot_id') for line in summaries if line.get('message_type') == 'summary'), None)
        if not isinstance(snapshot, str) or not re.fullmatch(r'[a-f0-9]{64}', snapshot):
            raise RecoveryError('Não foi possível confirmar o snapshot durável.')
        run([binary, 'snapshots', snapshot, '--json'])
        run([binary, 'check'])
        print(json.dumps({ 'status': 'backup_encrypted', 'snapshot': snapshot, 'capturedAt': captured_at, 'durationSeconds': round(time.monotonic() - started, 2), 'mediaFiles': len(hashes), 'external': not args.lab }))


def restore(args):
    started = time.monotonic()
    config = quiescent(args)
    if not config['name'].startswith('bibliotheon-restore-'):
        raise RecoveryError('Restore só é permitido num projeto bibliotheon-restore- separado da produção.')
    if not re.fullmatch(r'[a-f0-9]{64}', args.snapshot):
        raise RecoveryError('Escolha o ID completo de um snapshot, nunca um destino implícito.')
    target = Path(args.media_dir).resolve()
    if target.exists() and any(target.iterdir()):
        raise RecoveryError('O diretório de mídia de destino precisa estar vazio.')
    tables = run(database_command(args, 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = \'public\'"')).decode().strip()
    if tables != '0':
        raise RecoveryError('O banco de destino não está vazio. Nenhuma tabela será sobrescrita.')
    binary = restic(args)
    with tempfile.TemporaryDirectory(prefix='bibliotheon-restore-') as temp:
        staging = Path(temp)
        archive = staging / 'restore.tar'
        with archive.open('wb') as stream:
            run([binary, 'dump', args.snapshot, '/bibliotheon-backup.tar'], output=stream)
        with tarfile.open(archive, 'r:') as tar:
            total = 0
            for item in tar.getmembers():
                relative = Path(item.name)
                if not relative.parts or relative.is_absolute() or '..' in relative.parts or item.issym() or item.islnk() or not (item.isfile() or item.isdir()) or relative.parts[0] not in ['manifest.json', 'database.dump', 'uploads']:
                    raise RecoveryError('O backup contém um caminho ou tipo de arquivo inválido.')
                total += item.size
            if total > 22 * 1024 ** 3:
                raise RecoveryError('Backup excede o orçamento inicial de recuperação; revise capacidade antes de continuar.')
            tar.extractall(staging / 'content', filter='data')
        content = staging / 'content'
        manifest = json.loads((content / 'manifest.json').read_text())
        if manifest.get('version') != 1 or digest(content / 'database.dump') != manifest.get('dumpSHA256'):
            raise RecoveryError('Manifesto ou hash do banco inválido.')
        files = {path.relative_to(content / 'uploads').as_posix(): digest(path) for path in (content / 'uploads').rglob('*') if path.is_file()}
        if files != manifest.get('mediaSHA256'):
            raise RecoveryError('Mídia incompleta ou alterada.')
        with (content / 'database.dump').open('rb') as stream:
            run(database_command(args, 'exec pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl --exit-on-error --single-transaction'), input_file=stream)
        target.mkdir(parents=True, exist_ok=True)
        shutil.copytree(content / 'uploads', target, dirs_exist_ok=True)
        age = (datetime.now(timezone.utc) - datetime.fromisoformat(manifest['capturedAt'])).total_seconds()
        print(json.dumps({ 'status': 'restored_isolated', 'capturedAt': manifest['capturedAt'], 'privacyReplayRequired': True, 'durationSeconds': round(time.monotonic() - started, 2), 'snapshotAgeSeconds': round(age, 2), 'mediaFiles': len(files), 'outboundServicesStarted': False, 'limitations': 'Idade do snapshot não comprova RPO de produção; reaplicar exclusões/supressões antes de qualquer envio.' }))


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['backup', 'restore'])
    parser.add_argument('--compose-file', required=True)
    parser.add_argument('--env-file', required=True)
    parser.add_argument('--media-dir')
    parser.add_argument('--snapshot')
    parser.add_argument('--lab', action='store_true')
    args = parser.parse_args()
    if args.action == 'restore' and (not args.snapshot or not args.media_dir):
        parser.error('Restore exige --snapshot e --media-dir.')
    try:
        backup(args) if args.action == 'backup' else restore(args)
    except RecoveryError as error:
        raise SystemExit(str(error))
    except (OSError, ValueError, KeyError, tarfile.TarError):
        raise SystemExit('Recuperação interrompida com segurança. Confira projeto, banco vazio/quiescência, ferramenta, repositório e manifesto em ambiente protegido; dados e segredos não foram exibidos.')


if __name__ == '__main__':
    main()
