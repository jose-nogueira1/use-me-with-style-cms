#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${BACKUP_ENCRYPTION_PASSPHRASE:?}" "${DATABASE_URL:?}"
# Railway packages the matching PostgreSQL client and its Alpine runtime together.
client=/opt/backup-postgres
PGCONNECT_TIMEOUT=15 timeout 180 "$client/loader" --library-path "$client/lib" "$client/pg_dump" \
  --dbname="$DATABASE_URL" --format=custom --no-owner --no-privileges --lock-wait-timeout=20s |
  openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 -md sha256 \
    -pass env:BACKUP_ENCRYPTION_PASSPHRASE -out "$1"
