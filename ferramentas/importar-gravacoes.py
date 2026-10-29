#!/usr/bin/env python3
"""Importa as gravações de gravacoes/<personagem>/ para audio/, no formato do jogo.

  gravacoes/narrador/      → audio/narrador/
  gravacoes/comentarista/  → audio/comentarista/
  gravacoes/seu-ze/        → audio/falas/seu-ze/
  gravacoes/dona-cida/     → audio/falas/dona-cida/

Cada arquivo precisa ter o nome de uma fala do roteiro (MP3, WAV, M4A ou OGG). Na importação, o
silêncio das pontas é cortado, o volume é igualado e o áudio vira MP3 mono. As gravações originais
ficam onde estão. Só refaz o que mudou desde a última importação (use --tudo para refazer todas).

No fim, mostra o que foi importado, os nomes que não são de nenhuma fala (com uma sugestão),
as gravações longas demais e quantas falas ainda faltam.

Uso: python3 ferramentas/importar-gravacoes.py [--tudo]
Precisa de ffmpeg (com libmp3lame).
"""
import difflib
import json
import os
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEM = os.path.join(RAIZ, 'gravacoes')
FORMATOS = ('.mp3', '.wav', '.m4a', '.ogg')
LONGA = 4.0  # segundos: acima disso, a fala atrasa a rodada (o jogo espera a voz terminar)

# Corta o silêncio do começo e do fim (o fim é cortado invertendo o áudio) e iguala o volume.
FILTRO = ','.join([
    'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05',
    'areverse',
    'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15',
    'areverse',
    'loudnorm=I=-16:TP=-1.5:LRA=11',
])


def ler(nome):
    with open(os.path.join(RAIZ, 'falas', nome), encoding='utf-8') as f:
        return json.load(f)


def falas_de(no):
    """Todas as falas de um dicionário aninhado (desce até as falas)."""
    if isinstance(no, list):
        for fala in no:
            yield fala
    else:
        for valor in no.values():
            yield from falas_de(valor)


def personagens():
    """pasta em gravacoes/ → (pasta em audio/, nomes de arquivo esperados)."""
    rivais, narrador, comentarista = ler('falas.json'), ler('narrador.json'), ler('comentarista.json')
    saida = {
        'narrador': (narrador['audio']['pasta'], {f['audio'] for e in narrador['eventos'].values() for f in falas_de(e['falas'])}),
        'comentarista': (comentarista['audio']['pasta'], {f['audio'] for e in comentarista['eventos'].values() for f in falas_de(e['falas'])}),
    }
    for rid, r in rivais['rivais'].items():
        saida[rid] = (f'{rivais["audio"]["pasta"]}/{rid}', {f['audio'].removeprefix(f'{rid}/') for f in falas_de(r['falas'])})
    return saida


def duracao(caminho):
    saida = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', caminho],
                           capture_output=True, text=True, check=True).stdout
    return float(saida)


def converter(origem, destino):
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', origem, '-af', FILTRO,
                    '-ac', '1', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '64k', destino], check=True)


def main():
    tudo = '--tudo' in sys.argv
    importados, iguais, desconhecidos, longas, faltando = [], 0, [], [], {}
    for pasta, (destino_pasta, esperados) in personagens().items():
        origem_pasta = os.path.join(ORIGEM, pasta)
        recebidos = set()
        arquivos = sorted(os.listdir(origem_pasta)) if os.path.isdir(origem_pasta) else []
        for arquivo in arquivos:
            base, ext = os.path.splitext(arquivo)
            if arquivo.startswith('.') or ext.lower() not in FORMATOS:
                continue
            nome = base + '.mp3'
            if nome not in esperados:
                parecido = difflib.get_close_matches(nome, esperados, n=1)
                desconhecidos.append((f'{pasta}/{arquivo}', parecido[0] if parecido else None))
                continue
            recebidos.add(nome)
            origem = os.path.join(origem_pasta, arquivo)
            destino = os.path.join(RAIZ, destino_pasta, nome)
            if not tudo and os.path.exists(destino) and os.path.getmtime(destino) >= os.path.getmtime(origem):
                iguais += 1
            else:
                converter(origem, destino)
                importados.append(f'{pasta}/{nome}')
            segundos = duracao(destino)
            if segundos > LONGA:
                longas.append((f'{pasta}/{nome}', segundos))
        faltando[pasta] = len(esperados - recebidos)

    print(f'{len(importados)} gravações importadas, {iguais} já estavam em dia.')
    if desconhecidos:
        print('\nNomes que não são de nenhuma fala (não foram importados):')
        for arquivo, parecido in desconhecidos:
            print(f'  {arquivo}' + (f'  → seria {parecido}?' if parecido else ''))
    if longas:
        print(f'\nLongas (mais de {LONGA:.0f} s depois de cortar o silêncio; a rodada espera a voz terminar):')
        for arquivo, segundos in longas:
            print(f'  {arquivo}  {segundos:.1f} s')
    print('\nAinda faltam: ' + ', '.join(f'{pasta} {n}' for pasta, n in faltando.items()))


if __name__ == '__main__':
    try:
        main()
    except FileNotFoundError as erro:
        sys.exit(f'Faltou um programa: {erro.filename}. Instale o ffmpeg.')
