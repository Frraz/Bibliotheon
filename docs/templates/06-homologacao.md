# Modelo — Homologação e release

[Modelos](README.md)

Data, responsável, ambiente:
Versões/digest/schema:
Item Bxx e requisitos Rxx:
Provedor/contrato/versão, quando aplicável:

| Cenário Txx | Entrada sintética | Resultado esperado | Resultado observado | Evidência |
|---|---|---|---|---|
| | | | Não executado | |

## Conector

- [ ] Autenticação confirmada na fonte atual e conta.
- [ ] ID/evento/tempo/valores mapeados.
- [ ] Duplicata, ordem invertida, reversão e evento desconhecido.
- [ ] Falha de banco e retomada sem perda silenciosa.
- [ ] Relatório reconciliado e atribuição testada separadamente.
- [ ] Sem comprador, segredo ou corpo real persistido como fixture/log.

## Revisão visual quando houver frontend

- [ ] Temas claro/escuro e preferência sistema, inclusive reload/storage indisponível.
- [ ] 360/390/768/1024/1440/1920px e reflow/zoom adicional.
- [ ] Teclado, foco, estados de erro/loading e reduced-motion.
- [ ] Capas íntegras, títulos longos, catálogo pequeno e CTA disponível.
- [ ] Screenshots e limitações por tela, sem dados pessoais reais.

## Infraestrutura

- [ ] Baseline dos serviços existentes registrado e preservado.
- [ ] HTTPS, DNS, portas e acesso administrativo verificados.
- [ ] Backup remoto e restauração com duração registrada.
- [ ] Rollback e recuperação de eventos definidos.

Conclusão: passou / falhou / bloqueado.
Limitações e dependências:
Próxima ação:

Separar teste local, evento oficial de teste, compra controlada e operação real. Não marcar teste não executado como aprovado.
