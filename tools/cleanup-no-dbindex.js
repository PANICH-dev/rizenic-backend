const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const obsolete = path.join(root, 'database_performance_indexes.sql');

if (fs.existsSync(obsolete)) {
  fs.rmSync(obsolete);
}
