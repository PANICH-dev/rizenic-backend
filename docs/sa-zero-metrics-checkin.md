SA zero metrics and check-in owner correction (2026-11-26)

- SA cards hide when there is no pending work, shared membership, selected-month billing or other tracked nonzero activity. Historical primary ownership alone no longer keeps an inactive card visible.
- Individual zero metric sections are hidden in the overview, header and detail. Shared-only staff remain visible. Changing months restores nonzero sections. No customer data is removed or changed by this display logic.
- Check-in used to compare the dropdown employee ID with the saved employee name, falsely treating unchanged ownership as an edit. It now compares saved employee IDs. Legacy records without IDs compare normalized names. Unsaved changes and different employees sharing a name are still rejected.
- Browser and mocked tests cover unchanged check-in, unsaved ownership, legacy names, shared-only cards, hidden historical-only cards and month changes. No production records were changed during verification. No database migration is required.
