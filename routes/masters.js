const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// พนักงาน
router.get('/employees', async (req, res) => { try { res.json((await pool.query('SELECT * FROM rizenicemployeemaster ORDER BY branch_name ASC, employee_code ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); } });
router.post('/employees', async (req, res) => { try { const { employee_code, employee_name, employee_role, branch_name, username, password, accessible_pages } = req.body; const checkDup = await pool.query('SELECT username FROM rizenicemployeemaster WHERE username = $1', [username]); if (checkDup.rows.length > 0) return res.status(400).json({ error: 'Username ซ้ำ!' }); await pool.query('INSERT INTO rizenicemployeemaster (employee_code, employee_name, employee_role, branch_name, username, password, accessible_pages, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7, true)', [employee_code, employee_name, employee_role, branch_name, username, password, accessible_pages]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
router.put('/employees/:id', async (req, res) => { try { const { employee_code, employee_name, employee_role, branch_name, username, password, accessible_pages } = req.body; await pool.query('UPDATE rizenicemployeemaster SET employee_code=$1, employee_name=$2, employee_role=$3, branch_name=$4, username=$5, password=$6, accessible_pages=$7 WHERE employee_id=$8', [employee_code, employee_name, employee_role, branch_name, username, password, accessible_pages, req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
router.delete('/employees/:id', async (req, res) => { try { await pool.query('DELETE FROM rizenicemployeemaster WHERE employee_id = $1', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

// พาสเนอร์
router.get('/partners', async (req, res) => { try { res.json((await pool.query('SELECT * FROM rizenic_partners ORDER BY partner_id DESC')).rows); } catch (e) { res.status(500).json({ error: e.message }); } });
router.post('/partners', async (req, res) => { try { const { partner_name, username, password, customer_type_filter } = req.body; const checkDup = await pool.query('SELECT username FROM rizenic_partners WHERE username = $1', [username]); if (checkDup.rows.length > 0) return res.status(400).json({ error: 'Username ซ้ำ!' }); await pool.query('INSERT INTO rizenic_partners (partner_code, partner_name, username, password, customer_type_filter) VALUES ($1, $2, $3, $4, $5)', ['PTN-' + Math.floor(Math.random() * 10000), partner_name, username, password, customer_type_filter || null]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
router.put('/partners/:id', async (req, res) => { try { await pool.query('UPDATE rizenic_partners SET partner_name=$1, username=$2, password=$3, customer_type_filter=$4 WHERE partner_id=$5', [req.body.partner_name, req.body.username, req.body.password, req.body.customer_type_filter || null, req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
router.delete('/partners/:id', async (req, res) => { try { await pool.query('DELETE FROM rizenic_partners WHERE partner_id = $1', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

// รุ่นรถ
router.get('/car-models', async (req, res) => { try { res.json((await pool.query('SELECT model_id, car_brand, car_model FROM rizeniccarmodelmaster ORDER BY car_brand ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); } });
router.post('/car-models', async (req, res) => { try { await pool.query('INSERT INTO rizeniccarmodelmaster (car_brand, car_model) VALUES ($1, $2)', [req.body.car_brand, req.body.car_model]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
router.put('/car-models/:id', async (req, res) => { try { await pool.query('UPDATE rizeniccarmodelmaster SET car_brand=$1, car_model=$2 WHERE model_id=$3', [req.body.car_brand, req.body.car_model, req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
router.delete('/car-models/:id', async (req, res) => { try { await pool.query('DELETE FROM rizeniccarmodelmaster WHERE model_id = $1', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

// ประกันภัย
router.get('/insurances', async (req, res) => { try { res.json((await pool.query('SELECT insurance_code, insurance_name, insurance_type FROM rizenicinsurancemaster ORDER BY insurance_code ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); } });
router.post('/insurances', async (req, res) => { try { await pool.query('INSERT INTO rizenicinsurancemaster (insurance_code, insurance_name, insurance_type) VALUES ($1, $2, $3)', [req.body.insurance_code, req.body.insurance_name, req.body.insurance_type]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
router.put('/insurances/:id', async (req, res) => { try { await pool.query('UPDATE rizenicinsurancemaster SET insurance_name=$1, insurance_type=$2 WHERE insurance_code=$3', [req.body.insurance_name, req.body.insurance_type, req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
router.delete('/insurances/:id', async (req, res) => { try { await pool.query('DELETE FROM rizenicinsurancemaster WHERE insurance_code = $1', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

// ประเภทลูกค้า
router.get('/customer-types', async (req, res) => { try { res.json((await pool.query('SELECT customer_type_id, type_code, type_name FROM rizeniccustomertypemaster ORDER BY type_code ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); } });
router.post('/customer-types', async (req, res) => { try { const countResult = await pool.query('SELECT COUNT(*) FROM rizeniccustomertypemaster'); const nextNum = parseInt(countResult.rows[0].count) + 1; await pool.query('INSERT INTO rizeniccustomertypemaster (type_code, type_name) VALUES ($1, $2)', ['CT-' + String(nextNum).padStart(2, '0'), req.body.type_name]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
router.put('/customer-types/:id', async (req, res) => { try { await pool.query('UPDATE rizeniccustomertypemaster SET type_name = $1 WHERE customer_type_id = $2', [req.body.type_name, req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
router.delete('/customer-types/:id', async (req, res) => { try { await pool.query('DELETE FROM rizeniccustomertypemaster WHERE customer_type_id = $1', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

// สถานะการซ่อม
router.get('/statuses', async (req, res) => { try { res.json((await pool.query('SELECT * FROM rizenicstatusmaster ORDER BY status_code ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); } });
router.post('/statuses', async (req, res) => { try { await pool.query(`INSERT INTO rizenicstatusmaster (status_code, status_name, department, route_page) VALUES ($1, $2, $3, $4) ON CONFLICT (status_code) DO UPDATE SET status_name = EXCLUDED.status_name, department = EXCLUDED.department, route_page = EXCLUDED.route_page;`, [req.body.status_code, req.body.status_name, req.body.department || 'บริการ', req.body.route_page || 'jobs']); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
router.delete('/statuses/:id', async (req, res) => { try { await pool.query('DELETE FROM rizenicstatusmaster WHERE status_code = $1', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

// ชิ้นส่วนทำสี (Body Parts)
router.get('/body-parts', async (req, res) => { try { res.json((await pool.query('SELECT * FROM rizenic_body_parts ORDER BY id ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); } });
router.post('/body-parts', async (req, res) => { try { await pool.query('INSERT INTO rizenic_body_parts (category, part_name) VALUES ($1, $2)', [req.body.category, req.body.part_name]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
router.put('/body-parts/:id', async (req, res) => { try { await pool.query('UPDATE rizenic_body_parts SET category=$1, part_name=$2 WHERE id=$3', [req.body.category, req.body.part_name, req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
router.delete('/body-parts/:id', async (req, res) => { try { await pool.query('DELETE FROM rizenic_body_parts WHERE id=$1', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

// สถานะอะไหล่
router.get('/part-statuses', async (req, res) => { try { res.json((await pool.query('SELECT * FROM rizenic_part_status_master ORDER BY status_id ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); } });
router.post('/part-statuses', async (req, res) => { try { await pool.query('INSERT INTO rizenic_part_status_master (status_name) VALUES ($1)', [req.body.status_name]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
router.delete('/part-statuses/:id', async (req, res) => { try { await pool.query('DELETE FROM rizenic_part_status_master WHERE status_id = $1', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

module.exports = router;