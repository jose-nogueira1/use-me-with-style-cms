#!/bin/sh
set -eu
mkdir -p /opt/backup-postgres/lib && cp /usr/local/bin/pg_dump /opt/backup-postgres/ && cp -L /lib/ld-musl-*.so.1 /opt/backup-postgres/loader
ldd /usr/local/bin/pg_dump | awk '$2 == "=>" && $3 ~ /^\// {print $3}' | xargs -I '{}' cp -L '{}' /opt/backup-postgres/lib/
chroot /opt/backup-postgres /loader --library-path /lib /pg_dump --version
