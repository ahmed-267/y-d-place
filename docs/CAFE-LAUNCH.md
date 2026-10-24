# Café launch with real records and an external card terminal

Update: a data-preserving upgrade for the original UUID project is now prepared and tested locally. See [LEGACY-DATABASE-UPGRADE.md](LEGACY-DATABASE-UPGRADE.md). It has not been applied remotely; the older clean-project guidance below remains an alternative, not a requirement for this supported legacy schema.

Decision: retain the old test Supabase project and built-in demo data. Use a NEW empty Supabase project for café records. No legacy UUID conversion is needed on this path. Do not delete or reset the old project. The existing demo remains available through Try demo; demo records are not imported into the café's real accounts.

## What has been prepared

- `supabase/install-fresh.sql`: a generated, single-transaction installer covering all migrations. It refuses to run if public already contains tables. Run it once on the new project only.
- Automatic recovery copies for browser-only records, restricted table privileges, tenant policies, atomic sales/refunds, Realtime publication and indexes.
- Paginated business reads; failed/incompatible loads block the main operational dashboard instead of silently displaying partial data. This still loads history into memory; large-scale operation has not been capacity-tested.
- External terminal workflow: process the actual card payment on your terminal, then record Card in the app. App refunds change records and stock; refund the actual card payment separately on the terminal.

## Account setup (requires your dashboards)

1. Create a new Supabase project named `previsio-cafe`. Keep the old project's settings unchanged.
2. Open the NEW project's SQL Editor. Paste the whole `supabase/install-fresh.sql` and run it once. On error, stop and retain the full error; the transaction must not be partially committed.
3. Create a separate Netlify site/branch deployment using this fixed code. Build `npm run build`, publish `dist`, functions `netlify/functions` (already in netlify.toml). Do not just upload dist: server functions are required.
4. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` to the new project's values and `SUPABASE_SERVICE_ROLE_KEY` to its server-only service-role key. Set `APP_URL` to this new site's URL. Never prefix a secret with VITE_. Redeploy after changing build-time variables.
5. Configure Supabase Auth site/redirect URLs for the new site. Verify email confirmation/password recovery actually deliver to the café owner's email. Configure a suitable email provider before inviting real clients if the default provider cannot deliver to them.
6. Register the actual owner through the new app and complete onboarding with the café's menu, prices, stock quantities, currency and settings. Invite manager/staff from the owner account and verify each can sign in.
7. Subscription access is separate from customer card payments. Either configure Stripe Billing and verify it, or deliberately start a time-limited pilot as project admin using `scripts/activate-cafe-pilot.sql` after setting the owner's email. The optional pilot lasts 14 days and charges nothing. Plan what happens when it expires; do not edit the frontend to bypass access controls.
8. AI is optional for core till use. Configure a server-only OPENROUTER_API_KEY if demonstrating real scans; otherwise enter menu/expense data manually. Demo AI examples are explicitly samples.

## Acceptance before the café relies on it

Use two real signed-in browser sessions connected to the NEW project, with clearly labelled temporary acceptance records before entering normal trading data. Record results. Local mocks do not substitute for these checks.

1. Owner signup/email confirmation, sign-out/in and password recovery all work.
2. Invite manager and staff. Staff cannot change prices, roles or billing; manager cannot administer owner billing.
3. Create a test product linked to test stock, edit/reload it and confirm another device sees the change.
4. Record a cash sale and a separate-terminal card sale. Check totals, cashier, receipt and exactly one stock deduction after reload.
5. Retry/double-click checkout: exactly one sale. Compete for the last stock unit from two tills: one success and one clear failure.
6. Send an order to the kitchen and complete it from the other device. Realtime and stock agree.
7. Refund the new test sale twice: stock restored once. A failed refund must retain its confirmation instead of claiming success. For real payments, refund externally too.
8. Disconnect before saving/checking out: clear failure and retained ticket. Restore connection and retry. This app is NOT an offline payment processor.
9. Create a local customer, wait for automatic backup success, download its recovery copy, and verify it. Repeat from the second device. These features are not cross-device synchronised merely because backups exist.
10. Verify anonymous denial using `npm run verify:rls` pointed at the NEW project. Also test business-A versus business-B isolation with separate real test accounts; local PostgreSQL tests alone do not certify your deployed configuration.
11. Confirm exports, printer/receipt behaviour and tablet layout on the actual café equipment. No claim of terminal/printer integration is made by local tests.
12. Establish an independent database backup and successfully restore it into a separate test database. Browser recovery copies are stored in the same database and are not disaster recovery.

Do not announce unrestricted production readiness until these hosted checks pass. A supervised pilot is different from a proven large-scale service. Existing limitations: browser-local operational modules, reviewed/manual restoration of recovery copies, no offline checkout guarantee, no integrated card charging, and no measured production capacity.

## Reproduce local verification

`npm run lint`, `npm test`, `npm run build`; start the disposable Docker container described in SECURITY-ROLLOUT.md, then `npm run test:db` and `sh scripts/test-fresh-database.sh`. With the local Vite server running, `npm run test:browser` and `node scripts/test-browser-backup.mjs` exercise browser flows without external requests. `npm run build:database` regenerates the installer after migration changes.

## Local verification completed for this preparation

- TypeScript and production build passed (existing bundle-size warning remains).
- 16 Node tests passed, including pagination past API row caps and refusal to return partially loaded history.
- PostgreSQL security/atomicity/concurrency and recovery tests passed.
- Exact fresh installer passed against synthetic PostgreSQL with broad Supabase-style default grants; reinstall refusal preserved data; Realtime publication membership and privileged-operation denial passed.
- Browser checks passed for owner tabs, checkout, reload, manager/staff views and mobile layout with no page exceptions.
- Dedicated confirmation test passed: wait for server response, disable repeated clicks, retain dialog on failure and close on success.
- The legacy extras containment script preserved synthetic records and removed anonymous/unscoped access in tests. No hosted database was changed.

Unverified until external setup: hosted Supabase Auth/email, real Netlify function configuration, two-device Realtime, actual menu/stock data, café hardware, independent backup restore, and any configured Stripe/OpenRouter integration. These are launch gates, not implied successes.
