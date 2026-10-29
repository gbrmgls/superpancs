#!/usr/bin/env python3
"""Gera falas/roteiro-gravacao.pdf: o roteiro para quem vai gravar, com todas as falas
(narrador, Tião da Xepa e rivais), o nome de arquivo de cada uma e uma caixinha para marcar.

Usa os JSONs de falas/ e o Google Chrome (modo headless) para imprimir o PDF.
Uso: python3 ferramentas/gerar-pdf-roteiro.py
Rode de novo sempre que mudar uma fala nos JSONs.
"""
import html
import json
import os
import subprocess
import sys
import tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASTA = os.path.join(RAIZ, 'falas')
SAIDA = os.path.join(PASTA, 'roteiro-gravacao.pdf')
NOME_GRUPO = {'proteina': 'Proteína', 'carboidrato': 'Carboidrato', 'fibras': 'Fibras', 'calorias': 'Calorias'}
DIRECAO_NARRADOR = ('Locutor esportivo da feira, o mais sério da transmissão. Empolgado, rápido, com bordões de '
                    'transmissão. Fala com o jogador ("você") e chama o adversário de "o rival" ou "a banca rival".')


def ler(nome):
    with open(os.path.join(PASTA, nome), encoding='utf-8') as f:
        return json.load(f)


e = html.escape


def tabela(falas, prefixo=''):
    linhas = ''.join(f'<tr><td class="ok"></td><td class="arq">{e(f["audio"].removeprefix(prefixo))}</td>'
                     f'<td>{e(f["texto"])}</td></tr>' for f in falas)
    return f'<table><tbody>{linhas}</tbody></table>'


def secao(cor, titulo, direcao, pasta, total, corpo):
    return (f'<section class="personagem" style="--cor:{cor}"><header><h2>{e(titulo)}</h2>'
            f'<span>{total} falas · coloque em <b>{e(pasta)}</b></span></header>'
            f'<p class="direcao">{e(direcao)}</p>{corpo}</section>')


def transmissao(d, direcao, cor, titulo, pasta):
    corpo, total = '', 0
    for ev, ev_dados in d['eventos'].items():
        corpo += f'<h3>{e(ev)} <small>{e(ev_dados["quando"])}</small></h3>'
        for grupo, falas in ev_dados['falas'].items():
            if grupo != 'geral':
                corpo += f'<h4>{NOME_GRUPO[grupo]}</h4>'
            corpo += tabela(falas)
            total += len(falas)
    return secao(cor, titulo, direcao, pasta, total, corpo)


def rivais(d):
    saida = ''
    for rid, r in d['rivais'].items():
        corpo, total = '', 0
        for ex, sits in r['falas'].items():
            corpo += f'<h3>{e(ex)} <small>{e(d["expressoes"][ex])}</small></h3>'
            for sit, falas in sits.items():
                corpo += f'<h4>{e(sit.capitalize())} <small>{e(d["situacoes"][sit])}</small></h4>'
                corpo += tabela(falas, f'{rid}/')
                total += len(falas)
        saida += secao('#B07240', r['nome'], r['perfil'], f'gravacoes/{rid}/', total, corpo)
    return saida


ESTILO = """
@import url('https://fonts.googleapis.com/css2?family=Lilita+One&family=Rubik:wght@400;500;700&display=swap');
@page { size: A4; margin: 16mm 14mm 16mm; @bottom-center { content: counter(page); font: 9pt Rubik, sans-serif; color: #888; } }
* { box-sizing: border-box; }
body { margin: 0; font: 10.5pt/1.35 Rubik, 'Noto Sans', sans-serif; color: #1A1A1A; }
h1 { font: 400 30pt/1 'Lilita One', sans-serif; margin: 0 0 4mm; color: #D93A2B; }
.capa p { margin: 0 0 3mm; }
.capa ul { margin: 0 0 4mm; padding-left: 5mm; }
.capa li { margin-bottom: 1.5mm; }
.resumo { border-collapse: collapse; width: 100%; margin-top: 4mm; }
.resumo td, .resumo th { border-bottom: 1px solid #ddd; padding: 2mm; text-align: left; }
.resumo th { font-weight: 700; background: #F6E7C8; }
.personagem { break-before: page; }
.personagem header { background: var(--cor); color: #fff; padding: 3mm 5mm; border-radius: 3mm;
  display: flex; justify-content: space-between; align-items: baseline; gap: 4mm; }
.personagem h2 { margin: 0; font: 400 20pt 'Lilita One', sans-serif; }
.personagem header span { font-size: 9.5pt; }
.direcao { font-style: italic; margin: 3mm 0 4mm; padding: 2.5mm 4mm; background: #F6E7C8; border-radius: 2mm; }
h3 { font: 700 12pt Rubik, sans-serif; margin: 5mm 0 1.5mm; break-after: avoid; color: var(--cor); }
h4 { font: 700 10pt Rubik, sans-serif; margin: 3mm 0 1mm; break-after: avoid; }
h3 small, h4 small { font-weight: 400; color: #666; font-size: 9pt; margin-left: 1.5mm; }
table { width: 100%; border-collapse: collapse; }
tr { break-inside: avoid; }
td { padding: 1.4mm 2mm; border-bottom: 1px solid #e4e4e4; vertical-align: top; }
td.ok { width: 7mm; }
td.ok::before { content: ''; display: block; width: 3.6mm; height: 3.6mm; border: 1.2px solid #555; border-radius: .8mm; }
td.arq { width: 62mm; font: 8.8pt 'Noto Sans Mono', monospace; color: #444; }
"""


