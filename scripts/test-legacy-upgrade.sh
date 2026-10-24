#!/bin/sh
set -eu
container=previsio-security-tests
docker exec "$container" dropdb -U postgres --if-exists previsio_legacy_test
docker exec "$container" createdb -U postgres previsio_legacy_test
docker exec -i "$container" psql -U postgres -d previsio_legacy_test -v ON_ERROR_STOP=1 < tests/postgres-bootstrap.sql
docker exec -i "$container" psql -U postgres -d previsio_legacy_test -v ON_ERROR_STOP=1 < tests/legacy-upgrade-before.sql
# Unknown tables must stop the bridge before it changes the original schema.
docker exec "$container" psql -U postgres -d previsio_legacy_test -v ON_ERROR_STOP=1 -qc 'create table public.unreviewed_table(id integer)'
if docker exec -i "$container" psql -U postgres -d previsio_legacy_test -v ON_ERROR_STOP=1 < supabase/upgrade-legacy.sql > /tmp/previsio-upgrade-guard.log 2>&1; then exit 1; fi
docker exec "$container" psql -U postgres -d previsio_legacy_test -v ON_ERROR_STOP=1 -qc 'drop table public.unreviewed_table'
# Other procedures remain blocked; this is not a blanket bypass.
docker exec "$container" psql -U postgres -d previsio_legacy_test -v ON_ERROR_STOP=1 -qc 'create procedure public.unreviewed_proc() language sql as $$ select 1 $$'
if docker exec -i "$container" psql -U postgres -d previsio_legacy_test -v ON_ERROR_STOP=1 < supabase/upgrade-legacy.sql > /tmp/previsio-upgrade-procedure-guard.log 2>&1; then exit 1; fi
docker exec "$container" psql -U postgres -d previsio_legacy_test -v ON_ERROR_STOP=1 -qc 'drop procedure public.unreviewed_proc()'
# Verify an error after moving tables restores the original tables and records.
{ sed '$d' supabase/upgrade-legacy.sql; printf "select 1/0;\ncommit;\n"; } | docker exec -i "$container" psql -U postgres -d previsio_legacy_test -v ON_ERROR_STOP=1 > /tmp/previsio-upgrade-rollback.log 2>&1 && exit 1
docker exec "$container" psql -U postgres -d previsio_legacy_test -v ON_ERROR_STOP=1 -qc "do \$\$ begin if to_regnamespace('previsio_legacy_archive') is not null or (select count(*) from public.app_users)<>3 then raise exception 'Rollback failed'; end if; end \$\$;"
docker exec -i "$container" psql -U postgres -d previsio_legacy_test -v ON_ERROR_STOP=1 < supabase/upgrade-legacy.sql
docker exec -i "$container" psql -U postgres -d previsio_legacy_test -v ON_ERROR_STOP=1 < tests/legacy-upgrade-after.sql
if docker exec -i "$container" psql -U postgres -d previsio_legacy_test -v ON_ERROR_STOP=1 < supabase/upgrade-legacy.sql > /tmp/previsio-upgrade-rerun.log 2>&1; then exit 1; fi
printf 'PASS: legacy data, identity/recipe mapping, onboarding, tenant isolation, rollback and repeat-run refusal.\n'

docker exec -i "$container" psql -U postgres -d previsio_legacy_test -v ON_ERROR_STOP=1 < tests/onboarding.sql
