#!/usr/bin/env bash
# Gera as versões otimizadas (WebP) das cartas usadas pelo jogo, a partir dos JPGs originais.
# Os originais em imagens-cartas-superpancs/ não são alterados.
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

echo "Originais:   $(du -ch "$ORIGEM"/*.jpg | tail -1 | cut -f1)"
echo "Otimizadas:  $(du -ch "$DESTINO"/*.webp | tail -1 | cut -f1)  ($(ls "$DESTINO"/*.webp | wc -l) arquivos em $DESTINO/)"
