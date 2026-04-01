#!/bin/bash
# Creates multiple databases in PostgreSQL on first run
set -e

function create_db() {
  local db=$1
  echo "Creating database: $db"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    SELECT 'CREATE DATABASE $db'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db')\gexec
EOSQL
}

create_db authdb
create_db orderdb
create_db paymentdb

echo "✅ All databases created successfully"
