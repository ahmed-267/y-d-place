# Registration and onboarding repair

The localhost Supabase project was checked with read-only REST queries requesting zero rows. It returned missing-column errors for `businesses.address` and `app_users.numeric_id`. It is still the legacy schema, not the schema expected by this application. No hosted data or configuration was changed.

Code repairs:
- Supabase auth callbacks return immediately. Profile queries run after the auth lock is released, preventing login deadlock.
- Login and confirmation routing wait for account hydration; lookup errors are no longer mistaken for a new account needing onboarding.
- Database and auth HTTP requests have an abort deadline. Onboarding always clears its saving state after failures.
- Setup checks required schema fields before writes and stops on failed account/business lookups.
- Retrying setup for an existing owned business saves the entered settings instead of silently ignoring them.
- Confirmation resends use the same login redirect as registration. Registration explains that existing users should sign in or reset their password rather than keep registering.

Verification: `node scripts/test-auth-browser.mjs` covers password login, missing schema, unconfirmed email and confirmation-link onboarding using mocked responses, without sending email. This does not certify live email delivery or live onboarding against the incompatible database.

A tested upgrade is now prepared for the existing UUID project: see LEGACY-DATABASE-UPGRADE.md. It preserves the original tables in a private archive and imports compatible live records. This replaces the previous requirement to create a separate project for this known legacy schema. `supabase/install-fresh.sql` is for an empty database only; do not run it against the existing populated legacy database. Preserve the existing test project. A compatible schema is needed for all customers, not a separate setup for each café. After configuration, test a complete live registration, confirmation, business setup, menu save and sign-out/sign-in cycle. Do not deploy based solely on mocked browser tests.

Business and owner-profile provisioning now uses one atomic RPC. Failed profile writes roll back business creation, retries reuse the same business, and an unfinished self-profile can be attached only to a business the authenticated user owns. This requires the atomic-onboarding migration included in both generated installers.
