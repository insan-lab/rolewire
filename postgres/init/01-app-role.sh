#!/bin/bash
# Creates the least-privilege application role used by the API and worker.
#
# The bootstrap role (POSTGRES_USER) owns the schema and runs migrations. The API connects as
# rolewire_app, which is *not* the table owner and has no BYPASSRLS, so the row-level security
# policies in alembic/versions/0001_initial.py actually apply to it (§3).
set -euo pipefail

APP_PASSWORD="${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD must be set}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
    CREATE ROLE rolewire_app LOGIN PASSWORD '${APP_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE;

    GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO rolewire_app;
    GRANT USAGE ON SCHEMA public TO rolewire_app;

    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rolewire_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rolewire_app;

    -- Tables created later by migrations inherit these grants.
    ALTER DEFAULT PRIVILEGES FOR ROLE ${POSTGRES_USER} IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rolewire_app;
    ALTER DEFAULT PRIVILEGES FOR ROLE ${POSTGRES_USER} IN SCHEMA public
        GRANT USAGE, SELECT ON SEQUENCES TO rolewire_app;
SQL
