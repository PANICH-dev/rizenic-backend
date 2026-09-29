const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('repair calendar v23 fits the whole month inside the tab without an internal scrollbar', () => {
  const html = read('public/repair.html');
  const css = read('public/repair_calendar.css');
  const js = read('public/repair.js');

  assert.match(html, /repair_calendar\.css\?v=23/);
  assert.match(html, /repair\.js\?v=12&calendar=28/);
  assert.match(css, /#tab-calendar\s*#repair_calendar_scroll\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /#tab-calendar\s+\.calendar-grid-container\s*\{[^}]*height:\s*100%/s);
  assert.match(css, /grid-template-rows:\s*repeat\(var\(--repair-calendar-weeks,\s*5\),\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /#tab-calendar\s+\.calendar-cell\s*\{[^}]*min-height:\s*0/s);
  assert.doesNotMatch(css, /#repair_calendar_scroll[^}]*overflow-y:\s*auto/s);
  assert.doesNotMatch(css, /grid-auto-rows:\s*minmax\(/);

  assert.match(js, /const\s+calendarWeeks\s*=\s*Math\.ceil\(\(firstDay\s*\+\s*totalDays\)\s*\/\s*7\)/);
  assert.match(js, /grid\.style\.setProperty\('--repair-calendar-weeks',\s*String\(calendarWeeks\)\)/);
  assert.match(js, /grid\.dataset\.weeks\s*=\s*String\(calendarWeeks\)/);
});

test('repair calendar v23 uses full-width horizontal status bars for easier reading', () => {
  const html = read('public/repair.html');
  const css = read('public/repair_calendar.css');
  const js = read('public/repair.js');

  assert.match(html, /class="repair-calendar-legend/);
  assert.match(html, /class="repair-calendar-weekdays/);
  assert.match(css, /\.repair-calendar-weekdays\s*\{[^}]*background:\s*linear-gradient/s);
  assert.match(css, /\.repair-calendar-card\s*\{[^}]*border-radius:\s*16px/s);
  assert.match(css, /\.repair-quota-row/);
  assert.match(css, /\.repair-day-bars\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /\.repair-day-bar-line\s*\{[^}]*border-radius:\s*999px/s);
  assert.match(css, /\.repair-day-bar-fill-arrived/);
  assert.match(css, /\.repair-day-bar-fill-target/);
  assert.match(css, /\.repair-day-bar-fill-delivery/);
  assert.match(css, /#calendar_grid\[data-weeks="6"\]/);
  assert.match(js, /repair-quota-stack/);
  assert.match(js, /repair-quota-row\s+repair-quota-main/);
  assert.match(js, /repair-quota-row\s+repair-quota-sub/);
  assert.match(js, /widthPct/);
  assert.match(js, /repair-day-bar-line repair-day-bar-line-arrived/);
  assert.match(js, /repair-day-bar-line repair-day-bar-line-target/);
  assert.match(js, /repair-day-bar-line repair-day-bar-line-delivery/);
});

test('all non-dashboard calendar surfaces keep the shared overlap guard while dashboard remains untouched', () => {
  const pages = ['public/repair.html', 'public/jobs.html', 'public/jobs_table.html', 'public/index.html'];
  for (const page of pages) {
    assert.match(read(page), /non_dashboard_calendar\.css\?v=2/);
  }
  assert.doesNotMatch(read('public/dashboard.html'), /non_dashboard_calendar\.css/);

  const css = read('public/non_dashboard_calendar.css');
  const jobsJs = read('public/jobs.js');
  const jobsTableJs = read('public/jobs_table.js');
  const saCalendarJs = read('public/sa_calendar.js');
  assert.match(css, /#calendar_grid/);
  assert.match(css, /#sa_calendar_grid/);
  assert.match(css, /#sched_calendar_grid/);
  assert.match(css, /isolation:\s*isolate/);
  assert.match(css, /\.rz-cal-pill/);
  assert.match(css, /\.rz-cal-pill-count/);
  assert.match(css, /\.rz-cal-soft-title/);
  assert.match(jobsJs, /rz-cal-pill/);
  assert.match(jobsJs, /rz-cal-pill-count/);
  assert.match(jobsTableJs, /rz-cal-soft-title/);
  assert.match(saCalendarJs, /rz-cal-soft-title/);
});
