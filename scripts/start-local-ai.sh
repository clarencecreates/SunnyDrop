#!/bin/sh
set -eu
SUNNYDROP_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if command -v ollama >/dev/null 2>&1; then
    SUNNYDROP_OLLAMA=$(command -v ollama)
elif [ -x "$SUNNYDROP_ROOT/runtime/ollama/ollama" ]; then
    SUNNYDROP_OLLAMA="$SUNNYDROP_ROOT/runtime/ollama/ollama"
else
    echo 'Install Ollama from https://ollama.com/download/mac, then run ollama pull qwen3.5:4b.'
    exit 1
fi
export OLLAMA_HOST=127.0.0.1:11434
export OLLAMA_NO_CLOUD=1
exec "$SUNNYDROP_OLLAMA" serve
