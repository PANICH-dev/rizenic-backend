# SA performance and vehicle counting

## Counting rules

- Insurance work is grouped by vehicle **and service visit**, never by vehicle across its entire lifetime. A valid VIN is preferred; a unique VIN/plate mapping links a Job missing its VIN. Missing/ambiguous identities are not guessed.
- Service Visit # is the primary visit key. Jobs without it can join a visit when their arrival date maps to exactly one Service Visit for that vehicle. Otherwise the exact arrival date, contact date, or Job ID is used conservatively.
- Every non-cancelled main Job in the group must have an insurance confirmation before that vehicle counts once. The completion day is the latest actual submission date. Credit goes to the SA of the last recorded confirmation (Job ID breaks ties). Multiple document sets inside one main Job still belong to that one Job confirmation.
- Pending insurance work is a current, all-time backlog: a group containing status `02.รอเสนอประกัน` and not fully confirmed counts once. If different SAs own pending Jobs, the owner of the earliest pending Job receives the one backlog count. The dashboard lists the vehicle, claim numbers, Job IDs and confirmation progress.
- Parking uses `is_parked = จอดซ่อม` and `arrived_date`, not the check-in timestamp. Delivery uses `delivery_date` with status 12, 13, 14, 15, 16, 17 or 19. Each grouped vehicle visit counts once, using the earliest qualifying date and that Job's current owner.
- Customer receipts and repair completions remain **Job counts**, clearly labelled. They use the current job owner and contact/repair completion dates. Repair target comparison and open overdue work remain available.
- Daily/month-to-date counts use Asia/Bangkok. Pending work is current even when a historical report date is selected. Zero lines are omitted; `0 / nonzero` monthly rows remain. People with no displayed counts are omitted. The insurance message displays pending cars and cars submitted on the selected day.

## Confirmations and documents

The check-in buttons still store first confirmation time, saved SA and logged-in recorder name. A repeated request does not overwrite a confirmation. Insurance actual submission date and recording time remain separate. Planned arrival and delivery dates are unchanged by check-in.

Claim numbers from all document sets are combined and deduplicated into both the intake inspection and pre-delivery document. Saved document fields persist them; reopening refreshes them from the current Job form. Service Visit # remains a separate Tesla reference.

No additional database migration is needed for the vehicle-counting update. The original `migrations/20261125_sa_activity.sql` is still required for the SA feature.

## LINE and validation

Production sends the original RIZENIC report and the SA message together. Preview blocks real LINE sends and uses the database configured in Vercel.

`node --test tests/sa_activity.test.cjs tests/sa_vehicle_report.test.cjs tests/sa_job_metadata.test.cjs tests/sa_line_report.test.cjs`

Tests mock database/LINE transport and cover grouping, partial confirmations, separate visits, attribution, status/month counting, zero suppression, metadata persistence and message batching. They never change real customer records or send to real LINE groups.
