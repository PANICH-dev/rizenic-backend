const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/jobs.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'public/jobs.js'), 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

test('jobs search result modal has its own scroll surface and fixed pagination footer', () => {
  assert.match(html, /id="jobListModalScroll"/);
  assert.match(html, /id="jobListModalFooter"/);
  assert.match(html, /id="modal_job_range"/);
  assert.match(html, /id="modal_job_total"/);
  assert.match(html, /id="modal_job_pagination"/);
  assert.match(html, /id="modal_job_page_size"/);
  for (const size of [10, 20, 30, 50]) {
    assert.match(html, new RegExp(`<option value="${size}"`));
  }
  assert.match(html, /#jobListModal[\s\S]*\.job-modal-table[\s\S]*position:\s*sticky/);
});

test('modal pagination calculates page bounds without changing the source result set', () => {
  const fn = extractFunction(js, 'getModalPaginationState');
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${fn}; this.getModalPaginationState = getModalPaginationState;`, context);

  const state = context.getModalPaginationState(43, 3, 10);
  assert.deepEqual(JSON.parse(JSON.stringify(state)), {
    totalItems: 43,
    page: 3,
    pageSize: 10,
    totalPages: 5,
    startIndex: 20,
    endIndex: 30,
    rangeStart: 21,
    rangeEnd: 30,
  });
});

test('modal pagination exposes compact numbered page tokens', () => {
  const fn = extractFunction(js, 'getModalPageTokens');
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${fn}; this.getModalPageTokens = getModalPageTokens;`, context);

  assert.deepEqual(
    JSON.parse(JSON.stringify(context.getModalPageTokens(12, 6))),
    [1, '…', 4, 5, 6, 7, 8, '…', 12]
  );
});

test('modal rendering slices only the visible page and page-size/page navigation rerender locally', () => {
  assert.match(js, /modalJobState\s*=\s*\{/);
  assert.match(js, /pageJobs\s*=\s*jobs\.slice\(paging\.startIndex,\s*paging\.endIndex\)/);
  assert.match(js, /function changeModalJobPageSize\(/);
  assert.match(js, /function goToModalJobPage\(/);
  assert.match(js, /renderModalJobPage\(\)/);
  assert.match(js, /jobListModalScroll[\s\S]*scrollTo/);
});
