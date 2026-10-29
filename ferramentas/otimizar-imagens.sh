#!/usr/bin/env bash
# Gera as versões otimizadas (WebP) das cartas usadas pelo jogo:
# - img/cartas/: cartas completas, a partir dos JPGs originais (verso e tela final);
# - img/cartas-limpas/: cartas sem texto (a mesa escreve nome e atributos por cima), a partir dos PNGs.
# Os originais em imagens-cartas-superpancs/ e imagens-cartas-sem-texto/ não são alterados.
# Requer ImageMagick 7 (comando `magick`). Rodar da raiz do projeto:
#   bash ferramentas/otimizar-imagens.sh
set -euo pipefail

ORIGEM="imagens-cartas-superpancs"
DESTINO="img/cartas"
QUALIDADE=75

mkdir -p "$DESTINO"
for f in "$ORIGEM"/*.jpg; do
  magick "$f" -strip -quality "$QUALIDADE" "$DESTINO/$(basename "$f" .jpg).webp"
done

mkdir -p img/cartas-limpas
for f in imagens-cartas-sem-texto/*.png; do
  magick "$f" -strip -quality 78 "img/cartas-limpas/$(basename "$f" .png).webp"
done

echo "Originais:   $(du -ch "$ORIGEM"/*.jpg | tail -1 | cut -f1)"
echo "Otimizadas:  $(du -ch "$DESTINO"/*.webp | tail -1 | cut -f1)  ($(ls "$DESTINO"/*.webp | wc -l) arquivos em $DESTINO/)"
echo "Sem texto:   $(du -ch img/cartas-limpas/*.webp | tail -1 | cut -f1)  ($(ls img/cartas-limpas/*.webp | wc -l) arquivos em img/cartas-limpas/)"
