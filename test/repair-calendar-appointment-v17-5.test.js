const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('repair work board and calendar use appointment_date as the scheduled arrival field', () => {
  const js = read('public/repair.js');
  const views = read('server_side_views.js');

  assert.match(js, /key:\s*'appointment_date',\s*title:\s*'วันนัดเข้า'/);
  assert.doesNotMatch(js, /key:\s*'arrived_date',\s*title:\s*'รถเข้า'/);
  assert.match(js, /const appointmentQty = Number\(dayData\.appointment \|\| 0\)/);
  assert.match(js, /filterBoardByDate\('\$\{dateStr\}',\s*'appointment'\)/);
  assert.match(js, /appointment:\s*'appointment_date'/);

  assert.match(views, /REPORT_REPAIR_FIELDS[\s\S]*'appointment_date'/);
  assert.match(views, /REPAIR_FILTER_FIELDS[\s\S]*'appointment_date'/);
  assert.match(views, /REPAIR_STATION_SQL[\s\S]*'01\.เคาะ'/);
  assert.match(views, /field === 'calculated_station'[\s\S]*REPAIR_STATION_SQL/);
});

test('repair calendar uses dedicated month aggregate instead of the current server-side table page', () => {
  const server = read('public/repair_server.js');
  const views = read('server_side_views.js');

  assert.match(views, /app\.get\('\/api\/server\/repair-calendar'/);
  assert.match(views, /appointment_date::date/);
  assert.match(server, /\/api\/server\/repair-calendar/);
  assert.match(server, /repairCalendarDays/);
});

test('repair summary loads full active station data separately from the current 50-row page', () => {
  const server = read('public/repair_server.js');
  const views = read('server_side_views.js');

  assert.match(views, /app\.get\('\/api\/server\/repair-summary'/);
  assert.match(server, /\/api\/server\/repair-summary/);
  assert.match(server, /repairSummaryJobs/);
});

test('calendar controls and the full month remain inside one fixed-height calendar surface with no nested scrollbar', () => {
  const html = read('public/repair.html');
  const css = read('public/repair_calendar.css');

  assert.match(html, /repair_calendar\.css\?v=23/);
  assert.match(css, /#tab-calendar\s*\{[^}]*overflow:\s*hidden;/s);
  assert.match(css, /#tab-calendar\s+#repair_calendar_scroll\s*\{[^}]*overflow:\s*hidden;/s);
  assert.match(css, /\.repair-calendar-head[^}]*position:\s*relative/s);
  assert.match(css, /\.repair-calendar-weekdays[^}]*position:\s*relative/s);
  assert.match(css, /grid-template-rows:\s*repeat\(var\(--repair-calendar-weeks,\s*5\),\s*minmax\(0,\s*1fr\)\)/);
  assert.doesNotMatch(css, /#repair_calendar_scroll[^}]*overflow-y:\s*auto/);
});

test('repair board uses explicit queue scope except when a calendar date filter opens the complete date scope', () => {
  const server = read('public/repair_server.js');
  const views = read('server_side_views.js');

  assert.match(server, /if \(isCalendarFilterActive\) params\.set\('calendar', '1'\)/);
  assert.match(views, /const calendarMode = clean\(req\.query\.calendar\) === '1'/);
  assert.match(views, /const reportWhere = repairQueueConditions\(calendarMode\)/);
});
