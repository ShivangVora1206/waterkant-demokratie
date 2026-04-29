#!/usr/bin/env bash
set -euo pipefail

ARCHIVE=${1:-}
DATA_DIR=${2:-./data}

if [[ -z "$ARCHIVE" ]]; then
  echo "Usage: ./scripts/restore.sh <backup.tar.gz> [data-dir]"
  exit 1
fi

mkdir -p "$DATA_DIR"
tar -xzf "$ARCHIVE" -C "$DATA_DIR"

echo "Restore completed into $DATA_DIR"
