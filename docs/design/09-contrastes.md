# Contrastes calculados

[Tokens](02-tokens.md) · [Cores canônicas](cores.json)

Cálculo documental de luminância relativa sRGB e razão (Lmaior + 0,05)/(Lmenor + 0,05), sem transparência. Valores arredondados só para apresentação; aprovação usa valor integral. Referência: [W3C](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

Reproduzir: `python3 scripts/validar_contrastes.py`. Regenerar após alteração intencional: `python3 scripts/validar_contrastes.py --write`. O modo padrão não altera arquivos.

## Paleta

| Token | Claro | Escuro |
|---|---|---|
| action | #163C56 | #B9D9F2 |
| actionHover | #0E2B40 | #D4E9F8 |
| border | #6F7D87 | #8395A2 |
| canvas | #F6F5F1 | #101C26 |
| danger | #A12B39 | #FFADB4 |
| divider | #D5DCE1 | #3A5060 |
| focus | #005FCC | #A5D8FF |
| mineral | #245F66 | #9CCFD0 |
| muted | #4E6170 | #B4C1C9 |
| onAction | #FFFFFF | #102436 |
| plum | #654E6C | #D3BDDA |
| raised | #EBEFF2 | #213746 |
| slate | #40556F | #B6C8E1 |
| success | #246147 | #A9D7B8 |
| surface | #FFFFFF | #172936 |
| text | #162D40 | #F1F3F2 |
| warning | #78530E | #E8C67C |

## Pares autorizados

| Tema | Frente | Fundo | Razão | Mínimo | Resultado |
|---|---|---|---|---|---|
| claro | text | canvas | 12.98:1 | 4.5:1 | Passa |
| claro | muted | canvas | 5.89:1 | 4.5:1 | Passa |
| claro | mineral | canvas | 6.63:1 | 4.5:1 | Passa |
| claro | slate | canvas | 7.01:1 | 4.5:1 | Passa |
| claro | plum | canvas | 6.73:1 | 4.5:1 | Passa |
| claro | success | canvas | 6.69:1 | 4.5:1 | Passa |
| claro | warning | canvas | 6.33:1 | 4.5:1 | Passa |
| claro | danger | canvas | 6.59:1 | 4.5:1 | Passa |
| claro | border | canvas | 3.88:1 | 3.0:1 | Passa |
| claro | focus | canvas | 5.49:1 | 3.0:1 | Passa |
| claro | action | canvas | 10.61:1 | 3.0:1 | Passa |
| claro | actionHover | canvas | 13.38:1 | 3.0:1 | Passa |
| claro | text | surface | 14.16:1 | 4.5:1 | Passa |
| claro | muted | surface | 6.43:1 | 4.5:1 | Passa |
| claro | mineral | surface | 7.23:1 | 4.5:1 | Passa |
| claro | slate | surface | 7.64:1 | 4.5:1 | Passa |
| claro | plum | surface | 7.34:1 | 4.5:1 | Passa |
| claro | success | surface | 7.30:1 | 4.5:1 | Passa |
| claro | warning | surface | 6.90:1 | 4.5:1 | Passa |
| claro | danger | surface | 7.19:1 | 4.5:1 | Passa |
| claro | border | surface | 4.23:1 | 3.0:1 | Passa |
| claro | focus | surface | 5.98:1 | 3.0:1 | Passa |
| claro | action | surface | 11.57:1 | 3.0:1 | Passa |
| claro | actionHover | surface | 14.60:1 | 3.0:1 | Passa |
| claro | text | raised | 12.24:1 | 4.5:1 | Passa |
| claro | muted | raised | 5.56:1 | 4.5:1 | Passa |
| claro | mineral | raised | 6.25:1 | 4.5:1 | Passa |
| claro | slate | raised | 6.61:1 | 4.5:1 | Passa |
| claro | plum | raised | 6.35:1 | 4.5:1 | Passa |
| claro | success | raised | 6.32:1 | 4.5:1 | Passa |
| claro | warning | raised | 5.97:1 | 4.5:1 | Passa |
| claro | danger | raised | 6.22:1 | 4.5:1 | Passa |
| claro | border | raised | 3.66:1 | 3.0:1 | Passa |
| claro | focus | raised | 5.18:1 | 3.0:1 | Passa |
| claro | action | raised | 10.01:1 | 3.0:1 | Passa |
| claro | actionHover | raised | 12.63:1 | 3.0:1 | Passa |
| claro | onAction | action | 11.57:1 | 4.5:1 | Passa |
| claro | onAction | actionHover | 14.60:1 | 4.5:1 | Passa |
| escuro | text | canvas | 15.49:1 | 4.5:1 | Passa |
| escuro | muted | canvas | 9.38:1 | 4.5:1 | Passa |
| escuro | mineral | canvas | 10.07:1 | 4.5:1 | Passa |
| escuro | slate | canvas | 10.15:1 | 4.5:1 | Passa |
| escuro | plum | canvas | 9.92:1 | 4.5:1 | Passa |
| escuro | success | canvas | 10.77:1 | 4.5:1 | Passa |
| escuro | warning | canvas | 10.53:1 | 4.5:1 | Passa |
| escuro | danger | canvas | 9.78:1 | 4.5:1 | Passa |
| escuro | border | canvas | 5.58:1 | 3.0:1 | Passa |
| escuro | focus | canvas | 11.40:1 | 3.0:1 | Passa |
| escuro | action | canvas | 11.73:1 | 3.0:1 | Passa |
| escuro | actionHover | canvas | 13.82:1 | 3.0:1 | Passa |
| escuro | text | surface | 13.39:1 | 4.5:1 | Passa |
| escuro | muted | surface | 8.11:1 | 4.5:1 | Passa |
| escuro | mineral | surface | 8.71:1 | 4.5:1 | Passa |
| escuro | slate | surface | 8.77:1 | 4.5:1 | Passa |
| escuro | plum | surface | 8.57:1 | 4.5:1 | Passa |
| escuro | success | surface | 9.31:1 | 4.5:1 | Passa |
| escuro | warning | surface | 9.10:1 | 4.5:1 | Passa |
| escuro | danger | surface | 8.45:1 | 4.5:1 | Passa |
| escuro | border | surface | 4.82:1 | 3.0:1 | Passa |
| escuro | focus | surface | 9.86:1 | 3.0:1 | Passa |
| escuro | action | surface | 10.14:1 | 3.0:1 | Passa |
| escuro | actionHover | surface | 11.95:1 | 3.0:1 | Passa |
| escuro | text | raised | 11.09:1 | 4.5:1 | Passa |
| escuro | muted | raised | 6.71:1 | 4.5:1 | Passa |
| escuro | mineral | raised | 7.21:1 | 4.5:1 | Passa |
| escuro | slate | raised | 7.26:1 | 4.5:1 | Passa |
| escuro | plum | raised | 7.10:1 | 4.5:1 | Passa |
| escuro | success | raised | 7.71:1 | 4.5:1 | Passa |
| escuro | warning | raised | 7.53:1 | 4.5:1 | Passa |
| escuro | danger | raised | 6.99:1 | 4.5:1 | Passa |
| escuro | border | raised | 3.99:1 | 3.0:1 | Passa |
| escuro | focus | raised | 8.16:1 | 3.0:1 | Passa |
| escuro | action | raised | 8.40:1 | 3.0:1 | Passa |
| escuro | actionHover | raised | 9.89:1 | 3.0:1 | Passa |
| escuro | onAction | action | 10.75:1 | 4.5:1 | Passa |
| escuro | onAction | actionHover | 12.66:1 | 4.5:1 | Passa |

## Limites

divider é decorativo e não identifica controles. Cores editoriais/status são aprovadas como texto/ícone nas três superfícies, não como fundos para textos arbitrários. Não aplicar alpha, gradiente ou fotografia aos pares testados. Foco tem offset preenchido pela superfície e não encosta diretamente no botão.

A tabela não mede renderização, antialiasing, contraste em imagens, forced-colors ou estados nativos do navegador. Testes no browser e avaliação manual continuam obrigatórios. Cálculo aprovado não certifica conformidade WCAG da aplicação.
