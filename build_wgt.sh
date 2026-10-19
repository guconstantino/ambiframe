#!/usr/bin/env bash
set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
OUTPUT_DIR="../dist"
WGT_NAME="ambiframe-v${VERSION}.wgt"

mkdir -p "$OUTPUT_DIR"
rm -f "${OUTPUT_DIR}/${WGT_NAME}"

echo "Empacotando AmbiFrame v${VERSION}..."
zip -r "${OUTPUT_DIR}/${WGT_NAME}" config.xml index.html upload.html css js assets -x "*.DS_Store" -x "assets/all_wallpapers_archive/*" -x "assets/screenshots/*"

echo "Pacote gerado com sucesso em: ${OUTPUT_DIR}/${WGT_NAME}"
ls -lh "${OUTPUT_DIR}/${WGT_NAME}"
