#!/usr/bin/env python3
"""Publica um título do ../ebooks no Bibliotheon (contrato: docs/03-tecnico.md). Só biblioteca padrão.

    publicar.py publicar <pasta-do-titulo> [--publicar] [--sim] [--adotar] [--amostras]
    publicar.py validar <pasta-do-titulo>        (só mostra as mudanças; não pergunta nem envia)
    publicar.py consultar <pasta-do-titulo>
    publicar.py login

Lê <pasta>/publicacao/bibliotheon/manifest.json. Primeiro pede ao servidor só a lista de mudanças (dry-run), mostra em
português, pergunta e, só então, envia (a capa e as amostras apenas quando mudaram). Sempre entra como rascunho, a não ser
com --publicar. Token em ~/.config/bibliotheon/token (permissão 600) ou na variável BIBLIOTHEON_TOKEN; destino em
BIBLIOTHEON_URL (padrão https://bibliotheon.com.br). Saídas: 0 ok · 1 erro (validação ou servidor) · 2 uso incorreto.
"""
from __future__ import annotations

import getpass
import json
import os
import stat
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

URL = os.environ.get("BIBLIOTHEON_URL", "https://bibliotheon.com.br").rstrip("/")
ARQ_TOKEN = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")) / "bibliotheon" / "token"
USO = __doc__.split("\n\n")[1] if __doc__ else ""


def sair(msg: str, codigo: int = 1):
    print(msg, file=sys.stderr)
    sys.exit(codigo)


def token() -> str:
    t = os.environ.get("BIBLIOTHEON_TOKEN", "").strip()
    if not t and ARQ_TOKEN.is_file():
        t = ARQ_TOKEN.read_text(encoding="utf-8").strip()
    if not t:
        sair("Sem token. Rode `./bibliotheon login` (ou defina BIBLIOTHEON_TOKEN com o API_TOKEN do servidor).")
    return t


def login():
    t = getpass.getpass("Token (o API_TOKEN do servidor; não aparece na tela): ").strip()
    if not t:
        sair("Nada foi salvo.")
    ARQ_TOKEN.parent.mkdir(parents=True, exist_ok=True)
    ARQ_TOKEN.write_text(t + "\n", encoding="utf-8")
    ARQ_TOKEN.chmod(stat.S_IRUSR | stat.S_IWUSR)
    print(f"Token salvo em {ARQ_TOKEN} (só você lê).")


