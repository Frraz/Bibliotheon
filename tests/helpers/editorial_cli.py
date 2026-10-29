"""PTY driver with synthetic credentials only; never accepts real credentials."""
import os
import pty
import select
import subprocess
import sys
import time

master, slave = pty.openpty()
child = subprocess.Popen(['node', '--import', 'tsx', 'scripts/editorial.ts', *sys.argv[1:]], stdin=slave, stdout=slave, stderr=slave, close_fds=True)
os.close(slave)
output = b''
sent_email = sent_password = False
try:
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        if select.select([master], [], [], 0.1)[0]:
            try:
                chunk = os.read(master, 65536)
            except OSError:
                break
            if not chunk:
                break
            output += chunk
            if not sent_email and b'E-mail:' in output:
                os.write(master, b'editorial@example.invalid\n')
                sent_email = True
            if not sent_password and b'Senha (oculta):' in output:
                os.write(master, b'synthetic-password-12345\n')
                sent_password = True
        if child.poll() is not None:
            break
    # PTY can close a few milliseconds before waitpid exposes the exit status.
    try:
        child.wait(timeout=max(1, min(5, deadline - time.monotonic())))
    except subprocess.TimeoutExpired:
        child.kill()
        raise RuntimeError(f'CLI não encerrou: {sys.argv[1]}, email={sent_email}, senha={sent_password}.')
    if b'synthetic-password-12345' in output:
        raise RuntimeError('CLI expôs senha sintética.')
    if child.returncode:
        raise RuntimeError('CLI falhou: ' + output.decode(errors='replace'))
finally:
    os.close(master)
    if child.poll() is None:
        child.kill()
    child.wait()
