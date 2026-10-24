# Security and persistence rollout

## Status and deployment boundary

The repository contains local fixes and executable tests. No production database migration, Netlify deployment, Stripe event, or OpenRouter request was performed. Local database tests use a disposable PostgreSQL 16 container, synthetic users, and mock Supabase JWT helpers. They exercise real PostgreSQL grants, RLS, triggers, locks, and transactions; they are not a substitute for checking the deployed Supabase schema and Auth integration.

Do not deploy the frontend alone: it now depends on the new RPC functions and revision columns. Do not apply the old RLS migration alone: its permissive policies are replaced by the security migration.

## Permission matrix

| Capability | Owner | Manager | Staff | Signed out |
|---|---|---|---|---|
| Own profile name/username | Yes | Yes | Yes | No |
| Own role/business reassignment | No | No | No | No |
| Business settings | Yes | Yes (existing manager portal) | No | No |
| Billing management and invitations | Yes | No | No | No |
| Protected plan/Stripe fields | Trusted server only | No | No | No |
| Catalogue create/delete/pricing | Yes | Yes | No | No |
| Toggle menu availability | Yes | Yes | Yes | No |
| Stock operations | Yes | Yes | Yes | No |
| Orders and checkout | Yes | Yes | Yes | Validated public ordering endpoint only |
| Refund/void/archive sales | Yes | Yes | No | No |
| Expenses and staff management | Yes | Managers: expenses/rota/shifts; profile administration remains owner-only | Own shifts only | No |
| AI operations | Active subscription | Active subscription | No | No |
| Public menu | Dedicated safe endpoint | Dedicated safe endpoint | Dedicated safe endpoint | Dedicated safe endpoint |

Sales/order data remains visible to business members to support shared till/kitchen operations. Staff cannot change sale records directly. Staff may log their own pay/leave details as the existing My Shifts interface permits. Financial estimates are not a payroll approval system.

## Before production

1. Back up the database including schema, triggers, grants, and data; confirm recovery access.
2. Run `scripts/preflight.sql` against the target project. Review custom policies, triggers, foreign keys, and existing column types. The repository cannot establish the actual deployed schema without this output.
3. Clone the schema into a staging Supabase project and use synthetic data. Keep Stripe in test mode and set a low OpenRouter spending cap.
4. Preserve browser data on each till before clearing or replacing anything. New caches are business-scoped. The original `previsio_ops_v1` remains untouched. Cloud loads preserve prior caches under `previsio_recovery_<business>_<timestamp>`. Failed catalogue edits are retained under `previsio_pending_<business>_<table>`.
5. Existing historical sales do not have a stock-consumption ledger. New sales record exact recipe consumption. Reversing an older sale cannot reconstruct historic recipe quantities reliably; reconcile any necessary stock correction manually. Do not bulk-replay old sales to recover browser data: that would deduct stock again.

## Migration order

Apply migrations in filename order on a fresh test database:

1. `20261001000000_base_schema.sql` creates missing core tables without replacing existing ones.
2. Existing tenant and billing migrations.
3. `20261018000000_security.sql` replaces policies on the managed tables, protects identity/billing fields, removes anonymous table grants, and adds shared usage limits.
4. `20261018010000_atomic_operations.sql` adds revisions, transactional mutations/sales/refunds, original-consumption ledger, discount approvals, and historical-sale corrections.
5. `20261018020000_billing_lock.sql` serializes subscription reconciliation across function instances.

For existing projects, review the baseline rather than assuming CREATE TABLE IF NOT EXISTS upgrades existing tables. Missing legacy columns must be reconciled from the preflight report. Numeric shift IDs are converted to text without removing records; external dependent foreign keys can stop the migration and must be reviewed. The security migration intentionally replaces all policies on the listed managed tables, including custom ones: review any custom requirements first.

Use a scheduled maintenance window or staging-first release because the new application and RPC contract must arrive together. Verify Netlify service-role, Supabase URL/anon key, Stripe keys/price/webhook secret, APP_URL, and OpenRouter key. Never expose server keys through VITE variables.

Publish the tested functions and frontend, then require active browser tabs to reload. Confirm the intended tables are enabled for Supabase Realtime. The local Docker tests do not validate the Realtime publication.

## Recovery and behaviour changes

