const express = require('express');
const router = express.Router();
const pool = require('../config/db');

async function checkColorPartsQuota(branch_name, dateStr, newMainQty, newSubQty, excludeReportId = null) {
    if (!dateStr || !branch_name) return null; 
    const targetDate = dateStr.split('T')[0]; 
    const quotaRes = await pool.query(`SELECT * FROM rizenic_quotas WHERE branch_name = $1 AND (quota_type = 'default' OR (quota_type = 'special' AND quota_date = $2)) ORDER BY quota_type DESC LIMIT 1`, [branch_name, targetDate]);
    if (quotaRes.rows.length === 0) return null; 
    const maxMainParts = parseInt(quotaRes.rows[0].quota_main_parts) || 0;
    const maxSubParts = parseInt(quotaRes.rows[0].quota_sub_parts) || 0;
    if (maxMainParts === 0 && maxSubParts === 0) return null; 
    
    let sumQuery = `SELECT COALESCE(SUM(main_part_qty), 0) as total_main, COALESCE(SUM(sub_part_qty), 0) as total_sub FROM rizenicreport WHERE branch_name = $1 AND arrived_date::text LIKE $2 || '%'`;
    let sumParams = [branch_name, targetDate];
    if (excludeReportId) { sumQuery += ` AND id != $3`; sumParams.push(excludeReportId); }
    const sumRes = await pool.query(sumQuery, sumParams);
    
    const currentMainTotal = parseInt(sumRes.rows[0].total_main) || 0;
    const currentSubTotal = parseInt(sumRes.rows[0].total_sub) || 0;
    const requestingMainTotal = parseInt(newMainQty) || 0;
    const requestingSubTotal = parseInt(newSubQty) || 0;
    
    let errorMsg = [];
    if (maxMainParts > 0 && (currentMainTotal + requestingMainTotal > maxMainParts)) errorMsg.push(`ชิ้นส่วนหลักเกินโควต้า! (รับได้ ${maxMainParts} ชิ้น, ปัจจุบันมี ${currentMainTotal} ชิ้น)`);
    if (maxSubParts > 0 && (currentSubTotal + requestingSubTotal > maxSubParts)) errorMsg.push(`ชิ้นส่วนรองเกินโควต้า! (รับได้ ${maxSubParts} ชิ้น, ปัจจุบันมี ${currentSubTotal} ชิ้น)`);
    if (errorMsg.length > 0) return `โควต้าสำหรับวันที่ ${targetDate} สาขา ${branch_name}:\n` + errorMsg.join('\n');
    return null; 
}

