const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/jobs.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'public/jobs.js'), 'utf8');

test('jobs SA view search waits for Enter and searches car plate like the legacy behavior', () => {
  const input = html.match(/<input[^>]+id="sa_search_plate_input"[^>]*>/)?.[0] || '';
  assert.match(input, /onkeydown="[^"]*event\.key===['"]Enter['"][^"]*searchCarByPlateFromSAView\(\)/);
  assert.match(input, /ค้นหาทะเบียนในหน้านี้/);
  assert.doesNotMatch(input, /searchSAByNameFromSAView/);
});

test('jobs SA view plate search filters by car_plate and not sa_owner as the query field', () => {
  const start = js.indexOf('function searchCarByPlateFromSAView()');
  assert.notEqual(start, -1, 'missing searchCarByPlateFromSAView');
  const next = js.indexOf('\nfunction ', start + 10);
  const fn = js.slice(start, next === -1 ? js.length : next);
  assert.match(fn, /car_plate/);
  assert.match(fn, /matchedJobs/);
  assert.match(fn, /openSADetail/);
  assert.doesNotMatch(fn, /function searchSAByNameFromSAView/);
});
