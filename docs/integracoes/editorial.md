# Integração editorial — ebooks → Bibliotheon

## Responsabilidades e estado

O projeto `ebooks` cria/revisa os livros e prepara textos comerciais. O Bibliotheon recebe somente o cadastro público e ofertas confirmadas, por importação owner revisada. IA continua fora do produto. Checkout e entrega pagos permanecem externos em Hotmart, Kiwify e Cakto. Não há envio de PDF/EPUB, cadastro em plataformas, campanhas ou deploy automático.

Implementação local com contrato `bibliotheon-editorial/v1`. O site público respondeu HTTPS/200 durante o planejamento; isso não comprova versão, API nova, acesso owner ou homologação remota. Implantação desta versão/migration pelo proprietário e primeira publicação real continuam pendentes.

## Uso

No projeto editorial, depois de o agente preparar o manifesto e a capa:

```bash
./bibliotheon validar ebooks/001-sistemas-com-ia
./bibliotheon preparar ebooks/001-sistemas-com-ia
./bibliotheon publicar ebooks/001-sistemas-com-ia
# Se a conexão cair durante a confirmação:
./bibliotheon consultar ebooks/001-sistemas-com-ia
```

`validar` é opcional e não abre rede: confere estrutura/hash. `preparar` consulta a API autenticada e produz `.local/preview.html` e `.local/preview.json` dentro do pacote, sem escrita no catálogo ou upload. Abra o HTML local para revisar conteúdo resultante, diferenças e bloqueios. Esta prévia não reproduz o layout final do site e não substitui QA visual. `publicar` confirma exatamente essa revisão; consulta recibo primeiro e só envia se necessário. Recibo local em `.local/receipt.json`. Resultado incerto mantém a prévia; `consultar` ou repetir `publicar` usa a mesma operação. Não gerar nova prévia para contornar resultado incerto.

Destino padrão `https://bibliotheon.com.br`; `BIBLIOTHEON_URL` permite outro destino HTTPS ou HTTP loopback de testes. Caminho do cliente em `BIBLIOTHEON_CLIENT_DIR`, por padrão pasta irmã `bibliotheon`. Node 22 e dependências já instaladas no Bibliotheon; o projeto editorial não ganha instalação própria. Nenhum comando instala dependências ou inicia servidores. Credenciais são digitadas em terminal privado, senha oculta e JWT somente na memória do processo. Cada comando remoto pede login; não enviar senha no chat, em argumentos ou em arquivos. Login continua sujeito ao bloqueio de tentativas do Payload.

## Pacote v1

Pasta por título: `publicacao/bibliotheon/manifest.json` e uma imagem `capa.jpg`, `capa.png` ou `capa.webp`. O [exemplo](../templates/editorial-manifest.example.json) é sintético e deve ser preenchido pelo agente com dados conferidos. A capa precisa existir dentro do pacote, até 5 MiB, extensão/MIME compatíveis e SHA-256 do arquivo original. O servidor revalida e converte a imagem pelo fluxo atual do Payload.

- `contract`, `sourceId`, `language`, `edition`: versão do contrato e identidade editorial estável. Não reutilizar sourceId para outro título. Idioma participa da identidade; edição não cria outro livro.
- `book`: campos editoriais atuais. `theme` é slug de tema já publicado. `body` é texto simples, convertido em parágrafos Lexical; não HTML/Markdown. `benefits` e `contents` são listas de textos; FAQ usa question/answer; SEO usa title/description. `materialState` precisa ser ready; apresentação/acento devem usar enums atuais.
- `cover`: nome relativo simples, `sha256` e `alt`. Arquivos pagos e documentos internos não são aceitos.
- `offers`: lista opcional, cada oferta com `key` estável, nome, provedor, conta, IDs e moeda BRL; active/primary explícitos. Preço inteiro em centavos. Ativar exige checkout permitido na configuração do servidor, preço, data passada de verificação e nota de elegibilidade/entrega efetivamente conferidas. Não preencher verificação por inferência. Preços propostos não são valores aprovados.
- `pending`: bloqueios editoriais/comerciais desta publicação, como tema não confirmado ou falta de dados da oferta desejada. Lista não vazia impede confirmação. Se o objetivo for apenas publicar a página sem ofertas, registrar essa decisão e remover somente pendências que deixaram de ser aplicáveis.
- `associateEbookId`: associação explícita de origem a livro existente. Colisão de slug não cria associação automática. A primeira associação compara todos os campos divergentes como conflitos. Ofertas legadas não são adotadas automaticamente; manter seu cadastro no painel e omiti-las do pacote.
- `resolutions`: escolhas por campo apresentadas pela prévia, por exemplo `"book.title": "remote"` ou `"offers.hotmart.priceCents": "package"`. Resolver no manifesto e executar preparar novamente. Revisar/remover resoluções após o uso para não reutilizar escolhas antigas inadvertidamente.

