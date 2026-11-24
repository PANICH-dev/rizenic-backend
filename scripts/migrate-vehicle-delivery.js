// Run once before deploying the delivery form changes.
require('dotenv').config({ quiet: true });
const fs = require('fs');
const pool = require('../config/db');
(async () => {
  try {
    await pool.query(fs.readFileSync(require('path').join(__dirname, '../migrations/20261124_vehicle_delivery.sql'), 'utf8'));
    console.log('Delivery inspection schema is ready. Existing E-Claim vehicle fields are unchanged.');
  } catch (error) {
    console.error('Migration failed:', error.code || 'database connection/configuration error');
    process.exitCode = 1;
  } finally { await pool.end(); }
})();
