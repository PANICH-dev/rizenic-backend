Customer tracking (2026-11-26)

Public page
- Brand green/white design with mobile layout. No repair images, folder URLs or photo buttons.
- Full plate and phone are validated on the backend. Formatting and Thai country code/imported missing leading zero are normalized; phone suffixes and job-ID login are not accepted.
- Only customer-facing fields are returned. Customer names, full VIN, private notes, prices, claim documents, credentials and photo links are excluded.
- Service Visit groups related jobs; without it, car identity, branch and visit date are used conservatively. The least advanced active job drives progress. Cancelled jobs do not extend promised dates.
- Actual arrival/check-in is distinct from a future appointment. Delivery remains delivered through statuses 12/13/14/15/16/17/19.
- Data is refreshed on demand, once per minute while visible and on return to the tab. Lookup credentials stay in memory; cached legacy payloads and phone URL parameters are removed. Failed refreshes clearly mark stale data.

24-hour links
- Run migrations/20261126_customer_tracking.sql in Neon before using the link feature. The migration also indexes normalized license plates for lookup. No environment secret is required.
- Employees must sign out and sign in once after the migration/deployment to receive the new opaque employee session. Legacy login continues if the new tables are absent, but link creation fails safely.
- Create-link button uses the saved job. Server validates the employee session, active status and current branch (Manager/Admin/BA may work across branches). Browser-supplied employee names or expiry values do not grant rights.
- Links use 32 random bytes; only SHA-256 hashes are stored. Each link expires 24 hours after creation using the database clock. Requests after expiry/revocation return HTTP 410 without job data.
- Scope is the job IDs in the selected service visit at creation; jobs added later require a new link. Each newly created link has its own expiry; older links do not automatically revoke.
- Anyone holding a valid link can view its limited visit data until expiry. The app prepares a copyable link; it does not send messages.
- Employee sessions expire after eight hours, and role/active/branch changes are checked from the employee master on issuance.

Limits and verification
- Lookup burst limiting is per running instance, not a distributed serverless limit.
- The pre-existing staff API authorization model is outside this scoped change; this work does not make every existing ERP endpoint private.
- Local tests use mocked database transactions and browser fixtures. The SQL migration and real Neon data have not been exercised because migration execution was deferred by the user.
