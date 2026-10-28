#!/usr/bin/env python3
"""Gera falas/roteiro-gravacao.md a partir de falas/falas.json (rivais) e falas/narrador.json.

Uso: python3 ferramentas/gerar-roteiro.py
Rode de novo sempre que mudar uma fala nos JSONs.
"""
import json
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASTA = os.path.join(RAIZ, 'falas')
NIVEL = {'facil': 'Fácil', 'dificil': 'Difícil'}


def tabela(falas):
    return ['| Arquivo | Fala |', '|---|---|'] + [f'| `{f["audio"]}` | {f["texto"]} |' for f in falas] + ['']


def rivais(d):
    l = []
    for rid, r in d['rivais'].items():
        l += [f'## {r["nome"]} ({NIVEL[r["nivel"]]})', '', f'*{r["perfil"]}*', '',
              f'Arquivos em `{d["audio"]["pasta"]}/`.', '']
        for ex, sits in r['falas'].items():
            l += [f'### {ex.capitalize()}: {d["expressoes"][ex]}', '']
            for sit, falas in sits.items():
                l += [f'**{sit.capitalize()}** ({d["situacoes"][sit]})', ''] + tabela(falas)
    return l


def narrador(d):
    l = ['---', '', '## Narrador', '',
         '*Locutor esportivo da feira. Empolgado, rápido, com bordões de transmissão. Fala com o jogador ("você")'
         ' e chama o adversário de "o rival" ou "a banca rival".*', '',
         f'Arquivos em `{d["audio"]["pasta"]}/`.', '']
    for ev, e in d['eventos'].items():
        l += [f'### {ev}: {e["quando"]}', '']
        for g, falas in e['falas'].items():
            if g != 'geral':
                l += [f'**{g.capitalize()}**', '']
            l += tabela(falas)
    return l


def main():
    with open(os.path.join(PASTA, 'falas.json'), encoding='utf-8') as f:
        falas = json.load(f)
    with open(os.path.join(PASTA, 'narrador.json'), encoding='utf-8') as f:
        narr = json.load(f)
    l = ['# Roteiro de gravação: rivais e narrador', '',
         'Para a pessoa que vai gravar. Cada linha vira um arquivo de áudio **com o nome indicado**.',
         'Grave em ambiente silencioso, uma fala por arquivo, sem silêncio sobrando no começo e no fim.',
         'Formato: MP3 (ou WAV, que convertemos), mono. Cada fala deve durar até ~1,5 s: fale com energia, sem arrastar.', '']
    l += rivais(falas) + narrador(narr)
    with open(os.path.join(PASTA, 'roteiro-gravacao.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(l))
    total = (sum(len(x) for r in falas['rivais'].values() for e in r['falas'].values() for x in e.values())
             + sum(len(x) for e in narr['eventos'].values() for x in e['falas'].values()))
    print(f'roteiro-gravacao.md: {total} falas')


if __name__ == '__main__':
    main()
