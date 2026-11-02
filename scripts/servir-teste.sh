#!/usr/bin/env bash
# Sobe o site como ele vai para produção (build standalone) com um banco temporário e o título de teste.
# Usado pelo Playwright (npm run test:e2e). Porta 3101.
set -euo pipefail
cd "$(dirname "$0")/.."
PORTA=3101
E2E=".e2e"

export SITE_URL="http://127.0.0.1:$PORTA"
export API_TOKEN="token-de-teste"
export BETTER_AUTH_SECRET="segredo-so-para-o-teste-e2e-0123456789abcdef"
DATABASE_PATH=:memory: npm run build >/dev/null

rm -rf "$E2E" && mkdir -p "$E2E/app/.next" "$E2E/data"
cp -r .next/standalone/. "$E2E/app/"
cp -r .next/static "$E2E/app/.next/static"
cp -r public drizzle "$E2E/app/"

export DATABASE_PATH="$PWD/$E2E/data/bibliotheon.db" MEDIA_DIR="$PWD/$E2E/data/media"
npx tsx scripts/seed.ts e2e/fixtures/titulo-teste --publicar >/dev/null
# O administrador do teste nasce pelo mesmo script que vai ao servidor; a senha gerada fica num arquivo para o Playwright ler.
node scripts/criar-owner.mjs dono@teste.com "Dona Teste" | sed -n 's/^Senha temporária.*: //p' > "$E2E/senha-owner.txt"

cd "$E2E/app"
PORT=$PORTA HOSTNAME=127.0.0.1 exec node server.js
