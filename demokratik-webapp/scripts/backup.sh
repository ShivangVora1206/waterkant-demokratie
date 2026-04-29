#!/usr/bin/env bash
set -euo pipefail

DATA_DIR=${1:-./data}
BACKUP_DIR="$DATA_DIR/backups"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
ARCHIVE="$BACKUP_DIR/backup-$TIMESTAMP.tar.gz"

mkdir -p "$BACKUP_DIR"

if [[ -f "$DATA_DIR/db.sqlite" ]]; then
  sqlite3 "$DATA_DIR/db.sqlite" "PRAGMA wal_checkpoint(FULL); VACUUM;" || true
fi

tar -czf "$ARCHIVE" -C "$DATA_DIR" db.sqlite images
shasum -a 256 "$ARCHIVE" > "$ARCHIVE.sha256"

echo "Backup created: $ARCHIVE"
