#!/usr/bin/env python3
"""Gera, a partir de falas/falas.json (rivais), falas/narrador.json e falas/comentarista.json:
  - falas/roteiro-gravacao.md: o roteiro para quem vai gravar;
  - js/falas-dados.js: as falas para o jogo (o jogo abre direto do arquivo, sem servidor,
    e o navegador não deixa ler o JSON; por isso os dados vão num .js).

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


def comentarista(d):
    l = ['---', '', f'## Comentarista: {d["nome"]}', '', f'*{d["perfil"]}*', '',
         'Pode ser um pouco mais longo que o narrador (até ~2,5 s), mas sem arrastar.', '',
         f'Arquivos em `{d["audio"]["pasta"]}/`.', '']
    for ev, e in d['eventos'].items():
        l += [f'### {ev}: {e["quando"]}', ''] + tabela(e['falas']['geral'])
    return l


def main():
    with open(os.path.join(PASTA, 'falas.json'), encoding='utf-8') as f:
        falas = json.load(f)
    with open(os.path.join(PASTA, 'narrador.json'), encoding='utf-8') as f:
        narr = json.load(f)
    with open(os.path.join(PASTA, 'comentarista.json'), encoding='utf-8') as f:
        coment = json.load(f)
    l = ['# Roteiro de gravação: rivais, narrador e comentarista', '',
         'Para a pessoa que vai gravar. Cada linha vira um arquivo de áudio **com o nome indicado**.',
         'Grave em ambiente silencioso, uma fala por arquivo, sem silêncio sobrando no começo e no fim.',
         'Formato: MP3 (ou WAV, que convertemos), mono. Cada fala deve durar até ~1,5 s: fale com energia, sem arrastar.', '']
    l += rivais(falas) + narrador(narr) + comentarista(coment)
    with open(os.path.join(PASTA, 'roteiro-gravacao.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(l))
    dados = lambda d: json.dumps(d, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(RAIZ, 'js', 'falas-dados.js'), 'w', encoding='utf-8') as f:
        f.write('// Gerado por ferramentas/gerar-roteiro.py a partir de falas/falas.json, narrador.json e comentarista.json.\n'
                '// Não edite à mão: mude os JSONs e rode o script de novo.\n'
                f'const FALAS = {dados(falas)};\n'
                f'const NARRADOR = {dados(narr)};\n'
                f'const COMENTARISTA = {dados(coment)};\n'
                "if (typeof module !== 'undefined') module.exports = { FALAS, NARRADOR, COMENTARISTA };\n")
    total = (sum(len(x) for r in falas['rivais'].values() for e in r['falas'].values() for x in e.values())
             + sum(len(x) for d in (narr, coment) for e in d['eventos'].values() for x in e['falas'].values()))
    print(f'roteiro-gravacao.md e js/falas-dados.js: {total} falas')


if __name__ == '__main__':
    main()
