const express = require('express');
const pool = require('../config/db');
const router = express.Router();

router.get('/delivery-inspection/:jobId', async (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.jobId)) return res.status(400).json({ error: 'เลขใบงานไม่ถูกต้อง' });
  try {
    const result = await pool.query('SELECT form_data, updated_at FROM delivery_inspections WHERE job_id=$1', [req.params.jobId]);
    if (!result.rows.length) return res.status(404).json({ error: 'ยังไม่มีใบตรวจสอบก่อนส่งมอบ' });
    res.json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: 'โหลดใบตรวจสอบก่อนส่งมอบไม่สำเร็จ' }); }
});

router.put('/delivery-inspection/:jobId', async (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.jobId)) return res.status(400).json({ error: 'เลขใบงานไม่ถูกต้อง' });
  const data = req.body.form_data;
  if (!data || typeof data !== 'object' || Array.isArray(data) || JSON.stringify(data).length > 2000000) {
    return res.status(400).json({ error: 'ข้อมูลใบตรวจสอบไม่ถูกต้องหรือมีขนาดใหญ่เกินไป' });
  }
  try {
    await pool.query(`INSERT INTO delivery_inspections(job_id,form_data) VALUES($1,$2::jsonb)
      ON CONFLICT(job_id) DO UPDATE SET form_data=EXCLUDED.form_data,updated_at=CURRENT_TIMESTAMP`, [req.params.jobId, JSON.stringify(data)]);
    res.json({ success: true });
  } catch (error) {
    res.status(error.code === '23503' ? 404 : 500).json({ error: error.code === '23503' ? 'ไม่พบใบงานหลัก' : 'บันทึกใบตรวจสอบก่อนส่งมอบไม่สำเร็จ' });
  }
});

module.exports = router;
