#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE user_db;
    CREATE DATABASE order_db;
    CREATE DATABASE payment_db;
    CREATE DATABASE inventory_db;
EOSQL

echo "Bancos de dados lógicos criados com sucesso!"