- Catalogue/stock/order/rota edits are explicit writes, checked against a row revision. Conflicts fail rather than overwriting another device. Failed requests retain a local recovery artifact and show an error. They are not automatically replayed after account switching or refresh.
- A checkout or kitchen-send failure leaves the ticket available to retry. Stable IDs prevent duplicate sales. Public orders use stable request IDs and payload fingerprints.
- Historical totals are fixed to original line items. Correct the payment method, or refund and create a corrected sale. Removing a sale voids it and archives it instead of erasing the audit trail.
- Manager discount approvals are issued by an independently authenticated, non-persistent Supabase client, bound to a business/order and maximum amount, and consumed once.
- AI demos use clearly named sample fixtures. Live scanning requires an authorised active business. Model selection is server-controlled; per-user and per-business limits are shared across function instances.
- Cash sessions, floor plans, customers, waste logs, availability, and shift-login logs retain their existing browser-local storage. This change does not turn these into cross-device services. Back them up before moving devices.
- The main context still composes the application. Collection persistence is extracted into a hook; dashboard tabs are lazy-loaded. A full context rewrite is intentionally not mixed into this security rollout.

To export recovery data from a till, run this in that app's browser console and save the JSON securely (it can contain customer details):

```js
const recovery = Object.fromEntries(Object.keys(localStorage)
  .filter(key => key === 'previsio_ops_v1' || key.startsWith('previsio_ops_v1:') || key.startsWith('previsio_recovery_') || key.startsWith('previsio_pending_'))
  .map(key => [key, JSON.parse(localStorage.getItem(key))]));
const link = document.createElement('a');
link.href = URL.createObjectURL(new Blob([JSON.stringify(recovery, null, 2)], {type:'application/json'}));
link.download = 'previsio-recovery.json'; link.click(); URL.revokeObjectURL(link.href);
```

Reconcile each recovered record against cloud data by stable ID. Do not blindly replace cloud state or replay historical checkout operations.

If application behaviour regresses, disable the affected feature or roll forward to a compatible build. Do not restore the permissive RLS policies. Keep the database backup for targeted recovery.

## Reproducible checks

```sh
npm test
npm run lint
npm run build
# This container has no network or published port and uses only synthetic data:
docker run --detach --rm --name previsio-security-tests --network none -e POSTGRES_PASSWORD=local-test-only postgres:16-alpine
npm run test:db
# After checks:
docker stop previsio-security-tests
```

`test:db` resets only database `previsio_test` inside that explicitly named container. It tests tenant isolation, escalation prevention, safe onboarding, billing protection, conflict handling, atomic sales, stock rollback, refunds, approvals, self-service shifts, and concurrent tills competing for the last unit.

With the local Vite server running, run `npm run test:browser` (install the Playwright Chromium browser if needed). Browser smoke checks block all external requests, exercise demo tabs, checkout, reload, role switching and mobile rendering. They do not prove live account/integration behaviour.

Run `npm run verify:rls` only after deployment to check anonymous denial. Unlike the old script, every unexpected private-table response now fails the check. Complete the staging manual checklist before production.

## Local verification result

- TypeScript checking and the production build passed.
- Server tests passed, including authenticated AI, shared limits, trusted public pricing/retries, structured output validation and billing write failures.
- PostgreSQL assertions and the two-connection stock concurrency check passed.
- Browser smoke checks passed for owner tabs, demo checkout, reload persistence, manager/staff role switching and mobile rendering, with no page exceptions.
- Compatible package updates removed the reported high/moderate findings. One low-severity esbuild advisory remains through an optional development dependency; no forced incompatible dependency override was applied.
- Dashboard lazy loading reduced the main JavaScript chunk from approximately 2.1 MB to 1.15 MB (about 344 KB gzip). Vite still reports a chunk-size warning.

Live signup/email delivery, Stripe test events, real AI scans, existing-schema migration compatibility, and production Realtime still require staging verification. Nothing in this report means the production database or hosted app has been changed.

## New deployed-schema evidence and automatic browser copies

The user-supplied database reports revealed UUID/enum/legacy-table incompatibilities with the baseline. **Do not apply the original migration sequence unchanged to that existing database.** See [DEPLOYED-SCHEMA-REVIEW.md](DEPLOYED-SCHEMA-REVIEW.md).

Automatic local-record snapshots are implemented in `20261021000000_browser_backups.sql` and the app. Once safely deployed, they replace routine manual browser exports for successfully backed-up records. They do not replace independent database backups. See [AUTOMATIC-RECOVERY.md](AUTOMATIC-RECOVERY.md). Run `node scripts/test-browser-backup.mjs` with the local dev server running for the mocked browser recovery test.
