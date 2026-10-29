"""Drive synthetic publication wizard in a PTY; no real credentials."""
import os
import pty
import select
import subprocess
import sys
import time

questions = [
    ('E-mail:', 'editorial@example.invalid'),
    ('Senha (oculta):', 'synthetic-password-12345'),
    ('Tema:', '1'),
    ('Preparar um novo cadastro deste livro?', 's'),
    ('Escolha:', '1'),
    ('Salvar estas escolhas no pacote e preparar a prévia?', 's'),
    ('Se já revisou e deseja publicar agora, digite PUBLICAR;', 'PUBLICAR'),
]
master, slave = pty.openpty()
child = subprocess.Popen(['node', '--import', 'tsx', 'scripts/editorial.ts', 'assistir', sys.argv[1]], stdin=slave, stdout=slave, stderr=slave)
os.close(slave)
output = b''
index = consumed = 0
try:
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        if select.select([master], [], [], 0.1)[0]:
            try:
                chunk = os.read(master, 65536)
            except OSError:
                break
            if not chunk:
                break
            output += chunk
            if index < len(questions):
                prompt, answer = questions[index]
                needle = prompt.encode()
                position = output.find(needle, consumed)
                if position >= 0:
                    os.write(master, answer.encode() + b'\n')
                    consumed = position + len(needle)
                    index += 1
        if child.poll() is not None:
            break
    child.wait(timeout=5)
    if b'synthetic-password-12345' in output:
        raise RuntimeError('Password leaked')
    if child.returncode or index != len(questions) or b'Publicado:' not in output:
        raise RuntimeError('Wizard failed: ' + output.decode(errors='replace'))
finally:
    os.close(master)
    if child.poll() is None:
        child.kill()
    child.wait()
