const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pub = path.join(__dirname, '..', 'public');
const html = fs.readFileSync(path.join(pub, 'jobs.html'), 'utf8');
const js = fs.readFileSync(path.join(pub, 'jobs.js'), 'utf8');

function functionBody(name) {
  const marker = `function ${name}(`;
  const start = js.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist`);
  const brace = js.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < js.length; i++) {
    if (js[i] === '{') depth++;
    else if (js[i] === '}') {
      depth--;
      if (depth === 0) return js.slice(start, i + 1);
    }
  }
  assert.fail(`could not parse ${name}`);
}

test('SA search input explicitly searches Service Advisor names on Enter', () => {
  assert.match(html, /id="sa_search_plate_input"[^>]*onkeydown="if\(event\.key==='Enter'\) searchSAByNameFromSAView\(\)"/);
  assert.match(html, /placeholder="ค้นหา รายชื่อ Service Advisor \(SA\)"/);
});

test('SA search filters by sa_owner and never by car_plate', () => {
  const body = functionBody('searchSAByNameFromSAView');
  assert.match(body, /sa_owner/);
  assert.match(body, /toLowerCase\(\)\.includes\(query\)/);
  assert.doesNotMatch(body, /car_plate/);
});

test('SA search restores all cards on empty, opens one match, filters multiple, and reports none', () => {
  const body = functionBody('searchSAByNameFromSAView');
  assert.match(body, /if\s*\(!query\)[\s\S]*renderSAList\(\)/);
  assert.match(body, /matches\.length\s*===\s*1[\s\S]*openSADetail\(matches\[0\]\)/);
  assert.match(body, /matches\.length\s*===\s*0[\s\S]*ไม่พบ Service Advisor/);
  assert.match(body, /renderSAList\(query\)/);
});

test('SA card renderer accepts an optional name query and filters SA cards only', () => {
  assert.match(js, /function renderSAList\(searchQuery\s*=\s*''\)/);
  assert.match(js, /sortedSAs[\s\S]*filter\([\s\S]*toLowerCase\(\)\.includes\(normalizedSearch\)/);
});
