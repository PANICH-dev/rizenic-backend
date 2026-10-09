const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const https = require('https');

router.post('/sync-dynamic', async (req, res) => {
    const { tableName, primaryKey, data } = req.body;
    if (!tableName || !data || !Array.isArray(data) || data.length === 0) return res.status(400).json({ error: "ข้อมูล Payload ไม่ถูกต้องครับนาย" });
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); 
        for (const row of data) {
            const rowKeys = Object.keys(row);
            if (rowKeys.length === 0) continue;
            const colsStr = rowKeys.join(', ');
            const valuePlaceholders = rowKeys.map((_, idx) => `$${idx + 1}`).join(', ');
            const values = rowKeys.map(k => row[k]);
            let sql = `INSERT INTO ${tableName} (${colsStr}) VALUES (${valuePlaceholders})`;
            if (primaryKey) {
                const updateCols = rowKeys.filter(col => col !== primaryKey && col !== 'id' && col !== 'part_id');
                if (updateCols.length > 0) {
                    const updateStr = updateCols.map(col => `${col} = EXCLUDED.${col}`).join(', ');
                    sql += ` ON CONFLICT (${primaryKey}) DO UPDATE SET ${updateStr}`;
                } else { sql += ` ON CONFLICT (${primaryKey}) DO NOTHING`; }
            }
            await client.query(sql, values);
        }
        await client.query('COMMIT'); 
        res.json({ success: true, message: `อัปโหลดเข้าตาราง ${tableName} สำเร็จ ${data.length} รายการ!` });
    } catch (err) {
        await client.query('ROLLBACK'); 
        res.status(500).json({ error: err.message });
    } finally { client.release(); }
});

router.get('/user-preferences/:empName', async (req, res) => {
  try {
    const { empName } = req.params;
    const result = await pool.query('SELECT hidden_columns, row_highlights FROM user_column_preferences WHERE emp_name = $1', [empName]);
    if (result.rows.length > 0) {
      let pref = result.rows[0];
      if (typeof pref.hidden_columns === 'string') pref.hidden_columns = JSON.parse(pref.hidden_columns);
      if (typeof pref.row_highlights === 'string') pref.row_highlights = JSON.parse(pref.row_highlights);
      res.json(pref);
    } else { res.json({ hidden_columns: null, row_highlights: null }); }
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/user-preferences', async (req, res) => {
  try {
    const { emp_name, hidden_columns, row_highlights } = req.body;
    const jsonCols = JSON.stringify(hidden_columns || { hidden: [], order: [] });
    const jsonHl = JSON.stringify(row_highlights || {});
    await pool.query(`INSERT INTO user_column_preferences (emp_name, hidden_columns, row_highlights, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) ON CONFLICT (emp_name) DO UPDATE SET hidden_columns = EXCLUDED.hidden_columns, row_highlights = EXCLUDED.row_highlights, updated_at = CURRENT_TIMESTAMP;`, [emp_name, jsonCols, jsonHl]);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/send-line-notify', async (req, res) => {
  try {
    const { branch, message } = req.body;
    if (!message) return res.status(400).json({ error: "ไม่มีข้อความให้ส่ง" });
    let targetToken = "", targetGroup = ""; 
    if (branch === 'Rangsit' || branch === 'สาขารังสิต') {
        targetToken = "uWGDH1BPHvILvBn7Hyeimv20W8ITfbUpGV2jfy1ujMUjvFxceSEtpM50S9vAcJmy05ybn6g/wHspfuTbfUuAI5UCB2RkifntfIeOT9EOo09FfQel63guAJgMs8zhAbbP0dq8fMENKirsWXoFzYMaXgdB04t89/1O/w1cDnyilFU=";
        targetGroup = "C762221d8214dd72b5469f74879c19bec";
    } else if (branch === 'Navamin' || branch === 'สาขานวมินทร์') {
        targetToken = "5+CtgK2jCINRJW0Ddz/18TrLbE1hq68iVdOyZTvgwYeQWA2okMHoFfPYUK4MlKMf1Y+JqSn4Bodqk7i0DThvO+DTOmwzsyiNxwGqTctqo/QJBlbdYsb97BF981TiVnNO6ufvV6767mS0qkzJWGKgegdB04t89/1O/w1cDnyilFU=";
        targetGroup = "C61a43306f4630b569fe423165db923f8";
    } else { return res.status(400).json({ error: `ไม่พบสาขา: ${branch}` }); }

    const postData = JSON.stringify({ to: targetGroup, messages: [{ type: "text", text: message }] });
    const options = { hostname: 'api.line.me', path: '/v2/bot/message/push', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${targetToken}`, 'Content-Length': Buffer.byteLength(postData) } };
    const request = https.request(options, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        if (response.statusCode === 200) res.json({ success: true, message: "ส่งเข้ากลุ่ม LINE เรียบร้อยครับ!" });
        else res.status(response.statusCode).json({ error: "ส่ง LINE ไม่สำเร็จ: " + data });
      });
    });
    request.on('error', (error) => { res.status(500).json({ error: error.message }); });
    request.write(postData); request.end();
  } catch (error) { res.status(500).json({ error: error.message }); }
});

module.exports = router;