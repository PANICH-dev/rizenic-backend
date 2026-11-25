# Quota corrections and check-in cancellation

## Scope

No Manager/BA approval workflow or new role policy is introduced. Existing quota settings, counting per Job, zero-as-unlimited behavior and daily overrides remain.

## Quota behavior

- Arrival uses arrived_date; target-car and main/sub-part capacity use target_finish_date; delivery uses delivery_date.
- Updating an unchanged reservation, or reducing its quantity, is allowed even if the date is now over capacity. Moving dates/branches or increasing quantities must fit the destination capacity.
- Job create/update, station-board edits, inline date edits and dynamic imports use the same server validator.
- Capacity checking and writing run in one transaction protected by a shared PostgreSQL transaction advisory lock. Quota configuration writes acquire that lock too. Direct manual SQL writes outside the application do not participate in this lock.
- Front-end prechecks fail closed when the API fails. The calendar keeps the original booking selectable, but the save endpoint always validates increases again under the lock.
- Quota calendar queries project only required fields and filter the branch; no photos or full inspection payloads are fetched.
- Failed inline saves show the quota reason and restore the old display.

## Check-ins

- Insurance submission defaults to today's date automatically. Server time is used when confirming today. Backdated submission dates remain supported, with the actual recording time displayed separately.
- Arrival/delivery use automatic server timestamps as before.
- A confirmed event can be cancelled with a required reason. The original timestamp, SA, recorder, cancellation timestamp, canceller and reason are appended to checkin_cancel_history in the same atomic update that clears the active event.
- Cancellation compares the timestamp loaded by the page with the current event. A stale page cannot cancel a newer confirmation. Reconfirmation is allowed after cancellation.
- Cancellation does not clear booking dates or alter quota settings. Insurance totals are recalculated from active confirmations; arrival/delivery report totals still use their existing status/date rules.
- Actor names use the existing portal identity mechanism; no new role-based authorization is claimed in this change.

## Database prerequisite

Run `migrations/20261125_checkin_cancel.sql` in Neon before enabling cancellation. It adds only the JSONB history column and is safe to rerun. The quota fixes do not need a schema change. Until migration, cancellation fails without clearing the existing event.

## Verification

`node --test tests/*.test.cjs`

Unit/API simulations cover unchanged over-capacity reservations, date changes, part increases, simultaneous last-slot requests, rollback, inline/station/import paths, UI restoration, automatic time, cancellation history, reconfirmation and stale cancellation. No live customer records or LINE messages are modified by the tests. Real Neon transaction behavior has not been exercised because local database credentials are unavailable and the migration is deferred.
