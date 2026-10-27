#!/bin/bash
set -e

for db in user_db order_db payment_db inventory_db; do
  if [ "$POSTGRES_DB" != "$db" ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -tc "SELECT 1 FROM pg_database WHERE datname = '$db'" | grep -q 1 || \
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "CREATE DATABASE $db;"
  fi
done

echo "Bancos de dados lógicos criados com sucesso!"
