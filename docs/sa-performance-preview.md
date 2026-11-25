# SA performance preview

Run `migrations/20261125_sa_activity.sql` in the Neon database used by the Preview deployment before testing. It is safe to rerun the migration if the check-in columns were already added. It does not backfill check-ins from appointment dates.

## Job form

- Section 1 adds Service Visit # (text) and the customer source dropdown.
- Customer sources are managed in Admin. Disabling or renaming a source does not rewrite historical job labels.
- Insurance submission date is next to the claim number. Select the actual date, then confirm once. The database separately records the confirmation time.
- Arrival and delivery confirmations use server time. Planned dates remain unchanged.
- All three confirmations freeze the saved job's SA owner and store the logged-in employee name supplied by the existing portal as the recorder. A changed SA must be saved before confirmation.
- Once confirmed, buttons are locked. Repeated API requests return the existing confirmation rather than overwriting it. This version does not provide correction/cancellation of confirmations.

## Dashboard and LINE

- SA report date defaults to today's date in Asia/Bangkok.
- Counts show the selected day and month-to-date, ending on that date. Receiving customers counts jobs by contact date, not distinct people. Missing historical confirmations are not guessed.
- Check-in counts use the frozen SA name. Contact and repair-completion counts use the current job owner because historical ownership is not available for those fields.
- Repair completion uses repair_finish_date compared to target_finish_date. Missing targets are shown separately, not counted as on-time. Cancelled/closed/delivered jobs are excluded from open overdue work.
- Preview the exact SA message in the dashboard. Production sends the original report and the SA summary together as two text messages in the existing LINE push request.
- Vercel Preview does not send real LINE messages. Database changes made through Preview still use the Neon database configured for that deployment.

## Validation

`node --test tests/sa_activity.test.cjs tests/sa_job_metadata.test.cjs tests/sa_line_report.test.cjs`

The tests mock database and LINE transport. No real customer records or LINE groups are modified.
