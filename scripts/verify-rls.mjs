#!/usr/bin/env node
/**
 * Read-only RLS probe: as anon, tenant tables must not return data.
 * Usage:
 *   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... node scripts/verify-rls.mjs
 */
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const tables = ['businesses', 'sales', 'app_users', 'products', 'orders', 'expenses'];

const check = async (table) => {
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${table}?select=id&limit=5`, {
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
    });
    const text = await res.text();
    let rows = [];
    try {
      rows = JSON.parse(text);
    } catch {
      /* ignore */
    }
    const count = Array.isArray(rows) ? rows.length : -1;
    return { table, status: res.status, count, sample: text.slice(0, 120), error: null };
  } catch (err) {
    return {
      table,
      status: 0,
      count: -1,
      sample: '',
      error: err instanceof Error ? err.message : String(err),
    };
  }
};

(async () => {
  let failed = false;
  let unreachable = false;
  for (const t of tables) {
    const r = await check(t);
    if (r.error) {
      unreachable = true;
      console.error(`SKIP ${t}: network error — ${r.error}`);
      continue;
    }
    const ok =
      r.status === 401 ||
      r.status === 403 ||
      (r.status === 200 && r.count === 0) ||
      (t === 'products' && r.status === 200) ||
      (t === 'businesses' && r.status === 200 && r.count <= 50);

    if (t === 'sales' || t === 'app_users' || t === 'expenses') {
      if (r.status === 200 && r.count > 0) {
        failed = true;
        console.error(`FAIL ${t}: anon can read ${r.count} row(s) (status ${r.status})`);
        continue;
      }
    }
    console.log(`${ok || r.count === 0 ? 'OK  ' : 'WARN'} ${t}: status=${r.status} count=${r.count}`);
  }
  if (unreachable) {
    console.error(
      '\nCould not reach Supabase. Apply supabase/migrations/20261002120000_tenant_rls.sql in the SQL editor, then re-run this script from a network that can resolve the project host.'
    );
    process.exit(3);
  }
  if (failed) {
    console.error('\nApply supabase/migrations/20261002120000_tenant_rls.sql immediately.');
    process.exit(2);
  }
  console.log('\nAnon probe finished. Review WARN lines for unexpected public data.');
})();
