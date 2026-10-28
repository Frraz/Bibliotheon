#!/usr/bin/env python3
"""Deploy Git/Compose; backup exigido por padrão e opcional com --sem-backup."""

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
from urllib.parse import urlsplit, unquote
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
PROJECT = "bibliotheon"


class DeployError(Exception):
    pass


def private_file(path):
    path = Path(path).resolve()
    if not path.is_file() or path.stat().st_mode & 0o077:
        raise DeployError(
            "Arquivo privado ausente ou permissões abertas; use chmod 600."
        )
    if path.is_relative_to(ROOT):
        raise DeployError("Guarde configuração/credenciais fora do checkout Git.")
    return path


def read_config(path, require_backup=True):
    config = json.loads(private_file(path).read_text())
    allowed = {
        "env_file",
        "state_dir",
        "branch",
        "worker",
        "backup_env",
        "health_timeout",
        "min_memory_mb",
        "min_disk_mb",
        "public_health",
    }
    if not isinstance(config, dict) or set(config) - allowed:
        raise DeployError("Configuração de deploy inválida; confira deploy.md.")
    paths = {'env_file', 'state_dir'}
    if not paths.issubset(config) or any(not isinstance(config[key], str) or not Path(config[key]).is_absolute() for key in paths):
        raise DeployError('Informe env_file e state_dir como caminhos absolutos privados.')
    if require_backup and ('backup_env' not in config or not isinstance(config['backup_env'], str) or not Path(config['backup_env']).is_absolute()):
        raise DeployError('Informe backup_env como caminho absoluto privado ou use --sem-backup explicitamente.')
    config.setdefault("branch", "main")
    config.setdefault("worker", False)
    config.setdefault("health_timeout", 180)
    config.setdefault("min_memory_mb", 4096)
    config.setdefault("min_disk_mb", 15360)
    config.setdefault("public_health", True)
    if (
        not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/-]*", config["branch"])
        or ".." in config["branch"]
    ):
        raise DeployError("Branch inválida.")
    if type(config["worker"]) is not bool or type(config["public_health"]) is not bool:
        raise DeployError("worker/public_health precisam ser booleanos.")
    for key in ["health_timeout", "min_memory_mb", "min_disk_mb"]:
        if type(config[key]) is not int or config[key] < 1:
            raise DeployError("Limite operacional inválido.")
    config["env_file"] = str(private_file(config["env_file"]))
    if require_backup and 'backup_env' in config:
        if not isinstance(config['backup_env'], str) or not Path(config['backup_env']).is_absolute():
            raise DeployError('backup_env deve ser caminho absoluto privado.')
        config['backup_env'] = str(private_file(config['backup_env']))
    state = Path(config["state_dir"]).resolve()
    if state.is_relative_to(ROOT):
        raise DeployError("Diretório de releases precisa ficar fora do checkout.")
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    if state.stat().st_mode & 0o077:
        raise DeployError("Diretório de releases deve ter permissão 700.")
    return config, state


def command(argv, *, env=None, log=None):
    # Never persist raw tool output: it can contain a URL, token or submitted data.
    started = time.monotonic()
    result = subprocess.run(argv, cwd=ROOT, env=env, capture_output=True)
    program = Path(argv[0]).name
    verbs = {'pull', 'build', 'info', 'inspect', 'snapshots', 'config', 'run', 'up', 'stop', 'create', 'backup', 'ps', 'ls'}
    operation = next((arg for arg in argv[1:] if arg in verbs), 'command')
    if log:
        with Path(log).open("a") as stream:
            stream.write(
                json.dumps(
                    {
                        "program": program,
                        "operation": operation,
                        "exit": result.returncode,
                        "seconds": round(time.monotonic() - started, 2),
                    }
                )
                + "\n"
            )
    if result.returncode:
        raise DeployError(
            f"Etapa {program}/{operation} falhou (código {result.returncode}); consulte deploy.md e os metadados privados. Saídas brutas não foram gravadas."
        )
    return result.stdout.decode().strip()


