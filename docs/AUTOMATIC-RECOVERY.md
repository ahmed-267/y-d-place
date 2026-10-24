# Automatic browser recovery copies

Implemented locally; not enabled on the live site until the database migration and app are deployed. Apply `20261021000000_browser_backups.sql` only after the deployed schema/security review. This migration uses text comparisons for existing UUID membership IDs, but does not repair existing membership policies or other schema incompatibilities.

Authenticated cloud businesses automatically upload local operational recovery snapshots two seconds after opening the app, then check for changes every minute and when connectivity returns. Demo/local accounts do not upload. The header shows pending, successful or failed status. Keep the app open until success before retiring a device. Offline changes cannot be protected in the cloud until connectivity returns. Closing a browser before the next successful backup leaves a recovery gap.

Included: categories, availability, tax settings, cash sessions, floor plans, waste logs, customers and shift logs. Excluded: cached users/passwords, tokens, sales, catalogue and other authoritative cloud records. These are recovery copies, not cross-device synchronisation or an offline transaction queue.

Copies are isolated by business, authenticated user and browser device ID. Three most recent changed snapshots are retained per device/account. At most 20 device/account combinations per business and 1 MiB per snapshot are accepted. Limits fail visibly; they never silently discard oversized data. Device retirement currently requires an administrator to review/export and remove old rows via the database. The application cannot delete backups. Max payload storage is approximately 60 MiB per business plus indexes/JSON overhead; monitor database capacity.

Click the backup status to list and download recovery copies. Owners see their business's copies; other members only their own. Downloads contain private operational data and must be stored privately. Recovery is intentionally reviewed: reconcile downloaded records with current local state and cloud IDs before importing. There is no automatic restore or sales replay. Routine uploading is automatic; recovery still needs technical assistance.

This table lives in the same database. It does not protect against loss of that database, and does not replace scheduled independent database backups and restore testing. Existing browser data requires opening the updated app on each relevant browser once and waiting for successful backup; it cannot be retrieved remotely from a closed device.

Manual staging checks:
1. Sign in with a real staging account; create a customer. Within one minute status reports success. Open the status and download a copy; confirm the record appears and credentials/sales do not.
2. Disconnect, change a local record and wait one minute. Status must report failure. Reconnect; the next successful upload contains the change.
3. Use another browser. Both device IDs must remain separately downloadable. Do not expect their records to merge.
4. As staff, attempt to select another member's backup directly: no rows. As a different business's owner, no foreign backup rows. Anonymous access and direct writes are denied.
5. Make four changed snapshots at least 30 seconds apart. Only the latest three remain for that device/account.
6. Reload and confirm an unchanged snapshot does not create a duplicate. Failed requests retry without reporting success.