router.get('/quotas', async (req, res) => { try { res.json((await pool.query('SELECT * FROM rizenic_quotas ORDER BY quota_type ASC, quota_date DESC')).rows); } catch (e) { res.status(500).json({ error: e.message }); } });
router.post('/quotas', async (req, res) => { try { const d = req.body; const result = await pool.query(`INSERT INTO rizenic_quotas (quota_type, quota_date, branch_name, quota_arrived, quota_target, quota_delivery, quota_main_parts, quota_sub_parts) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;`, [d.quota_type || 'default', d.quota_type === 'special' ? d.quota_date : null, d.branch_name, parseInt(d.quota_arrived) || 0, parseInt(d.quota_target) || 0, parseInt(d.quota_delivery) || 0, parseInt(d.quota_main_parts) || 0, parseInt(d.quota_sub_parts) || 0]); res.status(201).json({ success: true, data: result.rows[0] }); } catch (e) { res.status(500).json({ error: e.message }); } });
router.put('/quotas/:id', async (req, res) => { try { const d = req.body; await pool.query(`UPDATE rizenic_quotas SET quota_type=$1, quota_date=$2, branch_name=$3, quota_arrived=$4, quota_target=$5, quota_delivery=$6, quota_main_parts=$7, quota_sub_parts=$8 WHERE id=$9;`, [d.quota_type || 'default', d.quota_type === 'special' ? d.quota_date : null, d.branch_name, parseInt(d.quota_arrived) || 0, parseInt(d.quota_target) || 0, parseInt(d.quota_delivery) || 0, parseInt(d.quota_main_parts) || 0, parseInt(d.quota_sub_parts) || 0, req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
router.delete('/quotas/:id', async (req, res) => { try { await pool.query('DELETE FROM rizenic_quotas WHERE id = $1', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

router.get('/reports', async (req, res) => {
  try {
    const { start, end, branch } = req.query;
    let conditions = []; let params = [];
    if (branch && branch !== 'all') { params.push(branch); conditions.push(`branch_name = $${params.length}`); }
    if (start && end) {
      params.push(start, end);
      conditions.push(`((arrived_date >= $${params.length-1} AND arrived_date <= $${params.length}) OR (contact_date >= $${params.length-1} AND contact_date <= $${params.length}) OR (job_status NOT IN ('12.ส่งมอบ', '12.ส่งมอบแล้ว', '22.ปิดงาน', '18.ลูกค้ายกเลิก')))`);
    }
    const result = await pool.query(`SELECT * FROM rizenicreport ${conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''} ORDER BY id DESC`, params);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/report/:id', async (req, res) => { try { const result = await pool.query('DELETE FROM rizenicreport WHERE id = $1', [req.params.id]); if (result.rowCount > 0) res.json({ success: true }); else res.status(404).json({ error: 'ไม่พบใบงาน' }); } catch (err) { res.status(500).json({ error: err.message }); } });
router.get('/report/:id', async (req, res) => { try { const result = await pool.query('SELECT * FROM rizenicreport WHERE id = $1', [req.params.id]); if(result.rows.length > 0) res.json(result.rows[0]); else res.status(404).json({ error: 'ไม่พบข้อมูล' }); } catch (e) { res.status(500).json({ error: e.message }); } });

router.post('/report', async (req, res) => {
  try {
    const d = req.body;
    if (d.car_plate && d.contact_date) {
        const dupCheck = await pool.query(`SELECT id FROM rizenicreport WHERE car_plate = $1 AND DATE(contact_date) = DATE($2) LIMIT 1`, [d.car_plate, d.contact_date]);
        if (dupCheck.rows.length > 0) return res.status(400).json({ error: 'ซ้ำ! ใบงานรถคันนี้สร้างแล้ว' });
    }
    const quotaErrorMsg = await checkColorPartsQuota(d.branch_name, d.arrived_date, d.main_part_qty, d.sub_part_qty, null);
    if (quotaErrorMsg) return res.status(400).json({ error: quotaErrorMsg });

    const result = await pool.query(`INSERT INTO rizenicreport (sa_owner, branch_name, customer_name, phone_number, customer_type, car_brand, car_model, vin_no, qt_no, so_no, bl_no, payment_type, damage_level, main_part_name, main_part_qty, sub_part_name, sub_part_qty, cost_labor, cost_part, cost_external, notes, job_status, target_finish_date, actual_finish_date, delivery_date, contact_date, arrived_date, car_plate, epc_no, part_status, order_part_date, est_part_date, ordered_part_names, department_routing, is_parked) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35) RETURNING id;`, [d.sa_owner || null, d.branch_name || 'สำนักงานใหญ่', d.customer_name || null, d.phone_number || null, d.customer_type || null, d.car_brand || null, d.car_model || null, d.vin_no || null, d.qt_no || null, d.so_no || null, d.bl_no || null, d.payment_type || null, d.damage_level || 'เบา', d.main_part_name || null, d.main_part_qty || 0, d.sub_part_name || null, d.sub_part_qty || 0, d.cost_labor || 0, d.cost_part || 0, d.cost_external || 0, d.notes || null, d.job_status || null, d.target_finish_date || null, d.actual_finish_date || null, d.delivery_date || null, d.contact_date || null, d.arrived_date || null, d.car_plate || null, d.epc_no || null, d.part_status || null, d.order_part_date || null, d.est_part_date || null, d.ordered_part_names || null, d.department_routing || 'รอดำเนินการ', d.is_parked || 'ไม่จอดซ่อม']);
    res.status(201).json({ success: true, insertedId: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/report/:id', async (req, res) => {
  try {
    const d = req.body;
    const quotaErrorMsg = await checkColorPartsQuota(d.branch_name, d.arrived_date, d.main_part_qty, d.sub_part_qty, req.params.id);
    if (quotaErrorMsg) return res.status(400).json({ error: quotaErrorMsg });
    await pool.query(`UPDATE rizenicreport SET sa_owner=$1, branch_name=$2, customer_name=$3, phone_number=$4, customer_type=$5, car_brand=$6, car_model=$7, vin_no=$8, qt_no=$9, so_no=$10, bl_no=$11, payment_type=$12, damage_level=$13, main_part_name=$14, main_part_qty=$15, sub_part_name=$16, sub_part_qty=$17, cost_labor=$18, cost_part=$19, cost_external=$20, notes=$21, job_status=$22, target_finish_date=$23, actual_finish_date=$24, delivery_date=$25, contact_date=$26, arrived_date=$27, car_plate=$28, station_kho=$29, station_pou=$30, station_puan=$31, station_pon=$32, station_prak=$33, station_kat=$34, station_qc=$35, station_mag=$36, station_kraj=$37, station_film=$38, station_pak=$39, station_ready=$40, repair_notes=$41, repair_finish_date=$42, epc_no=$43, part_status=$44, order_part_date=$45, est_part_date=$46, ordered_part_names=$47, department_routing=$48, is_parked=$49, claim_no=$50 WHERE id=$51;`, [d.sa_owner || null, d.branch_name || 'สำนักงานใหญ่', d.customer_name || null, d.phone_number || null, d.customer_type || null, d.car_brand || null, d.car_model || null, d.vin_no || null, d.qt_no || null, d.so_no || null, d.bl_no || null, d.payment_type || null, d.damage_level || 'เบา', d.main_part_name || null, d.main_part_qty || 0, d.sub_part_name || null, d.sub_part_qty || 0, d.cost_labor || 0, d.cost_part || 0, d.cost_external || 0, d.notes || null, d.job_status || null, d.target_finish_date || null, d.actual_finish_date || null, d.delivery_date || null, d.contact_date || null, d.arrived_date || null, d.car_plate || null, d.station_kho || false, d.station_pou || false, d.station_puan || false, d.station_pon || false, d.station_prak || false, d.station_kat || false, d.station_qc || false, d.station_mag || false, d.station_kraj || false, d.station_film || false, d.station_pak || false, d.station_ready || false, d.repair_notes || null, d.repair_finish_date || null, d.epc_no || null, d.part_status || null, d.order_part_date || null, d.est_part_date || null, d.ordered_part_names || null, d.department_routing || 'รอดำเนินการ', d.is_parked || 'ไม่จอดซ่อม', d.claim_no || null, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/report/:id/station', async (req, res) => {
  try {
    const d = req.body;
    await pool.query(`UPDATE rizenicreport SET station_kho=$1, station_pou=$2, station_puan=$3, station_pon=$4, station_prak=$5, station_kat=$6, station_qc=$7, station_mag=$8, station_kraj=$9, station_film=$10, station_pak=$11, station_ready=$12, repair_notes=$13, repair_finish_date=$14, job_status=$15, department_routing=$16, target_finish_date=$17, delivery_date=$18 WHERE id=$19;`, [d.station_kho || false, d.station_pou || false, d.station_puan || false, d.station_pon || false, d.station_prak || false, d.station_kat || false, d.station_qc || false, d.station_mag || false, d.station_kraj || false, d.station_film || false, d.station_pak || false, d.station_ready || false, d.repair_notes || null, d.repair_finish_date || null, d.job_status || null, d.department_routing || 'ซ่อม', d.target_finish_date || null, d.delivery_date || null, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/report/:id/fast-date', async (req, res) => {
  try {
    const { field, value } = req.body;
    const validFields = ['target_finish_date', 'repair_finish_date', 'delivery_date', 'contact_date', 'arrived_date', 'order_part_date', 'est_part_date', 'appointment_date', 'car_plate', 'notes', 'qt_no', 'so_no', 'bl_no', 'sa_owner', 'damage_level', 'job_status','repair_notes', 'billing_date', 'ivn_no', 'cost_labor', 'cost_part', 'cost_external', 'department_routing', 'is_parked', 'customer_type', 'payment_type', 'car_brand', 'car_model', 'vin_no', 'customer_name', 'phone_number', 'customer_phone', 'epc_no', 'quotation_no', 'job_order_no', 'insurance_pay_date','car_color'];
    if (!validFields.includes(field)) return res.status(400).json({ error: 'ไม่อนุญาต' });
    let safeValue = value || null;
    if (['cost_labor', 'cost_part', 'cost_external'].includes(field)) safeValue = parseFloat(value) || 0;
    if (field === 'job_status') {
        const statusRes = await pool.query('SELECT department FROM rizenicstatusmaster WHERE status_name = $1', [value]);
        if (statusRes.rows.length > 0) {
            const newDepartment = statusRes.rows[0].department;
            await pool.query(`UPDATE rizenicreport SET job_status = $1, department_routing = $2 WHERE id = $3`, [value, newDepartment, req.params.id]);
            return res.json({ success: true, department_routing: newDepartment });
        }
    }
    await pool.query(`UPDATE rizenicreport SET ${field} = $1 WHERE id = $2`, [safeValue, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/inspection', async (req, res) => {
    const d = req.body;
    try {
        const result = await pool.query(`INSERT INTO inspection_reports (job_id, car_plate, branch_name, fuel_level, current_mileage, job_type, job_category, repair_checklist, inventory_checklist, electrical_checklist, car_diagram_image, customer_signature, inspector_signature, notes, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP) RETURNING *;`, [d.job_id, d.car_plate, d.branch_name, d.fuel_level || 0, d.current_mileage || 0, d.job_type, d.job_category, JSON.stringify(d.repair_checklist || {}), JSON.stringify(d.inventory_checklist || {}), JSON.stringify(d.electrical_checklist || {}), d.car_diagram_image, d.customer_signature, d.inspector_signature, d.notes]);
        res.json({ success: true, data: result.rows[0] });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/inspection/:job_id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM inspection_reports WHERE job_id = $1 ORDER BY id DESC LIMIT 1', [req.params.job_id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูล' });
        res.json({ success: true, data: result.rows[0] });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;