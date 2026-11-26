const {createEmployeeSession}=require('../services/tracking_sessions');
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const empResult = await pool.query('SELECT * FROM rizenicemployeemaster WHERE username = $1 AND password = $2', [username, password]);
    if (empResult.rows.length > 0) {
      let employeeSession=null,trackingSessionError=null;try{employeeSession=await createEmployeeSession(pool,empResult.rows[0]);if(!employeeSession)trackingSessionError='EMPLOYEE_NOT_ACTIVE';}catch(error){trackingSessionError=['42P01','42703'].includes(error.code)?'TRACKING_SCHEMA_REQUIRED':'TRACKING_SESSION_UNAVAILABLE';console.warn('Tracking session unavailable:',error.code||'unexpected');}
      return res.json({ success: true, user_type: 'employee', employee: empResult.rows[0], employee_session:employeeSession, tracking_session_error:trackingSessionError });
    }
    const partnerResult = await pool.query('SELECT * FROM rizenic_partners WHERE username = $1 AND password = $2', [username, password]);
    if (partnerResult.rows.length > 0) {
      return res.json({ success: true, user_type: 'partner', partner: partnerResult.rows[0] });
    }
    res.status(401).json({ success: false, error: 'Username หรือ Password ไม่ถูกต้องครับนาย!' });
  } catch (e) { console.error('Employee login failed:',e.code||'unavailable');res.status(500).json({ error: 'เข้าสู่ระบบไม่ได้ในขณะนี้ กรุณาลองใหม่หรือติดต่อผู้ดูแล' }); }
});

module.exports = router;