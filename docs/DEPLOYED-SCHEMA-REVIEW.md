# Review of supplied database reports (21 October 2026)

Update: a data-preserving upgrade for the original UUID project is now prepared and tested locally. See [LEGACY-DATABASE-UPGRADE.md](LEGACY-DATABASE-UPGRADE.md). It has not been applied remotely; the older clean-project guidance below remains an alternative, not a requirement for this supported legacy schema.

Source: user-supplied columns, constraints, policy CSV, empty trigger result, and partial grants output. No direct production inspection or changes.

Do not apply the baseline/security/atomic migration sequence as-is to this database. Fresh-schema test success does not establish upgrade compatibility.

Confirmed differences:
- businesses.id and the associated business references are UUID, whereas the local baseline uses text.
- products/ingredients/sale_items IDs are UUID, whereas current application mappings use numeric IDs in several places. Converting UUID strings with Number produces NaN. This needs an explicit identity migration or application-wide UUID support; do not invent replacement IDs or drop foreign keys casually.
- app_users lacks numeric_id and other fields expected by the app. work_shifts.user_id is a required UUID foreign key to app_users.id; the new shift policy/mapping expects numeric_id.
- work_shifts start_time/end_time are required SQL time fields. The local baseline uses text and supports other shift kinds; defaults/nullability need reconciliation.
- products stores translations but has no ingredient_links/extra configuration columns in the supplied output. product_ingredients exists as a related table; preserve and map existing recipes.
- sale_item_extras exists. Its columns and ownership relationship are still unknown.
- prepared_stock, orders and rota_shifts were absent from the supplied columns report. Their absence needs confirming before creating them.
- role, expense category/frequency and sale payment method use enums. Exact labels are required to verify accepted application values.

Access-control findings:
- Multiple overlapping permissive policy families exist. A more restrictive added policy does not cancel a permissive existing policy.
- Self-update policies permit changing app_users fields without demonstrated field-level protection. The supplied trigger query returned no rows. The profile escalation risk remains in the reported deployed configuration.
- Public business-menu SELECT policy exposes full permitted business rows through the table API; safe menu projections should be served separately.
- Broad authenticated business update and financial write policies need replacement, preserving legitimate staff workflows.
- Grants include TRUNCATE, REFERENCES and TRIGGER in addition to normal CRUD. These should be restricted. RLS does not govern TRUNCATE; actual API exposure is a separate question. Grants alone do not prove an HTTP exploit or whether RLS is enabled.
- The grants paste ends at sale_items SELECT and is incomplete. RLS-enabled flags and complete supplementary table definitions were not supplied.

The preflight script now includes all public-table columns, enum labels and RLS flags. Execute each SELECT separately to avoid losing earlier result sets in the editor. Needed next: full columns for product_ingredients/sale_item_extras, enum labels, RLS flags, complete grants. Function definitions/schema-only export are still needed for complete migration compatibility review.

The new browser backup migration is additive and compares membership IDs as text to accommodate either UUID or text schemas. It does not repair these existing issues. Deploy only alongside reviewed identity/tenant security controls. See AUTOMATIC-RECOVERY.md for limits and recovery operation.

## Follow-up evidence and launch decision

The owner supplied the extra table definitions and RLS flags. `sale_item_extras` uses bigint sale_item_id/product_id while the parent tables use UUID identifiers; it has no reported foreign keys or tenant column, and RLS is disabled. Anonymous CRUD grants are present. A reviewed containment script is prepared in `supabase/remediation/20261022_contain_legacy_extras.sql`; it preserves records and quarantines API access to that unused legacy table. It has been tested with a synthetic reproduction, but has NOT been applied to the hosted project.

All other listed tables have RLS enabled/forced, but their permissive policies still require the previously identified fixes. The grants output again ends at 100 rows; the enum query output was not included. The preflight script now returns ONE JSON report containing all sections to avoid editor truncation/result-tab confusion.

The owner confirmed the current database contains only test data and wants to preserve the demo. The agreed café path is a separate clean project; the existing project remains untouched. This removes legacy migration compatibility from the café's launch path, but does not repair the old hosted project's exposure. No further legacy schema exports are required to prepare the clean installation. Follow CAFE-LAUNCH.md.
