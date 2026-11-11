#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-$ROOT/mentor-run}"

if [ ! -f "$ROOT/dist/cli/index.js" ]; then
  echo "Build não encontrado. Compilando o projeto..."
  (cd "$ROOT" && npm run build)
fi

mkdir -p "$TARGET"

echo "Mentor rodando em: $TARGET"
echo "Os arquivos do projeto (PROJETO.md, Spec.md, PRD.md, .mentor/ e o código) serão criados nessa pasta."
echo

cd "$TARGET"
exec node "$ROOT/dist/cli/index.js"
