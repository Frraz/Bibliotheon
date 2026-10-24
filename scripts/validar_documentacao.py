#!/usr/bin/env python3
"""Valida o pacote documental local, sem rede e sem alterar arquivos.

Parser intencionalmente limitado aos links Markdown inline usados neste pacote.
Não substitui revisão semântica, verificação externa ou testes da aplicação.
"""
from pathlib import Path
from urllib.parse import unquote, urlsplit
import hashlib
import re
import sys
import subprocess
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
SOURCE_HASHES = {
    'reflexoes.md': 'e9be41f92ab65d33cfdc5e8f9447d7fb05cf84ad43cb920d7d4906d15d8a262c',
    'ideais para melhora o desing.md': 'a78685e178c4453a71f9abfcc30aac0c32a7f114b4081f41790c1a6f7561e122',
}


def headings(text):
    anchors = set()
    seen = {}
    for title in re.findall(r'^#{1,6}\s+(.+)$', text, re.M):
        slug = ''.join(c for c in title.lower() if c in '-_ ' or unicodedata.category(c)[0] in 'LN').replace(' ', '-')
        count = seen.get(slug, 0)
        seen[slug] = count + 1
        anchors.add(f'{slug}-{count}' if count else slug)
    return anchors


def main():
    errors = []
    files = [ROOT / 'README.md', ROOT / 'AGENTS.md', ROOT / 'DESIGN-BRIEF.md', ROOT / 'deploy.md', ROOT / 'pendencias.md', *sorted((ROOT / 'docs').rglob('*.md'))]
    texts = {}
    for path in files:
        if not path.is_file():
            errors.append(f'Arquivo ausente: {path.relative_to(ROOT)}')
            continue
        text = path.read_text(encoding='utf-8')
        texts[path] = text
        if not text.startswith('# '):
            errors.append(f'Sem título: {path.relative_to(ROOT)}')
        if len(re.findall(r'^```', text, re.M)) % 2:
            errors.append(f'Bloco de código sem fechamento: {path.relative_to(ROOT)}')

    local_links = 0
    external_urls = set()
    for path, text in texts.items():
        clean = re.sub(r'```.*?```', '', text, flags=re.S)
        for match in re.finditer(r'\[[^\]\n]+\]\(([^)\n]+)\)', clean):
            target = match.group(1).strip().strip('<>')
            parts = urlsplit(target)
            if parts.scheme in ('http', 'https', 'mailto'):
                external_urls.add(target)
                continue
            if parts.scheme or parts.netloc:
                errors.append(f'Link não suportado em {path.relative_to(ROOT)}: {target}')
                continue
            local_links += 1
            dest = (path.parent / unquote(parts.path)).resolve() if parts.path else path
            if not dest.is_relative_to(ROOT) or not dest.is_file():
                errors.append(f'Link quebrado em {path.relative_to(ROOT)}: {target}')
            elif parts.fragment and dest.suffix == '.md':
                if unquote(parts.fragment) not in headings(dest.read_text(encoding='utf-8')):
                    errors.append(f'Âncora ausente em {path.relative_to(ROOT)}: {target}')

    required = {f'R{i:02}' for i in range(1, 35)}
    req_text = texts.get(ROOT / 'docs/02-requisitos.md', '')
    declared = re.findall(r'^\| (R\d{2}) \|', req_text, re.M)
    if set(declared) != required or len(declared) != len(required):
        errors.append('Requisitos R01–R34 ausentes, duplicados ou inesperados')
    for name in ('13-backlog.md', '15-qualidade.md'):
        text = texts.get(ROOT / 'docs' / name, '')
        covered = set(re.findall(r'\bR\d{2}\b', text))
        if required - covered:
            errors.append(f'{name}: sem cobertura de {sorted(required - covered)}')
        if covered - required:
            errors.append(f'{name}: requisitos desconhecidos {sorted(covered - required)}')

    backlog = texts.get(ROOT / 'docs/13-backlog.md', '')
    tasks = re.findall(r'^\| (B\d{2}) \|', backlog, re.M)
    if len(tasks) != 20 or set(tasks) != {f'B{i:02}' for i in range(1, 21)}:
        errors.append('Backlog B01–B20 ausente ou duplicado')
    tests = texts.get(ROOT / 'docs/15-qualidade.md', '')
    cases = re.findall(r'^\| (T\d{2}) \|', tests, re.M)
    if len(cases) != 29 or set(cases) != {f'T{i:02}' for i in range(1, 30)}:
        errors.append('Matriz T01–T29 ausente ou duplicada')

    for name, expected_hash in SOURCE_HASHES.items():
        source = ROOT / name
        if not source.is_file() or hashlib.sha256(source.read_bytes()).hexdigest() != expected_hash:
            errors.append(f'{name} difere da fonte original registrada')

    # Identificadores mencionados precisam existir, inclusive dentro das dependências.
    declared_ids = set(declared) | set(tasks) | set(cases)
    for path, text in texts.items():
        mentioned = set(re.findall(r'\b(?:R|B|T)\d{2}\b', text))
        mentioned = {value.strip() for value in mentioned}
        for identifier in mentioned:
            if identifier not in declared_ids:
                errors.append(f'ID desconhecido em {path.relative_to(ROOT)}: {identifier}')

    contrast_check = subprocess.run(
        [sys.executable, str(ROOT / 'scripts/validar_contrastes.py')],
        capture_output=True, text=True, check=False,
    )
    if contrast_check.returncode:
        errors.append('Contrastes: ' + (contrast_check.stdout + contrast_check.stderr).strip())
    else:
        print(contrast_check.stdout.strip())

    print(f'Documentos: {len(files)}')
    print(f'Links locais: {local_links}; URLs externas distintas: {len(external_urls)} (sem verificação de rede)')
    print(f'Requisitos: {len(declared)}; tarefas: {len(tasks)}; cenários: {len(cases)}')
    if errors:
        for error in errors:
            print(f'ERRO: {error}')
        return 1
    print('OK: estrutura, links locais, rastreabilidade, contrastes e hashes das fontes preservados.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