def corpo_multipart(campos: dict[str, str], arquivos: list[tuple[str, str, bytes]]):
    limite = uuid.uuid4().hex
    partes: list[bytes] = []
    for nome, valor in campos.items():
        partes.append(f'--{limite}\r\nContent-Disposition: form-data; name="{nome}"\r\n\r\n'.encode() + valor.encode() + b"\r\n")
    for nome, arquivo, dados in arquivos:
        partes.append(f'--{limite}\r\nContent-Disposition: form-data; name="{nome}"; filename="{arquivo}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode() + dados + b"\r\n")
    partes.append(f"--{limite}--\r\n".encode())
    return b"".join(partes), f"multipart/form-data; boundary={limite}"


def chamar(metodo: str, caminho: str, corpo: bytes | None = None, tipo: str | None = None):
    req = urllib.request.Request(URL + caminho, data=corpo, method=metodo, headers={"Authorization": f"Bearer {token()}"})
    if tipo:
        req.add_header("Content-Type", tipo)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except ValueError:
            return e.code, {"erro": f"Resposta inesperada do servidor (HTTP {e.code})."}
    except urllib.error.URLError as e:
        sair(f"Não consegui falar com {URL}: {e.reason}")


def carregar(pasta: str):
    base = Path(pasta) / "publicacao" / "bibliotheon"
    arq = base / "manifest.json"
    if not arq.is_file():
        sair(f"Não achei {arq}. Gere com `./livro manifesto {pasta}`.")
    texto = arq.read_text(encoding="utf-8")
    try:
        return base, texto, json.loads(texto)
    except ValueError as e:
        sair(f"O manifesto não é um JSON válido: {e}")


def ler(base: Path, nome: str) -> bytes:
    f = base / nome
    if not f.is_file():
        sair(f"Arquivo citado no manifesto não existe: {f}")
    return f.read_bytes()


def mostrar(r: dict):
    for m in r.get("mudancas") or []:
        print(f"  • {m}")
    for a in r.get("avisos") or []:
        print(f"  ! {a}")


def erro_do_servidor(codigo: int, r: dict):
    print(f"Recusado pelo servidor (HTTP {codigo}): {r.get('erro', 'erro desconhecido')}", file=sys.stderr)
    for d in r.get("detalhes") or []:
        print(f"  - {d}", file=sys.stderr)
    sys.exit(1)


def publicar(pasta: str, flags: set[str], so_validar: bool = False):
    base, texto, m = carregar(pasta)
    consulta = {k: "1" for k, f in (("adotar", "--adotar"), ("amostras", "--amostras")) if f in flags}

    # 1) Só as mudanças, sem gravar nada
    corpo, tipo = corpo_multipart({"manifest": texto}, [])
    codigo, r = chamar("POST", "/api/v1/ebooks?" + urllib.parse.urlencode({**consulta, "dryRun": "1"}), corpo, tipo)
    if codigo != 200:
        erro_do_servidor(codigo, r)
    titulo = m.get("book", {}).get("title", pasta)
    print(f"{'Novo e-book' if r['acao'] == 'criar' else 'Atualização'}: {titulo} → {URL}/{r['slug']}")
    if not r["mudancas"] and all(r[k] == "igual" for k in ("capa", "amostras", "amostraPdf")) and "--publicar" not in flags:
        print("Nenhuma mudança.")
        for a in r.get("avisos") or []:
            print(f"  ! {a}")
        return
    mostrar(r)
    if so_validar:
        print("Validado no servidor. Nada foi gravado.")
        return
    if "--sim" not in flags:
        if input("Enviar? [s/N] ").strip().lower() not in ("s", "sim", "y", "yes"):
            print("Nada foi enviado.")
            return

    # 2) Envio: só os arquivos que o servidor pediu
    arquivos: list[tuple[str, str, bytes]] = []
    if r["capa"] == "enviar":
        arquivos.append(("capa", m["cover"]["file"], ler(base, m["cover"]["file"])))
    if r["amostras"] == "enviar":
        for s in m.get("samples") or []:
            nome = s if isinstance(s, str) else s["file"]
            arquivos.append(("amostras", nome, ler(base, nome)))
    if r["amostraPdf"] == "enviar" and m.get("samplePdf"):
        arquivos.append(("amostraPdf", m["samplePdf"], ler(base, m["samplePdf"])))
    if "--publicar" in flags:
        consulta["publicar"] = "1"
    corpo, tipo = corpo_multipart({"manifest": texto}, arquivos)
    codigo, r = chamar("POST", "/api/v1/ebooks?" + urllib.parse.urlencode(consulta), corpo, tipo)
    if codigo != 200:
        erro_do_servidor(codigo, r)
    print(f"✓ {'Publicado' if r['status'] == 'publicado' else 'Salvo como rascunho'}: {r['url']}")
    if r["status"] != "publicado" and r.get("previewUrl"):
        print(f"  Prévia (entre no painel): {r['previewUrl']}")


def consultar(pasta: str):
    _, _, m = carregar(pasta)
    codigo, r = chamar("GET", f"/api/v1/ebooks/{urllib.parse.quote(m['sourceId'])}?" + urllib.parse.urlencode({"idioma": m.get("language", "pt-BR")}))
    if codigo == 404:
        print("Ainda não existe no Bibliotheon.")
        return
    if codigo != 200:
        erro_do_servidor(codigo, r)
    print(f"{r['slug']}: {r['status']} · {r['url']} · atualizado em {r['atualizadoEm']}")
    for o in r.get("ofertas") or []:
        print(f"  - {o['plataforma']}{' (principal)' if o['principal'] else ''}{'' if o['ativa'] else ' [inativa]'}{' · campanha' if o['temLinkDaCampanha'] else ''}")


def main(argv: list[str]):
    if not argv or argv[0] in ("-h", "--help"):
        print(USO)
        return
    cmd, resto = argv[0], argv[1:]
    flags = {a for a in resto if a.startswith("--")}
    posicionais = [a for a in resto if not a.startswith("--")]
    validas = {"--publicar", "--sim", "--adotar", "--amostras"}
    if flags - validas:
        sair(f"Opção desconhecida: {', '.join(sorted(flags - validas))}\n{USO}", 2)
    if cmd == "login" and not resto:
        login()
    elif cmd in ("publicar", "validar", "consultar") and len(posicionais) == 1:
        if cmd == "consultar":
            consultar(posicionais[0])
        else:
            publicar(posicionais[0], flags, so_validar=cmd == "validar")
    else:
        sair(USO, 2)


if __name__ == "__main__":
    main(sys.argv[1:])
