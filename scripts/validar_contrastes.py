#!/usr/bin/env python3
"""Calcula pares autorizados sRGB; --write atualiza somente o relatório documental."""
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
KEYS = {'canvas','surface','raised','text','muted','border','divider','action','actionHover','onAction','focus','mineral','slate','plum','success','warning','danger'}


def luminance(hex_color):
    channels = [int(hex_color[i:i+2], 16) / 255 for i in (1,3,5)]
    linear = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in channels]
    return sum(v*w for v,w in zip(linear,(0.2126,0.7152,0.0722)))


def contrast(a,b):
    high,low=sorted((luminance(a),luminance(b)),reverse=True)
    return (high+0.05)/(low+0.05)


def evaluate():
    data=json.loads((ROOT/'docs/design/cores.json').read_text())
    if set(data['themes']) != {'claro','escuro'}:
        raise ValueError('Devem existir exatamente os temas claro e escuro')
    pairs=[]
    for theme, colors in data['themes'].items():
        if set(colors) != KEYS or not all(re.fullmatch(r'#[0-9A-Fa-f]{6}',v) for v in colors.values()):
            raise ValueError(f'Tokens incompletos ou inválidos: {theme}')
        for bg in ('canvas','surface','raised'):
            for fg in ('text','muted','mineral','slate','plum','success','warning','danger'):
                pairs.append((theme,fg,bg,contrast(colors[fg],colors[bg]),4.5))
            for fg in ('border','focus','action','actionHover'):
                pairs.append((theme,fg,bg,contrast(colors[fg],colors[bg]),3.0))
        for bg in ('action','actionHover'):
            pairs.append((theme,'onAction',bg,contrast(colors['onAction'],colors[bg]),4.5))
    return data,pairs


def report(data,pairs):
    out=['# Contrastes calculados', '', '[Tokens](02-tokens.md) · [Cores canônicas](cores.json)', '',
         'Cálculo documental de luminância relativa sRGB e razão (Lmaior + 0,05)/(Lmenor + 0,05), sem transparência. Valores arredondados só para apresentação; aprovação usa valor integral. Referência: [W3C](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).', '',
         'Reproduzir: `python3 scripts/validar_contrastes.py`. Regenerar após alteração intencional: `python3 scripts/validar_contrastes.py --write`. O modo padrão não altera arquivos.', '',
         '## Paleta', '', '| Token | Claro | Escuro |','|---|---|---|']
    for key in sorted(KEYS):
        out.append(f"| {key} | {data['themes']['claro'][key]} | {data['themes']['escuro'][key]} |")
    out+=['','## Pares autorizados','','| Tema | Frente | Fundo | Razão | Mínimo | Resultado |','|---|---|---|---|---|---|']
    for theme,fg,bg,value,minimum in pairs:
        out.append(f'| {theme} | {fg} | {bg} | {value:.2f}:1 | {minimum:.1f}:1 | {"Passa" if value >= minimum else "FALHA"} |')
    out+=['','## Limites','',
          'divider é decorativo e não identifica controles. Cores editoriais/status são aprovadas como texto/ícone nas três superfícies, não como fundos para textos arbitrários. Não aplicar alpha, gradiente ou fotografia aos pares testados. Foco tem offset preenchido pela superfície e não encosta diretamente no botão.', '',
          'A tabela não mede renderização, antialiasing, contraste em imagens, forced-colors ou estados nativos do navegador. Testes no browser e avaliação manual continuam obrigatórios. Cálculo aprovado não certifica conformidade WCAG da aplicação.']
    return '\n'.join(out)+'\n'


def main():
    if sys.argv[1:] not in ([],['--write']):
        print('Uso: validar_contrastes.py [--write]');return 2
    try: data,pairs=evaluate()
    except (ValueError,KeyError,TypeError,OSError) as e:
        print(f'ERRO: {e}');return 1
    failures=[p for p in pairs if p[3]<p[4]]
    if failures:
        for theme,fg,bg,value,minimum in failures:
            print(f'FALHA: {theme} {fg}/{bg}: {value:.4f} < {minimum}')
        return 1
    expected=report(data,pairs)
    path=ROOT/'docs/design/09-contrastes.md'
    if '--write' in sys.argv: path.write_text(expected)
    elif not path.exists() or path.read_text()!=expected:
        print('ERRO: relatório ausente/desatualizado; revisar e usar --write');return 1
    print(f'OK: {len(pairs)} pares autorizados aprovados, dois temas; relatório consistente.')
    return 0


if __name__=='__main__': sys.exit(main())
