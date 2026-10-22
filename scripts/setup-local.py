#!/usr/bin/env python3
"""Cria somente configuração sintética de desenvolvimento, sem sobrescrever."""
from pathlib import Path
import secrets

target = Path(__file__).resolve().parents[1] / '.env.local'
password = secrets.token_hex(24)
content = (
    'PUBLIC_SITE_URL=http://127.0.0.1:3000\n'
    f'LOCAL_DB_PASSWORD={password}\n'
    f'DATABASE_URL=postgresql://bibliotheon:{password}@127.0.0.1:55432/bibliotheon\n'
    f'PAYLOAD_SECRET={secrets.token_hex(32)}\n'
    f'LEAD_TOKEN_SECRET={secrets.token_hex(32)}\n'
    'LEADS_ENABLED=false\n'
    'EMAIL_TRANSPORT_ENABLED=false\n'
    'BREVO_DAILY_QUOTA=250\n'
    'BREVO_TRANSACTIONAL_RESERVE=50\n'
    'CHECKOUT_ALLOWED_HOSTS_HOTMART=\n'
    'CHECKOUT_ALLOWED_HOSTS_KIWIFY=\n'
    'CHECKOUT_ALLOWED_HOSTS_CAKTO=\n'
)
try:
    with target.open('x', encoding='utf-8') as output:
        target.chmod(0o600)
        output.write(content)
except FileExistsError:
    raise SystemExit('Configuração existente preservada.')
print('Configuração local gerada; valores não exibidos.')
