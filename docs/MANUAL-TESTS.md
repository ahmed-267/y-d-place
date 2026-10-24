# Manual staging acceptance tests

Use a staging Supabase project, Stripe test mode, two synthetic businesses (A/B), and separate browser profiles for owner, manager and staff. Do not run mutation tests on real business records.

Run the automated suite first: `npm test`, `npm run lint`, `npm run build`, and `npm run test:db` following the isolated Docker setup in [SECURITY-ROLLOUT.md](SECURITY-ROLLOUT.md). With Vite running on localhost, `npm run test:browser` checks the demo without allowing external requests.

| Test | Expected result |
|---|---|
| Register, confirm email, onboard, sign out/in | One owner and business; settings persist |
| Invite and sign in as manager/staff | Correct permissions and functioning portals |
| Attempt self-promotion or business reassignment through the API | Rejected; profile remains unchanged |
| Read/update/delete B records as an A user | No private B data or changes |
| Edit plan, trial dates or Stripe identifiers as an owner | Rejected; billing fields remain server-controlled |
| Sign out of A and into B on the same browser | No A operational or browser-local data appears in B |
| Create/edit/delete product, ingredient, prepared stock, rota and own shifts; reload and inspect another device | Saved values agree |
| Disconnect before saving | Clear failure; no saved cloud record; recovery artifact retained when browser storage is available |
| Edit the same stock record from two stale devices | Latest changes preserved or explicit conflict; no silent overwrite |
| Watch Network after a realtime order/stock update | No repeating identical write requests |
| Sell with extras, discount and tip | Receipt, sale and order agree; stock deducted once |
| Double-submit checkout or retry after interrupted response | One sale and one stock deduction |
| Two tills compete for one remaining unit | One success, one failure, stock zero; failed ticket retained |
| Staff requests an over-limit discount | Requires a real same-business manager; manager authentication does not replace staff session |
| Refund a new sale twice | Stock restored once; original recipe consumption used even after recipe edits |
| Change product price/name, then reopen old receipt | Original historical line details preserved |
| Correct sale payment method | Correction persists; item totals remain tied to original lines |
| Remove a sale | Voided/archive record remains for audit, hidden from normal reports |
| Place a signed-out public pre-order | Correct business, prices, extras, customer details and timestamps persist |
| Replay same public request ID and body | Same order returned; no duplicate |
| Reuse public request ID with changed content | HTTP 409 |
| Tamper with prices, quantities, extras or collection time | Trusted prices used; invalid input rejected |
| Disable online ordering and submit a new order | Rejected |
| Read business/product tables anonymously | Denied; safe menu endpoint still works |
| Scan sample menu/receipt as subscribed owner/manager | Reviewable valid results; no automatic unreviewed import |
| Try AI without a session, with custom model/oversized input, or beyond limits | Rejected; demo uses clearly named sample fixtures |
| Complete Stripe test checkout, cancel, simulate failure, then recover | Correct entitlement; billing portal remains reachable |
| Replay signed Stripe webhook; send invalid signature; simulate database failure | No duplicate effects; invalid signatures rejected; write failure remains retryable |
| Visit all roles/tabs on desktop/mobile and test exports | No blank screens/runtime errors; reports and downloads work |

## Direct staging security requests

UI visibility does not prove enforcement. The database suite tests direct SQL operations. For a manual API check, use a STAGING test user's bearer token and the public anon key, never a service-role key:

```js
const base = 'https://YOUR-STAGING-PROJECT.supabase.co';
const headers = { apikey: 'PUBLIC_ANON_KEY', Authorization: 'Bearer TEST_USER_ACCESS_TOKEN', 'Content-Type': 'application/json', Prefer: 'return=representation' };
// Expect an error and unchanged role after reload.
await fetch(`${base}/rest/v1/app_users?id=eq.TEST_USER_UUID`, {method:'PATCH', headers, body:JSON.stringify({role:'owner'})}).then(r=>r.json());
// Expect no business-B records when signed in to A.
await fetch(`${base}/rest/v1/orders?business_id=eq.BUSINESS_B_ID`, {headers}).then(r=>r.json());
// Expect rejection even as the business owner.
await fetch(`${base}/rest/v1/businesses?id=eq.BUSINESS_A_ID`, {method:'PATCH',headers,body:JSON.stringify({plan:'pro'})}).then(r=>r.json());
```

Keep tokens out of chat and version control. Record account/role, expected result, actual result and error/screenshot for any failure. Record local, staging and production verification separately.

## Existing-data limitations to check

Older sales lack an original stock-consumption ledger; reconcile historical stock corrections manually rather than inventing recipe history. Browser-local till sessions, floor plans, customers and other local-only modules remain local-only. Back up and reconcile their recovery records before clearing browser data or moving devices. See the rollout guide for export instructions.