def save(path, data):
    temp = Path(str(path) + ".tmp")
    with temp.open("w") as stream:
        json.dump(data, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temp, path)
    directory_fd = os.open(Path(path).parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(directory_fd)
    finally:
        os.close(directory_fd)


def compose(file, *args):
    return [
        "docker",
        "compose",
        "-p",
        PROJECT,
        "--project-directory",
        str(ROOT),
        "-f",
        str(file),
        "--profile",
        "maintenance",
        "--profile",
        "relationship",
        *args,
    ]


def compose_literals(value, escape=True):
    """Resolved config must survive Compose interpolation a second time."""
    if isinstance(value, str):
        return value.replace('$', '$$') if escape else value.replace('$$', '$')
    if isinstance(value, list):
        return [compose_literals(item, escape) for item in value]
    if isinstance(value, dict):
        return {key: compose_literals(item, escape) for key, item in value.items()}
    return value


def docker_env(env_file, image):
    env = os.environ.copy()
    keys = re.findall(
        r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=",
        Path(env_file).read_text(),
        re.M,
    )
    for key in list(env):
        if key in keys or key.startswith("COMPOSE_"):
            env.pop(key)
    env["BIBLIOTHEON_IMAGE"] = image
    return env


def validate_compose(data, config):
    services = data["services"]
    if set(services) != {"app", "db", "migrate", "worker"}:
        raise DeployError("Mudança de serviços exige revisão do deploy.")
    app, db, worker = (services[k] for k in ["app", "db", "worker"])
    if (
        db.get("ports")
        or worker.get("ports")
        or not app.get("read_only")
        or not worker.get("read_only")
    ):
        raise DeployError("Isolamento de serviços inválido.")
    ports = app.get("ports", [])
    if len(ports) != 1 or ports[0].get("host_ip") != "127.0.0.1":
        raise DeployError("App deve publicar uma única porta de loopback.")
    if "@sha256:" not in db["image"]:
        raise DeployError("Banco precisa de imagem fixada por digest.")
    values = app["environment"]
    for key in ["PAYLOAD_SECRET", "LEAD_TOKEN_SECRET"]:
        value = values.get(key, "")
        if len(value) < 32 or "REPLACE" in value:
            raise DeployError(
                "Configure segredos privados independentes, sem placeholders."
            )
    if values["PAYLOAD_SECRET"] == values["LEAD_TOKEN_SECRET"]:
        raise DeployError("Use segredos diferentes para sessão e links.")
    if not values["PUBLIC_SITE_URL"].startswith("https://"):
        raise DeployError("Produção exige origem HTTPS.")
    if values["DATABASE_URL"] == services["migrate"]["environment"]["DATABASE_URL"]:
        raise DeployError("Separe a credencial de runtime da credencial de migração.")
    for url, user, password in [
        (values['DATABASE_URL'], 'bibliotheon_runtime', db['environment']['DB_RUNTIME_PASSWORD']),
        (services['migrate']['environment']['DATABASE_URL'], 'bibliotheon_owner', db['environment']['POSTGRES_PASSWORD']),
    ]:
        parsed = urlsplit(url)
        if parsed.scheme not in ['postgres', 'postgresql'] or parsed.hostname != 'db' or parsed.port not in [None, 5432] or parsed.path != '/bibliotheon' or unquote(parsed.username or '') != user or unquote(parsed.password or '') != password or not password:
            raise DeployError('URLs precisam apontar para db/bibliotheon com os papéis/senhas configurados; confira a codificação das senhas.')
    site = urlsplit(values['PUBLIC_SITE_URL'])
    if not site.hostname or site.username or site.password or site.path not in ['', '/'] or site.query or site.fragment:
        raise DeployError('PUBLIC_SITE_URL precisa ser apenas a origem HTTPS, sem credencial/caminho/query.')
    media = [mount for mount in app.get('volumes', []) if mount.get('target') == '/app/uploads']
    if len(media) != 1 or media[0].get('type') != 'volume' or media[0].get('source') != 'media':
        raise DeployError('App precisa manter a mídia no volume persistente media.')
    if config["worker"] and values.get("EMAIL_TRANSPORT_ENABLED") != "true" and values.get("BREVO_CONTACT_SYNC_ENABLED") != "true" and values.get("BREVO_CAMPAIGN_OBSERVE_ENABLED") != "true" and values.get("COMMERCIAL_EVENTS_ENABLED") != "true":
        raise DeployError("Worker solicitado sem função operacional habilitada.")
    if worker.get('environment', {}).get('HOTMART_HOTTOK') or worker.get('environment', {}).get('HOTMART_PREVIOUS_HOTTOK'):
        raise DeployError('Token de recepção Hotmart deve ficar somente no serviço app.')
    if values.get('HOTMART_WEBHOOK_ENABLED') == 'true':
        account = values.get('HOTMART_ACCOUNT_KEY', '')
        current = values.get('HOTMART_HOTTOK', '')
        previous = values.get('HOTMART_PREVIOUS_HOTTOK', '')
        valid_token = lambda token: bool(token) and len(token) <= 512 and not re.search(r'[\s\x00-\x1f\x7f]', token) and not token.startswith('REPLACE_')
        unrelated = [values.get(name) for name in ['PAYLOAD_SECRET', 'LEAD_TOKEN_SECRET', 'BREVO_API_KEY', 'BREVO_WEBHOOK_TOKEN', 'BREVO_WEBHOOK_EVENT_SECRET', 'KIWIFY_WEBHOOK_TOKEN', 'KIWIFY_WEBHOOK_PREVIOUS_TOKEN', 'CAKTO_WEBHOOK_SECRET', 'CAKTO_WEBHOOK_PREVIOUS_SECRET'] if values.get(name)]
        if not account or len(account) > 200 or re.search(r'[\s\x00-\x1f\x7f@]', account) or re.match(r'^https?:', account, re.I) or not valid_token(current) or current in unrelated or (previous and (not valid_token(previous) or previous == current or previous in unrelated)):
            raise DeployError('Hotmart exige conta local opaca e Hottok copiado da conta, privado e independente.')
    if worker.get('environment', {}).get('KIWIFY_WEBHOOK_TOKEN') or worker.get('environment', {}).get('KIWIFY_WEBHOOK_PREVIOUS_TOKEN'):
        raise DeployError('Token de recepção Kiwify deve ficar somente no serviço app.')
    if values.get('KIWIFY_WEBHOOK_ENABLED') == 'true':
        account = values.get('KIWIFY_ACCOUNT_KEY', '')
        current = values.get('KIWIFY_WEBHOOK_TOKEN', '')
        previous = values.get('KIWIFY_WEBHOOK_PREVIOUS_TOKEN', '')
        valid_token = lambda token: 32 <= len(token) <= 512 and not re.search(r'[\s\x00-\x1f\x7f]', token) and not token.startswith('REPLACE_')
        unrelated = [values.get(name) for name in ['PAYLOAD_SECRET', 'LEAD_TOKEN_SECRET', 'BREVO_API_KEY', 'BREVO_WEBHOOK_TOKEN', 'BREVO_WEBHOOK_EVENT_SECRET', 'HOTMART_HOTTOK', 'HOTMART_PREVIOUS_HOTTOK', 'CAKTO_WEBHOOK_SECRET', 'CAKTO_WEBHOOK_PREVIOUS_SECRET'] if values.get(name)]
        if not account or len(account) > 200 or re.search(r'[\s\x00-\x1f\x7f@]', account) or re.match(r'^https?:', account, re.I) or not valid_token(current) or current in unrelated or (previous and (not valid_token(previous) or previous == current or previous in unrelated)):
            raise DeployError('Kiwify exige conta local opaca e token privado independente com ao menos 32 caracteres.')
    if worker.get('environment', {}).get('CAKTO_WEBHOOK_SECRET') or worker.get('environment', {}).get('CAKTO_WEBHOOK_PREVIOUS_SECRET'):
        raise DeployError('Token de recepção Cakto deve ficar somente no serviço app.')
    if values.get('CAKTO_WEBHOOK_ENABLED') == 'true':
        account = values.get('CAKTO_ACCOUNT_KEY', '')
        current = values.get('CAKTO_WEBHOOK_SECRET', '')
        previous = values.get('CAKTO_WEBHOOK_PREVIOUS_SECRET', '')
        valid_token = lambda token: 32 <= len(token) <= 512 and not re.search(r'[\s\x00-\x1f\x7f]', token) and not token.startswith('REPLACE_')
        unrelated = [values.get(name) for name in ['PAYLOAD_SECRET', 'LEAD_TOKEN_SECRET', 'BREVO_API_KEY', 'BREVO_WEBHOOK_TOKEN', 'BREVO_WEBHOOK_EVENT_SECRET', 'HOTMART_HOTTOK', 'HOTMART_PREVIOUS_HOTTOK', 'KIWIFY_WEBHOOK_TOKEN', 'KIWIFY_WEBHOOK_PREVIOUS_TOKEN'] if values.get(name)]
        if not account or len(account) > 200 or re.search(r'[\s\x00-\x1f\x7f@]', account) or re.match(r'^https?:', account, re.I) or not valid_token(current) or current in unrelated or (previous and (not valid_token(previous) or previous == current or previous in unrelated)):
            raise DeployError('Cakto exige conta local opaca e token privado independente com ao menos 32 caracteres.')
    if values.get("BREVO_WEBHOOK_ENABLED") == "true":
        webhook_token = values.get("BREVO_WEBHOOK_TOKEN", "")
        webhook_previous = values.get("BREVO_WEBHOOK_PREVIOUS_TOKEN", "")
        webhook_secret = values.get("BREVO_WEBHOOK_EVENT_SECRET", "")
        token_valid = lambda token: bool(re.fullmatch(r"[A-Za-z0-9_-]{32,128}", token)) and not token.startswith("REPLACE_")
        if not token_valid(webhook_token) or (webhook_previous and not token_valid(webhook_previous)) or len(webhook_secret.encode()) < 32 or webhook_secret.startswith("REPLACE_") or re.search(r"[\x00-\x20\x7f]", webhook_secret) or webhook_secret in [webhook_token, webhook_previous, values.get("LEAD_TOKEN_SECRET"), values.get("PAYLOAD_SECRET")] or webhook_token in [values.get("LEAD_TOKEN_SECRET"), values.get("PAYLOAD_SECRET")] or (webhook_previous and webhook_previous in [webhook_token, values.get("LEAD_TOKEN_SECRET"), values.get("PAYLOAD_SECRET")]):
            raise DeployError("Webhook exige token e segredo de deduplicação privados e independentes.")
    if values.get("BREVO_CAMPAIGN_OBSERVE_ENABLED") == "true":
        observation_key = values.get("BREVO_API_KEY", "")
        if not observation_key or observation_key.startswith("REPLACE_") or re.search(r"[\x00-\x20\x7f]", observation_key):
            raise DeployError("Observação exige chave privada válida antes da atualização.")
    if config["worker"] and values.get("BREVO_CONTACT_SYNC_ENABLED") == "true":
        contact_key = values.get("BREVO_API_KEY", "")
        if not contact_key or re.search(r"[\x00-\x20\x7f]", contact_key):
            raise DeployError("Worker de bloqueios exige chave privada válida antes da atualização.")
    if config["worker"] and values.get("BREVO_CONTACT_REGISTRATION_ENABLED") == "true":
        if values.get("BREVO_CONTACT_SYNC_ENABLED") != "true" or len(values.get("LEAD_TOKEN_SECRET", "").encode()) < 32:
            raise DeployError("Cadastro de contatos exige bloqueios habilitados e chave privada de links antes da atualização.")
    if values.get("BREVO_LIST_SYNC_ENABLED") == "true":
        folder = values.get("BREVO_LIST_FOLDER_ID", "")
        if values.get("BREVO_CONTACT_SYNC_ENABLED") != "true" or not re.fullmatch(r"[1-9][0-9]*", folder) or int(folder) > 9007199254740991 or not values.get("BREVO_API_KEY"):
            raise DeployError("Listas exigem bloqueios habilitados, pasta válida e chave privada antes da atualização.")
    if values.get("BREVO_PREFERENCE_SYNC_ENABLED") == "true":
        if values.get("BREVO_CONTACT_SYNC_ENABLED") != "true" or len(values.get("LEAD_TOKEN_SECRET", "").encode()) < 32 or not values.get("BREVO_API_KEY"):
            raise DeployError("Preferencias exigem bloqueios habilitados e chaves privadas antes da atualizacao.")
    if values.get("BREVO_CAMPAIGN_SYNC_ENABLED") == "true":
        sender = values.get("BREVO_CAMPAIGN_SENDER_ID", "")
        if any(values.get(flag) != "true" for flag in ["BREVO_CONTACT_SYNC_ENABLED", "BREVO_LIST_SYNC_ENABLED", "BREVO_PREFERENCE_SYNC_ENABLED"]) or not re.fullmatch(r"[1-9][0-9]*", sender) or int(sender) > 9007199254740991:
            raise DeployError("Rascunhos exigem listas/preferencias/bloqueios e ID de remetente valido.")
    if values.get("BREVO_CAMPAIGN_SEND_ENABLED") == "true" and values.get("BREVO_CAMPAIGN_SYNC_ENABLED") != "true":
        raise DeployError("Disparo promocional exige preparacao de campanhas habilitada e homologada.")
    # Reject unfilled database credentials without printing their contents.
    for service in services.values():
        if any(
            "REPLACE" in str(value) for value in service.get("environment", {}).values()
        ):
            raise DeployError("Configuração ainda contém placeholders.")


def compatible_database(previous, candidate):
    for key in [
        "image",
        "environment",
        "volumes",
        "networks",
        "command",
        "entrypoint",
        "user",
        "ports",
    ]:
        if previous["services"]["db"].get(key) != candidate["services"]["db"].get(key):
            raise DeployError(
                "Banco/configuração alterados: faça manutenção específica, não atualização automática."
            )
    for name in ["database", "media"]:
        if previous["volumes"][name] != candidate["volumes"][name]:
            raise DeployError(
                "Mudança de volumes persistentes exige manutenção específica."
            )


def ready(url, timeout):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                if response.status == 200 and json.loads(response.read(1024)) == {
                    "status": "ready"
                }:
                    return
        except (OSError, ValueError):
            pass
        time.sleep(2)
    raise DeployError("Readiness não foi confirmada dentro do prazo.")


def verify_service(file, service, image_id, env):
    container = command(compose(file, "ps", "-q", service), env=env)
    if not re.fullmatch(r"[a-f0-9]{12,64}", container):
        raise DeployError("Container esperado não foi encontrado.")
    status = command(
        [
            "docker",
            "inspect",
            container,
            "--format",
            "{{.Image}} {{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}",
        ],
        env=env,
    )
    if status != f"{image_id} running healthy":
        raise DeployError("Imagem/saúde do container diferente da release esperada.")


def backup_environment(path):
    values = json.loads(private_file(path).read_text())
    if not isinstance(values, dict) or not all(
        isinstance(v, str)
        and re.fullmatch(r"(RESTIC|AWS|B2|AZURE|GOOGLE)_[A-Z0-9_]+", k)
        for k, v in values.items()
    ):
        raise DeployError("JSON privado de backup inválido.")
    env = os.environ.copy()
    for key in list(env):
        if key.startswith("COMPOSE_"):
            env.pop(key)
    env.update(values)
    if not env.get("RESTIC_REPOSITORY") or not re.match(
        r"^(sftp|s3|rest|azure|gs|rclone|b2|swift):", env["RESTIC_REPOSITORY"]
    ):
        raise DeployError("Configure repositório externo de backup antes de atualizar.")
    private_file(env["RESTIC_PASSWORD_FILE"])
    return env


def capture_backup(file, env_file, env, log):
    result = json.loads(command([
        sys.executable, str(ROOT / 'ops/recovery.py'), 'backup',
        '--compose-file', str(file), '--env-file', str(env_file),
    ], env=env, log=log))
    if result.get('status') != 'backup_encrypted' or result.get('external') is not True or not re.fullmatch(r'[a-f0-9]{64}', result.get('snapshot', '')):
        raise DeployError('Backup externo não confirmado; migração não autorizada.')
    return {key: result[key] for key in ['snapshot', 'capturedAt', 'durationSeconds']}


def backup_current(config, state):
    current = json.loads((state / 'current.json').read_text())
    file = Path(current['compose_file'])
    env = docker_env(config['env_file'], current['image'])
    backup_env = backup_environment(config['backup_env'])
    log = state / 'backup-operations.log'
    verify_service(file, 'app', current['image_id'], env)
    pending = state / 'in-progress.json'
    save(pending, {'release': current['release'], 'phase': 'backup-only'})
    try:
        command(compose(file, 'stop', 'app', 'worker'), env=env, log=log)
        result = capture_backup(file, Path(current['release']) / 'production.env', backup_env, log)
        save(state / 'last-backup.json', result)
        gc = json.loads(command(compose(file, 'run', '--rm', '--no-deps', '-T', '--pull', 'never', 'app', 'node', 'cli/media-gc.js', '--apply'), env=env, log=log))
        fields = {'mode', 'scanned', 'referenced', 'candidates', 'eligible', 'removed', 'skipped'}
        if not isinstance(gc, dict) or set(gc) != fields or gc['mode'] != 'apply' or any(type(value) is not int or value < 0 for key, value in gc.items() if key != 'mode'):
            raise DeployError('Resultado da limpeza de mídia inválido; confira versão da imagem.')
        save(state / 'last-media-gc.json', gc)
    finally:
        command(compose(file, 'up', '-d', '--no-deps', '--pull', 'never', '--wait', '--wait-timeout', str(config['health_timeout']), *(['app', 'worker'] if current['worker'] else ['app'])), env=env, log=log)
        ready(current['local_health'], config['health_timeout'])
        pending.unlink()
    print('Backup externo confirmado; serviços da versão atual retomados.')


def apply(config, state, initial=False, rebuild=False, resume=False, backup_enabled=True):
    current_path, pending_path = state / "current.json", state / "in-progress.json"
    interrupted = (
        json.loads(pending_path.read_text()) if pending_path.exists() else None
    )
    if interrupted and not resume:
        raise DeployError(
            "Existe atualização interrompida. Consulte deploy.md e in-progress.json antes de retomar."
        )
    current = json.loads(current_path.read_text()) if current_path.exists() else None
    if resume:
        if initial or not interrupted:
            raise DeployError(
                "--retomar exige uma atualização interrompida, sem --inicial."
            )
        interrupted_release = Path(interrupted["release"]).resolve()
        if not interrupted_release.is_relative_to(state / "releases"):
            raise DeployError("Estado de recuperação inválido.")
        # Even a failed first deploy has a built image and a private resolved config.
        current = json.loads((interrupted_release / "release.json").read_text())
        rebuild = True
    elif initial == bool(current):
        raise DeployError(
            "Use --inicial apenas no primeiro deploy; atualizações exigem current.json existente."
        )
    command(["docker", "info"])
    if initial and (
        command(
            [
                "docker",
                "ps",
                "-aq",
                "--filter",
                f"label=com.docker.compose.project={PROJECT}",
            ]
        )
        or command(
            [
                "docker",
                "volume",
                "ls",
                "-q",
                "--filter",
                f"label=com.docker.compose.project={PROJECT}",
            ]
        )
    ):
        raise DeployError(
            "Já existem containers desse projeto sem estado gerenciado; não serão assumidos automaticamente."
        )
    commit = command(["git", "rev-parse", "HEAD"])
    env_hash = hashlib.sha256(Path(config["env_file"]).read_bytes()).hexdigest()
    if (
        current
        and not rebuild
        and current["commit"] == commit
        and current["env_hash"] == env_hash
        and current["worker"] == config["worker"]
    ):
        verify_service(
            Path(current["compose_file"]), "app", current["image_id"], os.environ.copy()
        )
        if current["worker"]:
            verify_service(
                Path(current["compose_file"]),
                "worker",
                current["image_id"],
                os.environ.copy(),
            )
        ready(current["local_health"], config["health_timeout"])
        if config["public_health"]:
            ready(current["public_health"], config["health_timeout"])
        print("Versão e configuração já estão aplicadas; saúde confirmada.")
        return
    memory = (
        int(
            re.search(
                r"^MemAvailable:\s+(\d+)", Path("/proc/meminfo").read_text(), re.M
            )[1]
        )
        // 1024
    )
    if (
        memory < config["min_memory_mb"]
        or shutil.disk_usage(ROOT).free // (1024**2) < config["min_disk_mb"]
    ):
        raise DeployError(
            "RAM/disco livres abaixo do mínimo configurado; build não iniciado."
        )
    backup_env = None
    if backup_enabled:
        backup_env = backup_environment(config["backup_env"])
        command(
            [backup_env.get("RESTIC_BINARY", "restic"), "snapshots", "--json"],
            env=backup_env,
        )
    else:
        print('ATENÇÃO: deploy explicitamente sem backup; não haverá ponto de restauração recente.', flush=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    release = state / "releases" / f"{stamp}-{commit[:12]}-{os.urandom(3).hex()}"
    release.mkdir(parents=True, mode=0o700)
    log = release / "operations.log"
    image = f"bibliotheon-release:{release.name.lower()}"
    env = docker_env(config["env_file"], image)
    source_compose = ROOT / "compose.production.yaml"
    candidate = compose_literals(json.loads(
        command(
            [
                "docker",
                "compose",
                "-p",
                PROJECT,
                "--project-directory",
                str(ROOT),
                "--env-file",
                config["env_file"],
                "-f",
                str(source_compose),
                "--profile",
                "maintenance",
                "--profile",
                "relationship",
                "config",
                "--format",
                "json",
            ],
            env=env,
        )
    ), escape=False)
    validate_compose(candidate, config)
    old_file = Path(current["compose_file"]) if current else None
    if current:
        compatible_database(compose_literals(json.loads(old_file.read_text()), escape=False), candidate)
        actual = command(
            ["docker", "image", "inspect", current["image"], "--format", "{{.Id}}"]
        )
        if actual != current["image_id"]:
            raise DeployError(
                "Imagem anterior não corresponde ao manifesto; atualização interrompida."
            )
    file = release / "compose.json"
    save(file, compose_literals(candidate))
    # Keep a private dotenv snapshot for recovery.py; compose.json is already resolved.
    shutil.copyfile(config["env_file"], release / "production.env")
    print(
        "Construindo imagem nova; a aplicação atual permanece ativa durante o build.",
        flush=True,
    )
    command(
        [
            "docker",
            "build",
            "--label",
            f"org.opencontainers.image.revision={commit}",
            "-t",
            image,
            ".",
        ],
        env=env,
        log=log,
    )
    image_id = command(["docker", "image", "inspect", image, "--format", "{{.Id}}"])
    port = candidate["services"]["app"]["ports"][0]["published"]
    record = {
        "commit": commit,
        "image": image,
        "image_id": image_id,
        "compose_file": str(file),
        "env_hash": env_hash,
        "worker": config["worker"],
        "local_health": f"http://127.0.0.1:{port}/health/ready",
        "public_health": candidate["services"]["app"]["environment"][
            "PUBLIC_SITE_URL"
        ].rstrip("/")
        + "/health/ready",
        "previous": str(Path(current["release"]) / "release.json") if current else None,
        "release": str(release),
        "status": "built",
    }
    if not backup_enabled:
        record["backup_skipped"] = True
    if current:
        save(release / "previous.json", current)
    if interrupted:
        save(release / "interrupted.json", interrupted)
    save(release / "release.json", record)
    save(pending_path, {"release": str(release), "phase": "before-backup" if backup_enabled else "before-migration-no-backup"})
    stopped, migration_started = False, resume
    try:
        if current:
            print(
                "Pausando somente app/worker do Bibliotheon para " + ("backup consistente." if backup_enabled else "atualização sem backup."),
                flush=True,
            )
            stopped = True
            command(compose(old_file, "stop", "app", "worker"), env=env, log=log)
            if resume:
                command(
                    compose(
                        old_file,
                        "up",
                        "-d",
                        "--no-recreate",
                        "--wait",
                        "--wait-timeout",
                        str(config["health_timeout"]),
                        "db",
                    ),
                    env=env,
                    log=log,
                )
                if not command(compose(old_file, "ps", "-a", "-q", "app"), env=env):
                    command(
                        compose(
                            old_file, "create", "--no-deps", "--pull", "never", "app"
                        ),
                        env=env,
                        log=log,
                    )
            if backup_enabled:
                backup = capture_backup(old_file, Path(current['release']) / 'production.env', backup_env, log)
                save(release / 'backup.json', backup)
                record['backup_snapshot'] = backup['snapshot']
                save(release / 'release.json', record)
        else:
            command(
                compose(
                    file,
                    "up",
                    "-d",
                    "--wait",
                    "--wait-timeout",
                    str(config["health_timeout"]),
                    "db",
                ),
                env=env,
                log=log,
            )
        save(pending_path, {"release": str(release), "phase": "migration-started"})
        migration_started = True
        print("Aplicando migrações; o schema não terá rollback automático.", flush=True)
        command(
            compose(
                file, "run", "--rm", "--no-deps", "-T", "--pull", "never", "migrate"
            ),
            env=env,
            log=log,
        )
        save(pending_path, {"release": str(release), "phase": "starting-app"})
        command(
            compose(
                file,
                "up",
                "-d",
                "--no-deps",
                "--pull",
                "never",
                "--wait",
                "--wait-timeout",
                str(config["health_timeout"]),
                "app",
            ),
            env=env,
            log=log,
        )
        ready(record["local_health"], config["health_timeout"])
        verify_service(file, "app", image_id, env)
        if not initial and config["public_health"]:
            ready(record["public_health"], config["health_timeout"])
        if config["worker"]:
            command(
                compose(
                    file,
                    "up",
                    "-d",
                    "--no-deps",
                    "--pull",
                    "never",
                    "--wait",
                    "--wait-timeout",
                    str(config["health_timeout"]),
                    "worker",
                ),
                env=env,
                log=log,
            )
            verify_service(file, "worker", image_id, env)
        record["status"] = "healthy"
        save(release / "release.json", record)
        save(current_path, record)
        pending_path.unlink()
        print(f"Versão {commit[:12]} aplicada e saudável. Manifesto privado: {release}")
    except BaseException:
        if not migration_started:
            if stopped:
                command(
                    compose(
                        old_file,
                        "up",
                        "-d",
                        "--no-deps",
                        "--pull",
                        "never",
                        "--wait",
                        "--wait-timeout",
                        str(config["health_timeout"]),
                        *(["app", "worker"] if current["worker"] else ["app"]),
                    ),
                    env=env,
                    log=log,
                )
            pending_path.unlink(missing_ok=True)
        else:
            # New/old code may no longer match the partially changed schema.
            command(compose(file, "stop", "app", "worker"), env=env, log=log)
            print(
                "Migração iniciada: serviços de aplicação ficam parados para diagnóstico; banco/volumes preservados.",
                flush=True,
            )
        raise


def main():
    os.umask(0o077)
    if sys.version_info < (3, 11):
        raise DeployError('Use Python 3.11 ou superior para deploy/recuperação.')
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--inicial", action="store_true")
    modes.add_argument('--backup', action='store_true', help='Backup externo da versão atual, sem pull/build/migração.')
    parser.add_argument('--sem-backup', action='store_true', help='Pular explicitamente o backup pré-deploy; não haverá ponto de restauração recente.')
    parser.add_argument("--reconstruir", action="store_true")
    modes.add_argument(
        "--retomar",
        action="store_true",
        help="Após diagnóstico de uma atualização interrompida; não reverte schema.",
    )
    parser.add_argument("--config", default="/etc/bibliotheon/deploy.json")
    args = parser.parse_args()
    if args.sem_backup and args.backup:
        raise DeployError('--sem-backup não pode ser combinado com --backup.')
    if args.sem_backup and args.retomar:
        raise DeployError('--sem-backup não pode ser combinado com --retomar.')
    config, state = read_config(args.config, require_backup=not args.sem_backup)
    with (state / "deploy.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise DeployError("Outra atualização já está em execução.")
        if (state / "in-progress.json").exists() and not args.retomar:
            raise DeployError(
                "Atualização interrompida; revise in-progress.json e deploy.md antes de fazer pull."
            )
        if args.backup:
            if args.reconstruir:
                raise DeployError('--backup não usa --reconstruir.')
            backup_current(config, state)
            return
        if command(["git", "rev-parse", "--show-toplevel"]) != str(ROOT):
            raise DeployError("Execute no checkout Git do Bibliotheon.")
        if command(["git", "status", "--porcelain"]):
            raise DeployError(
                "Checkout contém alterações locais; faça commit/stash/revisão antes de atualizar."
            )
        if command(["git", "branch", "--show-current"]) != config["branch"]:
            raise DeployError("Branch atual diferente da configurada.")
        before = hashlib.sha256(Path(__file__).read_bytes()).digest()
        print(
            "Buscando atualização Git com fast-forward, sem reset ou descarte de arquivos.",
            flush=True,
        )
        git_env = os.environ.copy()
        git_env['GIT_TERMINAL_PROMPT'] = '0'
        git_env.setdefault('GIT_SSH_COMMAND', 'ssh -o BatchMode=yes')
        command(["git", "pull", "--ff-only", "origin", config["branch"]], env=git_env)
        if command(['git', 'rev-parse', 'HEAD']) != command(['git', 'rev-parse', 'FETCH_HEAD']):
            raise DeployError('Branch contém commits locais não presentes no remoto; revise antes de publicar, sem reset automático.')
        if before != hashlib.sha256(Path(__file__).read_bytes()).digest():
            # No production mutation has started. Restart the updated deploy tool.
            lock.close()
            os.execv(
                sys.executable, [sys.executable, str(Path(__file__)), *sys.argv[1:]]
            )
        apply(config, state, args.inicial, args.reconstruir, args.retomar, backup_enabled=not args.sem_backup)


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    try:
        main()
    except DeployError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except (OSError, ValueError, KeyError, TypeError, KeyboardInterrupt):
        print(
            "Atualização interrompida. Consulte deploy.md, estado e logs privados; dados e segredos não foram exibidos.",
            file=sys.stderr,
        )
        sys.exit(1)
