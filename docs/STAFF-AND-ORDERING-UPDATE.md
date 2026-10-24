# Staff leave and online ordering update

Implemented locally. No hosted settings or database were changed.

## Time off

Staff request 1–90 consecutive days from My Shifts using First day / Last day. All days in the range are included. Requests start pending and do not alter shifts. Staff see their status; managers and owners review requests in Staff. Approval creates one leave record per day. Rejection creates none. A reviewer cannot review their own request. Existing work shifts/rota must be reviewed before conflicting leave can be approved. Dates before today and overlapping pending/approved requests are rejected. Request IDs and review locks prevent duplicate records on retries. Staff cannot directly insert, edit or delete approved leave, including through the generic mutation API. Approved leave is included in rota conflict checks.

Pending requests are loaded every ten seconds. Demo mode uses local synthetic requests; the real app uses the leave_requests table and protected RPCs. Existing directly-entered leave is retained; the new approval requirement applies to new staff requests.

On a database already running the reviewed baseline and previous security migrations, apply `20261023000000_leave_requests.sql` and `20261023010000_retire_saved_tickets.sql` before deploying this UI. For a fresh database the generated install-fresh.sql includes them. Do NOT apply these against the old incompatible UUID schema without the previously documented migration review.

## Removed feature

The saved-ticket feature was removed from the till, types, settings, onboarding, persistence and recovery payloads. Cleanup removes its old module flag and backup field. Completed sales and orders are unaffected. Local legacy drafts are ignored/removed as the business cache is read; they are never replayed as orders.

## Scanning limits

Menu scans, receipt/bill scans, product assistance and brand stories share the authenticated AI endpoint. Limits are 20 requests per user per 60 seconds and 200 per business per 24-hour window. They use the database-backed limiter across server instances. Limit rejection returns HTTP 429 before the paid provider is called; limiter failure fails closed. Owner/manager membership and active subscription are required. These limits are already in the local security implementation; tests now explicitly cover menu and receipt rejection. They are not confirmed active on an older hosted deployment.

## Public pre-orders

The server-client configuration used to incorrectly require the anon key in addition to service credentials. It now requires only a Supabase URL and the server-only service-role key. Both public menu and public order use that client. The public menu exposes selected safe fields; anonymous table access has NOT been restored.

Netlify Functions must receive SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY for the correct project. A working frontend proves only that its build received the public values. Set server credentials in Netlify's Functions scope for the deployed context, then redeploy. Never name the service key with a VITE_ prefix. Configuration failures give customers a neutral unavailable message and log the missing variable names (never their values) server-side. Actual deployed configuration remains unverified without hosting access.

## Checks

- `npm test` includes scan rate-limit rejection and a public-menu request with no anon key configured.
- `npm run test:db` includes pending/multi-day requests, idempotency, manager approval, rejection, cross-business denial and direct API bypass prevention.
- `node scripts/test-leave-browser.mjs` exercises staff submission, manager approval and reload persistence in demo with all external requests blocked.
