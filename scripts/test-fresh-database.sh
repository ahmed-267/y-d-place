#!/bin/sh
set -eu
container=previsio-security-tests
# Fixed synthetic database and container names only. No env file or live database credentials.
docker exec "$container" dropdb -U postgres --if-exists previsio_fresh_test
docker exec "$container" createdb -U postgres previsio_fresh_test
docker exec -i "$container" psql -U postgres -d previsio_fresh_test -v ON_ERROR_STOP=1 < tests/postgres-bootstrap.sql
# Reproduce Supabase's broad defaults so the install must explicitly remove them.
docker exec "$container" psql -U postgres -d previsio_fresh_test -v ON_ERROR_STOP=1 -qc 'alter default privileges in schema public grant all on tables to anon,authenticated; alter default privileges in schema public grant all on sequences to anon,authenticated; create publication supabase_realtime;'
docker exec -i "$container" psql -U postgres -d previsio_fresh_test -v ON_ERROR_STOP=1 < supabase/install-fresh.sql
docker exec -i "$container" psql -U postgres -d previsio_fresh_test -v ON_ERROR_STOP=1 < tests/database.sql
docker exec -i "$container" psql -U postgres -d previsio_fresh_test -v ON_ERROR_STOP=1 < tests/browser-backups.sql
docker exec -i "$container" psql -U postgres -d previsio_fresh_test -v ON_ERROR_STOP=1 < tests/leave-requests.sql
if docker exec -i "$container" psql -U postgres -d previsio_fresh_test -v ON_ERROR_STOP=1 < supabase/install-fresh.sql > /tmp/previsio-fresh-rerun.log 2>&1; then
  printf 'FAIL: installer accepted an existing database\n'
  exit 1
fi
docker exec "$container" psql -U postgres -d previsio_fresh_test -v ON_ERROR_STOP=1 -qc "select test_assert((select count(*)=3 from businesses),'refused reinstall preserves data'); select test_assert((select count(*)=6 from pg_publication_tables where pubname='supabase_realtime'),'Realtime tables included'); select test_assert(not has_table_privilege('anon','previsio_stock_ledger','TRUNCATE'),'internal table truncate denied'); select test_assert(not has_table_privilege('authenticated','sales','TRUNCATE'),'sales truncate denied');"
printf 'Fresh installer, broad default privileges, Realtime configuration and refusal to overwrite passed.\n'

docker exec -i "$container" psql -U postgres -d previsio_fresh_test -v ON_ERROR_STOP=1 < tests/onboarding.sql
