#!/usr/bin/env python3
"""Controle local Linux; nunca adota processos existentes ou usa Compose de produção."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
URL = 'http://127.0.0.1:3000'


class LocalError(Exception):
    pass


def identity(pid):
    """PID + início no kernel + sessão evitam sinalizar um PID reciclado."""
    try:
        stat = Path(f'/proc/{pid}/stat').read_text().rsplit(')', 1)[1].split()
        if stat[0] == 'Z':
            return None
        return {'pid': pid, 'started': stat[19], 'session': int(stat[3]),
                'cwd': str(Path(f'/proc/{pid}/cwd').resolve(strict=True))}
    except (OSError, ValueError, IndexError):
        return None


def owned(record, root):
    pid = record.get('pid')
    return (type(pid) is int and pid > 1 and record.get('session') == pid
            and record.get('cwd') == str(root) and identity(pid) == record)


def read_state(path):
    try:
        record = json.loads(path.read_text())
        if not isinstance(record, dict) or set(record) != {'pid', 'started', 'session', 'cwd'}:
            raise ValueError
        return record
    except FileNotFoundError:
        return None
    except (ValueError, OSError):
        raise LocalError('Estado local inválido; confira .local-run/dev.json sem encerrar processos manualmente por PID.') from None


def available_port():
    try:
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 3000))
    except OSError:
        raise LocalError('Porta 3000 ocupada. Nenhum processo existente será adotado ou encerrado.') from None


def group_alive(group):
    # Zombies já encerraram e não podem ser sinalizados; não aguardá-los.
    for entry in Path('/proc').iterdir():
        if not entry.name.isdigit():
            continue
        try:
            stat = (entry / 'stat').read_text().rsplit(')', 1)[1].split()
            if int(stat[2]) == group and stat[0] != 'Z':
                return True
        except (OSError, ValueError, IndexError):
            continue
    return False


def terminate(record, root):
    if not owned(record, root):
        raise LocalError('Processo não corresponde à identidade registrada; nenhum sinal enviado.')
    os.killpg(record['pid'], signal.SIGTERM)
    # O líder pode terminar antes de seus filhos. Conferir o grupo, não só o PID.
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        if not group_alive(record['pid']):
            return
        time.sleep(0.1)
    try:
        os.killpg(record['pid'], signal.SIGKILL)
    except ProcessLookupError:
        pass


def command(argv):
    result = subprocess.run(argv, cwd=ROOT, check=False)
    if result.returncode:
        raise LocalError('Comando local falhou; confira a etapa acima.')


def healthy():
    # Ignora proxies do host para não encaminhar checks de loopback para fora.
    try:
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(URL + '/health/ready', timeout=2) as response:
            return response.status == 200
    except (OSError, urllib.error.URLError):
        return False


def start(state):
    record = read_state(state)
    if record:
        if owned(record, ROOT):
            if not healthy():
                raise LocalError('Processo gerenciado está ativo, mas saúde indisponível. Confira os logs ou use ./stop.sh.')
            print(f'Bibliotheon já está em execução: {URL}')
            return
        if identity(record.get('pid')) is not None:
            raise LocalError('PID registrado pertence a outra identidade; estado preservado.')
        state.unlink()
    # A instância do script antigo é preservada até o operador encerrá-la.
    legacy = ROOT / '.local-run/next.pid'
    if legacy.exists():
        raise LocalError('Registro legado next.pid presente. Confira/encerre a instância antiga e remova somente o registro obsoleto antes de iniciar.')
    available_port()
    if not (ROOT / '.env.local').is_file():
        raise LocalError('Gere o ambiente com python3 scripts/setup-local.py.')
    for executable in ('node', 'docker'):
        if not shutil.which(executable):
            raise LocalError(f'{executable} não encontrado no PATH.')
    if not (ROOT / 'node_modules/next/dist/bin/next').is_file():
        raise LocalError('Instale dependências: corepack pnpm install --frozen-lockfile.')
    compose = ['docker', 'compose', '--env-file', '.env.local', '-f', 'compose.local.yaml']
    print('Iniciando banco local e aplicando migrations...', flush=True)
    command(compose + ['up', '-d', '--wait', 'db'])
    command(['node', '--env-file=.env.local', 'node_modules/payload/bin.js', 'migrate'])
    log = ROOT / '.local-logs/next.log'
    log.parent.mkdir(mode=0o700, exist_ok=True)
    env = {**os.environ, 'NEXT_TELEMETRY_DISABLED': '1', 'NEXT_DIST_DIR': '.next'}
    child = None
    record = None
    try:
        with log.open('ab') as output:
            os.chmod(log, 0o600)
            child = subprocess.Popen(['node', 'node_modules/next/dist/bin/next', 'dev', '--webpack',
                                     '--hostname', '127.0.0.1', '--port', '3000'], cwd=ROOT,
                                    stdin=subprocess.DEVNULL, stdout=output, stderr=output,
                                    start_new_session=True, env=env)
        record = identity(child.pid)
        if not record or not owned(record, ROOT):
            raise LocalError('Não foi possível registrar o processo local.')
        state.write_text(json.dumps(record) + '\n')
        state.chmod(0o600)
        deadline = time.monotonic() + 90
        while time.monotonic() < deadline:
            if child.poll() is not None:
                raise LocalError('Next.js encerrou durante a inicialização.')
            if healthy():
                print(f'Bibliotheon iniciado: {URL}\nLogs privados: {log}')
                return
            time.sleep(1)
        raise LocalError('Saúde indisponível após 90 segundos.')
    except BaseException:
        if record and owned(record, ROOT):
            terminate(record, ROOT)
        elif child and child.poll() is None:
            child.terminate()
        if child:
            try:
                child.wait(timeout=12)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()
        state.unlink(missing_ok=True)
        print('Confira .local-logs/next.log; banco local preservado para diagnóstico.', file=sys.stderr)
        raise


def stop(state, keep_db):
    record = read_state(state)
    if record and owned(record, ROOT):
        terminate(record, ROOT)
        state.unlink()
        print('Next.js gerenciado encerrado.')
    elif record and identity(record.get('pid')) is not None:
        raise LocalError('Identidade do processo divergiu; nenhum processo/banco foi parado.')
    elif record:
        state.unlink()
    if (ROOT / '.local-run/next.pid').exists():
        raise LocalError('Registro legado next.pid presente; confira a instância antiga antes de parar o banco.')
    # Também protege a prévia gerenciada ou qualquer servidor alheio ao script.
    available_port()
    if not keep_db:
        if not (ROOT / '.env.local').is_file():
            raise LocalError('.env.local ausente; banco não alterado.')
        command(['docker', 'compose', '--env-file', '.env.local', '-f', 'compose.local.yaml', 'stop', 'db'])
        print('PostgreSQL local parado; volumes preservados.')


def main():
    parser = argparse.ArgumentParser(description='Inicia/encerra somente desenvolvimento local Linux; produção usa atualizar.sh.')
    sub = parser.add_subparsers(dest='action', required=True)
    sub.add_parser('start', help='Banco local, migrations e Next na porta 3000')
    stop_parser = sub.add_parser('stop', help='Encerra o grupo de processos registrado e para o banco local')
    stop_parser.add_argument('--keep-db', action='store_true', help='Preserva o banco em execução')
    args = parser.parse_args()
    if not Path('/proc/self/stat').is_file():
        raise LocalError('O controle local requer Linux com /proc.')
    run_dir = ROOT / '.local-run'
    run_dir.mkdir(mode=0o700, exist_ok=True)
    with (run_dir / 'control.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise LocalError('Outro start/stop está em andamento.') from None
        state = run_dir / 'dev.json'
        if args.action == 'start':
            start(state)
        else:
            stop(state, args.keep_db)


if __name__ == '__main__':
    try:
        main()
    except (LocalError, OSError) as exc:
        print(f'ERRO: {exc}', file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print('Operação interrompida.', file=sys.stderr)
        sys.exit(130)
