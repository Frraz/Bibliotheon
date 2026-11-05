#!/usr/bin/env bash
# Confere, só lendo, se a página e o botão de compra de um e-book mostram o mesmo preço e o mesmo prazo.
# Use antes e depois do fim de uma campanha. O /ir é chamado com curl, que o servidor trata como robô e NÃO conta como clique.
# Uso: ./deploy/conferir-virada.sh [slug] [url-base]    (padrão: criar-sistemas-com-ia, https://bibliotheon.com.br)
set -uo pipefail
SLUG="${1:-criar-sistemas-com-ia}"
BASE="${2:-https://bibliotheon.com.br}"

html="$(curl -fsS -m 20 "$BASE/$SLUG")" || { echo "✗ $BASE/$SLUG não respondeu"; exit 1; }

# Os dados do servidor vêm escapados dentro do HTML (\"preco\":2499); o JSON-LD traz price e priceValidUntil.
dado() { printf '%s' "$html" | grep -oE "$1" | head -1 | sed -E 's/^[^:]*:\\?"?//; s/\\?"?$//'; }
centavos="$(dado '\\"preco\\":[0-9]+')"
de="$(dado '\\"precoDe\\":[0-9]+')"
ate="$(dado '\\"ofertaAte\\":\\"[^\\]+')"
nome="$(dado '\\"ofertaNome\\":\\"[^\\]+')"
vigente="$(printf '%s' "$html" | grep -oE '"price":"?[0-9.]+' | head -1 | grep -oE '[0-9.]+$')"
valido="$(printf '%s' "$html" | grep -oE '"priceValidUntil":"[^"]+' | head -1 | sed 's/.*"//')"
riscado="$(printf '%s' "$html" | grep -c '<s>')"

echo "Página $BASE/$SLUG"
echo "  preço cadastrado ..... ${centavos:-?} centavos (campanha ou normal)"
echo "  preço 'de' ........... ${de:-nenhum}"
echo "  prazo (UTC) .......... ${ate:-nenhum}"
echo "  nome da faixa ........ ${nome:-nenhum}"
echo "  JSON-LD: preço ....... ${vigente:-?}   válido até ${valido:-nenhum}"
echo "  'de' riscado na tela . $([ "$riscado" -gt 0 ] && echo sim || echo não)"

# Cada loja: aonde o /ir leva agora (só host e caminho; a query do checkout não é mostrada).
for id in $(printf '%s' "$html" | grep -oE '/ir/[0-9a-f-]{36}' | sort -u); do
  destino="$(curl -s -m 20 -o /dev/null -w '%{redirect_url}' -A 'curl-conferir-virada' "$BASE$id")"
  echo "  $id → $(printf '%s' "$destino" | sed -E 's/[?#].*//')"
done

# Cruzamento simples: campanha vencida não pode aparecer como vigente.
if [ -n "$ate" ] && [ "$(date -u +%s)" -gt "$(date -u -d "$ate" +%s 2>/dev/null || echo 9999999999)" ]; then
  echo "! O prazo ($ate) já passou. Quem é o 'preço vigente' deve ser o normal; confira o valor no checkout acima."
fi
