# Server-side All Heavy Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the remaining heavy read paths to server-scoped APIs without any database schema/index/data migration.

**Architecture:** Keep existing write APIs and UI behavior. Add read-only server view endpoints for dashboard, SA/jobs, parts alerts, calendar capacity and repair board; use existing paged report API for finance/history/jobs table/export/date update. Page-specific client overlays keep invasive edits small.

**Tech Stack:** Node.js, Express, PostgreSQL, browser JavaScript, node:test.

**Spec:** User request in current conversation: server-side every heavy page, no DB modifications.

## Global Constraints
- No CREATE/ALTER/DROP/CREATE INDEX or data migration.
- No changes to existing database records as part of the patch.
- Preserve existing write/edit flows and primary UI behavior.
- Preserve legacy API response formats for callers not migrated in this patch.

## Review Focus
- Manager ALL-branch mode remains usable.
- Branch-restricted users never fetch other branches through migrated page APIs.
- Server view routes are read-only.
- Finance page pagination/filter/sort is server-driven.
- Calendar and repair board no longer download full branch reports.

---

### Task 1: Read-only server view APIs
Create `server_side_views.js`, register it from `app.js`, and add query-builder tests for dashboard/jobs/parts/calendar/repair-board views.

### Task 2: Finance server-side table
Create `public/finance_server.js`, load it after inline finance code, and override load/filter/sort/page/facet operations to use paged `/api/reports` calls.

### Task 3: Dashboard, Jobs and Parts page data views
Create small client overlays so these pages request dedicated server views instead of unrestricted report/order datasets.

### Task 4: Calendar and Repair Board views
Replace full report downloads with month-scoped calendar API and grouped repair-board API.

### Task 5: Verification and package
Run the full test suite, syntax checks, scan runtime source for unrestricted heavy reads, then package a new ZIP.
