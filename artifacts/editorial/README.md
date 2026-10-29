# Integração editorial — evidências locais

Implementação iniciada em 28/10/2026 e conferência final em 29/10/2026.

- [Suíte sintética](local-results.json): 11 grupos em banco exclusivo criado e removido pelo harness; migrations, autenticação/origem HTTP, prévia sem escrita, stale/conflicts, concorrência, três provedores, falha após upload/rollback, capas/temas manuais e cliente real por HTTP/PTY. Login sintético com senha oculta, prévia HTML, confirmação, repetição e recuperação de recibo. O servidor do teste usa os handlers da aplicação; não é a VPS.
- [Preservação editorial](ebooks-preservation.json): 420 arquivos de entrega/exportação/produção do primeiro título preservados por SHA-256. Pacote adicional separado, com três pendências explícitas. 63 links relativos conferidos nos Markdown alterados do projeto ebooks.
- `validar` foi executado sobre o pacote real pelo lançador instalado em ebooks: contrato/hash válidos; três pendências, sem chamada remota.
- Testes não comprovam layout renderizado, execução de CI no GitHub, cadastro/entrega em plataformas ou publicação remota. Nenhuma credencial real, payload de comprador ou login remoto foi utilizado.

Reprodução: `BIBLIOTHEON_SYNTHETIC_TESTS=true npm run check:editorial`, com PostgreSQL local disponível. O harness recusa host não loopback e usa somente banco com nome temporário gerado. Para uso do produto, consultar [operação](../../docs/integracoes/editorial.md).

## Conferência final

[Registro de verificações e hashes](verification.json): tipos/lint aprovados, 320 unitários em 38 arquivos com `--maxWorkers=2`, 62 testes operacionais, 11 grupos editoriais, build Next e CLIs aprovados. No paralelismo padrão, o teste antigo de stress CSV excedeu 5 segundos; passou isolado e na suíte completa com dois workers. O simulador PTY foi corrigido para aguardar a coleta do processo depois do fechamento do terminal; suíte final aprovada. Diretórios gerados `.next-*` foram excluídos do lint. Configurações de caminhos alteradas pelo build temporário foram restauradas. Nenhuma configuração da VPS foi alterada.
