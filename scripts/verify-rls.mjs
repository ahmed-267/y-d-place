#!/usr/bin/env node
/**
 * Read-only RLS probe: as anon, tenant tables must not return data.
 * Loads .env.local / .env from the project root (same vars as Vite).
 * Usage:
 *   npm run verify:rls
 *   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... node scripts/verify-rls.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const loadEnvFile = (name) => {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
};

loadEnvFile('.env.local');
loadEnvFile('.env');

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.error(
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local (or export them in the shell).'
  );
  process.exit(1);
}

const tables = ['businesses', 'sales', 'app_users', 'products', 'orders', 'expenses', 'ingredients', 'prepared_stock', 'sale_items', 'work_shifts', 'rota_shifts', 'browser_backups', 'leave_requests'];
const optionalLegacyTables = ['product_ingredients', 'sale_item_extras'];

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
  for (const t of [...tables, ...optionalLegacyTables]) {
    const r = await check(t);
    if (r.error) {
      unreachable = true;
      console.error(`SKIP ${t}: network error — ${r.error}`);
      continue;
    }
    const ok = (optionalLegacyTables.includes(t) && r.status === 404) || r.status === 401 || r.status === 403 || (r.status === 200 && r.count === 0);
    if (!ok) failed = true;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${t}: status=${r.status} count=${r.count}`);
  }
  if (unreachable) {
    console.error(
      '\nCould not reach Supabase. Check network access and project status, then rerun. Do not apply individual legacy migrations to resolve a network error.'
    );
    process.exit(3);
  }
  if (failed) {
    console.error('\nApply the complete reviewed migration sequence; public menus must use the dedicated endpoint.');
    process.exit(2);
  }
  console.log('\nAnon probe passed. Authenticated isolation is covered separately by npm run test:db.');
})();
