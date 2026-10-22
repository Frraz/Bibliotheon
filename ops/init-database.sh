#!/bin/sh
set -eu
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 <<'SQL'
\getenv runtime_password DB_RUNTIME_PASSWORD
CREATE ROLE bibliotheon_runtime LOGIN PASSWORD :'runtime_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT CONNECT ON DATABASE bibliotheon TO bibliotheon_runtime;
GRANT USAGE ON SCHEMA public TO bibliotheon_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE bibliotheon_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bibliotheon_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE bibliotheon_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO bibliotheon_runtime;
SQL
