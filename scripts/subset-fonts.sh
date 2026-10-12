#!/bin/sh
# One-time font subsetting. Requires Python fonttools + brotli:
#   pip3 install fonttools brotli
# Source TTFs come from github.com/google/fonts (OFL). Output is committed to
# src/assets/fonts so the site build itself never needs Python.
set -eu

SRC="${1:-/tmp/fonts}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/src/assets/fonts"
TMP="$(mktemp -d)"
mkdir -p "$OUT"

# Basic Latin, Latin-1 (á é í ó ú ñ ü ¿ ¡ · ×), dashes, quotes, bullet,
# ellipsis, arrows.
UNICODES="U+0020-007E,U+00A0-00FF,U+2013-2014,U+2018-201D,U+2022,U+2026,U+2190-2193"

# Archivo: weight 300-900 and width 75-100 (condensed captions) in one file.
python3 -m fontTools.varLib.instancer "$SRC/Archivo.ttf" wdth=75:100 wght=300:900 \
  -o "$TMP/archivo-var.ttf" -q
pyftsubset "$TMP/archivo-var.ttf" --unicodes="$UNICODES" \
  --layout-features='kern,liga,calt,tnum,lnum' --flavor=woff2 \
  --output-file="$OUT/archivo-var.woff2"

# Martian Mono: one static instance for all labels, at its narrowest width and
# a light weight to match the comp's narrow, light mono.
python3 -m fontTools.varLib.instancer "$SRC/MartianMono.ttf" wdth=75 wght=350 \
  -o "$TMP/martian-cond.ttf" -q
pyftsubset "$TMP/martian-cond.ttf" --unicodes="$UNICODES" \
  --layout-features='kern' --flavor=woff2 \
  --output-file="$OUT/martian-mono-cond.woff2"

rm -rf "$TMP"
ls -l "$OUT"
