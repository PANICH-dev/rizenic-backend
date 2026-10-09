const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const empResult = await pool.query('SELECT * FROM rizenicemployeemaster WHERE username = $1 AND password = $2', [username, password]);
    if (empResult.rows.length > 0) {
      return res.json({ success: true, user_type: 'employee', employee: empResult.rows[0] });
    }
    const partnerResult = await pool.query('SELECT * FROM rizenic_partners WHERE username = $1 AND password = $2', [username, password]);
    if (partnerResult.rows.length > 0) {
      return res.json({ success: true, user_type: 'partner', partner: partnerResult.rows[0] });
    }
    res.status(401).json({ success: false, error: 'Username หรือ Password ไม่ถูกต้องครับนาย!' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;