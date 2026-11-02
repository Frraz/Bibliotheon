#!/usr/bin/env bash
# Backup do banco (consistente, mesmo com o site no ar) e da mídia. Mantém 14 diários + 8 semanais.
# Cron sugerido (30 3 * * *):  cd /var/www/docker-instances/Bibliotheon && ./deploy/backup.sh
set -euo pipefail
cd "$(dirname "$0")/.."

DESTINO="${BACKUP_DIR:-data/backups}"
HOJE="$(date +%F)"
mkdir -p "$DESTINO/diario" "$DESTINO/semanal"

if [ -f data/bibliotheon.db ]; then
  # VACUUM INTO gera uma cópia consistente do SQLite (inclusive com WAL), sem parar o site.
  # O dump é feito em /tmp dentro do container (o usuário do container não escreve na pasta do host) e copiado para fora.
  if docker exec bibliotheon_web sh -c "rm -f /tmp/backup.db" 2>/dev/null \
     && docker exec bibliotheon_web node -e "
          const D=require('better-sqlite3');
          const d=new D('/app/data/bibliotheon.db',{readonly:true});
          d.exec(\"VACUUM INTO '/tmp/backup.db'\");
        " \
     && docker cp bibliotheon_web:/tmp/backup.db "$DESTINO/diario/db-$HOJE.db"; then
    docker exec bibliotheon_web rm -f /tmp/backup.db || true
  else
    # container parado: copia direto (sem tráfego, é seguro)
    cp data/bibliotheon.db "$DESTINO/diario/db-$HOJE.db"
  fi
fi

# Mídia: arquivo único por dia (as imagens têm nome com hash, então o tar é pequeno e idempotente)
[ -d data/media ] && tar czf "$DESTINO/diario/media-$HOJE.tgz" -C data media

# Semanal (domingo)
if [ "$(date +%u)" = 7 ]; then
  cp "$DESTINO/diario/db-$HOJE.db" "$DESTINO/semanal/" 2>/dev/null || true
  cp "$DESTINO/diario/media-$HOJE.tgz" "$DESTINO/semanal/" 2>/dev/null || true
fi

# Retenção
find "$DESTINO/diario"  -type f -mtime +14 -delete
find "$DESTINO/semanal" -type f -mtime +56 -delete
echo "✓ Backup de $HOJE em $DESTINO"
