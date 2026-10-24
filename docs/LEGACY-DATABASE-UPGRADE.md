# Repair the existing Supabase project

Status: prepared and tested locally, NOT applied to Supabase. This is the repair for the original UUID database reported in this project, including missing app_users.email/numeric_id and businesses.address. It upgrades the existing shared project; account IDs, passwords and confirmation state stay in Supabase Auth. No new registration or confirmation email is needed for an already-confirmed account.

## Apply once

1. Stop using the app on all devices while the upgrade runs. Keep an independent database export if these records matter; the archive below is in the same database, so it is not disaster recovery.
2. Open `supabase/upgrade-legacy.sql` in the editor and copy the entire file. Use **upgrade-legacy.sql**, not **install-fresh.sql** and not one individual migration.
3. Open the Supabase project matching the URL in `.env.local`. Open **SQL Editor → New query**, paste the entire file, and run as the database owner (`postgres`). It changes schema, policies and grants, so the editor may show a modification warning. This is not executable with an anon or service-role REST key.
4. Only proceed when the whole query succeeds. If it reports an error, save that exact error and stop: the transaction rolls back. Do not rerun selected parts, delete tables or remove the guards. The script refuses an already-upgraded database, unexpected tables/views/triggers, and unsupported relationships.
5. Reload localhost and sign in with the existing confirmed account. Complete Business profile → Continue → Build your menu. Check the business settings and menu survive reload and sign-out/sign-in. Do not repeatedly register the same email.

If applying through a database-owner connection instead of SQL Editor, use a client configured to stop on the first error and run the complete file as one script. Credentials belong in local secret configuration, never chat or version control. The coding session currently has no such connection.

## What the upgrade does

- Moves original tables and user-defined functions to `previsio_legacy_archive`, with client/service-role access revoked. Original UUIDs, original columns, timestamps and rows remain there.
- Creates the application schema, protected operations, RLS, required indexes, rate limiter, leave requests and atomic onboarding from the same migrations used for fresh installs.
- Preserves business IDs as text containing the same UUIDs and preserves Auth user UUIDs. Creates persistent private mappings for numeric staff/product/ingredient/sale-item IDs. Recipe links, historical sale products and staff shifts are remapped together.
- Imports existing businesses, users, menu, ingredients, recipes, sales/items, expenses and shifts. Checks row counts and financial/stock/hour totals before commit. Historical item unit prices are derived from stored line totals and extras, not current menu prices.
- Keeps existing billing/trial values. It does not grant a paid plan or bypass billing. New accounts follow the existing subscription flow after setup.
- Keeps unlinked legacy `sale_item_extras` records privately: their bigint IDs cannot be safely joined to UUID parent records. Existing JSON extras on sale_items are migrated. Original recipes and all unmodified source rows remain in the archive.
- Moves Realtime subscriptions to current tables and requests an API schema-cache reload.
- Commits only if everything succeeds. A forced failure after import was tested to restore the original schema and records.

Historical sales did not have a stock-consumption ledger. The upgrade does not invent one: refunds of pre-upgrade sales cannot automatically reconstruct their historic stock consumption. New sales/refunds use the tested stock ledger. Browser caches are not restored over the migrated cloud records.

## Verification

`npm run build:upgrade` regenerates the file from reviewed source plus all migrations. `npm run test:upgrade` uses only the isolated `previsio-security-tests` Docker container and synthetic records. Checks include records/totals, Auth IDs, recipe and staff mappings, private archive permissions, tenant separation, existing owner settings, new onboarding/menu writes, post-upgrade sale/refund, transaction rollback, unsupported-table rejection and rerun refusal. `tests/onboarding.sql` also checks retry deduplication, interrupted-profile recovery, rollback on profile failure, anonymous denial and staff ownership denial.

`npm run test:auth` uses mocked HTTP responses and sends no emails. It verifies confirmation redirects, login, database-error handling, the actual onboarding Continue action, and retry after a failed save.

These local checks do not substitute for the live sign-in/setup/checkout checks after applying the upgrade. Do not push a UI expecting these migrations before the database is upgraded.
