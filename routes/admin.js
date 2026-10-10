const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { google } = require('googleapis');

// ==========================================
// 📁 ADMIN: ตั้งค่า Google Drive Root Folder
// ==========================================
router.post('/admin/drive-config', async (req, res) => {
    const { folder_name, drive_url } = req.body;
    
    const match = drive_url.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (!match) {
        return res.status(400).json({ error: 'รูปแบบ URL ไม่ถูกต้อง ต้องเป็นลิงก์โฟลเดอร์จาก Google Drive' });
    }
    
    const folderId = match[1];
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // ยกเลิก Active โฟลเดอร์เก่าทั้งหมด
        await client.query('UPDATE drive_config SET is_active = false');
        
        // บันทึกโฟลเดอร์ใหม่และตั้งให้เป็น Active
        await client.query(
            'INSERT INTO drive_config (folder_name, drive_folder_id, drive_folder_url, is_active) VALUES ($1, $2, $3, true)',
            [folder_name, folderId, drive_url]
        );
        
        await client.query('COMMIT');
        res.json({ success: true, message: 'บันทึกการตั้งค่าโฟลเดอร์หลักเรียบร้อย' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Drive Config Error:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดบนเซิร์ฟเวอร์' });
    } finally {
        client.release();
    }
});

// API สำหรับดึงการตั้งค่าโฟลเดอร์ปัจจุบัน
router.get('/admin/drive-config/active', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM drive_config ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 🔑 OAuth 2.0 Callback Receiver
// ==========================================
router.get('/admin/drive-callback', async (req, res) => {
    const { code, error } = req.query;

    if (error) {
        return res.status(400).send(`<h2>❌ Google OAuth Error: ${error}</h2>`);
    }

    if (!code) {
        return res.status(400).send('<h2>❌ ไม่พบ Authorization Code จาก Google</h2>');
    }

    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        // แลก Code เป็น Tokens
        const { tokens } = await oauth2Client.getToken(code);
        
        if (!tokens.refresh_token) {
            return res.send(`
                <h2>⚠️ เชื่อมต่อสำเร็จ แต่ไม่ได้ Refresh Token</h2>
                <p>กรุณาเข้าไปที่ <a href="https://myaccount.google.com/permissions">Google Account Permissions</a> แล้วลบสิทธิ์แอปนี้ออก ก่อนกดเชื่อมต่อใหม่อีกครั้งครับ</p>
            `);
        }

        // อัปเดต Refresh Token ลงในแถวที่ Active อยู่ปัจจุบัน (เช่น โฟลเดอร์ 2026)
        const updateRes = await pool.query(
            `UPDATE drive_config SET refresh_token = $1, is_active = true WHERE is_active = true`,
            [tokens.refresh_token]
        );

        // หากยังไม่มีแถว Active เลย ให้ INSERT ใหม่
        if (updateRes.rowCount === 0) {
            await pool.query(
                `INSERT INTO drive_config (folder_name, refresh_token, is_active) VALUES ($1, $2, true)`,
                ['Google Drive OAuth', tokens.refresh_token]
            );
        }

        res.send('<h2>✅ เชื่อมต่อ Google Drive สำเร็จเรียบร้อย! ปิดหน้านี้ได้เลยครับ</h2>');

    } catch (err) {
        console.error('OAuth Callback Error:', err.response ? err.response.data : err.message);
        res.status(500).send(`
            <h2>❌ เกิดข้อผิดพลาดในการเชื่อมต่อ Google Drive</h2>
            <p><b>สาเหตุ:</b> ${err.message}</p>
        `);
    }
});

module.exports = router;