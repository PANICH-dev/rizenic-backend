const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'repair.html'), 'utf8');

test('repair page keeps outer viewport locked and delegates scrolling to active calendar/summary areas', () => {
  assert.match(html, /body\s*\{[^}]*height:\s*100vh;[^}]*overflow:\s*hidden;/s);
  assert.match(html, /<main[^>]*class="[^"]*repair-main[^"]*overflow-hidden[^"]*"/);
  assert.match(html, /id="repair_calendar_scroll"[^>]*class="[^"]*repair-tab-scroll[^"]*"/);
  assert.match(html, /id="repair_summary_scroll"[^>]*class="[^"]*repair-tab-scroll[^"]*"/);
});

test('calendar is fully contained without a nested scrollbar while summary keeps its own sticky scroll surface', () => {
  assert.match(html, /class="[^"]*repair-calendar-head[^"]*"/);
  assert.match(html, /class="[^"]*repair-calendar-weekdays[^"]*"/);
  assert.match(html, /class="[^"]*repair-summary-card-head[^"]*"/);
  assert.match(html, /#tab-calendar\s*\{[^}]*overflow:\s*hidden;/s);
  assert.match(html, /\.repair-calendar-head\s*\{[^}]*position:\s*relative;/s);
  assert.match(html, /\.repair-calendar-weekdays\s*\{[^}]*position:\s*relative;/s);
  assert.match(html, /#repair_calendar_scroll\s*\{[^}]*overflow:\s*hidden;/s);
  assert.match(html, /\.repair-summary-card-head\s*\{[^}]*position:\s*sticky;/s);
});
