#!/usr/bin/env python3
"""Gera CSS exclusivamente a partir da paleta canônica; --check não altera."""
from pathlib import Path
import json
import sys

root = Path(__file__).resolve().parents[1]
palette = json.loads((root / 'docs/design/cores.json').read_text())['themes']

def block(selector, name):
    values = '\n'.join(f'  --color-{key}: {value};' for key, value in palette[name].items())
    return f'{selector} {{\n{values}\n}}\n'

content = '/* Gerado por scripts/generate-tokens.py. Não editar. */\n'
content += block(':root, [data-theme="light"]', 'claro')
content += block('[data-theme="dark"]', 'escuro')
content += '@media (prefers-color-scheme: dark) {\n' + block(':root:not([data-theme="light"]):not([data-theme="dark"])', 'escuro') + '}\n'
target = root / 'src/styles/colors.css'
if '--check' in sys.argv:
    if not target.exists() or target.read_text() != content:
        raise SystemExit('CSS de cores desatualizado.')
    print('CSS corresponde à paleta canônica.')
else:
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)
