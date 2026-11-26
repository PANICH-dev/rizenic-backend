Report period and history changes (2026-11-26)

- Existing active-only table rules remain unchanged. Labels now say In Process and explain excluded groups 13–21, billed jobs and accounting routing.
- SA month/year controls are visible for both list and detail views. The selection updates billing totals and calendars; pending workload and main/shared membership totals stay cumulative, explicitly labeled. Years come from contact, arrival, target, delivery and billing dates.
- Historical report includes collaborator names in the table, column controls, filters and Excel export. Ownership edits open the main form. Directory requests omit credentials; table payloads omit document data.
- Dashboard arrival counts use actual arrived_date and status 09/10/11/12/13/14/15/16/17/19, excluding appointment-only jobs. Delivery statuses use 12/13/14/15/16/17/19. Cards and detail lists share predicates.
- Client overdue predicates and current-date helpers use common Bangkok business-date rules. Completed repairs and delivered cases do not receive an open overdue flag. Vehicle-based SA performance reports retain their existing grouping; list rows and dashboard KPIs count jobs.
- No schema change or live customer mutation was performed for this UI work. Local browser tests cover period controls and history export; mock tests cover KPI/list consistency.
