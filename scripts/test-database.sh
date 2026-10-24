#!/bin/sh
set -eu
# Only the isolated, explicitly named container is targeted. No production credentials are read.
container=previsio-security-tests
docker exec "$container" dropdb -U postgres --if-exists previsio_test
docker exec "$container" createdb -U postgres previsio_test
docker exec -i "$container" psql -U postgres -d previsio_test -v ON_ERROR_STOP=1 < tests/postgres-bootstrap.sql
for migration in supabase/migrations/*.sql; do
  docker exec -i "$container" psql -U postgres -d previsio_test -v ON_ERROR_STOP=1 < "$migration"
done
docker exec -i "$container" psql -U postgres -d previsio_test -v ON_ERROR_STOP=1 < tests/database.sql
docker exec -i "$container" psql -U postgres -d previsio_test -v ON_ERROR_STOP=1 < tests/browser-backups.sql
docker exec -i "$container" psql -U postgres -d previsio_test -v ON_ERROR_STOP=1 < tests/leave-requests.sql
# Two independent connections compete for the last unit. Exactly one must commit.
docker exec "$container" psql -U postgres -d previsio_test -v ON_ERROR_STOP=1 -qc "update ingredients set qty=1 where id=1"
docker exec -i "$container" psql -U postgres -d previsio_test -v ON_ERROR_STOP=1 -v sale=CONCURRENT_A < tests/concurrent-sale.sql > /tmp/previsio-concurrent-a.log 2>&1 &
first=$!
docker exec -i "$container" psql -U postgres -d previsio_test -v ON_ERROR_STOP=1 -v sale=CONCURRENT_B < tests/concurrent-sale.sql > /tmp/previsio-concurrent-b.log 2>&1 &
second=$!
wait "$first" || true
wait "$second" || true
docker exec "$container" psql -U postgres -d previsio_test -v ON_ERROR_STOP=1 -qc "select test_assert((select count(*)=1 from sales where id in ('CONCURRENT_A','CONCURRENT_B')) and (select qty=0 from ingredients where id=1),'concurrent tills cannot oversell')"
printf 'Concurrent sale test passed.\n'

# Reproduce and contain the legacy table exposure without removing its records.
cat tests/legacy-containment-before.sql supabase/remediation/20261022_contain_legacy_extras.sql tests/legacy-containment-after.sql | docker exec -i "$container" psql -U postgres -d previsio_test -v ON_ERROR_STOP=1

docker exec -i "$container" psql -U postgres -d previsio_test -v ON_ERROR_STOP=1 < tests/onboarding.sql
