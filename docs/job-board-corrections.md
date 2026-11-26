Job board corrections (2026-11-26)

- Station endpoint updates only explicitly supplied fields. Quota checks and the write share a transaction. Omitted dates, status, department, notes and flags are preserved. Explicit false/null remain supported.
- Parts picker saves name and quantity atomically, avoiding partial edits after quota rejection.
- Bulk import validates before starting writes, checks every result, keeps failed rows open and skips successful rows on retry.
- Key desk checks delete/create/update responses and retains IDs returned by successful creates, preventing duplicate creates after partial failure.
- Excel, repair table and station cards display primary SA and collaborator names using the employee ID columns. Editing ownership opens the job form. Service overview separates main/shared views without adding collaborators to primary financial totals.
- Shared date/status helpers use Asia/Bangkok; arrival excludes status 08 and cancellation. Delivered statuses are 12/13/14/15/16/17/19.
- Board visibility controls use the latest snapshot; transitions compare job IDs, and failed loads display a stale-data notice.
- Table responses use an explicit field whitelist (including optional legacy values when present; the DB query still reads the row) and non-management table/overview requests filter by branch on the server. Directory requests exclude login credentials. Customer-entered text in touched render paths is escaped.

Validation uses mock database transactions and local browser fixtures. No live customer records or LINE messages are changed. Existing employee assignment columns are required; no additional migration is needed for this change. This is not a replacement for server-side authentication/authorization.
