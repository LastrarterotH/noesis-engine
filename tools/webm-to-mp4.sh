#!/usr/bin/env bash
# noesis: convierte uno o varios .webm grabados con el botón ● a .mp4 (H.264/AAC).
#
# uso:
#   tools/webm-to-mp4.sh archivo.webm [otro.webm ...]
#   tools/webm-to-mp4.sh                # sin args: busca noesis-*.webm en ~/Downloads
#   QUALITY=23 tools/webm-to-mp4.sh ...  # crf override (default 18, menor = mejor)
#   PRESET=fast tools/webm-to-mp4.sh ... # libx264 preset (default slow)
#   OUTDIR=./mp4 tools/webm-to-mp4.sh ... # carpeta destino (default: junto al .webm)

set -euo pipefail

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "error: ffmpeg no está instalado. en mac: brew install ffmpeg" >&2
  exit 1
fi

QUALITY="${QUALITY:-18}"
PRESET="${PRESET:-slow}"
OUTDIR="${OUTDIR:-}"

# si no se pasaron args, autodetectar grabaciones en Downloads
if [ "$#" -eq 0 ]; then
  shopt -s nullglob
  set -- "$HOME"/Downloads/noesis-*.webm
  shopt -u nullglob
  if [ "$#" -eq 0 ]; then
    echo "uso: $(basename "$0") archivo.webm [...]    (o deja un .webm en ~/Downloads)" >&2
    exit 1
  fi
  echo "encontrados $# archivo(s) en ~/Downloads"
fi

for src in "$@"; do
  if [ ! -f "$src" ]; then
    echo "skip: no existe '$src'" >&2
    continue
  fi
  base="$(basename "${src%.webm}")"
  if [ -n "$OUTDIR" ]; then
    mkdir -p "$OUTDIR"
    dst="$OUTDIR/${base}.mp4"
  else
    dst="$(dirname "$src")/${base}.mp4"
  fi
  echo "→ $src"
  echo "  $dst  (crf=$QUALITY preset=$PRESET)"
  ffmpeg -y -hide_banner -loglevel warning -stats \
    -i "$src" \
    -c:v libx264 -preset "$PRESET" -crf "$QUALITY" \
    -pix_fmt yuv420p \
    -c:a aac -b:a 192k \
    -movflags +faststart \
    "$dst"
done

echo "listo."