Campos omitidos preservam valores remotos; listas são comparadas como um campo inteiro. Não apagar ofertas por omissão. Para desativar uma oferta previamente importada, enviar sua key com active=false. Identidade comercial de oferta existente não pode ser trocada por esta integração: nova identidade exige nova key. Slug pode mudar respeitando redirects históricos.

## Consistência, API e dados

`POST /api/v1/admin/editorial/preview`, `/publish` e `/receipt` exigem owner autenticado e Origin exata. Prévia/confirmação recebem JSON `{manifest, cover}` com imagem base64; confirmação acrescenta token da prévia. Consulta recebe `{token}`. Limite 8 MiB, manifesto 256 KiB; corpo lido com prazo/limite. Respostas privadas sem cache. Não há endpoint público de escrita nem segredo adicional.

Prévia assinada vincula owner, hash do pacote, estado remoto e expiração de 24 horas. Confirmação revalida sob transação/locks. Mudança remota ou do pacote retorna 409; bloqueios retornam 422; 503/queda de rede exige consulta do recibo. Recibos de operações concluídas podem ser recuperados depois da expiração da prévia, mediante autenticação.

Migration `20261029_010000_editorial_imports` acrescenta duas tabelas internas SQL, sem exposição pelo REST genérico do Payload: `editorial_links` (origem/idioma único, livro único, base importada, associação de ofertas e capa) e `editorial_operations` (identidade da confirmação, owner e recibo mínimo). Não há dados de comprador. São tabelas controladas pela migration, fora do schema gerenciado por coleções; não usar schema push. Futuras migrations não devem removê-las ao interpretar tabelas desconhecidas. Down recusa vínculos existentes para não perder histórico.

Comparação entre último pacote, painel e novo pacote preserva edições exclusivas do painel e bloqueia conflitos simultâneos. Todas as alterações de cadastro e recibo confirmam juntas. Arquivos escritos antes de rollback podem sobrar fisicamente: a limpeza existente `media:gc` trata órfãos com grace period e lock compartilhado; não apagar arquivos manualmente. Capas já referenciadas permanecem preservadas.

## Testes e implantação

[Resultados sintéticos](../../artifacts/editorial/local-results.json). Suíte isolada cria banco temporário, aplica migrations e o remove ao terminar; mídia fica em diretório temporário. O banco de desenvolvimento e a VPS são preservados.

```bash
npm run check
BIBLIOTHEON_SYNTHETIC_TESTS=true npm run check:editorial
```

Depois do release local, o proprietário implanta conforme [deploy](../../deploy.md), com a migration nova e as rotas. Proxy precisa aceitar JSON de até 8 MiB para as três rotas, mantendo demais limites e serviços. Primeiro testar preparar, conferir contrato, pendências e diferença contra o cadastro real; publicar somente pela confirmação explícita. Nunca repetir cadastro porque a consulta pública falhou após um recibo confirmado.

Autenticação reutiliza a implementação fixada do Payload. Referências oficiais consultadas durante implementação: [Local API](https://payloadcms.com/docs/local-api/overview), [autenticação/token](https://payloadcms.com/docs/authentication/token-data). Não há integração nova com APIs dos provedores nesta etapa.