def main():
    falas, narr, coment = ler('falas.json'), ler('narrador.json'), ler('comentarista.json')
    conta = lambda d: sum(len(x) for ev in d['eventos'].values() for x in ev['falas'].values())
    conta_rival = lambda r: sum(len(x) for ex in r['falas'].values() for x in ex.values())
    linhas = [('Narrador', 'gravacoes/narrador/', conta(narr)),
              (coment['nome'], 'gravacoes/comentarista/', conta(coment))]
    linhas += [(r['nome'], f'gravacoes/{rid}/', conta_rival(r)) for rid, r in falas['rivais'].items()]
    resumo = ''.join(f'<tr><td>{e(n)}</td><td>{n_falas}</td><td class="arq">{e(p)}</td></tr>' for n, p, n_falas in linhas)
    capa = f"""<section class="capa">
<h1>SuperPANCs: roteiro de gravação</h1>
<p>Cada linha das tabelas vira <b>um arquivo de áudio</b>, com o nome exato da coluna do meio.
Marque a caixinha quando a fala estiver gravada.</p>
<ul>
<li><b>Formato:</b> MP3 (WAV também serve), de preferência mono. Uma fala por arquivo.</li>
<li><b>Sem silêncio</b> sobrando no começo e no fim (o que sobrar é cortado na importação, mas quanto menos, melhor).</li>
<li><b>Duração:</b> narrador e rivais, até ~1,5 s por fala; o Tião pode ir até ~2,5 s. Fale com energia, sem arrastar.</li>
<li><b>Ordem no jogo:</b> a cada rodada, o narrador fala, o Tião comenta e o rival reage. As falas do Tião reagem ao
evento (empate, vitória…), não a uma fala específica do narrador: qualquer combinação precisa funcionar.</li>
<li>Pode entregar aos poucos: o que ainda não foi gravado fica em silêncio no jogo.</li>
</ul>
<table class="resumo"><thead><tr><th>Personagem</th><th>Falas</th><th>Pasta dos arquivos</th></tr></thead>
<tbody>{resumo}<tr><th>Total</th><th>{sum(x[2] for x in linhas)}</th><th></th></tr></tbody></table>
</section>"""
    corpo = (capa
             + transmissao(narr, DIRECAO_NARRADOR, '#D93A2B', 'Narrador', 'gravacoes/narrador/')
             + transmissao(coment, coment['perfil'], '#1F4D2B', f'Comentarista: {coment["nome"]}', 'gravacoes/comentarista/')
             + rivais(falas))
    pagina = (f'<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Roteiro de gravação</title>'
              f'<style>{ESTILO}</style></head><body>{corpo}</body></html>')
    with tempfile.NamedTemporaryFile('w', suffix='.html', encoding='utf-8', delete=False) as f:
        f.write(pagina)
    try:
        subprocess.run(['google-chrome', '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
                        '--virtual-time-budget=10000', f'--print-to-pdf={SAIDA}', f'file://{f.name}'],
                       check=True, capture_output=True)
    finally:
        os.unlink(f.name)
    print(f'{os.path.relpath(SAIDA, RAIZ)}: {sum(x[2] for x in linhas)} falas')


if __name__ == '__main__':
    try:
        main()
    except FileNotFoundError:
        sys.exit('Faltou o Google Chrome (google-chrome) para imprimir o PDF.')
