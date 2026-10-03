#!/bin/bash
# Adopty: backup manual de la base de datos (pg_dump)
# Uso: ./scripts/backup.sh
# Requiere: supabase CLI instalado y logueado, o psql con conexión directa

set -e

BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

FECHA=$(date +%Y%m%d_%H%M%S)
ARCHIVO="$BACKUP_DIR/adopty_$FECHA.sql"

echo "Generando backup en $ARCHIVO..."

# Opción 1: Supabase CLI (recomendado)
if command -v supabase &> /dev/null; then
  supabase db dump -f "$ARCHIVO"
# Opción 2: psql directo (requiere DATABASE_URL en .env)
elif [ -n "$DATABASE_URL" ]; then
  pg_dump "$DATABASE_URL" --clean --if-exists > "$ARCHIVO"
else
  echo "ERROR: Ni supabase CLI ni DATABASE_URL disponibles."
  echo "Instala supabase CLI: npm i -g supabase"
  echo "O exporta DATABASE_URL en tu .env"
  exit 1
fi

# Comprimir
gzip "$ARCHIVO"
echo "Backup completado: $ARCHIVO.gz"

# Limpiar backups antiguos (mantener últimos 7)
ls -t "$BACKUP_DIR"/*.gz 2>/dev/null | tail -n +8 | xargs -r rm
echo "Backups antiguos limpiados (se mantienen 7)"
